/* =========================================================
   Inochi2D Parameter Module
   ---------------------------------------------------------
   パラメータ関連だけを担当。
   担当:
   - scalar parameter
   - vec2 parameter
   - parameter handle 解決
   - runtime parameter 書き込み
   - parameter reset
   - parameter 適用
   - parameter debug 情報
   - parameter source / owner との連携
   本体側から渡された Map / callback を利用する。
   ========================================================= */
export function createParameterController({
  runtime,
  canvas,
  parameterById,
  parameterValues,
  vectorParameterValues,
  parameterHandleById,
  unresolvedParameterHandleIds,
  lastRuntimeParameterValues,
  markParameterSource,
  markParameterOwner,
  mouthParameterId = 'Mouth:: Shape',
}) {
  /* =======================================================
     基本ユーティリティ
     ======================================================= */
  const isFiniteNumber = (value) =>
    typeof value === 'number' && Number.isFinite(value);
  const getParameter = (parameterId) =>
    parameterById?.get(parameterId) ?? null;
  const hasParameter = (parameterId) =>
    Boolean(parameterById?.has(parameterId));
  /* =======================================================
     Parameter Handle
     ======================================================= */
  const resolveParameterHandle = (parameterId) => {
    if (
      !runtime ||
      typeof runtime.resolve_parameter_handle_by_name !== 'function'
    ) {
      return null;
    }
    if (parameterHandleById.has(parameterId)) {
      return parameterHandleById.get(parameterId);
    }
    try {
      const handle =
        runtime.resolve_parameter_handle_by_name(parameterId);
      parameterHandleById.set(parameterId, handle);
      return handle;
    } catch {
      unresolvedParameterHandleIds.add(parameterId);
      parameterHandleById.set(parameterId, null);
      return null;
    }
  };
  /* =======================================================
     Runtime Scalar Parameter
     -------------------------------------------------------
     Inochi2D 側では scalar も内部的には vec2 setter を
     使用できるため、既存本体の挙動に合わせる。
     ======================================================= */
  const setScalarParameterValue = (
    parameterId,
    value,
  ) => {
    if (!runtime) {
      return;
    }
    const parameter = getParameter(parameterId);
    const safeValue = isFiniteNumber(value)
      ? value
      : parameter?.defaultValue?.[0] ?? 0;
    const defaultY =
      parameter?.defaultValue?.[1] ?? 0;
    setParameterVectorValue(
      parameterId,
      safeValue,
      defaultY,
    );
  };
  /* =======================================================
     Runtime Vec2 Parameter
     ======================================================= */
  const setParameterVectorValue = (
    parameterId,
    valueX,
    valueY,
  ) => {
    if (!runtime) {
      return;
    }
    const parameter = getParameter(parameterId);
    const safeX = isFiniteNumber(valueX)
      ? valueX
      : parameter?.defaultValue?.[0] ?? 0;
    const safeY = isFiniteNumber(valueY)
      ? valueY
      : parameter?.defaultValue?.[1] ?? 0;
    /*
     * 口パラメータだけ必要ならここで確認できる。
     * デバッグ時にも本体コードを変更せずに済む。
     */
    if (parameterId === mouthParameterId) {
      console.log(
        '[MOUTH WRITE]',
        parameterId,
        'X=',
        safeX,
        'Y=',
        safeY,
      );
    }
    const parameterHandle =
      resolveParameterHandle(parameterId);
    /*
     * handle API を優先
     */
    if (
      parameterHandle !== null &&
      typeof runtime.set_parameter_vec2_by_handle ===
        'function'
    ) {
      runtime.set_parameter_vec2_by_handle(
        parameterHandle,
        safeX,
        safeY,
      );
    }
    /*
     * handle API が使えない場合は名前 API
     */
    else if (
      typeof runtime.set_parameter_vec2 ===
      'function'
    ) {
      runtime.set_parameter_vec2(
        parameterId,
        safeX,
        safeY,
      );
    }
    /*
     * 最後に現在値を記録。
     *
     * これは animation / lip-sync / expression など
     * 複数レイヤーが同じパラメータを書く際の
     * デバッグにも利用できる。
     */
    lastRuntimeParameterValues.set(
      parameterId,
      parameter.isVec2
        ? [safeX, safeY]
        : [safeX, safeY],
    );
    if (canvas) {
      canvas.dataset.inochi2dTestParameter =
        `${parameterId}:${safeX.toFixed(3)},${safeY.toFixed(3)}`;
      if (parameterId === mouthParameterId) {
        canvas.dataset.inochi2dMouthShape =
          `${safeX.toFixed(3)},${safeY.toFixed(3)}`;
      }
    }
  };
  /* =======================================================
     Post Physics Vec2 Parameter
     ======================================================= */
  const setPostPhysicsParameterVectorValue = (
    parameterId,
    valueX,
    valueY,
  ) => {
    if (!runtime) {
      return;
    }
    const parameter = getParameter(parameterId);
    const safeX = isFiniteNumber(valueX)
      ? valueX
      : parameter?.defaultValue?.[0] ?? 0;
    const safeY = isFiniteNumber(valueY)
      ? valueY
      : parameter?.defaultValue?.[1] ?? 0;
    if (parameterId === mouthParameterId) {
      console.log(
        '[MOUTH POST PHYSICS]',
        parameterId,
        'X=',
        safeX,
        'Y=',
        safeY,
      );
      if (canvas) {
        canvas.dataset.inochi2dMouthDebug =
          `MOUTH ${safeX.toFixed(3)}, ${safeY.toFixed(3)}`;
      }
    }
    const parameterHandle =
      resolveParameterHandle(parameterId);
    if (
      parameterHandle !== null &&
      typeof runtime
        .set_post_physics_parameter_vec2_by_handle ===
        'function'
    ) {
      runtime.set_post_physics_parameter_vec2_by_handle(
        parameterHandle,
        safeX,
        safeY,
      );
      return;
    }
    if (
      typeof runtime.set_post_physics_parameter_vec2 ===
      'function'
    ) {
      runtime.set_post_physics_parameter_vec2(
        parameterId,
        safeX,
        safeY,
      );
    }
  };
  /* =======================================================
     Base Parameter Apply
     -------------------------------------------------------
     Animation が触っている parameter は本体側から
     excludedParameterIds として渡して除外する。
     ======================================================= */
  const applyParameters = (
    excludedParameterIds = new Set(),
  ) => {
    if (!runtime) {
      return;
    }
    /*
     * Scalar
     */
    for (const [
      parameterId,
      value,
    ] of parameterValues.entries()) {
      if (
        excludedParameterIds.has(parameterId)
      ) {
        continue;
      }
      if (typeof markParameterSource === 'function') {
        markParameterSource(
          parameterId,
          'base',
        );
      }
      if (typeof markParameterOwner === 'function') {
        markParameterOwner(
          parameterId,
          'base',
        );
      }
      setScalarParameterValue(
        parameterId,
        value,
      );
    }
    /*
     * Vec2
     */
    for (const [
      parameterId,
      value,
    ] of vectorParameterValues.entries()) {
      if (
        excludedParameterIds.has(parameterId)
      ) {
        continue;
      }
      if (!Array.isArray(value)) {
        continue;
      }
      if (typeof markParameterSource === 'function') {
        markParameterSource(
          parameterId,
          'base',
        );
      }
      if (typeof markParameterOwner === 'function') {
        markParameterOwner(
          parameterId,
          'base',
        );
      }
      setParameterVectorValue(
        parameterId,
        value[0],
        value[1],
      );
    }
  };
  /* =======================================================
     Reset One Parameter
     ======================================================= */
  const resetParameter = (
    parameterId,
  ) => {
    const parameter =
      getParameter(parameterId);
    if (!parameter) {
      return false;
    }
    const defaultValue =
      Array.isArray(parameter.defaultValue)
        ? parameter.defaultValue
        : [0, 0];
    if (parameter.isVec2) {
      setParameterVectorValue(
        parameterId,
        defaultValue[0] ?? 0,
        defaultValue[1] ?? 0,
      );
    } else {
      setScalarParameterValue(
        parameterId,
        defaultValue[0] ?? 0,
      );
    }
    parameterValues.delete(
      parameterId,
    );
    vectorParameterValues.delete(
      parameterId,
    );
    if (typeof markParameterSource === 'function') {
      markParameterSource(
        parameterId,
        'default',
      );
    }
    return true;
  };
  /* =======================================================
     Reset Multiple Parameters
     ======================================================= */
  const resetParameters = (
    parameterIds,
  ) => {
    const resetIds = [];
    if (!parameterIds) {
      return resetIds;
    }
    for (const parameterId of parameterIds) {
      if (resetParameter(parameterId)) {
        resetIds.push(parameterId);
      }
    }
    return resetIds;
  };
  /* =======================================================
     Set Base Scalar
     ======================================================= */
  const setParameter = (
    parameterId,
    value,
  ) => {
    if (!hasParameter(parameterId)) {
      return false;
    }
    parameterValues.set(
      parameterId,
      value,
    );
    vectorParameterValues.delete(
      parameterId,
    );
    setScalarParameterValue(
      parameterId,
      value,
    );
    return true;
  };
  /* =======================================================
     Set Base Vec2
     ======================================================= */
  const setParameterVector = (
    parameterId,
    valueX,
    valueY,
  ) => {
    if (!hasParameter(parameterId)) {
      return false;
    }
    parameterValues.delete(
      parameterId,
    );
    vectorParameterValues.set(
      parameterId,
      [
        valueX,
        valueY,
      ],
    );
    setParameterVectorValue(
      parameterId,
      valueX,
      valueY,
    );
    if (
      canvas &&
      parameterId === mouthParameterId
    ) {
      canvas.dataset.inochi2dMouthShape =
        `${valueX.toFixed(3)},${valueY.toFixed(3)}`;
    }
    return true;
  };
  /* =======================================================
     Parameter Names
     ======================================================= */
  const getParameterNames = () =>
    parameterById
      ? [...parameterById.keys()]
      : [];
  /* =======================================================
     Parameter Debug Info
     ======================================================= */
  const getParameterDebugInfo = () =>
    parameterById
      ? [
          ...parameterById.entries(),
        ].map(
          ([
            id,
            parameter,
          ]) => ({
            id,
            isVec2:
              Boolean(parameter?.isVec2),
            defaultValue:
              Array.isArray(
                parameter?.defaultValue,
              )
                ? [
                    ...parameter.defaultValue,
                  ]
                : [0, 0],
            handle:
              parameterHandleById.has(id)
                ? parameterHandleById.get(id)
                : null,
            unresolved:
              unresolvedParameterHandleIds.has(
                id,
              ),
            runtimeValue:
              lastRuntimeParameterValues.has(id)
                ? lastRuntimeParameterValues.get(id)
                : null,
          }),
        )
      : [];
  /* =======================================================
     Runtime Values
     ======================================================= */
  const getRuntimeParameterValue = (
    parameterId,
  ) => {
    if (
      !lastRuntimeParameterValues.has(
        parameterId,
      )
    ) {
      return null;
    }
    const value =
      lastRuntimeParameterValues.get(
        parameterId,
      );
    return Array.isArray(value)
      ? [...value]
      : value;
  };
  /* =======================================================
     Parameter State
     ======================================================= */
  const getState = () => ({
    parameterCount:
      parameterById?.size ?? 0,
    parameterNames:
      getParameterNames(),
    scalarValues:
      Object.fromEntries(
        parameterValues.entries(),
      ),
    vectorValues:
      Object.fromEntries(
        vectorParameterValues.entries(),
      ),
    runtimeValues:
      Object.fromEntries(
        [...lastRuntimeParameterValues.entries()]
          .map(
            ([
              id,
              value,
            ]) => [
              id,
              Array.isArray(value)
                ? [...value]
                : value,
            ],
          ),
      ),
    unresolvedParameterHandles:
      [
        ...unresolvedParameterHandleIds,
      ],
  });
  /* =======================================================
     Clear Runtime Cache
     ======================================================= */
  const clearRuntimeCache = () => {
    lastRuntimeParameterValues.clear();
    parameterHandleById.clear();
    unresolvedParameterHandleIds.clear();
  };
  /* =======================================================
     Return API
     ======================================================= */
  return {
    resolveParameterHandle,
    setParameterVectorValue,
    setScalarParameterValue,
    setPostPhysicsParameterVectorValue,
    applyParameters,
    setParameter,
    setParameterVector,
    resetParameter,
    resetParameters,
    getParameterNames,
    getParameterDebugInfo,
    getRuntimeParameterValue,
    getState,
    clearRuntimeCache,
    hasParameter,
    getParameter,
  };
}

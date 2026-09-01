/* =========================================================
   Inochi2D Expression Module
   ---------------------------------------------------------
   表情レイヤーだけを担当。
   ・表情値の保持
   ・表情プリセット
   ・表情パラメータの書き込み
   ・表情レイヤーの解除
   ・デバッグ情報
   ========================================================= */
export function createExpressionController({
  runtime,
  canvas,
  parameterById,
  setScalarParameterValue,
  setParameterVectorValue,
  markParameterSource,
  ensureLoop,
}) {
  let expressionLayer = {
    name: null,
    active: false,
    values: new Map(),
  };
  /*
   * 表情プリセット
   *
   * 必要になったらここへ追加できる。
   * 数値はモデル側に存在するパラメータだけが書き込まれる。
   */
  const expressionPresets = new Map();
  const normalizeNumber = (value, fallback = 0) =>
    Number.isFinite(Number(value))
      ? Number(value)
      : fallback;
  const normalizeValues = (values) => {
    if (!values || typeof values !== 'object') {
      return new Map();
    }
    const result = new Map();
    for (const [parameterId, value] of Object.entries(values)) {
      if (!parameterById.has(parameterId)) {
        continue;
      }
      const parameter = parameterById.get(parameterId);
      if (parameter?.isVec2 && Array.isArray(value)) {
        result.set(parameterId, [
          normalizeNumber(value[0]),
          normalizeNumber(value[1]),
        ]);
        continue;
      }
      if (!parameter?.isVec2) {
        result.set(
          parameterId,
          normalizeNumber(
            Array.isArray(value) ? value[0] : value,
          ),
        );
      }
    }
    return result;
  };
  const updateCanvasDebug = () => {
    if (!canvas) {
      return;
    }
    canvas.dataset.inochi2dExpressionLayer =
      expressionLayer.active && expressionLayer.name
        ? expressionLayer.name
        : 'idle';
    canvas.dataset.inochi2dExpressionParameterCount =
      String(expressionLayer.values.size);
  };
  const applyValues = () => {
    if (!runtime) {
      return;
    }
    const source = expressionLayer.name
      ? `expression:${expressionLayer.name}`
      : 'expression';
    for (const [parameterId, value] of expressionLayer.values.entries()) {
      markParameterSource(parameterId, source);
      const parameter = parameterById.get(parameterId);
      if (parameter?.isVec2 && Array.isArray(value)) {
        setParameterVectorValue(
          parameterId,
          value[0],
          value[1],
        );
      } else {
        setScalarParameterValue(
          parameterId,
          normalizeNumber(value),
        );
      }
    }
  };
  /*
   * 表情レイヤーを設定。
   *
   * 例:
   * setValue('happy', {
   *   'Face:: Smile': 1,
   * });
   */
  const setExpressionLayerValue = (
    name,
    values,
    options = {},
  ) => {
    const normalizedName =
      typeof name === 'string' && name.trim().length > 0
        ? name.trim()
        : null;
    const normalizedValues = normalizeValues(values);
    expressionLayer = {
      name: normalizedName,
      active:
        normalizedValues.size > 0 &&
        options.active !== false,
      values: normalizedValues,
    };
    if (options.apply !== false) {
      applyValues();
    }
    updateCanvasDebug();
    ensureLoop();
  };
  /*
   * 登録済みプリセットを適用。
   */
  const setExpressionPresetValue = (
    name,
    options = {},
  ) => {
    if (
      typeof name !== 'string' ||
      !expressionPresets.has(name)
    ) {
      return false;
    }
    const preset = expressionPresets.get(name);
    setExpressionLayerValue(
      name,
      preset,
      options,
    );
    return true;
  };
  /*
   * プリセットを登録。
   *
   * 本体側から必要なときだけ呼ぶ。
   */
  const registerExpressionPreset = (
    name,
    values,
  ) => {
    if (
      typeof name !== 'string' ||
      name.trim().length === 0
    ) {
      return false;
    }
    const normalizedValues =
      Object.fromEntries(
        normalizeValues(values).entries(),
      );
    expressionPresets.set(
      name.trim(),
      normalizedValues,
    );
    return true;
  };
  /*
   * 現在の表情を解除。
   *
   * 実際のパラメータを初期値へ戻す処理は
   * 本体の base parameter layer に任せる。
   */
  const clearExpressionLayerValue = (
    name = null,
  ) => {
    if (
      name !== null &&
      expressionLayer.name !== name
    ) {
      return;
    }
    expressionLayer = {
      name: null,
      active: false,
      values: new Map(),
    };
    updateCanvasDebug();
    ensureLoop();
  };
  /*
   * モデル再読み込み時などに使用。
   */
  const reset = () => {
    expressionLayer = {
      name: null,
      active: false,
      values: new Map(),
    };
    updateCanvasDebug();
  };
  const getExpressionPresetNames = () =>
    [...expressionPresets.keys()];
  const getState = () => ({
    name: expressionLayer.name,
    active: expressionLayer.active,
    values: Object.fromEntries(
      expressionLayer.values.entries(),
    ),
    presetNames: getExpressionPresetNames(),
  });
  const getPreset = (name) =>
    expressionPresets.has(name)
      ? {
          ...expressionPresets.get(name),
        }
      : null;
  return {
    setValue: setExpressionLayerValue,
    setPreset: setExpressionPresetValue,
    registerPreset: registerExpressionPreset,
    clear: clearExpressionLayerValue,
    apply: applyValues,
    reset,
    getState,
    getPreset,
    getPresetNames: getExpressionPresetNames,
  };
}

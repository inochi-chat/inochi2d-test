/* =========================================================
   Inochi2D Expression Module
   ---------------------------------------------------------
   表情・Expression Preset 関連だけを担当。
   本体側から後で完全に切り離しやすい構成。
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
  /*
   * -------------------------------------------------------
   * State
   * -------------------------------------------------------
   */
  let expressionLayer = {
    name: null,
    values: {},
    active: false,
  };
  /*
   * -------------------------------------------------------
   * Helpers
   * -------------------------------------------------------
   */
  const clamp01 = (value) =>
    Math.min(
      1,
      Math.max(
        0,
        Number.isFinite(value) ? value : 0,
      ),
    );
  const isValidParameter = (parameterId) =>
    typeof parameterId === 'string' &&
    parameterId.length > 0 &&
    parameterById.has(parameterId);
  const normalizeValue = (value) => {
    if (Array.isArray(value)) {
      return {
        type: 'vec2',
        x: Number.isFinite(value[0]) ? value[0] : 0,
        y: Number.isFinite(value[1]) ? value[1] : 0,
      };
    }
    if (
      value &&
      typeof value === 'object'
    ) {
      if (
        Number.isFinite(value.x) ||
        Number.isFinite(value.y)
      ) {
        return {
          type: 'vec2',
          x: Number.isFinite(value.x) ? value.x : 0,
          y: Number.isFinite(value.y) ? value.y : 0,
        };
      }
      if (Number.isFinite(value.value)) {
        return {
          type: 'scalar',
          value: value.value,
        };
      }
    }
    return {
      type: 'scalar',
      value: Number.isFinite(value) ? value : 0,
    };
  };
  const normalizeValues = (values) => {
    if (!values || typeof values !== 'object') {
      return {};
    }
    const result = {};
    for (const [parameterId, value] of Object.entries(values)) {
      if (!isValidParameter(parameterId)) {
        continue;
      }
      result[parameterId] = normalizeValue(value);
    }
    return result;
  };
  /*
   * -------------------------------------------------------
   * Canvas debug
   * -------------------------------------------------------
   */
  const updateCanvasDebug = () => {
    if (!canvas) {
      return;
    }
    canvas.dataset.inochi2dExpressionLayer =
      expressionLayer.active
        ? expressionLayer.name ?? 'active'
        : 'idle';
    canvas.dataset.inochi2dExpressionParameterCount =
      String(
        Object.keys(expressionLayer.values).length,
      );
  };
  /*
   * -------------------------------------------------------
   * Apply one value
   * -------------------------------------------------------
   */
  const applyExpressionParameter = (
    parameterId,
    normalizedValue,
    sourceName,
  ) => {
    if (!runtime) {
      return;
    }
    if (!isValidParameter(parameterId)) {
      return;
    }
    if (normalizedValue.type === 'vec2') {
      markParameterSource(
        parameterId,
        sourceName,
      );
      setParameterVectorValue(
        parameterId,
        normalizedValue.x,
        normalizedValue.y,
      );
      return;
    }
    markParameterSource(
      parameterId,
      sourceName,
    );
    setScalarParameterValue(
      parameterId,
      normalizedValue.value,
    );
  };
  /*
   * -------------------------------------------------------
   * Set expression layer
   * -------------------------------------------------------
   */
  const setExpressionLayerValue = (
    name,
    values,
    options = {},
  ) => {
    const normalizedValues =
      normalizeValues(values);
    const nextName =
      typeof name === 'string' &&
      name.trim().length > 0
        ? name.trim()
        : null;
    expressionLayer = {
      name: nextName,
      values: normalizedValues,
      active:
        Object.keys(normalizedValues).length > 0,
    };
    if (options.immediate !== false) {
      applyExpressionLayer();
    }
    updateCanvasDebug();
    ensureLoop();
  };
  /*
   * -------------------------------------------------------
   * Apply expression layer
   * -------------------------------------------------------
   */
  const applyExpressionLayer = () => {
    if (!runtime) {
      return;
    }
    if (!expressionLayer.active) {
      return;
    }
    const sourceName =
      `expression:${expressionLayer.name ?? 'active'}`;
    for (const [
      parameterId,
      normalizedValue,
    ] of Object.entries(
      expressionLayer.values,
    )) {
      applyExpressionParameter(
        parameterId,
        normalizedValue,
        sourceName,
      );
    }
    updateCanvasDebug();
  };
  /*
   * -------------------------------------------------------
   * Clear expression layer
   * -------------------------------------------------------
   */
  const clearExpressionLayerValue = (
    name = null,
  ) => {
    if (
      name &&
      expressionLayer.name !== name
    ) {
      return;
    }
    expressionLayer = {
      name: null,
      values: {},
      active: false,
    };
    updateCanvasDebug();
    ensureLoop();
  };
  /*
   * -------------------------------------------------------
   * Presets
   * -------------------------------------------------------
   *
   * プリセットはここにまとめる。
   * 後から増やしたり削除したりしやすい。
   */
  const expressionPresets = new Map();
  /*
   * -------------------------------------------------------
   * Register preset
   * -------------------------------------------------------
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
      normalizeValues(values);
    expressionPresets.set(
      name.trim(),
      normalizedValues,
    );
    return true;
  };
  /*
   * -------------------------------------------------------
   * Set preset
   * -------------------------------------------------------
   */
  const setExpressionPresetValue = (
    name,
    options = {},
  ) => {
    if (
      typeof name !== 'string' ||
      name.trim().length === 0
    ) {
      return false;
    }
    const preset =
      expressionPresets.get(name.trim());
    if (!preset) {
      return false;
    }
    setExpressionLayerValue(
      name.trim(),
      preset,
      options,
    );
    return true;
  };
  /*
   * -------------------------------------------------------
   * Remove preset
   * -------------------------------------------------------
   */
  const removeExpressionPreset = (name) => {
    if (
      typeof name !== 'string'
    ) {
      return false;
    }
    return expressionPresets.delete(
      name.trim(),
    );
  };
  /*
   * -------------------------------------------------------
   * List preset names
   * -------------------------------------------------------
   */
  const listExpressionPresetNames = () =>
    [...expressionPresets.keys()];
  /*
   * -------------------------------------------------------
   * Get current state
   * -------------------------------------------------------
   */
  const getState = () => ({
    name: expressionLayer.name,
    active: expressionLayer.active,
    values: Object.fromEntries(
      Object.entries(
        expressionLayer.values,
      ).map(([parameterId, value]) => [
        parameterId,
        value.type === 'vec2'
          ? {
              x: value.x,
              y: value.y,
            }
          : {
              value: value.value,
            },
      ]),
    ),
  });
  /*
   * -------------------------------------------------------
   * Reset
   * -------------------------------------------------------
   */
  const reset = () => {
    expressionLayer = {
      name: null,
      values: {},
      active: false,
    };
    updateCanvasDebug();
  };
  /*
   * -------------------------------------------------------
   * Public API
   * -------------------------------------------------------
   */
  return {
    setValue: setExpressionLayerValue,
    apply: applyExpressionLayer,
    clear: clearExpressionLayerValue,
    setPreset: setExpressionPresetValue,
    registerPreset:
      registerExpressionPreset,
    removePreset:
      removeExpressionPreset,
    listPresetNames:
      listExpressionPresetNames,
    getState,
    reset,
  };
}

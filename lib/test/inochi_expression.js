/* =========================================================
   Inochi2D Expression Module
   ---------------------------------------------------------
   表情レイヤー関連だけを担当。
   本体側から切り離して管理しやすくする。
   ========================================================= */

export function createExpressionController({
  runtime,
  canvas,
  parameterById,
  setParameterValue,
  setParameterVectorValue,
  markParameterSource,
  ensureLoop,
}) {
  /*
   * -------------------------------------------------------
   * 内部状態
   * -------------------------------------------------------
   */

  let expressionLayer = {
    name: null,
    active: false,
    values: new Map(),
  };

  let expressionPresets = new Map();

  /*
   * -------------------------------------------------------
   * Utility
   * -------------------------------------------------------
   */

  const isFiniteNumber = (value) =>
    typeof value === 'number' && Number.isFinite(value);

  const normalizeValue = (value, fallback = 0) =>
    isFiniteNumber(value) ? value : fallback;

  const normalizeVector = (value) => {
    if (!Array.isArray(value)) {
      return null;
    }

    return [
      normalizeValue(value[0], 0),
      normalizeValue(value[1], 0),
    ];
  };

  const normalizeParameterValues = (values) => {
    const normalized = new Map();

    if (!values || typeof values !== 'object') {
      return normalized;
    }

    if (values instanceof Map) {
      for (const [parameterId, value] of values.entries()) {
        if (typeof parameterId !== 'string') {
          continue;
        }

        if (Array.isArray(value)) {
          const vector = normalizeVector(value);

          if (vector) {
            normalized.set(parameterId, vector);
          }
        } else {
          normalized.set(
            parameterId,
            normalizeValue(value, 0),
          );
        }
      }

      return normalized;
    }

    for (const [parameterId, value] of Object.entries(values)) {
      if (Array.isArray(value)) {
        const vector = normalizeVector(value);

        if (vector) {
          normalized.set(parameterId, vector);
        }
      } else {
        normalized.set(
          parameterId,
          normalizeValue(value, 0),
        );
      }
    }

    return normalized;
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
      expressionLayer.active &&
      expressionLayer.name
        ? expressionLayer.name
        : 'idle';

    canvas.dataset.inochi2dExpressionParameters =
      String(expressionLayer.values.size);
  };

  /*
   * -------------------------------------------------------
   * Parameter write
   * -------------------------------------------------------
   */

  const writeParameter = (
    parameterId,
    value,
    sourceName,
  ) => {
    if (!runtime) {
      return;
    }

    if (!parameterById.has(parameterId)) {
      return;
    }

    const parameter = parameterById.get(parameterId);

    markParameterSource(
      parameterId,
      sourceName,
    );

    if (parameter?.isVec2 || Array.isArray(value)) {
      const vector = Array.isArray(value)
        ? value
        : [
            normalizeValue(value, 0),
            parameter?.defaultValue?.[1] ?? 0,
          ];

      setParameterVectorValue(
        parameterId,
        vector[0],
        vector[1],
      );

      return;
    }

    setParameterValue(
      parameterId,
      normalizeValue(value, 0),
    );
  };

  /*
   * -------------------------------------------------------
   * Expression layer
   * -------------------------------------------------------
   */

  const setExpressionLayerValue = (
    name,
    values,
    options = {},
  ) => {
    const normalizedValues =
      normalizeParameterValues(values);

    const nextName =
      typeof name === 'string' &&
      name.trim().length > 0
        ? name.trim()
        : null;

    expressionLayer = {
      name: nextName,
      active:
        options.active === false
          ? false
          : normalizedValues.size > 0,
      values: normalizedValues,
    };

    if (runtime) {
      const sourceName =
        nextName
          ? `expression:${nextName}`
          : 'expression';

      for (const [
        parameterId,
        value,
      ] of normalizedValues.entries()) {
        writeParameter(
          parameterId,
          value,
          sourceName,
        );
      }
    }

    updateCanvasDebug();
    ensureLoop();
  };

  /*
   * -------------------------------------------------------
   * Clear expression
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
      active: false,
      values: new Map(),
    };

    updateCanvasDebug();
    ensureLoop();
  };

  /*
   * -------------------------------------------------------
   * Apply expression layer
   *
   * 毎フレーム、本体側から呼び出す。
   * -------------------------------------------------------
   */

  const applyExpressionLayer = () => {
    if (
      !runtime ||
      !expressionLayer.active ||
      expressionLayer.values.size === 0
    ) {
      return;
    }

    const sourceName =
      expressionLayer.name
        ? `expression:${expressionLayer.name}`
        : 'expression';

    for (const [
      parameterId,
      value,
    ] of expressionLayer.values.entries()) {
      writeParameter(
        parameterId,
        value,
        sourceName,
      );
    }

    updateCanvasDebug();
  };

  /*
   * -------------------------------------------------------
   * Presets
   * -------------------------------------------------------
   */

  const configureExpressionPresets = (
    presets = {},
  ) => {
    expressionPresets = new Map();

    if (
      !presets ||
      typeof presets !== 'object'
    ) {
      return;
    }

    if (presets instanceof Map) {
      for (const [
        name,
        values,
      ] of presets.entries()) {
        if (
          typeof name !== 'string' ||
          !name.trim()
        ) {
          continue;
        }

        expressionPresets.set(
          name.trim(),
          normalizeParameterValues(values),
        );
      }

      return;
    }

    for (const [
      name,
      values,
    ] of Object.entries(presets)) {
      if (
        typeof name !== 'string' ||
        !name.trim()
      ) {
        continue;
      }

      expressionPresets.set(
        name.trim(),
        normalizeParameterValues(values),
      );
    }
  };

  const setExpressionPresetValue = (
    name,
    options = {},
  ) => {
    if (
      typeof name !== 'string' ||
      !name.trim()
    ) {
      return false;
    }

    const presetName = name.trim();
    const values =
      expressionPresets.get(presetName);

    if (!values) {
      return false;
    }

    setExpressionLayerValue(
      presetName,
      values,
      options,
    );

    return true;
  };

  const listExpressionPresetNames = () =>
    [...expressionPresets.keys()];

  /*
   * -------------------------------------------------------
   * State
   * -------------------------------------------------------
   */

  const getState = () => ({
    name: expressionLayer.name,
    active: expressionLayer.active,
    values: Object.fromEntries(
      [...expressionLayer.values.entries()].map(
        ([parameterId, value]) => [
          parameterId,
          Array.isArray(value)
            ? [...value]
            : value,
        ],
      ),
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
      active: false,
      values: new Map(),
    };

    updateCanvasDebug();
  };

  /*
   * -------------------------------------------------------
   * Public API
   * -------------------------------------------------------
   */

  return {
    setValue:
      setExpressionLayerValue,

    apply:
      applyExpressionLayer,

    clear:
      clearExpressionLayerValue,

    configurePresets:
      configureExpressionPresets,

    setPreset:
      setExpressionPresetValue,

    getPresetNames:
      listExpressionPresetNames,

    getState,

    reset,
  };
}

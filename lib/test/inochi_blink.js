/* =========================================================
   Inochi2D Blink Layer
   ====================
   まばたき処理だけを担当するモジュール
   ========================================================= */

export function createInochiBlink({
  runtime,
  canvas,
  parameterById,
  parameterValues,
  setScalarParameterValue,
  markParameterSource,
  ensureLoop,
  clamp01,
  resolveBlinkValue,
  performance,
  constants = {},
}) {
  const {
    AUTO_BLINK_PARAMETER_IDS = [
      'Eye:: Left:: Blink',
      'Eye:: Right:: Blink',
      'Blink',
    ],

    BLINK_LAYER_MANUAL_DURATION_MS = 500,
  } = constants;

  /*
   * ---------------------------------------------------------
   * 内部状態
   * ---------------------------------------------------------
   */

  let blinkLayer = {
    mode: 'auto',

    valueLeft: 0,
    valueRight: 0,

    manualUntilMs: 0,

    activeParameterIds: [],
  };

  /*
   * ---------------------------------------------------------
   * Parameter
   * ---------------------------------------------------------
   */

  const getBlinkParameterIds = () => {
    return AUTO_BLINK_PARAMETER_IDS.filter((parameterId) =>
      parameterById.has(parameterId),
    );
  };

  /*
   * ---------------------------------------------------------
   * 書き込み可能判定
   * ---------------------------------------------------------
   *
   * 元コードでは
   *
   *   !parameterValues.has(parameterId)
   *
   * になっていた。
   *
   * base parameter が明示的に設定されている場合は
   * blink layer から上書きしない。
   */

  const isBlinkParameterWritable = (parameterId) =>
    !parameterValues.has(parameterId);

  /*
   * ---------------------------------------------------------
   * 左右の値を Parameter に振り分ける
   * ---------------------------------------------------------
   */

  const setBlinkParameterValue = (
    parameterId,
    valueLeft,
    valueRight,
  ) => {
    const normalizedParameterId =
      String(parameterId).toLowerCase();

    const isRight =
      normalizedParameterId.includes('right') &&
      !normalizedParameterId.includes('left');

    const nextValue = isRight
      ? valueRight
      : valueLeft;

    setScalarParameterValue(
      parameterId,
      clamp01(nextValue),
    );
  };

  /*
   * ---------------------------------------------------------
   * 手動まばたき
   * ---------------------------------------------------------
   *
   * 外部から
   *
   *   setEyeBlinkValue(1, 1)
   *
   * のように呼ぶ。
   *
   * durationMs が切れたら自動まばたきへ戻る。
   */

  const setEyeBlinkLayerValue = (
    leftValue,
    rightValue,
    options = {},
  ) => {
    const now =
      typeof performance !== 'undefined'
        ? performance.now()
        : Date.now();

    const durationMs =
      Number.isFinite(options.durationMs)
        ? Math.max(0, options.durationMs)
        : BLINK_LAYER_MANUAL_DURATION_MS;

    blinkLayer = {
      ...blinkLayer,

      mode: 'manual',

      valueLeft: clamp01(leftValue),
      valueRight: clamp01(rightValue),

      manualUntilMs: now + durationMs,
    };

    ensureLoop();
  };

  /*
   * ---------------------------------------------------------
   * 毎フレームのまばたき処理
   * ---------------------------------------------------------
   */

  const applyBlinkLayer = (timestamp) => {
    if (!runtime) {
      return;
    }

    const blinkParameterIds =
      getBlinkParameterIds().filter(
        isBlinkParameterWritable,
      );

    /*
     * モデル側にまばたき Parameter が存在しない
     */

    if (blinkParameterIds.length === 0) {
      blinkLayer = {
        ...blinkLayer,
        activeParameterIds: [],
      };

      return;
    }

    /*
     * 手動まばたき中か？
     */

    const useManual =
      blinkLayer.mode === 'manual' &&
      timestamp <= blinkLayer.manualUntilMs;

    /*
     * 手動終了後は自動まばたき
     */

    const nextLeft = useManual
      ? blinkLayer.valueLeft
      : resolveBlinkValue(timestamp);

    const nextRight = useManual
      ? blinkLayer.valueRight
      : resolveBlinkValue(timestamp);

    /*
     * Parameter に反映
     */

    for (const parameterId of blinkParameterIds) {
      markParameterSource(
        parameterId,
        `blink:${useManual ? 'manual' : 'auto'}`,
      );

      setBlinkParameterValue(
        parameterId,
        nextLeft,
        nextRight,
      );
    }

    /*
     * 状態更新
     */

    blinkLayer = {
      ...blinkLayer,

      mode: useManual
        ? 'manual'
        : 'auto',

      valueLeft: nextLeft,
      valueRight: nextRight,

      activeParameterIds:
        blinkParameterIds,
    };

    /*
     * Debug
     */

    if (canvas) {
      canvas.dataset.inochi2dBlinkLayer =
        `${blinkLayer.mode}:${nextLeft.toFixed(3)},${nextRight.toFixed(3)}`;
    }
  };

  /*
   * ---------------------------------------------------------
   * 状態取得
   * ---------------------------------------------------------
   */

  const getBlinkLayerState = () => ({
    ...blinkLayer,

    activeParameterIds: [
      ...blinkLayer.activeParameterIds,
    ],
  });

  /*
   * ---------------------------------------------------------
   * リセット
   * ---------------------------------------------------------
   */

  const resetBlinkLayer = () => {
    blinkLayer = {
      mode: 'auto',

      valueLeft: 0,
      valueRight: 0,

      manualUntilMs: 0,

      activeParameterIds: [],
    };

    if (canvas) {
      delete canvas.dataset.inochi2dBlinkLayer;
    }
  };

  /*
   * ---------------------------------------------------------
   * Parameter ID の確認
   * ---------------------------------------------------------
   */

  const hasBlinkParameters = () =>
    getBlinkParameterIds().length > 0;

  /*
   * ---------------------------------------------------------
   * Public API
   * ---------------------------------------------------------
   */

  return {
    getBlinkParameterIds,

    isBlinkParameterWritable,

    setBlinkParameterValue,

    setEyeBlinkLayerValue,

    applyBlinkLayer,

    getBlinkLayerState,

    resetBlinkLayer,

    hasBlinkParameters,
  };
}

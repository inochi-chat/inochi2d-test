/* =========================================================
   Inochi2D Secondary Motion Module
   ---------------------------------------------------------
   二次モーション関連だけを担当。

   担当:
   - secondary motion engine の生成
   - リセット
   - step
   - interaction impulse
   - speech / lip-sync impulse
   - animation driver
   - motion state の取得
   - node offset の補助

   本体側から後で完全に切り離しやすい構成。
   ========================================================= */

const DEFAULT_SPEECH_MOTION_MIN_DELTA = 0.008;
const DEFAULT_SPEECH_MOTION_IMPULSE_X = 5.2;
const DEFAULT_SPEECH_MOTION_IMPULSE_Y = 2.8;
const DEFAULT_SPEECH_MOTION_RELEASE_RATE = 0.18;

/**
 * Inochi2D Secondary Motion Controller
 */
export function createSecondaryMotionController({
  createSecondaryMotionEngine,
  runtime = null,
  canvas = null,

  engineOptions = {},

  speechMotionMinDelta =
    DEFAULT_SPEECH_MOTION_MIN_DELTA,

  speechMotionImpulseX =
    DEFAULT_SPEECH_MOTION_IMPULSE_X,

  speechMotionImpulseY =
    DEFAULT_SPEECH_MOTION_IMPULSE_Y,

  speechMotionReleaseRate =
    DEFAULT_SPEECH_MOTION_RELEASE_RATE,

  ensureLoop = () => {},
}) {
  /*
   * -------------------------------------------------------
   * Engine
   * -------------------------------------------------------
   */

  let secondaryMotion = null;

  /*
   * animation driver
   *
   * animation 側から secondary motion に渡す
   * 一時的な入力値。
   */

  let secondaryMotionDriver = null;

  let secondaryMotionDriverTimestamp = 0;

  /*
   * speech / lip-sync driver
   */

  let speechSecondaryMotionDriver = {
    open: 0,
    impulseX: 0,
    impulseY: 0,
    active: false,
  };

  /*
   * -------------------------------------------------------
   * Utility
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

  const safeNumber = (
    value,
    fallback = 0,
  ) =>
    Number.isFinite(value)
      ? value
      : fallback;

  const now = () =>
    typeof performance !== 'undefined'
      ? performance.now()
      : Date.now();

  /*
   * -------------------------------------------------------
   * Engine creation
   * -------------------------------------------------------
   */

  const createEngine = () => {
    if (
      typeof createSecondaryMotionEngine !==
      'function'
    ) {
      console.warn(
        '[Inochi2D secondary motion] engine factory is unavailable',
      );

      return null;
    }

    try {
      return createSecondaryMotionEngine(
        engineOptions,
      );
    } catch (error) {
      console.error(
        '[Inochi2D secondary motion] failed to create engine',
        error,
      );

      return null;
    }
  };

  const ensureEngine = () => {
    if (secondaryMotion) {
      return secondaryMotion;
    }

    secondaryMotion = createEngine();

    return secondaryMotion;
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

    canvas.dataset.inochi2dSecondaryMotion =
      secondaryMotion
        ? 'active'
        : 'unavailable';

    if (secondaryMotionDriver) {
      canvas.dataset.inochi2dSecondaryDriver =
        JSON.stringify(
          secondaryMotionDriver,
        );
    }

    canvas.dataset.inochi2dSpeechSecondaryMotion =
      speechSecondaryMotionDriver.active
        ? 'active'
        : 'idle';
  };

  /*
   * -------------------------------------------------------
   * Driver helpers
   * -------------------------------------------------------
   */

  const sampleAnimationMotionDriver = () => {
    if (!secondaryMotion) {
      return null;
    }

    /*
     * secondary motion engine 側に
     * driver の取得 API がある場合は使用。
     */

    if (
      typeof secondaryMotion
        .getDriverState === 'function'
    ) {
      try {
        const state =
          secondaryMotion.getDriverState();

        return state
          ? { ...state }
          : null;
      } catch {
        return null;
      }
    }

    /*
     * 汎用 fallback。
     *
     * animation driver を直接 engine に
     * 持たせない構成でも安全に動く。
     */

    return {
      x: 0,
      y: 0,
      rz: 0,
      active: false,
    };
  };

  const applyAnimationMotionDriver = (
    vectorValues,
    scalarValues,
    nextCameraMotionOffset,
    timestamp,
  ) => {
    if (!secondaryMotion) {
      return;
    }

    /*
     * engine 側が driver を受け取れる場合だけ
     * 渡す。
     */

    if (
      typeof secondaryMotion
        .setAnimationDriver === 'function'
    ) {
      try {
        secondaryMotion.setAnimationDriver({
          vectorValues,
          scalarValues,
          cameraMotionOffset: {
            ...nextCameraMotionOffset,
          },
          timestamp,
        });
      } catch (error) {
        console.warn(
          '[Inochi2D secondary motion] animation driver failed',
          error,
        );
      }
    }

    secondaryMotionDriver =
      sampleAnimationMotionDriver();

    secondaryMotionDriverTimestamp =
      timestamp;
  };

  /*
   * -------------------------------------------------------
   * Speech secondary motion
   * -------------------------------------------------------
   */

  const setSpeechSecondaryMotion = (
    openAmount,
  ) => {
    const open = clamp01(openAmount);

    const previousOpen =
      speechSecondaryMotionDriver.open;

    const delta =
      open - previousOpen;

    const absoluteDelta =
      Math.abs(delta);

    /*
     * 口の変化が小さすぎる場合は
     * 無駄な impulse を発生させない。
     */

    if (
      absoluteDelta <
      speechMotionMinDelta
    ) {
      speechSecondaryMotionDriver = {
        ...speechSecondaryMotionDriver,
        open,
        active:
          open > speechMotionMinDelta,
      };

      return;
    }

    const direction =
      delta >= 0 ? 1 : -1;

    const impulseX =
      direction *
      speechMotionImpulseX *
      absoluteDelta;

    const impulseY =
      speechMotionImpulseY *
      absoluteDelta;

    speechSecondaryMotionDriver = {
      open,
      impulseX,
      impulseY,
      active: true,
    };

    if (
      secondaryMotion &&
      typeof secondaryMotion.inject ===
        'function'
    ) {
      secondaryMotion.inject(
        impulseX,
        impulseY,
      );
    }

    ensureLoop();

    updateCanvasDebug();
  };

  const applySpeechSecondaryMotionDriver = (
    currentOpen = speechSecondaryMotionDriver.open,
  ) => {
    const open = clamp01(currentOpen);

    const previousOpen =
      speechSecondaryMotionDriver.open;

    const delta =
      open - previousOpen;

    if (
      Math.abs(delta) >=
      speechMotionMinDelta
    ) {
      setSpeechSecondaryMotion(open);
      return;
    }

    /*
     * impulse を徐々に減衰。
     */

    const release =
      clamp01(
        speechMotionReleaseRate,
      );

    const nextImpulseX =
      speechSecondaryMotionDriver.impulseX *
      (1 - release);

    const nextImpulseY =
      speechSecondaryMotionDriver.impulseY *
      (1 - release);

    const active =
      Math.abs(nextImpulseX) > 0.0001 ||
      Math.abs(nextImpulseY) > 0.0001;

    speechSecondaryMotionDriver = {
      open,
      impulseX: nextImpulseX,
      impulseY: nextImpulseY,
      active,
    };

    updateCanvasDebug();
  };

  /*
   * -------------------------------------------------------
   * Interaction
   * -------------------------------------------------------
   */

  const injectInteractionImpulse = (
    deltaX,
    deltaY,
  ) => {
    if (!secondaryMotion) {
      return;
    }

    const horizontalDelta =
      safeNumber(deltaX);

    const verticalDelta =
      safeNumber(deltaY);

    /*
     * 元コードと同じく、
     * 大きい方向を主入力として扱う。
     */

    const useHorizontal =
      Math.abs(horizontalDelta) >=
      Math.abs(verticalDelta);

    const finalX =
      useHorizontal
        ? horizontalDelta
        : 0;

    const finalY =
      useHorizontal
        ? verticalDelta
        : 0;

    if (
      typeof secondaryMotion.inject ===
      'function'
    ) {
      secondaryMotion.inject(
        finalX,
        finalY,
      );
    }

    ensureLoop();
    updateCanvasDebug();
  };

  /*
   * -------------------------------------------------------
   * Step
   * -------------------------------------------------------
   */

  const step = (
    deltaTimeSeconds,
  ) => {
    if (!secondaryMotion) {
      return;
    }

    const delta =
      Math.min(
        0.05,
        Math.max(
          0,
          safeNumber(
            deltaTimeSeconds,
            0.01667,
          ),
        ),
      );

    try {
      if (
        typeof secondaryMotion.step ===
        'function'
      ) {
        secondaryMotion.step(delta);
      }
    } catch (error) {
      console.error(
        '[Inochi2D secondary motion] step failed',
        error,
      );
    }

    updateCanvasDebug();
  };

  /*
   * -------------------------------------------------------
   * Runtime state application
   * -------------------------------------------------------
   */

  const applyMotionState = () => {
    if (!secondaryMotion) {
      return;
    }

    /*
     * engine が runtime へ直接書き込む方式。
     */

    if (
      typeof secondaryMotion.apply ===
      'function'
    ) {
      try {
        secondaryMotion.apply(runtime);
      } catch (error) {
        console.error(
          '[Inochi2D secondary motion] apply failed',
          error,
        );
      }
    }

    /*
     * 別名 API に対応。
     */

    if (
      typeof secondaryMotion.applyToRuntime ===
      'function'
    ) {
      try {
        secondaryMotion.applyToRuntime(
          runtime,
        );
      } catch (error) {
        console.error(
          '[Inochi2D secondary motion] applyToRuntime failed',
          error,
        );
      }
    }

    updateCanvasDebug();
  };

  /*
   * -------------------------------------------------------
   * Reset
   * -------------------------------------------------------
   */

  const reset = ({
    kickOnLoad = false,
  } = {}) => {
    ensureEngine();

    if (!secondaryMotion) {
      return;
    }

    try {
      if (
        typeof secondaryMotion.reset ===
        'function'
      ) {
        secondaryMotion.reset({
          kickOnLoad,
        });
      }
    } catch (error) {
      console.error(
        '[Inochi2D secondary motion] reset failed',
        error,
      );
    }

    secondaryMotionDriver =
      sampleAnimationMotionDriver();

    secondaryMotionDriverTimestamp =
      now();

    speechSecondaryMotionDriver = {
      open: 0,
      impulseX: 0,
      impulseY: 0,
      active: false,
    };

    updateCanvasDebug();
  };

  /*
   * -------------------------------------------------------
   * State
   * -------------------------------------------------------
   */

  const getState = (
    name,
  ) => {
    if (!secondaryMotion) {
      return null;
    }

    if (
      typeof secondaryMotion.getState ===
      'function'
    ) {
      try {
        return secondaryMotion.getState(
          name,
        );
      } catch {
        return null;
      }
    }

    return null;
  };

  const getAllStates = () => {
    if (!secondaryMotion) {
      return {};
    }

    if (
      typeof secondaryMotion.getStates ===
      'function'
    ) {
      try {
        return {
          ...secondaryMotion.getStates(),
        };
      } catch {
        return {};
      }
    }

    return {};
  };

  /*
   * -------------------------------------------------------
   * Destroy
   * -------------------------------------------------------
   */

  const destroy = () => {
    try {
      if (
        secondaryMotion &&
        typeof secondaryMotion.destroy ===
          'function'
      ) {
        secondaryMotion.destroy();
      } else if (
        secondaryMotion &&
        typeof secondaryMotion.clear ===
          'function'
      ) {
        secondaryMotion.clear();
      }
    } catch (error) {
      console.warn(
        '[Inochi2D secondary motion] destroy failed',
        error,
      );
    }

    secondaryMotion = null;

    secondaryMotionDriver = null;

    secondaryMotionDriverTimestamp = 0;

    speechSecondaryMotionDriver = {
      open: 0,
      impulseX: 0,
      impulseY: 0,
      active: false,
    };

    updateCanvasDebug();
  };

  /*
   * -------------------------------------------------------
   * Initialization
   * -------------------------------------------------------
   */

  ensureEngine();

  /*
   * -------------------------------------------------------
   * Public API
   * -------------------------------------------------------
   */

  return {
    /*
     * engine
     */
    getEngine() {
      return secondaryMotion;
    },

    ensureEngine,

    /*
     * lifecycle
     */
    reset,
    step,
    applyMotionState,
    destroy,

    /*
     * interaction
     */
    inject: injectInteractionImpulse,
    applyInteractionImpulse:
      injectInteractionImpulse,

    /*
     * animation driver
     */
    sampleAnimationMotionDriver,
    applyAnimationMotionDriver,

    /*
     * speech / lip-sync
     */
    setSpeechSecondaryMotion,
    applySpeechSecondaryMotionDriver,

    /*
     * state
     */
    getState,
    getAllStates,

    getDriverState() {
      return secondaryMotionDriver
        ? {
            ...secondaryMotionDriver,
          }
        : null;
    },

    getDriverTimestamp() {
      return secondaryMotionDriverTimestamp;
    },

    getSpeechState() {
      return {
        ...speechSecondaryMotionDriver,
      };
    },

    /*
     * debug
     */
    updateCanvasDebug,
  };
}

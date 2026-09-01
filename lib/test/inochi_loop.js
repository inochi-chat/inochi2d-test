/* =========================================================
   Inochi2D Loop Module
   ---------------------------------------------------------
   メイン更新ループを担当。
   更新順:
     1. Animation
     2. Interaction
     3. Blink
     4. Gaze
     5. Expression
     6. Lip Sync
     7. Physics
     8. Secondary Motion
     9. Parameter / Node Motion
    10. Render
   注意:
   各モジュールは「存在すれば呼ぶ」方式。
   まだ接続していないモジュールがあっても
   ループ自体が壊れないようにする。
   ========================================================= */
export function createLoopController({
  animation = null,
  interaction = null,
  blink = null,
  gaze = null,
  expression = null,
  lipSync = null,
  physics = null,
  secondaryMotion = null,
  parameter = null,
  nodeMotion = null,
  camera = null,
  render = null,
  debug = null,
  maxDeltaTimeMs = 100,
  targetFps = 60,
  autoStart = false,
  debugEnabled = false,
} = {}) {
  /* -------------------------------------------------------
     State
     ------------------------------------------------------- */
  let running = false;
  let frameRequested = false;
  let rafId = null;
  let frame = 0;
  let lastTimestamp = 0;
  let deltaTimeMs = 0;
  let deltaTimeSeconds = 0;
  let targetFrameDuration =
    1000 / targetFps;
  let destroyed = false;
  /* -------------------------------------------------------
     Statistics
     ------------------------------------------------------- */
  let fps = targetFps;
  let fpsAccumulator = 0;
  let fpsFrames = 0;
  let lastFpsUpdate = 0;
  let totalUpdateTimeMs = 0;
  let lastUpdateDurationMs = 0;
  /* -------------------------------------------------------
     Debug
     ------------------------------------------------------- */
  const debugState = {
    running: false,
    frame: 0,
    deltaTimeMs: 0,
    fps: targetFps,
    lastUpdateDurationMs: 0,
    errors: [],
  };
  const MAX_ERRORS = 20;
  const log = (...args) => {
    if (!debugEnabled) {
      return;
    }
    console.info(
      '[Inochi2D loop]',
      ...args,
    );
  };
  const recordError = (
    moduleName,
    error,
  ) => {
    const entry = {
      module: moduleName,
      message:
        error instanceof Error
          ? error.message
          : String(error),
      timestamp:
        typeof performance !==
        'undefined'
          ? performance.now()
          : Date.now(),
    };
    debugState.errors.push(
      entry,
    );
    if (
      debugState.errors.length >
      MAX_ERRORS
    ) {
      debugState.errors =
        debugState.errors.slice(
          -MAX_ERRORS,
        );
    }
    log(
      `${moduleName} failed`,
      error,
    );
  };
  /* -------------------------------------------------------
     Utility
     ------------------------------------------------------- */
  const now = () =>
    typeof performance !==
    'undefined'
      ? performance.now()
      : Date.now();
  const clamp = (
    value,
    min,
    max,
  ) =>
    Math.min(
      max,
      Math.max(min, value),
    );
  const finiteOr = (
    value,
    fallback,
  ) =>
    Number.isFinite(value)
      ? value
      : fallback;
  /* -------------------------------------------------------
     Safe module call
     ------------------------------------------------------- */
  const callModule = (
    module,
    moduleName,
    methodNames,
    ...args
  ) => {
    if (!module) {
      return undefined;
    }
    for (
      const methodName of methodNames
    ) {
      if (
        typeof module[
          methodName
        ] === 'function'
      ) {
        try {
          return module[
            methodName
          ](...args);
        } catch (error) {
          recordError(
            moduleName,
            error,
          );
          return undefined;
        }
      }
    }
    return undefined;
  };
  /* -------------------------------------------------------
     Timestamp / Delta
     ------------------------------------------------------- */
  const updateDeltaTime = (
    timestamp,
  ) => {
    if (
      lastTimestamp <= 0
    ) {
      deltaTimeMs =
        targetFrameDuration;
    } else {
      deltaTimeMs =
        timestamp -
        lastTimestamp;
    }
    deltaTimeMs = clamp(
      finiteOr(
        deltaTimeMs,
        targetFrameDuration,
      ),
      0,
      maxDeltaTimeMs,
    );
    deltaTimeSeconds =
      deltaTimeMs / 1000;
    lastTimestamp =
      timestamp;
  };
  /* -------------------------------------------------------
     FPS
     ------------------------------------------------------- */
  const updateFps = (
    timestamp,
  ) => {
    fpsAccumulator +=
      deltaTimeMs;
    fpsFrames++;
    if (
      lastFpsUpdate <= 0
    ) {
      lastFpsUpdate =
        timestamp;
      return;
    }
    const elapsed =
      timestamp -
      lastFpsUpdate;
    if (
      elapsed < 500
    ) {
      return;
    }
    if (
      elapsed > 0
    ) {
      fps =
        (fpsFrames * 1000) /
        elapsed;
    }
    fpsAccumulator = 0;
    fpsFrames = 0;
    lastFpsUpdate =
      timestamp;
  };
  /* -------------------------------------------------------
     Animation
     ------------------------------------------------------- */
  const updateAnimation = (
    timestamp,
  ) => {
    return callModule(
      animation,
      'animation',
      [
        'update',
        'tick',
        'apply',
      ],
      deltaTimeMs,
      timestamp,
    );
  };
  /* -------------------------------------------------------
     Interaction
     ------------------------------------------------------- */
  const updateInteraction = (
    timestamp,
  ) => {
    return callModule(
      interaction,
      'interaction',
      [
        'update',
        'tick',
      ],
      deltaTimeMs,
      timestamp,
    );
  };
  /* -------------------------------------------------------
     Blink
     ------------------------------------------------------- */
  const updateBlink = (
    timestamp,
  ) => {
    return callModule(
      blink,
      'blink',
      [
        'update',
        'apply',
        'tick',
      ],
      deltaTimeMs,
      timestamp,
    );
  };
  /* -------------------------------------------------------
     Gaze
     ------------------------------------------------------- */
  const updateGaze = (
    timestamp,
  ) => {
    return callModule(
      gaze,
      'gaze',
      [
        'update',
        'apply',
        'tick',
      ],
      deltaTimeMs,
      timestamp,
    );
  };
  /* -------------------------------------------------------
     Expression
     ------------------------------------------------------- */
  const updateExpression = (
    timestamp,
  ) => {
    return callModule(
      expression,
      'expression',
      [
        'update',
        'apply',
        'tick',
      ],
      deltaTimeMs,
      timestamp,
    );
  };
  /* -------------------------------------------------------
     Lip Sync
     ------------------------------------------------------- */
  const updateLipSync = (
    timestamp,
  ) => {
    return callModule(
      lipSync,
      'lipSync',
      [
        'apply',
        'update',
        'tick',
      ],
      deltaTimeMs,
      timestamp,
    );
  };
  /* -------------------------------------------------------
     Physics
     ------------------------------------------------------- */
  const updatePhysics = (
    timestamp,
  ) => {
    return callModule(
      physics,
      'physics',
      [
        'update',
        'step',
        'tick',
      ],
      timestamp,
    );
  };
  /* -------------------------------------------------------
     Secondary Motion
     ------------------------------------------------------- */
  const updateSecondaryMotion = (
    timestamp,
  ) => {
    return callModule(
      secondaryMotion,
      'secondaryMotion',
      [
        'update',
        'apply',
        'tick',
      ],
      deltaTimeMs,
      timestamp,
    );
  };
  /* -------------------------------------------------------
     Parameter
     ------------------------------------------------------- */
  const updateParameter = (
    timestamp,
  ) => {
    return callModule(
      parameter,
      'parameter',
      [
        'update',
        'apply',
        'tick',
      ],
      deltaTimeMs,
      timestamp,
    );
  };
  /* -------------------------------------------------------
     Node Motion
     ------------------------------------------------------- */
  const updateNodeMotion = (
    timestamp,
  ) => {
    return callModule(
      nodeMotion,
      'nodeMotion',
      [
        'update',
        'apply',
        'tick',
      ],
      deltaTimeMs,
      timestamp,
    );
  };
  /* -------------------------------------------------------
     Camera
     ------------------------------------------------------- */
  const updateCamera = (
    timestamp,
  ) => {
    return callModule(
      camera,
      'camera',
      [
        'update',
        'apply',
        'tick',
      ],
      deltaTimeMs,
      timestamp,
    );
  };
  /* -------------------------------------------------------
     Render
     ------------------------------------------------------- */
  const updateRender = (
    timestamp,
  ) => {
    return callModule(
      render,
      'render',
      [
        'render',
        'draw',
        'update',
      ],
      timestamp,
    );
  };
  /* -------------------------------------------------------
     Debug
     ------------------------------------------------------- */
  const updateDebug = (
    timestamp,
  ) => {
    return callModule(
      debug,
      'debug',
      [
        'update',
        'tick',
      ],
      {
        timestamp,
        frame,
        deltaTimeMs,
        deltaTimeSeconds,
        fps,
        lastUpdateDurationMs,
      },
    );
  };
  /* -------------------------------------------------------
     One Frame
     ------------------------------------------------------- */
  const update = (
    timestamp = now(),
  ) => {
    if (destroyed) {
      return false;
    }
    const start =
      now();
    updateDeltaTime(
      timestamp,
    );
    updateFps(
      timestamp,
    );
    frame++;
    /*
     * -----------------------------------------------------
     * 更新順
     * -----------------------------------------------------
     *
     * Animation
     *     ↓
     * Interaction
     *     ↓
     * Blink / Gaze / Expression
     *     ↓
     * Lip Sync
     *     ↓
     * Physics
     *     ↓
     * Secondary Motion
     *     ↓
     * Parameter
     *     ↓
     * Node Motion
     *     ↓
     * Camera
     *     ↓
     * Render
     */
    updateAnimation(
      timestamp,
    );
    updateInteraction(
      timestamp,
    );
    updateBlink(
      timestamp,
    );
    updateGaze(
      timestamp,
    );
    updateExpression(
      timestamp,
    );
    updateLipSync(
      timestamp,
    );
    updatePhysics(
      timestamp,
    );
    updateSecondaryMotion(
      timestamp,
    );
    updateParameter(
      timestamp,
    );
    updateNodeMotion(
      timestamp,
    );
    updateCamera(
      timestamp,
    );
    updateRender(
      timestamp,
    );
    const end =
      now();
    lastUpdateDurationMs =
      Math.max(
        0,
        end - start,
      );
    totalUpdateTimeMs +=
      lastUpdateDurationMs;
    debugState.running =
      running;
    debugState.frame =
      frame;
    debugState.deltaTimeMs =
      deltaTimeMs;
    debugState.fps =
      fps;
    debugState.lastUpdateDurationMs =
      lastUpdateDurationMs;
    updateDebug(
      timestamp,
    );
    return true;
  };
  /* -------------------------------------------------------
     Animation Frame Callback
     ------------------------------------------------------- */
  const frameCallback = (
    timestamp,
  ) => {
    frameRequested = false;
    if (
      !running ||
      destroyed
    ) {
      return;
    }
    update(
      timestamp,
    );
    requestNextFrame();
  };
  /* -------------------------------------------------------
     Request Frame
     ------------------------------------------------------- */
  const requestNextFrame = () => {
    if (
      !running ||
      destroyed ||
      frameRequested
    ) {
      return false;
    }
    if (
      typeof requestAnimationFrame ===
      'function'
    ) {
      frameRequested = true;
      rafId =
        requestAnimationFrame(
          frameCallback,
        );
      return true;
    }
    /*
     * requestAnimationFrame が存在しない
     * 環境用 fallback。
     */
    frameRequested = true;
    rafId =
      setTimeout(
        () => {
          frameCallback(
            now(),
          );
        },
        targetFrameDuration,
      );
    return true;
  };
  /* -------------------------------------------------------
     Start
     ------------------------------------------------------- */
  const start = () => {
    if (destroyed) {
      return false;
    }
    if (running) {
      return true;
    }
    running = true;
    frameRequested = false;
    lastTimestamp = 0;
    lastFpsUpdate = 0;
    fpsFrames = 0;
    fpsAccumulator = 0;
    debugState.running =
      true;
    requestNextFrame();
    log('started');
    return true;
  };
  /* -------------------------------------------------------
     Stop
     ------------------------------------------------------- */
  const stop = () => {
    running = false;
    debugState.running =
      false;
    if (
      frameRequested &&
      rafId !== null
    ) {
      if (
        typeof cancelAnimationFrame ===
        'function'
      ) {
        try {
          cancelAnimationFrame(
            rafId,
          );
        } catch {
          /* ignore */
        }
      } else {
        clearTimeout(
          rafId,
        );
      }
    }
    rafId = null;
    frameRequested = false;
    log('stopped');
    return true;
  };
  /* -------------------------------------------------------
     Restart
     ------------------------------------------------------- */
  const restart = () => {
    stop();
    return start();
  };
  /* -------------------------------------------------------
     Ensure Loop
     ------------------------------------------------------- */
  const ensureLoop = () => {
    if (
      destroyed
    ) {
      return false;
    }
    if (!running) {
      return start();
    }
    if (!frameRequested) {
      return requestNextFrame();
    }
    return true;
  };
  /* -------------------------------------------------------
     Target FPS
     ------------------------------------------------------- */
  const setTargetFps = (
    value,
  ) => {
    const next =
      finiteOr(
        value,
        60,
      );
    targetFps =
      clamp(
        next,
        1,
        240,
      );
    targetFrameDuration =
      1000 /
      targetFps;
    return targetFps;
  };
  /* -------------------------------------------------------
     State
     ------------------------------------------------------- */
  const getState = () => ({
    running,
    frameRequested,
    frame,
    lastTimestamp,
    deltaTimeMs,
    deltaTimeSeconds,
    fps,
    targetFps,
    targetFrameDuration,
    lastUpdateDurationMs,
    totalUpdateTimeMs,
    destroyed,
    debug: {
      ...debugState,
      errors: [
        ...debugState.errors,
      ],
    },
  });
  /* -------------------------------------------------------
     Reset
     ------------------------------------------------------- */
  const reset = ({
    stopLoop = true,
  } = {}) => {
    if (stopLoop) {
      stop();
    }
    frame = 0;
    lastTimestamp = 0;
    deltaTimeMs = 0;
    deltaTimeSeconds = 0;
    fps = targetFps;
    fpsAccumulator = 0;
    fpsFrames = 0;
    lastFpsUpdate = 0;
    totalUpdateTimeMs = 0;
    lastUpdateDurationMs = 0;
    debugState.frame = 0;
    debugState.deltaTimeMs = 0;
    debugState.fps =
      targetFps;
    debugState.lastUpdateDurationMs =
      0;
    debugState.errors = [];
  };
  /* -------------------------------------------------------
     Destroy
     ------------------------------------------------------- */
  const destroy = () => {
    stop();
    destroyed = true;
    /*
     * モジュール自体は破棄しない。
     * bridge 側で必要なら再生成できる。
     */
  };
  /* -------------------------------------------------------
     Auto Start
     ------------------------------------------------------- */
  if (autoStart) {
    start();
  }
  /* -------------------------------------------------------
     Public API
     ------------------------------------------------------- */
  return {
    start,
    stop,
    restart,
    ensureLoop,
    update,
    requestNextFrame,
    setTargetFps,
    getState,
    reset,
    destroy,
    isRunning: () =>
      running,
    getFrame: () =>
      frame,
    getDeltaTimeMs: () =>
      deltaTimeMs,
    getDeltaTimeSeconds: () =>
      deltaTimeSeconds,
    getFps: () =>
      fps,
  };
}
export default {
  createLoopController,
};

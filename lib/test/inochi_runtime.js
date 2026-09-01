/* =========================================================
   Inochi2D Runtime Module
   ---------------------------------------------------------
   WASM / Inochi2D Runtime の管理だけを担当。
   担当:
   - Runtime 作成
   - mount / unmount
   - resize
   - animation loop の開始 / 停止
   - runtime.tick()
   - runtime.clear()
   - runtime 状態管理
   非担当:
   - パラメータ
   - 口パク
   - 瞬き
   - 視線
   - 表情
   - アニメーション内容
   - secondary motion
   - カメラ
   ========================================================= */
export function createRuntimeController({
  RuntimeClass,
  canvas = null,
  width = 1,
  height = 1,
  devicePixelRatio = 1,
  debugEnabled = false,
  minTickIntervalMs = 0,
  onTick = null,
  onBeforeTick = null,
  onAfterTick = null,
  onResize = null,
  onMounted = null,
  onUnmounted = null,
}) {
  let runtime = null;
  let mounted = false;
  let currentCanvas = canvas;
  let currentWidth = Math.max(1, width);
  let currentHeight = Math.max(1, height);
  let currentDevicePixelRatio = Math.max(
    1,
    devicePixelRatio || 1,
  );
  let rafId = 0;
  let lastTickTimestamp = null;
  let tickCount = 0;
  let lastTickError = null;
  const log = (...args) => {
    if (debugEnabled) {
      console.info('[Inochi2D runtime]', ...args);
    }
  };
  const getNow = () =>
    typeof performance !== 'undefined'
      ? performance.now()
      : Date.now();
  /*
   * -------------------------------------------------------
   * requestAnimationFrame fallback
   * -------------------------------------------------------
   */
  const requestFrame = (callback) => {
    if (typeof requestAnimationFrame === 'function') {
      return requestAnimationFrame(callback);
    }
    return setTimeout(
      () => callback(getNow()),
      16,
    );
  };
  const cancelFrame = (id) => {
    if (!id) {
      return;
    }
    if (typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(id);
      return;
    }
    clearTimeout(id);
  };
  /*
   * -------------------------------------------------------
   * loop
   * -------------------------------------------------------
   */
  const stopLoop = () => {
    if (rafId) {
      cancelFrame(rafId);
      rafId = 0;
    }
    lastTickTimestamp = null;
  };
  const tick = (timestamp) => {
    rafId = 0;
    if (!mounted || !runtime) {
      return;
    }
    if (
      typeof lastTickTimestamp === 'number' &&
      minTickIntervalMs > 0 &&
      timestamp - lastTickTimestamp <
        minTickIntervalMs
    ) {
      rafId = requestFrame(tick);
      return;
    }
    const deltaTimeMs =
      typeof lastTickTimestamp === 'number'
        ? Math.max(
            0,
            timestamp - lastTickTimestamp,
          )
        : 16.67;
    lastTickTimestamp = timestamp;
    try {
      if (typeof onBeforeTick === 'function') {
        onBeforeTick({
          timestamp,
          deltaTimeMs,
          deltaTimeSeconds: Math.min(
            0.05,
            deltaTimeMs / 1000,
          ),
          runtime,
        });
      }
      /*
       * runtime 自体の tick。
       *
       * 実際のパラメータ適用などは onTick 側で
       * 本体から呼び出せる。
       */
      if (typeof onTick === 'function') {
        onTick({
          timestamp,
          deltaTimeMs,
          deltaTimeSeconds: Math.min(
            0.05,
            deltaTimeMs / 1000,
          ),
          runtime,
        });
      }
      if (runtime) {
        runtime.tick(timestamp);
      }
      tickCount += 1;
      lastTickError = null;
      if (typeof onAfterTick === 'function') {
        onAfterTick({
          timestamp,
          deltaTimeMs,
          deltaTimeSeconds: Math.min(
            0.05,
            deltaTimeMs / 1000,
          ),
          runtime,
        });
      }
    } catch (error) {
      lastTickError =
        error instanceof Error
          ? error.message
          : String(error);
      console.error(
        '[Inochi2D runtime] tick failed',
        error,
      );
    } finally {
      if (mounted && runtime) {
        rafId = requestFrame(tick);
      }
    }
  };
  const ensureLoop = () => {
    if (!mounted || !runtime || rafId) {
      return;
    }
    rafId = requestFrame(tick);
  };
  /*
   * -------------------------------------------------------
   * Runtime 作成
   * -------------------------------------------------------
   */
  const createRuntime = (nextCanvas) => {
    if (!RuntimeClass) {
      throw new Error(
        'Inochi2dRuntime class was not provided.',
      );
    }
    if (!nextCanvas) {
      throw new Error(
        'A canvas is required to create the Inochi2D runtime.',
      );
    }
    runtime = new RuntimeClass(nextCanvas);
    log('runtime created');
    return runtime;
  };
  /*
   * -------------------------------------------------------
   * mount
   * -------------------------------------------------------
   */
  const mount = async (nextCanvas = currentCanvas) => {
    if (mounted && runtime) {
      return runtime;
    }
    if (!nextCanvas) {
      throw new Error(
        'Cannot mount Inochi2D runtime without a canvas.',
      );
    }
    currentCanvas = nextCanvas;
    createRuntime(currentCanvas);
    mounted = true;
    lastTickTimestamp = null;
    tickCount = 0;
    lastTickError = null;
    applyResize();
    if (typeof onMounted === 'function') {
      await onMounted({
        runtime,
        canvas: currentCanvas,
        width: currentWidth,
        height: currentHeight,
        devicePixelRatio:
          currentDevicePixelRatio,
      });
    }
    ensureLoop();
    log('runtime mounted');
    return runtime;
  };
  /*
   * -------------------------------------------------------
   * unmount
   * -------------------------------------------------------
   */
  const unmount = async () => {
    if (!mounted && !runtime) {
      return;
    }
    mounted = false;
    stopLoop();
    if (typeof onUnmounted === 'function') {
      await onUnmounted({
        runtime,
        canvas: currentCanvas,
      });
    }
    try {
      if (
        runtime &&
        typeof runtime.clear === 'function'
      ) {
        runtime.clear();
      }
    } catch (error) {
      console.error(
        '[Inochi2D runtime] clear failed',
        error,
      );
    }
    runtime = null;
    lastTickTimestamp = null;
    lastTickError = null;
    log('runtime unmounted');
  };
  /*
   * -------------------------------------------------------
   * resize
   * -------------------------------------------------------
   */
  const applyResize = () => {
    if (!runtime) {
      return;
    }
    if (
      typeof runtime.resize === 'function'
    ) {
      runtime.resize(
        currentWidth,
        currentHeight,
        currentDevicePixelRatio,
      );
    }
    if (typeof onResize === 'function') {
      onResize({
        runtime,
        canvas: currentCanvas,
        width: currentWidth,
        height: currentHeight,
        devicePixelRatio:
          currentDevicePixelRatio,
      });
    }
  };
  const resize = async (
    nextWidth,
    nextHeight,
    nextDevicePixelRatio,
  ) => {
    currentWidth = Math.max(
      1,
      Number.isFinite(nextWidth)
        ? nextWidth
        : currentWidth,
    );
    currentHeight = Math.max(
      1,
      Number.isFinite(nextHeight)
        ? nextHeight
        : currentHeight,
    );
    currentDevicePixelRatio = Math.max(
      1,
      Number.isFinite(nextDevicePixelRatio)
        ? nextDevicePixelRatio
        : currentDevicePixelRatio,
    );
    if (currentCanvas) {
      currentCanvas.style.width =
        `${currentWidth}px`;
      currentCanvas.style.height =
        `${currentHeight}px`;
      currentCanvas.dataset.inochi2dDevicePixelRatio =
        currentDevicePixelRatio.toFixed(3);
    }
    applyResize();
    ensureLoop();
  };
  /*
   * -------------------------------------------------------
   * Runtime model 操作
   * -------------------------------------------------------
   */
  const loadModel = (modelBytes) => {
    if (!runtime) {
      throw new Error(
        'Inochi2D runtime is not mounted.',
      );
    }
    if (
      typeof runtime.load_model !== 'function'
    ) {
      throw new Error(
        'Inochi2D runtime does not provide load_model().',
      );
    }
    runtime.load_model(modelBytes);
    ensureLoop();
  };
  const clear = () => {
    if (
      runtime &&
      typeof runtime.clear === 'function'
    ) {
      runtime.clear();
    }
  };
  /*
   * -------------------------------------------------------
   * Runtime camera
   *
   * 実際のカメラ状態管理は inochi_camera.js に任せる。
   * ここでは Runtime API を直接呼べる薄い wrapper だけ。
   * -------------------------------------------------------
   */
  const setCameraTransform = (
    x,
    y,
    scale,
  ) => {
    if (!runtime) {
      return;
    }
    if (
      typeof runtime.set_camera_transform !==
      'function'
    ) {
      return;
    }
    runtime.set_camera_transform(
      Number.isFinite(x) ? x : 0,
      Number.isFinite(y) ? y : 0,
      Number.isFinite(scale) ? scale : 1,
    );
    ensureLoop();
  };
  /*
   * -------------------------------------------------------
   * Frame snapshot
   * -------------------------------------------------------
   */
  const getFrameSnapshot = () => {
    if (
      !runtime ||
      typeof runtime.get_frame_snapshot_summary !==
        'function'
    ) {
      return null;
    }
    return runtime.get_frame_snapshot_summary();
  };
  /*
   * -------------------------------------------------------
   * 状態取得
   * -------------------------------------------------------
   */
  const getState = () => ({
    mounted,
    hasRuntime: Boolean(runtime),
    canvas: currentCanvas,
    width: currentWidth,
    height: currentHeight,
    devicePixelRatio:
      currentDevicePixelRatio,
    loopRunning: Boolean(rafId),
    rafId,
    tickCount,
    lastTickTimestamp,
    lastTickError,
    frameSnapshot:
      getFrameSnapshot(),
  });
  return {
    mount,
    unmount,
    resize,
    applyResize,
    ensureLoop,
    stopLoop,
    loadModel,
    clear,
    setCameraTransform,
    getFrameSnapshot,
    getState,
    getRuntime: () => runtime,
    getCanvas: () => currentCanvas,
    isMounted: () => mounted,
    isRunning: () => Boolean(rafId),
  };
}

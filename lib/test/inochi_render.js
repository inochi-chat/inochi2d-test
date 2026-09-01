/* =========================================================
   Inochi2D Render Module
   ---------------------------------------------------------
   Inochi2D の描画処理だけを担当。
   担当:
   - Canvas 管理
   - WebGL / WebGL2 context
   - Viewport
   - Clear
   - Runtime render 呼び出し
   - Resize
   - Device Pixel Ratio
   - Render state
   非担当:
   - Model loading
   - Runtime initialization
   - Parameter calculation
   - Animation
   - Lip Sync
   - Blink
   - Gaze
   - Expression
   - Physics
   - Interaction
   ========================================================= */
export function createRenderController({
  canvas = null,
  runtime = null,
  debugEnabled = false,
} = {}) {
  let gl = null;
  let contextType = null;
  let initialized = false;
  let width = 0;
  let height = 0;
  let devicePixelRatio = 1;
  let autoResize = true;
  let clearBeforeRender = true;
  let clearColor = [
    0,
    0,
    0,
    0,
  ];
  let lastRenderTimestamp = 0;
  let renderCount = 0;
  let lastRenderDurationMs = 0;
  let viewportWidth = 0;
  let viewportHeight = 0;
  let resizeObserver = null;
  const debugState = {
    initialized: false,
    contextType: null,
    renderCount: 0,
    width: 0,
    height: 0,
    pixelRatio: 1,
    lastRenderDurationMs: 0,
    lastError: null,
  };
  const log = (...args) => {
    if (!debugEnabled) {
      return;
    }
    console.info(
      '[Inochi2D render]',
      ...args,
    );
  };
  /* -------------------------------------------------------
     Utility
     ------------------------------------------------------- */
  const finiteOr = (
    value,
    fallback,
  ) =>
    Number.isFinite(value)
      ? value
      : fallback;
  const clamp = (
    value,
    min,
    max,
  ) =>
    Math.min(
      max,
      Math.max(min, value),
    );
  const getPixelRatio = () => {
    if (
      typeof window ===
      'undefined'
    ) {
      return 1;
    }
    return clamp(
      finiteOr(
        window.devicePixelRatio,
        1,
      ),
      1,
      4,
    );
  };
  const getCanvasSize = () => {
    if (!canvas) {
      return {
        width: 0,
        height: 0,
      };
    }
    const rect =
      typeof canvas.getBoundingClientRect ===
      'function'
        ? canvas.getBoundingClientRect()
        : null;
    const cssWidth =
      finiteOr(
        rect?.width,
        canvas.clientWidth ||
          canvas.width ||
          0,
      );
    const cssHeight =
      finiteOr(
        rect?.height,
        canvas.clientHeight ||
          canvas.height ||
          0,
      );
    return {
      width: Math.max(
        1,
        cssWidth,
      ),
      height: Math.max(
        1,
        cssHeight,
      ),
    };
  };
  /* -------------------------------------------------------
     Context
     ------------------------------------------------------- */
  const getContext = () => {
    if (!canvas) {
      return null;
    }
    if (gl) {
      return gl;
    }
    /*
     * WebGL2 を優先。
     */
    try {
      gl =
        canvas.getContext(
          'webgl2',
          {
            alpha: true,
            antialias: true,
            premultipliedAlpha: true,
          },
        );
      if (gl) {
        contextType = 'webgl2';
        return gl;
      }
    } catch (error) {
      log(
        'WebGL2 unavailable',
        error,
      );
    }
    /*
     * WebGL fallback。
     */
    try {
      gl =
        canvas.getContext(
          'webgl',
          {
            alpha: true,
            antialias: true,
            premultipliedAlpha: true,
          },
        );
      if (gl) {
        contextType = 'webgl';
        return gl;
      }
    } catch (error) {
      log(
        'WebGL unavailable',
        error,
      );
    }
    /*
     * experimental-webgl fallback。
     */
    try {
      gl =
        canvas.getContext(
          'experimental-webgl',
          {
            alpha: true,
            antialias: true,
            premultipliedAlpha: true,
          },
        );
      if (gl) {
        contextType =
          'experimental-webgl';
        return gl;
      }
    } catch (error) {
      log(
        'experimental WebGL unavailable',
        error,
      );
    }
    return null;
  };
  /* -------------------------------------------------------
     Initialize
     ------------------------------------------------------- */
  const initialize = () => {
    if (!canvas) {
      debugState.lastError =
        'Canvas not found';
      return false;
    }
    const context =
      getContext();
    if (!context) {
      debugState.lastError =
        'WebGL context unavailable';
      return false;
    }
    initialized = true;
    debugState.initialized =
      true;
    debugState.contextType =
      contextType;
    resize();
    log(
      'initialized',
      contextType,
    );
    return true;
  };
  /* -------------------------------------------------------
     Clear
     ------------------------------------------------------- */
  const clear = () => {
    if (!gl) {
      return false;
    }
    try {
      gl.clearColor(
        clearColor[0],
        clearColor[1],
        clearColor[2],
        clearColor[3],
      );
      gl.clear(
        gl.COLOR_BUFFER_BIT |
          gl.DEPTH_BUFFER_BIT |
          gl.STENCIL_BUFFER_BIT,
      );
      return true;
    } catch (error) {
      debugState.lastError =
        String(error);
      return false;
    }
  };
  const setClearColor = (
    r,
    g,
    b,
    a = 1,
  ) => {
    clearColor = [
      clamp(
        finiteOr(r, 0),
        0,
        1,
      ),
      clamp(
        finiteOr(g, 0),
        0,
        1,
      ),
      clamp(
        finiteOr(b, 0),
        0,
        1,
      ),
      clamp(
        finiteOr(a, 1),
        0,
        1,
      ),
    ];
    return [
      ...clearColor,
    ];
  };
  const getClearColor = () => [
    ...clearColor,
  ];
  /* -------------------------------------------------------
     Resize
     ------------------------------------------------------- */
  const resize = (
    forcedWidth = null,
    forcedHeight = null,
  ) => {
    if (!canvas) {
      return false;
    }
    const size =
      getCanvasSize();
    const cssWidth =
      forcedWidth !== null
        ? Math.max(
            1,
            finiteOr(
              forcedWidth,
              size.width,
            ),
          )
        : size.width;
    const cssHeight =
      forcedHeight !== null
        ? Math.max(
            1,
            finiteOr(
              forcedHeight,
              size.height,
            ),
          )
        : size.height;
    devicePixelRatio =
      getPixelRatio();
    width =
      Math.max(
        1,
        Math.round(
          cssWidth *
            devicePixelRatio,
        ),
      );
    height =
      Math.max(
        1,
        Math.round(
          cssHeight *
            devicePixelRatio,
        ),
      );
    /*
     * Canvas backing resolution。
     */
    if (
      canvas.width !== width
    ) {
      canvas.width = width;
    }
    if (
      canvas.height !== height
    ) {
      canvas.height = height;
    }
    /*
     * CSS サイズは既存レイアウトを
     * 尊重する。
     */
    viewportWidth = width;
    viewportHeight = height;
    if (gl) {
      try {
        gl.viewport(
          0,
          0,
          width,
          height,
        );
      } catch (error) {
        log(
          'viewport update failed',
          error,
        );
      }
    }
    debugState.width =
      width;
    debugState.height =
      height;
    debugState.pixelRatio =
      devicePixelRatio;
    return true;
  };
  /* -------------------------------------------------------
     Viewport
     ------------------------------------------------------- */
  const setViewport = (
    x = 0,
    y = 0,
    viewportWidthValue = width,
    viewportHeightValue = height,
  ) => {
    if (!gl) {
      return false;
    }
    try {
      gl.viewport(
        Math.round(
          finiteOr(x, 0),
        ),
        Math.round(
          finiteOr(y, 0),
        ),
        Math.round(
          finiteOr(
            viewportWidthValue,
            width,
          ),
        ),
        Math.round(
          finiteOr(
            viewportHeightValue,
            height,
          ),
        ),
      );
      return true;
    } catch (error) {
      debugState.lastError =
        String(error);
      return false;
    }
  };
  /* -------------------------------------------------------
     Runtime Render
     ------------------------------------------------------- */
  const callRuntimeRender = (
    timestamp,
  ) => {
    if (!runtime) {
      return false;
    }
    /*
     * Runtime 側の render API を
     * 可能な限り柔軟に受ける。
     */
    try {
      if (
        typeof runtime.render ===
        'function'
      ) {
        runtime.render(
          timestamp,
        );
        return true;
      }
      if (
        typeof runtime.draw ===
        'function'
      ) {
        runtime.draw(
          timestamp,
        );
        return true;
      }
      if (
        typeof runtime.render_frame ===
        'function'
      ) {
        runtime.render_frame(
          timestamp,
        );
        return true;
      }
      if (
        typeof runtime.renderFrame ===
        'function'
      ) {
        runtime.renderFrame(
          timestamp,
        );
        return true;
      }
      if (
        typeof runtime.draw_frame ===
        'function'
      ) {
        runtime.draw_frame(
          timestamp,
        );
        return true;
      }
      if (
        typeof runtime.drawFrame ===
        'function'
      ) {
        runtime.drawFrame(
          timestamp,
        );
        return true;
      }
    } catch (error) {
      debugState.lastError =
        String(error);
      log(
        'runtime render failed',
        error,
      );
      return false;
    }
    return false;
  };
  /* -------------------------------------------------------
     Render
     ------------------------------------------------------- */
  const render = (
    timestamp =
      typeof performance !==
      'undefined'
        ? performance.now()
        : Date.now(),
  ) => {
    if (!initialized) {
      if (!initialize()) {
        return false;
      }
    }
    const start =
      typeof performance !==
      'undefined'
        ? performance.now()
        : Date.now();
    /*
     * Resize が有効なら毎 frame 軽く確認。
     * 実際の canvas サイズが変わった時だけ
     * backing buffer を変更する。
     */
    if (autoResize) {
      const size =
        getCanvasSize();
      const expectedWidth =
        Math.max(
          1,
          Math.round(
            size.width *
              devicePixelRatio,
          ),
        );
      const expectedHeight =
        Math.max(
          1,
          Math.round(
            size.height *
              devicePixelRatio,
          ),
        );
      if (
        canvas.width !==
          expectedWidth ||
        canvas.height !==
          expectedHeight
      ) {
        resize();
      }
    }
    if (clearBeforeRender) {
      clear();
    }
    const rendered =
      callRuntimeRender(
        timestamp,
      );
    const end =
      typeof performance !==
      'undefined'
        ? performance.now()
        : Date.now();
    lastRenderTimestamp =
      timestamp;
    lastRenderDurationMs =
      Math.max(
        0,
        end - start,
      );
    renderCount++;
    debugState.renderCount =
      renderCount;
    debugState.lastRenderDurationMs =
      lastRenderDurationMs;
    return rendered;
  };
  /* -------------------------------------------------------
     Resize Observer
     ------------------------------------------------------- */
  const startAutoResize = () => {
    if (!canvas) {
      return false;
    }
    autoResize = true;
    if (
      typeof ResizeObserver !==
      'undefined'
    ) {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      resizeObserver =
        new ResizeObserver(() => {
          resize();
        });
      resizeObserver.observe(
        canvas,
      );
    } else if (
      typeof window !==
      'undefined'
    ) {
      window.addEventListener(
        'resize',
        resize,
      );
    }
    resize();
    return true;
  };
  const stopAutoResize = () => {
    autoResize = false;
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    if (
      typeof window !==
      'undefined'
    ) {
      window.removeEventListener(
        'resize',
        resize,
      );
    }
  };
  /* -------------------------------------------------------
     Options
     ------------------------------------------------------- */
  const setAutoResize = (
    value,
  ) => {
    if (value) {
      startAutoResize();
    } else {
      stopAutoResize();
    }
    return autoResize;
  };
  const setClearBeforeRender = (
    value,
  ) => {
    clearBeforeRender =
      !!value;
    return clearBeforeRender;
  };
  /* -------------------------------------------------------
     Runtime
     ------------------------------------------------------- */
  const setRuntime = (
    nextRuntime,
  ) => {
    runtime =
      nextRuntime ?? null;
    return runtime;
  };
  const getRuntime = () =>
    runtime;
  /* -------------------------------------------------------
     State
     ------------------------------------------------------- */
  const getState = () => ({
    initialized,
    contextType,
    width,
    height,
    devicePixelRatio,
    autoResize,
    clearBeforeRender,
    clearColor: [
      ...clearColor,
    ],
    renderCount,
    lastRenderTimestamp,
    lastRenderDurationMs,
    viewportWidth,
    viewportHeight,
    debug: {
      ...debugState,
    },
  });
  /* -------------------------------------------------------
     Reset
     ------------------------------------------------------- */
  const reset = ({
    loseContext = false,
  } = {}) => {
    stopAutoResize();
    lastRenderTimestamp = 0;
    renderCount = 0;
    lastRenderDurationMs = 0;
    viewportWidth = 0;
    viewportHeight = 0;
    debugState.renderCount = 0;
    debugState.lastRenderDurationMs =
      0;
    debugState.lastError = null;
    if (
      loseContext &&
      gl
    ) {
      try {
        const extension =
          gl.getExtension(
            'WEBGL_lose_context',
          );
        extension?.loseContext();
      } catch {
        /* ignore */
      }
    }
    gl = null;
    contextType = null;
    initialized = false;
    debugState.initialized =
      false;
    debugState.contextType =
      null;
  };
  /* -------------------------------------------------------
     Public API
     ------------------------------------------------------- */
  return {
    initialize,
    getContext,
    getRuntime,
    setRuntime,
    clear,
    setClearColor,
    getClearColor,
    resize,
    setViewport,
    render,
    startAutoResize,
    stopAutoResize,
    setAutoResize,
    setClearBeforeRender,
    getState,
    reset,
  };
}
export default {
  createRenderController,
};

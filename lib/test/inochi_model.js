/* =========================================================
   Inochi2D Model Module
   ---------------------------------------------------------
   モデル読み込み・モーション読み込み・モデル初期化だけを担当。
   パラメータ / アニメーション / 口パク / 瞬き / 視線などは担当しない。
   本体側では createModelController(...) を作成して使用する。
   ========================================================= */
export function createModelController({
  runtime,
  /*
   * 既存 bridge から渡す関数
   *
   * decodePuppetPayload:
   *   .inp/.inx のモデルバイト列から puppet payload を取り出す。
   *
   * loadMotionPayload:
   *   motion ファイルを読み込む。
   *
   * rebuildAnimationLibrary:
   *   puppetPayload / motionPayload からアニメーション情報を構築する。
   */
  decodePuppetPayload,
  loadMotionPayload,
  rebuildAnimationLibrary,
  /*
   * モデルロード後に本体側で状態を初期化するための callback。
   * ここには parameter / animation / node motion 等の reset 処理を
   * 本体側から渡せる。
   */
  resetModelState = null,
  /*
   * モデルロード完了後の callback。
   */
  onModelLoaded = null,
  /*
   * エラー時 callback。
   */
  onModelError = null,
  /*
   * デバッグ出力。
   */
  debugEnabled = false,
}) {
  let loadedModelUrl = null;
  let loadedMotionUrl = null;
  let loadedModelBytes = null;
  let loadedPuppetPayload = null;
  let loadedMotionPayload = null;
  let modelStatus = 'idle';
  let modelError = null;
  const log = (...args) => {
    if (debugEnabled) {
      console.info('[Inochi2D model]', ...args);
    }
  };
  const warn = (...args) => {
    console.warn('[Inochi2D model]', ...args);
  };
  const getNow = () =>
    typeof performance !== 'undefined'
      ? performance.now()
      : Date.now();
  const fetchBinary = async (url, label = 'file') => {
    if (!url || typeof url !== 'string') {
      throw new Error(`Missing Inochi2D ${label} URL.`);
    }
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch Inochi2D ${label} (${response.status} ${response.statusText}).`,
      );
    }
    return new Uint8Array(await response.arrayBuffer());
  };
  const validateDependencies = () => {
    if (!runtime) {
      throw new Error('Inochi2D runtime is not available.');
    }
    if (typeof runtime.load_model !== 'function') {
      throw new Error(
        'Inochi2D runtime does not provide load_model().',
      );
    }
    if (typeof decodePuppetPayload !== 'function') {
      throw new Error(
        'decodePuppetPayload() was not provided to the model controller.',
      );
    }
    if (typeof rebuildAnimationLibrary !== 'function') {
      throw new Error(
        'rebuildAnimationLibrary() was not provided to the model controller.',
      );
    }
  };
  const loadMotion = async (motionUrl) => {
    if (!motionUrl) {
      return null;
    }
    if (typeof loadMotionPayload === 'function') {
      return loadMotionPayload(motionUrl);
    }
    /*
     * motionUrl があるのに loader が渡されていない場合。
     * 既存 bridge の loadMotionPayload を使う想定なので、
     * 勝手なフォーマット解析はしない。
     */
    throw new Error(
      'A motion URL was provided, but loadMotionPayload() is unavailable.',
    );
  };
  const clearLoadedModelState = () => {
    loadedModelUrl = null;
    loadedMotionUrl = null;
    loadedModelBytes = null;
    loadedPuppetPayload = null;
    loadedMotionPayload = null;
    modelStatus = 'idle';
    modelError = null;
  };
  const loadModel = async (modelUrl, motionUrl = null) => {
    validateDependencies();
    const startedAt = getNow();
    modelStatus = 'loading';
    modelError = null;
    log('loading model', {
      modelUrl,
      motionUrl,
    });
    try {
      /*
       * -----------------------------------------------------
       * 1. モデル本体を取得
       * -----------------------------------------------------
       */
      const modelBytes = await fetchBinary(
        modelUrl,
        'model',
      );
      log('model fetched', {
        bytes: modelBytes.byteLength,
      });
      /*
       * -----------------------------------------------------
       * 2. Puppet payload を解析
       * -----------------------------------------------------
       */
      const puppetPayload =
        decodePuppetPayload(modelBytes);
      if (!puppetPayload) {
        throw new Error(
          'Failed to decode Inochi2D puppet payload.',
        );
      }
      log('puppet payload decoded');
      /*
       * -----------------------------------------------------
       * 3. motion payload を取得
       * -----------------------------------------------------
       */
      const motionPayload =
        await loadMotion(motionUrl);
      if (motionPayload) {
        log('motion payload loaded');
      }
      /*
       * -----------------------------------------------------
       * 4. アニメーションライブラリを構築
       *
       * ここではアニメーションそのものを処理しない。
       * animation module が利用できる状態を作るだけ。
       * -----------------------------------------------------
       */
      rebuildAnimationLibrary(
        puppetPayload,
        motionPayload,
      );
      /*
       * -----------------------------------------------------
       * 5. runtime にモデルをロード
       * -----------------------------------------------------
       */
      runtime.load_model(modelBytes);
      /*
       * -----------------------------------------------------
       * 6. 成功したモデル情報を保存
       * -----------------------------------------------------
       */
      loadedModelUrl = modelUrl;
      loadedMotionUrl = motionUrl;
      loadedModelBytes = modelBytes;
      loadedPuppetPayload = puppetPayload;
      loadedMotionPayload = motionPayload;
      modelStatus = 'loaded';
      modelError = null;
      /*
       * -----------------------------------------------------
       * 7. 本体側の状態を初期化
       *
       * parameter / animation / motion / camera 等の
       * reset はこのファイルでは直接触らない。
       * -----------------------------------------------------
       */
      if (typeof resetModelState === 'function') {
        await resetModelState({
          modelUrl,
          motionUrl,
          modelBytes,
          puppetPayload,
          motionPayload,
        });
      }
      const elapsedMs = getNow() - startedAt;
      log('model loaded', {
        modelUrl,
        motionUrl,
        elapsedMs,
      });
      if (typeof onModelLoaded === 'function') {
        await onModelLoaded({
          modelUrl,
          motionUrl,
          modelBytes,
          puppetPayload,
          motionPayload,
          elapsedMs,
        });
      }
      return {
        modelUrl,
        motionUrl,
        modelBytes,
        puppetPayload,
        motionPayload,
        elapsedMs,
      };
    } catch (error) {
      modelStatus = 'error';
      modelError =
        error instanceof Error
          ? error.message
          : String(error);
      console.error(
        '[Inochi2D model] model loading failed',
        error,
      );
      /*
       * .inx の場合は既存 bridge と同じく、
       * browser 用には .inp 推奨という情報を付加する。
       */
      if (
        typeof modelUrl === 'string' &&
        modelUrl.toLowerCase().endsWith('.inx')
      ) {
        const message =
          error instanceof Error
            ? error.message
            : String(error);
        const browserMessage =
          `${message} ` +
          'Exporting the model as .inp from Inochi Creator is recommended for browser use.';
        modelError = browserMessage;
        if (typeof onModelError === 'function') {
          await onModelError(
            new Error(browserMessage),
          );
        }
        throw new Error(browserMessage);
      }
      if (typeof onModelError === 'function') {
        await onModelError(error);
      }
      throw error;
    }
  };
  const unloadModel = async () => {
    log('unloading model');
    if (runtime) {
      if (typeof runtime.clear === 'function') {
        runtime.clear();
      }
    }
    clearLoadedModelState();
  };
  const getState = () => ({
    status: modelStatus,
    error: modelError,
    modelUrl: loadedModelUrl,
    motionUrl: loadedMotionUrl,
    modelBytes:
      loadedModelBytes?.byteLength ?? 0,
    hasModel: Boolean(loadedModelBytes),
    hasPuppetPayload:
      Boolean(loadedPuppetPayload),
    hasMotionPayload:
      Boolean(loadedMotionPayload),
  });
  const getModelBytes = () =>
    loadedModelBytes;
  const getPuppetPayload = () =>
    loadedPuppetPayload;
  const getMotionPayload = () =>
    loadedMotionPayload;
  const getModelUrl = () =>
    loadedModelUrl;
  const getMotionUrl = () =>
    loadedMotionUrl;
  const isLoaded = () =>
    modelStatus === 'loaded';
  return {
    loadModel,
    unloadModel,
    getState,
    getModelBytes,
    getPuppetPayload,
    getMotionPayload,
    getModelUrl,
    getMotionUrl,
    isLoaded,
  };
}

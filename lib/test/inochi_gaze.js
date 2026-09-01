/*
 * inochi_gaze.js
 * =========================
 * Inochi2D 自動視線制御
 *
 * 担当:
 * - AUTO_GAZE_PARAMETER_IDS
 * - 自動視線値の生成
 * - 視線パラメータへの書き込み
 * - gazeLayer の管理
 *
 * メインファイル側から必要なものだけ deps で受け取る。
 * =========================
 */

const DEFAULT_GAZE_CONFIG = {
  xSpeed: 0.00045,
  ySpeed: 0.00031,

  xAmplitude: 0.18,
  yAmplitude: 0.10,

  xOffset: 0,
  yOffset: 0,

  // 視線の動きを少し自然にするための位相差
  yPhase: Math.PI * 0.37,
};


export function createInochiGazeController(deps = {}) {
  const {
    getRuntime,
    getCanvas,

    getParameterById,

    markParameterSource,
    setScalarParameterValue,

    ensureLoop,

    AUTO_GAZE_PARAMETER_IDS,

    clamp01,
  } = deps;


  /*
   * =========================
   * 内部状態
   * =========================
   */

  let gazeLayer = {
    mode: 'auto',

    x: 0,
    y: 0,

    activeParameterIds: [],
  };


  let config = {
    ...DEFAULT_GAZE_CONFIG,
  };


  /*
   * =========================
   * utility
   * =========================
   */

  const getNow = () => {
    if (typeof performance !== 'undefined') {
      return performance.now();
    }

    return Date.now();
  };


  const safeClamp = (value) => {
    if (typeof clamp01 === 'function') {
      return clamp01(value);
    }

    return Math.max(0, Math.min(1, value));
  };


  /*
   * =========================
   * パラメータ取得
   * =========================
   */

  const getGazeParameterIds = () => {
    const parameterById = getParameterById?.();

    if (!parameterById) {
      return [];
    }

    const ids = [
      AUTO_GAZE_PARAMETER_IDS?.leftX,
      AUTO_GAZE_PARAMETER_IDS?.rightX,
      AUTO_GAZE_PARAMETER_IDS?.leftY,
      AUTO_GAZE_PARAMETER_IDS?.rightY,
    ];

    return [
      ...new Set(
        ids.filter(
          (parameterId) =>
            typeof parameterId === 'string' &&
            parameterById.has(parameterId),
        ),
      ),
    ];
  };


  /*
   * =========================
   * 自動視線計算
   * =========================
   *
   * timestamp は requestAnimationFrame の値。
   *
   * x / y をそれぞれ別周期の sin 波で動かす。
   * 完全なランダムではなく、ゆっくり左右を見る。
   */

  const resolveAutoGaze = (timestamp) => {
    const time = Number.isFinite(timestamp)
      ? timestamp
      : getNow();


    const x =
      config.xOffset +
      Math.sin(time * config.xSpeed) *
        config.xAmplitude;


    const y =
      config.yOffset +
      Math.sin(
        time * config.ySpeed + config.yPhase,
      ) *
        config.yAmplitude;


    return {
      x,
      y,
    };
  };


  /*
   * =========================
   * 視線パラメータ書き込み
   * =========================
   */

  const applyGazeParameter = (
    parameterId,
    x,
    y,
  ) => {
    if (
      typeof parameterId !== 'string' ||
      !parameterId
    ) {
      return;
    }


    const lowerId = parameterId.toLowerCase();


    const isY =
      lowerId.includes('righty') ||
      lowerId.includes('lefty') ||
      lowerId.endsWith(':: move y') ||
      lowerId.includes('move y');


    const value = isY ? y : x;


    if (typeof markParameterSource === 'function') {
      markParameterSource(
        parameterId,
        'gaze:auto',
      );
    }


    if (
      typeof setScalarParameterValue === 'function'
    ) {
      setScalarParameterValue(
        parameterId,
        value,
      );
    }
  };


  /*
   * =========================
   * 自動視線適用
   * =========================
   */

  const applyGazeLayer = (timestamp) => {
    const runtime = getRuntime?.();

    if (!runtime) {
      return;
    }


    const gazeParameterIds =
      getGazeParameterIds();


    if (gazeParameterIds.length === 0) {
      gazeLayer = {
        ...gazeLayer,

        mode: 'auto',

        x: 0,
        y: 0,

        activeParameterIds: [],
      };


      const canvas = getCanvas?.();

      if (canvas) {
        canvas.dataset.inochi2dGazeLayer =
          'auto:none';
      }

      return;
    }


    const nextGaze =
      resolveAutoGaze(timestamp);


    for (const parameterId of gazeParameterIds) {
      applyGazeParameter(
        parameterId,
        nextGaze.x,
        nextGaze.y,
      );
    }


    gazeLayer = {
      ...gazeLayer,

      mode: 'auto',

      x: nextGaze.x,
      y: nextGaze.y,

      activeParameterIds:
        gazeParameterIds,
    };


    const canvas = getCanvas?.();

    if (canvas) {
      canvas.dataset.inochi2dGazeLayer =
        `auto:${nextGaze.x.toFixed(3)},${nextGaze.y.toFixed(3)}`;

      canvas.dataset.inochi2dGazeX =
        nextGaze.x.toFixed(3);

      canvas.dataset.inochi2dGazeY =
        nextGaze.y.toFixed(3);
    }
  };


  /*
   * =========================
   * 手動視線
   * =========================
   *
   * 将来 iFacialMocap を入れる場合に使える。
   */

  const setGazeValue = (
    x,
    y,
    options = {},
  ) => {
    const nextX = Number.isFinite(x)
      ? x
      : 0;

    const nextY = Number.isFinite(y)
      ? y
      : 0;


    gazeLayer = {
      ...gazeLayer,

      mode:
        options.mode === 'manual'
          ? 'manual'
          : 'auto',

      x: nextX,
      y: nextY,
    };


    const parameterIds =
      getGazeParameterIds();


    for (const parameterId of parameterIds) {
      const lowerId =
        parameterId.toLowerCase();


      const isY =
        lowerId.includes('righty') ||
        lowerId.includes('lefty') ||
        lowerId.endsWith(':: move y') ||
        lowerId.includes('move y');


      const value = isY
        ? nextY
        : nextX;


      if (
        typeof markParameterSource ===
        'function'
      ) {
        markParameterSource(
          parameterId,
          'gaze:manual',
        );
      }


      if (
        typeof setScalarParameterValue ===
        'function'
      ) {
        setScalarParameterValue(
          parameterId,
          value,
        );
      }
    }


    gazeLayer.activeParameterIds =
      parameterIds;


    const canvas = getCanvas?.();

    if (canvas) {
      canvas.dataset.inochi2dGazeLayer =
        `manual:${nextX.toFixed(3)},${nextY.toFixed(3)}`;

      canvas.dataset.inochi2dGazeX =
        nextX.toFixed(3);

      canvas.dataset.inochi2dGazeY =
        nextY.toFixed(3);
    }


    if (typeof ensureLoop === 'function') {
      ensureLoop();
    }
  };


  /*
   * =========================
   * 設定変更
   * =========================
   */

  const configure = (nextConfig = {}) => {
    config = {
      ...config,

      ...nextConfig,
    };


    if (
      Number.isFinite(config.xAmplitude)
    ) {
      config.xAmplitude =
        Math.abs(config.xAmplitude);
    }


    if (
      Number.isFinite(config.yAmplitude)
    ) {
      config.yAmplitude =
        Math.abs(config.yAmplitude);
    }


    if (
      Number.isFinite(config.xSpeed)
    ) {
      config.xSpeed =
        Math.abs(config.xSpeed);
    }


    if (
      Number.isFinite(config.ySpeed)
    ) {
      config.ySpeed =
        Math.abs(config.ySpeed);
    }
  };


  /*
   * =========================
   * 自動視線 ON/OFF
   * =========================
   */

  const setMode = (mode) => {
    if (mode === 'manual') {
      gazeLayer = {
        ...gazeLayer,

        mode: 'manual',
      };

      return;
    }


    gazeLayer = {
      ...gazeLayer,

      mode: 'auto',
    };


    if (typeof ensureLoop === 'function') {
      ensureLoop();
    }
  };


  /*
   * =========================
   * リセット
   * =========================
   */

  const reset = () => {
    gazeLayer = {
      mode: 'auto',

      x: 0,
      y: 0,

      activeParameterIds: [],
    };


    const canvas = getCanvas?.();

    if (canvas) {
      canvas.dataset.inochi2dGazeLayer =
        'auto:0.000,0.000';

      canvas.dataset.inochi2dGazeX =
        '0.000';

      canvas.dataset.inochi2dGazeY =
        '0.000';
    }
  };


  /*
   * =========================
   * debug
   * =========================
   */

  const getDebugState = () => ({
    ...gazeLayer,

    activeParameterIds: [
      ...gazeLayer.activeParameterIds,
    ],

    config: {
      ...config,
    },
  });


  /*
   * =========================
   * 公開 API
   * =========================
   */

  return {
    applyGazeLayer,

    resolveAutoGaze,

    getGazeParameterIds,

    setGazeValue,

    configure,

    setMode,

    reset,

    getDebugState,

    getConfig() {
      return {
        ...config,
      };
    },
  };
}

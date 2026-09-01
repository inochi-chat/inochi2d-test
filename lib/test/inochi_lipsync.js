/*
 * ============================================================
 * Inochi2D Lip Sync Module
 * ============================================================
 *
 * 役割:
 *   - Mouth:: Shape の管理
 *   - リップシンク開閉値の補間
 *   - 母音(viseme)による口形状
 *   - ランタイムへの Vec2 書き込み
 *   - runtime.tick() 後の口閉じ補正
 *
 * このファイルは「口」だけを担当する。
 *
 * 必要なものは createInochiLipSync() に渡す。
 *
 * ============================================================
 */

const DEFAULT_MOUTH_PARAMETER_ID = 'Mouth:: Shape';

const DEFAULT_VISEME_POSES = Object.freeze({
  neutral: [1, 0],
  a: [0.5, 1],
  i: [1, 0.25],
  u: [0, 0.45],
  e: [0.75, 0.55],
  o: [0, 0.85],
});

const DEFAULT_ATTACK_MS = 45;
const DEFAULT_RELEASE_MS = 110;
const DEFAULT_CLOSE_EPSILON = 0.001;


/* ============================================================
 * Utility
 * ========================================================== */

const clamp01 = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.min(1, Math.max(0, number));
};


/* ============================================================
 * createInochiLipSync
 * ============================================================
 *
 * options:
 *
 * runtime
 *   Inochi2dRuntime
 *
 * canvas
 *   canvas element
 *
 * parameterById
 *   Map<string, parameter>
 *
 * resolveParameterHandle
 *   parameterId => runtime handle
 *
 * setParameterSource
 *   任意のデバッグ用 callback
 *
 * mouthParameterId
 *   通常は "Mouth:: Shape"
 *
 * ========================================================== */

export const createInochiLipSync = ({
  runtime = null,
  canvas = null,
  parameterById = new Map(),
  resolveParameterHandle = null,
  setParameterSource = null,

  mouthParameterId = DEFAULT_MOUTH_PARAMETER_ID,

  visemePoses = DEFAULT_VISEME_POSES,

  attackMs = DEFAULT_ATTACK_MS,
  releaseMs = DEFAULT_RELEASE_MS,
  closeEpsilon = DEFAULT_CLOSE_EPSILON,

  ensureLoop = null,
} = {}) => {

  /*
   * ----------------------------------------------------------
   * Internal state
   * --------------------------------------------------------
   */

  let currentRuntime = runtime;
  let currentCanvas = canvas;
  let currentParameterById = parameterById;

  let currentResolveParameterHandle = resolveParameterHandle;
  let currentSetParameterSource = setParameterSource;
  let currentEnsureLoop = ensureLoop;

  let currentMouthParameterId = mouthParameterId;

  let currentAttackMs =
    Number.isFinite(attackMs)
      ? Math.max(0, attackMs)
      : DEFAULT_ATTACK_MS;

  let currentReleaseMs =
    Number.isFinite(releaseMs)
      ? Math.max(0, releaseMs)
      : DEFAULT_RELEASE_MS;

  let currentCloseEpsilon =
    Number.isFinite(closeEpsilon)
      ? Math.max(0, closeEpsilon)
      : DEFAULT_CLOSE_EPSILON;

  let currentVisemePoses = {
    ...DEFAULT_VISEME_POSES,
    ...(visemePoses ?? {}),
  };


  /*
   * ----------------------------------------------------------
   * Lip sync state
   * --------------------------------------------------------
   */

  let lipSyncLayer = {
    targetOpen: 0,
    currentOpen: 0,
    viseme: 'neutral',
    active: false,
    pose: [...currentVisemePoses.neutral],
  };


  /*
   * ----------------------------------------------------------
   * Debug state
   * --------------------------------------------------------
   */

  let lastWrite = null;

  let writeCount = 0;

  let lastPostRuntimeWrite = null;


  /* ==========================================================
   * Runtime / dependency setters
   * ======================================================== */

  const setRuntime = (nextRuntime) => {
    currentRuntime = nextRuntime ?? null;
  };


  const setCanvas = (nextCanvas) => {
    currentCanvas = nextCanvas ?? null;
  };


  const setParameterMap = (nextParameterById) => {
    currentParameterById =
      nextParameterById instanceof Map
        ? nextParameterById
        : new Map();
  };


  const setParameterResolver = (resolver) => {
    currentResolveParameterHandle =
      typeof resolver === 'function'
        ? resolver
        : null;
  };


  const setParameterSourceCallback = (callback) => {
    currentSetParameterSource =
      typeof callback === 'function'
        ? callback
        : null;
  };


  const setEnsureLoop = (callback) => {
    currentEnsureLoop =
      typeof callback === 'function'
        ? callback
        : null;
  };


  /* ==========================================================
   * Parameter existence
   * ======================================================== */

  const hasMouthParameter = () => {
    return Boolean(
      currentParameterById &&
      typeof currentParameterById.has === 'function' &&
      currentParameterById.has(currentMouthParameterId),
    );
  };


  /* ==========================================================
   * Viseme
   * ======================================================== */

  const hasViseme = (viseme) => {
    return (
      typeof viseme === 'string' &&
      Object.prototype.hasOwnProperty.call(
        currentVisemePoses,
        viseme,
      )
    );
  };


  const normalizeViseme = (viseme, fallback = 'a') => {
    if (hasViseme(viseme)) {
      return viseme;
    }

    if (hasViseme(fallback)) {
      return fallback;
    }

    return 'neutral';
  };


  const getVisemePose = (viseme) => {
    const normalizedViseme =
      normalizeViseme(viseme, 'a');

    const pose =
      currentVisemePoses[normalizedViseme] ??
      currentVisemePoses.neutral;

    return [
      Number.isFinite(pose?.[0])
        ? pose[0]
        : 0,

      Number.isFinite(pose?.[1])
        ? pose[1]
        : 0,
    ];
  };


  /* ==========================================================
   * Lip sync pose
   * ======================================================== */

  const resolveLipSyncPose = (
    openAmount,
    viseme = 'a',
  ) => {

    const open = clamp01(openAmount);

    const restPose =
      getVisemePose('neutral');

    const targetPose =
      getVisemePose(viseme);

    return [
      restPose[0] +
        (targetPose[0] - restPose[0]) * open,

      restPose[1] +
        (targetPose[1] - restPose[1]) * open,
    ];
  };


  /* ==========================================================
   * Runtime parameter write
   * ======================================================== */

  const writeMouthParameter = (
    valueX,
    valueY,
    source = 'lip-sync',
  ) => {

    const x = Number.isFinite(valueX)
      ? valueX
      : 0;

    const y = Number.isFinite(valueY)
      ? valueY
      : 0;

    writeCount += 1;

    lastWrite = {
      parameterId: currentMouthParameterId,
      x,
      y,
      source,
      timestamp:
        typeof performance !== 'undefined'
          ? performance.now()
          : Date.now(),
    };


    /*
     * Debug source
     */

    if (
      typeof currentSetParameterSource ===
      'function'
    ) {
      try {
        currentSetParameterSource(
          currentMouthParameterId,
          source,
        );
      } catch (error) {
        console.warn(
          '[Inochi2D LipSync] parameter source callback failed',
          error,
        );
      }
    }


    /*
     * Debug console
     */

    console.log(
      '[MOUTH WRITE]',
      currentMouthParameterId,
      'X=',
      x,
      'Y=',
      y,
      'source=',
      source,
    );


    /*
     * Runtime がない場合
     */

    if (!currentRuntime) {
      return false;
    }


    /*
     * Mouth parameter が存在しない場合
     */

    if (!hasMouthParameter()) {
      return false;
    }


    /*
     * handle 経由
     */

    let parameterHandle = null;

    if (
      typeof currentResolveParameterHandle ===
      'function'
    ) {
      try {
        parameterHandle =
          currentResolveParameterHandle(
            currentMouthParameterId,
          );
      } catch (error) {
        console.warn(
          '[Inochi2D LipSync] parameter handle resolve failed',
          error,
        );
      }
    }


    if (
      parameterHandle !== null &&
      typeof currentRuntime
        .set_parameter_vec2_by_handle ===
        'function'
    ) {

      currentRuntime.set_parameter_vec2_by_handle(
        parameterHandle,
        x,
        y,
      );

    } else if (
      typeof currentRuntime
        .set_parameter_vec2 ===
      'function'
    ) {

      currentRuntime.set_parameter_vec2(
        currentMouthParameterId,
        x,
        y,
      );

    } else {

      console.warn(
        '[Inochi2D LipSync] runtime has no Vec2 setter',
      );

      return false;
    }


    /*
     * Canvas debug
     */

    if (currentCanvas) {

      currentCanvas.dataset
        .inochi2dMouthShape =
        `${x.toFixed(3)},${y.toFixed(3)}`;

      currentCanvas.dataset
        .inochi2dLipSyncLayer =
        lipSyncLayer.active
          ? lipSyncLayer.viseme
          : 'idle';
    }

    return true;
  };


  /* ==========================================================
   * Immediate mouth write
   * ======================================================== */

  const applyCurrentPose = (
    source = 'lip-sync',
  ) => {

    const pose =
      resolveLipSyncPose(
        lipSyncLayer.currentOpen,
        lipSyncLayer.viseme,
      );

    lipSyncLayer = {
      ...lipSyncLayer,
      pose,
    };

    writeMouthParameter(
      pose[0],
      pose[1],
      source,
    );

    return pose;
  };


  /* ==========================================================
   * setLipSyncLayerValue
   * ======================================================== */

  const setLipSyncLayerValue = (
    value,
    options = {},
  ) => {

    const nextOpen =
      clamp01(value);


    const requestedViseme =
      typeof options.viseme === 'string'
        ? options.viseme
        : lipSyncLayer.viseme;


    const nextViseme =
      hasViseme(requestedViseme)
        ? requestedViseme
        : lipSyncLayer.viseme;


    const immediate =
      options.immediate === true;


    const nextCurrentOpen =
      immediate
        ? nextOpen
        : lipSyncLayer.currentOpen;


    const effectiveViseme =
      nextOpen >
      currentCloseEpsilon
        ? nextViseme
        : 'neutral';


    lipSyncLayer = {
      ...lipSyncLayer,

      targetOpen:
        nextOpen,

      currentOpen:
        nextCurrentOpen,

      viseme:
        effectiveViseme,

      active:
        nextOpen >
          currentCloseEpsilon ||
        !immediate,
    };


    /*
     * 即時反映
     */

    if (immediate) {

      applyCurrentPose(
        `lip-sync:${lipSyncLayer.viseme}`,
      );

    }


    /*
     * 次フレームを確実に回す
     */

    if (
      typeof currentEnsureLoop ===
      'function'
    ) {
      currentEnsureLoop();
    }


    return getState();
  };


  /* ==========================================================
   * applyLipSyncLayer
   *
   * tick() から毎フレーム呼ぶ
   * ======================================================== */

  const applyLipSyncLayer = (
    deltaTimeMs,
  ) => {

    /*
     * runtime / parameter がない場合
     */

    if (
      !currentRuntime ||
      !hasMouthParameter()
    ) {
      return {
        applied: false,
        reason: 'mouth-parameter-not-found',
        state: getState(),
      };
    }


    const targetOpen =
      clamp01(
        lipSyncLayer.targetOpen,
      );

    const currentOpen =
      clamp01(
        lipSyncLayer.currentOpen,
      );


    /*
     * 開くときは attack
     * 閉じるときは release
     */

    const smoothingMs =
      targetOpen > currentOpen
        ? currentAttackMs
        : currentReleaseMs;


    const delta =
      Number.isFinite(deltaTimeMs)
        ? Math.max(0, deltaTimeMs)
        : 16.67;


    const mix =
      smoothingMs <= 0
        ? 1
        : Math.min(
            1,
            Math.max(
              0,
              delta / smoothingMs,
            ),
          );


    const nextOpen =
      currentOpen +
      (targetOpen - currentOpen) *
        mix;


    /*
     * 完全に閉じたか
     */

    const shouldRemainActive =
      targetOpen >
        currentCloseEpsilon ||
      nextOpen >
        currentCloseEpsilon;


    const finalOpen =
      shouldRemainActive
        ? nextOpen
        : 0;


    const finalViseme =
      finalOpen >
        currentCloseEpsilon
        ? normalizeViseme(
            lipSyncLayer.viseme,
            'a',
          )
        : 'neutral';


    const pose =
      resolveLipSyncPose(
        finalOpen,
        finalViseme,
      );


    lipSyncLayer = {
      ...lipSyncLayer,

      targetOpen:
        shouldRemainActive
          ? targetOpen
          : 0,

      currentOpen:
        finalOpen,

      viseme:
        finalViseme,

      active:
        shouldRemainActive,

      pose,
    };


    /*
     * Mouth parameter 書き込み
     */

    writeMouthParameter(
      pose[0],
      pose[1],
      `lip-sync:${finalViseme}`,
    );


    return {
      applied: true,
      open: finalOpen,
      targetOpen,
      viseme: finalViseme,
      pose: [...pose],
      state: getState(),
    };
  };


  /* ==========================================================
   * Post runtime mouth safety
   *
   * runtime.tick() の後に呼ぶ。
   *
   * 口が完全に閉じているなら neutral を再度書き込む。
   * ======================================================== */

  const applyPostRuntimeNeutral = () => {

    if (
      !currentRuntime ||
      !hasMouthParameter()
    ) {
      return false;
    }


    if (
      lipSyncLayer.currentOpen >
      currentCloseEpsilon
    ) {
      return false;
    }


    const neutralPose =
      getVisemePose('neutral');


    lipSyncLayer = {
      ...lipSyncLayer,

      currentOpen: 0,
      targetOpen: 0,
      viseme: 'neutral',
      active: false,
      pose: [...neutralPose],
    };


    lastPostRuntimeWrite = {
      x: neutralPose[0],
      y: neutralPose[1],
      timestamp:
        typeof performance !== 'undefined'
          ? performance.now()
          : Date.now(),
    };


    writeMouthParameter(
      neutralPose[0],
      neutralPose[1],
      'lip-sync:post-runtime-neutral',
    );


    if (currentCanvas) {
      currentCanvas.dataset
        .inochi2dMouthShape =
        `${neutralPose[0].toFixed(3)},${neutralPose[1].toFixed(3)}`;
    }


    return true;
  };


  /* ==========================================================
   * Reset
   * ======================================================== */

  const reset = ({
    immediate = false,
  } = {}) => {

    lipSyncLayer = {
      targetOpen: 0,
      currentOpen: 0,
      viseme: 'neutral',
      active: false,
      pose: [
        ...getVisemePose('neutral'),
      ],
    };


    if (immediate) {
      applyCurrentPose(
        'lip-sync:reset',
      );
    }


    if (
      typeof currentEnsureLoop ===
      'function'
    ) {
      currentEnsureLoop();
    }


    return getState();
  };


  /* ==========================================================
   * Configuration
   * ======================================================== */

  const configure = ({
    runtime: nextRuntime,
    canvas: nextCanvas,
    parameterById: nextParameterById,
    resolveParameterHandle: nextResolver,
    setParameterSource: nextSourceCallback,
    ensureLoop: nextEnsureLoop,

    mouthParameterId: nextMouthParameterId,

    visemePoses: nextVisemePoses,

    attackMs: nextAttackMs,
    releaseMs: nextReleaseMs,
    closeEpsilon: nextCloseEpsilon,
  } = {}) => {

    if (nextRuntime !== undefined) {
      setRuntime(nextRuntime);
    }

    if (nextCanvas !== undefined) {
      setCanvas(nextCanvas);
    }

    if (nextParameterById !== undefined) {
      setParameterMap(
        nextParameterById,
      );
    }

    if (
      nextResolver !== undefined
    ) {
      setParameterResolver(
        nextResolver,
      );
    }

    if (
      nextSourceCallback !== undefined
    ) {
      setParameterSourceCallback(
        nextSourceCallback,
      );
    }

    if (
      nextEnsureLoop !== undefined
    ) {
      setEnsureLoop(
        nextEnsureLoop,
      );
    }

    if (
      typeof nextMouthParameterId ===
      'string' &&
      nextMouthParameterId.trim()
    ) {
      currentMouthParameterId =
        nextMouthParameterId.trim();
    }

    if (
      nextVisemePoses &&
      typeof nextVisemePoses === 'object'
    ) {
      currentVisemePoses = {
        ...currentVisemePoses,
        ...nextVisemePoses,
      };
    }

    if (
      Number.isFinite(nextAttackMs)
    ) {
      currentAttackMs =
        Math.max(0, nextAttackMs);
    }

    if (
      Number.isFinite(nextReleaseMs)
    ) {
      currentReleaseMs =
        Math.max(0, nextReleaseMs);
    }

    if (
      Number.isFinite(nextCloseEpsilon)
    ) {
      currentCloseEpsilon =
        Math.max(0, nextCloseEpsilon);
    }
  };


  /* ==========================================================
   * State
   * ======================================================== */

  const getState = () => ({
    targetOpen:
      lipSyncLayer.targetOpen,

    currentOpen:
      lipSyncLayer.currentOpen,

    viseme:
      lipSyncLayer.viseme,

    active:
      lipSyncLayer.active,

    pose:
      [...lipSyncLayer.pose],

    mouthParameterId:
      currentMouthParameterId,

    mouthParameterExists:
      hasMouthParameter(),

    attackMs:
      currentAttackMs,

    releaseMs:
      currentReleaseMs,

    closeEpsilon:
      currentCloseEpsilon,

    lastWrite:
      lastWrite
        ? { ...lastWrite }
        : null,

    lastPostRuntimeWrite:
      lastPostRuntimeWrite
        ? { ...lastPostRuntimeWrite }
        : null,

    writeCount,
  });


  /* ==========================================================
   * Debug
   * ======================================================== */

  const getDebugInfo = () => ({
    ...getState(),

    visemePoses:
      Object.fromEntries(
        Object.entries(
          currentVisemePoses,
        ).map(
          ([name, pose]) => [
            name,
            [...pose],
          ],
        ),
      ),

    runtimeAvailable:
      Boolean(currentRuntime),

    canvasAvailable:
      Boolean(currentCanvas),

    parameterCount:
      currentParameterById instanceof Map
        ? currentParameterById.size
        : 0,
  });


  /* ==========================================================
   * Public API
   * ======================================================== */

  return {
    /*
     * dependency
     */
    configure,
    setRuntime,
    setCanvas,
    setParameterMap,
    setParameterResolver,
    setParameterSourceCallback,
    setEnsureLoop,

    /*
     * parameter
     */
    hasMouthParameter,

    /*
     * viseme
     */
    hasViseme,
    normalizeViseme,
    getVisemePose,
    resolveLipSyncPose,

    /*
     * lip sync
     */
    setLipSyncLayerValue,
    applyLipSyncLayer,
    applyPostRuntimeNeutral,

    /*
     * reset
     */
    reset,

    /*
     * state
     */
    getState,
    getDebugInfo,

    /*
     * constants
     */
    mouthParameterId:
      currentMouthParameterId,
  };
};


/* ============================================================
 * Default export
 * ========================================================== */

export default createInochiLipSync;

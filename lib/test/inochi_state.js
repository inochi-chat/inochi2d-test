/* =========================================================
   Inochi2D State Module
   ---------------------------------------------------------
   Inochi2D 本体で共有する状態だけを管理する。
   担当:
   - Parameter state
   - Vector parameter state
   - Runtime parameter cache
   - Node motion state
   - Opacity state
   - Animation state
   - Motion debug state
   - Parameter source / owner
   - Gaze / Blink / LipSync / Expression state
   - Camera state
   - Performance state
   非担当:
   - 実際の描画
   - Runtime 初期化
   - モーション計算
   - Physics 計算
   - Pointer 処理
   - モデル読み込み
   目的:
   bridge.js に散らばっている大量の
   let / Map / Set を一か所へ集約する。
   ========================================================= */
const createMap = () => new Map();
const createSet = () => new Set();
const cloneObject = (value) => {
  if (
    value === null ||
    value === undefined
  ) {
    return value;
  }
  if (
    typeof value !== 'object'
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return [...value];
  }
  return {
    ...value,
  };
};
const cloneMap = (map) =>
  Object.fromEntries(
    map.entries(),
  );
const cloneSet = (set) =>
  [...set];
export function createInochiState({
  canvas = null,
} = {}) {
  /* -------------------------------------------------------
     Runtime / Model
     ------------------------------------------------------- */
  let runtime = null;
  let modelBytes = null;
  let puppetPayload = null;
  let motionPayload = null;
  let modelLoaded = false;
  let runtimeInitialized = false;
  /* -------------------------------------------------------
     Parameter
     ------------------------------------------------------- */
  const parameterById =
    createMap();
  const parameterByUuid =
    createMap();
  const parameterValues =
    createMap();
  const vectorParameterValues =
    createMap();
  const lastRuntimeParameterValues =
    createMap();
  const parameterHandleById =
    createMap();
  const unresolvedParameterHandleIds =
    createSet();
  const parameterSourceById =
    createMap();
  const parameterOwnerById =
    createMap();
  /* -------------------------------------------------------
     Node
     ------------------------------------------------------- */
  const nodeHandleByName =
    createMap();
  const nodeMotionOffsets =
    createMap();
  const secondaryNodeMotionOffsets =
    createMap();
  const appliedNodeMotionOffsets =
    createMap();
  /* -------------------------------------------------------
     Opacity
     ------------------------------------------------------- */
  const partOpacityValues =
    createMap();
  /* -------------------------------------------------------
     Animation
     ------------------------------------------------------- */
  let activeAnimation = null;
  let activeAnimationParameterIds =
    createSet();
  let animationLibrary =
    createMap();
  let idleAnimationNames = [];
  let idleAnimationProfiles =
    createMap();
  let idleAnimationQueue = [];
  let lastIdleAnimationName =
    null;
  let lastRareIdleGestureTimestampMs =
    0;
  let reactionAnimationGroups =
    createMap();
  let emotionAnimationGroups =
    createMap();
  let lastReactionAnimationName =
    null;
  let lastEmotionAnimationName =
    null;
  let lastReactionTimestampMs = 0;
  let lastEmotionTimestampMs = 0;
  /* -------------------------------------------------------
     Motion Debug
     ------------------------------------------------------- */
  let motionLayerDebugState = {
    activeLayers: [],
    touchedParameterIds: [],
    parameterSources: {},
    parameterOwners: {},
    transition: null,
    lastReset: null,
  };
  let motionDebugHistory = [];
  const MAX_MOTION_DEBUG_HISTORY = 100;
  /* -------------------------------------------------------
     Lip Sync
     ------------------------------------------------------- */
  let lipSyncLayer = {
    targetOpen: 0,
    currentOpen: 0,
    viseme: 'neutral',
    active: false,
    pose: [1, 0],
  };
  /* -------------------------------------------------------
     Eye Blink
     ------------------------------------------------------- */
  let blinkLayer = {
    mode: 'auto',
    left: 0,
    right: 0,
    targetLeft: 0,
    targetRight: 0,
    activeParameterIds: [],
  };
  /* -------------------------------------------------------
     Gaze
     ------------------------------------------------------- */
  let gazeLayer = {
    mode: 'auto',
    x: 0,
    y: 0,
    activeParameterIds: [],
  };
  /* -------------------------------------------------------
     Expression
     ------------------------------------------------------- */
  let expressionLayers =
    createMap();
  let expressionPresets =
    createMap();
  /* -------------------------------------------------------
     Secondary Motion
     ------------------------------------------------------- */
  let secondaryMotionDriver = {
    active: false,
    deltaX: 0,
    deltaY: 0,
  };
  let speechSecondaryMotionDriver = {
    active: false,
    deltaX: 0,
    deltaY: 0,
    impulseX: 0,
    impulseY: 0,
  };
  /* -------------------------------------------------------
     Camera
     ------------------------------------------------------- */
  let cameraTransform = {
    x: 0,
    y: 0,
    scale: 1,
  };
  let cameraMotionOffset = {
    x: 0,
    y: 0,
  };
  /* -------------------------------------------------------
     Canvas / Resize
     ------------------------------------------------------- */
  let width = 0;
  let height = 0;
  let devicePixelRatio = 1;
  /* -------------------------------------------------------
     Performance
     ------------------------------------------------------- */
  let performanceProfiler = {
    enabled: false,
    frameCount: 0,
    lastFrameTimestamp: 0,
    sections: {
      runtime: 0,
      parameters: 0,
      animation: 0,
      secondaryMotion: 0,
      camera: 0,
      render: 0,
      total: 0,
    },
  };
  /* -------------------------------------------------------
     Loop
     ------------------------------------------------------- */
  let loopRunning = false;
  let loopRequested = false;
  let lastFrameTimestamp = 0;
  /* -------------------------------------------------------
     Internal helpers
     ------------------------------------------------------- */
  const pushMotionDebugHistory = (
    entry,
  ) => {
    if (!entry) {
      return;
    }
    motionDebugHistory.push({
      timestamp:
        typeof performance !==
          'undefined'
          ? performance.now()
          : Date.now(),
      ...entry,
    });
    if (
      motionDebugHistory.length >
      MAX_MOTION_DEBUG_HISTORY
    ) {
      motionDebugHistory =
        motionDebugHistory.slice(
          -MAX_MOTION_DEBUG_HISTORY,
        );
    }
  };
  const clearMotionDebugHistory =
    () => {
      motionDebugHistory = [];
    };
  /* -------------------------------------------------------
     Parameter helpers
     ------------------------------------------------------- */
  const clearParameterState = () => {
    parameterById.clear();
    parameterByUuid.clear();
    parameterValues.clear();
    vectorParameterValues.clear();
    lastRuntimeParameterValues.clear();
    parameterHandleById.clear();
    unresolvedParameterHandleIds.clear();
    parameterSourceById.clear();
    parameterOwnerById.clear();
  };
  const clearNodeState = () => {
    nodeHandleByName.clear();
    nodeMotionOffsets.clear();
    secondaryNodeMotionOffsets.clear();
    appliedNodeMotionOffsets.clear();
  };
  const clearAnimationState = () => {
    activeAnimation = null;
    activeAnimationParameterIds =
      new Set();
    animationLibrary.clear();
    idleAnimationNames = [];
    idleAnimationProfiles =
      new Map();
    idleAnimationQueue = [];
    lastIdleAnimationName = null;
    lastRareIdleGestureTimestampMs =
      0;
    reactionAnimationGroups =
      new Map();
    emotionAnimationGroups =
      new Map();
    lastReactionAnimationName =
      null;
    lastEmotionAnimationName =
      null;
    lastReactionTimestampMs = 0;
    lastEmotionTimestampMs = 0;
  };
  const clearLayerState = () => {
    lipSyncLayer = {
      targetOpen: 0,
      currentOpen: 0,
      viseme: 'neutral',
      active: false,
      pose: [1, 0],
    };
    blinkLayer = {
      mode: 'auto',
      left: 0,
      right: 0,
      targetLeft: 0,
      targetRight: 0,
      activeParameterIds: [],
    };
    gazeLayer = {
      mode: 'auto',
      x: 0,
      y: 0,
      activeParameterIds: [],
    };
    expressionLayers.clear();
    expressionPresets.clear();
  };
  const clearMotionState = () => {
    secondaryMotionDriver = {
      active: false,
      deltaX: 0,
      deltaY: 0,
    };
    speechSecondaryMotionDriver = {
      active: false,
      deltaX: 0,
      deltaY: 0,
      impulseX: 0,
      impulseY: 0,
    };
    nodeMotionOffsets.clear();
    secondaryNodeMotionOffsets.clear();
    appliedNodeMotionOffsets.clear();
    motionLayerDebugState = {
      activeLayers: [],
      touchedParameterIds: [],
      parameterSources: {},
      parameterOwners: {},
      transition: null,
      lastReset: null,
    };
    clearMotionDebugHistory();
  };
  const resetCameraState = () => {
    cameraTransform = {
      x: 0,
      y: 0,
      scale: 1,
    };
    cameraMotionOffset = {
      x: 0,
      y: 0,
    };
  };
  const resetLoopState = () => {
    loopRunning = false;
    loopRequested = false;
    lastFrameTimestamp = 0;
  };
  /* -------------------------------------------------------
     Complete reset
     ------------------------------------------------------- */
  const reset = ({
    keepCanvas = true,
  } = {}) => {
    runtime = null;
    modelBytes = null;
    puppetPayload = null;
    motionPayload = null;
    modelLoaded = false;
    runtimeInitialized = false;
    clearParameterState();
    clearNodeState();
    partOpacityValues.clear();
    clearAnimationState();
    clearLayerState();
    clearMotionState();
    resetCameraState();
    width = 0;
    height = 0;
    devicePixelRatio = 1;
    performanceProfiler = {
      enabled: false,
      frameCount: 0,
      lastFrameTimestamp: 0,
      sections: {
        runtime: 0,
        parameters: 0,
        animation: 0,
        secondaryMotion: 0,
        camera: 0,
        render: 0,
        total: 0,
      },
    };
    resetLoopState();
    if (!keepCanvas && canvas) {
      canvas.dataset = {};
    }
  };
  /* -------------------------------------------------------
     Runtime
     ------------------------------------------------------- */
  const setRuntime = (
    nextRuntime,
  ) => {
    runtime =
      nextRuntime ?? null;
    runtimeInitialized =
      !!nextRuntime;
  };
  const setModelPayload = ({
    bytes = null,
    puppet = null,
    motion = null,
  } = {}) => {
    modelBytes = bytes;
    puppetPayload = puppet;
    motionPayload = motion;
    modelLoaded =
      puppet !== null &&
      puppet !== undefined;
  };
  /* -------------------------------------------------------
     State snapshot
     ------------------------------------------------------- */
  const getState = () => ({
    runtime,
    modelLoaded,
    runtimeInitialized,
    puppetPayload,
    motionPayload,
    parameterById:
      cloneMap(parameterById),
    parameterByUuid:
      cloneMap(parameterByUuid),
    parameterValues:
      cloneMap(parameterValues),
    vectorParameterValues:
      cloneMap(vectorParameterValues),
    lastRuntimeParameterValues:
      cloneMap(
        lastRuntimeParameterValues,
      ),
    parameterHandleById:
      cloneMap(parameterHandleById),
    unresolvedParameterHandleIds:
      cloneSet(
        unresolvedParameterHandleIds,
      ),
    parameterSourceById:
      cloneMap(parameterSourceById),
    parameterOwnerById:
      cloneMap(parameterOwnerById),
    nodeHandleByName:
      cloneMap(nodeHandleByName),
    nodeMotionOffsets:
      cloneMap(nodeMotionOffsets),
    secondaryNodeMotionOffsets:
      cloneMap(
        secondaryNodeMotionOffsets,
      ),
    appliedNodeMotionOffsets:
      cloneMap(
        appliedNodeMotionOffsets,
      ),
    partOpacityValues:
      cloneMap(partOpacityValues),
    activeAnimation:
      activeAnimation
        ? cloneObject(
            activeAnimation,
          )
        : null,
    activeAnimationParameterIds:
      cloneSet(
        activeAnimationParameterIds,
      ),
    animationLibrary:
      cloneMap(animationLibrary),
    idleAnimationNames: [
      ...idleAnimationNames,
    ],
    idleAnimationProfiles:
      cloneMap(
        idleAnimationProfiles,
      ),
    idleAnimationQueue:
      idleAnimationQueue.map(
        cloneObject,
      ),
    lastIdleAnimationName,
    lastRareIdleGestureTimestampMs,
    reactionAnimationGroups:
      cloneMap(
        reactionAnimationGroups,
      ),
    emotionAnimationGroups:
      cloneMap(
        emotionAnimationGroups,
      ),
    lastReactionAnimationName,
    lastEmotionAnimationName,
    lastReactionTimestampMs,
    lastEmotionTimestampMs,
    motionLayerDebugState:
      cloneObject(
        motionLayerDebugState,
      ),
    motionDebugHistory:
      motionDebugHistory.map(
        cloneObject,
      ),
    lipSyncLayer:
      cloneObject(
        lipSyncLayer,
      ),
    blinkLayer:
      cloneObject(
        blinkLayer,
      ),
    gazeLayer:
      cloneObject(
        gazeLayer,
      ),
    expressionLayers:
      cloneMap(
        expressionLayers,
      ),
    expressionPresets:
      cloneMap(
        expressionPresets,
      ),
    secondaryMotionDriver:
      cloneObject(
        secondaryMotionDriver,
      ),
    speechSecondaryMotionDriver:
      cloneObject(
        speechSecondaryMotionDriver,
      ),
    cameraTransform:
      cloneObject(
        cameraTransform,
      ),
    cameraMotionOffset:
      cloneObject(
        cameraMotionOffset,
      ),
    width,
    height,
    devicePixelRatio,
    performanceProfiler:
      cloneObject(
        performanceProfiler,
      ),
    loopRunning,
    loopRequested,
    lastFrameTimestamp,
  });
  /* -------------------------------------------------------
     Public state object
     ------------------------------------------------------- */
  return {
    /*
     * Runtime
     */
    getRuntime: () =>
      runtime,
    setRuntime,
    getModelBytes: () =>
      modelBytes,
    getPuppetPayload: () =>
      puppetPayload,
    getMotionPayload: () =>
      motionPayload,
    setModelPayload,
    isModelLoaded: () =>
      modelLoaded,
    isRuntimeInitialized: () =>
      runtimeInitialized,
    /*
     * Parameter
     */
    parameterById,
    parameterByUuid,
    parameterValues,
    vectorParameterValues,
    lastRuntimeParameterValues,
    parameterHandleById,
    unresolvedParameterHandleIds,
    parameterSourceById,
    parameterOwnerById,
    clearParameterState,
    /*
     * Node
     */
    nodeHandleByName,
    nodeMotionOffsets,
    secondaryNodeMotionOffsets,
    appliedNodeMotionOffsets,
    clearNodeState,
    /*
     * Opacity
     */
    partOpacityValues,
    /*
     * Animation
     */
    get activeAnimation() {
      return activeAnimation;
    },
    set activeAnimation(value) {
      activeAnimation = value;
    },
    get activeAnimationParameterIds() {
      return activeAnimationParameterIds;
    },
    set activeAnimationParameterIds(
      value,
    ) {
      activeAnimationParameterIds =
        value instanceof Set
          ? value
          : new Set(value ?? []);
    },
    animationLibrary,
    get idleAnimationNames() {
      return idleAnimationNames;
    },
    set idleAnimationNames(
      value,
    ) {
      idleAnimationNames =
        Array.isArray(value)
          ? [...value]
          : [];
    },
    get idleAnimationProfiles() {
      return idleAnimationProfiles;
    },
    set idleAnimationProfiles(
      value,
    ) {
      idleAnimationProfiles =
        value instanceof Map
          ? value
          : new Map(
              Object.entries(
                value ?? {},
              ),
            );
    },
    get idleAnimationQueue() {
      return idleAnimationQueue;
    },
    set idleAnimationQueue(
      value,
    ) {
      idleAnimationQueue =
        Array.isArray(value)
          ? [...value]
          : [];
    },
    get lastIdleAnimationName() {
      return lastIdleAnimationName;
    },
    set lastIdleAnimationName(
      value,
    ) {
      lastIdleAnimationName =
        value;
    },
    get lastRareIdleGestureTimestampMs() {
      return lastRareIdleGestureTimestampMs;
    },
    set lastRareIdleGestureTimestampMs(
      value,
    ) {
      lastRareIdleGestureTimestampMs =
        Number.isFinite(value)
          ? value
          : 0;
    },
    reactionAnimationGroups,
    emotionAnimationGroups,
    get lastReactionAnimationName() {
      return lastReactionAnimationName;
    },
    set lastReactionAnimationName(
      value,
    ) {
      lastReactionAnimationName =
        value;
    },
    get lastEmotionAnimationName() {
      return lastEmotionAnimationName;
    },
    set lastEmotionAnimationName(
      value,
    ) {
      lastEmotionAnimationName =
        value;
    },
    get lastReactionTimestampMs() {
      return lastReactionTimestampMs;
    },
    set lastReactionTimestampMs(
      value,
    ) {
      lastReactionTimestampMs =
        Number.isFinite(value)
          ? value
          : 0;
    },
    get lastEmotionTimestampMs() {
      return lastEmotionTimestampMs;
    },
    set lastEmotionTimestampMs(
      value,
    ) {
      lastEmotionTimestampMs =
        Number.isFinite(value)
          ? value
          : 0;
    },
    clearAnimationState,
    /*
     * Motion Debug
     */
    get motionLayerDebugState() {
      return motionLayerDebugState;
    },
    set motionLayerDebugState(
      value,
    ) {
      motionLayerDebugState =
        value ?? {};
    },
    get motionDebugHistory() {
      return motionDebugHistory;
    },
    pushMotionDebugHistory,
    clearMotionDebugHistory,
    /*
     * Lip Sync
     */
    get lipSyncLayer() {
      return lipSyncLayer;
    },
    set lipSyncLayer(value) {
      lipSyncLayer =
        value ?? {
          targetOpen: 0,
          currentOpen: 0,
          viseme: 'neutral',
          active: false,
          pose: [1, 0],
        };
    },
    /*
     * Blink
     */
    get blinkLayer() {
      return blinkLayer;
    },
    set blinkLayer(value) {
      blinkLayer =
        value ?? {
          mode: 'auto',
          left: 0,
          right: 0,
          targetLeft: 0,
          targetRight: 0,
          activeParameterIds: [],
        };
    },
    /*
     * Gaze
     */
    get gazeLayer() {
      return gazeLayer;
    },
    set gazeLayer(value) {
      gazeLayer =
        value ?? {
          mode: 'auto',
          x: 0,
          y: 0,
          activeParameterIds: [],
        };
    },
    /*
     * Expression
     */
    expressionLayers,
    expressionPresets,
    /*
     * Secondary Motion
     */
    get secondaryMotionDriver() {
      return secondaryMotionDriver;
    },
    set secondaryMotionDriver(
      value,
    ) {
      secondaryMotionDriver =
        value ?? {
          active: false,
          deltaX: 0,
          deltaY: 0,
        };
    },
    get speechSecondaryMotionDriver() {
      return speechSecondaryMotionDriver;
    },
    set speechSecondaryMotionDriver(
      value,
    ) {
      speechSecondaryMotionDriver =
        value ?? {
          active: false,
          deltaX: 0,
          deltaY: 0,
          impulseX: 0,
          impulseY: 0,
        };
    },
    clearMotionState,
    /*
     * Camera
     */
    get cameraTransform() {
      return cameraTransform;
    },
    set cameraTransform(value) {
      cameraTransform =
        value ?? {
          x: 0,
          y: 0,
          scale: 1,
        };
    },
    get cameraMotionOffset() {
      return cameraMotionOffset;
    },
    set cameraMotionOffset(value) {
      cameraMotionOffset =
        value ?? {
          x: 0,
          y: 0,
        };
    },
    resetCameraState,
    /*
     * Canvas
     */
    get width() {
      return width;
    },
    set width(value) {
      width =
        Number.isFinite(value)
          ? Math.max(1, value)
          : 0;
    },
    get height() {
      return height;
    },
    set height(value) {
      height =
        Number.isFinite(value)
          ? Math.max(1, value)
          : 0;
    },
    get devicePixelRatio() {
      return devicePixelRatio;
    },
    set devicePixelRatio(value) {
      devicePixelRatio =
        Number.isFinite(value)
          ? Math.max(1, value)
          : 1;
    },
    /*
     * Performance
     */
    get performanceProfiler() {
      return performanceProfiler;
    },
    set performanceProfiler(
      value,
    ) {
      performanceProfiler =
        value ?? {
          enabled: false,
          frameCount: 0,
          lastFrameTimestamp: 0,
          sections: {},
        };
    },
    /*
     * Loop
     */
    get loopRunning() {
      return loopRunning;
    },
    set loopRunning(value) {
      loopRunning = !!value;
    },
    get loopRequested() {
      return loopRequested;
    },
    set loopRequested(value) {
      loopRequested = !!value;
    },
    get lastFrameTimestamp() {
      return lastFrameTimestamp;
    },
    set lastFrameTimestamp(value) {
      lastFrameTimestamp =
        Number.isFinite(value)
          ? value
          : 0;
    },
    resetLoopState,
    /*
     * 全体
     */
    getState,
    reset,
  };
}
export default {
  createInochiState,
};

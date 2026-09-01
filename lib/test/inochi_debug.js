/* =========================================================
   Inochi2D Debug Module
   ---------------------------------------------------------
   デバッグ状態・Canvas dataset・モーション履歴・
   パフォーマンス情報などを担当。
   ========================================================= */

export function createInochiDebugController({
  canvas = null,
  debugEnabled = false,
  performanceProfiler = null,

  createMotionLayerDebugState,
  isVerboseDebugActive,
  getActiveLayerDebugEntries,

  getMotionLayerDebugState,
  setMotionLayerDebugState,

  getMotionDebugHistory,
  pushMotionDebugHistory,

  getPerformanceProfilerState,
  recordPerformanceFrame,
  recordFrameCadence,
  recordRuntimeProfileSummary,

  getParameterSourceById,
  getParameterOwnerById,
  getUnresolvedParameterHandleIds,

  getActiveAnimationParameterIds,
  getParameterValues,
  getVectorParameterValues,

  getCameraMotionOffset,
  getNodeMotionOffsets,
  getSecondaryNodeMotionOffsets,
  getAppliedNodeMotionOffsets,
  getPartOpacityValues,

  getSpeechSecondaryMotionDriver,
  getSecondaryMotionDriver,

  getSecondaryMotion,

  getIdleAnimationNames,
  getIdleAnimationProfiles,
  getLastRareIdleGestureTimestampMs,

  getReactionAnimationGroups,
  getEmotionAnimationGroups,

  getActiveAnimationSummary,
  getCameraTransform,
  getBlinkLayer,
  getGazeLayer,
  getLipSyncLayer,
  getExpressionLayer,

  getRuntime,
  getMounted,
  getWidth,
  getHeight,
  getDevicePixelRatio,

  setPerformanceProfilerEnabled,
}) {
  /*
   * -------------------------------------------------------
   * 内部ユーティリティ
   * -------------------------------------------------------
   */

  const safeObject = (value) =>
    value && typeof value === 'object'
      ? { ...value }
      : {};

  const safeArray = (value) =>
    Array.isArray(value)
      ? [...value]
      : [];

  const mapToObject = (value) => {
    if (!value || typeof value.entries !== 'function') {
      return {};
    }

    return Object.fromEntries(value.entries());
  };

  const getNow = () =>
    typeof performance !== 'undefined'
      ? performance.now()
      : Date.now();

  /*
   * -------------------------------------------------------
   * Canvas dataset
   * -------------------------------------------------------
   */

  const setDataset = (name, value) => {
    if (!canvas) {
      return;
    }

    canvas.dataset[name] = String(value);
  };

  const deleteDataset = (name) => {
    if (!canvas) {
      return;
    }

    delete canvas.dataset[name];
  };

  const clearVerboseDebugDataset = () => {
    if (!canvas) {
      return;
    }

    const keys = [
      'inochi2dActiveLayers',
      'inochi2dTouchedParameters',
      'inochi2dAnimationTouchedParameters',
      'inochi2dAnimationTouchedParameterIds',
      'inochi2dUnresolvedParameterHandles',
      'inochi2dParameterSources',
      'inochi2dParameterOwners',
      'inochi2dDebug',
      'inochi2dDebugHistory',
    ];

    for (const key of keys) {
      delete canvas.dataset[key];
    }
  };

  /*
   * -------------------------------------------------------
   * Frame cadence
   * -------------------------------------------------------
   */

  const resetFrameCadenceDataset = () => {
    deleteDataset('inochi2dFrameCount');
    deleteDataset('inochi2dLastFrameTs');
    deleteDataset('inochi2dPerfFrameMs');
    deleteDataset('inochi2dPerfDeltaMs');
    deleteDataset('inochi2dPerfParameterWrites');
    deleteDataset('inochi2dPerfParameterWriteSkips');
  };

  /*
   * -------------------------------------------------------
   * Motion debug history
   * -------------------------------------------------------
   */

  const getHistory = () =>
    safeArray(
      typeof getMotionDebugHistory === 'function'
        ? getMotionDebugHistory()
        : [],
    );

  const addHistory = (entry) => {
    if (typeof pushMotionDebugHistory === 'function') {
      pushMotionDebugHistory(entry);
    }
  };

  /*
   * -------------------------------------------------------
   * Parameter debug
   * -------------------------------------------------------
   */

  const buildParameterDebugState = () => ({
    activeParameterIds:
      safeArray(
        typeof getActiveAnimationParameterIds === 'function'
          ? getActiveAnimationParameterIds()
          : [],
      ),

    scalarParameterValues:
      mapToObject(
        typeof getParameterValues === 'function'
          ? getParameterValues()
          : null,
      ),

    vectorParameterValues:
      mapToObject(
        typeof getVectorParameterValues === 'function'
          ? getVectorParameterValues()
          : null,
      ),

    parameterSources:
      mapToObject(
        typeof getParameterSourceById === 'function'
          ? getParameterSourceById()
          : null,
      ),

    parameterOwners:
      mapToObject(
        typeof getParameterOwnerById === 'function'
          ? getParameterOwnerById()
          : null,
      ),

    unresolvedParameterHandles:
      safeArray(
        typeof getUnresolvedParameterHandleIds === 'function'
          ? getUnresolvedParameterHandleIds()
          : [],
      ),
  });

  /*
   * -------------------------------------------------------
   * Motion debug
   * -------------------------------------------------------
   */

  const buildMotionDebugState = () => {
    const motionLayer =
      typeof getMotionLayerDebugState === 'function'
        ? getMotionLayerDebugState()
        : createMotionLayerDebugState?.() ?? {};

    return {
      ...motionLayer,

      activeLayers: safeArray(
        motionLayer.activeLayers,
      ),

      touchedParameterIds: safeArray(
        motionLayer.touchedParameterIds,
      ),

      parameterSources: safeObject(
        motionLayer.parameterSources,
      ),

      parameterOwners: safeObject(
        motionLayer.parameterOwners,
      ),

      history: getHistory(),
    };
  };

  /*
   * -------------------------------------------------------
   * Secondary motion debug
   * -------------------------------------------------------
   */

  const getSecondaryMotionState = (name) => {
    const secondaryMotion =
      typeof getSecondaryMotion === 'function'
        ? getSecondaryMotion()
        : null;

    if (
      !secondaryMotion ||
      typeof secondaryMotion.getState !== 'function'
    ) {
      return null;
    }

    try {
      return secondaryMotion.getState(name);
    } catch {
      return null;
    }
  };

  const buildSecondaryMotionDebugState = () => ({
    physics: getSecondaryMotionState('physics'),
    hair: getSecondaryMotionState('hair'),
    hairFront: getSecondaryMotionState('hairFront'),
    hairSideLeft: getSecondaryMotionState('hairSideLeft'),
    hairSideRight: getSecondaryMotionState('hairSideRight'),
    hairBackLeft: getSecondaryMotionState('hairBackLeft'),
    hairBackRight: getSecondaryMotionState('hairBackRight'),
    cloth: getSecondaryMotionState('cloth'),
    hip: getSecondaryMotionState('hip'),
    leg: getSecondaryMotionState('leg'),
    foot: getSecondaryMotionState('foot'),
    accessory: getSecondaryMotionState('accessory'),
    tail: getSecondaryMotionState('tail'),

    driver:
      typeof getSecondaryMotionDriver === 'function'
        ? getSecondaryMotionDriver()
        : null,
  });

  /*
   * -------------------------------------------------------
   * Animation debug
   * -------------------------------------------------------
   */

  const buildAnimationDebugState = () => ({
    activeAnimation:
      typeof getActiveAnimationSummary === 'function'
        ? getActiveAnimationSummary()
        : null,

    idleAnimationNames:
      safeArray(
        typeof getIdleAnimationNames === 'function'
          ? getIdleAnimationNames()
          : [],
      ),

    idleAnimationProfiles:
      mapToObject(
        typeof getIdleAnimationProfiles === 'function'
          ? getIdleAnimationProfiles()
          : null,
      ),

    lastRareIdleGestureTimestampMs:
      typeof getLastRareIdleGestureTimestampMs === 'function'
        ? getLastRareIdleGestureTimestampMs()
        : 0,

    reactionAnimationGroups:
      mapToObject(
        typeof getReactionAnimationGroups === 'function'
          ? getReactionAnimationGroups()
          : null,
      ),

    emotionAnimationGroups:
      mapToObject(
        typeof getEmotionAnimationGroups === 'function'
          ? getEmotionAnimationGroups()
          : null,
      ),
  });

  /*
   * -------------------------------------------------------
   * Layer debug
   * -------------------------------------------------------
   */

  const buildLayerDebugState = () => ({
    blinkLayer:
      safeObject(
        typeof getBlinkLayer === 'function'
          ? getBlinkLayer()
          : null,
      ),

    gazeLayer:
      safeObject(
        typeof getGazeLayer === 'function'
          ? getGazeLayer()
          : null,
      ),

    lipSyncLayer:
      safeObject(
        typeof getLipSyncLayer === 'function'
          ? getLipSyncLayer()
          : null,
      ),

    expressionLayer:
      safeObject(
        typeof getExpressionLayer === 'function'
          ? getExpressionLayer()
          : null,
      ),

    speechSecondaryMotionDriver:
      safeObject(
        typeof getSpeechSecondaryMotionDriver === 'function'
          ? getSpeechSecondaryMotionDriver()
          : null,
      ),
  });

  /*
   * -------------------------------------------------------
   * Camera / node / opacity debug
   * -------------------------------------------------------
   */

  const buildTransformDebugState = () => ({
    cameraTransform:
      safeObject(
        typeof getCameraTransform === 'function'
          ? getCameraTransform()
          : null,
      ),

    cameraMotionOffset:
      safeObject(
        typeof getCameraMotionOffset === 'function'
          ? getCameraMotionOffset()
          : null,
      ),

    nodeMotionOffsets:
      mapToObject(
        typeof getNodeMotionOffsets === 'function'
          ? getNodeMotionOffsets()
          : null,
      ),

    secondaryNodeMotionOffsets:
      mapToObject(
        typeof getSecondaryNodeMotionOffsets === 'function'
          ? getSecondaryNodeMotionOffsets()
          : null,
      ),

    appliedNodeMotionOffsets:
      mapToObject(
        typeof getAppliedNodeMotionOffsets === 'function'
          ? getAppliedNodeMotionOffsets()
          : null,
      ),

    partOpacityValues:
      mapToObject(
        typeof getPartOpacityValues === 'function'
          ? getPartOpacityValues()
          : null,
      ),
  });

  /*
   * -------------------------------------------------------
   * Canvas dataset debug
   * -------------------------------------------------------
   */

  const getCanvasDataset = () =>
    canvas
      ? { ...canvas.dataset }
      : {};

  /*
   * -------------------------------------------------------
   * Base debug state
   * -------------------------------------------------------
   */

  const getBaseDebugState = () => ({
    debugEnabled,

    profilerEnabled:
      Boolean(
        typeof getPerformanceProfilerState === 'function'
          ? getPerformanceProfilerState()?.enabled
          : performanceProfiler?.enabled,
      ),

    mounted:
      Boolean(
        typeof getMounted === 'function'
          ? getMounted()
          : false,
      ),

    hasRuntime:
      Boolean(
        typeof getRuntime === 'function'
          ? getRuntime()
          : null,
      ),

    canvasSize: {
      width:
        typeof getWidth === 'function'
          ? getWidth()
          : 0,

      height:
        typeof getHeight === 'function'
          ? getHeight()
          : 0,

      devicePixelRatio:
        typeof getDevicePixelRatio === 'function'
          ? getDevicePixelRatio()
          : 1,
    },

    ...buildAnimationDebugState(),
    ...buildLayerDebugState(),

    ...buildTransformDebugState(),

    performanceProfiler:
      typeof getPerformanceProfilerState === 'function'
        ? {
            ...getPerformanceProfilerState(),
            sections: {
              ...(getPerformanceProfilerState()?.sections ?? {}),
            },
          }
        : {
            ...(performanceProfiler ?? {}),
          },

    canvasDataset: getCanvasDataset(),
  });

  /*
   * -------------------------------------------------------
   * Full verbose debug state
   * -------------------------------------------------------
   */

  const getDebugState = () => {
    const baseDebugState = getBaseDebugState();

    if (
      typeof isVerboseDebugActive === 'function' &&
      !isVerboseDebugActive()
    ) {
      return baseDebugState;
    }

    const parameterDebug =
      buildParameterDebugState();

    const transformDebug =
      buildTransformDebugState();

    const motionDebug =
      buildMotionDebugState();

    const performanceState =
      typeof getPerformanceProfilerState === 'function'
        ? getPerformanceProfilerState()
        : performanceProfiler ?? {};

    const runtime =
      typeof getRuntime === 'function'
        ? getRuntime()
        : null;

    return {
      ...baseDebugState,

      activeAnimationParameterIds:
        parameterDebug.activeParameterIds,

      scalarParameterValues:
        parameterDebug.scalarParameterValues,

      vectorParameterValues:
        parameterDebug.vectorParameterValues,

      cameraMotionOffset:
        transformDebug.cameraMotionOffset,

      nodeMotionOffsets:
        transformDebug.nodeMotionOffsets,

      secondaryNodeMotionOffsets:
        transformDebug.secondaryNodeMotionOffsets,

      appliedNodeMotionOffsets:
        transformDebug.appliedNodeMotionOffsets,

      partOpacityValues:
        transformDebug.partOpacityValues,

      speechSecondaryMotionDriver:
        typeof getSpeechSecondaryMotionDriver === 'function'
          ? safeObject(
              getSpeechSecondaryMotionDriver(),
            )
          : {},

      motionLayers: motionDebug,

      performanceProfiler: {
        ...performanceState,
        sections: {
          ...(performanceState.sections ?? {}),
        },
      },

      frameSnapshot:
        typeof runtime?.get_frame_snapshot_summary ===
          'function'
          ? runtime.get_frame_snapshot_summary()
          : null,

      secondaryMotion:
        buildSecondaryMotionDebugState(),

      idleAnimationNames:
        safeArray(
          typeof getIdleAnimationNames === 'function'
            ? getIdleAnimationNames()
            : [],
        ),

      idleAnimationProfiles:
        mapToObject(
          typeof getIdleAnimationProfiles === 'function'
            ? getIdleAnimationProfiles()
            : null,
        ),

      lastRareIdleGestureTimestampMs:
        typeof getLastRareIdleGestureTimestampMs === 'function'
          ? getLastRareIdleGestureTimestampMs()
          : 0,

      reactionAnimationGroups:
        mapToObject(
          typeof getReactionAnimationGroups === 'function'
            ? getReactionAnimationGroups()
            : null,
        ),

      emotionAnimationGroups:
        mapToObject(
          typeof getEmotionAnimationGroups === 'function'
            ? getEmotionAnimationGroups()
            : null,
        ),

      unresolvedParameterHandleIds:
        parameterDebug.unresolvedParameterHandles,

      parameterSources:
        parameterDebug.parameterSources,

      parameterOwners:
        parameterDebug.parameterOwners,

      canvasDataset:
        getCanvasDataset(),
    };
  };

  /*
   * -------------------------------------------------------
   * Verbose dataset 更新
   * -------------------------------------------------------
   */

  const updateVerboseDebugDataset = () => {
    if (!canvas) {
      return;
    }

    if (
      typeof isVerboseDebugActive === 'function' &&
      !isVerboseDebugActive()
    ) {
      clearVerboseDebugDataset();
      return;
    }

    const activeLayers =
      typeof getActiveLayerDebugEntries === 'function'
        ? getActiveLayerDebugEntries()
        : [];

    const motionState =
      typeof getMotionLayerDebugState === 'function'
        ? getMotionLayerDebugState()
        : {};

    const sourceMap =
      typeof getParameterSourceById === 'function'
        ? getParameterSourceById()
        : null;

    const ownerMap =
      typeof getParameterOwnerById === 'function'
        ? getParameterOwnerById()
        : null;

    const unresolved =
      typeof getUnresolvedParameterHandleIds === 'function'
        ? getUnresolvedParameterHandleIds()
        : [];

    setDataset(
      'inochi2dActiveLayers',
      activeLayers.length,
    );

    setDataset(
      'inochi2dTouchedParameters',
      safeArray(
        motionState.touchedParameterIds,
      ).length,
    );

    setDataset(
      'inochi2dAnimationTouchedParameterIds',
      safeArray(
        motionState.touchedParameterIds,
      ).join(','),
    );

    setDataset(
      'inochi2dUnresolvedParameterHandles',
      safeArray(unresolved).join(','),
    );

    setDataset(
      'inochi2dParameterSources',
      JSON.stringify(
        mapToObject(sourceMap),
      ),
    );

    setDataset(
      'inochi2dParameterOwners',
      JSON.stringify(
        mapToObject(ownerMap),
      ),
    );
  };

  /*
   * -------------------------------------------------------
   * Frame debug
   * -------------------------------------------------------
   */

  const recordFrame = ({
    frameMs = null,
    deltaMs = null,
    parameterWrites = null,
    parameterWriteSkips = null,
  } = {}) => {
    if (typeof recordPerformanceFrame === 'function') {
      const safeFrameMs =
        Number.isFinite(frameMs)
          ? frameMs
          : 0;

      const safeDeltaMs =
        Number.isFinite(deltaMs)
          ? deltaMs
          : 0;

      recordPerformanceFrame(
        safeFrameMs,
        safeDeltaMs,
      );
    }

    if (Number.isFinite(frameMs)) {
      setDataset(
        'inochi2dPerfFrameMs',
        frameMs.toFixed(3),
      );
    }

    if (Number.isFinite(deltaMs)) {
      setDataset(
        'inochi2dPerfDeltaMs',
        deltaMs.toFixed(3),
      );
    }

    if (Number.isFinite(parameterWrites)) {
      setDataset(
        'inochi2dPerfParameterWrites',
        parameterWrites,
      );
    }

    if (Number.isFinite(parameterWriteSkips)) {
      setDataset(
        'inochi2dPerfParameterWriteSkips',
        parameterWriteSkips,
      );
    }
  };

  /*
   * -------------------------------------------------------
   * Tick debug
   * -------------------------------------------------------
   */

  const recordTick = (timestamp) => {
    if (typeof recordFrameCadence === 'function') {
      recordFrameCadence(timestamp);
    }

    setDataset(
      'inochi2dLastFrameTs',
      Number.isFinite(timestamp)
        ? timestamp.toFixed(3)
        : getNow().toFixed(3),
    );

    const currentCount = Number.parseInt(
      canvas?.dataset?.inochi2dFrameCount ?? '0',
      10,
    );

    setDataset(
      'inochi2dFrameCount',
      Number.isFinite(currentCount)
        ? currentCount + 1
        : 1,
    );
  };

  /*
   * -------------------------------------------------------
   * Runtime profile
   * -------------------------------------------------------
   */

  const recordRuntimeProfile = () => {
    if (
      typeof recordRuntimeProfileSummary ===
      'function'
    ) {
      recordRuntimeProfileSummary();
    }
  };

  /*
   * -------------------------------------------------------
   * Motion event helpers
   * -------------------------------------------------------
   */

  const recordAnimationSwitch = (data = {}) => {
    addHistory({
      type: 'switch',
      timestamp:
        Number.isFinite(data.timestamp)
          ? data.timestamp
          : getNow(),
      ...data,
    });
  };

  const recordAnimationComplete = (data = {}) => {
    addHistory({
      type: 'complete',
      timestamp:
        Number.isFinite(data.timestamp)
          ? data.timestamp
          : getNow(),
      ...data,
    });
  };

  const recordAnimationStop = (data = {}) => {
    addHistory({
      type: 'stop',
      timestamp:
        Number.isFinite(data.timestamp)
          ? data.timestamp
          : getNow(),
      ...data,
    });
  };

  /*
   * -------------------------------------------------------
   * Performance profiler
   * -------------------------------------------------------
   */

  const setProfilerEnabled = async (enabled) => {
    if (
      typeof setPerformanceProfilerEnabled ===
      'function'
    ) {
      await setPerformanceProfilerEnabled(
        Boolean(enabled),
      );
    }

    setDataset(
      'inochi2dProfiler',
      enabled ? 'enabled' : 'disabled',
    );
  };

  /*
   * -------------------------------------------------------
   * Debug reset
   * -------------------------------------------------------
   */

  const reset = () => {
    clearVerboseDebugDataset();
    resetFrameCadenceDataset();

    if (canvas) {
      delete canvas.dataset.inochi2dDebug;
      delete canvas.dataset.inochi2dDebugHistory;
    }
  };

  /*
   * -------------------------------------------------------
   * Public API
   * -------------------------------------------------------
   */

  return {
    getDebugState,

    updateVerboseDebugDataset,

    recordFrame,
    recordTick,
    recordRuntimeProfile,

    recordAnimationSwitch,
    recordAnimationComplete,
    recordAnimationStop,

    setProfilerEnabled,

    reset,

    clearVerboseDebugDataset,
    resetFrameCadenceDataset,

    setDataset,
    deleteDataset,

    getCanvasDataset,
  };
}

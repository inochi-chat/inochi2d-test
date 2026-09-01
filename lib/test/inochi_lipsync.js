/* =========================================================
   Inochi2D Lip Sync Module
   ---------------------------------------------------------
   口パク関連だけを担当。
   本体側から後で完全に切り離しやすい構成にする。
   ========================================================= */
export function createLipSyncController({
  runtime,
  canvas,
  parameterById,
  setParameterVectorValue,
  markParameterSource,
  ensureLoop,
  mouthParameterId = 'Mouth:: Shape',
  mouthVisemePoses = {
    neutral: [1, 0],
    a: [0.5, 1],
    i: [1, 0.25],
    u: [0, 0.45],
    e: [0.75, 0.55],
    o: [0, 0.85],
  },
  attackMs = 45,
  releaseMs = 110,
  closeEpsilon = 0.001,
}) {
  let lipSyncLayer = {
    targetOpen: 0,
    currentOpen: 0,
    viseme: 'neutral',
    active: false,
    pose: [...mouthVisemePoses.neutral],
  };
  const clamp01 = (value) =>
    Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const getVisemePose = (viseme) =>
    mouthVisemePoses[viseme] ??
    mouthVisemePoses.a ??
    mouthVisemePoses.neutral;
  const resolveLipSyncPose = (openAmount, viseme) => {
    const open = clamp01(openAmount);
    const restPose = mouthVisemePoses.neutral;
    const targetPose = getVisemePose(viseme);
    return [
      restPose[0] + (targetPose[0] - restPose[0]) * open,
      restPose[1] + (targetPose[1] - restPose[1]) * open,
    ];
  };
  const setLipSyncLayerValue = (value, options = {}) => {
    const nextOpen = clamp01(value);
    const nextViseme =
      typeof options.viseme === 'string' &&
      Object.prototype.hasOwnProperty.call(
        mouthVisemePoses,
        options.viseme,
      )
        ? options.viseme
        : lipSyncLayer.viseme;
    lipSyncLayer = {
      ...lipSyncLayer,
      targetOpen: nextOpen,
      currentOpen:
        options.immediate
          ? nextOpen
          : lipSyncLayer.currentOpen,
      viseme:
        nextOpen > closeEpsilon
          ? nextViseme
          : 'neutral',
      active:
        nextOpen > closeEpsilon ||
        !options.immediate,
    };
    if (options.immediate) {
      lipSyncLayer.pose = resolveLipSyncPose(
        lipSyncLayer.currentOpen,
        lipSyncLayer.viseme,
      );
      if (
        runtime &&
        parameterById.has(mouthParameterId)
      ) {
        markParameterSource(
          mouthParameterId,
          `lip-sync:${lipSyncLayer.viseme}`,
        );
        setParameterVectorValue(
          mouthParameterId,
          lipSyncLayer.pose[0],
          lipSyncLayer.pose[1],
        );
      }
      updateCanvasDebug();
    }
    ensureLoop();
  };
  const applyLipSyncLayer = (deltaTimeMs) => {
    if (
      !runtime ||
      !parameterById.has(mouthParameterId)
    ) {
      return;
    }
    const targetOpen =
      clamp01(lipSyncLayer.targetOpen);
    const currentOpen =
      clamp01(lipSyncLayer.currentOpen);
    const smoothingMs =
      targetOpen > currentOpen
        ? attackMs
        : releaseMs;
    const mix =
      smoothingMs <= 0
        ? 1
        : Math.min(
            1,
            Math.max(
              0,
              deltaTimeMs / smoothingMs,
            ),
          );
    const nextOpen =
      currentOpen +
      (targetOpen - currentOpen) * mix;
    const shouldRemainActive =
      targetOpen > closeEpsilon ||
      nextOpen > closeEpsilon;
    const finalOpen =
      shouldRemainActive
        ? nextOpen
        : 0;
    const finalViseme =
      finalOpen > closeEpsilon
        ? lipSyncLayer.viseme
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
      currentOpen: finalOpen,
      viseme: finalViseme,
      active: shouldRemainActive,
      pose,
    };
    markParameterSource(
      mouthParameterId,
      `lip-sync:${finalViseme}`,
    );
    setParameterVectorValue(
      mouthParameterId,
      pose[0],
      pose[1],
    );
    updateCanvasDebug();
  };
  const forceNeutralAfterRuntime = () => {
    if (
      !parameterById.has(mouthParameterId) ||
      lipSyncLayer.currentOpen > closeEpsilon
    ) {
      return;
    }
    const neutralPose =
      mouthVisemePoses.neutral;
    markParameterSource(
      mouthParameterId,
      'lip-sync:post-runtime-neutral',
    );
    setParameterVectorValue(
      mouthParameterId,
      neutralPose[0],
      neutralPose[1],
    );
    if (canvas) {
      canvas.dataset.inochi2dMouthShape =
        `${neutralPose[0].toFixed(3)},${neutralPose[1].toFixed(3)}`;
    }
  };
  const updateCanvasDebug = () => {
    if (!canvas) {
      return;
    }
    canvas.dataset.inochi2dMouthShape =
      `${lipSyncLayer.pose[0].toFixed(3)},${lipSyncLayer.pose[1].toFixed(3)}`;
    canvas.dataset.inochi2dLipSyncLayer =
      lipSyncLayer.active
        ? lipSyncLayer.viseme
        : 'idle';
  };
  const getState = () => ({
    ...lipSyncLayer,
    pose: [...lipSyncLayer.pose],
  });
  const reset = () => {
    lipSyncLayer = {
      targetOpen: 0,
      currentOpen: 0,
      viseme: 'neutral',
      active: false,
      pose: [...mouthVisemePoses.neutral],
    };
    updateCanvasDebug();
  };
  return {
    setValue: setLipSyncLayerValue,
    apply: applyLipSyncLayer,
    forceNeutralAfterRuntime,
    getState,
    reset,
    getVisemePose,
    resolvePose: resolveLipSyncPose,
  };
}

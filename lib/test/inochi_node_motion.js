/* =========================================================
   Inochi2D Node Motion Module
   ---------------------------------------------------------
   ノードの位置・回転オフセット関連だけを担当。
   担当:
   - nodeMotionOffsets
   - secondaryNodeMotionOffsets
   - appliedNodeMotionOffsets
   - ノードハンドル解決
   - 通常ノードモーション書き込み
   - セカンダリーモーション書き込み
   - モーションの merge / reset
   本体側から後で完全に切り離しやすい構成。
   ========================================================= */
export function createNodeMotionController({
  runtime,
  resolveNodeHandle,
  ensureLoop,
  canvas = null,
}) {
  let nodeMotionOffsets = new Map();
  let secondaryNodeMotionOffsets = new Map();
  let appliedNodeMotionOffsets = new Map();
  const normalizeOffset = (offset) => ({
    x: Number.isFinite(offset?.x) ? offset.x : 0,
    y: Number.isFinite(offset?.y) ? offset.y : 0,
    rz: Number.isFinite(offset?.rz) ? offset.rz : 0,
  });
  const cloneOffset = (offset) => ({
    x: offset.x,
    y: offset.y,
    rz: offset.rz,
  });
  const cloneOffsetMap = (source) =>
    new Map(
      [...source.entries()].map(([nodeName, offset]) => [
        nodeName,
        cloneOffset(normalizeOffset(offset)),
      ]),
    );
  const updateDebugDataset = () => {
    if (!canvas) {
      return;
    }
    canvas.dataset.inochi2dNodeMotionCount =
      String(nodeMotionOffsets.size);
    canvas.dataset.inochi2dSecondaryNodeMotionCount =
      String(secondaryNodeMotionOffsets.size);
    canvas.dataset.inochi2dAppliedNodeMotionCount =
      String(appliedNodeMotionOffsets.size);
  };
  const mergeNodeMotionOffsets = () => {
    const mergedNodeMotionOffsets =
      cloneOffsetMap(nodeMotionOffsets);
    for (const [
      nodeName,
      secondaryOffset,
    ] of secondaryNodeMotionOffsets.entries()) {
      /*
       * 元コードと同じく、通常モーションが存在する場合は
       * 通常モーションを優先する。
       */
      if (!mergedNodeMotionOffsets.has(nodeName)) {
        mergedNodeMotionOffsets.set(
          nodeName,
          cloneOffset(normalizeOffset(secondaryOffset)),
        );
      }
    }
    return mergedNodeMotionOffsets;
  };
  const writeNodeMotionOffsets = (
    nextAppliedNodeMotionOffsets,
  ) => {
    const nextOffsets = cloneOffsetMap(
      nextAppliedNodeMotionOffsets,
    );
    if (!runtime) {
      appliedNodeMotionOffsets = nextOffsets;
      updateDebugDataset();
      return;
    }
    const nodeNames = new Set([
      ...appliedNodeMotionOffsets.keys(),
      ...nextOffsets.keys(),
    ]);
    for (const nodeName of nodeNames) {
      const offset = normalizeOffset(
        nextOffsets.get(nodeName),
      );
      const nodeHandle =
        typeof resolveNodeHandle === 'function'
          ? resolveNodeHandle(nodeName)
          : null;
      try {
        if (
          nodeHandle !== null &&
          nodeHandle !== undefined &&
          typeof runtime
            .set_post_physics_transform_offset_by_handle ===
            'function'
        ) {
          runtime.set_post_physics_transform_offset_by_handle(
            nodeHandle,
            offset.x,
            offset.y,
            offset.rz,
            1,
            1,
          );
        } else if (
          typeof runtime
            .set_post_physics_transform_offset_by_name ===
          'function'
        ) {
          runtime.set_post_physics_transform_offset_by_name(
            nodeName,
            offset.x,
            offset.y,
            offset.rz,
            1,
            1,
          );
        }
      } catch (error) {
        console.warn(
          '[Inochi2D node motion] failed to write node offset',
          {
            nodeName,
            offset,
            error,
          },
        );
      }
    }
    appliedNodeMotionOffsets = nextOffsets;
    updateDebugDataset();
  };
  const flushNodeMotionOffsets = () => {
    writeNodeMotionOffsets(
      mergeNodeMotionOffsets(),
    );
  };
  const applyNodeMotionOffsets = (
    nextNodeMotionOffsets,
  ) => {
    nodeMotionOffsets =
      cloneOffsetMap(nextNodeMotionOffsets);
    flushNodeMotionOffsets();
    ensureLoop?.();
  };
  const applySecondaryNodeMotionOffsets = (
    nextSecondaryNodeMotionOffsets,
  ) => {
    secondaryNodeMotionOffsets =
      cloneOffsetMap(nextSecondaryNodeMotionOffsets);
    flushNodeMotionOffsets();
    ensureLoop?.();
  };
  const resetNodeMotionOffsets = () => {
    applyNodeMotionOffsets(new Map());
  };
  const resetSecondaryNodeMotionOffsets = () => {
    applySecondaryNodeMotionOffsets(new Map());
  };
  const resetAll = () => {
    nodeMotionOffsets = new Map();
    secondaryNodeMotionOffsets = new Map();
    /*
     * 実際にランタイムへゼロを書き戻すため、
     * applied の旧ノード名も一度含める。
     */
    if (runtime) {
      const nodeNames = new Set(
        appliedNodeMotionOffsets.keys(),
      );
      for (const nodeName of nodeNames) {
        const nodeHandle =
          typeof resolveNodeHandle === 'function'
            ? resolveNodeHandle(nodeName)
            : null;
        try {
          if (
            nodeHandle !== null &&
            nodeHandle !== undefined &&
            typeof runtime
              .set_post_physics_transform_offset_by_handle ===
              'function'
          ) {
            runtime.set_post_physics_transform_offset_by_handle(
              nodeHandle,
              0,
              0,
              0,
              1,
              1,
            );
          } else if (
            typeof runtime
              .set_post_physics_transform_offset_by_name ===
            'function'
          ) {
            runtime.set_post_physics_transform_offset_by_name(
              nodeName,
              0,
              0,
              0,
              1,
              1,
            );
          }
        } catch {
          // ノードが既に消えている場合は無視。
        }
      }
    }
    appliedNodeMotionOffsets = new Map();
    updateDebugDataset();
  };
  const getNodeMotionOffsets = () =>
    cloneOffsetMap(nodeMotionOffsets);
  const getSecondaryNodeMotionOffsets = () =>
    cloneOffsetMap(
      secondaryNodeMotionOffsets,
    );
  const getAppliedNodeMotionOffsets = () =>
    cloneOffsetMap(
      appliedNodeMotionOffsets,
    );
  const getMergedNodeMotionOffsets = () =>
    cloneOffsetMap(
      mergeNodeMotionOffsets(),
    );
  const setNodeMotionOffset = (
    nodeName,
    x = 0,
    y = 0,
    rz = 0,
  ) => {
    if (
      typeof nodeName !== 'string' ||
      nodeName.trim().length === 0
    ) {
      return;
    }
    const next = new Map(
      nodeMotionOffsets,
    );
    next.set(
      nodeName,
      normalizeOffset({
        x,
        y,
        rz,
      }),
    );
    applyNodeMotionOffsets(next);
  };
  const setSecondaryNodeMotionOffset = (
    nodeName,
    x = 0,
    y = 0,
    rz = 0,
  ) => {
    if (
      typeof nodeName !== 'string' ||
      nodeName.trim().length === 0
    ) {
      return;
    }
    const next = new Map(
      secondaryNodeMotionOffsets,
    );
    next.set(
      nodeName,
      normalizeOffset({
        x,
        y,
        rz,
      }),
    );
    applySecondaryNodeMotionOffsets(next);
  };
  const removeNodeMotionOffset = (
    nodeName,
  ) => {
    const next = new Map(
      nodeMotionOffsets,
    );
    next.delete(nodeName);
    applyNodeMotionOffsets(next);
  };
  const removeSecondaryNodeMotionOffset = (
    nodeName,
  ) => {
    const next = new Map(
      secondaryNodeMotionOffsets,
    );
    next.delete(nodeName);
    applySecondaryNodeMotionOffsets(next);
  };
  const getState = () => ({
    nodeMotionOffsets:
      Object.fromEntries(
        nodeMotionOffsets.entries(),
      ),
    secondaryNodeMotionOffsets:
      Object.fromEntries(
        secondaryNodeMotionOffsets.entries(),
      ),
    appliedNodeMotionOffsets:
      Object.fromEntries(
        appliedNodeMotionOffsets.entries(),
      ),
  });
  const reset = () => {
    resetAll();
  };
  updateDebugDataset();
  return {
    mergeNodeMotionOffsets,
    writeNodeMotionOffsets,
    flushNodeMotionOffsets,
    applyNodeMotionOffsets,
    applySecondaryNodeMotionOffsets,
    resetNodeMotionOffsets,
    resetSecondaryNodeMotionOffsets,
    resetAll,
    reset,
    setNodeMotionOffset,
    setSecondaryNodeMotionOffset,
    removeNodeMotionOffset,
    removeSecondaryNodeMotionOffset,
    getNodeMotionOffsets,
    getSecondaryNodeMotionOffsets,
    getAppliedNodeMotionOffsets,
    getMergedNodeMotionOffsets,
    getState,
  };
}

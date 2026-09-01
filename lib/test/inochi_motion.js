/* =========================================================
   Inochi2D Motion Module
   ---------------------------------------------------------
   モーション関連だけを担当。
   担当:
   - Motion Payload の整理
   - アニメーション名の取得
   - Animation Library の構築
   - モーション検索
   - モーション状態管理
   - Animation Parameter ID の管理
   非担当:
   - Runtime 初期化
   - パラメータ値そのものの適用
   - 口パク
   - 瞬き
   - 視線
   - 表情
   - Secondary Motion
   - Camera
   ========================================================= */
export function createMotionController({
  runtime = null,
  debugEnabled = false,
} = {}) {
  let animationLibrary = new Map();
  let activeAnimation = null;
  let activeAnimationParameterIds =
    new Set();
  let lastAnimationName = null;
  let animationPayload = null;
  let puppetPayload = null;
  const log = (...args) => {
    if (!debugEnabled) {
      return;
    }
    console.info(
      '[Inochi2D motion]',
      ...args,
    );
  };
  /* -------------------------------------------------------
     共通
     ------------------------------------------------------- */
  const isObject = (value) =>
    value !== null &&
    typeof value === 'object';
  const normalizeName = (value) =>
    typeof value === 'string'
      ? value.trim()
      : '';
  const normalizeAnimationNames = (
    names,
  ) => {
    if (!Array.isArray(names)) {
      return [];
    }
    return [
      ...new Set(
        names
          .map(normalizeName)
          .filter(Boolean),
      ),
    ];
  };
  /* -------------------------------------------------------
     Animation Payload の正規化
     ------------------------------------------------------- */
  const normalizeAnimationEntry = (
    entry,
    fallbackName = '',
  ) => {
    if (!isObject(entry)) {
      return {
        name: fallbackName,
        data: entry,
      };
    }
    const name =
      normalizeName(
        entry.name ??
          entry.animationName ??
          fallbackName,
      );
    return {
      ...entry,
      name,
    };
  };
  const normalizeAnimationPayload = (
    payload,
  ) => {
    if (!payload) {
      return [];
    }
    /*
     * animations: [...]
     */
    if (Array.isArray(payload)) {
      return payload
        .map((entry, index) =>
          normalizeAnimationEntry(
            entry,
            `animation_${index}`,
          ),
        );
    }
    /*
     * animations: {
     *   idle: {...},
     *   blink: {...}
     * }
     */
    if (isObject(payload)) {
      return Object.entries(
        payload,
      ).map(
        ([name, entry]) =>
          normalizeAnimationEntry(
            entry,
            name,
          ),
      );
    }
    return [];
  };
  /* -------------------------------------------------------
     Animation Library
     ------------------------------------------------------- */
  const clearAnimationLibrary = () => {
    animationLibrary.clear();
  };
  const rebuildAnimationLibrary = (
    nextPuppetPayload,
    nextMotionPayload = null,
  ) => {
    puppetPayload =
      nextPuppetPayload ?? null;
    animationPayload =
      nextMotionPayload ?? null;
    animationLibrary.clear();
    /*
     * まず puppet 側 animations。
     */
    const puppetAnimations =
      normalizeAnimationPayload(
        nextPuppetPayload?.animations,
      );
    for (
      const animation of puppetAnimations
    ) {
      if (!animation.name) {
        continue;
      }
      animationLibrary.set(
        animation.name,
        animation,
      );
    }
    /*
     * 外部 motion payload がある場合は
     * 同名なら外部側を優先。
     */
    const motionAnimations =
      normalizeAnimationPayload(
        nextMotionPayload,
      );
    for (
      const animation of motionAnimations
    ) {
      if (!animation.name) {
        continue;
      }
      animationLibrary.set(
        animation.name,
        animation,
      );
    }
    log(
      'animation library rebuilt',
      [...animationLibrary.keys()],
    );
    return animationLibrary;
  };
  /* -------------------------------------------------------
     Animation 検索
     ------------------------------------------------------- */
  const hasAnimation = (
    animationName,
  ) => {
    const name =
      normalizeName(animationName);
    if (!name) {
      return false;
    }
    return animationLibrary.has(name);
  };
  const getAnimation = (
    animationName,
  ) => {
    const name =
      normalizeName(animationName);
    if (!name) {
      return null;
    }
    return (
      animationLibrary.get(name) ??
      null
    );
  };
  const getAnimationNames = () =>
    [...animationLibrary.keys()];
  const getAnimationCount = () =>
    animationLibrary.size;
  /* -------------------------------------------------------
     Parameter ID 抽出
     ------------------------------------------------------- */
  const collectParameterIds = (
    value,
    result = new Set(),
  ) => {
    if (
      value === null ||
      value === undefined
    ) {
      return result;
    }
    if (
      typeof value === 'string'
    ) {
      /*
       * パラメータ ID として使われそうな
       * 明示的な文字列だけをここでは扱う。
       *
       * 実際の animation format が違う場合は
       * 本体側から追加できる。
       */
      return result;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        collectParameterIds(
          item,
          result,
        );
      }
      return result;
    }
    if (isObject(value)) {
      /*
       * よくある parameter ID のキー。
       */
      for (
        const key of [
          'parameterId',
          'parameterID',
          'parameter',
          'id',
        ]
      ) {
        const candidate =
          value[key];
        if (
          typeof candidate ===
            'string' &&
          candidate.trim()
        ) {
          /*
           * "id" は animation 自体の id
           * の可能性もあるため、
           * parameter 系キーを優先する。
           */
          if (
            key !== 'id' ||
            value.parameterId ||
            value.parameterID ||
            value.parameter
          ) {
            result.add(
              candidate.trim(),
            );
          }
        }
      }
      for (
        const child of Object.values(
          value,
        )
      ) {
        collectParameterIds(
          child,
          result,
        );
      }
    }
    return result;
  };
  const getAnimationParameterIds = (
    animationName,
  ) => {
    const animation =
      getAnimation(animationName);
    if (!animation) {
      return [];
    }
    return [
      ...collectParameterIds(
        animation,
      ),
    ];
  };
  /* -------------------------------------------------------
     Active Animation
     ------------------------------------------------------- */
  const setActiveAnimation = (
    animation,
    parameterIds = [],
  ) => {
    if (!animation) {
      activeAnimation = null;
      activeAnimationParameterIds =
        new Set();
      return;
    }
    const name =
      normalizeName(
        animation.name,
      );
    activeAnimation = {
      ...animation,
      name,
    };
    activeAnimationParameterIds =
      new Set(
        normalizeAnimationNames(
          parameterIds,
        ),
      );
    lastAnimationName =
      name || lastAnimationName;
  };
  const clearActiveAnimation = () => {
    activeAnimation = null;
    activeAnimationParameterIds =
      new Set();
  };
  /* -------------------------------------------------------
     Runtime Animation API
     ------------------------------------------------------- */
  const playAnimation = (
    animationName,
    options = {},
  ) => {
    const name =
      normalizeName(animationName);
    if (!name) {
      return false;
    }
    /*
     * Runtime 側に play_animation が存在する場合。
     */
    if (
      runtime &&
      typeof runtime.play_animation ===
        'function'
    ) {
      runtime.play_animation(
        name,
        options,
      );
    } else if (
      runtime &&
      typeof runtime.playAnimation ===
        'function'
    ) {
      runtime.playAnimation(
        name,
        options,
      );
    }
    const animation =
      getAnimation(name);
    const parameterIds =
      animation
        ? getAnimationParameterIds(
            name,
          )
        : [];
    setActiveAnimation(
      animation ?? {
        name,
      },
      parameterIds,
    );
    log(
      'play',
      name,
      options,
    );
    return true;
  };
  const stopAnimation = (
    animationName = null,
  ) => {
    if (
      animationName &&
      activeAnimation?.name !==
        animationName
    ) {
      return false;
    }
    if (
      runtime &&
      typeof runtime.stop_animation ===
        'function'
    ) {
      runtime.stop_animation(
        animationName,
      );
    } else if (
      runtime &&
      typeof runtime.stopAnimation ===
        'function'
    ) {
      runtime.stopAnimation(
        animationName,
      );
    }
    clearActiveAnimation();
    log(
      'stop',
      animationName,
    );
    return true;
  };
  /* -------------------------------------------------------
     Animation Queue
     ------------------------------------------------------- */
  let queue = [];
  const enqueue = (
    animationName,
    options = {},
  ) => {
    const name =
      normalizeName(animationName);
    if (!name) {
      return false;
    }
    queue.push({
      name,
      options: {
        ...options,
      },
    });
    return true;
  };
  const dequeue = () =>
    queue.shift() ?? null;
  const clearQueue = () => {
    queue = [];
  };
  const getQueue = () =>
    queue.map((entry) => ({
      name: entry.name,
      options: {
        ...entry.options,
      },
    }));
  /* -------------------------------------------------------
     Animation Groups
     ------------------------------------------------------- */
  let groups = {
    idle: [],
    reaction: {},
    emotion: {},
  };
  const configureGroups = (
    nextGroups = {},
  ) => {
    groups = {
      idle:
        normalizeAnimationNames(
          nextGroups.idle ??
            nextGroups.idleAnimations,
        ),
      reaction: {},
      emotion: {},
    };
    const reactionSource =
      nextGroups.reaction ??
      nextGroups.reactionAnimations ??
      {};
    if (
      isObject(reactionSource)
    ) {
      for (
        const [name, names] of
          Object.entries(
            reactionSource,
          )
      ) {
        const normalized =
          normalizeAnimationNames(
            names,
          );
        if (normalized.length) {
          groups.reaction[name] =
            normalized;
        }
      }
    }
    const emotionSource =
      nextGroups.emotion ??
      nextGroups.emotionAnimations ??
      {};
    if (
      isObject(emotionSource)
    ) {
      for (
        const [name, names] of
          Object.entries(
            emotionSource,
          )
      ) {
        const normalized =
          normalizeAnimationNames(
            names,
          );
        if (normalized.length) {
          groups.emotion[name] =
            normalized;
        }
      }
    }
  };
  const getGroup = (
    type,
    name = null,
  ) => {
    if (type === 'idle') {
      return [
        ...groups.idle,
      ];
    }
    if (
      type === 'reaction'
    ) {
      return name
        ? [
            ...(groups.reaction[
              name
            ] ?? []),
          ]
        : {
            ...groups.reaction,
          };
    }
    if (
      type === 'emotion'
    ) {
      return name
        ? [
            ...(groups.emotion[
              name
            ] ?? []),
          ]
        : {
            ...groups.emotion,
          };
    }
    return [];
  };
  /* -------------------------------------------------------
     ランダム選択
     ------------------------------------------------------- */
  const pickAnimationName = (
    names,
    previousName = null,
  ) => {
    const normalized =
      normalizeAnimationNames(
        names,
      );
    if (!normalized.length) {
      return null;
    }
    if (
      normalized.length === 1
    ) {
      return normalized[0];
    }
    const candidates =
      normalized.filter(
        (name) =>
          name !== previousName,
      );
    const pool =
      candidates.length
        ? candidates
        : normalized;
    const index =
      Math.floor(
        Math.random() *
          pool.length,
      );
    return pool[index] ?? null;
  };
  /* -------------------------------------------------------
     State
     ------------------------------------------------------- */
  const getState = () => ({
    animationNames:
      getAnimationNames(),
    animationCount:
      getAnimationCount(),
    activeAnimation:
      activeAnimation
        ? {
            ...activeAnimation,
          }
        : null,
    activeAnimationParameterIds: [
      ...activeAnimationParameterIds,
    ],
    lastAnimationName,
    queue: getQueue(),
    groups: {
      idle: [...groups.idle],
      reaction:
        Object.fromEntries(
          Object.entries(
            groups.reaction,
          ).map(
            ([name, names]) => [
              name,
              [...names],
            ],
          ),
        ),
      emotion:
        Object.fromEntries(
          Object.entries(
            groups.emotion,
          ).map(
            ([name, names]) => [
              name,
              [...names],
            ],
          ),
        ),
    },
  });
  /* -------------------------------------------------------
     Reset
     ------------------------------------------------------- */
  const reset = () => {
    animationLibrary.clear();
    activeAnimation = null;
    activeAnimationParameterIds =
      new Set();
    lastAnimationName = null;
    animationPayload = null;
    puppetPayload = null;
    queue = [];
    groups = {
      idle: [],
      reaction: {},
      emotion: {},
    };
  };
  return {
    rebuildAnimationLibrary,
    clearAnimationLibrary,
    hasAnimation,
    getAnimation,
    getAnimationNames,
    getAnimationCount,
    getAnimationParameterIds,
    playAnimation,
    stopAnimation,
    setActiveAnimation,
    clearActiveAnimation,
    enqueue,
    dequeue,
    clearQueue,
    getQueue,
    configureGroups,
    getGroup,
    pickAnimationName,
    getState,
    reset,
    getRuntime: () =>
      runtime,
    getPuppetPayload: () =>
      puppetPayload,
    getMotionPayload: () =>
      animationPayload,
  };
}
export default {
  createMotionController,
};

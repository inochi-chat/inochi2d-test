/* =========================================================
Inochi2D Animation Module

アニメーション関連だけを担当。

* アニメーション選択
* Idle アニメーション
* Reaction アニメーション
* Emotion アニメーション
* アニメーション遷移
* 再生状態管理
* アニメーションパラメータの適用
    ========================================================= */

export function createAnimationController({
canvas,
animationLibrary,
parameterById,

getAnimationParameterIds,
evaluateLane,
getAnimationPlaybackWeight,

getParameterTransitionValue,
resetAnimationParameters,

setScalarParameterValue,
setParameterVectorValue,
markParameterSource,

cameraMotionOffset,
nodeMotionOffsets,
partOpacityValues,
partOpacityDefaults,

applyCameraTransform,
applyNodeMotionOffsets,
applyPartOpacityValues,

applyAnimationMotionDriver,
sampleAnimationMotionDriver,

ensureLoop,

lerp,
smoothStep,
clamp01,

defaultIdleTransitionMs = 180,
defaultReactionTransitionMs = 120,
defaultRareIdleGestureCooldownMs = 15000,

onStateChange = null,
}) {
let activeAnimation = null;
let activeAnimationParameterIds = new Set();

let idleAnimationNames = [];
let idleAnimationProfiles = new Map();
let idleAnimationQueue = [];

let lastIdleAnimationName = null;
let lastRareIdleGestureTimestampMs = -Infinity;

let reactionAnimationGroups = new Map();
let emotionAnimationGroups = new Map();

let lastReactionAnimationName = null;
let lastEmotionAnimationName = null;

let lastReactionTimestampMs = -Infinity;
let lastEmotionTimestampMs = -Infinity;

let motionLayerDebugState = {
transition: null,
lastSwitch: null,
lastCompletedAnimation: null,
lastReset: null,
touchedParameterIds: [],
};

let motionDebugHistory = [];

let secondaryMotionDriver = null;
let secondaryMotionDriverTimestamp = 0;

const now = () =>
typeof performance !== ‘undefined’
? performance.now()
: Date.now();

const notify = () => {
if (typeof onStateChange === ‘function’) {
onStateChange();
}
};

const pushMotionDebugHistory = (entry) => {
motionDebugHistory.push({
timestamp: now(),
…entry,
});

if (motionDebugHistory.length > 100) {
  motionDebugHistory.shift();
}

};

const normalizeAnimationNames = (animationNames) =>
Array.isArray(animationNames)
? [
…new Set(
animationNames
.filter((name) => typeof name === ‘string’)
.map((name) => name.trim())
.filter((name) => animationLibrary.has(name)),
),
]
: [];

const pickAnimationName = (
animationNames,
previousAnimationName = null,
) => {
const names = normalizeAnimationNames(animationNames);

if (names.length === 0) {
  return null;
}
if (names.length === 1) {
  return names[0];
}
const candidates = names.filter(
  (name) => name !== previousAnimationName,
);
return candidates[
  Math.floor(Math.random() * candidates.length)
];

};

const shuffleAnimationNames = (animationNames) => {
const names = normalizeAnimationNames(animationNames);

for (
  let index = names.length - 1;
  index > 0;
  index -= 1
) {
  const swapIndex = Math.floor(
    Math.random() * (index + 1),
  );
  [names[index], names[swapIndex]] = [
    names[swapIndex],
    names[index],
  ];
}
return names;

};

const getIdleAnimationProfile = (animationName) =>
idleAnimationProfiles.get(animationName) ?? {
type: ‘base’,
weight: 1,
};

const getIdleAnimationCooldownMs = (animationName) => {
const profile =
getIdleAnimationProfile(animationName);

if (Number.isFinite(profile.cooldownMs)) {
  return profile.cooldownMs;
}
return profile.type === 'rareGesture'
  ? defaultRareIdleGestureCooldownMs
  : 0;

};

const canPlayIdleAnimationName = (
animationName,
timestamp,
) => {
const profile =
getIdleAnimationProfile(animationName);

if (profile.type !== 'rareGesture') {
  return true;
}
return (
  timestamp - lastRareIdleGestureTimestampMs >=
  getIdleAnimationCooldownMs(animationName)
);

};

const expandWeightedIdleAnimationNames = (
animationNames,
timestamp,
) => {
const names = normalizeAnimationNames(
animationNames,
).filter((name) =>
canPlayIdleAnimationName(name, timestamp),
);

const expanded = [];
for (const name of names) {
  const profile =
    getIdleAnimationProfile(name);
  const weight = Math.max(
    1,
    Math.min(
      6,
      Math.round(
        Number.isFinite(profile.weight)
          ? profile.weight
          : 1,
      ),
    ),
  );
  for (
    let index = 0;
    index < weight;
    index += 1
  ) {
    expanded.push(name);
  }
}
return expanded.length > 0
  ? expanded
  : normalizeAnimationNames(animationNames);

};

const pickQueuedIdleAnimationName = () => {
const timestamp = now();

const names =
  expandWeightedIdleAnimationNames(
    idleAnimationNames,
    timestamp,
  );
if (names.length === 0) {
  idleAnimationQueue = [];
  return null;
}
if (idleAnimationQueue.length === 0) {
  idleAnimationQueue =
    shuffleAnimationNames(names);
  if (
    idleAnimationQueue.length > 1 &&
    idleAnimationQueue[0] === lastIdleAnimationName
  ) {
    idleAnimationQueue.push(
      idleAnimationQueue.shift(),
    );
  }
}
const nextName =
  idleAnimationQueue.shift();
if (
  !nextName ||
  !animationLibrary.has(nextName)
) {
  idleAnimationQueue = [];
  return pickAnimationName(
    names,
    lastIdleAnimationName,
  );
}
return nextName;

};

const createAnimationTransition = (
nextAnimationParameterIds,
durationMs,
) => {
const normalizedDurationMs = Math.max(
0,
durationMs,
);

if (normalizedDurationMs <= 0) {
  return null;
}
const scalarValues = new Map();
const vectorValues = new Map();
const transitionParameterIds =
  new Set([
    ...activeAnimationParameterIds,
    ...nextAnimationParameterIds,
  ]);
for (const parameterId of transitionParameterIds) {
  /*
   * 口はリップシンク側で管理する。
   * アニメーション遷移から除外する。
   */
  if (/mouth/i.test(parameterId)) {
    continue;
  }
  const transitionValue =
    getParameterTransitionValue(
      parameterId,
    );
  if (!transitionValue) {
    continue;
  }
  if (transitionValue.isVec2) {
    vectorValues.set(
      parameterId,
      [...transitionValue.value],
    );
  } else {
    scalarValues.set(
      parameterId,
      transitionValue.value,
    );
  }
}
return {
  durationMs: normalizedDurationMs,
  scalarValues,
  vectorValues,
  cameraMotionOffset: {
    x: cameraMotionOffset.x,
    y: cameraMotionOffset.y,
    scale: cameraMotionOffset.scale,
  },
  nodeMotionOffsets: new Map(
    [...nodeMotionOffsets.entries()].map(
      ([nodeName, offset]) => [
        nodeName,
        { ...offset },
      ],
    ),
  ),
  partOpacityValues:
    new Map(partOpacityValues),
  parameterIds:
    transitionParameterIds,
};

};

const applyAnimationTransition = (
transition,
progress,
scalarValues,
vectorValues,
nextCameraMotionOffset,
nextNodeMotionOffsets,
nextPartOpacityValues,
) => {
if (!transition) {
return;
}

for (
  const [
    parameterId,
    fromValue,
  ] of transition.scalarValues.entries()
) {
  const parameter =
    parameterById.get(parameterId);
  const toValue =
    scalarValues.has(parameterId)
      ? scalarValues.get(parameterId)
      : parameter?.defaultValue?.[0] ?? 0;
  scalarValues.set(
    parameterId,
    lerp(
      fromValue,
      toValue,
      progress,
    ),
  );
}
for (
  const [
    parameterId,
    fromValue,
  ] of transition.vectorValues.entries()
) {
  const parameter =
    parameterById.get(parameterId);
  const toValue =
    vectorValues.get(parameterId) ?? [
      parameter?.defaultValue?.[0] ?? 0,
      parameter?.defaultValue?.[1] ?? 0,
    ];
  vectorValues.set(
    parameterId,
    [
      lerp(
        fromValue[0],
        toValue[0],
        progress,
      ),
      lerp(
        fromValue[1],
        toValue[1],
        progress,
      ),
    ],
  );
}
nextCameraMotionOffset.x = lerp(
  transition.cameraMotionOffset.x,
  nextCameraMotionOffset.x,
  progress,
);
nextCameraMotionOffset.y = lerp(
  transition.cameraMotionOffset.y,
  nextCameraMotionOffset.y,
  progress,
);
nextCameraMotionOffset.scale = lerp(
  transition.cameraMotionOffset.scale,
  nextCameraMotionOffset.scale,
  progress,
);
for (
  const [
    nodeName,
    fromOffset,
  ] of transition.nodeMotionOffsets.entries()
) {
  const toOffset =
    nextNodeMotionOffsets.get(
      nodeName,
    ) ?? {
      x: 0,
      y: 0,
      rz: 0,
    };
  nextNodeMotionOffsets.set(
    nodeName,
    {
      x: lerp(
        fromOffset.x,
        toOffset.x,
        progress,
      ),
      y: lerp(
        fromOffset.y,
        toOffset.y,
        progress,
      ),
      rz: lerp(
        fromOffset.rz,
        toOffset.rz,
        progress,
      ),
    },
  );
}
for (
  const [
    nodeName,
    fromOpacity,
  ] of transition.partOpacityValues.entries()
) {
  const fallbackOpacity =
    partOpacityDefaults.get(nodeName) ?? 1;
  const toOpacity =
    nextPartOpacityValues.has(nodeName)
      ? nextPartOpacityValues.get(
          nodeName,
        )
      : fallbackOpacity;
  nextPartOpacityValues.set(
    nodeName,
    clamp01(
      lerp(
        fromOpacity,
        toOpacity,
        progress,
      ),
    ),
  );
}

};

const startAnimation = (
animationName,
options = {},
) => {
const animation =
animationLibrary.get(animationName);

if (!animation) {
  throw new Error(
    `Unknown Inochi2D animation: ${animationName}`,
  );
}
if (
  activeAnimation &&
  options.restart === false
) {
  return;
}
const nextAnimationParameterIds =
  getAnimationParameterIds(
    animation,
  );
const kind =
  options.kind ?? 'manual';
const transitionDurationMs =
  typeof options.transitionMs === 'number' &&
  Number.isFinite(options.transitionMs)
    ? options.transitionMs
    : kind === 'idle'
      ? defaultIdleTransitionMs
      : kind === 'reaction'
        ? defaultReactionTransitionMs
        : 0;
const transition =
  createAnimationTransition(
    nextAnimationParameterIds,
    transitionDurationMs,
  );
const previousAnimation =
  activeAnimation
    ? {
        name: activeAnimation.name,
        kind: activeAnimation.kind,
        parameterIds: [
          ...activeAnimationParameterIds,
        ],
      }
    : null;
const sharedParameterIds =
  previousAnimation
    ? [
        ...nextAnimationParameterIds,
      ].filter((parameterId) =>
        activeAnimationParameterIds.has(
          parameterId,
        ),
      )
    : [];
let resetParameterIds = [];
if (!transition) {
  resetParameterIds =
    resetAnimationParameters(
      activeAnimationParameterIds,
    );
  applyCameraTransform();
  applyNodeMotionOffsets(
    new Map(),
  );
  applyPartOpacityValues(
    new Map(partOpacityDefaults),
  );
}
activeAnimation = {
  name: animationName,
  kind,
  loop: options.loop === true,
  startedAtMs: now(),
  weight:
    Number.isFinite(options.weight)
      ? options.weight
      : 1,
  transition,
  playbackWeight: 0,
};
activeAnimationParameterIds =
  transition
    ? new Set([
        ...nextAnimationParameterIds,
        ...transition.parameterIds,
      ])
    : nextAnimationParameterIds;
if (canvas) {
  canvas.dataset.inochi2dAnimation =
    animationName;
  canvas.dataset.inochi2dAnimationKind =
    activeAnimation.kind;
  canvas.dataset.inochi2dAnimationTransition =
    transition
      ? String(
          Math.round(
            transition.durationMs,
          ),
        )
      : '0';
  canvas.dataset.inochi2dAnimationTouchedParameters =
    String(
      activeAnimationParameterIds.size,
    );
}
motionLayerDebugState = {
  ...motionLayerDebugState,
  lastSwitch: {
    from: previousAnimation
      ? {
          name:
            previousAnimation.name,
          kind:
            previousAnimation.kind,
          parameterCount:
            previousAnimation
              .parameterIds.length,
        }
      : null,
    to: {
      name: animationName,
      kind,
      parameterCount:
        nextAnimationParameterIds.size,
    },
    transitionMs:
      transition?.durationMs ?? 0,
    sharedParameterIds,
    resetParameterIds,
  },
  lastReset:
    resetParameterIds.length
      ? {
          reason:
            'animation-switch-without-transition',
          parameterIds:
            resetParameterIds,
        }
      : motionLayerDebugState.lastReset,
};
pushMotionDebugHistory({
  type: 'switch',
  ...motionLayerDebugState.lastSwitch,
});
ensureLoop();
notify();

};

const playNextIdleAnimation = () => {
const nextAnimationName =
pickQueuedIdleAnimationName();

if (!nextAnimationName) {
  return false;
}
lastIdleAnimationName =
  nextAnimationName;
const idleProfile =
  getIdleAnimationProfile(
    nextAnimationName,
  );
if (
  idleProfile.type ===
  'rareGesture'
) {
  lastRareIdleGestureTimestampMs =
    now();
}
startAnimation(
  nextAnimationName,
  {
    kind: 'idle',
    loop: false,
    restart: true,
  },
);
if (canvas) {
  canvas.dataset.inochi2dIdleAnimationType =
    idleProfile.type ?? 'base';
}
return true;

};

const applyActiveAnimation = (
timestamp,
) => {
if (
!activeAnimation
) {
return new Set();
}

const animation =
  animationLibrary.get(
    activeAnimation.name,
  );
if (!animation) {
  const resetParameterIds =
    resetAnimationParameters(
      activeAnimationParameterIds,
    );
  activeAnimation = null;
  activeAnimationParameterIds =
    new Set();
  motionLayerDebugState = {
    ...motionLayerDebugState,
    lastReset: {
      reason:
        'missing-animation',
      parameterIds:
        resetParameterIds,
    },
  };
  notify();
  return new Set();
}
const timestepMs =
  Math.max(
    1,
    animation.timestep * 1000,
  );
const frameCount =
  Math.max(
    1,
    animation.length,
  );
const elapsedMs =
  Math.max(
    0,
    timestamp -
      activeAnimation.startedAtMs,
  );
const elapsedFrames =
  elapsedMs / timestepMs;
const reachedEnd =
  !activeAnimation.loop &&
  elapsedFrames >=
    frameCount - 1;
const frame =
  activeAnimation.loop
    ? elapsedFrames % frameCount
    : Math.min(
        elapsedFrames,
        frameCount - 1,
      );
const playbackWeight =
  clamp01(
    activeAnimation.weight *
      getAnimationPlaybackWeight(
        animation,
        frame,
      ),
  );
activeAnimation.playbackWeight =
  playbackWeight;
const scalarValues =
  new Map();
const vectorValues =
  new Map();
const nextCameraMotionOffset = {
  x: 0,
  y: 0,
  scale: 0,
};
let hasCameraMotion = false;
const nextNodeMotionOffsets =
  new Map();
let hasNodeMotion = false;
const nextPartOpacityValues =
  new Map();
let hasPartOpacity = false;
const touchedParameterIds =
  new Set();
for (
  const lane of animation.lanes
) {
  const rawValue =
    evaluateLane(
      lane,
      frame,
    );
  if (rawValue === undefined) {
    continue;
  }
  if (
    lane.cameraMotionChannel
  ) {
    hasCameraMotion = true;
    nextCameraMotionOffset[
      lane.cameraMotionChannel
    ] =
      rawValue *
      playbackWeight;
    continue;
  }
  if (lane.nodeMotion) {
    hasNodeMotion = true;
    const offset =
      nextNodeMotionOffsets.get(
        lane.nodeMotion.nodeName,
      ) ?? {
        x: 0,
        y: 0,
        rz: 0,
      };
    offset[
      lane.nodeMotion.channel
    ] =
      rawValue *
      playbackWeight;
    nextNodeMotionOffsets.set(
      lane.nodeMotion.nodeName,
      offset,
    );
    continue;
  }
  if (lane.partOpacity) {
    hasPartOpacity = true;
    nextPartOpacityValues.set(
      lane.partOpacity.nodeName,
      clamp01(rawValue),
    );
    continue;
  }
  if (lane.effect) {
    continue;
  }
  const parameter =
    lane.parameter;
  if (!parameter) {
    continue;
  }
  touchedParameterIds.add(
    parameter.id,
  );
  const value =
    rawValue *
    playbackWeight;
  if (parameter.isVec2) {
    const vectorValue =
      vectorValues.get(
        parameter.id,
      ) ?? [
        ...parameter.defaultValue,
      ];
    vectorValue[
      lane.target === 1
        ? 1
        : 0
    ] = value;
    vectorValues.set(
      parameter.id,
      vectorValue,
    );
  } else {
    scalarValues.set(
      parameter.id,
      value,
    );
  }
}
const transition =
  activeAnimation.transition;
if (transition) {
  const transitionProgress =
    smoothStep(
      transition.durationMs > 0
        ? elapsedMs /
            transition.durationMs
        : 1,
    );
  motionLayerDebugState = {
    ...motionLayerDebugState,
    transition: {
      animation:
        activeAnimation.name,
      kind:
        activeAnimation.kind,
      progress:
        transitionProgress,
      durationMs:
        transition.durationMs,
      parameterIds: [
        ...transition.parameterIds,
      ],
    },
  };
  applyAnimationTransition(
    transition,
    transitionProgress,
    scalarValues,
    vectorValues,
    nextCameraMotionOffset,
    nextNodeMotionOffsets,
    nextPartOpacityValues,
  );
  if (
    transitionProgress >= 1
  ) {
    activeAnimation.transition =
      null;
    activeAnimationParameterIds =
      getAnimationParameterIds(
        animation,
      );
    motionLayerDebugState = {
      ...motionLayerDebugState,
      transition: null,
    };
    if (canvas) {
      canvas.dataset.inochi2dAnimationTransition =
        '0';
    }
  }
}
const animationSource =
  `animation:${activeAnimation.kind}:${activeAnimation.name}`;
for (
  const [
    parameterId,
    value,
  ] of scalarValues.entries()
) {
  markParameterSource(
    parameterId,
    animationSource,
  );
  setScalarParameterValue(
    parameterId,
    value,
  );
}
for (
  const [
    parameterId,
    value,
  ] of vectorValues.entries()
) {
  markParameterSource(
    parameterId,
    animationSource,
  );
  setParameterVectorValue(
    parameterId,
    value[0],
    value[1],
  );
}
if (
  hasCameraMotion ||
  cameraMotionOffset.x !== 0 ||
  cameraMotionOffset.y !== 0 ||
  cameraMotionOffset.scale !== 0
) {
  cameraMotionOffset.x =
    nextCameraMotionOffset.x;
  cameraMotionOffset.y =
    nextCameraMotionOffset.y;
  cameraMotionOffset.scale =
    nextCameraMotionOffset.scale;
  applyCameraTransform();
}
applyAnimationMotionDriver(
  vectorValues,
  scalarValues,
  nextCameraMotionOffset,
  timestamp,
);
if (
  hasNodeMotion ||
  nodeMotionOffsets.size > 0
) {
  applyNodeMotionOffsets(
    nextNodeMotionOffsets,
  );
}
if (
  hasPartOpacity ||
  partOpacityValues.size > 0
) {
  applyPartOpacityValues(
    nextPartOpacityValues,
  );
}
if (reachedEnd) {
  const completedAnimation = {
    name:
      activeAnimation.name,
    kind:
      activeAnimation.kind,
    touchedParameterIds: [
      ...touchedParameterIds,
    ],
  };
  const completedKind =
    activeAnimation.kind;
  const completedParameterIds =
    new Set(
      activeAnimationParameterIds,
    );
  const shouldBlendToNextIdle =
    completedKind === 'idle' ||
    completedKind === 'reaction';
  const continuedToIdle =
    shouldBlendToNextIdle
      ? playNextIdleAnimation()
      : false;
  const resetParameterIds =
    continuedToIdle
      ? []
      : resetAnimationParameters(
          completedParameterIds,
        );
  if (!continuedToIdle) {
    activeAnimation = null;
    activeAnimationParameterIds =
      new Set();
    applyCameraTransform();
    applyNodeMotionOffsets(
      new Map(),
    );
    applyPartOpacityValues(
      new Map(partOpacityDefaults),
    );
    if (canvas) {
      delete canvas.dataset
        .inochi2dAnimation;
      delete canvas.dataset
        .inochi2dAnimationKind;
      delete canvas.dataset
        .inochi2dAnimationTransition;
      delete canvas.dataset
        .inochi2dAnimationTouchedParameters;
    }
  }
  motionLayerDebugState = {
    ...motionLayerDebugState,
    transition: continuedToIdle
      ? motionLayerDebugState.transition
      : null,
    lastCompletedAnimation:
      completedAnimation,
    lastReset: continuedToIdle
      ? motionLayerDebugState.lastReset
      : {
          reason:
            'animation-completed',
          parameterIds:
            resetParameterIds,
        },
  };
  pushMotionDebugHistory({
    type: 'complete',
    ...completedAnimation,
    resetParameterIds,
    continuedToIdle,
  });
  secondaryMotionDriver =
    sampleAnimationMotionDriver();
  secondaryMotionDriverTimestamp =
    timestamp;
  notify();
}
motionLayerDebugState = {
  ...motionLayerDebugState,
  touchedParameterIds: [
    ...touchedParameterIds,
  ],
};
return touchedParameterIds;

};

const configureAnimationGroups = (
groups = {},
) => {
idleAnimationNames =
normalizeAnimationNames(
groups.idleAnimations,
);

idleAnimationProfiles =
  new Map(
    Object.entries(
      groups.idleAnimationProfiles ??
        {},
    )
      .map(
        ([
          animationName,
          profile,
        ]) => [
          animationName.trim(),
          {
            type:
              profile?.type ===
                'attention' ||
              profile?.type ===
                'emotion' ||
              profile?.type ===
                'rareGesture'
                ? profile.type
                : 'base',
            cooldownMs:
              typeof profile?.cooldownMs ===
                'number' &&
              Number.isFinite(
                profile.cooldownMs,
              ) &&
              profile.cooldownMs >= 0
                ? profile.cooldownMs
                : undefined,
            weight:
              typeof profile?.weight ===
                'number' &&
              Number.isFinite(
                profile.weight,
              ) &&
              profile.weight > 0
                ? profile.weight
                : 1,
          },
        ],
      )
      .filter(
        ([animationName]) =>
          animationName.length > 0,
      ),
  );
idleAnimationQueue = [];
lastReactionAnimationName =
  null;
lastEmotionAnimationName =
  null;
reactionAnimationGroups =
  new Map(
    Object.entries(
      groups.reactionAnimations ??
        {},
    )
      .map(
        ([
          reactionName,
          animationNames,
        ]) => [
          reactionName,
          normalizeAnimationNames(
            animationNames,
          ),
        ],
      )
      .filter(
        ([, animationNames]) =>
          animationNames.length > 0,
      ),
  );
emotionAnimationGroups =
  new Map(
    Object.entries(
      groups.emotionAnimations ??
        {},
    )
      .map(
        ([
          emotionName,
          animationNames,
        ]) => [
          emotionName,
          normalizeAnimationNames(
            animationNames,
          ),
        ],
      )
      .filter(
        ([, animationNames]) =>
          animationNames.length > 0,
      ),
  );
notify();

};

const playIdleAnimations = (
animationNames,
options = {},
) => {
idleAnimationNames =
normalizeAnimationNames(
animationNames,
);

idleAnimationQueue = [];
lastIdleAnimationName = null;
if (
  options.shuffle === false &&
  idleAnimationNames.length > 0
) {
  startAnimation(
    idleAnimationNames[0],
    {
      kind: 'idle',
      loop: false,
      restart: true,
    },
  );
  lastIdleAnimationName =
    idleAnimationNames[0];
  return;
}
playNextIdleAnimation();

};

const playReactionAnimation = (
reactionName,
) => {
const timestamp = now();

if (
  timestamp -
    lastReactionTimestampMs <
  1200
) {
  return;
}
const animationName =
  pickAnimationName(
    reactionAnimationGroups.get(
      reactionName,
    ) ?? [],
    lastReactionAnimationName,
  );
if (!animationName) {
  return;
}
lastReactionTimestampMs =
  timestamp;
lastReactionAnimationName =
  animationName;
startAnimation(
  animationName,
  {
    kind: 'reaction',
    loop: false,
    restart: true,
  },
);

};

const playEmotionAnimation = (
emotionName,
) => {
const timestamp = now();

if (
  timestamp -
    lastEmotionTimestampMs <
  900
) {
  return;
}
const animationName =
  pickAnimationName(
    emotionAnimationGroups.get(
      emotionName,
    ) ??
      emotionAnimationGroups.get(
        'neutral',
      ) ??
      [],
    lastEmotionAnimationName,
  );
if (!animationName) {
  return;
}
lastEmotionTimestampMs =
  timestamp;
lastEmotionAnimationName =
  animationName;
startAnimation(
  animationName,
  {
    kind: 'emotion',
    loop: false,
    restart: true,
  },
);

};

const stopAnimation = (
animationName,
) => {
if (
animationName &&
activeAnimation?.name !==
animationName
) {
return;
}

const resetParameterIds =
  resetAnimationParameters(
    activeAnimationParameterIds,
  );
applyCameraTransform();
applyNodeMotionOffsets(
  new Map(),
);
applyPartOpacityValues(
  new Map(partOpacityDefaults),
);
activeAnimation = null;
activeAnimationParameterIds =
  new Set();
motionLayerDebugState = {
  ...motionLayerDebugState,
  transition: null,
  lastReset: {
    reason:
      'stop-animation',
    parameterIds:
      resetParameterIds,
  },
};
pushMotionDebugHistory({
  type: 'stop',
  animationName,
  resetParameterIds,
});
if (canvas) {
  delete canvas.dataset
    .inochi2dAnimation;
  delete canvas.dataset
    .inochi2dAnimationKind;
  delete canvas.dataset
    .inochi2dAnimationTransition;
}
notify();

};

const reset = () => {
activeAnimation = null;
activeAnimationParameterIds =
new Set();

idleAnimationQueue = [];
lastIdleAnimationName = null;
lastRareIdleGestureTimestampMs =
  -Infinity;
lastReactionAnimationName = null;
lastEmotionAnimationName = null;
lastReactionTimestampMs =
  -Infinity;
lastEmotionTimestampMs =
  -Infinity;
motionLayerDebugState = {
  transition: null,
  lastSwitch: null,
  lastCompletedAnimation: null,
  lastReset: null,
  touchedParameterIds: [],
};
motionDebugHistory = [];
secondaryMotionDriver = null;
secondaryMotionDriverTimestamp = 0;
if (canvas) {
  delete canvas.dataset
    .inochi2dAnimation;
  delete canvas.dataset
    .inochi2dAnimationKind;
  delete canvas.dataset
    .inochi2dAnimationTransition;
  delete canvas.dataset
    .inochi2dAnimationTouchedParameters;
  delete canvas.dataset
    .inochi2dIdleAnimationType;
}

};

const getState = () => ({
activeAnimation: activeAnimation
? {
…activeAnimation,
transition:
activeAnimation.transition
? {
…activeAnimation.transition,
scalarValues:
new Map(
activeAnimation
.transition
.scalarValues,
),
vectorValues:
new Map(
activeAnimation
.transition
.vectorValues,
),
}
: null,
}
: null,

activeAnimationParameterIds: [
  ...activeAnimationParameterIds,
],
idleAnimationNames: [
  ...idleAnimationNames,
],
idleAnimationProfiles:
  Object.fromEntries(
    idleAnimationProfiles.entries(),
  ),
idleAnimationQueue: [
  ...idleAnimationQueue,
],
lastIdleAnimationName,
lastRareIdleGestureTimestampMs,
reactionAnimationGroups:
  Object.fromEntries(
    reactionAnimationGroups.entries(),
  ),
emotionAnimationGroups:
  Object.fromEntries(
    emotionAnimationGroups.entries(),
  ),
lastReactionAnimationName,
lastEmotionAnimationName,
motionLayers: {
  ...motionLayerDebugState,
  activeLayers: [
    ...(
      motionLayerDebugState.activeLayers ??
      []
    ),
  ],
  touchedParameterIds: [
    ...motionLayerDebugState
      .touchedParameterIds,
  ],
  history: [
    ...motionDebugHistory,
  ],
},
secondaryMotionDriver:
  secondaryMotionDriver
    ? {
        ...secondaryMotionDriver,
      }
    : null,
secondaryMotionDriverTimestamp,

});

return {
start: startAnimation,
apply: applyActiveAnimation,

playIdle: playIdleAnimations,
playNextIdle: playNextIdleAnimation,
playReaction:
  playReactionAnimation,
playEmotion:
  playEmotionAnimation,
stop: stopAnimation,
configureGroups:
  configureAnimationGroups,
getState,
reset,
getAnimationNames: () =>
  [...animationLibrary.keys()],
getActiveAnimationParameterIds:
  () => [
    ...activeAnimationParameterIds,
  ],

};
}

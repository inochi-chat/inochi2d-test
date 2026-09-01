import initInochi2d, { Inochi2dRuntime } from './inochi2d.js';
import { createSecondaryMotionEngine } from './secondary_motion.js';

/* =========================================================
   Inochi2D Bridge
   ========================================================= */

const GL_TEXTURE_WRAP_S = 0x2802;
const GL_TEXTURE_WRAP_T = 0x2803;
const GL_CLAMP_TO_BORDER = 0x812d;
const GL_CLAMP_TO_EDGE = 0x812f;

/* ---------------------------------------------------------
   Known parameter IDs
   --------------------------------------------------------- */

const AUTO_BLINK_PARAMETER_IDS = [
  'Eye:: Left:: Blink',
  'Eye:: Right:: Blink',
  'Blink',
];

const AUTO_GAZE_PARAMETER_IDS = {
  leftX: 'Eye:: Left:: Move',
  rightX: 'Eye:: Right:: Move',
  leftY: 'Eye:: Left:: Move Y',
  rightY: 'Eye:: Right:: Move Y',
};

const MOUTH_SHAPE_PARAMETER_ID = 'Param #1';
const MOUTH_PARAMETER_ID_RE = /mouth/i;

/* ---------------------------------------------------------
   Lip sync
   --------------------------------------------------------- */

const LIP_SYNC_ATTACK_MS = 45;
const LIP_SYNC_RELEASE_MS = 110;
const LIP_SYNC_CLOSE_EPSILON = 0.001;

const MOUTH_VISEME_POSES = {
  neutral: [0, 0],
  a: [1, 0],
  i: [0.25, 0],
  u: [0.45, 0],
  e: [0.55, 0],
  o: [0.85, 0],
};

/* ---------------------------------------------------------
   Secondary motion
   --------------------------------------------------------- */

const SPEECH_SECONDARY_MOTION_MIN_DELTA = 0.008;
const SPEECH_SECONDARY_MOTION_IMPULSE_X = 5.2;
const SPEECH_SECONDARY_MOTION_IMPULSE_Y = 2.8;
const SPEECH_SECONDARY_MOTION_RELEASE_RATE = 0.18;

/* ---------------------------------------------------------
   Camera
   --------------------------------------------------------- */

const DEFAULT_CAMERA_SCALE = 1;

/* ---------------------------------------------------------
   Expressions
   --------------------------------------------------------- */

const EXPRESSION_PRESETS = {
  neutral: {
    faceValues: {},
    mouthValues: {},
  },

  happy: {
    faceValues: {
      'Brow:: Left:: Lift': 0.3,
      'Brow:: Right:: Lift': 0.3,
      'Eye:: Left:: Move Y': -0.1,
      'Eye:: Right:: Move Y': -0.1,
    },
    mouthValues: {
      [MOUTH_SHAPE_PARAMETER_ID]: [1, 0.22],
    },
  },

  smile: {
    faceValues: {
      'Brow:: Left:: Lift': 0.32,
      'Brow:: Right:: Lift': 0.32,
      'Eye:: Left:: Move Y': -0.12,
      'Eye:: Right:: Move Y': -0.12,
    },
    mouthValues: {
      [MOUTH_SHAPE_PARAMETER_ID]: [1, 0.25],
    },
  },

  relaxed: {
    faceValues: {
      'Brow:: Left:: Lift': 0.12,
      'Brow:: Right:: Lift': 0.12,
      'Eye:: Left:: Move Y': -0.05,
      'Eye:: Right:: Move Y': -0.05,
    },
    mouthValues: {
      [MOUTH_SHAPE_PARAMETER_ID]: [1, 0.12],
    },
  },

  surprised: {
    faceValues: {
      'Brow:: Left:: Lift': 0.9,
      'Brow:: Right:: Lift': 0.9,
      'Eye:: Left:: Move Y': 0.18,
      'Eye:: Right:: Move Y': 0.18,
    },
    mouthValues: {
      [MOUTH_SHAPE_PARAMETER_ID]: [0, 0.85],
    },
  },

  angry: {
    faceValues: {
      'Brow:: Left:: Lift': -0.34,
      'Brow:: Right:: Lift': -0.3,
      'Eye:: Left:: Move Y': 0.08,
      'Eye:: Right:: Move Y': 0.08,
    },
    mouthValues: {
      [MOUTH_SHAPE_PARAMETER_ID]: [0.42, 0.18],
    },
  },

  thinking: {
    faceValues: {
      'Brow:: Left:: Lift': -0.16,
      'Brow:: Right:: Lift': 0.18,
      'Eye:: Left:: Move': -0.08,
      'Eye:: Right:: Move': -0.08,
    },
    mouthValues: {
      [MOUTH_SHAPE_PARAMETER_ID]: [0.75, 0.25],
    },
  },

  listening: {
    faceValues: {
      'Brow:: Left:: Lift': 0.14,
      'Brow:: Right:: Lift': 0.1,
      'Eye:: Left:: Move': -0.06,
      'Eye:: Right:: Move': -0.06,
      'Eye:: Left:: Move Y': 0.04,
      'Eye:: Right:: Move Y': 0.04,
    },
  },

  speaking: {
    faceValues: {
      'Brow:: Left:: Lift': 0.24,
      'Brow:: Right:: Lift': 0.24,
      'Eye:: Left:: Move Y': -0.06,
      'Eye:: Right:: Move Y': -0.06,
    },
  },

  sad: {
    faceValues: {
      'Brow:: Left:: Lift': -0.28,
      'Brow:: Right:: Lift': -0.28,
      'Eye:: Left:: Move Y': -0.2,
      'Eye:: Right:: Move Y': -0.2,
    },
    mouthValues: {
      [MOUTH_SHAPE_PARAMETER_ID]: [0, 0.25],
    },
  },

  error: {
    faceValues: {
      'Brow:: Left:: Lift': -0.32,
      'Brow:: Right:: Lift': -0.24,
      'Eye:: Left:: Move Y': -0.16,
      'Eye:: Right:: Move Y': -0.16,
    },
    mouthValues: {
      [MOUTH_SHAPE_PARAMETER_ID]: [0.25, 0.22],
    },
  },
};

/* =========================================================
   Helpers
   ========================================================= */

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value) {
  return clamp(Number(value) || 0, 0, 1);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeParameterName(name) {
  return String(name ?? '')
    .replace(/\u0000/g, '')
    .trim();
}

/* =========================================================
   WebGL compatibility
   ========================================================= */

function patchWebGlClampToBorder() {
  if (typeof WebGLRenderingContext === 'undefined') {
    return;
  }

  const proto = WebGLRenderingContext.prototype;

  if (!proto.__inochiClampPatch) {
    proto.__inochiClampPatch = true;

    const originalTexParameteri = proto.texParameteri;

    proto.texParameteri = function (target, pname, param) {
      let nextParam = param;

      if (
        pname === GL_TEXTURE_WRAP_S ||
        pname === GL_TEXTURE_WRAP_T
      ) {
        if (param === GL_CLAMP_TO_BORDER) {
          nextParam = GL_CLAMP_TO_EDGE;
        }
      }

      return originalTexParameteri.call(
        this,
        target,
        pname,
        nextParam,
      );
    };
  }
}

/* =========================================================
   Puppet payload decoder
   ========================================================= */

function decodePuppetPayload(modelBytes) {
  try {
    if (!(modelBytes instanceof Uint8Array)) {
      return null;
    }

    const decoder = new TextDecoder('utf-8', {
      fatal: false,
    });

    const text = decoder.decode(modelBytes);

    const candidates = [];

    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace > firstBrace) {
      candidates.push(
        text.slice(firstBrace, lastBrace + 1),
      );
    }

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate);

        if (
          parsed &&
          typeof parsed === 'object'
        ) {
          return parsed;
        }
      } catch (_) {}
    }
  } catch (_) {}

  return null;
}

/* =========================================================
   Motion payload
   ========================================================= */

async function loadMotionPayload(motionUrl) {
  if (!motionUrl) {
    return null;
  }

  try {
    const response = await fetch(motionUrl);

    if (!response.ok) {
      throw new Error(
        `Motion HTTP ${response.status}`,
      );
    }

    const contentType =
      response.headers.get('content-type') || '';

    if (
      contentType.includes('application/json') ||
      motionUrl.endsWith('.json')
    ) {
      return await response.json();
    }

    const text = await response.text();

    try {
      return JSON.parse(text);
    } catch (_) {
      return {
        raw: text,
      };
    }
  } catch (error) {
    console.warn(
      '[Inochi Bridge] motion load failed',
      error,
    );

    return null;
  }
}

/* =========================================================
   Main controller
   ========================================================= */

export const createInochi2DController = async ({
  wasmUrl,
  debug = false,
} = {}) => {
  patchWebGlClampToBorder();

  await initInochi2d({
    module_or_path: wasmUrl,
  });

  const debugEnabled = debug === true;

  let canvas = null;
  let runtime = null;
  let mounted = false;
  let rafId = 0;

  let width = 1;
  let height = 1;
  let devicePixelRatio = 1;

  let lastTickTimestamp = null;

  /* -------------------------------------------------------
     Values
     ------------------------------------------------------- */

  const parameterValues = new Map();
  const vectorParameterValues = new Map();

  const parameterById = new Map();
  const parameterByUuid = new Map();

  const parameterHandleById = new Map();
  const unresolvedParameterHandleIds = new Set();

  const nodeHandleByName = new Map();

  const animationLibrary = new Map();

  /* -------------------------------------------------------
     Camera
     ------------------------------------------------------- */

  const cameraTransform = {
    x: 0,
    y: 0,
    scale: DEFAULT_CAMERA_SCALE,
  };

  let cameraMotionOffset = {
    x: 0,
    y: 0,
    scale: 0,
  };

  /* -------------------------------------------------------
     Runtime state
     ------------------------------------------------------- */

  let modelBytes = null;
  let puppetPayload = null;
  let motionPayload = null;

  let modelLoaded = false;

  /* -------------------------------------------------------
     Layers
     ------------------------------------------------------- */

  const blinkLayer = {
    mode: 'auto',
    left: 0,
    right: 0,
    activeParameterIds: [],
  };

  const gazeLayer = {
    mode: 'auto',
    x: 0,
    y: 0,
    activeParameterIds: [],
  };

  const lipSyncLayer = {
    mode: 'idle',
    targetOpen: 0,
    currentOpen: 0,
    viseme: 'neutral',
    pose: [0, 0],
  };

  const expressionLayer = {
    name: 'neutral',
    faceValues: {},
    mouthValues: {},
  };

  const parameterSourceById = new Map();
  const parameterOwnerById = new Map();

  /* -------------------------------------------------------
     Secondary motion
     ------------------------------------------------------- */

  let secondaryMotion = null;

  try {
    if (typeof createSecondaryMotionEngine === 'function') {
      secondaryMotion =
        createSecondaryMotionEngine();
    }
  } catch (error) {
    if (debugEnabled) {
      console.warn(
        '[Inochi Bridge] secondary motion init failed',
        error,
      );
    }
  }

  /* -------------------------------------------------------
     Debug
     ------------------------------------------------------- */

  const debugState = {
    initialized: true,
    mounted: false,
    modelLoaded: false,
    parameterCount: 0,
    mouthParameter: MOUTH_SHAPE_PARAMETER_ID,
    mouthFound: false,
    blinkParameters: [],
    gazeParameters: [],
    lastError: null,
  };

  function debugLog(...args) {
    if (debugEnabled) {
      console.log('[Inochi Bridge]', ...args);
    }
  }

  function debugWarn(...args) {
    if (debugEnabled) {
      console.warn('[Inochi Bridge]', ...args);
    }
  }

  /* =======================================================
     Parameter registration
     ======================================================= */

  function registerParameter(parameter) {
    if (!parameter) {
      return;
    }

    const rawName =
      parameter.name ??
      parameter.id ??
      parameter.parameter_id ??
      '';

    const name = normalizeParameterName(rawName);

    if (!name) {
      return;
    }

    const uuid =
      parameter.uuid ??
      parameter.id_uuid ??
      parameter.parameter_uuid ??
      null;

    const entry = {
      ...parameter,
      name,
      uuid,
    };

    parameterById.set(name, entry);

    if (uuid !== null && uuid !== undefined) {
      parameterByUuid.set(
        String(uuid),
        entry,
      );
    }

    debugState.parameterCount =
      parameterById.size;
  }

  function scanParameters(payload) {
    if (!payload || typeof payload !== 'object') {
      return;
    }

    const params =
      payload.param ??
      payload.parameters ??
      payload.params ??
      [];

    if (Array.isArray(params)) {
      for (const parameter of params) {
        registerParameter(parameter);
      }
    } else if (
      params &&
      typeof params === 'object'
    ) {
      for (const [id, parameter] of Object.entries(
        params,
      )) {
        if (
          parameter &&
          typeof parameter === 'object'
        ) {
          registerParameter({
            id,
            ...parameter,
          });
        }
      }
    }
  }

  /* =======================================================
     Animation library
     ======================================================= */

  function scanAnimations(payload) {
    animationLibrary.clear();

    if (!payload || typeof payload !== 'object') {
      return;
    }

    const animations =
      payload.animations ??
      payload.animation ??
      [];

    if (Array.isArray(animations)) {
      for (const animation of animations) {
        if (!animation) continue;

        const name =
          animation.name ??
          animation.id ??
          `animation-${animationLibrary.size}`;

        animationLibrary.set(
          String(name),
          animation,
        );
      }
    } else if (
      animations &&
      typeof animations === 'object'
    ) {
      for (const [name, animation] of Object.entries(
        animations,
      )) {
        animationLibrary.set(
          String(name),
          animation,
        );
      }
    }
  }

  function rebuildAnimationLibrary(
    payload,
    loadedMotionPayload = null,
  ) {
    parameterById.clear();
    parameterByUuid.clear();
    animationLibrary.clear();

    scanParameters(payload);
    scanAnimations(payload);

    if (
      loadedMotionPayload &&
      typeof loadedMotionPayload === 'object'
    ) {
      scanAnimations(loadedMotionPayload);
    }

    debugState.mouthFound =
      parameterById.has(
        MOUTH_SHAPE_PARAMETER_ID,
      ) ||
      [...parameterById.keys()].some((id) =>
        MOUTH_PARAMETER_ID_RE.test(id),
      );

    debugState.blinkParameters =
      getBlinkParameterIds();

    debugState.gazeParameters =
      getGazeParameterIds();

    debugLog(
      'PARAMETERS',
      [...parameterById.keys()],
    );

    debugLog(
      'MOUTH',
      debugState.mouthFound
        ? 'FOUND'
        : 'NOT FOUND',
    );
  }

  /* =======================================================
     Parameter handles
     ======================================================= */

  function resolveParameterHandle(
    parameterId,
  ) {
    if (!runtime || !parameterId) {
      return 0;
    }

    if (
      parameterHandleById.has(parameterId)
    ) {
      return parameterHandleById.get(
        parameterId,
      );
    }

    try {
      const handle =
        runtime.resolve_parameter_handle_by_name(
          parameterId,
        );

      if (
        Number.isFinite(handle) &&
        handle !== 0
      ) {
        parameterHandleById.set(
          parameterId,
          handle,
        );

        unresolvedParameterHandleIds.delete(
          parameterId,
        );

        return handle;
      }
    } catch (error) {
      debugWarn(
        'parameter handle error',
        parameterId,
        error,
      );
    }

    unresolvedParameterHandleIds.add(
      parameterId,
    );

    return 0;
  }

  function resolveNodeHandle(nodeName) {
    if (!runtime || !nodeName) {
      return 0;
    }

    if (nodeHandleByName.has(nodeName)) {
      return nodeHandleByName.get(nodeName);
    }

    try {
      const handle =
        runtime.resolve_node_handle_by_name(
          nodeName,
        );

      if (
        Number.isFinite(handle) &&
        handle !== 0
      ) {
        nodeHandleByName.set(
          nodeName,
          handle,
        );

        return handle;
      }
    } catch (error) {
      debugWarn(
        'node handle error',
        nodeName,
        error,
      );
    }

    return 0;
  }

  /* =======================================================
     Runtime setters
     ======================================================= */

  function setScalarParameterValue(
    parameterId,
    value,
  ) {
    if (!runtime) {
      return false;
    }

    const numericValue =
      safeNumber(value);

    const handle =
      resolveParameterHandle(parameterId);

    try {
      if (handle) {
        /*
         * The current WASM wrapper exposes
         * scalar-by-name but not scalar-by-handle.
         * Therefore scalar values use the public
         * name-based API.
         */
        runtime.set_parameter_scalar(
          parameterId,
          numericValue,
        );
      } else {
        runtime.set_parameter_scalar(
          parameterId,
          numericValue,
        );
      }

      parameterValues.set(
        parameterId,
        numericValue,
      );

      return true;
    } catch (error) {
      debugWarn(
        'set scalar failed',
        parameterId,
        numericValue,
        error,
      );

      return false;
    }
  }

  function setParameterVectorValue(
    parameterId,
    valueX,
    valueY,
  ) {
    if (!runtime) {
      return false;
    }

    const x = safeNumber(valueX);
    const y = safeNumber(valueY);

    const handle =
      resolveParameterHandle(parameterId);

    try {
      if (handle) {
        runtime.set_parameter_vec2_by_handle(
          handle,
          x,
          y,
        );
      } else {
        runtime.set_parameter_vec2(
          parameterId,
          x,
          y,
        );
      }

      vectorParameterValues.set(
        parameterId,
        [x, y],
      );

      return true;
    } catch (error) {
      debugWarn(
        'set vec2 failed',
        parameterId,
        x,
        y,
        error,
      );

      return false;
    }
  }

  function markParameterSource(
    parameterId,
    source,
    owner = null,
  ) {
    parameterSourceById.set(
      parameterId,
      source,
    );

    if (owner) {
      parameterOwnerById.set(
        parameterId,
        owner,
      );
    }
  }

  /* =======================================================
     Public parameter API
     ======================================================= */

  function setParameterValue(
    parameterId,
    value,
  ) {
    if (Array.isArray(value)) {
      return setParameterVectorValue(
        parameterId,
        value[0],
        value[1],
      );
    }

    return setScalarParameterValue(
      parameterId,
      value,
    );
  }

  function setParameterVec2(
    parameterId,
    x,
    y,
  ) {
    return setParameterVectorValue(
      parameterId,
      x,
      y,
    );
  }

  /* =======================================================
     Apply stored parameters
     ======================================================= */

  function applyParameters(
    excludedParameterIds = new Set(),
  ) {
    for (
      const [
        parameterId,
        value,
      ] of parameterValues
    ) {
      if (
        excludedParameterIds.has(parameterId)
      ) {
        continue;
      }

      setScalarParameterValue(
        parameterId,
        value,
      );
    }

    for (
      const [
        parameterId,
        value,
      ] of vectorParameterValues
    ) {
      if (
        excludedParameterIds.has(parameterId)
      ) {
        continue;
      }

      setParameterVectorValue(
        parameterId,
        value[0],
        value[1],
      );
    }
  }

  /* =======================================================
     Blink
     ======================================================= */

  function getBlinkParameterIds() {
    return AUTO_BLINK_PARAMETER_IDS.filter(
      (id) => parameterById.has(id),
    );
  }

  function setEyeBlinkLayerValue(
    leftValue,
    rightValue,
    options = {},
  ) {
    blinkLayer.mode =
      options.mode ?? 'manual';

    blinkLayer.left =
      clamp01(leftValue);

    blinkLayer.right =
      clamp01(rightValue);

    blinkLayer.activeParameterIds =
      getBlinkParameterIds();

    const leftId =
      'Eye:: Left:: Blink';

    const rightId =
      'Eye:: Right:: Blink';

    if (
      parameterById.has(leftId)
    ) {
      setScalarParameterValue(
        leftId,
        blinkLayer.left,
      );

      markParameterSource(
        leftId,
        'blink',
        'blink-layer',
      );
    }

    if (
      parameterById.has(rightId)
    ) {
      setScalarParameterValue(
        rightId,
        blinkLayer.right,
      );

      markParameterSource(
        rightId,
        'blink',
        'blink-layer',
      );
    }

    if (
      parameterById.has('Blink')
    ) {
      setScalarParameterValue(
        'Blink',
        Math.max(
          blinkLayer.left,
          blinkLayer.right,
        ),
      );

      markParameterSource(
        'Blink',
        'blink',
        'blink-layer',
      );
    }
  }

  function setBlink(
    value,
    side = 'both',
  ) {
    const v = clamp01(value);

    if (side === 'left') {
      setEyeBlinkLayerValue(
        v,
        blinkLayer.right,
        {
          mode: 'manual',
        },
      );
    } else if (side === 'right') {
      setEyeBlinkLayerValue(
        blinkLayer.left,
        v,
        {
          mode: 'manual',
        },
      );
    } else {
      setEyeBlinkLayerValue(
        v,
        v,
        {
          mode: 'manual',
        },
      );
    }
  }

  /* =======================================================
     Gaze
     ======================================================= */

  function getGazeParameterIds() {
    return Object.values(
      AUTO_GAZE_PARAMETER_IDS,
    ).filter((id) =>
      parameterById.has(id),
    );
  }

  function isGazeParameterWritable(
    parameterId,
  ) {
    return parameterById.has(
      parameterId,
    );
  }

  function setGaze(
    x,
    y,
    options = {},
  ) {
    gazeLayer.mode =
      options.mode ?? 'manual';

    gazeLayer.x =
      clamp(x, -1, 1);

    gazeLayer.y =
      clamp(y, -1, 1);

    gazeLayer.activeParameterIds =
      getGazeParameterIds();

    const leftX =
      AUTO_GAZE_PARAMETER_IDS.leftX;

    const rightX =
      AUTO_GAZE_PARAMETER_IDS.rightX;

    const leftY =
      AUTO_GAZE_PARAMETER_IDS.leftY;

    const rightY =
      AUTO_GAZE_PARAMETER_IDS.rightY;

    if (
      isGazeParameterWritable(leftX)
    ) {
      setScalarParameterValue(
        leftX,
        gazeLayer.x,
      );

      markParameterSource(
        leftX,
        'gaze',
        'gaze-layer',
      );
    }

    if (
      isGazeParameterWritable(rightX)
    ) {
      setScalarParameterValue(
        rightX,
        gazeLayer.x,
      );

      markParameterSource(
        rightX,
        'gaze',
        'gaze-layer',
      );
    }

    if (
      isGazeParameterWritable(leftY)
    ) {
      setScalarParameterValue(
        leftY,
        gazeLayer.y,
      );

      markParameterSource(
        leftY,
        'gaze',
        'gaze-layer',
      );
    }

    if (
      isGazeParameterWritable(rightY)
    ) {
      setScalarParameterValue(
        rightY,
        gazeLayer.y,
      );

      markParameterSource(
        rightY,
        'gaze',
        'gaze-layer',
      );
    }
  }

  function resolveAutoGaze(
    timestamp,
  ) {
    const t =
      safeNumber(timestamp) / 1000;

    return {
      x: Math.sin(t * 0.7) * 0.035,
      y: Math.sin(t * 0.53) * 0.025,
    };
  }

  /* =======================================================
     Mouth / lip sync
     ======================================================= */

  function resolveLipSyncPose(
    openAmount,
    viseme = 'neutral',
  ) {
    const open =
      clamp01(openAmount);

    const pose =
      MOUTH_VISEME_POSES[
        viseme
      ] ??
      MOUTH_VISEME_POSES.neutral;

    return [
      clamp01(
        pose[0] * open,
      ),
      clamp01(
        pose[1] * open,
      ),
    ];
  }

  function setLipSyncLayerValue(
    value,
    options = {},
  ) {
    const nextOpen =
      clamp01(value);

    lipSyncLayer.mode =
      nextOpen <=
      LIP_SYNC_CLOSE_EPSILON
        ? 'idle'
        : 'speaking';

    lipSyncLayer.targetOpen =
      nextOpen;

    lipSyncLayer.viseme =
      options.viseme ??
      lipSyncLayer.viseme ??
      'neutral';

    lipSyncLayer.pose =
      resolveLipSyncPose(
        lipSyncLayer.currentOpen,
        lipSyncLayer.viseme,
      );

    setParameterVectorValue(
      MOUTH_SHAPE_PARAMETER_ID,
      lipSyncLayer.pose[0],
      lipSyncLayer.pose[1],
    );

    markParameterSource(
      MOUTH_SHAPE_PARAMETER_ID,
      `lip-sync:${lipSyncLayer.viseme}`,
      'lip-sync-layer',
    );
  }

  function setMouthOpen(
    value,
    viseme = 'a',
  ) {
    setLipSyncLayerValue(
      value,
      {
        viseme,
      },
    );
  }

  function setViseme(viseme) {
    const validViseme =
      MOUTH_VISEME_POSES[viseme]
        ? viseme
        : 'neutral';

    lipSyncLayer.viseme =
      validViseme;

    setLipSyncLayerValue(
      lipSyncLayer.targetOpen,
      {
        viseme: validViseme,
      },
    );
  }

  function updateLipSync(
    timestamp,
  ) {
    const previous =
      lipSyncLayer.currentOpen;

    const target =
      lipSyncLayer.targetOpen;

    const dt =
      lastTickTimestamp === null
        ? 16.67
        : Math.max(
            0,
            timestamp -
              lastTickTimestamp,
          );

    const opening =
      target > previous;

    const duration =
      opening
        ? LIP_SYNC_ATTACK_MS
        : LIP_SYNC_RELEASE_MS;

    const amount =
      duration <= 0
        ? 1
        : clamp01(
            dt / duration,
          );

    lipSyncLayer.currentOpen =
      lerp(
        previous,
        target,
        amount,
      );

    if (
      Math.abs(
        lipSyncLayer.currentOpen -
          target,
      ) <
      LIP_SYNC_CLOSE_EPSILON
    ) {
      lipSyncLayer.currentOpen =
        target;
    }

    const pose =
      resolveLipSyncPose(
        lipSyncLayer.currentOpen,
        lipSyncLayer.viseme,
      );

    lipSyncLayer.pose = pose;

    setParameterVectorValue(
      MOUTH_SHAPE_PARAMETER_ID,
      pose[0],
      pose[1],
    );

    markParameterSource(
      MOUTH_SHAPE_PARAMETER_ID,
      `lip-sync:${lipSyncLayer.viseme}`,
      'lip-sync-layer',
    );
  }

  /* =======================================================
     Expression
     ======================================================= */

  function setExpression(
    name = 'neutral',
  ) {
    const preset =
      EXPRESSION_PRESETS[name] ??
      EXPRESSION_PRESETS.neutral;

    expressionLayer.name =
      name in EXPRESSION_PRESETS
        ? name
        : 'neutral';

    expressionLayer.faceValues = {
      ...preset.faceValues,
    };

    expressionLayer.mouthValues = {
      ...preset.mouthValues,
    };

    for (
      const [
        parameterId,
        value,
      ] of Object.entries(
        expressionLayer.faceValues,
      )
    ) {
      if (
        Array.isArray(value)
      ) {
        setParameterVectorValue(
          parameterId,
          value[0],
          value[1],
        );
      } else {
        setScalarParameterValue(
          parameterId,
          value,
        );
      }

      markParameterSource(
        parameterId,
        `expression:${expressionLayer.name}`,
        'expression-layer',
      );
    }

    /*
     * Expression mouth values are only applied
     * while lip-sync is idle.
     *
     * This is important:
     * speaking must be able to override
     * the expression mouth.
     */
    if (
      lipSyncLayer.currentOpen <=
      LIP_SYNC_CLOSE_EPSILON
    ) {
      for (
        const [
          parameterId,
          value,
        ] of Object.entries(
          expressionLayer.mouthValues,
        )
      ) {
        if (
          Array.isArray(value)
        ) {
          setParameterVectorValue(
            parameterId,
            value[0],
            value[1],
          );
        } else {
          setScalarParameterValue(
            parameterId,
            value,
          );
        }

        markParameterSource(
          parameterId,
          `expression:${expressionLayer.name}`,
          'expression-layer',
        );
      }
    }

    return expressionLayer.name;
  }

  /* =======================================================
     Secondary motion
     ======================================================= */

  let previousSpeechOpen = 0;

  function applySpeechSecondaryMotionDriver() {
    const current =
      lipSyncLayer.currentOpen;

    const delta =
      current -
      previousSpeechOpen;

    previousSpeechOpen =
      current;

    if (
      !secondaryMotion ||
      Math.abs(delta) <
        SPEECH_SECONDARY_MOTION_MIN_DELTA
    ) {
      return;
    }

    const impulseX =
      delta *
      SPEECH_SECONDARY_MOTION_IMPULSE_X;

    const impulseY =
      delta *
      SPEECH_SECONDARY_MOTION_IMPULSE_Y;

    try {
      if (
        typeof secondaryMotion.impulse ===
        'function'
      ) {
        secondaryMotion.impulse(
          impulseX,
          impulseY,
        );
      } else if (
        typeof secondaryMotion.addImpulse ===
        'function'
      ) {
        secondaryMotion.addImpulse(
          impulseX,
          impulseY,
        );
      }
    } catch (error) {
      debugWarn(
        'secondary motion error',
        error,
      );
    }
  }

  function updateSecondaryMotion() {
    if (!secondaryMotion) {
      return;
    }

    try {
      if (
        typeof secondaryMotion.update ===
        'function'
      ) {
        secondaryMotion.update(
          1 / 60,
        );
      } else if (
        typeof secondaryMotion.step ===
        'function'
      ) {
        secondaryMotion.step(
          1 / 60,
        );
      }
    } catch (_) {}
  }

  /* =======================================================
     Camera
     ======================================================= */

  function setCameraTransform(
    x,
    y,
    scale,
  ) {
    cameraTransform.x =
      safeNumber(x);

    cameraTransform.y =
      safeNumber(y);

    cameraTransform.scale =
      Math.max(
        0.001,
        safeNumber(
          scale,
          DEFAULT_CAMERA_SCALE,
        ),
      );

    applyCamera();
  }

  function applyCamera() {
    if (!runtime) {
      return;
    }

    try {
      runtime.set_camera_transform(
        cameraTransform.x +
          cameraMotionOffset.x,

        cameraTransform.y +
          cameraMotionOffset.y,

        Math.max(
          0.001,
          cameraTransform.scale +
            cameraMotionOffset.scale,
        ),
      );
    } catch (error) {
      debugWarn(
        'camera failed',
        error,
      );
    }
  }

  /* =======================================================
     Head sway
     ======================================================= */

  function setHeadSwayOffset(
    x,
    y,
  ) {
    if (!runtime) {
      return;
    }

    try {
      runtime.set_head_sway_offset(
        safeNumber(x),
        safeNumber(y),
      );
    } catch (_) {}
  }

  /* =======================================================
     Parts / nodes
     ======================================================= */

  function setPartOpacity(
    nodeName,
    opacity,
  ) {
    if (!runtime) {
      return false;
    }

    const value =
      clamp01(opacity);

    const handle =
      resolveNodeHandle(nodeName);

    try {
      if (handle) {
        runtime.set_part_opacity_by_handle(
          handle,
          value,
        );
      } else {
        runtime.set_part_opacity_by_name(
          nodeName,
          value,
        );
      }

      return true;
    } catch (error) {
      debugWarn(
        'opacity failed',
        nodeName,
        error,
      );

      return false;
    }
  }

  /* =======================================================
     Model loading
     ======================================================= */

  async function loadModel(
    modelUrl,
    motionUrl = null,
  ) {
    if (!runtime) {
      throw new Error(
        'Inochi2D runtime is not mounted.',
      );
    }

    debugLog(
      'MODEL LOADING',
      modelUrl,
    );

    const response =
      await fetch(modelUrl);

    if (!response.ok) {
      throw new Error(
        `Model HTTP ${response.status}`,
      );
    }

    const arrayBuffer =
      await response.arrayBuffer();

    modelBytes =
      new Uint8Array(arrayBuffer);

    puppetPayload =
      decodePuppetPayload(
        modelBytes,
      );

    motionPayload =
      await loadMotionPayload(
        motionUrl,
      );

    /*
     * The actual model is loaded by the
     * Rust/WASM runtime.
     */
    runtime.load_model(
      modelBytes,
    );

    /*
     * Parameter metadata is used only by
     * the bridge to know what exists.
     */
    rebuildAnimationLibrary(
      puppetPayload,
      motionPayload,
    );

    /*
     * Clear stale handles after every model load.
     */
    parameterHandleById.clear();
    unresolvedParameterHandleIds.clear();
    nodeHandleByName.clear();

    parameterValues.clear();
    vectorParameterValues.clear();

    blinkLayer.activeParameterIds =
      getBlinkParameterIds();

    gazeLayer.activeParameterIds =
      getGazeParameterIds();

    modelLoaded = true;
    debugState.modelLoaded = true;

    /*
     * Important:
     * Param #1 is the known mouth parameter
     * from the current model.
     */
    if (
      parameterById.has(
        MOUTH_SHAPE_PARAMETER_ID,
      )
    ) {
      debugState.mouthFound = true;
    }

    debugLog(
      'MODEL LOADED',
      {
        parameters:
          [...parameterById.keys()],
        mouth:
          debugState.mouthFound,
        blink:
          blinkLayer.activeParameterIds,
        gaze:
          gazeLayer.activeParameterIds,
      },
    );

    return {
      loaded: true,
      parameters:
        [...parameterById.keys()],
      animations:
        [...animationLibrary.keys()],
      mouthParameter:
        MOUTH_SHAPE_PARAMETER_ID,
      mouthFound:
        debugState.mouthFound,
    };
  }

  /* =======================================================
     Resize
     ======================================================= */

  function resize(
    nextWidth,
    nextHeight,
    nextDevicePixelRatio = 1,
  ) {
    width =
      Math.max(
        1,
        safeNumber(nextWidth, 1),
      );

    height =
      Math.max(
        1,
        safeNumber(nextHeight, 1),
      );

    devicePixelRatio =
      Math.max(
        1,
        safeNumber(
          nextDevicePixelRatio,
          1,
        ),
      );

    if (!runtime) {
      return;
    }

    try {
      runtime.resize(
        width,
        height,
        devicePixelRatio,
      );
    } catch (error) {
      debugWarn(
        'resize failed',
        error,
      );
    }
  }

  /* =======================================================
     Frame
     ======================================================= */

  function tick(timestamp) {
    if (!runtime || !modelLoaded) {
      return;
    }

    const now =
      safeNumber(
        timestamp,
        performance.now(),
      );

    /*
     * Lip sync interpolation happens before
     * the WASM frame is evaluated.
     */
    updateLipSync(now);

    /*
     * Speech motion follows the mouth state.
     */
    applySpeechSecondaryMotionDriver();

    updateSecondaryMotion();

    /*
     * Auto gaze is intentionally very subtle.
     * Manual gaze overrides it.
     */
    if (
      gazeLayer.mode === 'auto'
    ) {
      const gaze =
        resolveAutoGaze(now);

      setGaze(
        gaze.x,
        gaze.y,
        {
          mode: 'auto',
        },
      );
    }

    applyCamera();

    try {
      runtime.tick(now);
    } catch (error) {
      debugState.lastError =
        String(
          error?.message ??
          error,
        );

      debugWarn(
        'runtime tick failed',
        error,
      );
    }

    lastTickTimestamp = now;
  }

  function frameLoop(timestamp) {
    if (!mounted) {
      return;
    }

    tick(timestamp);

    rafId =
      requestAnimationFrame(
        frameLoop,
      );
  }

  /* =======================================================
     Mount / unmount
     ======================================================= */

  function mount(
    targetCanvas,
  ) {
    if (!targetCanvas) {
      throw new Error(
        'Canvas is required.',
      );
    }

    if (mounted) {
      return;
    }

    canvas =
      targetCanvas;

    runtime =
      new Inochi2dRuntime(
        canvas,
      );

    mounted = true;
    debugState.mounted = true;

    resize(
      canvas.clientWidth ||
        canvas.width ||
        1,

      canvas.clientHeight ||
        canvas.height ||
        1,

      window.devicePixelRatio ||
        1,
    );

    applyCamera();

    cancelAnimationFrame(
      rafId,
    );

    rafId =
      requestAnimationFrame(
        frameLoop,
      );

    debugLog(
      'MOUNTED',
    );
  }

  function unmount() {
    mounted = false;
    debugState.mounted = false;

    cancelAnimationFrame(
      rafId,
    );

    rafId = 0;

    if (runtime) {
      try {
        runtime.clear();
      } catch (_) {}

      try {
        runtime.free();
      } catch (_) {}
    }

    runtime = null;
    canvas = null;
    modelLoaded = false;
    debugState.modelLoaded = false;
  }

  /* =======================================================
     Animation API
     ======================================================= */

  function getAnimationNames() {
    return [
      ...animationLibrary.keys(),
    ];
  }

  function playAnimation(
    name,
    options = {},
  ) {
    const animation =
      animationLibrary.get(
        String(name),
      );

    if (!animation) {
      debugWarn(
        'animation not found',
        name,
      );

      return false;
    }

    /*
     * Animation playback is kept intentionally
     * lightweight here because the current
     * WASM wrapper does not expose a generic
     * play_animation() method.
     *
     * Parameter-based motion payloads can still
     * be consumed by the bridge when available.
     */
    if (
      Array.isArray(
        animation.parameters,
      )
    ) {
      for (
        const item of
        animation.parameters
      ) {
        if (!item) continue;

        const id =
          item.id ??
          item.parameter_id ??
          item.name;

        if (!id) continue;

        const value =
          item.value;

        if (
          Array.isArray(value)
        ) {
          setParameterVectorValue(
            id,
            value[0],
            value[1],
          );
        } else if (
          value !== undefined
        ) {
          setScalarParameterValue(
            id,
            value,
          );
        }
      }
    }

    return true;
  }

  /* =======================================================
     Direct motion helpers
     ======================================================= */

  function setPostPhysicsParameterVec2(
    parameterId,
    x,
    y,
  ) {
    if (!runtime) {
      return false;
    }

    try {
      runtime.set_post_physics_parameter_vec2(
        parameterId,
        safeNumber(x),
        safeNumber(y),
      );

      return true;
    } catch (error) {
      debugWarn(
        'post physics parameter failed',
        error,
      );

      return false;
    }
  }

  function setPostPhysicsTransformOffset(
    nodeName,
    tx,
    ty,
    rz,
    sx,
    sy,
  ) {
    if (!runtime) {
      return false;
    }

    const handle =
      resolveNodeHandle(nodeName);

    try {
      if (handle) {
        runtime.set_post_physics_transform_offset_by_handle(
          handle,
          safeNumber(tx),
          safeNumber(ty),
          safeNumber(rz),
          safeNumber(sx, 1),
          safeNumber(sy, 1),
        );
      } else {
        runtime.set_post_physics_transform_offset_by_name(
          nodeName,
          safeNumber(tx),
          safeNumber(ty),
          safeNumber(rz),
          safeNumber(sx, 1),
          safeNumber(sy, 1),
        );
      }

      return true;
    } catch (error) {
      debugWarn(
        'post physics transform failed',
        error,
      );

      return false;
    }
  }

  /* =======================================================
     Debug information
     ======================================================= */

  function getDebugState() {
    return {
      ...debugState,

      parameterNames:
        [...parameterById.keys()],

      animationNames:
        [...animationLibrary.keys()],

      mouthParameter:
        MOUTH_SHAPE_PARAMETER_ID,

      mouthFound:
        parameterById.has(
          MOUTH_SHAPE_PARAMETER_ID,
        ),

      blinkParameters:
        getBlinkParameterIds(),

      gazeParameters:
        getGazeParameterIds(),

      lipSync: {
        ...lipSyncLayer,
        pose: [
          ...lipSyncLayer.pose,
        ],
      },

      expression: {
        ...expressionLayer,
      },

      mounted,

      modelLoaded,
    };
  }

  function getParameterNames() {
    return [
      ...parameterById.keys(),
    ];
  }

  function hasParameter(
    parameterId,
  ) {
    /*
     * The metadata may be incomplete for some
     * models, so also try the WASM handle.
     */
    if (
      parameterById.has(parameterId)
    ) {
      return true;
    }

    return (
      resolveParameterHandle(
        parameterId,
      ) !== 0
    );
  }

  /* =======================================================
     Public controller
     ======================================================= */

  return {
    /* lifecycle */
    mount,
    unmount,
    resize,
    loadModel,

    /* camera */
    setCameraTransform,
    setHeadSwayOffset,

    /* parameters */
    setParameterValue,
    setParameterVec2,
    hasParameter,
    getParameterNames,

    /* blink */
    setBlink,
    setEyeBlinkLayerValue,

    /* gaze */
    setGaze,

    /* mouth */
    setMouthOpen,
    setViseme,
    setLipSyncLayerValue,

    /* expression */
    setExpression,

    /* animation */
    getAnimationNames,
    playAnimation,

    /* parts */
    setPartOpacity,

    /* physics */
    setPostPhysicsParameterVec2,
    setPostPhysicsTransformOffset,

    /* debug */
    getDebugState,

    /* raw access */
    getRuntime() {
      return runtime;
    },

    getCanvas() {
      return canvas;
    },

    isMounted() {
      return mounted;
    },

    isModelLoaded() {
      return modelLoaded;
    },

    /* direct tick */
    tick,

    /* constants exposed for UI/debug */
    constants: {
      MOUTH_SHAPE_PARAMETER_ID,
      MOUTH_VISEME_POSES: {
        ...MOUTH_VISEME_POSES,
      },
      AUTO_BLINK_PARAMETER_IDS: [
        ...AUTO_BLINK_PARAMETER_IDS,
      ],
      AUTO_GAZE_PARAMETER_IDS: {
        ...AUTO_GAZE_PARAMETER_IDS,
      },
    },
  };
};

export default createInochi2DController;

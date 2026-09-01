/* =========================================================
   Inochi2D Physics Module
   ---------------------------------------------------------
   Inochi2D の物理計算を担当。
   担当:
   - Physics state
   - Physics parameter
   - Physics input
   - 外部 impulse
   - 速度 / 変位
   - 減衰
   - Physics update
   - Physics reset
   非担当:
   - モデル読み込み
   - Runtime 初期化
   - Parameter の直接管理
   - Lip Sync
   - Blink
   - Gaze
   - Expression
   - Animation
   - Camera
   - Render
   注意:
   Inochi Runtime 自体が Physics を処理できる場合は、
   このモジュールは Runtime の Physics API を呼び出す
   薄いラッパーとして使用できる。
   ========================================================= */
export function createPhysicsController({
  runtime = null,
  parameterById = null,
  parameterValues = null,
  setScalarParameterValue = null,
  setParameterVectorValue = null,
  markParameterSource = null,
  ensureLoop = null,
  enabled = true,
  defaultDamping = 0.18,
  maxDeltaTimeMs = 100,
  debugEnabled = false,
} = {}) {
  /* -------------------------------------------------------
     Physics State
     ------------------------------------------------------- */
  let physicsEnabled = !!enabled;
  let lastTimestamp = 0;
  let deltaTimeMs = 0;
  let deltaTimeSeconds = 0;
  let physicsFrame = 0;
  let physicsInputs =
    new Map();
  let physicsValues =
    new Map();
  let physicsVelocities =
    new Map();
  let physicsOffsets =
    new Map();
  let physicsImpulses =
    new Map();
  let physicsDamping =
    new Map();
  let runtimePhysicsAvailable =
    false;
  /* -------------------------------------------------------
     Debug
     ------------------------------------------------------- */
  const debugState = {
    updates: 0,
    lastDeltaTimeMs: 0,
    activeInputs: 0,
    activePhysicsValues: 0,
    impulses: 0,
    runtimeAvailable: false,
  };
  const log = (...args) => {
    if (!debugEnabled) {
      return;
    }
    console.info(
      '[Inochi2D physics]',
      ...args,
    );
  };
  /* -------------------------------------------------------
     Utility
     ------------------------------------------------------- */
  const finiteOr = (
    value,
    fallback = 0,
  ) =>
    Number.isFinite(value)
      ? value
      : fallback;
  const clamp = (
    value,
    min,
    max,
  ) =>
    Math.min(
      max,
      Math.max(min, value),
    );
  const clamp01 = (value) =>
    clamp(
      finiteOr(value, 0),
      0,
      1,
    );
  const getNow = () =>
    typeof performance !==
      'undefined'
      ? performance.now()
      : Date.now();
  const safeMapSet = (
    map,
    key,
    value,
  ) => {
    if (
      map instanceof Map &&
      key !== null &&
      key !== undefined
    ) {
      map.set(key, value);
    }
  };
  /* -------------------------------------------------------
     Runtime Physics Detection
     ------------------------------------------------------- */
  const detectRuntimePhysics = () => {
    if (!runtime) {
      runtimePhysicsAvailable =
        false;
      debugState.runtimeAvailable =
        false;
      return false;
    }
    runtimePhysicsAvailable =
      typeof runtime.update_physics ===
        'function' ||
      typeof runtime.updatePhysics ===
        'function' ||
      typeof runtime.step_physics ===
        'function' ||
      typeof runtime.stepPhysics ===
        'function';
    debugState.runtimeAvailable =
      runtimePhysicsAvailable;
    return runtimePhysicsAvailable;
  };
  detectRuntimePhysics();
  /* -------------------------------------------------------
     Physics Parameter Registration
     ------------------------------------------------------- */
  const registerParameter = (
    parameterId,
    {
      value = 0,
      velocity = 0,
      offset = 0,
      damping = defaultDamping,
    } = {},
  ) => {
    if (
      parameterId === null ||
      parameterId === undefined
    ) {
      return false;
    }
    const id =
      String(parameterId);
    safeMapSet(
      physicsValues,
      id,
      finiteOr(value, 0),
    );
    safeMapSet(
      physicsVelocities,
      id,
      finiteOr(velocity, 0),
    );
    safeMapSet(
      physicsOffsets,
      id,
      finiteOr(offset, 0),
    );
    safeMapSet(
      physicsDamping,
      id,
      clamp(
        finiteOr(
          damping,
          defaultDamping,
        ),
        0,
        1,
      ),
    );
    return true;
  };
  const unregisterParameter = (
    parameterId,
  ) => {
    const id =
      String(parameterId);
    physicsValues.delete(id);
    physicsVelocities.delete(id);
    physicsOffsets.delete(id);
    physicsDamping.delete(id);
    physicsInputs.delete(id);
    physicsImpulses.delete(id);
    return true;
  };
  /* -------------------------------------------------------
     Input
     ------------------------------------------------------- */
  const setInput = (
    parameterId,
    value,
  ) => {
    if (
      parameterId === null ||
      parameterId === undefined
    ) {
      return false;
    }
    const id =
      String(parameterId);
    const nextValue =
      finiteOr(value, 0);
    physicsInputs.set(
      id,
      nextValue,
    );
    if (
      !physicsValues.has(id)
    ) {
      registerParameter(id);
    }
    return true;
  };
  const getInput = (
    parameterId,
  ) => {
    const id =
      String(parameterId);
    return (
      physicsInputs.get(id) ?? 0
    );
  };
  const clearInput = (
    parameterId,
  ) => {
    const id =
      String(parameterId);
    physicsInputs.delete(id);
  };
  const clearInputs = () => {
    physicsInputs.clear();
  };
  /* -------------------------------------------------------
     Impulse
     ------------------------------------------------------- */
  const addImpulse = (
    parameterId,
    value,
  ) => {
    if (
      parameterId === null ||
      parameterId === undefined
    ) {
      return false;
    }
    const id =
      String(parameterId);
    const impulse =
      finiteOr(value, 0);
    if (!physicsImpulses.has(id)) {
      physicsImpulses.set(
        id,
        0,
      );
    }
    physicsImpulses.set(
      id,
      physicsImpulses.get(id) +
        impulse,
    );
    if (
      !physicsValues.has(id)
    ) {
      registerParameter(id);
    }
    return true;
  };
  const getImpulse = (
    parameterId,
  ) => {
    const id =
      String(parameterId);
    return (
      physicsImpulses.get(id) ?? 0
    );
  };
  const clearImpulse = (
    parameterId,
  ) => {
    const id =
      String(parameterId);
    physicsImpulses.delete(id);
  };
  const clearImpulses = () => {
    physicsImpulses.clear();
  };
  /* -------------------------------------------------------
     Damping
     ------------------------------------------------------- */
  const setDamping = (
    parameterId,
    damping,
  ) => {
    const id =
      String(parameterId);
    physicsDamping.set(
      id,
      clamp(
        finiteOr(
          damping,
          defaultDamping,
        ),
        0,
        1,
      ),
    );
    if (
      !physicsValues.has(id)
    ) {
      registerParameter(
        id,
        { damping },
      );
    }
    return true;
  };
  const getDamping = (
    parameterId,
  ) => {
    const id =
      String(parameterId);
    return (
      physicsDamping.get(id) ??
      defaultDamping
    );
  };
  /* -------------------------------------------------------
     Direct Value
     ------------------------------------------------------- */
  const setValue = (
    parameterId,
    value,
  ) => {
    const id =
      String(parameterId);
    const next =
      finiteOr(value, 0);
    physicsValues.set(
      id,
      next,
    );
    if (
      !physicsVelocities.has(id)
    ) {
      physicsVelocities.set(
        id,
        0,
      );
    }
    if (
      !physicsOffsets.has(id)
    ) {
      physicsOffsets.set(
        id,
        0,
      );
    }
    return true;
  };
  const getValue = (
    parameterId,
  ) => {
    const id =
      String(parameterId);
    return (
      physicsValues.get(id) ?? 0
    );
  };
  /* -------------------------------------------------------
     Velocity
     ------------------------------------------------------- */
  const setVelocity = (
    parameterId,
    velocity,
  ) => {
    const id =
      String(parameterId);
    physicsVelocities.set(
      id,
      finiteOr(velocity, 0),
    );
    if (
      !physicsValues.has(id)
    ) {
      registerParameter(id);
    }
    return true;
  };
  const getVelocity = (
    parameterId,
  ) => {
    const id =
      String(parameterId);
    return (
      physicsVelocities.get(id) ??
      0
    );
  };
  /* -------------------------------------------------------
     Offset
     ------------------------------------------------------- */
  const setOffset = (
    parameterId,
    offset,
  ) => {
    const id =
      String(parameterId);
    physicsOffsets.set(
      id,
      finiteOr(offset, 0),
    );
    if (
      !physicsValues.has(id)
    ) {
      registerParameter(id);
    }
    return true;
  };
  const getOffset = (
    parameterId,
  ) => {
    const id =
      String(parameterId);
    return (
      physicsOffsets.get(id) ?? 0
    );
  };
  /* -------------------------------------------------------
     Runtime Physics Update
     ------------------------------------------------------- */
  const updateRuntimePhysics = (
    dt,
  ) => {
    if (
      !runtime ||
      !runtimePhysicsAvailable
    ) {
      return false;
    }
    try {
      if (
        typeof runtime.update_physics ===
        'function'
      ) {
        runtime.update_physics(
          dt,
        );
        return true;
      }
      if (
        typeof runtime.updatePhysics ===
        'function'
      ) {
        runtime.updatePhysics(
          dt,
        );
        return true;
      }
      if (
        typeof runtime.step_physics ===
        'function'
      ) {
        runtime.step_physics(
          dt,
        );
        return true;
      }
      if (
        typeof runtime.stepPhysics ===
        'function'
      ) {
        runtime.stepPhysics(
          dt,
        );
        return true;
      }
    } catch (error) {
      log(
        'runtime physics update failed',
        error,
      );
      return false;
    }
    return false;
  };
  /* -------------------------------------------------------
     Local Physics Step
     ------------------------------------------------------- */
  const stepLocalPhysics = (
    dtSeconds,
  ) => {
    if (
      dtSeconds <= 0
    ) {
      return;
    }
    for (
      const [
        id,
        currentValue,
      ] of physicsValues
    ) {
      const input =
        physicsInputs.get(id) ??
        0;
      const impulse =
        physicsImpulses.get(id) ??
        0;
      let velocity =
        physicsVelocities.get(id) ??
        0;
      const damping =
        physicsDamping.get(id) ??
        defaultDamping;
      /*
       * 入力による加速度。
       *
       * ここでは過剰な物理挙動を避けるため、
       * 軽い spring 的な更新にしている。
       */
      const acceleration =
        input +
        impulse;
      velocity +=
        acceleration *
        dtSeconds;
      /*
       * 減衰。
       */
      const dampingFactor =
        Math.max(
          0,
          1 -
            damping *
              dtSeconds *
              60,
        );
      velocity *=
        dampingFactor;
      let nextValue =
        currentValue +
        velocity *
          dtSeconds;
      /*
       * 急激な数値暴走を防止。
       */
      nextValue = clamp(
        nextValue,
        -10,
        10,
      );
      physicsVelocities.set(
        id,
        velocity,
      );
      physicsValues.set(
        id,
        nextValue,
      );
      /*
       * Impulse は 1 frame で消費。
       */
      if (
        physicsImpulses.has(id)
      ) {
        physicsImpulses.set(
          id,
          0,
        );
      }
    }
  };
  /* -------------------------------------------------------
     Apply To Parameters
     ------------------------------------------------------- */
  const applyToParameters = () => {
    for (
      const [
        id,
        value,
      ] of physicsValues
    ) {
      /*
       * parameterById が存在する場合だけ
       * 実際の Parameter に書き込む。
       */
      if (
        parameterById &&
        typeof parameterById.has ===
          'function' &&
        !parameterById.has(id)
      ) {
        continue;
      }
      const baseValue =
        parameterValues &&
        typeof parameterValues.get ===
          'function'
          ? parameterValues.get(id)
          : 0;
      const offset =
        physicsOffsets.get(id) ??
        0;
      const finalValue =
        finiteOr(
          baseValue,
          0,
        ) +
        value +
        offset;
      if (
        typeof markParameterSource ===
        'function'
      ) {
        markParameterSource(
          id,
          'physics',
        );
      }
      if (
        typeof setScalarParameterValue ===
        'function'
      ) {
        setScalarParameterValue(
          id,
          finalValue,
        );
      }
    }
  };
  /* -------------------------------------------------------
     Main Update
     ------------------------------------------------------- */
  const update = (
    timestamp = getNow(),
  ) => {
    if (!physicsEnabled) {
      return {
        updated: false,
        deltaTimeMs: 0,
      };
    }
    let dtMs =
      lastTimestamp > 0
        ? timestamp -
          lastTimestamp
        : 16.667;
    dtMs = clamp(
      finiteOr(dtMs, 16.667),
      0,
      maxDeltaTimeMs,
    );
    lastTimestamp =
      timestamp;
    deltaTimeMs = dtMs;
    deltaTimeSeconds =
      dtMs / 1000;
    physicsFrame++;
    debugState.updates++;
    debugState.lastDeltaTimeMs =
      dtMs;
    debugState.activeInputs =
      physicsInputs.size;
    debugState.activePhysicsValues =
      physicsValues.size;
    debugState.impulses =
      [...physicsImpulses.values()]
        .filter(
          (value) =>
            Math.abs(value) >
            0.000001,
        ).length;
    /*
     * Runtime が Physics を持っている場合は
     * Runtime 側を優先。
     */
    const runtimeUpdated =
      updateRuntimePhysics(
        deltaTimeSeconds,
      );
    /*
     * Runtime Physics がない場合のみ
     * ローカル Physics を使用。
     */
    if (!runtimeUpdated) {
      stepLocalPhysics(
        deltaTimeSeconds,
      );
      applyToParameters();
    }
    if (
      typeof ensureLoop ===
      'function'
    ) {
      ensureLoop();
    }
    return {
      updated: true,
      runtimeUpdated,
      deltaTimeMs,
      deltaTimeSeconds,
      frame: physicsFrame,
    };
  };
  /* -------------------------------------------------------
     Enable / Disable
     ------------------------------------------------------- */
  const setEnabled = (
    value,
  ) => {
    physicsEnabled = !!value;
    return physicsEnabled;
  };
  const isEnabled = () =>
    physicsEnabled;
  /* -------------------------------------------------------
     Reset
     ------------------------------------------------------- */
  const reset = ({
    keepParameters = true,
  } = {}) => {
    lastTimestamp = 0;
    deltaTimeMs = 0;
    deltaTimeSeconds = 0;
    physicsFrame = 0;
    physicsInputs.clear();
    physicsImpulses.clear();
    physicsVelocities.clear();
    physicsOffsets.clear();
    if (!keepParameters) {
      physicsValues.clear();
      physicsDamping.clear();
    } else {
      for (
        const id of physicsValues.keys()
      ) {
        physicsValues.set(
          id,
          0,
        );
      }
    }
    debugState.updates = 0;
    debugState.lastDeltaTimeMs =
      0;
    debugState.activeInputs =
      0;
    debugState.activePhysicsValues =
      physicsValues.size;
    debugState.impulses = 0;
  };
  /* -------------------------------------------------------
     Clear
     ------------------------------------------------------- */
  const clear = () => {
    reset({
      keepParameters: false,
    });
  };
  /* -------------------------------------------------------
     State
     ------------------------------------------------------- */
  const getState = () => ({
    enabled:
      physicsEnabled,
    runtimeAvailable:
      runtimePhysicsAvailable,
    frame:
      physicsFrame,
    deltaTimeMs,
    deltaTimeSeconds,
    parameters: {
      values:
        Object.fromEntries(
          physicsValues.entries(),
        ),
      velocities:
        Object.fromEntries(
          physicsVelocities.entries(),
        ),
      offsets:
        Object.fromEntries(
          physicsOffsets.entries(),
        ),
      damping:
        Object.fromEntries(
          physicsDamping.entries(),
        ),
    },
    inputs:
      Object.fromEntries(
        physicsInputs.entries(),
      ),
    impulses:
      Object.fromEntries(
        physicsImpulses.entries(),
      ),
    debug: {
      ...debugState,
    },
  });
  /* -------------------------------------------------------
     Runtime refresh
     ------------------------------------------------------- */
  const refreshRuntime =
    () => {
      return detectRuntimePhysics();
    };
  /* -------------------------------------------------------
     Public API
     ------------------------------------------------------- */
  return {
    /*
     * Runtime
     */
    refreshRuntime,
    /*
     * Enable
     */
    setEnabled,
    isEnabled,
    /*
     * Parameters
     */
    registerParameter,
    unregisterParameter,
    setValue,
    getValue,
    setVelocity,
    getVelocity,
    setOffset,
    getOffset,
    setDamping,
    getDamping,
    /*
     * Input
     */
    setInput,
    getInput,
    clearInput,
    clearInputs,
    /*
     * Impulse
     */
    addImpulse,
    getImpulse,
    clearImpulse,
    clearImpulses,
    /*
     * Update
     */
    update,
    updateRuntimePhysics,
    applyToParameters,
    /*
     * State
     */
    getState,
    /*
     * Reset
     */
    reset,
    clear,
  };
}
export default {
  createPhysicsController,
};

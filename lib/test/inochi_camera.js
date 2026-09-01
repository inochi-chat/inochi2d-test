/* =========================================================
   Inochi2D Camera Module
   ---------------------------------------------------------
   カメラ位置・倍率・アニメーションによるカメラ移動だけを担当。
   本体側から後で完全に切り離しやすい構成。
   ========================================================= */

export function createCameraController({
  runtime,
  canvas,

  width = 1,
  height = 1,
  devicePixelRatio = 1,

  defaultScale = 1,
  minScale = 0.1,
  maxScale = 4,

  debugPrefix = 'inochi2d',
}) {
  let cameraTransform = {
    x: 0,
    y: 0,
    scale: defaultScale,
  };

  let cameraMotionOffset = {
    x: 0,
    y: 0,
    scale: 0,
  };

  let currentWidth = Math.max(1, width);
  let currentHeight = Math.max(1, height);
  let currentDevicePixelRatio = Math.max(
    1,
    devicePixelRatio || 1,
  );

  const clampScale = (value) =>
    Math.min(
      maxScale,
      Math.max(
        minScale,
        Number.isFinite(value)
          ? value
          : defaultScale,
      ),
    );

  const updateCanvasCameraDataset = (
    actualCameraTransform = getActualCameraTransform(),
  ) => {
    if (!canvas) {
      return;
    }

    canvas.dataset[`${debugPrefix}CameraScale`] =
      actualCameraTransform.scale.toFixed(4);

    canvas.dataset[`${debugPrefix}CameraX`] =
      actualCameraTransform.x.toFixed(2);

    canvas.dataset[`${debugPrefix}CameraY`] =
      actualCameraTransform.y.toFixed(2);
  };

  const getActualCameraTransform = () => ({
    x:
      cameraTransform.x +
      cameraMotionOffset.x,

    y:
      cameraTransform.y +
      cameraMotionOffset.y,

    scale: clampScale(
      cameraTransform.scale +
        cameraMotionOffset.scale,
    ),
  });

  const applyCameraTransform = () => {
    const actualCameraTransform =
      getActualCameraTransform();

    if (runtime) {
      runtime.set_camera_transform(
        actualCameraTransform.x,
        actualCameraTransform.y,
        actualCameraTransform.scale,
      );
    }

    updateCanvasCameraDataset(
      actualCameraTransform,
    );

    return actualCameraTransform;
  };

  const setCameraTransform = (
    x,
    y,
    scale,
  ) => {
    cameraTransform = {
      x: Number.isFinite(x) ? x : 0,

      y: Number.isFinite(y) ? y : 0,

      scale: clampScale(
        Number.isFinite(scale)
          ? scale
          : defaultScale,
      ),
    };

    return applyCameraTransform();
  };

  const setCameraPosition = (
    x,
    y,
  ) => {
    cameraTransform.x =
      Number.isFinite(x) ? x : 0;

    cameraTransform.y =
      Number.isFinite(y) ? y : 0;

    return applyCameraTransform();
  };

  const setCameraScale = (scale) => {
    cameraTransform.scale =
      clampScale(scale);

    return applyCameraTransform();
  };

  const setCameraMotionOffset = (
    x = 0,
    y = 0,
    scale = 0,
  ) => {
    cameraMotionOffset = {
      x: Number.isFinite(x) ? x : 0,
      y: Number.isFinite(y) ? y : 0,
      scale: Number.isFinite(scale)
        ? scale
        : 0,
    };

    return applyCameraTransform();
  };

  const resetCameraMotionOffset = () => {
    cameraMotionOffset = {
      x: 0,
      y: 0,
      scale: 0,
    };

    return applyCameraTransform();
  };

  const resetCameraTransform = () => {
    cameraTransform = {
      x: 0,
      y: 0,
      scale: defaultScale,
    };

    cameraMotionOffset = {
      x: 0,
      y: 0,
      scale: 0,
    };

    return applyCameraTransform();
  };

  const getBaseTransform = () => ({
    ...cameraTransform,
  });

  const getMotionOffset = () => ({
    ...cameraMotionOffset,
  });

  const getActualTransform = () => ({
    ...getActualCameraTransform(),
  });

  const getState = () => ({
    transform: {
      ...cameraTransform,
    },

    motionOffset: {
      ...cameraMotionOffset,
    },

    actualTransform:
      getActualCameraTransform(),

    viewport: {
      width: currentWidth,
      height: currentHeight,
      devicePixelRatio:
        currentDevicePixelRatio,
    },
  });

  const resize = (
    nextWidth,
    nextHeight,
    nextDevicePixelRatio,
  ) => {
    currentWidth = Math.max(
      1,
      Number.isFinite(nextWidth)
        ? nextWidth
        : currentWidth,
    );

    currentHeight = Math.max(
      1,
      Number.isFinite(nextHeight)
        ? nextHeight
        : currentHeight,
    );

    currentDevicePixelRatio =
      Math.max(
        1,
        Number.isFinite(
          nextDevicePixelRatio,
        )
          ? nextDevicePixelRatio
          : currentDevicePixelRatio,
      );

    if (canvas) {
      canvas.style.width =
        `${currentWidth}px`;

      canvas.style.height =
        `${currentHeight}px`;

      canvas.dataset[
        `${debugPrefix}DevicePixelRatio`
      ] =
        currentDevicePixelRatio.toFixed(3);
    }

    if (
      runtime &&
      typeof runtime.resize === 'function'
    ) {
      runtime.resize(
        currentWidth,
        currentHeight,
        currentDevicePixelRatio,
      );
    }

    applyCameraTransform();
  };

  const mount = (nextCanvas) => {
    canvas = nextCanvas;
    applyCameraTransform();
  };

  const unmount = () => {
    if (canvas) {
      delete canvas.dataset[
        `${debugPrefix}CameraScale`
      ];

      delete canvas.dataset[
        `${debugPrefix}CameraX`
      ];

      delete canvas.dataset[
        `${debugPrefix}CameraY`
      ];

      delete canvas.dataset[
        `${debugPrefix}DevicePixelRatio`
      ];
    }

    canvas = null;
  };

  return {
    setCameraTransform,
    setCameraPosition,
    setCameraScale,

    setMotionOffset,
    setCameraMotionOffset,

    resetMotionOffset,
    resetCameraMotionOffset,

    reset,
    resetCameraTransform,

    apply,
    applyCameraTransform,

    resize,

    getBaseTransform,
    getMotionOffset,
    getActualTransform,
    getState,

    mount,
    unmount,
  };
}

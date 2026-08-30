import { createInochi2DController } from "./inochi_bridge.js";

import {
  FaceLandmarker,
  FilesetResolver,
} from "@mediapipe/tasks-vision";


// ============================================================
// UI
// ============================================================

const statusBox = document.createElement("div");

statusBox.style.cssText = `
  position: fixed;
  top: 20px;
  left: 20px;
  z-index: 9999;

  color: lime;
  background: rgba(0,0,0,0.85);

  padding: 12px;

  font-family: monospace;
  font-size: 16px;

  white-space: pre-line;

  border-radius: 8px;
`;

statusBox.textContent = "STARTING...";

document.body.appendChild(statusBox);


// ============================================================
// Face Tracking UI
// ============================================================

const trackingInfo = document.getElementById(
  "tracking-info"
) as HTMLDivElement;

const video = document.getElementById(
  "face-camera"
) as HTMLVideoElement;


// ============================================================
// Face Landmarker
// ============================================================

let faceLandmarker: FaceLandmarker | null = null;

let lastVideoTime = -1;


// ============================================================
// Blendshape helper
// ============================================================

function getBlendshape(
  categories: any[],
  name: string
): number {
  const found = categories.find(
    (item) => item.categoryName === name
  );

  return found ? found.score : 0;
}


// ============================================================
// Start camera
// ============================================================

async function startCamera() {

  statusBox.textContent =
    "CAMERA STARTING...";

  const stream =
    await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",

        width: {
          ideal: 640,
        },

        height: {
          ideal: 480,
        },

        frameRate: {
          ideal: 30,
          max: 30,
        },
      },

      audio: false,
    });

  video.srcObject = stream;

  await video.play();

  statusBox.textContent =
    "CAMERA OK\nFACE TRACKING INITIALIZING...";
}


// ============================================================
// Initialize MediaPipe
// ============================================================

async function initializeFaceTracking() {

  const vision =
    await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm"
    );

  faceLandmarker =
    await FaceLandmarker.createFromOptions(
      vision,
      {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",

          delegate: "GPU",
        },

        runningMode: "VIDEO",

        numFaces: 1,

        outputFaceBlendshapes: true,

        outputFacialTransformationMatrixes: true,
      }
    );

  statusBox.textContent =
    "FACE TRACKING READY";
}


// ============================================================
// Face tracking loop
// ============================================================

function trackingLoop() {

  if (
    !faceLandmarker ||
    video.readyState < 2
  ) {
    requestAnimationFrame(trackingLoop);
    return;
  }


  if (
    video.currentTime !== lastVideoTime
  ) {

    lastVideoTime =
      video.currentTime;


    const result =
      faceLandmarker.detectForVideo(
        video,
        performance.now()
      );


    // --------------------------------------------------------
    // No face
    // --------------------------------------------------------

    if (
      !result.faceLandmarks ||
      result.faceLandmarks.length === 0
    ) {

      trackingInfo.textContent =
        `FACE TRACKING

NOT TRACKING

顔が見つかりません`;

    }

    // --------------------------------------------------------
    // Face detected
    // --------------------------------------------------------

    else {

      const blendshapes =
        result.faceBlendshapes?.[0]
          ?.categories ?? [];


      // Eye blink
      const eyeBlinkLeft =
        getBlendshape(
          blendshapes,
          "eyeBlinkLeft"
        );

      const eyeBlinkRight =
        getBlendshape(
          blendshapes,
          "eyeBlinkRight"
        );


      // Mouth
      const jawOpen =
        getBlendshape(
          blendshapes,
          "jawOpen"
        );


      // Mouth smile
      const mouthSmileLeft =
        getBlendshape(
          blendshapes,
          "mouthSmileLeft"
        );

      const mouthSmileRight =
        getBlendshape(
          blendshapes,
          "mouthSmileRight"
        );


      // ------------------------------------------------------
      // Basic face position
      // ------------------------------------------------------

      const landmarks =
        result.faceLandmarks[0];


      const nose =
        landmarks[1];


      const headX =
        (nose.x - 0.5) * 2;

      const headY =
        (nose.y - 0.5) * 2;


      // ------------------------------------------------------
      // Display
      // ------------------------------------------------------

      trackingInfo.textContent =
`FACE TRACKING

● TRACKING

Left Eye   : ${eyeBlinkLeft.toFixed(3)}
Right Eye  : ${eyeBlinkRight.toFixed(3)}

Mouth      : ${jawOpen.toFixed(3)}

Smile L    : ${mouthSmileLeft.toFixed(3)}
Smile R    : ${mouthSmileRight.toFixed(3)}

Head X     : ${headX.toFixed(3)}
Head Y     : ${headY.toFixed(3)}`;


      // ------------------------------------------------------
      // Console
      // ------------------------------------------------------

      console.log({
        eyeBlinkLeft,
        eyeBlinkRight,
        mouthOpen: jawOpen,
        mouthSmileLeft,
        mouthSmileRight,
        headX,
        headY,
      });
    }
  }


  requestAnimationFrame(trackingLoop);
}


// ============================================================
// Inochi2D
// ============================================================

async function startInochi() {

  statusBox.textContent =
    "WASM INITIALIZING...";


  const controller =
    await createInochi2DController({
      wasmUrl:
        "/inochi2d-test/inochi2d_bg.wasm",

      debug: true,
    });


  statusBox.textContent =
    "WASM INIT OK";


  const canvas =
    document.getElementById(
      "app"
    ) as HTMLCanvasElement;


  canvas.style.width =
    "100vw";

  canvas.style.height =
    "100vh";


  canvas.width =
    window.innerWidth;

  canvas.height =
    window.innerHeight;


  await controller.mount(canvas);


  statusBox.textContent =
    "MODEL LOADING...";


  await controller.loadModel(
    "/inochi2d-test/testplay2.inp"
  );


  statusBox.textContent =
    "MODEL LOADED!";


  await controller.resize(
    window.innerWidth,
    window.innerHeight,
    window.devicePixelRatio
  );


  await controller.setCameraTransform(
    0,
    0,
    0.15
  );


  // Existing test
  await controller.setParameterValue(
    "Param #0",
    1
  );


  console.log(
    "Controller:",
    controller
  );
}


// ============================================================
// START
// ============================================================

async function start() {

  try {

    // Inochi2D
    await startInochi();


    // Camera
    await startCamera();


    // MediaPipe
    await initializeFaceTracking();


    // Tracking loop
    trackingLoop();


    statusBox.textContent =
      "ALL SYSTEMS OK";

  }

  catch (error) {

    console.error(error);


    statusBox.textContent =
      "ERROR:\n" +
      String(error);


    statusBox.style.color =
      "red";
  }
}


start();

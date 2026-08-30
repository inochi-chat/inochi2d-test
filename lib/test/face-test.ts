const video = document.getElementById(
  "face-camera"
) as HTMLVideoElement;

const info = document.getElementById(
  "tracking-info"
) as HTMLDivElement;

function show(text: string) {
  info.textContent = text;
}

async function start() {
  try {
    show("CAMERA STARTING...");

    const stream =
      await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });

    video.srcObject = stream;

    await video.play();

    show(
      "CAMERA OK\n\n" +
      "MEDIAPIPE LOADING..."
    );

    const {
      FilesetResolver,
      FaceLandmarker
    } = await import(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs"
    );

    show(
      "MEDIAPIPE LOADED\n\n" +
      "FACE MODEL LOADING..."
    );

    const vision =
      await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
      );

    const faceLandmarker =
      await FaceLandmarker.createFromOptions(
        vision,
        {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",

            delegate: "GPU"
          },

          runningMode: "VIDEO",

          numFaces: 1,

          outputFaceBlendshapes: true,

          outputFacialTransformationMatrixes: true
        }
      );

    show(
      "FACE TRACKING READY\n\n" +
      "顔をカメラに映してね"
    );

    let lastVideoTime = -1;

    function trackingLoop() {
      if (
        video.readyState >= 2 &&
        video.currentTime !== lastVideoTime
      ) {
        lastVideoTime = video.currentTime;

        const result =
          faceLandmarker.detectForVideo(
            video,
            performance.now()
          );

        if (
          !result.faceLandmarks ||
          result.faceLandmarks.length === 0
        ) {
          show(
            "FACE TRACKING\n\n" +
            "NOT TRACKING"
          );
        } else {
          const categories =
            result.faceBlendshapes?.[0]
              ?.categories ?? [];

          function getValue(name: string) {
            const item = categories.find(
              (x: any) =>
                x.categoryName === name
            );

            return item
              ? item.score
              : 0;
          }

          const eyeBlinkLeft =
            getValue("eyeBlinkLeft");

          const eyeBlinkRight =
            getValue("eyeBlinkRight");

          const jawOpen =
            getValue("jawOpen");

          show(
            "FACE TRACKING\n\n" +
            "● TRACKING\n\n" +
            `Left Eye  : ${eyeBlinkLeft.toFixed(3)}\n` +
            `Right Eye : ${eyeBlinkRight.toFixed(3)}\n` +
            `Mouth     : ${jawOpen.toFixed(3)}`
          );

          console.log({
            eyeBlinkLeft,
            eyeBlinkRight,
            jawOpen
          });
        }
      }

      requestAnimationFrame(trackingLoop);
    }

    trackingLoop();

  } catch (error) {
    console.error(error);

    show(
      "ERROR\n\n" +
      String(error)
    );
  }
}

start();

export {};

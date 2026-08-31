export {};

declare global {
  interface Window {
    mediapipeTest?: {
      FaceLandmarker: any;
      FilesetResolver: any;
    };
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const video = document.getElementById(
    "face-camera"
  ) as HTMLVideoElement;

  const info = document.getElementById(
    "tracking-info"
  ) as HTMLDivElement;

  const home = document.getElementById(
    "home"
  ) as HTMLDivElement;

  const startButton = document.getElementById(
    "start-button"
  ) as HTMLButtonElement;

  if (!video || !info || !home || !startButton) {
    document.body.innerHTML = `
      <div style="
        color:white;
        background:#111;
        padding:30px;
        font-family:monospace;
      ">
        HTML ELEMENT NOT FOUND
      </div>
    `;

    return;
  }

  function show(text: string) {
    info.textContent = text;
  }

  async function startCamera() {
    try {
      startButton.disabled = true;
      startButton.textContent = "起動中...";

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

      video.style.display = "block";
      home.style.display = "none";
      info.style.display = "block";

      await video.play();

      show(
        "CAMERA OK\n\n" +
        "MEDIAPIPE CHECKING..."
      );

      if (!window.mediapipeTest) {
        throw new Error(
          "MediaPipe CDN NOT LOADED"
        );
      }

      const {
        FaceLandmarker,
        FilesetResolver
      } = window.mediapipeTest;

      show(
        "CAMERA OK\n\n" +
        "MEDIAPIPE OK\n\n" +
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

            outputFaceBlendshapes: true
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
            !result.faceBlendshapes ||
            result.faceBlendshapes.length === 0
          ) {
            show(
              "FACE TRACKING\n\n" +
              "NOT TRACKING"
            );
          } else {
            const categories =
              result.faceBlendshapes[0].categories;

            function getValue(name: string) {
              const item = categories.find(
                (x: any) =>
                  x.categoryName === name
              );

              return item
                ? item.score
                : 0;
            }

            const left =
              getValue("eyeBlinkLeft");

            const right =
              getValue("eyeBlinkRight");

            const mouth =
              getValue("jawOpen");

            show(
              "FACE TRACKING\n\n" +
              "● TRACKING\n\n" +
              `Left Eye  : ${left.toFixed(3)}\n` +
              `Right Eye : ${right.toFixed(3)}\n` +
              `Mouth     : ${mouth.toFixed(3)}`
            );
          }
        }

        requestAnimationFrame(trackingLoop);
      }

      trackingLoop();

    } catch (error) {
      console.error(error);

      info.style.display = "block";

      show(
        "ERROR\n\n" +
        String(error)
      );
    }
  }

  startButton.addEventListener(
    "click",
    startCamera
  );
});

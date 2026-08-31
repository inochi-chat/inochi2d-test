import { createInochi2DController } from "./inochi_bridge.js";

declare global {
  interface Window {
    mediapipeTest?: {
      FaceLandmarker: any;
      FilesetResolver: any;
    };
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  const videoElement = document.getElementById("face-camera");
  const infoElement = document.getElementById("tracking-info");
  const homeElement = document.getElementById("home");
  const startButtonElement = document.getElementById("start-button");
  const canvasElement = document.getElementById("app");

  // -------------------------
  // HTML確認
  // -------------------------

  if (!(videoElement instanceof HTMLVideoElement)) {
    document.body.innerHTML = "ERROR: face-camera";
    return;
  }

  if (!(infoElement instanceof HTMLDivElement)) {
    document.body.innerHTML = "ERROR: tracking-info";
    return;
  }

  if (!(homeElement instanceof HTMLDivElement)) {
    document.body.innerHTML = "ERROR: home";
    return;
  }

  if (!(startButtonElement instanceof HTMLButtonElement)) {
    document.body.innerHTML = "ERROR: start-button";
    return;
  }

  if (!(canvasElement instanceof HTMLCanvasElement)) {
    document.body.innerHTML = "ERROR: app";
    return;
  }

  // -------------------------
  // nullではない
  // -------------------------

  const video = videoElement;
  const info = infoElement;
  const home = homeElement;
  const startButton = startButtonElement;
  const canvas = canvasElement;

  function show(text: string) {
    info.textContent = text;
  }

  // -------------------------
  // 起動
  // -------------------------

  async function start() {
    try {
      startButton.disabled = true;
      startButton.textContent = "起動中...";

      show("CAMERA STARTING...");

      // -------------------------
      // カメラ
      // -------------------------

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
          },
          audio: false,
        });

      video.srcObject = stream;

      await video.play();

      video.style.display = "block";
      home.style.display = "none";
      info.style.display = "block";

      show(
        "CAMERA OK\n\n" +
        "INOCHI2D INITIALIZING..."
      );

      // -------------------------
      // Inochi2D
      // -------------------------

      const controller =
        await createInochi2DController({
          wasmUrl:
            "/inochi2d-test/inochi2d_bg.wasm",
          debug: true,
        });

      show(
        "CAMERA OK\n\n" +
        "INOCHI2D INITIALIZED\n\n" +
        "MOUNTING..."
      );

      // -------------------------
      // Canvas
      // -------------------------

      canvas.style.position = "fixed";
      canvas.style.inset = "0";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.zIndex = "1";

      // -------------------------
      // Mount
      // -------------------------

      await controller.mount(canvas);

      show(
        "CAMERA OK\n\n" +
        "INOCHI2D MOUNT OK\n\n" +
        "MODEL LOADING..."
      );

      // -------------------------
      // モデル
      // -------------------------

      await controller.loadModel(
        "/inochi2d-test/testplay2.inp"
      );

      // -------------------------
      // パラメータ確認
      // -------------------------

      const parameterDebugInfo =
        controller.getParameterDebugInfo();

      const parameterLines: string[] =
        parameterDebugInfo.map(
          (parameter: any) =>
            `${parameter.id} | ` +
            `Vec2:${parameter.isVec2} | ` +
            `default:${parameter.defaultValue.join(",")}`
        );

      // -------------------------
      // パラメータ表示
      // -------------------------

      show(
        "MODEL LOADED!\n\n" +
        "モデルパラメータ:\n\n" +
        (
          parameterLines.length > 0
            ? parameterLines.join("\n")
            : "パラメータなし"
        ) +
        "\n\n" +
        "RESIZE..."
      );

      // -------------------------
      // サイズ
      // -------------------------

      await controller.resize(
        window.innerWidth,
        window.innerHeight,
        window.devicePixelRatio
      );

      // -------------------------
      // カメラ
      // -------------------------

      await controller.setCameraTransform(
        0,
        0,
        0.15
      );

      // -------------------------
      // MediaPipe
      // -------------------------

      show(
        "MODEL LOADED!\n\n" +
        "INOCHI2D OK\n\n" +
        "MEDIAPIPE INITIALIZING..."
      );

      const mp = window.mediapipeTest;

      if (!mp) {
        throw new Error(
          "MediaPipeが読み込まれていません"
        );
      }

      const {
        FaceLandmarker,
        FilesetResolver,
      } = mp;

      // -------------------------
      // Vision
      // -------------------------

      const vision =
        await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
        );

      // -------------------------
      // FaceLandmarker
      // -------------------------

      const faceLandmarker =
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
          }
        );

      // -------------------------
      // MediaPipe OK
      // -------------------------

      show(
        "MODEL LOADED!\n\n" +
        "MEDIAPIPE OK\n\n" +
        "顔を認識しています..."
      );

      // -------------------------
      // 顔トラッキング
      // -------------------------

      let lastVideoTime = -1;

      function trackingLoop() {
        if (
          video.readyState >= 2 &&
          video.currentTime !== lastVideoTime
        ) {
          lastVideoTime =
            video.currentTime;

          const result =
            faceLandmarker.detectForVideo(
              video,
              performance.now()
            );

          const blendshapes =
            result.faceBlendshapes?.[0]
              ?.categories;

          // -------------------------
          // 顔あり
          // -------------------------

          if (blendshapes) {
            const jawOpen =
              blendshapes.find(
                (item: any) =>
                  item.categoryName ===
                  "jawOpen"
              );

            const mouthValue =
              jawOpen?.score ?? 0;

            // -------------------------
            // 口パク
            // -------------------------

            void controller.setLipSyncValue(
              Math.min(1, mouthValue),
              {
                immediate: true,
              }
            );

            show(
              "FACE TRACKING OK\n\n" +
              "口の開き: " +
              mouthValue.toFixed(3) +
              "\n\n" +
              "パラメータ:\n" +
              parameterLines.join("\n")
            );
          }

          // -------------------------
          // 顔なし
          // -------------------------

          else {
            void controller.setLipSyncValue(
              0,
              {
                immediate: true,
              }
            );

            show(
              "MEDIAPIPE OK\n\n" +
              "顔が見つかりません\n\n" +
              "パラメータ:\n" +
              parameterLines.join("\n")
            );
          }
        }

        requestAnimationFrame(
          trackingLoop
        );
      }

      // -------------------------
      // トラッキング開始
      // -------------------------

      trackingLoop();

    } catch (error) {
      console.error(error);

      startButton.disabled = false;
      startButton.textContent =
        "カメラを起動";

      info.style.display = "block";

      show(
        "ERROR\n\n" +
        String(error)
      );
    }
  }

  // -------------------------
  // ボタン
  // -------------------------

  startButton.addEventListener(
    "click",
    () => {
      void start();
    }
  );
});

export {};

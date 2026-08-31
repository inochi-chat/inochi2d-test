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
  const video = videoElement;
  const info = infoElement;
  const home = homeElement;
  const startButton = startButtonElement;
  const canvas = canvasElement;
  function show(text: string) {
    info.textContent = text;
  }
  async function start() {
    try {
      startButton.disabled = true;
      startButton.textContent = "起動中...";
      show("CAMERA STARTING...");
      // -------------------------
      // カメラ起動
      // -------------------------
      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
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
        "INOKI2D INITIALIZING..."
      );
      // -------------------------
      // Inochi2D初期化
      // -------------------------
      const controller =
        await createInochi2DController({
          wasmUrl:
            "/inochi2d-test/inochi2d_bg.wasm",
          debug: true,
        });
      show(
        "CAMERA OK\n\n" +
        "INOKI2D INITIALIZED\n\n" +
        "MOUNTING..."
      );
      // -------------------------
      // Canvas設定
      // -------------------------
      canvas.style.position = "fixed";
      canvas.style.inset = "0";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.zIndex = "1";
      // -------------------------
      // Inochi2DをCanvasへ接続
      // -------------------------
      await controller.mount(canvas);
      show(
        "CAMERA OK\n\n" +
        "INOKI2D MOUNT OK\n\n" +
        "MODEL LOADING..."
      );
      // -------------------------
      // モデル読み込み
      // -------------------------
      await controller.loadModel(
        "/inochi2d-test/testplay2.inp"
      );
      // -------------------------
      // 口パラメータ確認
      // -------------------------
      const debugState = controller.getDebugState();
      const mouthParameterExists =
        debugState.canvasDataset?.inochi2dMouthShapeExists;
      show(
        "MODEL LOADED!\n\n" +
        "Mouth:: Shape exists: " +
        String(mouthParameterExists)
      );
      // -------------------------
      // サイズ調整
      // -------------------------
      await controller.resize(
        window.innerWidth,
        window.innerHeight,
        window.devicePixelRatio
      );
      // -------------------------
      // カメラ位置
      // -------------------------
      await controller.setCameraTransform(
        0,
        0,
        0.15
      );
      // -------------------------
      // MediaPipe開始
      // -------------------------
      show(
        "MODEL LOADED!\n\n" +
        "INOKI2D OK\n\n" +
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
      // MediaPipe Vision
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
            result.faceBlendshapes?.[0]?.categories;
          if (blendshapes) {
            const jawOpen =
              blendshapes.find(
                (item: any) =>
                  item.categoryName === "jawOpen"
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
              "Mouth:: Shape exists: " +
              String(mouthParameterExists)
            );
          } else {
            void controller.setLipSyncValue(0);
            show(
              "MEDIAPIPE OK\n\n" +
              "顔が見つかりません\n\n" +
              "Mouth:: Shape exists: " +
              String(mouthParameterExists)
            );
          }
        }
        requestAnimationFrame(
          trackingLoop
        );
      }
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
  // 起動ボタン
  // -------------------------
  startButton.addEventListener(
    "click",
    () => {
      void start();
    }
  );
});
export {};

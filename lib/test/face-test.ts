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
      await controller.mount(canvas);
      show(
        "CAMERA OK\n\n" +
        "INOCHI2D MOUNT OK\n\n" +
        "MODEL LOADING..."
      );
      // -------------------------
      // モデル読み込み
      // -------------------------
      await controller.loadModel(
        "/inochi2d-test/testplay2.inp"
      );
      // -------------------------
      // パラメータ確認
      // -------------------------
      const debugState =
        controller.getDebugState() as any;
      const scalarParameters =
        debugState.scalarParameterValues ?? {};
      const vectorParameters =
        debugState.vectorParameterValues ?? {};
      const parameterNames = [
        ...Object.keys(scalarParameters),
        ...Object.keys(vectorParameters),
      ];
      show(
        "MODEL LOADED!\n\n" +
        "PARAMETERS:\n\n" +
        (
          parameterNames.length > 0
            ? parameterNames.join("\n")
            : "パラメータ取得失敗"
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
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            numFaces: 1,
            outputFaceBlendshapes: true,
          }
        );
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
          if (blendshapes) {
            // -------------------------
            // jawOpen
            // -------------------------
            const jawOpen =
              blendshapes.find(
                (item: any) =>
                  item.categoryName === "jawOpen"
              );
            const mouthValue =
             1 - (jawOpen?.score ?? 0);
            // -------------------------
            // テスト
            //
            // このモデルでは
            // Param #0
            // Param #1
            // が実際のパラメータ名。
            //
            // まず両方にjawOpenを入れる。
            // -------------------------
            void controller.setParameter(
              "Param #0",
              mouthValue
            );
            void controller.setParameter(
              "Param #1",
              mouthValue
            );
            show(
              "FACE TRACKING OK\n\n" +
              "口の開き: " +
              mouthValue.toFixed(3) +
              "\n\n" +
              "Param #0: " +
              mouthValue.toFixed(3) +
              "\n" +
              "Param #1: " +
              mouthValue.toFixed(3)
            );
          } else {
            // -------------------------
            // 顔なし
            // -------------------------
            void controller.setParameter(
              "Param #0",
              0
            );
            void controller.setParameter(
              "Param #1",
              0
            );
            show(
              "MEDIAPIPE OK\n\n" +
              "顔が見つかりません"
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
  startButton.addEventListener(
    "click",
    () => {
      void start();
    }
  );
});
export {};

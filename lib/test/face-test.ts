import { createInochi2DController } from "./inochi_bridge.js";
window.addEventListener("DOMContentLoaded", async () => {
  const videoElement = document.getElementById(
    "face-camera"
  );
  const infoElement = document.getElementById(
    "tracking-info"
  );
  const homeElement = document.getElementById(
    "home"
  );
  const startButtonElement = document.getElementById(
    "start-button"
  );
  const canvasElement = document.getElementById(
    "app"
  );
  // -------------------------
  // HTML確認
  // -------------------------
  if (!(videoElement instanceof HTMLVideoElement)) {
    document.body.innerHTML = `
      <div style="
        color:white;
        background:#111;
        padding:30px;
        font-family:monospace;
      ">
        ERROR<br><br>
        HTML ELEMENT NOT FOUND<br><br>
        Missing: face-camera
      </div>
    `;
    return;
  }
  if (!(infoElement instanceof HTMLDivElement)) {
    document.body.innerHTML = `
      <div style="
        color:white;
        background:#111;
        padding:30px;
        font-family:monospace;
      ">
        ERROR<br><br>
        HTML ELEMENT NOT FOUND<br><br>
        Missing: tracking-info
      </div>
    `;
    return;
  }
  if (!(homeElement instanceof HTMLDivElement)) {
    document.body.innerHTML = `
      <div style="
        color:white;
        background:#111;
        padding:30px;
        font-family:monospace;
      ">
        ERROR<br><br>
        HTML ELEMENT NOT FOUND<br><br>
        Missing: home
      </div>
    `;
    return;
  }
  if (!(startButtonElement instanceof HTMLButtonElement)) {
    document.body.innerHTML = `
      <div style="
        color:white;
        background:#111;
        padding:30px;
        font-family:monospace;
      ">
        ERROR<br><br>
        HTML ELEMENT NOT FOUND<br><br>
        Missing: start-button
      </div>
    `;
    return;
  }
  if (!(canvasElement instanceof HTMLCanvasElement)) {
    document.body.innerHTML = `
      <div style="
        color:white;
        background:#111;
        padding:30px;
        font-family:monospace;
      ">
        ERROR<br><br>
        HTML ELEMENT NOT FOUND<br><br>
        Missing: app
      </div>
    `;
    return;
  }
  // -------------------------
  // ここからnullではない
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
  // カメラ＋Inochi2D起動
  // -------------------------
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
      // -------------------------
      // カメラ表示
      // -------------------------
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
      // 完了
      // -------------------------
      show(
        "MODEL LOADED!\n\n" +
        "CAMERA OK\n" +
        "INOKI2D OK\n\n" +
        "顔トラッキング接続待ち"
      );
      console.log(
        "Inochi2D Controller:",
        controller
      );
    } catch (error) {
      console.error(error);
      startButton.disabled = false;
      startButton.textContent = "カメラを起動";
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

import { createInochi2DController } from "./inochi_bridge.js";
window.addEventListener("DOMContentLoaded", async () => {
  const video = document.getElementById(
    "face-camera"
  ) as HTMLVideoElement | null;
  const info = document.getElementById(
    "tracking-info"
  ) as HTMLDivElement | null;
  const home = document.getElementById(
    "home"
  ) as HTMLDivElement | null;
  const startButton = document.getElementById(
    "start-button"
  ) as HTMLButtonElement | null;
  if (!video || !info || !home || !startButton) {
    document.body.innerHTML = `
      <div style="
        color:white;
        background:#111;
        padding:30px;
        font-family:monospace;
      ">
        ERROR<br><br>
        HTML ELEMENT NOT FOUND
      </div>
    `;
    return;
  }
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
      show("CAMERA OK\n\nINOKI2D INITIALIZING...");
      // -------------------------
      // Inochi2D
      // -------------------------
      const controller =
        await createInochi2DController({
          wasmUrl:
            "/inochi2d-test/inochi2d_bg.wasm",
          debug: true,
        });
      show("WASM INIT OK\n\nMOUNTING...");
      const canvas =
        document.getElementById(
          "app"
        ) as HTMLCanvasElement | null;
      if (!canvas) {
        throw new Error(
          "Canvas #app not found."
        );
      }
      canvas.style.position = "fixed";
      canvas.style.inset = "0";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.zIndex = "1";
      await controller.mount(canvas);
      show("MOUNT OK\n\nMODEL LOADING...");
      // -------------------------
      // モデル
      // -------------------------
      await controller.loadModel(
        "/inochi2d-test/testplay2.inp"
      );
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
      show(
        "MODEL LOADED!\n\n" +
        "CAMERA OK\n" +
        "INOKI2D OK\n\n" +
        "次は顔トラッキング接続"
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
    start
  );
});
export {};

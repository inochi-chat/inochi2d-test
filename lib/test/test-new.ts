import { createInochi2DController } from "./inochi_bridge.js";

const statusBox = document.createElement("div");

statusBox.style.cssText = `
  position: fixed;
  top: 20px;
  left: 20px;
  z-index: 9999;
  color: lime;
  background: black;
  padding: 12px;
  font-size: 20px;
`;

statusBox.textContent = "BRIDGE IMPORT OK";
document.body.appendChild(statusBox);

async function start() {
  try {
    statusBox.textContent = "WASM INITIALIZING...";

    const controller = await createInochi2DController({
      wasmUrl: "/inochi2d-test/inochi2d_bg.wasm",
      debug: true,
    });

    statusBox.textContent = "WASM INIT OK";
    const canvas = document.getElementById("app") as HTMLCanvasElement;

canvas.style.width = "100vw";
canvas.style.height = "100vh";
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

await controller.mount(canvas);

statusBox.textContent = "MODEL LOADING...";

await controller.loadModel("/inochi2d-test/testplay2.inp");

statusBox.textContent = "MODEL LOADED!";
    const ctx = canvas.getContext("webgl2");

if (!ctx) {
  statusBox.textContent = "WEBGL2 ERROR";
  statusBox.style.color = "red";
  return;
}

statusBox.textContent = "MODEL LOADED + WEBGL2 OK";
await controller.resize(
  window.innerWidth,
  window.innerHeight,
  window.devicePixelRatio
);

await controller.setCameraTransform(0, 0, 0.15);

statusBox.textContent = "MODEL LOADED + CAMERA OK";    

console.log("Canvas:", canvas.width, canvas.height);
console.log("WebGL2:", ctx);
console.log("Controller:", controller);

    console.log("Controller:", controller);
  } catch (error) {
    console.error(error);

    statusBox.textContent =
      "WASM INIT ERROR: " + String(error);

    statusBox.style.color = "red";
  }
}

start();

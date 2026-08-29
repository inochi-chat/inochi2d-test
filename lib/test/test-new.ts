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

    console.log("Controller:", controller);
  } catch (error) {
    console.error(error);

    statusBox.textContent =
      "WASM INIT ERROR: " + String(error);

    statusBox.style.color = "red";
  }
}

start();

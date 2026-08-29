import { createInochi2DController } from "./inochi_bridge.js";

const statusBox = document.createElement("div");

statusBox.textContent = "BRIDGE IMPORT OK";

document.body.appendChild(statusBox);

console.log(
  "createInochi2DController:",
  typeof createInochi2DController
);

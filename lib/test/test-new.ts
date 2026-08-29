export {};

const statusBox = document.createElement(“div”);

statusBox.style.cssText = position: fixed; top: 20px; left: 20px; z-index: 9999; color: lime; background: black; padding: 12px; font-size: 20px;;

statusBox.textContent = “INOCHI2D START”;
document.body.appendChild(statusBox);

async function startInochi2D() {
try {
statusBox.textContent = “LOADING INOCHI2D…”;

const canvas = document.createElement("canvas");
canvas.style.cssText = `
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  z-index: 1;
`;
document.body.appendChild(canvas);
const module = await import(
  "/inochi2d/runtime/inochi_bridge.js"
);
const createInochi2DController =
  module.createInochi2DController;
if (typeof createInochi2DController !== "function") {
  throw new Error(
    "createInochi2DController が見つかりません"
  );
}
statusBox.textContent = "INITIALIZING WASM...";
const controller = await createInochi2DController({
  wasmUrl:
    "/inochi2d/runtime/inochi2d_bg.wasm",
  debug: true,
});
statusBox.textContent = "MOUNTING...";
await controller.mount(canvas);
statusBox.textContent = "LOADING MODEL...";
await controller.loadModel(
  "/testplay2.inp"
);
statusBox.textContent =
  "INOCHI2D MODEL LOADED";
console.log(
  "Inochi2D controller:",
  controller
);

} catch (error) {
console.error(error);

statusBox.textContent =
  "INOCHI2D ERROR: " +
  String(error);
statusBox.style.color = "red";

}
}

startInochi2D();

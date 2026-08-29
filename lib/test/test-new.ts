export {};

const box = document.createElement("div");

box.style.cssText = `
  position: fixed;
  top: 20px;
  left: 20px;
  z-index: 9999;
  color: lime;
  background: black;
  padding: 12px;
  font-size: 20px;
`;

box.textContent = "WASM INIT...";
document.body.appendChild(box);

async function testRuntime() {
  try {
    const moduleUrl = new URL(
      "/inochi2d.js",
      window.location.origin
    ).href;

    const runtimeModule = await (import(moduleUrl) as Promise<any>);

    await runtimeModule.default();

    box.textContent = "WASM INIT OK";

    console.log("inochi2d module:", runtimeModule);
    console.log("WASM initialization OK");
  } catch (error) {
    console.error(error);

    box.textContent = "WASM INIT ERROR: " + String(error);
    box.style.color = "red";
  }
}

testRuntime();

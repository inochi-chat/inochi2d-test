export {};

import init, { Inochi2dRuntime } from "/inochi2d.js";

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
    await init();

    const runtime = new Inochi2dRuntime();

    box.textContent = "RUNTIME OK";

    console.log("Inochi2dRuntime:", runtime);
  } catch (error) {
    console.error(error);

    box.textContent = "RUNTIME ERROR: " + String(error);
    box.style.color = "red";
  }
}

testRuntime();

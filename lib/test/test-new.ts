export {};

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

statusBox.textContent = "NEW TEST START";
document.body.appendChild(statusBox);

async function testWasm() {
  try {
    const response = await fetch("/inochi2d_bg.wasm");

    if (!response.ok) {
      throw new Error(`WASM HTTP ${response.status}`);
    }

    const bytes = await response.arrayBuffer();

    statusBox.textContent =
      `WASM FOUND: ${bytes.byteLength.toLocaleString()} bytes`;

    console.log("WASM found:", bytes.byteLength);
    } catch (error) {
    console.error(error);

    statusBox.textContent =
      "WASM ERROR: " + String(error);

    statusBox.style.color = "red";
  }

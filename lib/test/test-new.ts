const status = document.createElement("div");
status.style.cssText = `
  position: fixed;
  top: 20px;
  left: 20px;
  z-index: 9999;
  color: lime;
  background: black;
  padding: 12px;
  font-size: 20px;
`;
status.textContent = "NEW TEST START";
document.body.appendChild(status);

async function test() {
  try {
    const response = await fetch("/inochi2d_bg.wasm");

    if (!response.ok) {
      throw new Error(`WASM HTTP ${response.status}`);
    }

    const bytes = await response.arrayBuffer();

    status.textContent =
      `WASM FOUND: ${bytes.byteLength.toLocaleString()} bytes`;

    console.log("WASM found:", bytes.byteLength);
  } catch (error) {
    console.error(error);
    status.textContent = "WASM ERROR";
    status.style.color = "red";
  }
}

test();

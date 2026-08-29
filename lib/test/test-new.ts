const statusBox = document.createElement("div");

statusBox.textContent = "BRIDGE TEST";

document.body.appendChild(statusBox);

async function testBridge() {
  try {
    const bridge = await import(
      "/inochi2d/runtime/inochi_bridge.js"
    );

    console.log("BRIDGE:", bridge);

    statusBox.textContent =
      "BRIDGE FOUND: " +
      (typeof bridge.createInochi2DController);

  } catch (error) {
    console.error(error);

    statusBox.textContent =
      "BRIDGE ERROR: " + String(error);
  }
}

testBridge();

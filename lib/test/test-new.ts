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

box.textContent = "JS LOAD TEST...";
document.body.appendChild(box);

async function testRuntime() {
  try {
    const module = await import("/inochi2d.js");

    box.textContent = "JS OK";

    console.log("inochi2d.js loaded:", module);
  } catch (error) {
    console.error(error);

    box.textContent = "JS ERROR: " + String(error);
    box.style.color = "red";
  }
}

testRuntime();

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

box.textContent = "SCRIPT TEST";
document.body.appendChild(box);

const script = document.createElement("script");

script.type = "module";
script.src = "/inochi2d.js";

script.onload = () => {
  box.textContent = "JS LOADED";
  console.log("inochi2d.js loaded");
};

script.onerror = () => {
  box.textContent = "JS LOAD ERROR";
  box.style.color = "red";
  console.error("inochi2d.js failed to load");
};

document.head.appendChild(script);

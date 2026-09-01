import createInochi2DController from “./inochi_bridge_new.js”;

window.addEventListener(“DOMContentLoaded”, async () => {
const canvas = document.getElementById(
“app”
) as HTMLCanvasElement;

const video = document.getElementById(
“face-camera”
) as HTMLVideoElement;

const info = document.getElementById(
“tracking-info”
) as HTMLDivElement;

const home = document.getElementById(
“home”
) as HTMLDivElement;

const startButton = document.getElementById(
“start-button”
) as HTMLButtonElement;

if (!canvas || !video || !info || !home || !startButton) {
document.body.innerHTML = `
ERROR

    HTML ELEMENT NOT FOUND
    必要なID:
    app
    face-camera
    tracking-info
    home
    start-button
  </div>
`;
return;

}

function show(text: string) {
info.textContent = text;
}

/*

* =====================================================
* Inochi2D Bridge
* =====================================================
    */

let controller: any = null;

try {
show(“BRIDGE INITIALIZING…”);

controller = await createInochi2DController({
  wasmUrl: "/inochi2d-test/inochi2d_bg.wasm",
  debug: true,
});
show("BRIDGE OK\n\nWASM INITIALIZED");

} catch (error) {
console.error(error);

show(
  "BRIDGE ERROR\n\n" +
  String(error)
);
return;

}

/*

* =====================================================
* Canvas mount
* =====================================================
    */

try {
controller.mount(canvas);

show(
  "BRIDGE OK\n\n" +
  "CANVAS MOUNTED"
);

} catch (error) {
console.error(error);

show(
  "MOUNT ERROR\n\n" +
  String(error)
);
return;

}

/*

* =====================================================
* Model
* ここだけモデルの実際のパスに合わせる
* =====================================================
    */

async function loadModel() {
try {
show(
“MODEL LOADING…\n\n” +
“新しい Bridge を使用中”
);

  /*
   * ↓↓↓ ここを現在使っているモデルのパスにする
   */
  const result =
    await controller.loadModel(
      "/inochi2d-test/model.inp"
    );
  console.log(
    "[NEW BRIDGE] MODEL RESULT",
    result
  );
  console.log(
    "[NEW BRIDGE] DEBUG",
    controller.getDebugState()
  );
  show(
    "MODEL LOADED\n\n" +
    "PARAMETERS: " +
    result.parameters.length +
    "\n\n" +
    "MOUTH: " +
    (result.mouthFound
      ? "FOUND"
      : "NOT FOUND")
  );
} catch (error) {
  console.error(error);
  show(
    "MODEL ERROR\n\n" +
    String(error)
  );
}

}

/*

* =====================================================
* Camera
* =====================================================
    */

async function startCamera() {
try {
startButton.disabled = true;
startButton.textContent = “起動中…”;

  show("CAMERA STARTING...");
  const stream =
    await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
      },
      audio: false,
    });
  video.srcObject = stream;
  video.style.display = "block";
  home.style.display = "none";
  info.style.display = "block";
  await video.play();
  show(
    "CAMERA OK\n\n" +
    "MODEL / BRIDGE CHECKING..."
  );
  await loadModel();
} catch (error) {
  console.error(error);
  startButton.disabled = false;
  startButton.textContent = "カメラを起動";
  info.style.display = "block";
  show(
    "CAMERA ERROR\n\n" +
    String(error)
  );
}

}

startButton.addEventListener(
“click”,
startCamera
);

/*

* =====================================================
* Resize
* =====================================================
    */

function resizeCanvas() {
if (!controller) return;

const rect =
  canvas.getBoundingClientRect();
controller.resize(
  rect.width || window.innerWidth,
  rect.height || window.innerHeight,
  window.devicePixelRatio || 1
);

}

window.addEventListener(
“resize”,
resizeCanvas
);

resizeCanvas();

show(
“NEW BRIDGE READY\n\n” +
“「カメラを起動」を押してください”
);
});

export {};

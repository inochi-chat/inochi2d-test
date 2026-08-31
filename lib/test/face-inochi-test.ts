import * as Inochi2D from "../main";
import * as THREE from "three";

export {};

declare global {
  interface Window {
    mediapipeTest?: {
      FaceLandmarker: any;
      FilesetResolver: any;
    };
  }
}

// ================================
// Three.js / Inochi2D
// ================================

const scene = new THREE.Scene();

const aspectRatio =
  window.innerWidth / window.innerHeight;

const cameraWidth = 3000;
const cameraHeight =
  cameraWidth / aspectRatio;

const camera =
  new THREE.OrthographicCamera(
    cameraWidth / -2,
    cameraWidth / 2,
    cameraHeight / 2,
    cameraHeight / -2,
    0.01,
    10000
  );

camera.position.set(0, 1, 500);

const renderer =
  new THREE.WebGLRenderer({
    antialias: true
  });

renderer.setSize(
  window.innerWidth,
  window.innerHeight
);

renderer.domElement.style.position =
  "fixed";

renderer.domElement.style.left = "0";
renderer.domElement.style.top = "0";
renderer.domElement.style.zIndex = "1";

document.body.appendChild(
  renderer.domElement
);


// ================================
// Camera
// ================================

const video =
  document.getElementById(
    "face-camera"
  ) as HTMLVideoElement;

const info =
  document.getElementById(
    "tracking-info"
  ) as HTMLDivElement;

const home =
  document.getElementById(
    "home"
  ) as HTMLDivElement;

const startButton =
  document.getElementById(
    "start-button"
  ) as HTMLButtonElement;


// ================================
// 表示
// ================================

function show(text: string) {
  info.textContent = text;
}


// ================================
// モデル読み込み
// ================================

async function loadPuppet() {

  const puppet =
    await Inochi2D.INP.inImportFromURL(
      "testplay2.inp"
    );

  console.log(
    "Loaded " + puppet.meta + "!"
  );

  Inochi2D.Renderer.renderPuppet(
    puppet,
    scene,
    camera,
    renderer
  );

  console.log(
    "INOKHI2D MODEL READY"
  );

  return puppet;
}


// ================================
// カメラ＋顔認識
// ================================

async function start() {

  try {

    startButton.disabled = true;

    startButton.textContent =
      "起動中...";

    show(
      "CAMERA STARTING..."
    );


    // ----------------------------
    // カメラ
    // ----------------------------

    const stream =
      await navigator.mediaDevices
        .getUserMedia({
          video: {
            facingMode: "user",
            width: {
              ideal: 640
            },
            height: {
              ideal: 480
            }
          },
          audio: false
        });


    video.srcObject = stream;

    await video.play();


    video.style.display =
      "block";

    home.style.display =
      "none";

    info.style.display =
      "block";


    show(
      "CAMERA OK\n\n" +
      "INOKHI2D MODEL LOADING..."
    );


    // ----------------------------
    // Inochi2D
    // ----------------------------

    const puppet =
      await loadPuppet();


    show(
      "MODEL OK\n\n" +
      "MEDIAPIPE LOADING..."
    );


    // ----------------------------
    // MediaPipe
    // ----------------------------

    if (!window.mediapipeTest) {

      throw new Error(
        "MediaPipe CDN NOT LOADED"
      );

    }


    const {
      FaceLandmarker,
      FilesetResolver
    } = window.mediapipeTest;


    const vision =
      await FilesetResolver
        .forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
        );


    const faceLandmarker =
      await FaceLandmarker
        .createFromOptions(
          vision,
          {

            baseOptions: {

              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",

              delegate: "GPU"

            },

            runningMode: "VIDEO",

            numFaces: 1,

            outputFaceBlendshapes: true

          }
        );


    show(
      "FACE TRACKING READY\n\n" +
      "顔をカメラに映してね"
    );


    // ============================
    // トラッキング
    // ============================

    let lastVideoTime = -1;


    function trackingLoop() {

      if (
        video.readyState >= 2 &&
        video.currentTime !==
          lastVideoTime
      ) {

        lastVideoTime =
          video.currentTime;


        const result =
          faceLandmarker
            .detectForVideo(
              video,
              performance.now()
            );


        if (
          !result.faceBlendshapes ||
          result.faceBlendshapes.length === 0
        ) {

          show(
            "FACE TRACKING\n\n" +
            "NOT TRACKING"
          );

        } else {

          const categories =
            result.faceBlendshapes[0]
              .categories;


          function getValue(
            name: string
          ) {

            const item =
              categories.find(
                (x: any) =>
                  x.categoryName ===
                  name
              );

            return item
              ? item.score
              : 0;

          }


          const left =
            getValue(
              "eyeBlinkLeft"
            );

          const right =
            getValue(
              "eyeBlinkRight"
            );

          const mouth =
            getValue(
              "jawOpen"
            );


          // ------------------------
          // テスト
          // ------------------------

          console.log({
            eyeBlinkLeft: left,
            eyeBlinkRight: right,
            jawOpen: mouth
          });


          show(
            "FACE TRACKING\n\n" +
            "● TRACKING\n\n" +
            `Left Eye  : ${left.toFixed(3)}\n` +
            `Right Eye : ${right.toFixed(3)}\n` +
            `Mouth     : ${mouth.toFixed(3)}`
          );


          // ------------------------
          // Param #0
          // ------------------------
          //
          // まずは口の開きだけを
          // Param #0 に送る。
          //
          // puppet APIの実際の
          // パラメータ操作は、
          // 現在の橋渡し実装に
          // 合わせて次で調整する。
          //

        }

      }


      requestAnimationFrame(
        trackingLoop
      );

    }


    trackingLoop();


    // Three.js描画

    function render() {

      renderer.render(
        scene,
        camera
      );

      requestAnimationFrame(
        render
      );

    }

    render();


    console.log(
      "PUPPET:",
      puppet
    );


  } catch (error) {

    console.error(error);

    info.style.display =
      "block";

    show(
      "ERROR\n\n" +
      String(error)
    );

  }

}


// ================================
// ボタン
// ================================

startButton.addEventListener(
  "click",
  start
);

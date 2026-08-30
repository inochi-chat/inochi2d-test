const video = document.getElementById(
  "face-camera"
) as HTMLVideoElement;

const info = document.getElementById(
  "tracking-info"
) as HTMLDivElement;

const home = document.getElementById(
  "home"
) as HTMLDivElement;

const startButton = document.getElementById(
  "start-button"
) as HTMLButtonElement;

function show(text: string) {
  info.textContent = text;
}

async function startCamera() {
  try {
    startButton.disabled = true;
    startButton.textContent = "起動中...";

    show("CAMERA STARTING...");

    const stream =
      await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });

    video.srcObject = stream;

    await video.play();

    home.style.display = "none";
    video.style.display = "block";
    info.style.display = "block";

    show(
      "CAMERA OK\n\n" +
      "顔トラッキング準備中..."
    );

  } catch (error) {
    console.error(error);

    startButton.disabled = false;
    startButton.textContent = "カメラを起動";

    show(
      "CAMERA ERROR\n\n" +
      String(error)
    );
  }
}

startButton.addEventListener(
  "click",
  startCamera
);

export {};

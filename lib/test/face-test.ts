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
          facingMode: "user"
        },
        audio: false
      });

    video.srcObject = stream;

    // カメラ映像を表示
    video.style.display = "block";

    // ホーム画面を消す
    home.style.display = "none";

    // ステータス表示
    info.style.display = "block";

    // Safariで映像が再生可能になるまで待つ
    await new Promise<void>((resolve) => {
      if (video.readyState >= 2) {
        resolve();
      } else {
        video.onloadeddata = () => resolve();
      }
    });

    await video.play();

    show(
      "CAMERA OK\n\n" +
      "カメラ映像を表示中"
    );

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
  "click",
  startCamera
);

export {};

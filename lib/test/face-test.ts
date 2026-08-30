const video = document.getElementById(
  "face-camera"
) as HTMLVideoElement;

const info = document.getElementById(
  "tracking-info"
) as HTMLDivElement;

function show(text: string) {
  info.textContent = text;
}

async function startCamera() {
  try {
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

    show(
      "CAMERA OK\n\n" +
      "顔トラッキング準備中..."
    );

  } catch (error) {
    console.error(error);

    show(
      "CAMERA ERROR\n\n" +
      String(error)
    );
  }
}

startCamera();

export {};

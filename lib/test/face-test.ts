window.addEventListener("DOMContentLoaded", () => {

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

  if (!video || !info || !home || !startButton) {
    document.body.innerHTML = `
      <div style="
        color:white;
        background:#111;
        padding:30px;
        font-family:monospace;
      ">
        ERROR<br><br>
        HTML ELEMENT NOT FOUND
      </div>
    `;

    return;
  }

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

      video.style.display = "block";
      home.style.display = "none";
      info.style.display = "block";

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

});

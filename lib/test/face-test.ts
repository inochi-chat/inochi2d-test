export {};

window.addEventListener("DOMContentLoaded", () => {
  const video = document.getElementById("face-camera");
  const info = document.getElementById("tracking-info");
  const home = document.getElementById("home");
  const startButton = document.getElementById("start-button");

  const missing: string[] = [];

  if (!video) missing.push("face-camera");
  if (!info) missing.push("tracking-info");
  if (!home) missing.push("home");
  if (!startButton) missing.push("start-button");

  if (missing.length > 0) {
    document.body.innerHTML = `
      <div style="
        color: white;
        background: #111;
        padding: 30px;
        font-family: monospace;
        font-size: 18px;
      ">
        HTML ELEMENT NOT FOUND<br><br>
        Missing:<br>
        ${missing.join("<br>")}
      </div>
    `;

    return;
  }

  const videoElement = video as HTMLVideoElement;
  const infoElement = info as HTMLDivElement;
  const homeElement = home as HTMLDivElement;
  const startButtonElement = startButton as HTMLButtonElement;

  function show(text: string) {
    infoElement.textContent = text;
  }

  async function startCamera() {
    try {
      startButtonElement.disabled = true;
      startButtonElement.textContent = "起動中...";

      show("CAMERA STARTING...");

      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user"
          },
          audio: false
        });

      videoElement.srcObject = stream;

      videoElement.style.display = "block";
      homeElement.style.display = "none";
      infoElement.style.display = "block";

      await videoElement.play();

      show(
        "CAMERA OK\n\n" +
        "カメラ映像を表示中"
      );

    } catch (error) {
      console.error(error);

      startButtonElement.disabled = false;
      startButtonElement.textContent = "カメラを起動";

      infoElement.style.display = "block";

      show(
        "CAMERA ERROR\n\n" +
        String(error)
      );
    }
  }

  startButtonElement.addEventListener(
    "click",
    startCamera
  );
});

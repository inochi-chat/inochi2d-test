import init from '../../public/inochi2d.js';

async function test() {
  try {
    await init();

    document.body.innerHTML = `
      <h1 style="color:lime; font-size:40px;">
        WASM OK
      </h1>
    `;

    console.log("WASM OK");
  } catch (error) {
    console.error(error);

    document.body.innerHTML = `
      <h1 style="color:red; font-size:40px;">
        WASM ERROR
      </h1>
    `;
  }
}

test();

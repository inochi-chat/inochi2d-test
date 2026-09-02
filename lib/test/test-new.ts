import * as Inochi2D from '../main'
import * as THREE from 'three';

const scene = new THREE.Scene();

const aspectRatio = window.innerWidth / window.innerHeight;

const cameraWidth = 7000;
const cameraHeight = cameraWidth / aspectRatio;

const camera = new THREE.OrthographicCamera(
    cameraWidth / -2,
    cameraWidth / 2,
    cameraHeight / 2,
    cameraHeight / -2,
    0.01,
    10000
);

console.log("CAMERA:", camera.left, camera.right, camera.top, camera.bottom, camera.position.z);

camera.position.set(0, 7001, 500);

const renderer = new THREE.WebGLRenderer({
    antialias: true
});

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

console.log("CANVAS AFTER SIZE:", renderer.domElement.width, renderer.domElement.height);

document.body.appendChild(renderer.domElement);

async function loadPuppet() {
    try {
        const puppet = await Inochi2D.INP.inImportFromURL('testplay2.inp');

        console.log("PUPPET LOADED");
        console.log(puppet);

        console.log("BEFORE RENDER");

        try {
            Inochi2D.Renderer.renderPuppet(
                puppet,
                scene,
                camera,
                renderer
            );

            console.log("AFTER RENDER");
        } catch (error) {
            console.error("RENDER ERROR:", error);
        }

    } catch (error) {
        console.error("PUPPET LOAD ERROR", error);
    }
}

loadPuppet();

import * as Inochi2D from '../main'
import * as THREE from 'three';

const scene = new THREE.Scene();

const aspectRatio = window.innerWidth / window.innerHeight;

const cameraWidth = 3000;
const cameraHeight = cameraWidth / aspectRatio;

const camera = new THREE.OrthographicCamera(
    cameraWidth / -2,
    cameraWidth / 2,
    cameraHeight / 2,
    cameraHeight / -2,
    0.01,
    10000
);

camera.position.set(0, 1, 500);

const renderer = new THREE.WebGLRenderer({
    antialias: true
});

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

document.body.appendChild(renderer.domElement);

async function loadPuppet() {
    try {
        const puppet = await Inochi2D.INP.inImportFromURL('testplay2.inp');

        console.log("PUPPET LOADED");
　　　　　console.log("META:", puppet.meta);
　　　　　console.log("ROOT:", puppet.rootNode);
　　　　　console.log("NODES:", puppet.nodes);

puppet.nodes.forEach((node) => {
    console.log(
        "NODE:",
        node.type,
        node.name,
        node.uuid,
        node.children.length
    );
});

        Inochi2D.Renderer.renderPuppet(
            puppet,
            scene,
            camera,
            renderer
        );

    } catch (error) {
        console.error("PUPPET LOAD ERROR", error);
    }
}

loadPuppet();

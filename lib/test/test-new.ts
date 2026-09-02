import * as Inochi2D from '../main'
import * as THREE from 'three';

const scene = new THREE.Scene();

const aspectRatio = window.innerWidth / window.innerHeight;

const cameraWidth = 12000;
const cameraHeight = cameraWidth / aspectRatio;

const camera = new THREE.OrthographicCamera(
    cameraWidth / -2,
    cameraWidth / 2,
    cameraHeight / 2,
    cameraHeight / -2,
    0.01,
    10000
);

camera.position.set(0, 4000, 500);

const renderer = new THREE.WebGLRenderer({
    antialias: true
});

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

renderer.setClearColor(0xff0000, 1);

document.body.appendChild(renderer.domElement);

async function loadPuppet() {
    try {
        const puppet = await Inochi2D.INP.inImportFromURL('testplay2.inp');

        console.log("PUPPET LOADED");
        console.log(puppet);

        console.log("BEFORE RENDER");

        try {
            const result = Inochi2D.Renderer.renderPuppet(
                puppet,
                scene,
                camera,
                renderer
            );

            result.rootNode.traverse((object) => {
                if (object instanceof THREE.Mesh) {
                const oldMaterial = object.material as THREE.MeshBasicMaterial;

　　　　　　　　　　　object.material =
  　　　　　　　　　　　  new THREE.MeshBasicMaterial({
                         map: oldMaterial.map,
                         transparent: true,
                         depthTest: false,
                         depthWrite: false,
                         side: THREE.DoubleSide
                     });

                    object.frustumCulled = false;
                    object.renderOrder = 999;
                }
            });

            let meshCount = 0;

            result.rootNode.traverse((object) => {
                if (object instanceof THREE.Mesh) {
                    meshCount++;

                    console.log(
                        "TEST MESH",
                        meshCount,
                        "VISIBLE:",
                        object.visible,
                        "POSITION:",
                        object.position,
                        "WORLD:",
                        object.getWorldPosition(new THREE.Vector3())
                    );
                }
            });

            console.log("TOTAL MESHES:", meshCount);

            console.log("AFTER RENDER");
        } catch (error) {
            console.error("RENDER ERROR:", error);
        }

    } catch (error) {
        console.error("PUPPET LOAD ERROR", error);
    }
}

loadPuppet();

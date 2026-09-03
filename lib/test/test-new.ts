import * as Inochi2D from '../main'
import * as THREE from 'three';
const scene = new THREE.Scene();
const aspectRatio = window.innerWidth / window.innerHeight;
const cameraWidth = 8000;
const cameraHeight = cameraWidth / aspectRatio;
const camera = new THREE.OrthographicCamera(
    cameraWidth / -2,
    cameraWidth / 2,
    cameraHeight / 2,
    cameraHeight / -2,
    0.01,
    10000
);
camera.position.set(0, -3000, 500);
const renderer = new THREE.WebGLRenderer({
    antialias: true
});
renderer.setSize(
    window.innerWidth,
    window.innerHeight
);
renderer.setPixelRatio(window.devicePixelRatio);
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
                    const oldMaterial =
                        object.material as THREE.MeshBasicMaterial;
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
                    const worldPosition =
                        object.getWorldPosition(
                            new THREE.Vector3()
                        );
                    const box =
                        new THREE.Box3().setFromObject(object);
                    console.log(
                        "TEST MESH",
                        meshCount,
                        "VISIBLE:",
                        object.visible,
                        "WORLD:",
                        worldPosition,
                        "BOX MIN:",
                        box.min,
                        "BOX MAX:",
                        box.max
                    );
                    // 顔付近のMeshを目立たせるためのログ
　　　　　　　　　　　　　　　if (
                          worldPosition.y < -4000 &&
                          worldPosition.y > -10000 &&
                          Math.abs(worldPosition.x) < 3000
　　　　　　　　　　　　　　　) {
                           console.log(
                           "FACE AREA CANDIDATE",
                           meshCount,
                           "WORLD:",
                           worldPosition,
                           "BOX:",
                           box
                       );
　　　　　　　　　　　　　}
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

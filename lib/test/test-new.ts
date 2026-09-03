import * as Inochi2D from '../main'
import * as THREE from 'three';
const scene = new THREE.Scene();
const aspectRatio =
    window.innerWidth / window.innerHeight;
const cameraWidth = 8000;
const cameraHeight =
    cameraWidth / aspectRatio;
const camera = new THREE.OrthographicCamera(
    cameraWidth / -2,
    cameraWidth / 2,
    cameraHeight / 2,
    cameraHeight / -2,
    0.01,
    10000
);
camera.position.set(0, -3000, 500);
const renderer =
    new THREE.WebGLRenderer({
        antialias: true
    });
renderer.setSize(
    window.innerWidth,
    window.innerHeight
);
renderer.setPixelRatio(
    window.devicePixelRatio
);
renderer.setClearColor(
    0xff0000,
    1
);
document.body.appendChild(
    renderer.domElement
);
/*
==================================================
 顔パーツ調査
==================================================
*/
function logFaceParts(node: any) {
    if (
        node.threeObj &&
        node.threeObj.type === "Mesh" &&
        node.name
    ) {
        const name =
            String(node.name);
        if (
            name.includes("口") ||
            name.includes("唇") ||
            name.includes("歯") ||
            name.includes("舌") ||
            name.includes("目") ||
            name.includes("白目") ||
            name.includes("瞳")
        ) {
            const box =
                new THREE.Box3()
                    .setFromObject(
                        node.threeObj
                    );
            const worldPosition =
                node.threeObj.getWorldPosition(
                    new THREE.Vector3()
                );
            console.log(
    "FACE PART:",
    name,
    "UUID:",
    node.uuid,
    "ENABLED:",
    node.enabled,
    "OPACITY:",
    (node as any).opacity,
    "VISIBLE:",
    node.threeObj.visible,
    "WORLD:",
    worldPosition,
    "BOX:",
    box
);
        }
    }
    if (node.children) {
        for (
            const child of node.children
        ) {
            logFaceParts(child);
        }
    }
}
/*
==================================================
 モデル読み込み
==================================================
*/
async function loadPuppet() {
    try {
        const puppet =
            await Inochi2D.INP.inImportFromURL(
                'testplay2.inp'
            );
        console.log(
            "PUPPET LOADED"
        );
        console.log(
           "ROOT NODE KEYS:",
           Object.keys(puppet.rootNode as any)
　　　　　);
        console.log(
           "ROOT CHILDREN KEYS:",
           puppet.rootNode.children.map(
               (child: any) => Object.keys(child)
           )
　　　　　);
        console.log(
    　　　　　"PUPPET PROTOTYPE KEYS:",
            Object.getOwnPropertyNames(
            Object.getPrototypeOf(puppet)
           )
　　　　　);
        console.log(
            puppet
        );
        console.log(
            "BEFORE RENDER"
        );
        try {
            const result =
                Inochi2D.Renderer.renderPuppet(
                    puppet,
                    scene,
                    camera,
                    renderer
                );
            /*
            ==========================================
             表示用マテリアル調整
            ==========================================
            */
            result.rootNode.traverse(
                (object) => {
                    if (
                        object.type === "Mesh"
                    ) {
                        const mesh =
                            object as any;
                        const oldMaterial =
                            mesh.material;
                        mesh.material =
                            new THREE.MeshBasicMaterial({
      　　　　　　　　　　　　　　　　  map:
                                    oldMaterial.map,
                                transparent:
                                    true,
　　　　　　　　　　　　　　　　　　　　　opacity:
                                    oldMaterial.opacity,
                                depthTest:
                                    false,
       　　　　　　　　　　　　　　　　 depthWrite:
                                    false,
                                side:
                                     THREE.DoubleSide
                             });
                        mesh.frustumCulled =
                            false;
                        mesh.renderOrder =
                            999;
                    }
                }
            );
            /*
            ==========================================
             メッシュ数確認
            ==========================================
            */
            let meshCount = 0;
            result.rootNode.traverse(
                (object) => {
                    if (
                        object.type === "Mesh"
                    ) {
                        meshCount++;
                        const mesh =
                            object as any;
                        const worldPosition =
                            mesh.getWorldPosition(
                                new THREE.Vector3()
                            );
                        const box =
                            new THREE.Box3()
                                .setFromObject(
                                    mesh
                                );
                        console.log(
                            "TEST MESH",
                            meshCount,
                            "VISIBLE:",
                            mesh.visible,
                            "WORLD:",
                            worldPosition,
                            "BOX MIN:",
                            box.min,
                            "BOX MAX:",
                            box.max
                        );
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
                }
            );
            console.log(
                "TOTAL MESHES:",
                meshCount
            );
            /*
            ==========================================
             Inochi2D側の顔パーツを直接調査
            ==========================================
            */
            console.log(
                "========== FACE PART SEARCH =========="
            );
            logFaceParts(
                puppet.rootNode
            );
            console.log(
                "========== FACE PART SEARCH END =========="
            );
            console.log(
                "AFTER RENDER"
            );
        } catch (error) {
            console.error(
                "RENDER ERROR:",
                error
            );
        }
    } catch (error) {
        console.error(
            "PUPPET LOAD ERROR",
            error
        );
    }
}
loadPuppet();

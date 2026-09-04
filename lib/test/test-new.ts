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
    　　　　　"PARAM COUNT:",
    　　　　　(puppet as any).params?.length
　　　　　);

　　　　　　console.log(
    　　　　　"PARAMS:",
           (puppet as any).params
　　　　　);
        console.log(
           "PARAM NAMES:",
           (puppet as any).params?.map(
           (p: any) => p.name
            )
　　　　　);
        console.log(
           "PARAM SUMMARY:",
           (puppet as any).params?.map((p: any) => ({
               name: p.name,
               uuid: p.uuid,
               is_vec2: p.is_vec2,
               min: p.min,
               max: p.max,
               bindings: p.bindings?.length
           }))
　　　　　　);
         console.log(
               "PARAM BINDINGS:",
               (puppet as any).params?.map((p: any) => ({
                name: p.name,
                bindings: p.bindings?.map((b: any) => ({
                    node: b.node,
                    param_name: b.param_name    
                }))
            }))
　　　　　　);
         console.log(
            "ROOT NODE KEYS:",
            Object.keys(puppet.rootNode as any)
        );
        console.log(
            "ROOT CHILDREN KEYS:",
            puppet.rootNode.children.map(
                (child: any) =>
                    Object.keys(child)
            )
        );
        console.log(
            "PUPPET PROTOTYPE KEYS:",
            Object.getOwnPropertyNames(
                Object.getPrototypeOf(puppet)
            )
        );
        console.log(
            "PUPPET NODES:",
            (puppet as any).nodes
        );
        /*
        ==========================================
         デバッグ表示
        ==========================================
        */
        const debugText =
            document.createElement("div");
        debugText.style.position =
            "fixed";
        debugText.style.top =
            "10px";
        debugText.style.left =
            "10px";
        debugText.style.zIndex =
            "99999";
        debugText.style.background =
            "white";
        debugText.style.color =
            "black";
        debugText.style.padding =
            "10px";
        debugText.style.fontSize =
            "16px";
        const firstNode =
            (puppet as any).nodes?.[0];
        debugText.textContent =
            "NODES: " +
            String(
                (puppet as any).nodes?.length
            ) +
            "\nHAS PARAM: " +
            String(
                firstNode &&
                Object.prototype.hasOwnProperty.call(
                    firstNode,
                    "param"
                )
            );
        document.body.appendChild(
            debugText
        );
        console.log(
            puppet
        );
        console.log(
            "BEFORE RENDER"
        );
        /*
==================================================
 Param #0 テストスライダー
==================================================
*/
const param0 =
    (puppet as any).params?.[0];

if (param0) {
    const paramUI =
        document.createElement("div");

    paramUI.style.position = "fixed";
    paramUI.style.top = "150px";
    paramUI.style.left = "10px";
    paramUI.style.zIndex = "99999";
    paramUI.style.background = "white";
    paramUI.style.color = "black";
    paramUI.style.padding = "10px";
    paramUI.style.fontSize = "16px";

    const label =
        document.createElement("div");

    label.textContent =
        "Param #0: 0.00";

    const slider =
        document.createElement("input");

    slider.type = "range";
    slider.min = "0";
    slider.max = "1";
    slider.step = "0.01";
    slider.value = "0";

    slider.addEventListener(
        "input",
        () => {
            const value =
                Number(slider.value);

            label.textContent =
                "Param #0: " +
                value.toFixed(2);

            console.log(
                "PARAM #0 TEST VALUE:",
                value
            );
        }
    );

    paramUI.appendChild(label);
    paramUI.appendChild(slider);

    document.body.appendChild(
        paramUI
    );
}
        /*
        ==========================================
         レンダリング
        ==========================================
        */
        try {
            const result =
                Inochi2D.Renderer.renderPuppet(
                    puppet,
                    scene,
                    camera,
                    renderer
                );
            /*

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

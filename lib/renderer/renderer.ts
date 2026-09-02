/*
    THREE.JS-based renderer

    Copyright © 2023, Inochi2D Project
    Distributed under the 2-Clause BSD License, see LICENSE file.
    
    Authors: FartDraws
*/

import * as THREE from "three";
import { BlendMode, Node } from "../nodes/node";
import { Drawable, Part } from "../nodes/drawable";
import { Puppet } from "../puppet";


export const blend_modes = [
    { _blendmode: BlendMode.Normal, _constant: THREE.NormalBlending },
    { _blendmode: BlendMode.Screen, _constant: THREE.MultiplyBlending },
    { _blendmode: BlendMode.ColorDodge, _constant: THREE.MultiplyBlending },
    { _blendmode: BlendMode.Multiply, _constant: THREE.MultiplyBlending }
];


// Function to recursively add nodes to the scene
function createNode(
    node: Node | Drawable,
    scene: THREE.Object3D,
    parent: THREE.Object3D,
    textures: THREE.Texture[]
) {
    
    node.create();
    node.update();

    parent.add(node.threeObj);

    for (let child of node.children) {
        createNode(child, scene, node.threeObj, textures);
    }

    return node.threeObj;
}


// Function to render a Puppet
export function renderPuppet(
    puppet: Puppet,
    scene: THREE.Scene,
    camera: THREE.Camera,
    renderer: THREE.Renderer
) {
    console.log("RENDER PUPPET ENTER");

    let rootNode = createNode(
        puppet.rootNode,
        scene,
        scene,
        puppet.textures
    );

    rootNode.updateMatrixWorld(true);

    console.log(
        "FIRST CHILD:",
        rootNode.children[0]?.type,
        rootNode.children[0]?.children.length
    );

    console.log("ROOT OBJ TYPE:", rootNode.type);

    console.log(
        "ROOT OBJ CHILDREN:",
        rootNode.children.length
    );

    console.log(
        "SECOND LEVEL:",
        rootNode.children[0]?.children.map((x: any) => ({
            type: x.type,
            children: x.children.length
        }))
    );

    const mesh = rootNode.children[0]?.children[0] as THREE.Mesh;

    if (mesh) {
        console.log(
            "MESH WORLD BOX:",
            new THREE.Box3().setFromObject(mesh)
        );

        const material = mesh.material as THREE.MeshBasicMaterial;
        const texture = material.map;

        console.log(
            "MESH POS:",
            mesh.position.x,
            mesh.position.y,
            mesh.position.z,
            "SCALE:",
            mesh.scale.x,
            mesh.scale.y
        );

        console.log(
            "MESH WORLD POS:",
            mesh.getWorldPosition(new THREE.Vector3())
        );

        console.log(
            "CAMERA POS:",
            camera.position.x,
            camera.position.y,
            camera.position.z
        );

        console.log(
            "CAMERA VIEW:",
            (camera as THREE.OrthographicCamera).left,
            (camera as THREE.OrthographicCamera).right,
            (camera as THREE.OrthographicCamera).top,
            (camera as THREE.OrthographicCamera).bottom
        );

        console.log(
            "MESH VISIBLE:",
            mesh.visible,
            "FRUSTUM CULLED:",
            mesh.frustumCulled
        );

        console.log(
            "GEOMETRY BOX:",
            mesh.geometry.boundingBox
        );

        console.log(
            "POSITION COUNT:",
            mesh.geometry.getAttribute("position")?.count
        );

        console.log(
            "POSITION ARRAY:",
            Array.from(
                mesh.geometry.getAttribute("position").array
            )
        );

        console.log(
            "TEXTURE:",
            texture
        );

        console.log(
            "TEXTURE IMAGE:",
            texture?.image?.width,
            texture?.image?.height
        );

        console.log(
            "MESH GEOMETRY:",
            mesh.geometry
        );

        console.log(
            "MESH MATERIAL:",
            mesh.material
        );
    }

    console.log(
        "ROOT CHILDREN:",
        rootNode.children.length
    );

    console.log(
        "SCENE CHILDREN:",
        scene.children.length
    );

    console.log(
        "ROOT POSITION:",
        rootNode.position,
        "SCALE:",
        rootNode.scale
    );

    scene.add(rootNode);
    rootNode.traverse((obj: any) => {
    if (obj instanceof THREE.Mesh) {
        obj.frustumCulled = false;

        const material = obj.material as THREE.MeshBasicMaterial;

        material.depthTest = false;
        material.depthWrite = false;
        material.stencilWrite = false;

        material.map = null;
        material.color.set(0xff00ff);
        material.needsUpdate = true;
     }
　});


    const animate = function () {
        requestAnimationFrame(animate);

        renderer.render(
            scene,
            camera
        );
    };

    animate();

    return {
        rootNode: rootNode,
        animate: animate
    };
}

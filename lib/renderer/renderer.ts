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
    { _blendmode: BlendMode.Screen, _constant: THREE.MultiplyBlending  },
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
export function renderPuppet(puppet: Puppet, scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.Renderer) {
    console.log("RENDER PUPPET ENTER");

    // Process root node
    let rootNode = createNode(puppet.rootNode, scene, scene, puppet.textures);
　　　console.log(
    "FIRST CHILD:",
    rootNode.children[0]?.type,
    rootNode.children[0]?.children.length
　　);
    console.log("ROOT OBJ TYPE:", rootNode.type);
　　　console.log("ROOT OBJ CHILDREN:", rootNode.children.length);
　　　console.log(
       "SECOND LEVEL:",
　  rootNode.children[0].children.map((x: any) => ({
      type: x.type,
      children: x.children.length
　  }))
　);
　　　console.log("ROOT CHILDREN:", rootNode.children.length);
　　　console.log("SCENE CHILDREN:", scene.children.length);
    
    console.log("ROOT POSITION:", rootNode.position, "SCALE:", rootNode.scale);
　　　scene.add(rootNode);

    // Render loop
    const animate = function () {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    };

    animate();

    return {
        rootNode: rootNode, 
        animate: animate
    };
}

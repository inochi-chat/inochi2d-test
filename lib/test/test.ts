/*
    Testing script.

    Copyright © 2023, Inochi2D Project
    Distributed under the 2-Clause BSD License, see LICENSE file.
    
    Authors: FartDraws
*/

import * as Inochi2D from '../main'
import * as THREE from 'three';

const scene = new THREE.Scene();
const aspectRatio = window.innerWidth / window.innerHeight;

// Set up the parameters for the orthographic camera
const cameraWidth = 3000; // Width of the camera view
const cameraHeight = cameraWidth / aspectRatio; // Height of the camera view
const camera = new THREE.OrthographicCamera(
    cameraWidth / -2,
    cameraWidth / 2,
    cameraHeight / 2,
    cameraHeight / -2,
    0.01,
    10000
);

// Set camera position
camera.position.set(0, 1, 500);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

async function loadPuppet() {
    const puppet = await Inochi2D.INP.inImportFromURL('testplay2.inp');

    console.log("Loaded " + puppet.meta + "!");
    const info = document.createElement('div');
info.style.cssText = `
    position: fixed;
    top: 10px;
    left: 10px;
    z-index: 9999;
    color: white;
    background: black;
    padding: 10px;
    font-size: 12px;
`;

info.textContent = `CHILDREN: ${puppet.rootNode.children.length}`;
document.body.appendChild(info);  
`${i}: ${child.constructor.name} X=${child.transform.trans.x} 
Y=${child.transform.trans.y}`).join('\n');
X: ${puppet.rootNode.children[0]?.transform.trans.x}
Y: ${puppet.rootNode.children[0]?.transform.trans.y}
SCALE: ${puppet.rootNode.children[0]?.transform.scale.x}`;
document.body.appendChild(info);
　　　console.log(puppet.rootNode);
    Inochi2D.Renderer.renderPuppet(
        puppet,
        scene,
        camera,
        renderer
    );
}

loadPuppet();

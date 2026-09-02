const puppet = await Inochi2D.INP.inImportFromURL('testplay2.inp');

console.log("PUPPET LOADED");
console.log(puppet);

console.log("ROOT NODE:", puppet.rootNode);
console.log("NODES:", puppet.nodes);
console.log("NODE COUNT:", puppet.nodes.length);

for (const node of puppet.nodes) {
    console.log(
        "NODE:",
        node.type,
        node.name,
        node.uuid,
        node instanceof THREE.Mesh ? "MESH" : "NO MESH"
    );
}

Inochi2D.Renderer.renderPuppet(
    puppet,
    scene,
    camera,
    renderer
);

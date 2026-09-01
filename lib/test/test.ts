const puppet = await Inochi2D.INP.inImportFromURL('testplay2.inp');

console.log("PUPPET LOADED");
console.log(puppet);

Inochi2D.Renderer.renderPuppet(
    puppet,
    scene,
    camera,
    renderer
);

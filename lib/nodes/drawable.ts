import { MeshData } from "../meshdata";
import * as THREE from "three";
import { Node, MaskingMode, NodeUuid, BlendMode } from "./node";
import { blend_modes } from "../renderer/renderer";
import { Puppet } from "../puppet";

/**
 * Representation of Mask Data
 */
export class MaskData {
    source: NodeUuid = -1;
    mode: BlendMode = BlendMode.ClipToLower;
}

/**
 * Represents the drawable properties.
 */
export class Drawable extends Node {
    mesh: MeshData = new MeshData();
    masks: MaskData[] = [];

    /**
     * Called on render, populates a THREE.Object3D.
     */
    protected onCreateMesh() {
        super.onCreateMesh();

        const geometry = new THREE.BufferGeometry();

        const vertices = [];
        const positionNumComponents = 3;

        for (let vertex of this.mesh.vertices) {
            const offset: THREE.Vector2 =
                this.mesh.origin
                    ? this.mesh.origin
                    : new THREE.Vector2(0, 0);

            vertices.push(
                vertex.x + offset.x,
                vertex.y + offset.y,
                0
            );
        }

        geometry.setAttribute(
            'position',
            new THREE.BufferAttribute(
                new Float32Array(vertices),
                positionNumComponents
            )
        );

        if (this.mesh.uvs) {
            const uvs: any[] = [];
            const uvNumComponents = 2;

            this.mesh.uvs.map((uv) => {
                uvs.push(
                    uv.x,
                    uv.y
                );
            });

            geometry.setAttribute(
                'uv',
                new THREE.BufferAttribute(
                    new Float32Array(uvs),
                    uvNumComponents
                )
            );
        }

        geometry.setIndex(this.mesh.indices);

        this.threeObj = new THREE.Mesh(
            geometry,
            new THREE.MeshNormalMaterial()
        );
    }

    /**
     * Called on render, populates a THREE.Object3D materials.
     */
    protected onCreateMaterials() {
        if (
            this.threeObj instanceof THREE.Mesh &&
            this.threeObj.material
        ) {
            if (!this.enabled) {
                this.threeObj.material.opacity = 0;
            }

            this.threeObj.material.alphaTest = 0.7;
        }

        super.onCreateMaterials();
    }
}

/**
 * Represents a mask with the same properties as a drawable.
 */
export class Mask extends Drawable {
    protected onCreateMaterials(): void {
        if (this.threeObj instanceof THREE.Mesh) {
            console.log("mask material xd");

            const material = new THREE.MeshPhongMaterial({
                color: 'white'
            });

            material.depthWrite = false;
            material.stencilWrite = true;
            material.stencilRef = this.uuid;
            material.stencilFunc = THREE.AlwaysStencilFunc;
            material.stencilZPass = THREE.ReplaceStencilOp;

            this.threeObj.material = material;
        }

        super.onCreateMaterials();
    }
}

/**
 * Represents a part with additional properties.
 */
export class Part extends Drawable {
    textures: number[] = [];
    opacity: number = 1;
    mask_mode: MaskingMode = MaskingMode.Mask;
    mask_threshold: number = 0;
    masked_by: NodeUuid[] = [];
    blend_mode: BlendMode = BlendMode.Normal;

    protected onCreateMaterials() {
        const partTextures: THREE.Texture[] = this.textures.map((idx) => {
            return (this.puppet! as Puppet).textures[idx];
        });

        if (this.threeObj instanceof THREE.Mesh) {
            let material;

            let blendModeData = blend_modes.find(
                modeData =>
                    modeData._blendmode === this.blend_mode
            );

            if (blendModeData === undefined) {
                blendModeData = {
                    _blendmode: BlendMode.Normal,
                    _constant: THREE.NormalBlending
                };
            }

            const { _constant } = blendModeData;

            if (partTextures) {
                const texture = partTextures[0];

                material = new THREE.MeshBasicMaterial({
                    transparent: true,
                    blending: _constant,
                    map: texture,
                    depthWrite: false
                });

                material.stencilWrite = true;

                if (this.masks.length > 0) {
                    material.stencilRef = this.masks.map((mask) => {
                        return mask.source;
                    })[0];

                    material.stencilFunc =
                        THREE.EqualStencilFunc;

                    material.stencilFail =
                        THREE.KeepStencilOp;

                    material.stencilZFail =
                        THREE.KeepStencilOp;

                    material.stencilZPass =
                        THREE.KeepStencilOp;

                } else {
                    material.depthWrite = false;
                    material.stencilWrite = true;
                    material.stencilRef = this.uuid;
                    material.stencilFunc =
                        THREE.AlwaysStencilFunc;

                    material.stencilZPass =
                        THREE.ReplaceStencilOp;

                    material.stencilFail =
                        THREE.ReplaceStencilOp;

                    material.stencilZFail =
                        THREE.ReplaceStencilOp;

                    material.stencilZPass =
                        THREE.ReplaceStencilOp;
                }

                if (_constant != THREE.NormalBlending) {
                    // material.opacity = 0;
                }

            } else {
                material = new THREE.MeshBasicMaterial({
                    color: "pink",
                    transparent: true,
                    blending: _constant
                });
            }

            this.threeObj.material = material;

            super.onCreateMaterials();
        }
    }
}

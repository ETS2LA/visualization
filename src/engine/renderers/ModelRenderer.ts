import * as THREE from 'three';
import type { Colors } from '../../core/colors';
import type { Vector3, Node, Model } from '../../core/types';
import { convertQuaternion } from '../../core/utils';

const RENDER_MODELS = false;
const RENDER_PIECES = false;
const PIECE_SIZE_TOLERANCE = 20;

// function getTreeUrls() {
//     const base = new URL('../../assets/models/trees/', import.meta.url).href;
//     const treeCount = 21;
//     let treeUrls: URL[] = [];
//     for (let i = 1; i <= treeCount; i++) {
//         const treeUrl = new URL(`Tree_temp_climate_${i.toString().padStart(3, '0')}.glb`, base);
//         treeUrls.push(treeUrl);
//     }
//     return treeUrls;
// }

class RendererModel {
    // @ts-expect-error
    public mesh: THREE.Mesh;
    public group: THREE.Group = new THREE.Group();
    public pieces: THREE.Mesh[] = [];

    public pos: Vector3 = { X: 0, Y: 0, Z: 0 };
    public piecesPos: Vector3[] = [];

    public model: Model;
    public node: Node;

    // @ts-expect-error
    private geometry: THREE.BoxGeometry;
    // @ts-expect-error
    private material: THREE.MeshStandardMaterial;
    private colors: Colors;

    constructor(model: Model, node: Node, colors: Colors) {
        this.model = model;
        this.node = node;
        this.colors = colors;

        if(RENDER_PIECES)
        {
            var sizesSoFar = [];
            for (const part of model.parts) {
                if (part.pieces == null) continue;
                for (const piece of part.pieces) {
                    var pieceXSize = piece.boundingBox.max.X - piece.boundingBox.min.X;
                    var pieceYSize = piece.boundingBox.max.Y - piece.boundingBox.min.Y;
                    var pieceZSize = piece.boundingBox.max.Z - piece.boundingBox.min.Z;

                    if (pieceXSize <= 0.5 || pieceYSize <= 0.5 || pieceZSize <= 0.5) {
                        pieceXSize = 0;
                        pieceYSize = 0;
                        pieceZSize = 0;
                    }

                    if (pieceXSize >= 200 || pieceYSize >= 200 || pieceZSize >= 200) {
                        pieceXSize = 0;
                        pieceYSize = 0;
                        pieceZSize = 0;
                    }

                    // If the piece is close to the same size as the previous one, we skip
                    // it to save on performance. This only applies for parts with more than 10 pieces,
                    // and models with more than 5 parts.
                    if ((model.parts.length > 5 || part.pieces.length > 10) && sizesSoFar.length > 0) {
                        const lastSize = sizesSoFar[sizesSoFar.length - 1];
                        if (Math.abs(lastSize.X - pieceXSize) < PIECE_SIZE_TOLERANCE &&
                            Math.abs(lastSize.Y - pieceYSize) < PIECE_SIZE_TOLERANCE &&
                            Math.abs(lastSize.Z - pieceZSize) < PIECE_SIZE_TOLERANCE) {
                            continue;
                        }
                    }

                    sizesSoFar.push({ X: pieceXSize, Y: pieceYSize, Z: pieceZSize });
                    const pieceGeometry = new THREE.BoxGeometry(
                        pieceXSize,
                        pieceYSize,
                        pieceZSize
                    );
                    const pieceMaterial = new THREE.MeshStandardMaterial({ 
                        color: Number(this.colors.buildings),
                        opacity: 0.33,
                        transparent: true
                    });
                    const pieceMesh = new THREE.Mesh(pieceGeometry, pieceMaterial);
                    
                    const quat = convertQuaternion(node.rotation);
                    const localOffset = new THREE.Vector3(
                        piece.boundingBoxCenter.X,
                        -piece.boundingBoxCenter.Y,
                        piece.boundingBoxCenter.Z
                    ).applyQuaternion(quat);

                    const piecePos: Vector3 = {
                        X: node.position.X + localOffset.x,
                        Y: node.position.Y + localOffset.y,
                        Z: node.position.Z + localOffset.z
                    };
                    pieceMesh.position.set(
                        piecePos.X,
                        piecePos.Y,
                        piecePos.Z
                    );
                    pieceMesh.rotation.setFromQuaternion(quat);

                    this.piecesPos.push(piecePos);
                    this.pieces.push(pieceMesh);
                    this.group.add(pieceMesh);
                }
            }
        }
        else 
        {
            var xSize = model.boundingBox.max.X - model.boundingBox.min.X;
            var ySize = model.boundingBox.max.Y - model.boundingBox.min.Y;
            var zSize = model.boundingBox.max.Z - model.boundingBox.min.Z;
            // Make size 0 if any of the sizes is 0
            if (xSize <= 1.0 || ySize <= 1.0 || zSize <= 1.0) {
                xSize = 0;
                ySize = 0;
                zSize = 0;
            }

            this.geometry = new THREE.BoxGeometry(xSize, ySize, zSize);
            this.material = new THREE.MeshStandardMaterial({ 
                color: Number(this.colors.buildings),
                opacity: 0.33,
                transparent: true
            });
            this.mesh = new THREE.Mesh(this.geometry, this.material);
            
            const quat = convertQuaternion(node.rotation);
            const localOffset = new THREE.Vector3(
                model.boundingBoxCenter.X,
                -model.boundingBoxCenter.Y,
                model.boundingBoxCenter.Z
            ).applyQuaternion(quat);
            
            this.pos = {
                X: node.position.X + localOffset.x,
                Y: node.position.Y + localOffset.y - 1,
                Z: node.position.Z + localOffset.z
            }

            this.mesh.position.set(
                this.pos.X,
                this.pos.Y,
                this.pos.Z
            );

            this.mesh.rotation.setFromQuaternion(convertQuaternion(node.rotation));
            this.group.add(this.mesh);
        }
    }

    public updateMeshPosition(center: Vector3 = { X: 0, Y: 0, Z: 0 }) {
        if (!RENDER_PIECES) {
            this.mesh.position.set(
                this.pos.X - center.X,
                this.pos.Y - center.Y,
                this.pos.Z - center.Z
            );
        }
        else {
            for (let i = 0; i < this.pieces.length; i++) {
                const piece = this.pieces[i];
                const piecePos = this.piecesPos[i];
                piece.position.set(
                    piecePos.X - center.X,
                    piecePos.Y - center.Y,
                    piecePos.Z - center.Z
                );
            }
        }

    }
    
    public dispose() {
        if (!RENDER_PIECES) {
            this.geometry.dispose();
            this.material.dispose();
        }
        else {
            for (const piece of this.pieces) {
                piece.geometry.dispose();
            }
        }
    }
}

export class ModelRenderer {
    public group: THREE.Group = new THREE.Group();
    private nodeMap: Map<number, Node> = new Map();
    private modelMap: Map<number, RendererModel> = new Map();
    private colors: Colors;
    public center: Vector3 = { X: 0, Y: 0, Z: 0 };

    constructor(colors: Colors) {
        this.colors = colors;
    }

    public updateModels(models: Model[]) {
        if (!RENDER_MODELS) return;
        
        for (const model of models) {
            if (!this.modelMap.has(model.node)) {
                var node = this.nodeMap.get(model.node);
                if (node) {
                    const rendererModel = new RendererModel(model, node, this.colors);
                    this.group.add(rendererModel.group);
                    this.modelMap.set(model.node, rendererModel);
                }
            }
            else {
                const rendererModel = this.modelMap.get(model.node)!;
                rendererModel.updateMeshPosition(this.center);
            }
        }

        // Remove models that are no longer present
        const newIds = new Set(models.map((m) => m.node));
        for (const id of this.modelMap.keys()) {
            if (!newIds.has(id)) {
                const rendererModel = this.modelMap.get(id);
                if (rendererModel) {
                    this.group.remove(rendererModel.mesh);
                    rendererModel.dispose();
                }
                this.modelMap.delete(id);
            }
        }
    }

    public updateNodes(nodes: Node[]) {
        for (const node of nodes) {
            this.nodeMap.set(node.id, node);
        }

        const newIds = new Set(nodes.map((n) => n.id));
        for (const id of this.nodeMap.keys()) {
            if (!newIds.has(id)) {
                this.nodeMap.delete(id);
            }
        }
    }
}
import * as THREE from 'three';
import type { Vector3, Quaternion, Node } from '../../core/types';

class RendererNode {
    public mesh: THREE.Mesh;
    public node: Node;
    private geometry: THREE.SphereGeometry;
    private material: THREE.MeshStandardMaterial;
    
    constructor(node: Node) {
        this.node = node;
        
        this.geometry = new THREE.SphereGeometry(0.2);
        this.material = new THREE.MeshStandardMaterial({ color: 0x333333 });
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        
        this.updateMesh();
    }

    public updateMesh(center: Vector3 = { X: 0, Y: 0, Z: 0 }) {
        this.mesh.position.set(
            this.node.position.X - center.X,
            this.node.position.Y - center.Y,
            this.node.position.Z - center.Z
        );
        this.mesh.quaternion.set(
            -this.node.rotation.X,
            this.node.rotation.Y,
            this.node.rotation.Z,
            this.node.rotation.W
        );
    }
    
    public dispose() {
        this.geometry.dispose();
        this.material.dispose();
    }
}

export class NodeRenderer {
    public group: THREE.Group = new THREE.Group();
    private nodeMap: Map<number, RendererNode> = new Map();
    public center: Vector3 = { X: 0, Y: 0, Z: 0 };

    public updateNodes(nodes: Node[]) {
        for (const node of nodes) {
            if (!this.nodeMap.has(node.id)) {
                const rendererNode = new RendererNode(node);
                this.group.add(rendererNode.mesh);
                this.nodeMap.set(node.id, rendererNode);
            }
            else 
            {
                const rendererNode = this.nodeMap.get(node.id)!;
                rendererNode.updateMesh(this.center);
            }
        }

        // Remove nodes that are no longer present
        const newIds = new Set(nodes.map((n) => n.id));
        for (const id of this.nodeMap.keys()) {
            if (!newIds.has(id)) {
                const rendererNode = this.nodeMap.get(id)!;
                this.group.remove(rendererNode.mesh);
                rendererNode.dispose();
                this.nodeMap.delete(id);
            }
        }
    }
}
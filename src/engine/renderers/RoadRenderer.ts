import * as THREE from "three";
import type { Vector3, Node, RoadSegment } from "../../core/types";
import { interpolatePolyline } from "../../core/hermite";

class RendererRoad {
    public mesh: THREE.Mesh;
    public road: RoadSegment;
    public startNode: Node;
    public endNode: Node;
    private geometry: THREE.BufferGeometry;
    private material: THREE.MeshStandardMaterial;

    constructor(road: RoadSegment, startNode: Node, endNode: Node) {
        this.road = road;
        this.startNode = startNode;
        this.endNode = endNode;

        this.geometry = new THREE.BufferGeometry();
        this.material = new THREE.MeshStandardMaterial({
            color: 0x303030,
            side: THREE.DoubleSide,
            roughness: 0.8,
            metalness: 0.1
        });

        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.updateMesh();
    }

    public updateMesh(center: Vector3 = { X: 0, Y: 0, Z: 0 }) {
        if (!this.startNode || !this.endNode) return;

        // TODO: Dynamic segment count
        const segments = 30;
        const LANE_WIDTH = 4.5;
        const HALF_WIDTH = LANE_WIDTH / 2;

        const positions: number[] = [];
        const uvs: number[] = [];
        const indices: number[] = [];

        const up = new THREE.Vector3(0, 1, 0);

        const startOffsets = this.road.laneOffsetsStart || [];
        const endOffsets = this.road.laneOffsetsEnd || [];

        const totalLanes = Math.min(startOffsets.length, endOffsets.length);
        if (totalLanes === 0) return;

        let vertexOffset = 0;
        for (let laneIdx = 0; laneIdx < totalLanes; laneIdx++) {
            let startCenter = startOffsets[laneIdx];
            const endCenter = endOffsets[laneIdx];
            if (startCenter == undefined || startCenter == null) startCenter = endCenter;

            for (let i = 0; i <= segments; i++) {
                const t = i / segments;

                const posCurrent = interpolatePolyline(this.startNode, this.endNode, t);
                const delta = 0.001;
                let tPrev = Math.max(0, t - delta);
                let tNext = Math.min(1, t + delta);

                // shifted inwards if we're right at the edge
                // seems to fix some random issues with roads not ending smoothly
                if (t === 0) tNext = delta * 2;
                if (t === 1) tPrev = 1 - delta * 2;

                const posP = interpolatePolyline(this.startNode, this.endNode, tPrev);
                const posN = interpolatePolyline(this.startNode, this.endNode, tNext);

                const currentVec = new THREE.Vector3(
                    posCurrent.X - center.X,
                    posCurrent.Y - center.Y,
                    posCurrent.Z - center.Z
                );

                const prevVec = new THREE.Vector3(
                    posP.X - center.X,
                    posP.Y - center.Y,
                    posP.Z - center.Z
                );

                const nextVec = new THREE.Vector3(
                    posN.X - center.X,
                    posN.Y - center.Y,
                    posN.Z - center.Z
                );

                const tangent = new THREE.Vector3().subVectors(nextVec, prevVec).normalize();
                const right = new THREE.Vector3().crossVectors(tangent, up).normalize();

                let laneCenterOffset = startCenter + (endCenter - startCenter) * t;

                // we need to center the lanes if there's an odd number on one side and none on the other
                if (this.road.leftLaneCount == 0 && this.road.rightLaneCount % 2 == 1)
                    laneCenterOffset -= ((this.road.rightLaneCount - 1) / 2 * LANE_WIDTH);
                if (this.road.rightLaneCount == 0 && this.road.leftLaneCount % 2 == 1)
                    laneCenterOffset += ((this.road.leftLaneCount - 1) / 2 * LANE_WIDTH);
                
                const laneCenterPos = currentVec.clone().addScaledVector(right, laneCenterOffset);

                const leftVertex = laneCenterPos.clone().addScaledVector(right, -HALF_WIDTH);
                const rightVertex = laneCenterPos.clone().addScaledVector(right, HALF_WIDTH);

                positions.push(leftVertex.x, leftVertex.y, leftVertex.z);
                positions.push(rightVertex.x, rightVertex.y, rightVertex.z);

                uvs.push(0, t * 10);
                uvs.push(1, t * 10);

                if (i < segments) {
                    const r1 = vertexOffset + i * 2;
                    const r2 = vertexOffset + (i + 1) * 2;

                    indices.push(r1, r1 + 1, r2);
                    indices.push(r1 + 1, r2 + 1, r2);
                }
            }

            vertexOffset += (segments + 1) * 2;
        }

        this.geometry.dispose();
        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        this.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        this.geometry.setIndex(indices);
        this.geometry.computeVertexNormals();

        this.mesh.geometry = this.geometry;
    }

    public dispose() {
        this.geometry.dispose();
        this.material.dispose();
    }
}

export class RoadRenderer {
    public group: THREE.Group = new THREE.Group();
    private nodeMap: Map<number, Node> = new Map();
    private roadMap: Map<number, RendererRoad> = new Map();
    public center: Vector3 = { X: 0, Y: 0, Z: 0 };

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

    public updateRoads(roads: RoadSegment[]) {
        for (const road of roads) {
            const startNode = this.nodeMap.get(road.node);
            const endNode = this.nodeMap.get(road.forwardNode);

            if (!startNode || !endNode) continue;

            if (!this.roadMap.has(road.id)) {
                const rendererRoad = new RendererRoad(road, startNode, endNode);
                rendererRoad.updateMesh(this.center);
                this.group.add(rendererRoad.mesh);
                this.roadMap.set(road.id, rendererRoad);
            } else {
                const rendererRoad = this.roadMap.get(road.id)!;
                rendererRoad.road = road;
                rendererRoad.startNode = startNode;
                rendererRoad.endNode = endNode;
                rendererRoad.updateMesh(this.center);
            }
        }

        const newIds = new Set(roads.map((r) => r.id));
        for (const id of this.roadMap.keys()) {
            if (!newIds.has(id)) {
                const rendererRoad = this.roadMap.get(id)!;
                this.group.remove(rendererRoad.mesh);
                rendererRoad.dispose();
                this.roadMap.delete(id);
            }
        }
    }
}
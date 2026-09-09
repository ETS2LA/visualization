import * as THREE from "three";
import type {
    Vector3,
    Quaternion,
    Prefab,
    PrefabSegment
} from "../../core/types";
import { interpolatePolylineRaw } from "../../core/hermite";

const ROAD_WIDTH = 4.5;
const HALF_WIDTH = ROAD_WIDTH / 2;

class RendererPrefab {
    public mesh: THREE.Mesh;
    public prefab: Prefab;

    private geometry: THREE.BufferGeometry;
    private material: THREE.MeshBasicMaterial;

    constructor(prefab: Prefab) {
        this.prefab = prefab;
        this.geometry = new THREE.BufferGeometry();
        this.material = new THREE.MeshBasicMaterial({
            color: 0x171717,
            side: THREE.DoubleSide,
        });
        this.mesh = new THREE.Mesh(
            this.geometry,
            this.material
        );
        this.buildMesh();
    }

    public buildMesh() {
        const positions: number[] = [];
        const uvs: number[] = [];
        const indices: number[] = [];

        // prefab segments are independent curves, so each segment
        // gets its own strip of vertices.
        let vertexOffset = 0;
        for (const segment of this.prefab.segments) {
            this.addSegment(
                segment,
                { X: 0, Y: 0, Z: 0 },
                positions,
                uvs,
                indices,
                vertexOffset
            );

            // every segment has two vertices per subdivision.
            const segments = this.getSegmentCount(segment);
            vertexOffset += (segments + 1) * 2;
        }

        this.geometry.dispose();
        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(
                positions,
                3
            )
        );

        this.geometry.setAttribute(
            "uv",
            new THREE.Float32BufferAttribute(
                uvs,
                2
            )
        );

        this.geometry.setIndex(indices);
        this.geometry.computeVertexNormals();
        this.mesh.geometry = this.geometry;
    }

    private getSegmentCount(segment: PrefabSegment): number {
        return 15;
    }

    private transformPrefabPoint(point: Vector3): THREE.Vector3 {
        const position = new THREE.Vector3(
            point.X + this.prefab.prefabStart.X,
            point.Y + this.prefab.prefabStart.Y,
            point.Z + this.prefab.prefabStart.Z
        );

        const pivot = new THREE.Vector3(
            this.prefab.rootNodePosition.X,
            this.prefab.rootNodePosition.Y,
            this.prefab.rootNodePosition.Z
        );

        const rotation = new THREE.Euler(
            this.prefab.prefabRotation.X,
            this.prefab.prefabRotation.Y,
            this.prefab.prefabRotation.Z,
            "XYZ"
        );

        position.sub(pivot);
        position.applyEuler(rotation);
        position.add(pivot);

        return position;
    }

    private addSegment(
        segment: PrefabSegment,
        center: Vector3,
        positions: number[],
        uvs: number[],
        indices: number[],
        vertexOffset: number
    ) {
        const segments = this.getSegmentCount(segment);
        const up = new THREE.Vector3(0, 1, 0);

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;

            const current = this.transformPrefabPoint(interpolatePolylineRaw(
                segment.startPosition,
                segment.endPosition,
                segment.startRotation,
                segment.endRotation,
                t,
                segment.length
            ));

            const delta = 0.001;
            let tPrev = Math.max(0, t - delta);
            let tNext = Math.min(1, t + delta);
            if (t === 0)
                tNext = delta * 2;
            if (t === 1)
                tPrev = 1 - delta * 2;

            const previous = this.transformPrefabPoint(interpolatePolylineRaw(
                segment.startPosition,
                segment.endPosition,
                segment.startRotation,
                segment.endRotation,
                tPrev,
                segment.length
            ));
            const next = this.transformPrefabPoint(interpolatePolylineRaw(
                segment.startPosition,
                segment.endPosition,
                segment.startRotation,
                segment.endRotation,
                tNext,
                segment.length
            ));

            const currentVec = new THREE.Vector3(
                current.x - center.X,
                current.y - center.Y,
                current.z - center.Z
            );
            const previousVec = new THREE.Vector3(
                previous.x - center.X,
                previous.y - center.Y,
                previous.z - center.Z
            );
            const nextVec = new THREE.Vector3(
                next.x - center.X,
                next.y - center.Y,
                next.z - center.Z
            );

            const tangent = new THREE.Vector3().subVectors(
                nextVec,
                previousVec
            ).normalize();

            const right = new THREE.Vector3().crossVectors(
                tangent,
                up
            ).normalize();

            const leftVertex = currentVec.clone().addScaledVector(right, -HALF_WIDTH);
            const rightVertex = currentVec.clone().addScaledVector(right, HALF_WIDTH);

            positions.push(leftVertex.x, leftVertex.y, leftVertex.z);
            positions.push(rightVertex.x, rightVertex.y, rightVertex.z);

            uvs.push(0, t * 10);
            uvs.push(1, t * 10);

            if (i < segments) {
                const r1 = vertexOffset + i * 2;
                const r2 = vertexOffset + (i + 1) * 2;

                indices.push(
                    r1,
                    r1 + 1,
                    r2
                );

                indices.push(
                    r1 + 1,
                    r2 + 1,
                    r2
                );
            }
        }
    }

    public updateMeshPosition(center: Vector3) {
        this.mesh.position.set(
            -center.X,
            -center.Y,
            -center.Z
        );
    }

    public dispose() {
        this.geometry.dispose();
        this.material.dispose();
    }
}

export class PrefabRenderer {
    public group: THREE.Group = new THREE.Group();
    private prefabMap: Map<number, RendererPrefab> = new Map();
    public center = { X: 0, Y: 0, Z: 0 };

    public updatePrefabs(prefabs: Prefab[]) {
        for (const prefab of prefabs) {
            const existing = this.prefabMap.get(prefab.id);

            if (existing) {
                existing.prefab = prefab;
                existing.updateMeshPosition(this.center);
                continue;
            }

            const rendererPrefab = new RendererPrefab(prefab);
            rendererPrefab.updateMeshPosition(this.center);
            this.group.add(rendererPrefab.mesh);
            this.prefabMap.set(prefab.id, rendererPrefab);
        }

        const currentIds = new Set(prefabs.map(prefab => prefab.id));
        for (const [id, rendererPrefab] of this.prefabMap) {
            if (currentIds.has(id))
                continue;

            this.group.remove(rendererPrefab.mesh);
            rendererPrefab.dispose();
            this.prefabMap.delete(id);
        }
    }

    public clear() {
        for (const rendererPrefab of this.prefabMap.values()) {
            this.group.remove(rendererPrefab.mesh);
            rendererPrefab.dispose();
        }

        this.prefabMap.clear();
    }

    public setCenter(center: { X: number; Y: number; Z: number }) {
        this.center = center;
        for (const rendererPrefab of this.prefabMap.values()) {
            rendererPrefab.updateMeshPosition(this.center);
        }
    }

    public dispose() {
        this.clear();
    }
}
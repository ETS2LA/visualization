import * as THREE from "three";
import type {
    Vector3,
    Prefab,
    PrefabSegment
} from "../../core/types";
import type { Colors } from '../../core/colors';
import { interpolatePolylineRaw } from "../../core/hermite";

const ROAD_WIDTH = 4.5;
const HALF_WIDTH = ROAD_WIDTH / 2;

const MODEL_RESOLUTION = 8;
const LANE_RESOLUTION = 30;

const LANE_WIDTH = 0.15;
const DASH_LENGTH = 3;
const GAP_LENGTH = 6;
const DISTANCE_TOLERANCE = 0.0005;

// Again the lane lines here were made by ChatGPT, however I the root
// prefab rendering code as well as all other code.
class RendererPrefab {
    public mesh: THREE.Mesh;
    public prefab: Prefab;

    private geometry: THREE.BufferGeometry;
    private material: THREE.ShaderMaterial;
    private lineGeometry: THREE.BufferGeometry;
    private lineMaterial: THREE.MeshBasicMaterial;
    public lineMesh: THREE.Mesh;
    private colors: Colors;

    constructor(prefab: Prefab, colors: Colors) {
        this.prefab = prefab;
        this.colors = colors;
        this.geometry = new THREE.BufferGeometry();
        this.lineGeometry = new THREE.BufferGeometry();
        this.material = new THREE.ShaderMaterial({
            transparent: false,
            fog: true,
            uniforms: {
                asphaltColor: { value: new THREE.Color(Number(this.colors.asphalt)) },
                fogColor: { value: new THREE.Color(Number(this.colors.groundColor)) },
                fogDensity: { value: 0.006 },
            },
            vertexShader: `
                #include <common>
                #include <fog_pars_vertex>

                void main() {
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    vFogDepth = -mvPosition.z;
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform vec3 asphaltColor;

                #include <fog_pars_fragment>

                void main() {
                    gl_FragColor = vec4(asphaltColor, 1.0);
                    #include <fog_fragment>
                }
            `,
            side: THREE.FrontSide,
        });
        this.lineMaterial = new THREE.MeshBasicMaterial({
            color: Number(this.colors.laneMarkings),
            side: THREE.FrontSide,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
        });
        this.mesh = new THREE.Mesh(
            this.geometry,
            this.material
        );
        this.lineMesh = new THREE.Mesh(
            this.lineGeometry,
            this.lineMaterial
        );
        this.buildMesh();
    }

    public buildMesh() {
        const positions: number[] = [];
        const uvs: number[] = [];
        const indices: number[] = [];
        const linePositions: number[] = [];
        const lineIndices: number[] = [];
        const sampledSegments = this.prefab.segments.map(segment =>
            this.sampleSegment(segment, LANE_RESOLUTION)
        );

        // prefab segments are independent curves, so each segment
        // gets its own strip of vertices.
        let vertexOffset = 0;
        for (let segmentIndex = 0; segmentIndex < this.prefab.segments.length; segmentIndex++) {
            const segment = this.prefab.segments[segmentIndex];
            this.addSegment(
                segment,
                positions,
                uvs,
                indices,
                vertexOffset
            );
            this.addLaneLines(
                sampledSegments[segmentIndex],
                sampledSegments,
                linePositions,
                lineIndices
            );

            // every segment has two vertices per subdivision.
            const segments = MODEL_RESOLUTION;
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

        this.lineGeometry.dispose();
        this.lineGeometry = new THREE.BufferGeometry();
        this.lineGeometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(linePositions, 3)
        );
        this.lineGeometry.setIndex(lineIndices);
        this.lineMesh.geometry = this.lineGeometry;
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
            -this.prefab.prefabRotation.X,
            this.prefab.prefabRotation.Y,
            this.prefab.prefabRotation.Z,
            "XYZ"
        );

        position.sub(pivot);
        position.applyEuler(rotation);
        position.add(pivot);

        return position;
    }

    private sampleSegment(segment: PrefabSegment, segmentCount: number): THREE.Vector3[] {
        const samples: THREE.Vector3[] = [];

        for (let i = 0; i <= segmentCount; i++) {
            samples.push(this.transformPrefabPoint(interpolatePolylineRaw(
                segment.startPosition,
                segment.endPosition,
                segment.startRotation,
                segment.endRotation,
                i / segmentCount,
                segment.length
            )));
        }

        return samples;
    }

    private getPointDistanceToSegment(
        point: THREE.Vector3,
        start: THREE.Vector3,
        end: THREE.Vector3
    ): number {
        const segment = new THREE.Vector3().subVectors(end, start);
        const lengthSquared = segment.lengthSq();
        if (lengthSquared === 0)
            return point.distanceTo(start);

        const projection = THREE.MathUtils.clamp(
            new THREE.Vector3().subVectors(point, start).dot(segment) / lengthSquared,
            0,
            1
        );
        return point.distanceTo(start.clone().addScaledVector(segment, projection));
    }

    private getPointDistanceToPolyline(
        point: THREE.Vector3,
        samples: THREE.Vector3[]
    ): number {
        let closestDistance = Infinity;
        for (let i = 0; i < samples.length - 1; i++) {
            closestDistance = Math.min(
                closestDistance,
                this.getPointDistanceToSegment(point, samples[i], samples[i + 1])
            );
        }
        return closestDistance;
    }

    private getBoundaryType(
        point: THREE.Vector3,
        sampledSegments: THREE.Vector3[][]
    ): 0 | 1 | 2 {
        let exactCount = 0;
        let hasCloserSegment = false;

        for (const samples of sampledSegments) {
            const distance = this.getPointDistanceToPolyline(point, samples);
            if (distance < HALF_WIDTH - DISTANCE_TOLERANCE)
                hasCloserSegment = true;
            else if (Math.abs(distance - HALF_WIDTH) <= DISTANCE_TOLERANCE)
                exactCount++;
        }

        if (hasCloserSegment || exactCount > 2)
            return 0;
        return exactCount as 0 | 1 | 2;
    }

    private addLineQuad(
        start: THREE.Vector3,
        end: THREE.Vector3,
        positions: number[],
        indices: number[]
    ) {
        const direction = new THREE.Vector3().subVectors(end, start).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(direction, up).normalize();
        const halfWidth = LANE_WIDTH / 2;
        const vertexOffset = positions.length / 3;

        for (const point of [start, end]) {
            const left = point.clone().addScaledVector(right, -halfWidth);
            const lineRight = point.clone().addScaledVector(right, halfWidth);
            positions.push(left.x, left.y, left.z, lineRight.x, lineRight.y, lineRight.z);
        }

        indices.push(
            vertexOffset,
            vertexOffset + 1,
            vertexOffset + 2,
            vertexOffset + 1,
            vertexOffset + 3,
            vertexOffset + 2
        );
    }

    private addLineStrip(
        points: THREE.Vector3[],
        positions: number[],
        indices: number[]
    ) {
        if (points.length < 2)
            return;

        const up = new THREE.Vector3(0, 1, 0);
        const halfWidth = LANE_WIDTH / 2;
        const vertexOffset = positions.length / 3;

        for (let i = 0; i < points.length; i++) {
            const previous = points[Math.max(0, i - 1)];
            const next = points[Math.min(points.length - 1, i + 1)];
            const tangent = new THREE.Vector3().subVectors(next, previous).normalize();
            const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
            const left = points[i].clone().addScaledVector(right, -halfWidth);
            const lineRight = points[i].clone().addScaledVector(right, halfWidth);

            positions.push(left.x, left.y, left.z, lineRight.x, lineRight.y, lineRight.z);

            if (i < points.length - 1) {
                const current = vertexOffset + i * 2;
                const nextVertex = current + 2;
                indices.push(
                    current,
                    current + 1,
                    nextVertex,
                    current + 1,
                    nextVertex + 1,
                    nextVertex
                );
            }
        }
    }

    private addLaneLines(
        samples: THREE.Vector3[],
        sampledSegments: THREE.Vector3[][],
        positions: number[],
        indices: number[]
    ) {
        const up = new THREE.Vector3(0, 1, 0);
        const boundaryPoints: [THREE.Vector3[], THREE.Vector3[]] = [[], []];
        const boundaryTypes: [Array<0 | 1 | 2>, Array<0 | 1 | 2>] = [[], []];

        for (let i = 0; i < samples.length - 1; i++) {
            const start = samples[i];
            const end = samples[i + 1];
            const intervalLength = start.distanceTo(end);
            if (intervalLength === 0)
                continue;

            const tangent = new THREE.Vector3().subVectors(end, start).normalize();
            const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
            const midpoint = start.clone().lerp(end, 0.5);

            for (const sideIndex of [0, 1]) {
                const side = sideIndex === 0 ? -1 : 1;
                const boundaryStart = start.clone().addScaledVector(right, side * HALF_WIDTH);
                const boundaryEnd = end.clone().addScaledVector(right, side * HALF_WIDTH);
                const boundaryMidpoint = midpoint.clone().addScaledVector(right, side * HALF_WIDTH);
                const boundaryType = this.getBoundaryType(boundaryMidpoint, sampledSegments);
                boundaryTypes[sideIndex].push(boundaryType);
                if (i === 0)
                    boundaryPoints[sideIndex].push(boundaryStart);
                boundaryPoints[sideIndex].push(boundaryEnd);
            }
        }

        for (let sideIndex = 0; sideIndex < 2; sideIndex++) {
            let solidRun: THREE.Vector3[] = [];
            let distanceAlongSegment = 0;
            for (let i = 0; i < boundaryTypes[sideIndex].length; i++) {
                const boundaryType = boundaryTypes[sideIndex][i];
                const intervalDistance = boundaryPoints[sideIndex][i].distanceTo(
                    boundaryPoints[sideIndex][i + 1]
                );
                if (boundaryType === 1) {
                    if (solidRun.length === 0)
                        solidRun.push(boundaryPoints[sideIndex][i]);
                    solidRun.push(boundaryPoints[sideIndex][i + 1]);
                    distanceAlongSegment += intervalDistance;
                    continue;
                }

                this.addLineStrip(solidRun, positions, indices);
                solidRun = [];

                if (boundaryType === 2) {
                    const boundaryStart = boundaryPoints[sideIndex][i];
                    const boundaryEnd = boundaryPoints[sideIndex][i + 1];
                    const intervalLength = boundaryStart.distanceTo(boundaryEnd);
                    let offset = 0;

                    while (offset < intervalLength) {
                        const dashPosition = (distanceAlongSegment + offset) % (DASH_LENGTH + GAP_LENGTH);
                        const remaining = Math.min(
                            intervalLength - offset,
                            dashPosition < DASH_LENGTH ? DASH_LENGTH - dashPosition : GAP_LENGTH + DASH_LENGTH - dashPosition
                        );

                        if (dashPosition < DASH_LENGTH) {
                            const startT = offset / intervalLength;
                            const endT = (offset + remaining) / intervalLength;
                            this.addLineQuad(
                                boundaryStart.clone().lerp(boundaryEnd, startT),
                                boundaryStart.clone().lerp(boundaryEnd, endT),
                                positions,
                                indices
                            );
                        }
                        offset += remaining;
                    }
                }

                distanceAlongSegment += intervalDistance;
            }

            this.addLineStrip(solidRun, positions, indices);
        }
    }

    private addSegment(
        segment: PrefabSegment,
        positions: number[],
        uvs: number[],
        indices: number[],
        vertexOffset: number
    ) {
        const segments = MODEL_RESOLUTION;
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
                current.x,
                current.y,
                current.z
            );
            const previousVec = new THREE.Vector3(
                previous.x,
                previous.y,
                previous.z
            );
            const nextVec = new THREE.Vector3(
                next.x,
                next.y,
                next.z
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
        this.lineMesh.position.copy(this.mesh.position);
    }

    public dispose() {
        this.geometry.dispose();
        this.material.dispose();
        this.lineGeometry.dispose();
        this.lineMaterial.dispose();
    }
}

export class PrefabRenderer {
    public group: THREE.Group = new THREE.Group();
    private prefabMap: Map<number, RendererPrefab> = new Map();
    public center = { X: 0, Y: 0, Z: 0 };
    private colors: Colors;

    constructor(colors: Colors) {
        this.colors = colors;
    }

    public updatePrefabs(prefabs: Prefab[]) {
        for (const prefab of prefabs) {
            const existing = this.prefabMap.get(prefab.id);

            if (existing) {
                existing.prefab = prefab;
                existing.updateMeshPosition(this.center);
                continue;
            }

            const rendererPrefab = new RendererPrefab(prefab, this.colors);
            rendererPrefab.updateMeshPosition(this.center);
            this.group.add(rendererPrefab.mesh);
            this.group.add(rendererPrefab.lineMesh);
            this.prefabMap.set(prefab.id, rendererPrefab);
        }

        const currentIds = new Set(prefabs.map(prefab => prefab.id));
        for (const [id, rendererPrefab] of this.prefabMap) {
            if (currentIds.has(id))
                continue;

            this.group.remove(rendererPrefab.mesh);
            this.group.remove(rendererPrefab.lineMesh);
            rendererPrefab.dispose();
            this.prefabMap.delete(id);
        }
    }

    public clear() {
        for (const rendererPrefab of this.prefabMap.values()) {
            this.group.remove(rendererPrefab.mesh);
            this.group.remove(rendererPrefab.lineMesh);
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
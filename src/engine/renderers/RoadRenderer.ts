import * as THREE from "three";
import type { Vector3, Node, RoadSegment } from "../../core/types";
import { interpolatePolyline } from "../../core/hermite";

// TODO: We need to make this dynamic based on road length and curvature.
const SEGMENT_COUNT = 30;

const LANE_WIDTH = 4.5;
const HALF_LANE_WIDTH = LANE_WIDTH / 2;

const MAX_LANES = 32;

const LINE_WIDTH = 0.10;
const DASH_LENGTH = 3.0;
const GAP_LENGTH = 6.0;

// NOTE: This shader was created by ChatGPT. I claim no ownership of it.
//       The rest of the code was written by me (Tumppi066).
class RendererRoad {
    public mesh: THREE.Mesh;
    public road: RoadSegment;
    public startNode: Node;
    public endNode: Node;

    private geometry: THREE.BufferGeometry;
    private material: THREE.ShaderMaterial;

    constructor(
        road: RoadSegment,
        startNode: Node,
        endNode: Node
    ) {
        this.road = road;
        this.startNode = startNode;
        this.endNode = endNode;

        this.geometry = new THREE.BufferGeometry();

        this.material = new THREE.ShaderMaterial({
            transparent: true,
            uniforms: {
                asphaltColor: { value: new THREE.Color(0x555555) },
                lineColor: { value: new THREE.Color(0xdededede) },

                laneCentersStart: { value: new Float32Array(MAX_LANES) },
                laneCentersEnd: { value: new Float32Array(MAX_LANES) },
                laneCount: { value: 0 },

                lineWidth: { value: LINE_WIDTH },
                dashLength: { value: DASH_LENGTH },
                gapLength: { value: GAP_LENGTH },

                fogColor: { value: new THREE.Color(0x595959) },
                fogDensity: { value: 0.004 }
            },

            vertexShader: `
                attribute float laneCoord;
                attribute float roadDistance;
                attribute float roadT;

                varying float vLaneCoord;
                varying float vRoadDistance;
                varying float vRoadT;

                varying float vFogDepth;

                void main() {
                    vLaneCoord = laneCoord;
                    vRoadDistance = roadDistance;
                    vRoadT = roadT;

                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

                    vFogDepth = -mvPosition.z;

                    gl_Position =
                        projectionMatrix *
                        mvPosition;
                }
            `,

            fragmentShader: `
                uniform vec3 asphaltColor;
                uniform vec3 lineColor;

                uniform float laneCentersStart[${MAX_LANES}];
                uniform float laneCentersEnd[${MAX_LANES}];

                uniform int laneCount;

                uniform float lineWidth;
                uniform float dashLength;
                uniform float gapLength;

                varying float vLaneCoord;
                varying float vRoadDistance;
                varying float vRoadT;

                uniform vec3 fogColor;
                uniform float fogDensity;

                varying float vFogDepth;

                void main() {
                    float fogFactor = 1.0 - exp(
                        -pow(vFogDepth * fogDensity, 2.0)
                    );

                    fogFactor = clamp(
                        fogFactor,
                        0.0,
                        1.0
                    );

                    if (fogFactor == 1.0) {
                        discard;
                    }

                    /*
                     * Find how many lane boundaries are near this fragment.
                     *
                     * For every lane center there is a boundary 2.25m
                     * to either side:
                     *
                     *       lane center
                     *            |
                     *            |
                     *       <----> 2.25m
                     *            |
                     *       boundary
                     *
                     * At an outer road edge, exactly one lane contributes.
                     * At an internal lane divider, two lanes contribute.
                     */
                    float closestBoundaryDistance = 999999.0;
                    int adjacentLaneCount = 0;

                    /*
                     * Approximate the fragment derivative for antialiasing.
                     */
                    float aa = fwidth(vLaneCoord);
                    aa = min(aa, lineWidth * 10.0);

                    /*
                     * This threshold is deliberately somewhat larger than
                     * the actual line width so we can determine which kind
                     * of boundary we're rendering.
                     */
                    float boundaryThreshold =
                        lineWidth + aa * 2.0;

                    for (int i = 0; i < ${MAX_LANES}; i++) {
                        if (i >= laneCount)
                            break;

                        /*
                         * Interpolate this lane's center from the start
                         * of the road to the end.
                         */
                        float laneCenter = mix(
                            laneCentersStart[i],
                            laneCentersEnd[i],
                            vRoadT
                        );

                        /*
                         * Distance from this fragment to the nearest
                         * boundary of this lane.
                         */
                        float boundaryDistance =
                            abs(
                                abs(vLaneCoord - laneCenter)
                                - ${HALF_LANE_WIDTH}
                            );

                        closestBoundaryDistance = min(
                            closestBoundaryDistance,
                            boundaryDistance
                        );

                        if (boundaryDistance < boundaryThreshold) {
                            adjacentLaneCount++;
                        }
                    }

                    /*
                     * No lane boundary here.
                     */
                    if (closestBoundaryDistance >
                        lineWidth + aa * 2.0 && closestBoundaryDistance < ${HALF_LANE_WIDTH}) {

                        vec3 finalColor = mix(
                            asphaltColor,
                            fogColor,
                            fogFactor
                        );

                        gl_FragColor = vec4(
                            finalColor,
                            1.0
                        );

                        return;
                    }

                    /*
                     * Antialiased line mask.
                     */
                    float lineMask = 1.0 - smoothstep(
                        lineWidth - aa,
                        lineWidth + aa,
                        closestBoundaryDistance
                    );

                    /*
                     * Exactly one lane borders this boundary:
                     *
                     *     road edge
                     *         |
                     *         |
                     *       lane
                     *
                     * => solid line
                     */
                    if (adjacentLaneCount == 1) {
                        vec3 finalColor = mix(
                            asphaltColor,
                            lineColor,
                            lineMask
                        );

                        finalColor = mix(
                            finalColor,
                            fogColor,
                            fogFactor
                        );

                        gl_FragColor = vec4(
                            finalColor,
                            1.0
                        );

                        return;
                    }

                    /*
                     * Two lanes border this boundary:
                     *
                     *       lane       lane
                     *         |          |
                     *         |          |
                     *         +----------+
                     *              ^
                     *          lane divider
                     *
                     * => dashed line
                     */
                    if (adjacentLaneCount >= 2) {
                        float dashPeriod =
                            dashLength + gapLength;

                        float dashPosition =
                            mod(vRoadDistance, dashPeriod);

                        float dashMask =
                            step(dashPosition, dashLength);

                        /*
                         * Fade the ends of dashes slightly using
                         * derivatives of the distance coordinate.
                         */
                        float distanceAA =
                            max(fwidth(vRoadDistance), 0.001);

                        float dashStart =
                            smoothstep(
                                0.0,
                                distanceAA,
                                dashPosition
                            );

                        float dashEnd =
                            1.0 - smoothstep(
                                dashLength - distanceAA,
                                dashLength,
                                dashPosition
                            );

                        dashMask *= dashStart * dashEnd;

                        lineMask *= dashMask;

                        vec3 finalColor = mix(
                            asphaltColor,
                            lineColor,
                            lineMask
                        );

                        finalColor = mix(
                            finalColor,
                            fogColor,
                            fogFactor
                        );

                        gl_FragColor = vec4(
                            finalColor,
                            1.0
                        );

                        return;
                    }

                    /*
                     * Shouldn't normally be reached.
                     */
                    gl_FragColor = vec4(
                        asphaltColor,
                        0.0
                    );
                }
            `,

            side: THREE.DoubleSide
        });

        this.mesh = new THREE.Mesh(
            this.geometry,
            this.material
        );

        this.buildMesh();
    }

    public buildMesh() {
        if (!this.startNode || !this.endNode)
            return;

        const positions: number[] = [];
        const laneCoords: number[] = [];
        const roadDistances: number[] = [];
        const roadTs: number[] = [];
        const indices: number[] = [];

        const up = new THREE.Vector3(0, 1, 0);

        const endOffsets = this.road.laneOffsetsEnd || [];

        // we default back to endOffsets if startOffsets is not defined
        // in this case the road's offset doesn't change
        const startOffsets = this.road.laneOffsetsStart &&
                                this.road.laneOffsetsStart.length > 0
                                ? this.road.laneOffsetsStart
                                : endOffsets;

        const totalLanes = Math.min(startOffsets.length, endOffsets.length);
        if (totalLanes === 0)
            return;

        const shaderStart = this.material.uniforms.laneCentersStart.value as Float32Array;
        const shaderEnd = this.material.uniforms.laneCentersEnd.value as Float32Array;

        shaderStart.fill(999999);
        shaderEnd.fill(999999);

        const getCenteringAdjustment = (): number => {
            let adjustment = 0;

            // roads with an uneven amount of lanes on one side
            if (this.road.leftLaneCount === 0 && this.road.rightLaneCount % 2 === 1)
                adjustment -= ((this.road.rightLaneCount - 1) / 2) * LANE_WIDTH;
            if (this.road.rightLaneCount === 0 && this.road.leftLaneCount % 2 === 1)
                adjustment += ((this.road.leftLaneCount - 1) / 2) * LANE_WIDTH;

            // roads with just one lane
            if (this.road.leftLaneCount == 1 && this.road.rightLaneCount == 0)
                adjustment += LANE_WIDTH;
            if (this.road.rightLaneCount == 1 && this.road.leftLaneCount == 0)
                adjustment -= LANE_WIDTH;

            return adjustment;
        };

        const centeringAdjustment = getCenteringAdjustment();
        for (let laneIdx = 0; laneIdx < totalLanes && laneIdx < MAX_LANES; laneIdx++) {
            shaderStart[laneIdx] = startOffsets[laneIdx] + centeringAdjustment;
            shaderEnd[laneIdx] = endOffsets[laneIdx] + centeringAdjustment;
        }

        this.material.uniforms.laneCount.value = Math.min(totalLanes, MAX_LANES);

        const getLaneCenter = (laneIdx: number, t: number ): number => {
            const start = startOffsets[laneIdx] + centeringAdjustment;
            const end = endOffsets[laneIdx] + centeringAdjustment;
            return THREE.MathUtils.lerp(
                start,
                end,
                t
            );
        };

        const getRoadBounds = (t: number): {left: number; right: number;} => {
            let minCenter = Infinity;
            let maxCenter = -Infinity;

            for (let laneIdx = 0; laneIdx < totalLanes; laneIdx++) {
                const laneCenter = getLaneCenter(laneIdx, t);
                minCenter = Math.min(minCenter, laneCenter);
                maxCenter = Math.max(maxCenter, laneCenter);
            }

            return {
                left: minCenter - HALF_LANE_WIDTH - LINE_WIDTH,
                right: maxCenter + HALF_LANE_WIDTH + LINE_WIDTH
            };
        };

        const samples: THREE.Vector3[] = [];
        for (let i = 0; i <= SEGMENT_COUNT; i++) {
            const t = i / SEGMENT_COUNT;

            const p = interpolatePolyline(this.startNode, this.endNode, t, this.road.length);

            samples.push(
                new THREE.Vector3(p.X, p.Y, p.Z)
            );
        }

        const distances: number[] = new Array(SEGMENT_COUNT + 1);
        distances[0] = 0;
        for (let i = 1; i <= SEGMENT_COUNT; i++) {
            distances[i] = distances[i - 1] + samples[i].distanceTo(samples[i - 1]);
        }

        for (let i = 0; i <= SEGMENT_COUNT; i++) {
            const t = i / SEGMENT_COUNT;

            const currentVec = samples[i];
            const prevVec = samples[Math.max(0, i - 1)];
            const nextVec = samples[Math.min(SEGMENT_COUNT, i + 1)];

            let tangent: THREE.Vector3;
            if (i === 0) 
                tangent = new THREE.Vector3().subVectors(samples[1], samples[0]).normalize();
            else if (i === SEGMENT_COUNT) 
                tangent = new THREE.Vector3().subVectors(samples[SEGMENT_COUNT], samples[SEGMENT_COUNT - 1]).normalize();
            else 
                tangent = new THREE.Vector3().subVectors(nextVec, prevVec).normalize();
            
            const right = new THREE.Vector3().crossVectors(tangent, up).normalize();

            const bounds = getRoadBounds(t);
            const leftVertex = currentVec.clone().addScaledVector(right, bounds.left);
            const rightVertex = currentVec.clone().addScaledVector(right, bounds.right);

            positions.push(
                leftVertex.x,
                leftVertex.y,
                leftVertex.z
            );

            positions.push(
                rightVertex.x,
                rightVertex.y,
                rightVertex.z
            );

            // lateral coords in meters
            laneCoords.push(
                bounds.left,
                bounds.right
            );

            // distance along the road
            roadDistances.push(
                distances[i],
                distances[i]
            );
            roadTs.push(t, t);

            if (i < SEGMENT_COUNT) {
                const r1 = i * 2;
                const r2 = (i + 1) * 2;

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
            "laneCoord",
            new THREE.Float32BufferAttribute(
                laneCoords,
                1
            )
        );
        this.geometry.setAttribute(
            "roadDistance",
            new THREE.Float32BufferAttribute(
                roadDistances,
                1
            )
        );
        this.geometry.setAttribute(
            "roadT",
            new THREE.Float32BufferAttribute(
                roadTs,
                1
            )
        );

        this.geometry.setIndex(indices);
        this.geometry.computeVertexNormals();
        this.mesh.geometry = this.geometry;
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

export class RoadRenderer {
    public group: THREE.Group = new THREE.Group();
    private nodeMap: Map<number, Node> = new Map();
    private roadMap: Map<number, RendererRoad> = new Map();
    public center: Vector3 = {
        X: 0,
        Y: 0,
        Z: 0
    };

    public updateNodes(nodes: Node[]) {
        for (const node of nodes) {
            this.nodeMap.set(
                node.id,
                node
            );
        }

        const newIds =
            new Set(
                nodes.map(
                    (n) => n.id
                )
            );

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
                const rendererRoad = new RendererRoad(
                    road,
                    startNode,
                    endNode
                );

                rendererRoad.updateMeshPosition(this.center);
                this.group.add(rendererRoad.mesh);

                this.roadMap.set(road.id, rendererRoad);
            }
            else {
                const rendererRoad = this.roadMap.get(road.id)!;

                rendererRoad.road = road;
                rendererRoad.startNode = startNode;
                rendererRoad.endNode = endNode;

                rendererRoad.updateMeshPosition(this.center);
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
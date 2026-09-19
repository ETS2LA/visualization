import * as THREE from "three";
import type { Coordinate, Vector3 } from "../../core/types";
import type { Colors } from "../../core/colors";

const PATH_HEIGHT_OFFSET = 0.05;
const PATH_WIDTH = 1.8;
const PATH_OPACITY = 0.32;
const PATH_EDGE_OPACITY = 0.8;

// NOTE: This shader was created by ChatGPT. I claim no ownership of the
//       shader code.
export class PathRenderer {
    public group: THREE.Group = new THREE.Group();
    public center: Vector3 = { X: 0, Y: 0, Z: 0 };

    private geometry: THREE.BufferGeometry = new THREE.BufferGeometry();
    private material: THREE.ShaderMaterial;
    private ribbon: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
    private edgeGeometry: THREE.BufferGeometry = new THREE.BufferGeometry();
    private edgeMaterial: THREE.LineBasicMaterial;
    private edges: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
    private lastPathSignature = "";

    constructor(colors: Colors) {
        const pathColor = new THREE.Color(Number(colors.path));
        this.material = new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.merge([
                THREE.UniformsLib.fog,
                { pathColor: { value: pathColor } },
            ]),
            vertexShader: `
                #include <fog_pars_vertex>

                attribute float pathSide;
                varying float vPathSide;

                void main() {
                    vPathSide = pathSide;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    #include <fog_vertex>
                }
            `,
            fragmentShader: `
                uniform vec3 pathColor;
                varying float vPathSide;

                #include <fog_pars_fragment>

                void main() {
                    float edge = smoothstep(0.55, 1.0, abs(vPathSide));
                    float alpha = mix(${PATH_OPACITY.toFixed(2)}, 0.12, edge);
                    gl_FragColor = vec4(pathColor, alpha);
                    #include <fog_fragment>
                }
            `,
            transparent: true,
            depthTest: true,
            depthWrite: false,
            fog: true,
            side: THREE.DoubleSide,
        });
        this.edgeMaterial = new THREE.LineBasicMaterial({
            color: pathColor,
            transparent: true,
            opacity: PATH_EDGE_OPACITY,
            depthTest: true,
            depthWrite: false,
            fog: true,
        });
        this.ribbon = new THREE.Mesh(this.geometry, this.material);
        this.edges = new THREE.LineSegments(this.edgeGeometry, this.edgeMaterial);
        this.ribbon.renderOrder = 1;
        this.edges.renderOrder = 2;
        this.group.add(this.ribbon, this.edges);
    }

    public updatePath(pathPoints: Coordinate[]) {
        this.updateMeshPosition();
        const signature = pathPoints.map(point => `${point.X},${point.Y},${point.Z}`).join(";");
        if (signature === this.lastPathSignature)
            return;

        this.lastPathSignature = signature;
        const points = pathPoints.map(point => new THREE.Vector3(
            point.X,
            point.Y + PATH_HEIGHT_OFFSET,
            point.Z
        ));

        if (points.length < 2) {
            this.geometry.setAttribute("position", new THREE.Float32BufferAttribute([], 3));
            this.edgeGeometry.setAttribute("position", new THREE.Float32BufferAttribute([], 3));
            return;
        }

        const positions: number[] = [];
        const pathSides: number[] = [];
        const indices: number[] = [];
        const edgePositions: number[] = [];
        const up = new THREE.Vector3(0, 1, 0);
        const leftEdgePoints: THREE.Vector3[] = [];
        const rightEdgePoints: THREE.Vector3[] = [];

        for (let i = 0; i < points.length; i++) {
            const previous = points[Math.max(0, i - 1)];
            const next = points[Math.min(points.length - 1, i + 1)];
            const tangent = new THREE.Vector3().subVectors(next, previous).normalize();
            const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
            const leftPoint = points[i].clone().addScaledVector(right, -PATH_WIDTH / 2);
            const rightPoint = points[i].clone().addScaledVector(right, PATH_WIDTH / 2);

            positions.push(
                leftPoint.x, leftPoint.y, leftPoint.z,
                rightPoint.x, rightPoint.y, rightPoint.z
            );
            pathSides.push(-1, 1);

            leftEdgePoints.push(leftPoint);
            rightEdgePoints.push(rightPoint);

            if (i < points.length - 1) {
                const current = i * 2;
                const nextVertex = current + 2;
                indices.push(
                    current, current + 1, nextVertex,
                    current + 1, nextVertex + 1, nextVertex
                );
            }
        }

        for (let i = 0; i < points.length - 1; i++) {
            edgePositions.push(
                leftEdgePoints[i].x, leftEdgePoints[i].y, leftEdgePoints[i].z,
                leftEdgePoints[i + 1].x, leftEdgePoints[i + 1].y, leftEdgePoints[i + 1].z,
                rightEdgePoints[i].x, rightEdgePoints[i].y, rightEdgePoints[i].z,
                rightEdgePoints[i + 1].x, rightEdgePoints[i + 1].y, rightEdgePoints[i + 1].z
            );
        }

        this.geometry.dispose();
        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(positions, 3)
        );
        this.geometry.setAttribute(
            "pathSide",
            new THREE.Float32BufferAttribute(pathSides, 1)
        );
        this.geometry.setIndex(indices);
        this.ribbon.geometry = this.geometry;

        this.edgeGeometry.dispose();
        this.edgeGeometry = new THREE.BufferGeometry();
        this.edgeGeometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(edgePositions, 3)
        );
        this.edges.geometry = this.edgeGeometry;
    }

    public updateMeshPosition() {
        this.group.position.set(
            -this.center.X,
            -this.center.Y,
            -this.center.Z
        );
    }

    public dispose() {
        this.geometry.dispose();
        this.edgeGeometry.dispose();
        this.material.dispose();
        this.edgeMaterial.dispose();
    }
}

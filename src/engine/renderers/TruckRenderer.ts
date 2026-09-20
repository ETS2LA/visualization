import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Coordinate, Quaternion, TelemetryTrailer, Vector3 } from '../../core/types';
import { convertQuaternion } from '../../core/utils';

export type TruckStyle = 'eu' | 'us';

type LoadedModel = {
    object: THREE.Group;
    size: THREE.Vector3;
};

type TrailerInstance = {
    group: THREE.Group;
};

// TODO: Move this to core/types
type TelemetryPayload = {
    position: Coordinate;
    rotation: Quaternion;
    trailers: TelemetryTrailer[];
};

function getModelUrls(style: TruckStyle) {
    if (style === 'us') {
        return {
            truckGlb: new URL('/models/us_truck.glb', import.meta.url).href,
            middleGlb: new URL('/models/us_trailer_middle.glb', import.meta.url).href,
            rearGlb: new URL('/models/us_trailer_rear.glb', import.meta.url).href,
        };
    }

    return {
        truckGlb: new URL('/models/eu_truck.glb', import.meta.url).href,
        middleGlb: new URL('/models/eu_trailer_middle.glb', import.meta.url).href,
        rearGlb: new URL('/models/eu_trailer_rear.glb', import.meta.url).href,
    };
}


function convertEuler(rotationEuler: Vector3): THREE.Quaternion {
    const rotation = new THREE.Euler(
        rotationEuler.Y * Math.PI * 2,
        rotationEuler.X * Math.PI * 2 + Math.PI,
        rotationEuler.Z * Math.PI * 2,
        'XYZ'
    );

    const quaternion = new THREE.Quaternion().setFromEuler(rotation);
    return quaternion;
}

function estimateTrailerSize(trailer: TelemetryTrailer): THREE.Vector3 {
    const points = [trailer.hookPosition, ...trailer.wheels];
    const min = new THREE.Vector3(Infinity, Infinity, Infinity);
    const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);

    for (const point of points) {
        min.min(new THREE.Vector3(point.X, point.Y, point.Z));
        max.max(new THREE.Vector3(point.X, point.Y, point.Z));
    }

    const rawSize = max.sub(min);
    if (!Number.isFinite(rawSize.x) || !Number.isFinite(rawSize.y) || !Number.isFinite(rawSize.z)) {
        return new THREE.Vector3(3, 3, 8);
    }

    return new THREE.Vector3(
        rawSize.x + 0.5,
        3.5,
        rawSize.z + 1
    );
}

function computeScale(targetSize: THREE.Vector3, sourceSize: THREE.Vector3): THREE.Vector3 {
    return new THREE.Vector3(
        sourceSize.x > 0 ? targetSize.x / sourceSize.x : 1,
        sourceSize.y > 0 ? targetSize.y / sourceSize.y : 1,
        sourceSize.z > 0 ? targetSize.z / sourceSize.z : 1,
    );
}

function rotateAroundQuaternion(point: THREE.Vector3, quaternion: THREE.Quaternion): THREE.Vector3 {
    const rotatedPoint = point.clone();
    rotatedPoint.applyQuaternion(quaternion);
    return rotatedPoint;
}

export class TruckRenderer {
    public group: THREE.Group = new THREE.Group();
    public center: Coordinate = { X: 0, Y: 0, Z: 0 };

    private truckTemplate: LoadedModel | null = null;
    private trailerTemplates: Record<'middle' | 'rear', LoadedModel | null> = {
        middle: null,
        rear: null,
    };
    private truckInstance: THREE.Group | null = null;
    private trailerInstances: Map<number, TrailerInstance> = new Map();
    private latestTelemetry: TelemetryPayload | null = null;

    constructor(style: TruckStyle = 'eu') {
        void this.loadModels(style);
        this.group.renderOrder = 3;
    }

    private async loadModels(style: TruckStyle) {
        const urls = getModelUrls(style);

        this.truckTemplate = await this.loadModel(urls.truckGlb);
        this.trailerTemplates.middle = await this.loadModel(urls.middleGlb);
        this.trailerTemplates.rear = await this.loadModel(urls.rearGlb);

        this.updateObjectPositions();
    }

    private async loadModel(glbUrl: string): Promise<LoadedModel> {
        const gltfLoader = new GLTFLoader();
        const gltf = await gltfLoader.loadAsync(glbUrl);

        return this.applyObjectSettings(gltf.scene);
    }

    private applyObjectSettings(object: THREE.Group): LoadedModel {
        object.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        object.position.sub(center);

        return { object, size };
    }

    public updateTelemetry(telemetry: TelemetryPayload) {
        this.latestTelemetry = telemetry;
        this.updateObjectPositions();
    }

    private updateObjectPositions() {
        if (!this.latestTelemetry || !this.truckTemplate) {
            return;
        }

        if (!this.truckInstance) {
            this.truckInstance = this.truckTemplate.object.clone(true);
            this.group.add(this.truckInstance);
        }

        // TODO: Can we get the actual truck size from the game? This is hard coded...
        //       Won't work across games (ETS2 vs ATS)
        this.truckInstance.scale.copy(computeScale(new THREE.Vector3(2.5, 3.5, 6.0), this.truckTemplate.size));
        this.truckInstance.position.set(
            this.latestTelemetry.position.X - this.center.X,
            this.latestTelemetry.position.Y - this.center.Y, //- this.truckTemplate.size.y * 1.5,
            this.latestTelemetry.position.Z - this.center.Z,
        );
        this.truckInstance.quaternion.copy(convertQuaternion(this.latestTelemetry.rotation));

        const activeTrailerIds = new Set<number>();
        const trailerCount = this.latestTelemetry.trailers.length;
        this.latestTelemetry.trailers.forEach((trailer, index) => {
            const variant = index !== trailerCount - 1 ? 'middle' : 'rear';
            const template = this.trailerTemplates[variant];
            if (!template) {
                return;
            }

            activeTrailerIds.add(index);

            let trailerInstance = this.trailerInstances.get(index);
            if (!trailerInstance) {
                trailerInstance = {
                    group: template.object.clone(true),
                };
                this.trailerInstances.set(index, trailerInstance);
                this.group.add(trailerInstance.group);
            }

            let rotation = convertEuler(trailer.rotationEuler);
            trailerInstance.group.scale.copy(computeScale(estimateTrailerSize(trailer), template.size));
            trailerInstance.group.position.set(
                trailer.position.X - rotateAroundQuaternion(new THREE.Vector3(trailer.hookPosition.X, 0, 0), rotation).x - this.center.X,
                trailer.position.Y - this.center.Y,
                trailer.position.Z - this.center.Z,
            );
            trailerInstance.group.quaternion.copy(rotation);
        });

        for (const [index, trailerInstance] of this.trailerInstances.entries()) {
            if (!activeTrailerIds.has(index)) {
                this.group.remove(trailerInstance.group);
                this.trailerInstances.delete(index);
            }
        }
    }

    public dispose() {
        for (const trailerInstance of this.trailerInstances.values()) {
            this.group.remove(trailerInstance.group);
        }

        if (this.truckInstance) {
            this.group.remove(this.truckInstance);
        }

        this.trailerInstances.clear();
        this.truckInstance = null;
    }
}
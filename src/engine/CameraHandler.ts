import type { Quaternion, Vector3 } from '../core/types';
import * as THREE from 'three';
import { convertQuaternion } from '../core/utils';

export class CameraHandler {
    private container: HTMLElement;
    public c: THREE.PerspectiveCamera;

    public offset: Vector3;
    public truckRotation: Quaternion;
    public truckPosition: Vector3;
    public fov: number = 75;

    constructor(container: HTMLElement) {
        this.container = container;

        this.offset = { X: 0, Y: 15, Z: -25 }; 
        this.truckRotation = { X: 0, Y: 0, Z: 0, W: 1 };
        this.truckPosition = { X: 0, Y: 0, Z: 0 };
        
        const aspect = this.container.clientWidth / this.container.clientHeight || 1;
        this.c = new THREE.PerspectiveCamera(this.fov, aspect, 0.1, 1000);
    }

    public resize(width: number, height: number) {
        this.c.aspect = width / height || 1;
        this.c.updateProjectionMatrix();
    }

    public setQuaternion(truckRotation: Quaternion) {
        this.truckRotation.X = truckRotation.X;
        this.truckRotation.Y = truckRotation.Y;
        this.truckRotation.Z = truckRotation.Z;
        this.truckRotation.W = truckRotation.W;
    }

    public setPosition(truckPosition: Vector3) {
        this.truckPosition.X = truckPosition.X;
        this.truckPosition.Y = truckPosition.Y;
        this.truckPosition.Z = truckPosition.Z;
    }

    public update() {
        const quat = convertQuaternion(this.truckRotation);

        const truckPos = new THREE.Vector3(
            this.truckPosition.X,
            this.truckPosition.Y,
            this.truckPosition.Z
        );

        // This is the rotation of the camera relative to the truck
        // (keeps it orbiting around the truck as it moves)
        const localOffset = new THREE.Vector3(
            this.offset.X,
            this.offset.Y,
            this.offset.Z
        ).applyQuaternion(quat);

        this.c.position.copy(truckPos).add(localOffset);
        const target = truckPos.clone().add(new THREE.Vector3(0, 2, 0));
        this.c.lookAt(target);
    }
}
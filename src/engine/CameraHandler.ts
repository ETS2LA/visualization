import type { Vector3 } from '../core/types';
import * as THREE from 'three';

export class CameraHandler {
    private container: HTMLElement;
    public c: THREE.PerspectiveCamera;

    public offset: Vector3 = { x: 0, y: 0, z: 0 };
    public lookAtOffset: Vector3 = { x: 0, y: 0, z: 0 };
    public fov: number = 75;

    constructor(container: HTMLElement) {
        this.container = container;
        
        const aspect = this.container.clientWidth / this.container.clientHeight || 1;
        this.c = new THREE.PerspectiveCamera(this.fov, aspect, 0.1, 1000);
        this.c.position.set(0, 5, 10);
        this.c.lookAt(0, 0, 0);
    }

    public resize(width: number, height: number) {
        this.c.aspect = width / height || 1;
        this.c.updateProjectionMatrix();
    }

    public update() {
        this.c.position.set(
            this.offset.x, 
            this.offset.y, 
            this.offset.z
        );
        this.c.lookAt(
            this.lookAtOffset.x,
            this.lookAtOffset.y,
            this.lookAtOffset.z
        );
    }
}
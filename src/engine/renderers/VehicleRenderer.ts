import * as THREE from 'three';
import type { Vehicle, Vector3, Trailer } from '../../core/types';
import type { Colors } from '../../core/colors';

class RendererVehicle {
    public mesh: THREE.Mesh;
    public vehicle: Vehicle | Trailer;
    private geometry: THREE.BoxGeometry;
    private material: THREE.MeshStandardMaterial;
    private colors: Colors;

    constructor(vehicle: Vehicle | Trailer, center: Vector3 = { X: 0, Y: 0, Z: 0 }, colors: Colors) {
        this.vehicle = vehicle;
        this.colors = colors;

        this.geometry = new THREE.BoxGeometry(vehicle.size.X, vehicle.size.Y, vehicle.size.Z);
        this.material = new THREE.MeshStandardMaterial({ color: Number(this.colors.vehicles) });
        this.material.transparent = true;
        this.material.opacity = 0.6;
        this.mesh = new THREE.Mesh(this.geometry, this.material);

        this.mesh.castShadow = true;
        
        this.updateMesh(center);
    }
    
    public updateVehicle(vehicle: Vehicle | Trailer, center: Vector3 = { X: 0, Y: 0, Z: 0 }) {
        this.vehicle = vehicle;
        this.updateMesh(center);
    }
    
    public updateMesh(center: Vector3 = { X: 0, Y: 0, Z: 0 }) {
        this.mesh.position.set(
            this.vehicle.position.X - center.X,
            this.vehicle.position.Y - center.Y,
            this.vehicle.position.Z - center.Z
        );
        this.mesh.quaternion.set(
            -this.vehicle.rotation.X,
            this.vehicle.rotation.Y,
            this.vehicle.rotation.Z,
            this.vehicle.rotation.W
        );
    }
    
    public dispose() {
        this.geometry.dispose();
        this.material.dispose();
    }
}

export class VehicleRenderer {
    public group: THREE.Group = new THREE.Group();
    private vehicleMap: Map<number, RendererVehicle> = new Map();
    private vehicleTrailers: Map<number, RendererVehicle[]> = new Map();
    private colors: Colors;
    public center: Vector3 = { X: 0, Y: 0, Z: 0 };

    constructor(colors: Colors) {
        this.colors = colors;
    }

    public updateVehicles(vehicles: Vehicle[]) {
        const newIds = new Set(vehicles.map((v) => v.id));
        
        // Updated or added (this is ugly, please help :sob:)
        for (const vehicle of vehicles) {
            if (this.vehicleMap.has(vehicle.id)) {
                const rendererVehicle = this.vehicleMap.get(vehicle.id)!;
                rendererVehicle.updateVehicle(vehicle, this.center);
                for (const trailer of vehicle.trailers) {
                    const trailerRenderers = this.vehicleTrailers.get(vehicle.id) || [];
                    const trailerRenderer = trailerRenderers.find(t => t.vehicle.id === trailer.id);
                    if (trailerRenderer) {
                        trailerRenderer.updateVehicle(trailer, this.center);
                    } else {
                        const newTrailerRenderer = new RendererVehicle(trailer, this.center, this.colors);
                        this.group.add(newTrailerRenderer.mesh);
                        if (!this.vehicleTrailers.has(vehicle.id)) {
                            this.vehicleTrailers.set(vehicle.id, []);
                        }
                        this.vehicleTrailers.get(vehicle.id)!.push(newTrailerRenderer);
                    }
                }
            } else {
                const newRendererVehicle = new RendererVehicle(vehicle, this.center, this.colors);
                for (const trailer of vehicle.trailers) {
                    const trailerRenderer = new RendererVehicle(trailer, this.center, this.colors);
                    this.group.add(trailerRenderer.mesh);
                    if (!this.vehicleTrailers.has(vehicle.id)) {
                        this.vehicleTrailers.set(vehicle.id, []);
                    }
                    this.vehicleTrailers.get(vehicle.id)!.push(trailerRenderer);
                }
                this.group.add(newRendererVehicle.mesh);
                this.vehicleMap.set(vehicle.id, newRendererVehicle);
            }
        }
        
        // Removed
        const existingIds = Array.from(this.vehicleMap.keys());
        for (const id of existingIds) {
            if (!newIds.has(id)) {
                const rendererVehicle = this.vehicleMap.get(id)!;
                this.group.remove(rendererVehicle.mesh);
                rendererVehicle.dispose();
                this.vehicleMap.delete(id);

                // Remove trailers
                const trailers = this.vehicleTrailers.get(id);
                if (trailers) {
                    for (const trailerRenderer of trailers) {
                        this.group.remove(trailerRenderer.mesh);
                        trailerRenderer.dispose();
                    }
                    this.vehicleTrailers.delete(id);
                }
            }
        }
    }
}
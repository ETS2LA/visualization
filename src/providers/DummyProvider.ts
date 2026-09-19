import type { DataProvider } from './DataProvider';
import type { DataFrame } from '../core/types';

export class DummyProvider implements DataProvider {
    connect(): Promise<void> {
        return Promise.resolve();
    }

    disconnect(): void { }

    onFrame(callback: (frame: DataFrame) => void): void {
        setInterval(() => {
            const dummyFrame: DataFrame = {
                timestamp: Date.now(),
                telemetryData: {
                    position: { X: 0, Y: 0, Z: 0 },
                    rotation: { X: 0, Y: 0, Z: 0, W: 1 },
                    trailers: [],
                    speed: 0,
                    speedLimit: 0,
                    throttle: 0,
                    brake: 0,
                    clutch: 0,
                    steering: 0
                },
                selfDrivingData: {
                    pathPoints: [],
                    targetVehicles: [],
                    targetSemaphores: [],
                    targetSpeed: 0,
                    isControllingSteering: false,
                    isControllingAcceleration: false
                },
                vehicles: [],
                nodes: {},
                roads: [],
                prefabs: [],
                models: []
            };
            callback(dummyFrame);
        }, 1000);
    }
}
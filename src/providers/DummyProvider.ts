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
                telemetry: {
                    position: { x: 0, y: 0, z: 0 },
                    rotation: { x: 0, y: 0, z: 0, w: 1 }
                },
                vehicles: [],
                nodes: {},
                roads: []
            };
            callback(dummyFrame);
        }, 1000);
    }
}
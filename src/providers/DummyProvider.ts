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
                    rotation: { X: 0, Y: 0, Z: 0, W: 1 }
                },
                vehicles: [],
                nodes: {},
                roads: []
            };
            callback(dummyFrame);
        }, 1000);
    }
}
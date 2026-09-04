import type { DataProvider } from './DataProvider';
import type { 
    DataFrame, 
    Node, 
    RoadSegment,
    Uid, 
} from '../core/types';

// This file connects to the following websockets:
// 1. ws://localhost:37525 - This socket is for fast data such as vehicle positions, telemetry, lights etc...
// 2. ws://localhost:37526 - This socket is for static data such as roads, prefabs, static objects etc...
//
// You'll need to implement *both* sockets for this file to work correctly.
// Do note that you don't need data from both, but both must connect.
//
// TODO: Use ets2la.local instead of localhost, make port configurable in UI.

interface StaticData {
    nodes: Record<Uid, Node>;
    roads: Array<RoadSegment>;
}

interface StaticDataMessage {
    add: {
        nodes: Record<Uid, Node>;
        roads: Array<RoadSegment>;
    };
    remove: {
        nodes: Uid[];
        roads: Uid[];
    }
}

export class LocalWsProvider implements DataProvider {
    private fastSocket: WebSocket | null = null;
    private dataSocket: WebSocket | null = null;
    private frameCallback: ((frame: DataFrame) => void) | null = null;

    private staticData: StaticData = { nodes: {}, roads: [] };

    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            const fastSocket = new WebSocket('ws://localhost:37525');
            const dataSocket = new WebSocket('ws://localhost:37526');

            let fastSocketOpen = false;
            let dataSocketOpen = false;

            const checkBothOpen = () => {
                if (fastSocketOpen && dataSocketOpen) {
                    this.fastSocket = fastSocket;
                    this.dataSocket = dataSocket;
                    resolve();
                }
            };

            fastSocket.onopen = () => {
                fastSocketOpen = true;
                checkBothOpen();
            };
            dataSocket.onopen = () => {
                dataSocketOpen = true;
                checkBothOpen();
            };

            fastSocket.onerror = (err) => reject(err);
            dataSocket.onerror = (err) => reject(err);

            fastSocket.onmessage = (event) => {
                if (this.frameCallback) {
                    const frame: DataFrame = JSON.parse(event.data);
                    
                    // We need to inject the static data into the frame.
                    frame.roads = this.staticData.roads;
                    frame.nodes = this.staticData.nodes;

                    this.frameCallback(frame);
                }
            };

            dataSocket.onmessage = (event) => {
                const message: StaticDataMessage = JSON.parse(event.data);

                // Additions
                for (const nodeId in message.add.nodes) {
                    this.staticData.nodes[nodeId] = message.add.nodes[nodeId];
                }
                this.staticData.roads.push(...message.add.roads);

                // Removals
                for (const nodeId of message.remove.nodes) {
                    delete this.staticData.nodes[nodeId];
                }
                this.staticData.roads = this.staticData.roads.filter(road => !message.remove.roads.includes(road.id));
            };
        });
    }

    disconnect(): void {
        if (this.fastSocket) {
            this.fastSocket.close();
            this.fastSocket = null;
        }
        if (this.dataSocket) {
            this.dataSocket.close();
            this.dataSocket = null;
        }
    }

    onFrame(callback: (frame: DataFrame) => void): void {
        this.frameCallback = callback;
    }
}
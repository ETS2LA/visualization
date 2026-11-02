import type {
    DataFrame,
    Node,
    RoadSegment,
    Trailer,
    Uid,
    Vehicle,
    Vector3,
    Quaternion,
    TelemetryTrailer,
} from './types';
import {
    ticksToDate,
    type Recording,
    type RecordingEvent,
} from './recording';

// Note: This file was created using AI (the same as the corresponding file on the plugin-side)
//       I can't guarantee this is the best it can be, nor that it is free of bugs. It's good enough
//       for now though and I will maintain it if bugs do occur.

export class BinaryStreamReader {
    private view: DataView;
    private offset: number = 0;
    private decoder = new TextDecoder('utf-8');

    constructor(buffer: ArrayBuffer) {
        this.view = new DataView(buffer);
    }

    get position(): number {
        return this.offset;
    }

    get byteLength(): number {
        return this.view.byteLength;
    }

    get hasMore(): boolean {
        return this.offset < this.view.byteLength;
    }

    readByte(): number {
        if (this.offset + 1 > this.view.byteLength) {
            throw new Error(`Unexpected EOF reading byte at offset ${this.offset}`);
        }
        const val = this.view.getUint8(this.offset);
        this.offset += 1;
        return val;
    }

    readBoolean(): boolean {
        return this.readByte() !== 0;
    }

    readInt32(): number {
        if (this.offset + 4 > this.view.byteLength) {
            throw new Error(`Unexpected EOF reading Int32 at offset ${this.offset}`);
        }
        const val = this.view.getInt32(this.offset, true);
        this.offset += 4;
        return val;
    }

    readUInt32(): number {
        if (this.offset + 4 > this.view.byteLength) {
            throw new Error(`Unexpected EOF reading UInt32 at offset ${this.offset}`);
        }
        const val = this.view.getUint32(this.offset, true);
        this.offset += 4;
        return val;
    }

    readInt64(): bigint {
        if (this.offset + 8 > this.view.byteLength) {
            throw new Error(`Unexpected EOF reading Int64 at offset ${this.offset}`);
        }
        const val = this.view.getBigInt64(this.offset, true);
        this.offset += 8;
        return val;
    }

    readSingle(): number {
        if (this.offset + 4 > this.view.byteLength) {
            throw new Error(`Unexpected EOF reading Single (float) at offset ${this.offset}`);
        }
        const val = this.view.getFloat32(this.offset, true);
        this.offset += 4;
        return val;
    }

    read7BitEncodedInt(): number {
        let result = 0;
        let shift = 0;
        while (shift < 35) {
            const b = this.readByte();
            result |= (b & 0x7f) << shift;
            if ((b & 0x80) === 0) {
                return result;
            }
            shift += 7;
        }
        throw new Error("Invalid 7-bit encoded integer in binary stream");
    }

    readString(): string {
        const byteCount = this.read7BitEncodedInt();
        if (byteCount === 0) return '';
        if (this.offset + byteCount > this.view.byteLength) {
            throw new Error(`Unexpected EOF reading string of ${byteCount} bytes at offset ${this.offset}`);
        }
        const bytes = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, byteCount);
        this.offset += byteCount;
        return this.decoder.decode(bytes);
    }

    readVector3(): Vector3 {
        return {
            X: this.readSingle(),
            Y: this.readSingle(),
            Z: this.readSingle(),
        };
    }

    readQuaternion(): Quaternion {
        return {
            X: this.readSingle(),
            Y: this.readSingle(),
            Z: this.readSingle(),
            W: this.readSingle(),
        };
    }

    readVector3List(): Vector3[] {
        const count = this.readInt32();
        if (count < 0) return [];
        const list: Vector3[] = new Array(count);
        for (let i = 0; i < count; i++) {
            list[i] = this.readVector3();
        }
        return list;
    }

    readIntList(): number[] {
        const count = this.readInt32();
        if (count < 0) return [];
        const list: number[] = new Array(count);
        for (let i = 0; i < count; i++) {
            list[i] = this.readInt32();
        }
        return list;
    }

    readFloatArray(): number[] {
        const count = this.readInt32();
        if (count < 0) return [];
        const list: number[] = new Array(count);
        for (let i = 0; i < count; i++) {
            list[i] = this.readSingle();
        }
        return list;
    }
}

export async function decompressGzip(data: ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
    const buffer = data instanceof Uint8Array
        ? (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
        : data;
    const blob = new Blob([buffer]);
    const decompressedStream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(decompressedStream).arrayBuffer();
}

function parseUid(idStr: string): Uid {
    const num = Number(idStr);
    return isNaN(num) ? 0 : num;
}

export class RecordingDeserializer {
    public static readonly MAGIC = 0x52434456; // "VDCR" in little-endian
    public static readonly VERSION = 1;

    public static readonly EVENT_PLAYER = 0;
    public static readonly EVENT_TRAFFIC = 1;

    public static async deserialize(data: ArrayBuffer | Uint8Array): Promise<Recording> {
        let decompressed: ArrayBuffer;
        const uint8 = data instanceof Uint8Array ? data : new Uint8Array(data);

        // Check for GZip magic header: 0x1f, 0x8b
        if (uint8.length >= 2 && uint8[0] === 0x1f && uint8[1] === 0x8b) {
            decompressed = await decompressGzip(uint8);
        } else {
            // Already raw / uncompressed
            decompressed = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength) as ArrayBuffer;
        }

        const reader = new BinaryStreamReader(decompressed);

        const magic = reader.readUInt32();
        if (magic !== this.MAGIC) {
            throw new Error(`Not a Virtual Dashcam recording (magic: 0x${magic.toString(16)} expected: 0x${this.MAGIC.toString(16)})`);
        }

        const version = reader.readByte();
        if (version !== this.VERSION) {
            throw new Error(`Unsupported recording version ${version}. Expected ${this.VERSION}.`);
        }

        const startTimeTicks = reader.readInt64();
        const endTimeTicks = reader.readInt64();
        const username = reader.readString();

        const count = reader.readInt32();
        const events: RecordingEvent[] = new Array(count);

        for (let i = 0; i < count; i++) {
            const type = reader.readByte();
            const timestamp = reader.readSingle();
            const approxTimeTillNext = reader.readSingle();

            switch (type) {
                case this.EVENT_PLAYER:
                    events[i] = {
                        type: 'player',
                        timestamp,
                        approxTimeTillNext,
                        data: this.readDataFrame(reader),
                    };
                    break;
                case this.EVENT_TRAFFIC:
                    events[i] = {
                        type: 'traffic',
                        timestamp,
                        approxTimeTillNext,
                        vehicles: this.readVehicles(reader),
                    };
                    break;
                default:
                    throw new Error(`Unknown recording event type ${type} at index ${i}`);
            }
        }

        return {
            startTime: ticksToDate(startTimeTicks),
            endTime: ticksToDate(endTimeTicks),
            username,
            events,
        };
    }

    private static readDataFrame(r: BinaryStreamReader): DataFrame {
        const rawTimestamp = r.readInt64();
        const timestamp = Number(rawTimestamp);
        const telemetryData = this.readTelemetryData(r);
        const selfDrivingData = this.readSelfDrivingData(r);

        const nodeCount = r.readInt32();
        const nodes: Record<Uid, Node> = {};
        for (let i = 0; i < nodeCount; i++) {
            const key = parseUid(r.readString());
            const node = this.readNode(r);
            nodes[key] = node;
        }

        const roads = this.readRoads(r);
        const vehicles = this.readVehicles(r);

        return {
            timestamp,
            telemetryData,
            selfDrivingData,
            nodes,
            roads,
            vehicles,
            prefabs: [],
            models: [],
        };
    }

    private static readTelemetryData(r: BinaryStreamReader) {
        const position = r.readVector3();
        const rotation = r.readQuaternion();

        const trailerCount = r.readInt32();
        const trailers: TelemetryTrailer[] = new Array(trailerCount);
        for (let i = 0; i < trailerCount; i++) {
            trailers[i] = this.readTelemetryTrailer(r);
        }

        const speed = r.readSingle();
        const speedLimit = r.readSingle();
        const throttle = r.readSingle();
        const brake = r.readSingle();
        const clutch = r.readSingle();
        const steering = r.readSingle();

        return {
            position,
            rotation,
            trailers,
            speed,
            speedLimit,
            throttle,
            brake,
            clutch,
            steering,
        };
    }

    private static readTelemetryTrailer(r: BinaryStreamReader): TelemetryTrailer {
        return {
            position: r.readVector3(),
            rotationEuler: r.readVector3(),
            hookPosition: r.readVector3(),
            wheels: r.readVector3List(),
        };
    }

    private static readSelfDrivingData(r: BinaryStreamReader) {
        return {
            pathPoints: r.readVector3List(),
            targetVehicles: r.readIntList(),
            targetSemaphores: r.readIntList(),
            targetSpeed: r.readSingle(),
            isControllingSteering: r.readBoolean(),
            isControllingAcceleration: r.readBoolean(),
        };
    }

    private static readNode(r: BinaryStreamReader): Node {
        const id = parseUid(r.readString());
        return {
            id,
            position: r.readVector3(),
            rotation: r.readQuaternion(),
        };
    }

    private static readRoads(r: BinaryStreamReader): RoadSegment[] {
        const count = r.readInt32();
        if (count < 0) return [];
        const roads: RoadSegment[] = new Array(count);

        for (let i = 0; i < count; i++) {
            const id = parseUid(r.readString());
            const node = parseUid(r.readString());
            const forwardNode = parseUid(r.readString());
            const length = r.readSingle();
            const laneOffsetsStart = r.readFloatArray();
            const laneOffsetsEnd = r.readFloatArray();
            const leftLaneCount = r.readInt32();
            const rightLaneCount = r.readInt32();

            roads[i] = {
                id,
                node,
                forwardNode,
                length,
                laneOffsetsStart,
                laneOffsetsEnd,
                leftLaneCount,
                rightLaneCount,
            };
        }
        return roads;
    }

    private static readVehicles(r: BinaryStreamReader): Vehicle[] {
        const count = r.readInt32();
        if (count < 0) return [];
        const vehicles: Vehicle[] = new Array(count);

        for (let i = 0; i < count; i++) {
            const id = parseUid(r.readString());
            const speed = r.readSingle();
            const position = r.readVector3();
            const rotation = r.readQuaternion();
            const size = r.readVector3();

            const trailerCount = r.readInt32();
            const trailers: Trailer[] = new Array(trailerCount);
            for (let j = 0; j < trailerCount; j++) {
                trailers[j] = {
                    id: (typeof id === 'number' ? id * 1000 + j + 1 : j),
                    position: r.readVector3(),
                    rotation: r.readQuaternion(),
                    size: r.readVector3(),
                };
            }

            vehicles[i] = {
                id,
                speed,
                position,
                rotation,
                size,
                trailers,
            };
        }
        return vehicles;
    }
}

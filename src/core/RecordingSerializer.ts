import type {
    DataFrame,
    Node,
    RoadSegment,
    Vehicle,
    Vector3,
    Quaternion,
    TelemetryTrailer,
    Prefab,
    Model,
    AxisAlignedBoundingBox,
} from './types';
import {
    dateToTicks,
    type Recording,
    type PlayerRecordingEvent,
    type TrafficRecordingEvent,
    type StaticDataRecordingEvent,
    type StaticDataMessage,
    type StaticDataAdditions,
    type StaticDataRemovals,
} from './recording';

// Note: This file was created using AI (the same as the corresponding file on the plugin-side)
//       I can't guarantee this is the best it can be, nor that it is free of bugs. It's good enough
//       for now though and I will maintain it if bugs do occur.

export class BinaryStreamWriter {
    private buffers: Uint8Array[] = [];
    private currentChunk: Uint8Array;
    private offset: number = 0;
    private chunkSize: number;
    private encoder = new TextEncoder();

    constructor(chunkSize: number = 65536) {
        this.chunkSize = chunkSize;
        this.currentChunk = new Uint8Array(chunkSize);
    }

    private ensureCapacity(bytesNeeded: number) {
        if (this.offset + bytesNeeded > this.chunkSize) {
            this.buffers.push(this.currentChunk.subarray(0, this.offset));
            this.chunkSize = Math.max(this.chunkSize, bytesNeeded * 2);
            this.currentChunk = new Uint8Array(this.chunkSize);
            this.offset = 0;
        }
    }

    writeByte(val: number): void {
        this.ensureCapacity(1);
        this.currentChunk[this.offset] = val & 0xff;
        this.offset += 1;
    }

    writeBoolean(val: boolean): void {
        this.writeByte(val ? 1 : 0);
    }

    writeInt32(val: number): void {
        this.ensureCapacity(4);
        const view = new DataView(this.currentChunk.buffer, this.currentChunk.byteOffset + this.offset, 4);
        view.setInt32(0, val, true);
        this.offset += 4;
    }

    writeUInt32(val: number): void {
        this.ensureCapacity(4);
        const view = new DataView(this.currentChunk.buffer, this.currentChunk.byteOffset + this.offset, 4);
        view.setUint32(0, val, true);
        this.offset += 4;
    }

    writeInt64(val: bigint): void {
        this.ensureCapacity(8);
        const view = new DataView(this.currentChunk.buffer, this.currentChunk.byteOffset + this.offset, 8);
        view.setBigInt64(0, val, true);
        this.offset += 8;
    }

    writeSingle(val: number): void {
        this.ensureCapacity(4);
        const view = new DataView(this.currentChunk.buffer, this.currentChunk.byteOffset + this.offset, 4);
        view.setFloat32(0, val, true);
        this.offset += 4;
    }

    write7BitEncodedInt(value: number): void {
        let v = value;
        while (v >= 0x80) {
            this.writeByte((v | 0x80) & 0xff);
            v >>>= 7;
        }
        this.writeByte(v & 0xff);
    }

    writeString(str: string): void {
        const encoded = this.encoder.encode(str);
        this.write7BitEncodedInt(encoded.length);
        this.writeBytes(encoded);
    }

    writeBytes(bytes: Uint8Array): void {
        let written = 0;
        while (written < bytes.length) {
            this.ensureCapacity(1);
            const available = this.chunkSize - this.offset;
            const toCopy = Math.min(available, bytes.length - written);
            this.currentChunk.set(bytes.subarray(written, written + toCopy), this.offset);
            this.offset += toCopy;
            written += toCopy;
        }
    }

    writeVector3(v: Vector3): void {
        this.writeSingle(v.X);
        this.writeSingle(v.Y);
        this.writeSingle(v.Z);
    }

    writeQuaternion(q: Quaternion): void {
        this.writeSingle(q.X);
        this.writeSingle(q.Y);
        this.writeSingle(q.Z);
        this.writeSingle(q.W);
    }

    writeVector3List(list?: Vector3[] | null): void {
        this.writeInt32(list?.length ?? 0);
        if (!list) return;
        for (const v of list) {
            this.writeVector3(v);
        }
    }

    writeIntList(list?: number[] | null): void {
        this.writeInt32(list?.length ?? 0);
        if (!list) return;
        for (const i of list) {
            this.writeInt32(i);
        }
    }

    writeFloatArray(arr?: number[] | null): void {
        this.writeInt32(arr?.length ?? 0);
        if (!arr) return;
        for (const f of arr) {
            this.writeSingle(f);
        }
    }

    writeIntArray(arr?: number[] | null): void {
        this.writeInt32(arr?.length ?? 0);
        if (!arr) return;
        for (const i of arr) {
            this.writeInt32(i);
        }
    }

    writeStringList(list?: string[] | null): void {
        this.writeInt32(list?.length ?? 0);
        if (!list) return;
        for (const s of list) {
            this.writeString(s ?? '');
        }
    }

    toArrayBuffer(): ArrayBuffer {
        const totalLength = this.buffers.reduce((acc, b) => acc + b.length, 0) + this.offset;
        const result = new Uint8Array(totalLength);
        let pos = 0;
        for (const b of this.buffers) {
            result.set(b, pos);
            pos += b.length;
        }
        if (this.offset > 0) {
            result.set(this.currentChunk.subarray(0, this.offset), pos);
        }
        return result.buffer;
    }
}

export async function compressGzip(data: ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
    const buffer = data instanceof Uint8Array
        ? (data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
        : data;
    const blob = new Blob([buffer]);
    const compressedStream = blob.stream().pipeThrough(new CompressionStream('gzip'));
    return await new Response(compressedStream).arrayBuffer();
}

export class RecordingSerializer {
    private static readonly MAGIC = 0x52434456;
    private static readonly VERSION = 1;

    private static readonly EVENT_PLAYER = 0;
    private static readonly EVENT_TRAFFIC = 1;
    private static readonly EVENT_STATIC_DATA = 2;
    private static readonly EVENT_PAUSE = 3;
    private static readonly EVENT_COLLISION = 4;

    public static async serialize(recording: Recording, compress: boolean = true): Promise<ArrayBuffer> {
        const w = new BinaryStreamWriter();

        w.writeUInt32(this.MAGIC);
        w.writeByte(this.VERSION);
        w.writeInt64(dateToTicks(recording.startTime));
        w.writeInt64(dateToTicks(recording.endTime));
        w.writeString(recording.username ?? '');

        w.writeInt32(recording.events.length);
        for (const evt of recording.events) {
            if (evt.type === 'player') {
                const player = evt as PlayerRecordingEvent;
                w.writeByte(this.EVENT_PLAYER);
                w.writeSingle(player.timestamp);
                w.writeSingle(player.approxTimeTillNext);
                this.writeDataFrame(w, player.data);
            } else if (evt.type === 'traffic') {
                const traffic = evt as TrafficRecordingEvent;
                w.writeByte(this.EVENT_TRAFFIC);
                w.writeSingle(traffic.timestamp);
                w.writeSingle(traffic.approxTimeTillNext);
                this.writeVehicles(w, traffic.vehicles);
            } else if (evt.type === 'staticData') {
                const staticData = evt as StaticDataRecordingEvent;
                w.writeByte(this.EVENT_STATIC_DATA);
                w.writeSingle(staticData.timestamp);
                w.writeSingle(staticData.approxTimeTillNext);
                this.writeStaticDataMessage(w, staticData.data);
            } else if (evt.type === 'pause') {
                w.writeByte(this.EVENT_PAUSE);
                w.writeSingle(evt.timestamp);
                w.writeSingle(evt.approxTimeTillNext);
                w.writeBoolean(evt.paused);
            } else if (evt.type === 'collision') {
                w.writeByte(this.EVENT_COLLISION);
                w.writeSingle(evt.timestamp);
                w.writeSingle(evt.approxTimeTillNext);
            }
        }

        const uncompressed = w.toArrayBuffer();
        if (compress) {
            return await compressGzip(uncompressed);
        }
        return uncompressed;
    }

    private static writeDataFrame(w: BinaryStreamWriter, frame: DataFrame): void {
        w.writeInt64(BigInt(frame.timestamp));
        this.writeTelemetryData(w, frame.telemetryData);
        this.writeSelfDrivingData(w, frame.selfDrivingData);

        const nodes = frame.nodes ? Object.entries(frame.nodes) : [];
        w.writeInt32(nodes.length);
        for (const [key, node] of nodes) {
            w.writeString(key);
            this.writeNode(w, node);
        }

        this.writeRoads(w, frame.roads);
        this.writeVehicles(w, frame.vehicles);
    }

    private static writeTelemetryData(w: BinaryStreamWriter, data: DataFrame['telemetryData']): void {
        w.writeVector3(data.position);
        w.writeQuaternion(data.rotation);

        const trailers = data.trailers;
        w.writeInt32(trailers?.length ?? 0);
        if (trailers) {
            for (const tr of trailers) {
                this.writeTelemetryTrailer(w, tr);
            }
        }

        w.writeSingle(data.speed);
        w.writeSingle(data.speedLimit);
        w.writeSingle(data.throttle);
        w.writeSingle(data.brake);
        w.writeSingle(data.clutch);
        w.writeSingle(data.steering);
    }

    private static writeTelemetryTrailer(w: BinaryStreamWriter, trailer: TelemetryTrailer): void {
        w.writeVector3(trailer.position);
        w.writeVector3(trailer.rotationEuler);
        w.writeVector3(trailer.hookPosition);
        w.writeVector3List(trailer.wheels);
    }

    private static writeSelfDrivingData(w: BinaryStreamWriter, data: DataFrame['selfDrivingData']): void {
        w.writeVector3List(data.pathPoints);
        w.writeIntList(data.targetVehicles);
        w.writeIntList(data.targetSemaphores);
        w.writeSingle(data.targetSpeed);
        w.writeBoolean(data.isControllingSteering);
        w.writeBoolean(data.isControllingAcceleration);
    }

    private static writeNode(w: BinaryStreamWriter, node: Node): void {
        w.writeString(String(node.id ?? ''));
        w.writeVector3(node.position);
        w.writeQuaternion(node.rotation);
    }

    private static writeRoads(w: BinaryStreamWriter, roads?: RoadSegment[] | null): void {
        w.writeInt32(roads?.length ?? 0);
        if (!roads) return;

        for (const road of roads) {
            w.writeString(String(road.id ?? ''));
            w.writeString(String(road.node ?? ''));
            w.writeString(String(road.forwardNode ?? ''));
            w.writeSingle(road.length);
            w.writeFloatArray(road.laneOffsetsStart);
            w.writeFloatArray(road.laneOffsetsEnd);
            w.writeInt32(road.leftLaneCount);
            w.writeInt32(road.rightLaneCount);
        }
    }

    private static writeVehicles(w: BinaryStreamWriter, vehicles?: Vehicle[] | null): void {
        w.writeInt32(vehicles?.length ?? 0);
        if (!vehicles) return;

        for (const vehicle of vehicles) {
            w.writeString(String(vehicle.id ?? ''));
            w.writeSingle(vehicle.speed);
            w.writeVector3(vehicle.position);
            w.writeQuaternion(vehicle.rotation);
            w.writeVector3(vehicle.size);

            const trailers = vehicle.trailers;
            w.writeInt32(trailers?.length ?? 0);
            if (trailers) {
                for (const trailer of trailers) {
                    w.writeVector3(trailer.position);
                    w.writeQuaternion(trailer.rotation);
                    w.writeVector3(trailer.size);
                }
            }
        }
    }

    // ---- Static Data -----------------------------------------------------

    private static writeStaticDataMessage(w: BinaryStreamWriter, message: StaticDataMessage): void {
        this.writeStaticDataAdditions(w, message.add);
        this.writeStaticDataRemovals(w, message.remove);
    }

    private static writeStaticDataAdditions(w: BinaryStreamWriter, additions: StaticDataAdditions): void {
        const nodes = additions.nodes ? Object.entries(additions.nodes) : [];
        w.writeInt32(nodes.length);
        for (const [key, node] of nodes) {
            w.writeString(key);
            this.writeNode(w, node);
        }

        this.writeRoads(w, additions.roads);
        this.writePrefabs(w, additions.prefabs);
        this.writeModels(w, additions.models);
    }

    private static writeStaticDataRemovals(w: BinaryStreamWriter, removals: StaticDataRemovals): void {
        w.writeStringList(removals.nodes?.map(String));
        w.writeStringList(removals.roads?.map(String));
        w.writeStringList(removals.prefabs?.map(String));
        w.writeStringList(removals.models?.map(String));
    }

    private static writePrefabs(w: BinaryStreamWriter, prefabs?: Prefab[] | null): void {
        w.writeInt32(prefabs?.length ?? 0);
        if (!prefabs) return;

        for (const prefab of prefabs) {
            w.writeString(String(prefab.id ?? ''));
            w.writeVector3(prefab.prefabStart);
            w.writeVector3(prefab.rootNodePosition);
            w.writeVector3(prefab.prefabRotation);

            const segments = prefab.segments;
            w.writeInt32(segments?.length ?? 0);
            if (segments) {
                for (const seg of segments) {
                    w.writeVector3(seg.startPosition);
                    w.writeVector3(seg.endPosition);
                    w.writeQuaternion(seg.startRotation);
                    w.writeQuaternion(seg.endRotation);
                    w.writeIntArray(seg.nextSegments);
                    w.writeIntArray(seg.previousSegments);
                    w.writeString(String(seg.id ?? ''));
                    w.writeSingle(seg.length);
                }
            }
        }
    }

    private static writeModels(w: BinaryStreamWriter, models?: Model[] | null): void {
        w.writeInt32(models?.length ?? 0);
        if (!models) return;

        for (const model of models) {
            w.writeString(String(model.id ?? ''));
            w.writeString(String(model.node ?? ''));
            w.writeVector3(model.scale);
            this.writeBoundingBox(w, model.boundingBox);
            w.writeVector3(model.boundingBoxCenter);

            const parts = model.parts;
            w.writeInt32(parts?.length ?? 0);
            if (parts) {
                for (const part of parts) {
                    const pieces = part.pieces;
                    w.writeInt32(pieces?.length ?? 0);
                    if (pieces) {
                        for (const piece of pieces) {
                            this.writeBoundingBox(w, piece.boundingBox);
                            w.writeVector3(piece.boundingBoxCenter);
                        }
                    }
                }
            }
        }
    }

    private static writeBoundingBox(w: BinaryStreamWriter, box: AxisAlignedBoundingBox): void {
        w.writeVector3(box.min);
        w.writeVector3(box.max);
    }
}

import type {
    Coordinate,
    Quaternion,
    Vector3,
    DataFrame,
    Vehicle,
    Node,
    RoadSegment,
    Prefab,
    Model,
    Uid,
} from './types';

export interface TelemetryTrailer {
    position: Coordinate;
    rotationEuler: Vector3;
    hookPosition: Coordinate;
    wheels: Vector3[];
}

export interface TelemetryData {
    position: Coordinate;
    rotation: Quaternion;
    trailers: TelemetryTrailer[];
    speed: number;
    speedLimit: number;
    throttle: number;
    brake: number;
    clutch: number;
    steering: number;
}

export interface SelfDrivingData {
    pathPoints: Coordinate[];
    targetVehicles: number[];
    targetSemaphores: number[];
    targetSpeed: number;
    isControllingSteering: boolean;
    isControllingAcceleration: boolean;
}

export interface PlayerRecordingEvent {
    type: 'player';
    timestamp: number;
    approxTimeTillNext: number;
    data: DataFrame;
}

export interface TrafficRecordingEvent {
    type: 'traffic';
    timestamp: number;
    approxTimeTillNext: number;
    vehicles: Vehicle[];
}

export interface StaticDataAdditions {
    nodes: Record<Uid, Node>;
    roads: RoadSegment[];
    prefabs: Prefab[];
    models: Model[];
}

export interface StaticDataRemovals {
    nodes: Uid[];
    roads: Uid[];
    prefabs: Uid[];
    models: Uid[];
}

export interface StaticDataMessage {
    add: StaticDataAdditions;
    remove: StaticDataRemovals;
}

export interface StaticDataRecordingEvent {
    type: 'staticData';
    timestamp: number;
    approxTimeTillNext: number;
    data: StaticDataMessage;
}

export interface PauseRecordingEvent {
    type: 'pause';
    timestamp: number;
    approxTimeTillNext: number;
    paused: boolean;
}

export interface CollisionRecordingEvent {
    type: 'collision';
    timestamp: number;
    approxTimeTillNext: number;
}

export type RecordingEvent =
    | PlayerRecordingEvent
    | TrafficRecordingEvent
    | StaticDataRecordingEvent
    | PauseRecordingEvent
    | CollisionRecordingEvent;

export interface Recording {
    startTime: Date;
    endTime: Date;
    username: string;
    events: RecordingEvent[];
}

export interface TimelineMarker {
    time: number;
    label?: string;
}

export interface PauseInterval {
    startTime: number;
    endTime: number;
}

export interface PlaybackState {
    isPlaying: boolean;
    currentTime: number; // in seconds relative to start of recording
    duration: number; // in seconds
    eventIndex: number;
    totalEvents: number;
    username: string;
    startTime: Date;
    endTime: Date;
    playbackSpeed: number;
    isLooping: boolean;
    isGamePaused: boolean;
    currentPauseEndTime?: number;
    collisions: TimelineMarker[];
    pauses: PauseInterval[];
}

// .NET DateTime.Ticks epoch: Jan 1, 0001 00:00:00 UTC
// Unix epoch: Jan 1, 1970 00:00:00 UTC
// Difference: 621,355,968,000,000,000 ticks. 1 tick = 100ns = 10,000 ticks per ms.
const TICKS_AT_UNIX_EPOCH = 621355968000000000n;
const TICKS_PER_MILLISECOND = 10000n;

export function ticksToDate(ticks: bigint): Date {
    const ms = Number((ticks - TICKS_AT_UNIX_EPOCH) / TICKS_PER_MILLISECOND);
    return new Date(ms);
}

export function dateToTicks(date: Date): bigint {
    const ms = BigInt(date.getTime());
    return ms * TICKS_PER_MILLISECOND + TICKS_AT_UNIX_EPOCH;
}

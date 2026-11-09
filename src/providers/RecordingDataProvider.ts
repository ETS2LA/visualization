import type { DataProvider } from './DataProvider';
import type { DataFrame, Node, RoadSegment, Uid, Vehicle, Prefab, Model } from '../core/types';
import type { Recording, RecordingEvent, PlaybackState, StaticDataMessage, TimelineMarker, PauseInterval } from '../core/recording';

// Note: This file was created using AI (the same as the corresponding file on the plugin-side)
//       I can't guarantee this is the best it can be, nor that it is free of bugs. It's good enough
//       for now though and I will maintain it if bugs do occur.

export abstract class RecordingDataProvider implements DataProvider {
    protected recording: Recording | null = null;
    protected eventTimes: number[] = [];
    protected frameCallback: ((frame: DataFrame) => void) | null = null;
    protected playbackListeners: Set<(state: PlaybackState) => void> = new Set();

    protected isPlaying: boolean = false;
    protected isLooping: boolean = true;
    public playbackSpeed: number = 1.0;
    protected currentTime: number = 0; // In seconds relative to recording start
    protected duration: number = 0; // In seconds
    protected currentEventIndex: number = 0;

    protected animFrameId: number | null = null;
    protected lastAnimTime: number = 0;
    protected lastStateNotificationTime: number = 0;

    protected latestPlayerFrame: DataFrame | null = null;
    protected latestTrafficVehicles: Vehicle[] = [];

    // Static data accumulation (nodes, roads, prefabs, models)
    protected staticNodes: Record<Uid, Node> = {};
    protected staticRoads: Map<Uid, RoadSegment> = new Map();
    protected staticPrefabs: Map<Uid, Prefab> = new Map();
    protected staticModels: Map<Uid, Model> = new Map();

    // Timeline event markers
    protected collisions: TimelineMarker[] = [];
    protected pauses: PauseInterval[] = [];

    public controls = {
        play: () => this.play(),
        pause: () => this.pause(),
        seek: (timeInSeconds: number) => this.seek(timeInSeconds),
        skipPause: () => this.skipPause(),
    };

    protected computeEventTimes(events: RecordingEvent[]): { times: number[]; duration: number } {
        if (events.length === 0) {
            return { times: [], duration: 0 };
        }

        const times: number[] = new Array(events.length);
        const hasFractionalTimestamps = events.some(e => e.timestamp % 1 !== 0);

        if (hasFractionalTimestamps) {
            // Event timestamps already have sub-second precision.
            // 0s of the timeline matches the first normal frame (player or traffic),
            // not earlier pre-buffered events (e.g. static data saved up to 120s beforehand).
            const firstNormalIdx = events.findIndex(e => e.type === 'player' || e.type === 'traffic');
            const baseTime = firstNormalIdx !== -1 ? events[firstNormalIdx].timestamp : events[0].timestamp;

            let maxTime = 0;
            for (let i = 0; i < events.length; i++) {
                const diff = events[i].timestamp - baseTime;
                // Events before the first normal frame or part of the initial frame (<= 10ms diff) map to 0
                const t = diff <= 0.01 ? 0 : diff;
                if (t > maxTime) {
                    maxTime = t;
                }
                times[i] = maxTime;
            }
        } else {
            // Event timestamps were rounded to integer seconds (e.g. C# integer division).
            // Check if player data.timestamp is available with millisecond resolution.
            let firstPlayerDataTimestamp: number | null = null;
            for (const evt of events) {
                if (evt.type === 'player' && evt.data.timestamp > 0) {
                    firstPlayerDataTimestamp = evt.data.timestamp;
                    break;
                }
            }

            if (firstPlayerDataTimestamp !== null) {
                let lastPlayerTime = 0;
                for (let i = 0; i < events.length; i++) {
                    const evt = events[i];
                    if (evt.type === 'player' && evt.data.timestamp > 0) {
                        lastPlayerTime = Math.max(0, (evt.data.timestamp - firstPlayerDataTimestamp) / 1000);
                        times[i] = lastPlayerTime;
                    } else {
                        times[i] = lastPlayerTime;
                    }
                }
            } else {
                // Fallback: accumulate approxTimeTillNext
                let accumulated = 0;
                for (let i = 0; i < events.length; i++) {
                    times[i] = accumulated;
                    if (events[i].type === 'player') {
                        accumulated += events[i].approxTimeTillNext || 0.2;
                    }
                }
            }
        }

        const duration = times.length > 0 ? times[times.length - 1] : 0;
        return { times, duration };
    }

    public setRecording(recording: Recording, autoPlay: boolean = true): void {
        this.pause();
        this.recording = recording;
        this.currentEventIndex = 0;
        this.currentTime = 0;
        this.latestPlayerFrame = null;
        this.latestTrafficVehicles = [];
        this.resetStaticData();

        const { times, duration } = this.computeEventTimes(recording.events);
        this.eventTimes = times;
        this.duration = duration;

        // Parse collisions and pauses
        this.collisions = [];
        this.pauses = [];
        let activePauseStart: number | null = null;

        for (let i = 0; i < recording.events.length; i++) {
            const evt = recording.events[i];
            const t = this.eventTimes[i];

            if (evt.type === 'collision') {
                this.collisions.push({ time: t, label: 'Collision' });
            } else if (evt.type === 'pause') {
                if (evt.paused) {
                    if (activePauseStart === null) {
                        activePauseStart = t;
                    }
                } else {
                    if (activePauseStart !== null) {
                        this.pauses.push({ startTime: activePauseStart, endTime: t });
                        activePauseStart = null;
                    }
                }
            }
        }

        if (activePauseStart !== null) {
            this.pauses.push({ startTime: activePauseStart, endTime: this.duration });
        }

        // Seek to 0 to emit initial frame
        this.seek(0);

        if (autoPlay && this.recording.events.length > 0) {
            this.play();
        } else {
            this.notifyPlaybackState();
        }
    }

    private resetStaticData(): void {
        this.staticNodes = {};
        this.staticRoads.clear();
        this.staticPrefabs.clear();
        this.staticModels.clear();
    }

    private applyStaticDataMessage(message: StaticDataMessage): void {
        // Additions
        if (message.add) {
            if (message.add.nodes) {
                for (const nodeId in message.add.nodes) {
                    this.staticNodes[nodeId] = message.add.nodes[nodeId];
                }
            }
            if (message.add.roads) {
                for (const road of message.add.roads) {
                    this.staticRoads.set(road.id, road);
                }
            }
            if (message.add.prefabs) {
                for (const prefab of message.add.prefabs) {
                    this.staticPrefabs.set(prefab.id, prefab);
                }
            }
            if (message.add.models) {
                for (const model of message.add.models) {
                    this.staticModels.set(model.id, model);
                }
            }
        }

        // Removals
        if (message.remove) {
            if (message.remove.nodes) {
                for (const nodeId of message.remove.nodes) {
                    delete this.staticNodes[nodeId];
                }
            }
            if (message.remove.roads) {
                for (const roadId of message.remove.roads) {
                    this.staticRoads.delete(roadId);
                }
            }
            if (message.remove.prefabs) {
                for (const prefabId of message.remove.prefabs) {
                    this.staticPrefabs.delete(prefabId);
                }
            }
            if (message.remove.models) {
                for (const modelId of message.remove.models) {
                    this.staticModels.delete(modelId);
                }
            }
        }
    }

    public getRecording(): Recording | null {
        return this.recording;
    }

    public connect(): Promise<void> {
        if (this.recording && !this.isPlaying) {
            this.play();
        }
        return Promise.resolve();
    }

    public disconnect(): void {
        this.pause();
    }

    public onFrame(callback: (frame: DataFrame) => void): void {
        this.frameCallback = callback;
        // If we already have a frame, emit it right away
        if (this.latestPlayerFrame) {
            this.emitCurrentFrame();
        }
    }

    public play(): void {
        if (!this.recording || this.recording.events.length === 0) return;
        if (this.isPlaying) return;

        // If at the end, restart
        if (this.currentTime >= this.duration) {
            this.seek(0);
        }

        this.isPlaying = true;
        this.lastAnimTime = performance.now();
        this.notifyPlaybackState();
        this.runLoop();
    }

    public pause(): void {
        if (!this.isPlaying) return;
        this.isPlaying = false;
        if (this.animFrameId !== null) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
        this.notifyPlaybackState();
    }

    public togglePlayPause(): void {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    public setSpeed(speed: number): void {
        this.playbackSpeed = Math.max(0.1, Math.min(speed, 10.0));
        this.notifyPlaybackState();
    }

    public setLoop(loop: boolean): void {
        this.isLooping = loop;
        this.notifyPlaybackState();
    }

    public skipPause(): void {
        const pause = this.pauses.find(p => this.currentTime >= p.startTime && this.currentTime < p.endTime);
        if (pause) {
            this.seek(pause.endTime);
        }
    }

    public seek(timeInSeconds: number): void {
        if (!this.recording || this.recording.events.length === 0) return;

        const targetTime = Math.max(0, Math.min(timeInSeconds, this.duration));
        this.currentTime = targetTime;

        const events = this.recording.events;

        // Reconstruct state up to targetTime
        this.latestPlayerFrame = null;
        this.latestTrafficVehicles = [];
        this.resetStaticData();

        let index = 0;
        while (index < events.length && this.eventTimes[index] <= targetTime) {
            const evt = events[index];
            if (evt.type === 'player') {
                this.latestPlayerFrame = evt.data;
                if (evt.data.roads && evt.data.roads.length > 0) {
                    for (const road of evt.data.roads) {
                        this.staticRoads.set(road.id, road);
                    }
                }
                if (evt.data.nodes && Object.keys(evt.data.nodes).length > 0) {
                    for (const nodeId in evt.data.nodes) {
                        this.staticNodes[nodeId] = evt.data.nodes[nodeId];
                    }
                }
                if (evt.data.vehicles && evt.data.vehicles.length > 0) {
                    this.latestTrafficVehicles = evt.data.vehicles;
                }
            } else if (evt.type === 'traffic') {
                this.latestTrafficVehicles = evt.vehicles;
            } else if (evt.type === 'staticData') {
                this.applyStaticDataMessage(evt.data);
            }
            index++;
        }

        this.currentEventIndex = index;

        // Emit current state twice to snap interpolator
        if (this.latestPlayerFrame) {
            this.emitCurrentFrame();
            this.emitCurrentFrame();
        }

        this.notifyPlaybackState();
    }

    private isCurrentTimeInPause(time: number): boolean {
        return this.pauses.some(p => time >= p.startTime && time < p.endTime);
    }

    private runLoop = (): void => {
        if (!this.isPlaying || !this.recording) return;

        const now = performance.now();
        const dt = ((now - this.lastAnimTime) / 1000) * this.playbackSpeed;
        this.lastAnimTime = now;

        const prevTime = this.currentTime;
        this.currentTime += dt;

        if (this.currentTime >= this.duration) {
            if (this.isLooping) {
                this.seek(0);
                this.lastAnimTime = performance.now();
                this.animFrameId = requestAnimationFrame(this.runLoop);
                return;
            } else {
                this.currentTime = this.duration;
                this.pause();
                return;
            }
        }

        const events = this.recording.events;
        let hasFrameToEmit = false;

        while (
            this.currentEventIndex < events.length &&
            this.eventTimes[this.currentEventIndex] <= this.currentTime
        ) {
            const evt = events[this.currentEventIndex];
            if (evt.type === 'player') {
                this.latestPlayerFrame = evt.data;
                if (evt.data.roads && evt.data.roads.length > 0) {
                    for (const road of evt.data.roads) {
                        this.staticRoads.set(road.id, road);
                    }
                }
                if (evt.data.nodes && Object.keys(evt.data.nodes).length > 0) {
                    for (const nodeId in evt.data.nodes) {
                        this.staticNodes[nodeId] = evt.data.nodes[nodeId];
                    }
                }
                if (evt.data.vehicles && evt.data.vehicles.length > 0) {
                    this.latestTrafficVehicles = evt.data.vehicles;
                }
                hasFrameToEmit = true;
            } else if (evt.type === 'traffic') {
                this.latestTrafficVehicles = evt.vehicles;
                hasFrameToEmit = true;
            } else if (evt.type === 'staticData') {
                this.applyStaticDataMessage(evt.data);
                hasFrameToEmit = true;
            }
            this.currentEventIndex++;
        }

        if (hasFrameToEmit && this.latestPlayerFrame) {
            this.emitCurrentFrame();
        }

        const wasPaused = this.isCurrentTimeInPause(prevTime);
        const isPaused = this.isCurrentTimeInPause(this.currentTime);

        // Notify state on pause transitions or throttled ~10 Hz during playback
        if (wasPaused !== isPaused || now - this.lastStateNotificationTime > 100) {
            this.lastStateNotificationTime = now;
            this.notifyPlaybackState();
        }

        this.animFrameId = requestAnimationFrame(this.runLoop);
    };

    private emitCurrentFrame(): void {
        if (!this.latestPlayerFrame || !this.frameCallback) return;

        const frame: DataFrame = {
            ...this.latestPlayerFrame,
            vehicles: this.latestTrafficVehicles,
            roads: this.staticRoads.size > 0 ? Array.from(this.staticRoads.values()) : (this.latestPlayerFrame.roads ?? []),
            nodes: { ...this.staticNodes, ...(this.latestPlayerFrame.nodes ?? {}) },
            prefabs: this.staticPrefabs.size > 0 ? Array.from(this.staticPrefabs.values()) : (this.latestPlayerFrame.prefabs ?? []),
            models: this.staticModels.size > 0 ? Array.from(this.staticModels.values()) : (this.latestPlayerFrame.models ?? []),
        };

        this.frameCallback(frame);
    }

    public getPlaybackState(): PlaybackState {
        const currentPause = this.pauses.find(p => this.currentTime >= p.startTime && this.currentTime < p.endTime);
        return {
            isPlaying: this.isPlaying,
            currentTime: this.currentTime,
            duration: this.duration,
            eventIndex: this.currentEventIndex,
            totalEvents: this.recording?.events.length ?? 0,
            username: this.recording?.username ?? 'Unknown',
            startTime: this.recording?.startTime ?? new Date(),
            endTime: this.recording?.endTime ?? new Date(),
            playbackSpeed: this.playbackSpeed,
            isLooping: this.isLooping,
            isGamePaused: !!currentPause,
            currentPauseEndTime: currentPause?.endTime,
            collisions: this.collisions,
            pauses: this.pauses,
        };
    }

    public onPlaybackStateChange(callback: (state: PlaybackState) => void): () => void {
        this.playbackListeners.add(callback);
        // Call immediately with current state
        callback(this.getPlaybackState());
        return () => {
            this.playbackListeners.delete(callback);
        };
    }

    protected notifyPlaybackState(): void {
        const state = this.getPlaybackState();
        for (const listener of this.playbackListeners) {
            listener(state);
        }
    }
}

import type { DataProvider } from './DataProvider';
import type { DataFrame, Node, RoadSegment, Uid, Vehicle } from '../core/types';
import type { Recording, RecordingEvent, PlaybackState } from '../core/recording';

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
    protected latestRoads: RoadSegment[] = [];
    protected latestNodes: Record<Uid, Node> = {};

    public controls = {
        play: () => this.play(),
        pause: () => this.pause(),
        seek: (timeInSeconds: number) => this.seek(timeInSeconds),
    };

    protected computeEventTimes(events: RecordingEvent[]): { times: number[]; duration: number } {
        if (events.length === 0) {
            return { times: [], duration: 0 };
        }

        const times: number[] = new Array(events.length);
        const hasFractionalTimestamps = events.some(e => e.timestamp % 1 !== 0);

        if (hasFractionalTimestamps) {
            // Event timestamps already have sub-second precision
            const baseTime = events[0].timestamp;
            for (let i = 0; i < events.length; i++) {
                times[i] = Math.max(0, events[i].timestamp - baseTime);
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
        this.latestRoads = [];
        this.latestNodes = {};

        const { times, duration } = this.computeEventTimes(recording.events);
        this.eventTimes = times;
        this.duration = duration;

        // Seek to 0 to emit initial frame
        this.seek(0);

        if (autoPlay && this.recording.events.length > 0) {
            this.play();
        } else {
            this.notifyPlaybackState();
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

    public seek(timeInSeconds: number): void {
        if (!this.recording || this.recording.events.length === 0) return;

        const targetTime = Math.max(0, Math.min(timeInSeconds, this.duration));
        this.currentTime = targetTime;

        const events = this.recording.events;

        // Reconstruct state up to targetTime
        this.latestPlayerFrame = null;
        this.latestTrafficVehicles = [];
        this.latestRoads = [];
        this.latestNodes = {};

        let index = 0;
        while (index < events.length && this.eventTimes[index] <= targetTime) {
            const evt = events[index];
            if (evt.type === 'player') {
                this.latestPlayerFrame = evt.data;
                if (evt.data.roads && evt.data.roads.length > 0) {
                    this.latestRoads = evt.data.roads;
                }
                if (evt.data.nodes && Object.keys(evt.data.nodes).length > 0) {
                    this.latestNodes = evt.data.nodes;
                }
                if (evt.data.vehicles && evt.data.vehicles.length > 0) {
                    this.latestTrafficVehicles = evt.data.vehicles;
                }
            } else if (evt.type === 'traffic') {
                this.latestTrafficVehicles = evt.vehicles;
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

    private runLoop = (): void => {
        if (!this.isPlaying || !this.recording) return;

        const now = performance.now();
        const dt = ((now - this.lastAnimTime) / 1000) * this.playbackSpeed;
        this.lastAnimTime = now;

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
                    this.latestRoads = evt.data.roads;
                }
                if (evt.data.nodes && Object.keys(evt.data.nodes).length > 0) {
                    this.latestNodes = evt.data.nodes;
                }
                if (evt.data.vehicles && evt.data.vehicles.length > 0) {
                    this.latestTrafficVehicles = evt.data.vehicles;
                }
                hasFrameToEmit = true;
            } else if (evt.type === 'traffic') {
                this.latestTrafficVehicles = evt.vehicles;
                hasFrameToEmit = true;
            }
            this.currentEventIndex++;
        }

        if (hasFrameToEmit && this.latestPlayerFrame) {
            this.emitCurrentFrame();
        }

        // Throttle UI notification to ~10 Hz during playback
        if (now - this.lastStateNotificationTime > 100) {
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
            roads: this.latestRoads.length > 0 ? this.latestRoads : (this.latestPlayerFrame.roads ?? []),
            nodes: Object.keys(this.latestNodes).length > 0 ? this.latestNodes : (this.latestPlayerFrame.nodes ?? {}),
            prefabs: this.latestPlayerFrame.prefabs ?? [],
            models: this.latestPlayerFrame.models ?? [],
        };

        this.frameCallback(frame);
    }

    public getPlaybackState(): PlaybackState {
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

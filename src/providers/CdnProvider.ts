import { RecordingDataProvider } from './RecordingDataProvider';
import { RecordingDeserializer } from '../core/RecordingDeserializer';
import type { Recording } from '../core/recording';

export class CdnProvider extends RecordingDataProvider {
    private url: string | null = null;
    private isLoading: boolean = false;
    private error: string | null = null;
    private statusListeners: Set<(loading: boolean, error: string | null, url: string | null) => void> = new Set();

    constructor(initialUrl?: string) {
        super();
        if (initialUrl) {
            this.url = initialUrl;
        }
    }

    public getUrl(): string | null {
        return this.url;
    }

    public getStatus(): { loading: boolean; error: string | null; url: string | null } {
        return {
            loading: this.isLoading,
            error: this.error,
            url: this.url,
        };
    }

    public onStatusChange(callback: (loading: boolean, error: string | null, url: string | null) => void): () => void {
        this.statusListeners.add(callback);
        callback(this.isLoading, this.error, this.url);
        return () => {
            this.statusListeners.delete(callback);
        };
    }

    private notifyStatus(): void {
        for (const listener of this.statusListeners) {
            listener(this.isLoading, this.error, this.url);
        }
    }

    public override async connect(): Promise<void> {
        if (this.url && !this.recording && !this.isLoading) {
            await this.loadUrl(this.url);
        } else {
            await super.connect();
        }
    }

    public async loadUrl(url: string): Promise<Recording> {
        this.url = url;
        this.isLoading = true;
        this.error = null;
        this.notifyStatus();

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch recording from CDN (${response.status} ${response.statusText})`);
            }

            const buffer = await response.arrayBuffer();
            const recording = await RecordingDeserializer.deserialize(buffer);

            this.isLoading = false;
            this.setRecording(recording, true);
            this.notifyStatus();
            return recording;
        } catch (err: unknown) {
            this.isLoading = false;
            this.error = err instanceof Error ? err.message : String(err);
            this.notifyStatus();
            throw err;
        }
    }
}

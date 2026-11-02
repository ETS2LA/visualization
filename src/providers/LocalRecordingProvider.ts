import { RecordingDataProvider } from './RecordingDataProvider';
import { RecordingDeserializer } from '../core/RecordingDeserializer';
import type { Recording } from '../core/recording';

export class LocalRecordingProvider extends RecordingDataProvider {
    private fileName: string | null = null;
    private fileListeners: Set<(fileName: string | null) => void> = new Set();

    constructor(initialData?: File | Blob | ArrayBuffer, fileName?: string) {
        super();
        if (initialData) {
            void this.loadFile(initialData, fileName ?? (initialData instanceof File ? initialData.name : undefined));
        }
    }

    public async loadFile(data: File | Blob | ArrayBuffer, name?: string): Promise<Recording> {
        let buffer: ArrayBuffer;
        const detectedName = name ?? (data instanceof File ? data.name : null);

        if (data instanceof Blob) {
            buffer = await data.arrayBuffer();
        } else {
            buffer = data;
        }

        const recording = await RecordingDeserializer.deserialize(buffer);
        this.fileName = detectedName;
        this.setRecording(recording, true);

        for (const listener of this.fileListeners) {
            listener(this.fileName);
        }

        return recording;
    }

    public getFileName(): string | null {
        return this.fileName;
    }

    public onFileChange(callback: (fileName: string | null) => void): () => void {
        this.fileListeners.add(callback);
        callback(this.fileName);
        return () => {
            this.fileListeners.delete(callback);
        };
    }
}

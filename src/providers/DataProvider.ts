import type { DataFrame } from '../core/types';

export interface DataProvider {
  connect(): Promise<void>;
  disconnect(): void;
  onFrame(callback: (frame: DataFrame) => void): void;
  
  controls?: {
    play(): void;
    pause(): void;
    seek(timestamp: number): void;
  };
}
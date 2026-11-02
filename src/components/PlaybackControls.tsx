import React, { useEffect, useState } from 'react';
import type { PlaybackState } from '../core/recording';
import type { RecordingDataProvider } from '../providers/RecordingDataProvider';

interface PlaybackControlsProps {
    provider: RecordingDataProvider;
    fileName?: string | null;
    onOpenFilePicker?: () => void;
}

function formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return '00:00.0';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
    provider,
    onOpenFilePicker,
}) => {
    const [state, setState] = useState<PlaybackState>(() => provider.getPlaybackState());
    const [isScrubbing, setIsScrubbing] = useState(false);
    const [scrubValue, setScrubValue] = useState(0);

    useEffect(() => {
        const unsubscribe = provider.onPlaybackStateChange((newState) => {
            setState(newState);
            if (!isScrubbing) {
                setScrubValue(newState.currentTime);
            }
        });
        return unsubscribe;
    }, [provider, isScrubbing]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }
            if (e.code === 'Space') {
                e.preventDefault();
                provider.togglePlayPause();
            } else if (e.code === 'ArrowLeft') {
                e.preventDefault();
                provider.seek(Math.max(0, state.currentTime - (e.shiftKey ? 10 : 2)));
            } else if (e.code === 'ArrowRight') {
                e.preventDefault();
                provider.seek(Math.min(state.duration, state.currentTime + (e.shiftKey ? 10 : 2)));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [provider, state.currentTime, state.duration]);

    const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        setScrubValue(val);
        setIsScrubbing(true);
        provider.seek(val);
    };

    const handleSeekCommit = () => {
        setIsScrubbing(false);
    };

    const speedOptions = [0.5, 1.0, 1.5, 2.0, 4.0];

    return (
        <div
            style={{
                position: 'absolute',
                bottom: '16px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 'calc(100% - 32px)',
                maxWidth: '860px',
                backgroundColor: 'rgba(39, 39, 39, 0.92)',
                backdropFilter: 'blur(12px)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                padding: '12px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                zIndex: 100,
                color: 'var(--text)',
                userSelect: 'none',
                opacity: 0.3,
                transition: 'opacity 0.2s ease-in-out',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    color: 'var(--description)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>

                    {state.username && (
                        <span>
                            Recording by <strong style={{ color: 'var(--text-h)' }}>{state.username}</strong>
                        </span>
                    )}
                </div>

                {onOpenFilePicker && (
                    <button
                        onClick={onOpenFilePicker}
                        className="button button-small"
                        style={{ gap: '4px' }}
                    >
                        Change File
                    </button>
                )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
                <span
                    style={{
                        fontSize: '12px',
                        fontFamily: 'ui-monospace, Consolas, monospace',
                        color: 'var(--text-h)',
                        minWidth: '58px',
                    }}
                >
                    {formatTime(isScrubbing ? scrubValue : state.currentTime)}
                </span>

                <input
                    type="range"
                    className="slider"
                    min={0}
                    max={state.duration || 1}
                    step={0.01}
                    value={isScrubbing ? scrubValue : state.currentTime}
                    onChange={handleSeekChange}
                    onMouseUp={handleSeekCommit}
                    onTouchEnd={handleSeekCommit}
                    style={{ flex: 1 }}
                />

                <span
                    style={{
                        fontSize: '12px',
                        fontFamily: 'ui-monospace, Consolas, monospace',
                        color: 'var(--description)',
                        minWidth: '58px',
                        textAlign: 'right',
                    }}
                >
                    {formatTime(state.duration)}
                </span>
            </div>

            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                        onClick={() => provider.togglePlayPause()}
                        title={state.isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                        className="button button-accent"
                        style={{
                            width: '32px',
                            height: '32px',
                            padding: 0,
                            borderRadius: '4px',
                        }}
                    >
                        {state.isPlaying ? (
                            <svg style={{ width: '16px', height: '16px', fill: 'currentColor' }} viewBox="0 0 24 24">
                                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                            </svg>
                        ) : (
                            <svg style={{ width: '16px', height: '16px', fill: 'currentColor', marginLeft: '1px' }} viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        )}
                    </button>

                    <button
                        onClick={() => provider.seek(Math.max(0, state.currentTime - 2))}
                        title="Back 2s (Left arrow)"
                        className="button button-small"
                        style={{ padding: '6px' }}
                    >
                        <svg style={{ width: '16px', height: '16px', fill: 'currentColor' }} viewBox="0 0 24 24">
                            <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
                        </svg>
                    </button>

                    <button
                        onClick={() => provider.seek(Math.min(state.duration, state.currentTime + 2))}
                        title="Forward 2s (Right arrow)"
                        className="button button-small"
                        style={{ padding: '6px' }}
                    >
                        <svg style={{ width: '16px', height: '16px', fill: 'currentColor' }} viewBox="0 0 24 24">
                            <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
                        </svg>
                    </button>

                    <button
                        onClick={() => provider.setLoop(!state.isLooping)}
                        title={state.isLooping ? 'Looping enabled' : 'Looping disabled'}
                        className={`button button-small ${state.isLooping ? 'button-active' : ''}`}
                        style={{ gap: '4px' }}
                    >
                        Loop
                    </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span className="description" style={{ marginRight: '2px' }}>Speed:</span>
                    {speedOptions.map((spd) => (
                        <button
                            key={spd}
                            onClick={() => provider.setSpeed(spd)}
                            className={`button button-small ${state.playbackSpeed === spd ? 'button-active' : ''}`}
                            style={{ padding: '2px 6px', fontSize: '11px' }}
                        >
                            {spd}x
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

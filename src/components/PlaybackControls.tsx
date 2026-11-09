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

    useEffect(() => {
        const unsubscribe = provider.onPlaybackStateChange((newState) => {
            setState(newState);
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
            } else if (e.key === 's' || e.key === 'S') {
                if (state.isGamePaused) {
                    e.preventDefault();
                    provider.skipPause();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [provider, state.currentTime, state.duration, state.isGamePaused]);

    const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
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
            {/* Top row: file, driver, collision and pause metadata */}
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

            {/* Middle row: timeline scrubber with pause and collision markers */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
                <span
                    style={{
                        fontSize: '12px',
                        fontFamily: 'ui-monospace, Consolas, monospace',
                        color: 'var(--text-h)',
                        minWidth: '58px',
                    }}
                >
                    {formatTime(state.currentTime)}
                </span>

                <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', height: '18px' }}>
                    {/* Render Pause intervals on timeline track */}
                    {state.pauses && state.pauses.map((pause, idx) => {
                        const dur = state.duration || 1;
                        const leftPct = (pause.startTime / dur) * 100;
                        const widthPct = Math.max(0.5, ((pause.endTime - pause.startTime) / dur) * 100);
                        return (
                            <div
                                key={`pause-${idx}`}
                                title={`Pause: ${formatTime(pause.startTime)} - ${formatTime(pause.endTime)} (Click to seek)`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    provider.seek(pause.startTime);
                                }}
                                style={{
                                    position: 'absolute',
                                    left: `${leftPct}%`,
                                    width: `${widthPct}%`,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    height: '6px',
                                    backgroundColor: 'rgba(202, 145, 0, 0.55)',
                                    borderLeft: '1px solid var(--warning)',
                                    borderRight: '1px solid var(--warning)',
                                    borderRadius: '1px',
                                    cursor: 'pointer',
                                    zIndex: 2,
                                    pointerEvents: 'auto',
                                }}
                            />
                        );
                    })}

                    {/* Render Collision pins on timeline */}
                    {state.collisions && state.collisions.map((col, idx) => {
                        const dur = state.duration || 1;
                        const leftPct = (col.time / dur) * 100;
                        return (
                            <div
                                key={`col-${idx}`}
                                title={`Collision at ${formatTime(col.time)} (Click to seek)`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    provider.seek(col.time);
                                }}
                                style={{
                                    position: 'absolute',
                                    left: `${leftPct}%`,
                                    top: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: '10px',
                                    height: '10px',
                                    backgroundColor: 'var(--accent)',
                                    border: '1.5px solid #ffffff',
                                    borderRadius: '50%',
                                    cursor: 'pointer',
                                    zIndex: 5,
                                    pointerEvents: 'auto',
                                }}
                            />
                        );
                    })}

                    <input
                        type="range"
                        className="slider"
                        min={0}
                        max={state.duration || 1}
                        step={0.01}
                        value={state.currentTime}
                        onChange={handleSeekChange}
                        onMouseUp={handleSeekCommit}
                        onTouchEnd={handleSeekCommit}
                        style={{ width: '100%', position: 'relative', zIndex: 3 }}
                    />
                </div>

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

            {/* Bottom row: playback controls */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {/* Play/Pause Button */}
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

                    {/* Step Backward */}
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

                    {/* Step Forward */}
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

                    {/* Loop Toggle */}
                    <button
                        onClick={() => provider.setLoop(!state.isLooping)}
                        title={state.isLooping ? 'Looping enabled' : 'Looping disabled'}
                        className={`button button-small ${state.isLooping ? 'button-active' : ''}`}
                        style={{ gap: '4px' }}
                    >
                        Loop
                    </button>

                    {/* Skip Pause Button if game is currently paused */}
                    {state.isGamePaused && (
                        <button
                            onClick={() => provider.skipPause()}
                            title="Skip in-game pause (S)"
                            className="button button-small button-accent"
                            style={{ gap: '4px', marginLeft: '6px' }}
                        >
                            Skip Pause
                        </button>
                    )}
                </div>

                {/* Speed selector */}
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

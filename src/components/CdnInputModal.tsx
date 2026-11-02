import React, { useState } from 'react';
import type { CdnProvider } from '../providers/CdnProvider';

interface CdnInputModalProps {
    provider: CdnProvider;
    onLoaded?: () => void;
}

export const CdnInputModal: React.FC<CdnInputModalProps> = ({ provider, onLoaded }) => {
    const [url, setUrl] = useState(provider.getUrl() ?? '');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = url.trim();
        if (!trimmed) return;

        setIsLoading(true);
        setError(null);

        try {
            await provider.loadUrl(trimmed);
            setIsLoading(false);
            onLoaded?.();
        } catch (err: unknown) {
            setIsLoading(false);
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    return (
        <div
            className="card"
            style={{
                width: '100%',
                maxWidth: '520px',
                padding: '28px',
                color: 'var(--text)',
            }}
        >
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                    <label className="description" style={{ display: 'block', marginBottom: '6px' }}>
                        Recording URL (.vdc / .vdcr)
                    </label>
                    <input
                        type="url"
                        className="input-text"
                        placeholder="https://pub-xyz.r2.dev/recording.vdcr"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        disabled={isLoading}
                        style={{ width: '100%' }}
                    />
                </div>

                <button
                    type="submit"
                    disabled={isLoading || !url.trim()}
                    className="button button-accent"
                    style={{
                        width: '100%',
                        padding: '8px 16px',
                        fontWeight: 600,
                        opacity: isLoading || !url.trim() ? 0.6 : 1,
                    }}
                >
                    {isLoading ? 'Fetching & Parsing...' : 'Load from CDN'}
                </button>
            </form>

            {error && (
                <div
                    style={{
                        marginTop: '14px',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--danger-bg)',
                        border: '1px solid var(--danger-dark)',
                        color: '#fca5a5',
                        fontSize: '12px',
                    }}
                >
                    {error}
                </div>
            )}
        </div>
    );
};

import React, { useState, useRef, useEffect } from 'react';

interface DropZoneProps {
    onFileSelected: (file: File) => void;
    isLoading?: boolean;
    error?: string | null;
}

export const DropZone: React.FC<DropZoneProps> = ({ onFileSelected, isLoading = false, error = null }) => {
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onFileSelected(e.dataTransfer.files[0]);
        }
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onFileSelected(e.target.files[0]);
        }
    };

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                maxWidth: '520px',
                height: 'auto',
                minHeight: '260px',
                padding: '36px 28px',
                border: isDragging ? '1px dashed var(--text-accent)' : '1px dashed var(--border)',
                borderRadius: '4px',
                backgroundColor: isDragging ? 'var(--control-bg)' : 'var(--control-bg-dark)',
                color: 'var(--text)',
                cursor: 'pointer',
                transition: 'all 0.15s ease-in-out',
                textAlign: 'center',
                userSelect: 'none',
            }}
        >
            <input
                ref={fileInputRef}
                type="file"
                accept=".vdc,.vdcr,.bin,.gz,*/*"
                style={{ display: 'none' }}
                onChange={handleFileInput}
            />

            {isLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    <div
                        style={{
                            width: '36px',
                            height: '36px',
                            border: '3px solid var(--control)',
                            borderTop: '3px solid var(--accent)',
                            borderRadius: '50%',
                            animation: 'spin 0.8s linear infinite',
                        }}
                    />
                    <style>
                        {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
                    </style>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-h)' }}>
                        Loading Dashcam Recording...
                    </div>
                    <div className="description">
                        Decompressing and parsing frames
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    <div>
                        <p className="description" style={{ margin: 0 }}>
                            Drag and drop a <code style={{ color: 'var(--text-accent)' }}>.vdcr</code> file here, or{' '}
                            <span style={{ color: 'var(--text-accent)', textDecoration: 'underline' }}>click to browse</span>
                        </p>
                    </div>

                    {error && (
                        <div
                            style={{
                                marginTop: '10px',
                                padding: '8px 14px',
                                borderRadius: '4px',
                                backgroundColor: 'var(--danger-bg)',
                                border: '1px solid var(--danger-dark)',
                                color: '#fca5a5',
                                fontSize: '12px',
                                maxWidth: '420px',
                            }}
                        >
                            {error}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export const GlobalDropOverlay: React.FC<{ onFileDropped: (file: File) => void }> = ({ onFileDropped }) => {
    const [isDragOverWindow, setIsDragOverWindow] = useState(false);
    const dragCounter = useRef(0);

    useEffect(() => {
        const handleDragEnter = (e: DragEvent) => {
            e.preventDefault();
            dragCounter.current++;
            if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
                setIsDragOverWindow(true);
            }
        };

        const handleDragLeave = (e: DragEvent) => {
            e.preventDefault();
            dragCounter.current--;
            if (dragCounter.current <= 0) {
                dragCounter.current = 0;
                setIsDragOverWindow(false);
            }
        };

        const handleDragOver = (e: DragEvent) => {
            e.preventDefault();
        };

        const handleDrop = (e: DragEvent) => {
            setIsDragOverWindow(false);
            e.preventDefault();
            dragCounter.current = 0;
            if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
                setTimeout(() => {
                    onFileDropped(e.dataTransfer!.files[0]);
                }, 0);
            }
        };

        window.addEventListener('dragenter', handleDragEnter);
        window.addEventListener('dragleave', handleDragLeave);
        window.addEventListener('dragover', handleDragOver);
        window.addEventListener('drop', handleDrop);

        return () => {
            window.removeEventListener('dragenter', handleDragEnter);
            window.removeEventListener('dragleave', handleDragLeave);
            window.removeEventListener('dragover', handleDragOver);
            window.removeEventListener('drop', handleDrop);
        };
    }, [onFileDropped]);

    if (!isDragOverWindow) return null;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                backgroundColor: 'rgba(36, 36, 36, 0.88)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                border: '2px dashed var(--accent)',
            }}
        >
            <h2 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-h)', margin: 0 }}>
                Drop to Load Dashcam Recording
            </h2>
            <p className="description" style={{ marginTop: '6px' }}>
                Virtual Dashcam recording will play immediately
            </p>
        </div>
    );
};

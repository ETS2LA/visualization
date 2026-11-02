import { useEffect, useRef, useState, useCallback } from 'react';
import { Visualizer } from './engine/Visualizer';
import { DummyProvider } from './providers/DummyProvider';
import { LocalWsProvider } from './providers/LocalWsProvider';
import { LocalRecordingProvider } from './providers/LocalRecordingProvider';
import { CdnProvider } from './providers/CdnProvider';
import { DropZone } from './components/DropZone';
import { PlaybackControls } from './components/PlaybackControls';
import { CdnInputModal } from './components/CdnInputModal';
import './App.css';

type SourceType = 'local' | 'cdn' | 'localws' | 'dummy';

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const visualizerRef = useRef<Visualizer | null>(null);

  const [sourceType, setSourceType] = useState<SourceType>(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('source');
    if (p === 'local' || p === 'file') return 'local';
    if (p === 'cdn' || p === 'cloudflare') return 'cdn';
    if (p === 'dummy') return 'dummy';
    if (p === 'localws') return 'localws';
    return 'local'; // Default is to the local file source this means if someone
                    // opens the page they'll be prompted to select a local file.
  });

  const [localProvider] = useState(() => new LocalRecordingProvider());
  const [cdnProvider] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const cdnUrl = params.get('url') || params.get('recording') || undefined;
    return new CdnProvider(cdnUrl);
  });

  const [localFileName, setLocalFileName] = useState<string | null>(null);
  const [isLocalLoading, setIsLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const [cdnLoaded, setCdnLoaded] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const truckParam = params.get('truck');
    const truckStyle: 'eu' | 'us' = (truckParam === 'eu' || truckParam === 'us') ? truckParam : 'eu';

    const visualizer = new Visualizer({
      container: containerRef.current,
      dark: params.get('light') !== 'true',
      truckStyle,
    });
    visualizerRef.current = visualizer;

    return () => {
      visualizer.dispose();
      visualizerRef.current = null;
    };
  }, []);

  useEffect(() => {
    return localProvider.onFileChange((name) => {
      setLocalFileName(name);
    });
  }, [localProvider]);

  useEffect(() => {
    return cdnProvider.onPlaybackStateChange((s) => {
      if (s.totalEvents > 0) {
        setCdnLoaded(true);
      }
    });
  }, [cdnProvider]);

  useEffect(() => {
    const visualizer = visualizerRef.current;
    if (!visualizer) return;

    console.log(`Setting source to: ${sourceType}`);

    switch (sourceType) {
      case 'local': {
        visualizer.setSource(localProvider);
        break;
      }
      case 'cdn': {
        visualizer.setSource(cdnProvider);
        break;
      }
      case 'localws': {
        visualizer.setSource(new LocalWsProvider());
        break;
      }
      case 'dummy': {
        visualizer.setSource(new DummyProvider());
        break;
      }
    }
  }, [sourceType, localProvider, cdnProvider]);

  const handleLocalFileSelected = useCallback(async (file: File) => {
    setIsLocalLoading(true);
    setLocalError(null);

    try {
      if (sourceType !== 'local') {
        setSourceType('local');
      }

      await localProvider.loadFile(file);
      setIsLocalLoading(false);
      setLocalError(null);

      if (visualizerRef.current) {
        visualizerRef.current.setSource(localProvider);
      }
    } catch (err: unknown) {
      setIsLocalLoading(false);
      const msg = err instanceof Error ? err.message : String(err);
      setLocalError(msg);
      console.error('Failed to load recording file:', err);
    }
  }, [sourceType, localProvider]);

  const fileInputTriggerRef = useRef<HTMLInputElement>(null);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <div
        ref={containerRef}
        id="visualizer-container"
        style={{ width: '100%', height: '100%' }}
      />

      <input
        ref={fileInputTriggerRef}
        type="file"
        accept=".vdc,.vdcr,.bin,.gz,*/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleLocalFileSelected(e.target.files[0]);
          }
        }}
      />

      {sourceType === 'local' && !localFileName && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 40,
            pointerEvents: 'auto',
            padding: '20px',
          }}
        >
          <DropZone
            onFileSelected={handleLocalFileSelected}
            isLoading={isLocalLoading}
            error={localError}
          />
        </div>
      )}

      {sourceType === 'local' && localFileName && (
        <PlaybackControls
          provider={localProvider}
          fileName={localFileName}
          onOpenFilePicker={() => fileInputTriggerRef.current?.click()}
        />
      )}

      {sourceType === 'cdn' && !cdnLoaded && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 40,
            pointerEvents: 'auto',
            padding: '20px',
          }}
        >
          <CdnInputModal
            provider={cdnProvider}
            onLoaded={() => setCdnLoaded(true)}
          />
        </div>
      )}

      {sourceType === 'cdn' && cdnLoaded && (
        <PlaybackControls
          provider={cdnProvider}
          fileName={cdnProvider.getUrl() ?? 'CDN'}
          onOpenFilePicker={() => setCdnLoaded(false)}
        />
      )}
    </div>
  );
}

export default App;

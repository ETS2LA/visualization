import { Visualizer } from './engine/Visualizer';
import { DummyProvider } from './providers/DummyProvider';
import { LocalWsProvider } from './providers/LocalWsProvider';
import { useEffect, useRef } from 'react';
import './App.css'

function App() {
  const hasLoaded = useRef(false);
  const sourceType = useRef<'dummy' | 'localws'>('localws');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const urlParams = new URLSearchParams(window.location.search);
    const sourceParam = urlParams.get('source');
    const visualizer = new Visualizer({
      container: containerRef.current,
      dark: urlParams.get('light') !== 'true',
    });

    if (sourceParam === 'dummy' || sourceParam === 'localws') {
      sourceType.current = sourceParam;
    }

    console.log(`Using source type: ${sourceType.current}`);
    switch (sourceType.current) {
      case 'dummy':
        visualizer.setSource(new DummyProvider());
        break;
      case 'localws':
        visualizer.setSource(new LocalWsProvider());
        break;
    }

    hasLoaded.current = true;
    return () => {
      visualizer.dispose();
    };
  }, []);


  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div ref={containerRef} id="visualizer-container" style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

export default App
import { Visualizer } from './engine/Visualizer';
import { DummyProvider } from './providers/DummyProvider';
import { LocalWsProvider } from './providers/LocalWsProvider';
import { useEffect, useRef } from 'react';
import './App.css'

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!containerRef.current) return;

    const visualizer = new Visualizer({
      container: containerRef.current,
    });
    visualizer.setSource(new LocalWsProvider());

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
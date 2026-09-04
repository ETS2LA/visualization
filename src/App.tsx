import { Visualizer } from './engine/Visualizer';
import { DummyProvider } from './providers/DummyProvider';
import { LocalWsProvider } from './providers/LocalWsProvider';
import './App.css'

function App() {
  var v: Visualizer;
  window.addEventListener('load', () => {
    v = new Visualizer({ container: document.getElementById('visualizer-container')! });
    v.setSource(new LocalWsProvider());
  });

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div id="visualizer-container" style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

export default App
import { useState, useEffect, useCallback } from 'react';
import Home from './components/Home';
import EpisodeList from './components/EpisodeList';
import Player from './components/Player';
import './App.css';

export default function App() {
  const [v, setV] = useState('home');
  const [album, setAlbum] = useState(null);
  const [ep, setEp] = useState(null);
  const [pl, setPl] = useState(false);

  const play = useCallback(e => { setEp(e); setPl(true); }, []);
  const selectAlbum = useCallback(a => { setAlbum(a); setV('eps'); }, []);
  const goHome = useCallback(() => setV('home'), []);
  const closePlayer = useCallback(() => setPl(false), []);

  useEffect(() => { window.scrollTo(0, 0); }, [v]);

  return (
    <main className="app">
      {v==='home' && <Home onSelect={selectAlbum} />}
      {v==='eps' && album && <EpisodeList album={album} onBack={goHome} onPlay={play} />}
      {pl && ep && <Player episode={ep} onClose={closePlayer} />}
    </main>
  );
}

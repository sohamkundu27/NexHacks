import { LiveKitRoom, VideoConference, RoomAudioRenderer } from '@livekit/components-react';
import { useEffect, useState } from 'react';
import { PdfUpload } from './components/PdfUpload';
import { CallWithSTT } from './components/CallWithSTT';
import { OvershootDemo } from './components/OvershootDemo';
import '@livekit/components-styles';
import './App.css';

/**
 * Flow: 1) Upload medical PDF → 2) Start call (LiveKit) → 3) STT detects prescriptions
 * → 4) Conflict check (Browserbase or RxNav) with on-screen indicator.
 */
function App() {
  const [pdfReady, setPdfReady] = useState(false);
  const [token, setToken] = useState('');

  // Fetch LiveKit token only after user has uploaded PDF and clicked "Start call"
  useEffect(() => {
    if (!pdfReady) return;
    (async () => {
      try {
        const res = await fetch('/getToken');
        setToken(await res.text());
      } catch (e) {
        console.error('Failed to generate token', e);
      }
    })();
  }, [pdfReady]);

  // Step 1: PDF upload
  if (!pdfReady) {
    return (
      <div className="app-step app-upload">
        <PdfUpload onReady={() => setPdfReady(true)} />
      </div>
    );
  }

  // Step 2: Waiting for token
  if (!token) {
    return (
      <div className="app-step app-loading">
        Loading secure connection…
      </div>
    );
  }

  // Step 3–4: LiveKit call with STT + conflict check
  return (
    <LiveKitRoom
      serverUrl={import.meta.env.VITE_PUBLIC_LIVEKIT_URL}
      token={token}
      connect={true}
      video={true}
      audio={true}
      data-lk-theme="default"
      style={{ height: '100vh', width: '100vw', background: '#000' }}
      onDisconnected={() => console.log('Disconnected from room')}
    >
      <CallWithSTT />
      <OvershootDemo />
      {/* VideoConference handles the layout; grid shows participants. */}
      <VideoConference layout="grid" />
      {/* Essential for audio playback */}
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

export default App;

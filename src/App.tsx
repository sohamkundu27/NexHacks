import { LiveKitRoom, VideoConference, RoomAudioRenderer } from '@livekit/components-react';
import { useEffect, useState } from 'react';
import { OvershootDemo } from './components/OvershootDemo';
import '@livekit/components-styles';
import './App.css';

function App() {
  const [token, setToken] = useState("");

  useEffect(() => {
    (async () => {
      try {
        // Fetch from the same origin (the backend serving this file)
        const response = await fetch("/getToken");
        const token = await response.text();
        setToken(token);
      } catch (e) {
        console.error("Failed to generate token", e);
      }
    })();
  }, []);

  if (!token) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh', 
        color: 'white',
        background: '#111' 
      }}>
        Loading secure connection...
      </div>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={import.meta.env.VITE_PUBLIC_LIVEKIT_URL}
      token={token}
      connect={true}
      video={true}
      audio={true}
      data-lk-theme="default"
      style={{ height: '100vh', width: '100vw', background: '#000' }}
      onDisconnected={() => {
        console.log("Disconnected from room");
        // Optional: Auto-reconnect logic or reload could go here
      }}
    >
      <OvershootDemo />
      
      {/* 
         VideoConference handles the layout automatically.
         It will show a grid of participants.
      */}
      <VideoConference />

      {/* Essential for audio playback */}
      <RoomAudioRenderer />
      
      {/* 
        Standard control bar for mute/unmute/leave.
        We place it fixed at the bottom if VideoConference doesn't include it automatically 
        (VideoConference usually includes controls, but being explicit helps if customized)
       */}
    </LiveKitRoom>
  );
}

export default App;

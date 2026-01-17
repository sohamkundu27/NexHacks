import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import { useEffect, useState } from 'react';
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
    return <div>Loading...</div>;
  }

  return (
    <LiveKitRoom
      serverUrl={import.meta.env.VITE_PUBLIC_LIVEKIT_URL}
      token={token}
      connect={true}
      data-lk-theme="default"
      style={{ height: '100vh' }}
    >
      {/* This component renders the entire video grid for you */}
      <VideoConference />
    </LiveKitRoom>
  );
}

export default App;

import express from 'express';
import { AccessToken } from 'livekit-server-sdk';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const createToken = async () => {
  const roomName = 'quick-chat-room';
  const participantName = 'user-' + Math.floor(Math.random() * 10000);

  const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
    identity: participantName,
    ttl: '10m',
  });
  at.addGrant({ roomJoin: true, room: roomName });

  return await at.toJwt();
};

const app = express();
const port = 3000;

app.use(cors());
app.use(express.static('dist'));

app.get('/getToken', async (req, res) => {
  try {
    const token = await createToken();
    res.send(token);
  } catch (err) {
    console.error(err);
    res.status(500).send('Could not generate token');
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

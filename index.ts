import express from 'express';
import cors from 'cors';
import ytSearch from 'yt-search';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// List of public Piped API instances for round-robin extraction
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.tokhmi.xyz',
  'https://pipedapi.smnz.de',
  'https://api.piped.projectsegfau.lt',
  'https://piped-api.garudalinux.org'
];

app.get('/api/test-saavn', async (req, res) => {
  try {
    const r = await axios.get('https://saavn.dev/api/search/songs?query=bare+minimum');
    res.json(r.data);
  } catch (err: any) {
    res.json({ error: err.message });
  }
});

// Basic health check
app.get('/', (req, res) => {
  res.send('Musico API is running');
});

// Search YouTube
app.get('/api/search', async (req, res) => {
  const query = req.query.q as string;
  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    const r = await ytSearch(query);
    const videos = r.videos.slice(0, 20).map(v => ({
      id: v.videoId,
      title: v.title,
      artist: v.author.name,
      artwork: v.thumbnail,
      duration: v.seconds,
      source: 'youtube'
    }));
    res.json(videos);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search' });
  }
});

// Stream audio from YouTube
app.get('/api/stream/:videoId', async (req, res) => {
  const { videoId } = req.params;
  
  try {
    let audioUrl = null;
    
    // Fallback through instances until one succeeds
    for (const instance of PIPED_INSTANCES) {
      try {
        const response = await axios.get(`${instance}/streams/${videoId}`, {
          timeout: 5000 // 5 second timeout per instance
        });
        
        const data = response.data;
        if (data && data.audioStreams && data.audioStreams.length > 0) {
          // Prefer M4A for iOS/Android compatibility
          const stream = data.audioStreams.find((s: any) => s.format === 'M4A' || s.mimeType.includes('m4a')) || data.audioStreams[0];
          audioUrl = stream.url;
          break; // Found a working URL
        }
      } catch (err) {
        console.log(`Piped instance ${instance} failed, trying next...`);
      }
    }

    if (!audioUrl) {
      return res.status(404).json({ error: 'Stream not found on any instance' });
    }

    // Redirect to the direct Google Video URL
    res.redirect(audioUrl);
  } catch (error: any) {
    console.error('Stream error:', error);
    res.status(500).json({ error: 'Failed to extract stream', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

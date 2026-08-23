import express from 'express';
import cors from 'cors';
import ytSearch from 'yt-search';
import { exec } from 'youtube-dl-exec';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  
  try {
    const output = await exec(url, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      format: 'bestaudio',
      addHeader: [
        'referer:youtube.com',
        'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36'
      ]
    });

    // @ts-ignore
    const audioFormats = output.formats.filter((f: any) => f.acodec !== 'none' && f.vcodec === 'none' && f.url);
    if (!audioFormats.length) {
      return res.status(404).json({ error: 'Stream not found' });
    }

    // Redirect to the highest quality audio stream (usually the last one or we can sort)
    // Actually, 'bestaudio' usually ensures the best is selected or we can just pick the first valid one.
    const audioUrl = audioFormats[0].url;
    res.redirect(audioUrl);
  } catch (error: any) {
    console.error('Stream error:', error);
    res.status(500).json({ error: 'Failed to extract stream', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

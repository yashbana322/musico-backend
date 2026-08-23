import express from 'express';
import cors from 'cors';
import ytSearch from 'yt-search';
import dotenv from 'dotenv';
import axios from 'axios';
const SaavnAPI = require('saavnapi').default;

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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

// Stream audio from YouTube via JioSaavn Bridge
app.get('/api/stream/:videoId', async (req, res) => {
  const { videoId } = req.params;
  
  try {
    // 1. Get YouTube video title
    const videoResult = await ytSearch({ videoId });
    if (!videoResult || !('title' in videoResult)) {
      return res.status(404).json({ error: 'YouTube video not found' });
    }
    const video = videoResult as any;

    // 2. Clean the title to maximize JioSaavn search hits
    // Remove brackets, keywords, and take the first part of a "Title - Artist" format
    let cleanTitle = video.title
      .replace(/\[.*?\]|\(.*?\)/g, '') 
      .replace(/official|video|audio|lyrics|music|remix/gi, '')
      .split('-')[0]
      .trim();

    // 3. Search JioSaavn
    const saavnRes = await SaavnAPI.search.searchSongs({ query: cleanTitle, page: 0, limit: 1 });
    
    if (!saavnRes || !saavnRes.results || saavnRes.results.length === 0) {
      // Fallback if cleanTitle yields nothing (try searching with artist)
      let cleanArtist = '';
      if ('author' in video && video.author && 'name' in video.author) {
        cleanArtist = (video.author as any).name.replace(/VEVO|Official/gi, '').trim();
      }
      
      const fallbackRes = await SaavnAPI.search.searchSongs({ query: `${cleanTitle} ${cleanArtist}`.trim(), page: 0, limit: 1 });
      if (!fallbackRes || !fallbackRes.results || fallbackRes.results.length === 0) {
        return res.status(404).json({ error: 'Song not found on streaming proxy' });
      }
      saavnRes.results = fallbackRes.results;
    }

    const track = saavnRes.results[0];
    if (!track.downloadUrl || track.downloadUrl.length === 0) {
      return res.status(404).json({ error: 'Stream URL not available' });
    }

    // 4. Get the best quality stream (usually 320kbps or 160kbps MP4)
    // The downloadUrl array usually contains objects like { quality: '320kbps', url: '...' }
    // Sort descending by quality if needed, or just find 320/160.
    const stream = track.downloadUrl.find((u: any) => u.quality === '320kbps') 
                || track.downloadUrl.find((u: any) => u.quality === '160kbps') 
                || track.downloadUrl[track.downloadUrl.length - 1]; // fallback to whatever is there

    // 5. Redirect the mobile app natively to the MP4 URL
    res.redirect(stream.url);
  } catch (error: any) {
    console.error('Stream error:', error);
    res.status(500).json({ error: 'Failed to extract stream', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

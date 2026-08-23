"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const yt_search_1 = __importDefault(require("yt-search"));
const dotenv_1 = __importDefault(require("dotenv"));
const axios_1 = __importDefault(require("axios"));
const SaavnAPI = require('saavnapi').default;
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get('/api/test-saavn', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const r = yield axios_1.default.get('https://saavn.dev/api/search/songs?query=bare+minimum');
        res.json(r.data);
    }
    catch (err) {
        res.json({ error: err.message });
    }
}));
// Basic health check
app.get('/', (req, res) => {
    res.send('Musico API is running');
});
// Search YouTube
app.get('/api/search', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const query = req.query.q;
    if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
    }
    try {
        const r = yield (0, yt_search_1.default)(query);
        const videos = r.videos.slice(0, 20).map(v => ({
            id: v.videoId,
            title: v.title,
            artist: v.author.name,
            artwork: v.thumbnail,
            duration: v.seconds,
            source: 'youtube'
        }));
        res.json(videos);
    }
    catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Failed to search' });
    }
}));
// Stream audio from YouTube via JioSaavn Bridge
app.get('/api/stream/:videoId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { videoId } = req.params;
    try {
        // 1. Get YouTube video title
        const videoResult = yield (0, yt_search_1.default)({ videoId });
        if (!videoResult || !('title' in videoResult)) {
            return res.status(404).json({ error: 'YouTube video not found' });
        }
        const video = videoResult;
        // 2. Clean the title to maximize JioSaavn search hits
        // Remove brackets, keywords, and take the first part of a "Title - Artist" format
        let cleanTitle = video.title
            .replace(/\[.*?\]|\(.*?\)/g, '')
            .replace(/official|video|audio|lyrics|music|remix/gi, '')
            .split('-')[0]
            .trim();
        // 3. Search JioSaavn
        const saavnRes = yield SaavnAPI.search.searchSongs({ query: cleanTitle, page: 0, limit: 1 });
        if (!saavnRes || !saavnRes.results || saavnRes.results.length === 0) {
            // Fallback if cleanTitle yields nothing (try searching with artist)
            let cleanArtist = '';
            if ('author' in video && video.author && 'name' in video.author) {
                cleanArtist = video.author.name.replace(/VEVO|Official/gi, '').trim();
            }
            const fallbackRes = yield SaavnAPI.search.searchSongs({ query: `${cleanTitle} ${cleanArtist}`.trim(), page: 0, limit: 1 });
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
        const stream = track.downloadUrl.find((u) => u.quality === '320kbps')
            || track.downloadUrl.find((u) => u.quality === '160kbps')
            || track.downloadUrl[track.downloadUrl.length - 1]; // fallback to whatever is there
        // 5. Redirect the mobile app natively to the MP4 URL
        res.redirect(stream.url);
    }
    catch (error) {
        console.error('Stream error:', error);
        res.status(500).json({ error: 'Failed to extract stream', details: error.message });
    }
}));
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
//# sourceMappingURL=index.js.map
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
const ytdl_core_1 = __importDefault(require("@distube/ytdl-core"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
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
// Stream audio from YouTube
app.get('/api/stream/:videoId', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { videoId } = req.params;
    try {
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        const info = yield ytdl_core_1.default.getInfo(url);
        const audioFormat = ytdl_core_1.default.chooseFormat(info.formats, { quality: 'highestaudio' });
        if (!audioFormat) {
            return res.status(404).json({ error: 'Audio format not found' });
        }
        res.header('Content-Type', 'audio/mpeg');
        (0, ytdl_core_1.default)(url, { format: audioFormat }).pipe(res);
    }
    catch (error) {
        console.error('Stream error:', error);
        res.status(500).json({ error: 'Failed to stream audio' });
    }
}));
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
//# sourceMappingURL=index.js.map
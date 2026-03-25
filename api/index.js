const express = require('express');
const ytdl = require('@ybd-project/ytdl-core');
const cors = require('cors');
const path = require('path');
const os = require('os');

const app = express();

app.use(cors());
app.use(express.json());

// YouTube Agent with Cookies support - initialized lazily
let ytdlAgent;
function getAgent() {
    if (ytdlAgent) return ytdlAgent;
    try {
        if (process.env.YOUTUBE_COOKIES) {
            const cookies = JSON.parse(process.env.YOUTUBE_COOKIES);
            ytdlAgent = ytdl.createAgent(cookies);
            console.log('YouTube Agent created with cookies.');
        }
    } catch (error) {
        console.error('Error initializing YouTube Agent with cookies:', error.message);
    }
    return ytdlAgent;
}

module.exports = app;

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Endpoint to get video info
app.get('/api/video-info', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const agent = getAgent();
        const info = await ytdl.getInfo(url, { agent });
        
        res.json({
            id: info.videoDetails.videoId,
            title: info.videoDetails.title,
            thumbnail: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url,
            duration: parseInt(info.videoDetails.lengthSeconds),
            uploader: info.videoDetails.author.name
        });
    } catch (error) {
        console.error('Error fetching video info:', error);
        res.status(500).json({ error: 'SERVER_ERROR: ' + error.message });
    }
});

// Endpoint to download video or MP3
app.get('/api/download', async (req, res) => {
    const { url, format } = req.query;

    if (!url || !format) {
        return res.status(400).json({ error: 'URL and format are required' });
    }

    try {
        const agent = getAgent();
        const info = await ytdl.getInfo(url, { agent });
        const title = info.videoDetails.title.replace(/[^\x00-\x7F]/g, "").replace(/[\\/:"*?<>|]/g, "_");
        const extension = format === 'mp3' ? 'mp3' : 'mp4';
        const fileName = `${title}.${extension}`;

        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', format === 'mp3' ? 'audio/mpeg' : 'video/mp4');

        const options = format === 'mp3' 
            ? { quality: 'highestaudio', filter: 'audioonly' }
            : { quality: 'highest', filter: 'audioandvideo' };

        const stream = ytdl(url, { ...options, agent });
        
        stream.pipe(res);

        stream.on('error', (err) => {
            console.error('Stream error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'STREAM_ERROR: ' + err.message });
            }
        });

    } catch (error) {
        console.error('Error during download:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'DOWNLOAD_ERROR: ' + error.message });
        }
    }
});

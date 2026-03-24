const express = require('express');
const ytDlp = require('yt-dlp-exec');
const ffmpeg = require('ffmpeg-static');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Serving frontend
app.use(express.static(path.join(__dirname, '../frontend')));

const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir);
}
app.use('/downloads', express.static(downloadsDir));

// Endpoint to get video info
app.get('/api/video-info', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const info = await ytDlp(url, {
            dumpJson: true,
            noWarnings: true,
            noCallHome: true,
            noCheckCertificate: true,
            preferFreeFormats: true,
            youtubeSkipDashManifest: true,
        });

        res.json({
            id: info.id,
            title: info.title,
            thumbnail: info.thumbnail,
            duration: info.duration,
            uploader: info.uploader,
            formats: info.formats.filter(f => f.vcodec !== 'none' || f.acodec !== 'none')
        });
    } catch (error) {
        console.error('Error fetching video info:', error);
        res.status(500).json({ error: 'Failed to get video information: ' + error.message });
    }
});

// Endpoint to download video or MP3
app.post('/api/download', async (req, res) => {
    const { url, format } = req.body;

    if (!url || !format) {
        return res.status(400).json({ error: 'URL and format are required' });
    }

    // We use a temporary filename or let yt-dlp handle it
    // For streaming, it's better to pipe the output
    
    let args = [
        url,
        '--ffmpeg-location', ffmpeg,
        '--no-warnings',
        '--restrict-filenames',
        '-o', path.join(downloadsDir, '%(title)s.%(ext)s')
    ];

    if (format === 'mp3') {
        args.push('-x', '--audio-format', 'mp3');
    } else {
        args.push('-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]');
    }

    res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Transfer-Encoding': 'chunked'
    });
    res.write('Starting download...\n');

    try {
        const process = ytDlp.exec(url, {
            output: path.join(downloadsDir, '%(title)s.%(ext)s'),
            ffmpegLocation: ffmpeg,
            extractAudio: format === 'mp3',
            audioFormat: format === 'mp3' ? 'mp3' : undefined,
            format: format === 'video' ? 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]' : undefined,
            restrictFilenames: true,
        });

        process.stdout.on('data', (data) => {
            const output = data.toString();
            if (output.includes('[download]') || output.includes('[ExtractAudio]')) {
                res.write(output);
            }
        });

        process.stderr.on('data', (data) => {
            console.error(`yt-dlp error: ${data}`);
            res.write(`LOG: ${data}\n`);
        });

        process.on('close', (code) => {
            if (code === 0) {
                res.write('Download complete!\n');
                res.write('File saved in backend/downloads folder.\n');
            } else {
                res.write(`Download failed with code ${code}.\n`);
            }
            res.end();
        });

    } catch (error) {
        console.error('Error executing yt-dlp for download:', error);
        res.write(`Server error during download: ${error.message}\n`);
        res.end();
    }
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});

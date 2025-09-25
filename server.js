const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Create directories for audio files
const audioDir = path.join(__dirname, 'audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

// Function to extract audio using yt-dlp with MP3 conversion
async function extractAudioFromYouTube(url) {
  return new Promise((resolve, reject) => {
    console.log(`Processing URL: ${url}`);
    
    // Extract video ID from URL
    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
    if (!videoId) {
      reject(new Error('Invalid YouTube URL. Please use format: https://www.youtube.com/watch?v=VIDEO_ID'));
      return;
    }
    
    console.log(`Extracted video ID: ${videoId[1]}`);

    const outputPath = path.join(audioDir, `${videoId[1]}.mp3`);
    
    // yt-dlp command to extract audio and convert to MP3
    const ytdlp = spawn('yt-dlp', [
      '-f', 'bestaudio[ext=m4a]/bestaudio',
      '--no-playlist',
      '--output', outputPath,
      '--write-info-json',
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '--extractor-args', 'youtube:player_client=tv_embedded',
      '--sleep-interval', '2',
      '--max-sleep-interval', '5',
      '--retries', '3',
      '--fragment-retries', '3',
      '--user-agent', 'Mozilla/5.0 (SMART-TV; Linux; Tizen 2.4.0) AppleWebKit/538.1 (KHTML, like Gecko) Version/2.4.0 TV Safari/538.1',
      url
    ]);

    let title = '';
    let duration = '';
    let errorOutput = '';

    ytdlp.stdout.on('data', (data) => {
      const output = data.toString().trim();
      console.log('yt-dlp stdout:', output);
    });

    ytdlp.stderr.on('data', (data) => {
      const error = data.toString();
      console.log('yt-dlp stderr:', error);
      errorOutput += error;
    });

    ytdlp.on('error', (error) => {
      console.log('yt-dlp error:', error);
      reject(new Error(`Failed to start yt-dlp: ${error.message}`));
    });

    // Add timeout to prevent hanging
    const timeout = setTimeout(() => {
      ytdlp.kill();
      reject(new Error('yt-dlp process timed out after 60 seconds'));
    }, 60000);

    ytdlp.on('close', (code) => {
      clearTimeout(timeout);
      console.log(`yt-dlp process finished with code: ${code}`);
      
      if (code === 0) {
        // Look for the MP3 file
        const audioDirFiles = fs.readdirSync(audioDir);
        console.log('Audio directory files:', audioDirFiles);
        
        const audioFile = audioDirFiles.find(file => file.startsWith(videoId[1]) && file.endsWith('.mp3'));
        
        if (audioFile) {
          const fullPath = path.join(audioDir, audioFile);
          console.log('Found MP3 file:', audioFile);
          
          // Try to read metadata from info JSON file
          const infoFile = audioDirFiles.find(file => file.startsWith(videoId[1]) && file.endsWith('.info.json'));
          if (infoFile) {
            try {
              const infoData = JSON.parse(fs.readFileSync(path.join(audioDir, infoFile), 'utf8'));
              title = infoData.title || 'Unknown Title';
              duration = infoData.duration ? `${Math.floor(infoData.duration / 60)}:${(infoData.duration % 60).toString().padStart(2, '0')}` : 'Unknown Duration';
              console.log('Metadata from JSON:', { title, duration });
            } catch (error) {
              console.log('Error reading info JSON:', error);
            }
          }
          
          resolve({
            title: title || 'Unknown Title',
            duration: duration || 'Unknown Duration',
            audioFile: fullPath,
            audioUrl: `https://web-production-e3c15.up.railway.app/audio/${audioFile}`
          });
        } else {
          console.log('No MP3 file found for video ID:', videoId[1]);
          reject(new Error('MP3 file was not created'));
        }
      } else {
        reject(new Error(`yt-dlp failed with code ${code}: ${errorOutput}`));
      }
    });
  });
}

// API endpoint to extract audio
app.post('/api/extract-audio', async (req, res) => {
  try {
    const { youtubeUrl } = req.body;
    
    if (!youtubeUrl) {
      return res.status(400).json({ error: 'YouTube URL is required' });
    }

    console.log(`Extracting audio from: ${youtubeUrl}`);
    const result = await extractAudioFromYouTube(youtubeUrl);
    
    res.json({
      success: true,
      title: result.title,
      duration: result.duration,
      audioUrl: result.audioUrl
    });

  } catch (error) {
    console.error('Error extracting audio:', error);
    res.status(500).json({ 
      error: 'Failed to extract audio', 
      details: error.message 
    });
  }
});

// Serve audio files
app.use('/audio', express.static(audioDir));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'yt-dlp server is running' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 yt-dlp server running on port ${PORT}`);
  console.log(`📁 Audio files will be saved to: ${audioDir}`);
});

module.exports = app;
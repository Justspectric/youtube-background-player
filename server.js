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

// Function to get direct audio stream URL using yt-dlp
async function extractAudioFromYouTube(url) {
  return new Promise((resolve, reject) => {
    console.log(`Getting direct stream URL for: ${url}`);
    
    // Extract video ID from URL
    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
    if (!videoId) {
      reject(new Error('Invalid YouTube URL. Please use format: https://www.youtube.com/watch?v=VIDEO_ID'));
      return;
    }
    
    console.log(`Extracted video ID: ${videoId[1]}`);

    // Try different yt-dlp approaches to get direct stream URL
    const approaches = [
      // Approach 1: Get direct M4A stream URL
      [
        '-f', 'bestaudio[ext=m4a]/bestaudio',
        '--no-playlist',
        '--get-url',
        '--extractor-args', 'youtube:player_client=tv_embedded',
        '--user-agent', 'Mozilla/5.0 (SMART-TV; Linux; Tizen 2.4.0) AppleWebKit/538.1 (KHTML, like Gecko) Version/2.4.0 TV Safari/538.1',
        url
      ],
      // Approach 2: Get direct audio stream URL
      [
        '-f', 'bestaudio',
        '--no-playlist',
        '--get-url',
        '--extractor-args', 'youtube:player_client=ios',
        '--user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
        url
      ],
      // Approach 3: Get web stream URL
      [
        '-f', 'bestaudio',
        '--no-playlist',
        '--get-url',
        '--extractor-args', 'youtube:player_client=web',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        url
      ]
    ];

    let currentApproach = 0;
    
    function tryNextApproach() {
      if (currentApproach >= approaches.length) {
        reject(new Error('All yt-dlp approaches failed to get stream URL'));
        return;
      }

      console.log(`Trying approach ${currentApproach + 1} to get stream URL`);
      
      const ytdlp = spawn('yt-dlp', approaches[currentApproach]);

      let streamUrl = '';
      let errorOutput = '';

      ytdlp.stdout.on('data', (data) => {
        const output = data.toString().trim();
        console.log('yt-dlp stdout:', output);
        if (output.startsWith('http')) {
          streamUrl = output;
        }
      });

      ytdlp.stderr.on('data', (data) => {
        const error = data.toString();
        console.log('yt-dlp stderr:', error);
        errorOutput += error;
      });

      ytdlp.on('error', (error) => {
        console.log('yt-dlp error:', error);
        currentApproach++;
        tryNextApproach();
      });

      // Add timeout to prevent hanging
      const timeout = setTimeout(() => {
        ytdlp.kill();
        currentApproach++;
        tryNextApproach();
      }, 15000);

      ytdlp.on('close', (code) => {
        clearTimeout(timeout);
        console.log(`yt-dlp process finished with code: ${code}`);
        
        if (code === 0 && streamUrl) {
          console.log('Found direct stream URL:', streamUrl);
          
          // Get video title from oEmbed API
          fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`)
            .then(response => response.json())
            .then(data => {
              resolve({
                title: data.title || 'Unknown Title',
                duration: 'Unknown Duration',
                audioUrl: streamUrl,
                isDirectStream: true
              });
            })
            .catch(() => {
              resolve({
                title: 'Unknown Title',
                duration: 'Unknown Duration',
                audioUrl: streamUrl,
                isDirectStream: true
              });
            });
        } else {
          console.log(`Approach ${currentApproach + 1} failed: ${errorOutput}`);
          currentApproach++;
          tryNextApproach();
        }
      });
    }

    tryNextApproach();
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
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
app.use(express.static('public'));

// Create directories for audio files
const audioDir = path.join(__dirname, 'audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

// Function to extract audio using yt-dlp
async function extractAudioFromYouTube(url) {
  return new Promise((resolve, reject) => {
    console.log(`Processing URL: ${url}`);
    
    // Better YouTube URL regex to handle more formats
    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
    if (!videoId) {
      console.log('Invalid YouTube URL format');
      reject(new Error('Invalid YouTube URL. Please use format: https://www.youtube.com/watch?v=VIDEO_ID'));
      return;
    }
    
    console.log(`Extracted video ID: ${videoId[1]}`);

    const outputPath = path.join(audioDir, `${videoId[1]}.%(ext)s`);
    
        // yt-dlp command to extract audio (try M4A first, then fallback to best audio)
        const ytdlp = spawn('python3', [
          '-m', 'yt_dlp',
      '-f', 'bestaudio[ext=m4a]/bestaudio',
      '--no-playlist',
      '--output', outputPath,
      '--write-info-json',
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
        // Look for the actual downloaded file (could be .webm, .m4a, etc.)
        const audioDirFiles = fs.readdirSync(audioDir);
        console.log('Audio directory files:', audioDirFiles);
        
        const audioFile = audioDirFiles.find(file => file.startsWith(videoId[1]) && (file.endsWith('.mp3') || file.endsWith('.m4a') || file.endsWith('.webm')));
        
        if (audioFile) {
          const fullPath = path.join(audioDir, audioFile);
          console.log('Found audio file:', audioFile);
          
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
            audioUrl: `http://192.168.4.42:${PORT}/audio/${audioFile}`
          });
        } else {
          console.log('No audio file found for video ID:', videoId[1]);
          reject(new Error('Audio file was not created'));
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

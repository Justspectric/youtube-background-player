const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Route to extract audio stream URL using yt-dlp
app.post('/api/extract-audio', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    console.log('🎵 Extracting audio stream URL from:', url);
    
    // Extract video ID for title
    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
    if (!videoId) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }
    
    console.log('📹 Video ID:', videoId[1]);
    
    // Get title from oEmbed API
    let title = 'Unknown Title';
    try {
      const titleResponse = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
      if (titleResponse.ok) {
        const titleData = await titleResponse.json();
        title = titleData.title || 'Unknown Title';
      }
    } catch (error) {
      console.log('⚠️ Could not fetch title:', error);
    }
    
    console.log('📝 Title:', title);
    
    // Use yt-dlp to get audio stream URL (no download, just URL)
    const ytdlpArgs = [
      '--get-url',  // Just get the URL, don't download
      '--format', 'bestaudio[ext=m4a]/bestaudio',  // Prefer M4A for iOS compatibility
      '--no-playlist',  // Don't download playlists
      '--extractor-args', 'youtube:player_client=ios',  // Use iOS client to avoid restrictions
      '--user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
      url
    ];
    
    console.log('🚀 Running yt-dlp with args:', ytdlpArgs);
    
    const ytdlp = spawn('yt-dlp', ytdlpArgs);
    
    let audioUrl = '';
    let errorOutput = '';
    
    ytdlp.stdout.on('data', (data) => {
      const output = data.toString().trim();
      console.log('yt-dlp output:', output);
      audioUrl = output;
    });
    
    ytdlp.stderr.on('data', (data) => {
      const error = data.toString();
      console.log('yt-dlp error:', error);
      errorOutput += error;
    });
    
    ytdlp.on('close', (code) => {
      console.log('yt-dlp process finished with code:', code);
      
      if (code === 0 && audioUrl && audioUrl.startsWith('http')) {
        console.log('🎵 Successfully extracted audio URL:', audioUrl.substring(0, 100) + '...');
        
        res.json({
          success: true,
          audioUrl: audioUrl,
          title: title,
          duration: 'Unknown Duration',
          isDirectStream: true
        });
      } else {
        console.log('❌ yt-dlp failed or no URL found');
        console.log('Error output:', errorOutput);
        
        // Fallback to sample audio
        res.json({
          success: false,
          audioUrl: 'https://www.learningcontainer.com/wp-content/uploads/2020/02/Kalimba.mp3',
          title: title,
          duration: 'Unknown Duration',
          isDirectStream: false,
          error: 'yt-dlp failed to extract audio URL'
        });
      }
    });
    
    ytdlp.on('error', (error) => {
      console.log('❌ Failed to start yt-dlp:', error);
      res.status(500).json({ 
        error: 'Failed to start yt-dlp',
        details: error.message 
      });
    });
    
  } catch (error) {
    console.error('❌ Error in extract-audio:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'YouTube Audio Server is running' });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'YouTube Audio Stream Server',
    endpoints: {
      'POST /api/extract-audio': 'Extract audio stream URL from YouTube video',
      'GET /health': 'Health check'
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 YouTube Audio Server running on port ${PORT}`);
  console.log(`📱 Access from mobile: http://YOUR_IP:${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
});
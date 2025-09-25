const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fetch = require('node-fetch');

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
    
    // Try working audio extraction services first (more reliable than yt-dlp on Railway)
    console.log('🎵 Trying audio extraction services...');
    
    const services = [
      {
        name: 'Vevioz API',
        url: `https://api.vevioz.com/api/button/mp3/${videoId[1]}`,
        extractUrl: (data) => data.link || data.url || data.downloadUrl
      },
      {
        name: 'YouTube MP3 API',
        url: `https://youtube-mp36.p.rapidapi.com/dl?id=${videoId[1]}`,
        extractUrl: (data) => data.link || data.url || data.downloadUrl
      },
      {
        name: 'YouTubeInMP3',
        url: `https://www.youtubeinmp3.com/fetch/?video=https://www.youtube.com/watch?v=${videoId[1]}`,
        extractUrl: (data) => data.link || data.url || data.downloadUrl
      }
    ];

    for (const service of services) {
      try {
        console.log(`🔍 Trying ${service.name}...`);
        
        const response = await fetch(service.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          const audioUrl = service.extractUrl(data);
          
          if (audioUrl && audioUrl.startsWith('http')) {
            console.log(`🎵 ${service.name} provided audio URL:`, audioUrl.substring(0, 100) + '...');
            
            res.json({
              success: true,
              audioUrl: audioUrl,
              title: title,
              duration: 'Unknown Duration',
              isDirectStream: true
            });
            return;
          }
        }
      } catch (error) {
        console.log(`❌ ${service.name} failed:`, error.message);
        continue;
      }
    }

    // Fallback to yt-dlp if all services fail
    console.log('🔄 All services failed, trying yt-dlp as last resort...');
    const ytdlpArgs = [
      '--get-url',  // Just get the URL, don't download
      '--format', 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio',  // Prefer M4A (AAC) for iOS, then WebM (Opus)
      '--no-playlist',  // Don't download playlists
      '--extractor-args', 'youtube:player_client=ios',  // Use iOS client for better compatibility
      '--user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
      '--no-check-certificate',  // Skip SSL verification
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
        
        // Try alternative yt-dlp approach with web client
        console.log('🔄 Trying alternative yt-dlp approach...');
        const altYtdlpArgs = [
          '--get-url',
          '--format', 'bestaudio',
          '--no-playlist',
          '--extractor-args', 'youtube:player_client=web',
          '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          url
        ];
        
        const altYtdlp = spawn('yt-dlp', altYtdlpArgs);
        let altAudioUrl = '';
        let altErrorOutput = '';
        
        altYtdlp.stdout.on('data', (data) => {
          const output = data.toString().trim();
          console.log('alt yt-dlp output:', output);
          altAudioUrl = output;
        });
        
        altYtdlp.stderr.on('data', (data) => {
          const error = data.toString();
          console.log('alt yt-dlp error:', error);
          altErrorOutput += error;
        });
        
        altYtdlp.on('close', (altCode) => {
          console.log('alt yt-dlp process finished with code:', altCode);
          
          if (altCode === 0 && altAudioUrl && altAudioUrl.startsWith('http')) {
            console.log('🎵 Alternative yt-dlp provided audio URL:', altAudioUrl.substring(0, 100) + '...');
            
            res.json({
              success: true,
              audioUrl: altAudioUrl,
              title: title,
              duration: 'Unknown Duration',
              isDirectStream: true
            });
          } else {
            // Final fallback to sample audio
            res.json({
              success: false,
              audioUrl: 'https://www.learningcontainer.com/wp-content/uploads/2020/02/Kalimba.mp3',
              title: title,
              duration: 'Unknown Duration',
              isDirectStream: false,
              error: 'All yt-dlp approaches failed'
            });
          }
        });
        
        altYtdlp.on('error', (error) => {
          console.log('❌ Alternative yt-dlp also failed:', error);
          res.json({
            success: false,
            audioUrl: 'https://www.learningcontainer.com/wp-content/uploads/2020/02/Kalimba.mp3',
            title: title,
            duration: 'Unknown Duration',
            isDirectStream: false,
            error: 'yt-dlp not available'
          });
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
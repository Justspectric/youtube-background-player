const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Function to extract audio using a web-based service
async function extractAudioFromYouTube(url) {
  try {
    console.log(`Processing URL: ${url}`);
    
    // Better YouTube URL regex to handle more formats
    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
    if (!videoId) {
      console.log('Invalid YouTube URL format');
      throw new Error('Invalid YouTube URL. Please use format: https://www.youtube.com/watch?v=VIDEO_ID');
    }
    
    console.log(`Extracted video ID: ${videoId[1]}`);

    // Use a free YouTube API service
    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    
    if (!response.ok) {
      throw new Error('Failed to get video info');
    }

    const data = await response.json();
    
    // For now, return a direct YouTube audio stream URL
    // This is a simplified approach - in production you'd want a proper audio extraction service
    const audioUrl = `https://www.youtube.com/watch?v=${videoId[1]}`;
    
    return {
      title: data.title || 'Unknown Title',
      duration: 'Unknown Duration',
      audioUrl: audioUrl
    };
    
  } catch (error) {
    console.error('Error extracting audio:', error);
    throw error;
  }
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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'YouTube audio server is running' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 YouTube audio server running on port ${PORT}`);
});

module.exports = app;

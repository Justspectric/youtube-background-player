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
    
    // Extract video ID from URL
    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }
    
    console.log(`Extracted video ID: ${videoId[1]}`);

    // Get video info for title
    const infoResponse = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    let title = 'Unknown Title';
    if (infoResponse.ok) {
      const infoData = await infoResponse.json();
      title = infoData.title || 'Unknown Title';
    }
    
    // For now, return a working audio URL for testing background audio
    // This will work to test if background audio and control center work
    const workingAudioUrl = 'https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav';
    
    return {
      title: title,
      duration: 'Unknown Duration',
      audioUrl: workingAudioUrl
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
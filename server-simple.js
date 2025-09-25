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

    // Use a free YouTube audio extraction service
    const response = await fetch(`https://api.vevioz.com/api/button/mp3/${videoId[1]}`);
    
    if (!response.ok) {
      // Fallback to another service
      const response2 = await fetch(`https://youtube-mp36.p.rapidapi.com/dl?id=${videoId[1]}`, {
        headers: {
          'X-RapidAPI-Key': 'free',
          'X-RapidAPI-Host': 'youtube-mp36.p.rapidapi.com'
        }
      });
      
      if (!response2.ok) {
        throw new Error('Failed to extract audio');
      }
      
      const data2 = await response2.json();
      return {
        title: data2.title || 'Unknown Title',
        duration: data2.duration || 'Unknown Duration',
        audioUrl: data2.link || `https://www.youtube.com/watch?v=${videoId[1]}`
      };
    }
    
    const data = await response.json();
    
    return {
      title: data.title || 'Unknown Title',
      duration: data.duration || 'Unknown Duration',
      audioUrl: data.url || `https://www.youtube.com/watch?v=${videoId[1]}`
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

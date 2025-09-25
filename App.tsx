import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, Alert, TextInput, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { AppState } from 'react-native';

export default function App() {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTitle, setCurrentTitle] = useState('');

  useEffect(() => {
        // Configure audio for background playback - CRITICAL for production builds
        Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });

    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  const extractAudioFromYouTube = async (url: string) => {
    try {
      setIsLoading(true);
      
      // Extract video ID from URL
      const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
      if (!videoId) {
        throw new Error('Invalid YouTube URL');
      }

      // Use your Railway server (works everywhere!)
      const response = await fetch('https://web-production-e3c15.up.railway.app/api/extract-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ youtubeUrl: url }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Failed to extract audio');
      }

      const data = await response.json();
      
      return {
        url: data.audioUrl,
        title: data.title,
        duration: data.duration
      };
    } catch (error) {
      console.error('Error extracting audio:', error);
      throw error;
    }
  };

      const playYouTubeAudio = async () => {
        if (!youtubeUrl.trim()) {
          Alert.alert('Error', 'Please enter a YouTube URL');
          return;
        }

        try {
          setIsLoading(true);
          
          // Extract audio from YouTube URL
          const audioData = await extractAudioFromYouTube(youtubeUrl);
          
          console.log('Audio data received:', audioData);
          
          // Check if we have a valid audio URL
          if (!audioData.audioUrl) {
            throw new Error('No audio URL received from server');
          }
          
          // Stop current sound if playing
          if (sound) {
            await sound.unloadAsync();
          }

          console.log('Creating sound with URL:', audioData.audioUrl);

          // Create new sound object for direct streaming
          const { sound: newSound } = await Audio.Sound.createAsync(
            { uri: audioData.audioUrl },
            { 
              shouldPlay: true, 
              isLooping: false
            }
          );

          setSound(newSound);
          setCurrentTitle(audioData.title);
          setIsPlaying(true);

          // Ensure audio session is properly configured for background playback
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            staysActiveInBackground: true,
            playsInSilentModeIOS: true,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
          });

          // Set up playback status listener
          newSound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded) {
              setIsPlaying(status.isPlaying);
              if (status.didJustFinish) {
                setIsPlaying(false);
              }
            }
          });

          console.log('🎵 Streaming audio directly from:', audioData.audioUrl);

        } catch (error) {
          Alert.alert('Error', 'Failed to play audio. Please check your URL and try again.');
          console.error('Playback error:', error);
        } finally {
          setIsLoading(false);
        }
      };

  const stopAudio = async () => {
    if (sound) {
      await sound.stopAsync();
      setIsPlaying(false);
    }
  };

  const pauseAudio = async () => {
    if (sound) {
      await sound.pauseAsync();
      setIsPlaying(false);
    }
  };

  const resumeAudio = async () => {
    if (sound) {
      await sound.playAsync();
      setIsPlaying(true);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎵 YouTube Background Player</Text>
      <Text style={styles.subtitle}>Play YouTube videos in the background on iOS</Text>
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.urlInput}
          placeholder="Enter YouTube URL here..."
          value={youtubeUrl}
          onChangeText={setYoutubeUrl}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {currentTitle ? (
        <View style={styles.trackInfo}>
          <Text style={styles.trackTitle}>Now Playing:</Text>
          <Text style={styles.trackName}>{currentTitle}</Text>
        </View>
      ) : null}

      <View style={styles.buttonContainer}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#3498db" />
        ) : (
          <TouchableOpacity style={styles.playButton} onPress={playYouTubeAudio}>
            <Text style={styles.buttonText}>🎵 Play Audio</Text>
          </TouchableOpacity>
        )}

        {sound && (
          <View style={styles.controlButtons}>
            {isPlaying ? (
              <TouchableOpacity style={styles.controlButton} onPress={pauseAudio}>
                <Text style={styles.controlButtonText}>⏸️ Pause</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.controlButton} onPress={resumeAudio}>
                <Text style={styles.controlButtonText}>▶️ Resume</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity style={styles.controlButton} onPress={stopAudio}>
              <Text style={styles.controlButtonText}>⏹️ Stop</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Text style={styles.note}>
        🎵 Real YouTube audio extraction powered by yt-dlp!
      </Text>

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f8ff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 30,
    textAlign: 'center',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  urlInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  trackInfo: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    width: '100%',
    alignItems: 'center',
  },
  trackTitle: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 5,
  },
  trackName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
  },
  buttonContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  playButton: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  controlButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  controlButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 15,
  },
  controlButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  note: {
    fontSize: 12,
    color: '#7f8c8d',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 20,
  },
});

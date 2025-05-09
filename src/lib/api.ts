
import { toast } from "sonner";

// Base URL for the API
export const API_BASE_URL = 'https://islamicaudio.techrealm.online';

export interface Sermon {
  audio_url: string;
  text: string;
  title: string;
  fullAudioUrl?: string; // We'll add this with the complete URL
  purpose?: string;      // Track the purpose for retries
  errorType?: 'network' | 'server' | 'auth' | 'other'; // Added 'auth' error type
}

// Sample sermon data for fallback/development purposes
const sampleSermon: Sermon = {
  audio_url: "/audio/the-transformative-power-of-patience-a-journey-of-self-discovery-and-unity_with_background.wav",
  text: "In the name of Allah, the Most Gracious, the Most Merciful. Today, we reflect on the virtue of patience in Islam. Patience, or 'sabr' in Arabic, is mentioned over 90 times in the Quran, highlighting its significance in our faith. The Prophet Muhammad (peace be upon him) said, 'Patience is light.' Through patience, we find strength in hardship, clarity in confusion, and peace in turmoil. Let us remember that Allah is with those who are patient, as mentioned in Surah Al-Baqarah: 'O you who have believed, seek help through patience and prayer. Indeed, Allah is with the patient.' As we face life's challenges, let us cultivate patience in our hearts, knowing that with every difficulty comes ease.",
  title: "The Virtue of Patience in Islam",
  fullAudioUrl: "https://islamicaudio.techrealm.online/audio/the-transformative-power-of-patience-a-journey-of-self-discovery-and-unity_with_background.wav"
};

// Additional sample sermons for variety
const sampleSermons = [
  sampleSermon,
  {
    audio_url: "/audio/the-transformative-power-of-patience-a-journey-of-self-discovery-and-unity_with_background.wav",
    text: "Bismillah. The Prophet Muhammad (peace be upon him) said: 'The strong person is not the one who overcomes people with his strength, but the one who controls himself when angry.' Today we explore how controlling our anger leads to inner peace and stronger community bonds. Through mindfulness and remembrance of Allah, we can transform anger into patience and understanding. Remember the words from the Quran: 'Those who spend (in Allah's way) in prosperity and in adversity, who restrain anger and pardon people. And Allah loves the doers of good.'",
    title: "Managing Anger: The Islamic Approach to Emotional Control",
    fullAudioUrl: "https://islamicaudio.techrealm.online/audio/the-transformative-power-of-patience-a-journey-of-self-discovery-and-unity_with_background.wav"
  },
  {
    audio_url: "/audio/the-transformative-power-of-patience-a-journey-of-self-discovery-and-unity_with_background.wav",
    text: "In the name of Allah, the Most Compassionate, the Most Merciful. Gratitude (shukr) is central to our faith. The Quran repeatedly reminds us, 'If you are grateful, I will surely increase you [in favor].' By recognizing and appreciating Allah's countless blessings, we cultivate contentment and resilience. Gratitude transforms our perspective, allowing us to see challenges as opportunities for growth rather than obstacles. Let us practice gratitude daily through our prayers, actions, and interactions with others.",
    title: "The Power of Gratitude in Islamic Tradition",
    fullAudioUrl: "https://islamicaudio.techrealm.online/audio/the-transformative-power-of-patience-a-journey-of-self-discovery-and-unity_with_background.wav"
  }
];

/**
 * Function to check if the device is connected to the internet
 */
export const isOnline = (): boolean => {
  return typeof navigator !== 'undefined' && navigator.onLine;
};

/**
 * Generate a new khutba sermon
 */
export const generateKhutba = async (purpose: string, signal?: AbortSignal): Promise<Sermon> => {
  try {
    console.log(`Generating khutba for purpose: ${purpose}`);
    
    // First, check if we're online
    if (!isOnline()) {
      console.log("Device is offline, returning offline sermon");
      throw new Error("network_offline");
    }
    
    // Create a composite signal that combines the provided signal with a timeout
    let timeoutController: AbortController | null = null;
    let effectiveSignal = signal;
    
    if (!signal) {
      timeoutController = new AbortController();
      effectiveSignal = timeoutController.signal;
      // Set timeout to 30 seconds for API response
      setTimeout(() => timeoutController?.abort(), 30000); 
    }
    
    let retryCount = 0;
    const maxRetries = 2;
    let lastError: Error | null = null;
    
    console.log(`Calling API at: ${API_BASE_URL}/generate-khutab`);
    
    // Simple direct POST request with no proxies, like in API test page
    while (retryCount <= maxRetries) {
      try {
        console.log(`API attempt ${retryCount + 1}/${maxRetries + 1} for purpose: ${purpose}`);
        
        // Direct fetch to API with no proxy, similar to ApiTestPage.tsx
        const response = await fetch(`${API_BASE_URL}/generate-khutab`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ purpose }),
          signal: effectiveSignal
        });

        // Clean up timeout controller if we created one
        if (timeoutController) {
          timeoutController = null;
        }

        if (!response.ok) {
          const errorData = await response.text();
          const errorMessage = `Server responded with ${response.status}: ${response.statusText}. ${errorData}`;
          console.error(errorMessage);
          
          // Check for auth errors like in ApiTestPage.tsx
          if (response.status === 401 || 
              (errorData && errorData.toLowerCase().includes('unauthenticated')) || 
              (errorData && errorData.toLowerCase().includes('authentication token')) ||
              (errorData && errorData.toLowerCase().includes('auth'))) {
            throw new Error("authentication_required");
          }
          
          throw new Error(errorMessage);
        }

        const data: Sermon = await response.json();
        
        // Store the purpose in the sermon object for potential retries
        data.purpose = purpose;
        
        // Construct the full audio URL with the correct base URL
        // Ensure audio_url starts with a slash if not already
        if (data.audio_url) {
          // If the audio_url is already a full URL, use it as is
          if (data.audio_url.startsWith('http')) {
            data.fullAudioUrl = data.audio_url;
          } else {
            // Make sure audio_url starts with a slash
            const audioPath = data.audio_url.startsWith('/') ? data.audio_url : `/${data.audio_url}`;
            data.fullAudioUrl = `${API_BASE_URL}${audioPath}`;
          }
          console.log("Full audio URL constructed:", data.fullAudioUrl);
        } else {
          console.error("No audio_url found in API response");
          data.fullAudioUrl = "";
        }
        
        return data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.error(`API attempt ${retryCount + 1} failed:`, lastError);
        
        // Check for auth errors first
        if (lastError.message === "authentication_required" || 
            lastError.message.includes('authentication') || 
            lastError.message.includes('Unauthenticated')) {
          // Don't retry auth errors
          break;
        }
        
        // Check if we should retry network errors
        const isNetworkError = 
          lastError.message.includes('Failed to fetch') || 
          lastError.message.includes('Network error') ||
          lastError.message.includes('network') ||
          lastError.message.includes('AbortError') ||
          lastError.message.includes('timed out') ||
          lastError.message.includes('abort') ||
          lastError.message.includes('Load failed');
                             
        if (isNetworkError && retryCount < maxRetries) {
          retryCount++;
          console.log(`Retrying API call (attempt ${retryCount+1}/${maxRetries+1})`);
          // Wait before retrying
          const waitTime = 1000 * Math.pow(2, retryCount);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        throw lastError;
      }
    }
    
    throw lastError || new Error('Maximum retries reached');
    
  } catch (error) {
    console.error('Error generating khutba:', error);
    
    // Determine error type
    let errorMessage: string;
    let errorType: 'network' | 'server' | 'auth' | 'other' = 'other';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Check for explicit offline state
      if (error.message === 'network_offline') {
        errorType = 'network';
        errorMessage = 'Your device is offline. Please check your internet connection.';
      }
      // Check for authentication errors
      else if (
        error.message === 'authentication_required' ||
        error.message.includes('authentication') ||
        error.message.includes('Unauthenticated') ||
        error.message.includes('auth token')
      ) {
        errorType = 'auth';
        errorMessage = 'Authentication required. The API requires authentication credentials.';
      }
      // Check for other network errors
      else if (
        error.message.includes('Failed to fetch') || 
        error.message.includes('Network error') ||
        error.message.includes('network') ||
        error.message.includes('AbortError') ||
        error.message.includes('timed out') ||
        error.message.includes('abort') ||
        error.message.includes('Load failed')
      ) {
        errorType = 'network';
        errorMessage = 'Network connection error. Unable to reach sermon server.';
      } else if (
        error.message.includes('500') || 
        error.message.includes('503') ||
        error.message.includes('server')
      ) {
        errorType = 'server';
        errorMessage = 'The sermon server is experiencing issues. Please try again later.';
      }
    } else {
      errorMessage = 'Unknown error occurred';
    }
    
    // Show specific error message based on error type
    if (errorType === 'network') {
      toast.error('Network Connection Error', {
        description: 'Unable to connect to sermon server. Please check your internet connection.',
        duration: 8000,
      });
    } else if (errorType === 'server') {
      toast.error('Server Error', {
        description: errorMessage,
        duration: 8000,
      });
    } else if (errorType === 'auth') {
      toast.error('Authentication Error', {
        description: 'The sermon server requires authentication. Using sample sermons instead.',
        duration: 8000,
      });
    } else {
      // Show general error message
      toast.error('Failed to generate sermon', {
        description: errorMessage,
        duration: 8000,
      });
    }
    
    // Select a random sample sermon as fallback
    const randomIndex = Math.floor(Math.random() * sampleSermons.length);
    const fallbackSermon = sampleSermons[randomIndex];
    
    // Add the purpose to the title to make it seem more relevant
    const capitalizedPurpose = purpose.charAt(0).toUpperCase() + purpose.slice(1);
    const customizedTitle = `${fallbackSermon.title} - ${capitalizedPurpose}`;
    
    toast.warning('Using sample sermon data as fallback', {
      description: 'Real sermon generation is unavailable at the moment.',
      duration: 5000,
    });
    
    // Return fallback data with error information attached
    return {
      ...fallbackSermon,
      title: customizedTitle,
      purpose,
      errorType,
    };
  }
};

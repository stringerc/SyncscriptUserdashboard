/**
 * Orpheus TTS Adapter
 *
 * Interface for Orpheus TTS emotion-controlled streaming TTS model.
 * Can work with local deployment or Together AI API.
 */

import type { TTSModel, TTSRequest, TTSResult, EmotionState } from '../types/voice-engine';

// Configuration interface for Orpheus TTS
export interface OrpheusTTSConfig {
  /** API endpoint for Orpheus TTS service */
  endpoint: string;
  /** API key for authentication (if required) */
  apiKey?: string;
  /** Voice ID to use (can be customized for character voices) */
  voiceId?: string;
  /** Whether to use streaming mode */
  useStreaming?: boolean;
  /** Timeout for requests in milliseconds */
  timeoutMs?: number;
}

/**
 * Orpheus TTS adapter that converts TTS requests to Orpheus API calls
 */
export class OrpheusTTSAdapter {
  private config: OrpheusTTSConfig;

  constructor(config: OrpheusTTSConfig) {
    this.config = {
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      voiceId: config.voiceId || 'default',
      useStreaming: config.useStreaming !== undefined ? config.useStreaming : true,
      timeoutMs: config.timeoutMs || 10000,
    };
  }

  /**
   * Check if Orpheus TTS service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.endpoint}/health`, {
        method: 'GET',
        timeout: this.config.timeoutMs,
      });
      return response.ok;
    } catch (error) {
      console.warn('Orpheus TTS health check failed:', error);
      return false;
    }
  }

  /**
   * Convert text to speech using Orpheus TTS with emotion control
   */
  async synthesize(request: TTSRequest): Promise<TTSResult> {
    try {
      // Prepare the Orpheus TTS request
      const orpheusRequest = this.prepareOrpheusRequest(request);

      // Call Orpheus TTS API
      const response = await fetch(`${this.config.endpoint}/synthesize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify(orpheusRequest),
        timeout: this.config.timeoutMs,
      });

      if (!response.ok) {
        throw new Error(`Orpheus TTS API error: ${response.status} ${response.statusText}`);
      }

      // Process the response based on format (audio blob or URL)
      const result = await this.processOrpheusResponse(response, request);

      return {
        ...result,
        model: 'orpheus' as TTSModel,
      };
    } catch (error) {
      console.error('Orpheus TTS synthesis failed:', error);
      throw error;
    }
  }

  /**
   * Prepare Orpheus TTS request from our TTSRequest format
   */
  private prepareOrpheusRequest(request: TTSRequest): any {
    // Map emotion tags to Orpheus emotion parameters
    const emotionParams = this.mapEmotionToOrpheus(request.emotion);

    return {
      text: request.text,
      voice: this.config.voiceId,
      ...emotionParams,
      // Orpheus-specific parameters
      use_streaming: this.config.useStreaming,
      // Additional Orpheus parameters can go here
    };
  }

  /**
   * Map our EmotionState to Orpheus emotion parameters
   */
  private mapEmotionToOrpheus(emotion: EmotionState | undefined): any {
    if (!emotion) {
      return {};
    }

    // Map emotion labels to Orpheus emotion parameters
    // This would need to be adjusted based on Orpheus' specific emotion control interface
    const emotionMap: Record<string, any> = {
      neutral: { emotion: 'neutral', intensity: 0.5 },
      happy: { emotion: 'happy', intensity: emotion.confidence },
      sad: { emotion: 'sad', intensity: emotion.confidence },
      angry: { emotion: 'angry', intensity: emotion.confidence },
      stressed: { emotion: 'stressed', intensity: emotion.confidence },
      excited: { emotion: 'excited', intensity: emotion.confidence },
      confused: { emotion: 'confused', intensity: emotion.confidence },
      calm: { emotion: 'calm', intensity: emotion.confidence },
      tired: { emotion: 'tired', intensity: emotion.confidence },
    };

    const baseEmotion = emotionMap[emotion.primary] || { emotion: 'neutral', intensity: 0.5 };

    // Convert valence/arousal to Orpheus parameters if needed
    return {
      ...baseEmotion,
      // Orpheus might use different parameter names
      emotion_intensity: emotion.confidence,
      valence: emotion.valence,
      arousal: emotion.arousal,
    };
  }

  /**
   * Process Orpheus TTS response into our TTSResult format
   */
  private async processOrpheusResponse(response: Response, request: TTSRequest): Promise<Omit<TTSResult, 'model'>> {
    // Check content type to determine response format
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      // JSON response with audio URL or base64
      const jsonData = await response.json();

      if (jsonData.audioUrl) {
        // Return audio URL
        return {
          audioUrl: jsonData.audioUrl,
          duration: jsonData.duration || this.estimateDuration(request.text),
        };
      } else if (jsonData.audioBlob || jsonData.base64Audio) {
        // Return audio blob
        const blobData = jsonData.base64Audio
          ? this.base64ToBlob(jsonData.base64Audio, 'audio/mpeg')
          : jsonData.audioBlob;

        return {
          audioBlob: blobData,
          duration: jsonData.duration || this.estimateDuration(request.text),
        };
      }
    } else if (contentType.startsWith('audio/')) {
      // Direct audio response
      const blob = await response.blob();
      return {
        audioBlob: blob,
        duration: this.estimateDuration(request.text),
      };
    }

    // Fallback: estimate duration and return empty result
    return {
      duration: this.estimateDuration(request.text),
    };
  }

  /**
   * Estimate audio duration based on text length and speech rate
   */
  private estimateDuration(text: string): number {
    // Rough estimate: 150 words per minute for natural speech
    const wordsPerMinute = 150;
    const wordCount = text.split(/\s+/).length;
    const minutes = wordCount / wordsPerMinute;
    return minutes * 60; // Return seconds
  }

  /**
   * Convert base64 string to Blob
   */
  private base64ToBlob(base64: string, mimeType: string): Blob {
    const byteChars = atob(base64);
    const byteArrays = [];

    for (let offset = 0; offset < byteChars.length; offset += 512) {
      const slice = byteChars.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      byteArrays.push(new Uint8Array(byteNumbers));
    }

    return new Blob(byteArrays, { type: mimeType });
  }
}

/**
 * Factory function to create Orpheus TTS adapter from environment
 */
export function createOrpheusTTSAdapter(): OrpheusTTSAdapter | null {
  // Try to get configuration from environment variables
  const endpoint = import.meta.env.VITE_ORPHEUS_TTS_URL ||
                  import.meta.env.ORPHEUS_TTS_URL;

  if (!endpoint) {
    console.warn('Orpheus TTS endpoint not configured. Set VITE_ORPHEUS_TTS_URL or ORPHEUS_TTS_URL');
    return null;
  }

  const config: OrpheusTTSConfig = {
    endpoint: endpoint.replace(/\/+$/, ''), // Remove trailing slash
    apiKey: import.meta.env.VITE_ORPHEUS_TTS_API_KEY ||
            import.meta.env.ORPHEUS_TTS_API_KEY,
    voiceId: import.meta.env.VITE_ORPHEUS_TTS_VOICE_ID ||
             import.meta.env.ORPHEUS_TTS_VOICE_ID,
    useStreaming: import.meta.env.VITE_ORPHEUS_TTS_STREAMING !== 'false',
    timeoutMs: parseInt(import.meta.env.VITE_ORPHEUS_TTS_TIMEOUT_MS ||
                       import.meta.env.ORPHEUS_TTS_TIMEOUT_MS || '10000'),
  };

  return new OrpheusTTSAdapter(config);
}
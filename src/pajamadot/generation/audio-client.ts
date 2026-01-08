/**
 * Audio Generation Client
 * AIGC module for generating voiceovers and speech for PlayCanvas
 *
 * Supports:
 * - Text-to-Speech (TTS) voiceover generation
 * - Voice cloning from reference audio
 * - Sound effect generation
 */

import { PajamaDotTokenManager } from './token-manager';
import { jobsManager } from './jobs-manager';
import type { APIError, GenerationJob, GenerationJobStatus } from './types';

/**
 * Voice style options
 */
export type VoiceStyle = 'neutral' | 'happy' | 'sad' | 'angry' | 'fearful' | 'surprised' | 'whispering' | 'shouting';

/**
 * Voice gender options
 */
export type VoiceGender = 'male' | 'female' | 'neutral';

/**
 * Text-to-Speech request parameters
 */
export interface TTSRequest {
    text: string;
    voiceId?: string;           // Specific voice ID from voice library
    voiceStyle?: VoiceStyle;
    voiceGender?: VoiceGender;
    language?: string;          // ISO language code (en, es, zh, ja, etc.)
    speed?: number;             // 0.5 - 2.0, default 1.0
    pitch?: number;             // 0.5 - 2.0, default 1.0
    model?: 'elevenlabs' | 'azure' | 'openai';
}

/**
 * Voice cloning request
 */
export interface VoiceCloneRequest {
    referenceAudioUrl: string;
    text: string;
    voiceStyle?: VoiceStyle;
    speed?: number;
    pitch?: number;
}

/**
 * Sound effect generation request
 */
export interface SoundEffectRequest {
    prompt: string;             // e.g., "footsteps on gravel", "door creaking"
    duration?: number;          // Duration in seconds (1-30)
    model?: 'audiogen' | 'bark';
}

/**
 * Audio generation result
 */
export interface AudioGenerationResult {
    success: boolean;
    audioUrl?: string;
    assetId?: string;
    duration?: number;          // Duration in seconds
    format?: string;            // mp3, wav, ogg
    sampleRate?: number;
    creditsCost: number;
    creditsRemaining: number;
    requestId?: string;
    error?: string;
}

/**
 * Async audio generation response (for polling)
 */
export interface AudioGenerationResponse {
    requestId: string;
    status: GenerationJobStatus;
    progress: number;
    audioUrl?: string;
    creditsCost?: number;
    error?: string;
}

/**
 * Available voice
 */
export interface Voice {
    id: string;
    name: string;
    gender: VoiceGender;
    language: string;
    preview_url?: string;
    description?: string;
}

/**
 * Voice library response
 */
export interface VoiceLibraryResponse {
    voices: Voice[];
    total: number;
}

/**
 * Audio Generation Client
 * Generates voiceovers, speech, and sound effects using AI models
 */
class AudioClient {
    /**
     * Make an authenticated API request
     */
    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const url = `${PajamaDotTokenManager.getBaseUrl()}${endpoint}`;

        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...PajamaDotTokenManager.getAuthHeaders(),
                ...options.headers
            }
        });

        const data = await response.json();

        if (!response.ok) {
            const error = data as APIError;
            throw new Error(error.error || `API request failed: ${response.status}`);
        }

        return data as T;
    }

    /**
     * Check if audio generation is available
     */
    isAvailable(): boolean {
        return true; // Audio generation is available
    }

    /**
     * Get available voices from the voice library
     */
    async getVoices(options?: {
        language?: string;
        gender?: VoiceGender;
        limit?: number;
    }): Promise<VoiceLibraryResponse> {
        const params = new URLSearchParams();
        if (options?.language) params.set('language', options.language);
        if (options?.gender) params.set('gender', options.gender);
        if (options?.limit) params.set('limit', options.limit.toString());

        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request<VoiceLibraryResponse>(`/audio/voices${query}`, {
            method: 'GET'
        });
    }

    /**
     * Generate voiceover from text (Text-to-Speech)
     * Cost: 5 credits per 100 characters
     *
     * @param request - TTS parameters
     * @returns Generated audio result or async job
     */
    async generateSpeech(
        request: TTSRequest,
        onProgress?: (progress: number, message: string) => void
    ): Promise<AudioGenerationResult | AudioGenerationResponse> {
        if (!this.isAvailable()) {
            return {
                success: false,
                error: 'Audio generation is not available.',
                creditsCost: 0,
                creditsRemaining: 0
            };
        }

        onProgress?.(0, 'Starting speech generation...');

        const result = await this.request<AudioGenerationResult | AudioGenerationResponse>('/audio/tts', {
            method: 'POST',
            body: JSON.stringify({
                text: request.text,
                voiceId: request.voiceId,
                voiceStyle: request.voiceStyle ?? 'neutral',
                voiceGender: request.voiceGender ?? 'neutral',
                language: request.language ?? 'en',
                speed: request.speed ?? 1.0,
                pitch: request.pitch ?? 1.0,
                model: request.model ?? 'elevenlabs'
            })
        });

        // Check if async job
        if (this._isAsyncJob(result)) {
            onProgress?.(10, 'Speech generation started, tracking job...');

            // Add to job manager for tracking
            const job: GenerationJob = {
                requestId: result.requestId,
                endpointId: 'audio/tts',
                mediaType: 'voiceover',
                status: result.status || 'pending',
                progress: result.progress || 0,
                createdAt: Date.now(),
                creditsCost: result.creditsCost,
                input: { text: request.text.slice(0, 100) }
            };
            jobsManager.addJob(job);

            return result;
        }

        onProgress?.(100, 'Speech generation complete!');
        return result as AudioGenerationResult;
    }

    /**
     * Generate voiceover with voice cloning
     * Cost: 15 credits
     *
     * @param request - Voice clone parameters
     * @returns Generated audio result
     */
    async generateWithVoiceClone(
        request: VoiceCloneRequest,
        onProgress?: (progress: number, message: string) => void
    ): Promise<AudioGenerationResult | AudioGenerationResponse> {
        if (!this.isAvailable()) {
            return {
                success: false,
                error: 'Audio generation is not available.',
                creditsCost: 0,
                creditsRemaining: 0
            };
        }

        onProgress?.(0, 'Starting voice clone generation...');

        const result = await this.request<AudioGenerationResult | AudioGenerationResponse>('/audio/voice-clone', {
            method: 'POST',
            body: JSON.stringify({
                referenceAudioUrl: request.referenceAudioUrl,
                text: request.text,
                voiceStyle: request.voiceStyle ?? 'neutral',
                speed: request.speed ?? 1.0,
                pitch: request.pitch ?? 1.0
            })
        });

        if (this._isAsyncJob(result)) {
            onProgress?.(10, 'Voice clone generation started...');

            const job: GenerationJob = {
                requestId: result.requestId,
                endpointId: 'audio/voice-clone',
                mediaType: 'voiceover',
                status: result.status || 'pending',
                progress: result.progress || 0,
                createdAt: Date.now(),
                creditsCost: result.creditsCost,
                input: { text: request.text.slice(0, 100) }
            };
            jobsManager.addJob(job);

            return result;
        }

        onProgress?.(100, 'Voice clone complete!');
        return result as AudioGenerationResult;
    }

    /**
     * Generate sound effect from text prompt
     * Cost: 8 credits
     *
     * @param request - Sound effect parameters
     * @returns Generated audio result
     */
    async generateSoundEffect(
        request: SoundEffectRequest,
        onProgress?: (progress: number, message: string) => void
    ): Promise<AudioGenerationResult | AudioGenerationResponse> {
        if (!this.isAvailable()) {
            return {
                success: false,
                error: 'Audio generation is not available.',
                creditsCost: 0,
                creditsRemaining: 0
            };
        }

        onProgress?.(0, 'Starting sound effect generation...');

        const result = await this.request<AudioGenerationResult | AudioGenerationResponse>('/audio/sfx', {
            method: 'POST',
            body: JSON.stringify({
                prompt: request.prompt,
                duration: request.duration ?? 5,
                model: request.model ?? 'audiogen'
            })
        });

        if (this._isAsyncJob(result)) {
            onProgress?.(10, 'Sound effect generation started...');

            const job: GenerationJob = {
                requestId: result.requestId,
                endpointId: 'audio/sfx',
                mediaType: 'audio',
                status: result.status || 'pending',
                progress: result.progress || 0,
                createdAt: Date.now(),
                creditsCost: result.creditsCost,
                input: { prompt: request.prompt }
            };
            jobsManager.addJob(job);

            return result;
        }

        onProgress?.(100, 'Sound effect generated!');
        return result as AudioGenerationResult;
    }

    /**
     * Download audio as Blob for PlayCanvas import
     *
     * @param audioUrl - URL of the generated audio
     * @returns Blob of the audio file
     */
    async downloadAudioBlob(audioUrl: string): Promise<Blob> {
        const response = await fetch(audioUrl);
        if (!response.ok) {
            throw new Error(`Failed to download audio: ${response.status}`);
        }
        return response.blob();
    }

    /**
     * Check if result is an async job
     */
    private _isAsyncJob(result: any): result is AudioGenerationResponse {
        return result && result.requestId &&
               (result.status === 'pending' || result.status === 'in_progress');
    }

    /**
     * Get estimated credits for TTS
     */
    getEstimatedCredits(text: string): number {
        // 5 credits per 100 characters, minimum 5
        return Math.max(5, Math.ceil(text.length / 100) * 5);
    }
}

// Singleton instance
const audioClient = new AudioClient();

export { AudioClient, audioClient };

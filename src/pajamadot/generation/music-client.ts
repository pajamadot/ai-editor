/**
 * Music Generation Client
 * AIGC module for generating background music and soundtracks for PlayCanvas
 *
 * Supports:
 * - Text-to-Music generation
 * - Mood-based composition
 * - Loop-friendly music generation
 * - Music continuation/extension
 */

import { PajamaDotTokenManager } from './token-manager';
import { jobsManager } from './jobs-manager';
import type { APIError, GenerationJob, GenerationJobStatus } from './types';

/**
 * Music genre options
 */
export type MusicGenre =
    | 'ambient' | 'orchestral' | 'electronic' | 'rock' | 'jazz'
    | 'classical' | 'folk' | 'cinematic' | 'chiptune' | 'lofi'
    | 'epic' | 'horror' | 'fantasy' | 'scifi' | 'action';

/**
 * Music mood options
 */
export type MusicMood =
    | 'happy' | 'sad' | 'tense' | 'peaceful' | 'mysterious'
    | 'epic' | 'romantic' | 'dark' | 'uplifting' | 'melancholic'
    | 'adventurous' | 'dreamy' | 'intense' | 'relaxing';

/**
 * Music tempo options
 */
export type MusicTempo = 'slow' | 'medium' | 'fast' | 'variable';

/**
 * Music generation request parameters
 */
export interface MusicGenerationRequest {
    prompt: string;             // Text description of the music
    genre?: MusicGenre;
    mood?: MusicMood;
    tempo?: MusicTempo;
    duration?: number;          // Duration in seconds (5-180)
    bpm?: number;               // Beats per minute (60-200)
    key?: string;               // Musical key (C, Am, G, etc.)
    instruments?: string[];     // Specific instruments to include
    loopable?: boolean;         // Generate loop-friendly music
    model?: 'suno' | 'udio' | 'musicgen';
}

/**
 * Music continuation request
 */
export interface MusicContinuationRequest {
    audioUrl: string;           // URL of existing music to continue
    duration?: number;          // Additional duration in seconds
    style?: string;             // Style modification
    fadeOut?: boolean;          // Add fade out at end
}

/**
 * Music generation result
 */
export interface MusicGenerationResult {
    success: boolean;
    audioUrl?: string;
    assetId?: string;
    duration?: number;          // Duration in seconds
    format?: string;            // mp3, wav, ogg
    bpm?: number;
    key?: string;
    creditsCost: number;
    creditsRemaining: number;
    requestId?: string;
    error?: string;
}

/**
 * Async music generation response (for polling)
 */
export interface MusicGenerationResponse {
    requestId: string;
    status: GenerationJobStatus;
    progress: number;
    audioUrl?: string;
    creditsCost?: number;
    error?: string;
}

/**
 * Music generation preset
 */
export interface MusicPreset {
    id: string;
    name: string;
    description: string;
    genre: MusicGenre;
    mood: MusicMood;
    tempo: MusicTempo;
    bpm?: number;
    promptTemplate: string;
}

/**
 * Default music presets for common game scenarios
 */
const MUSIC_PRESETS: MusicPreset[] = [
    {
        id: 'main-menu',
        name: 'Main Menu',
        description: 'Calm, inviting music for game menus',
        genre: 'ambient',
        mood: 'peaceful',
        tempo: 'slow',
        bpm: 80,
        promptTemplate: 'gentle ambient music, peaceful atmosphere, main menu theme'
    },
    {
        id: 'exploration',
        name: 'Exploration',
        description: 'Light, curious music for exploring',
        genre: 'orchestral',
        mood: 'adventurous',
        tempo: 'medium',
        bpm: 100,
        promptTemplate: 'orchestral exploration theme, curious and light, discovery atmosphere'
    },
    {
        id: 'battle',
        name: 'Battle Theme',
        description: 'Intense, action-packed combat music',
        genre: 'orchestral',
        mood: 'intense',
        tempo: 'fast',
        bpm: 140,
        promptTemplate: 'epic battle music, intense orchestral, drums and brass, action combat theme'
    },
    {
        id: 'boss-fight',
        name: 'Boss Fight',
        description: 'Epic, dramatic boss encounter music',
        genre: 'epic',
        mood: 'epic',
        tempo: 'fast',
        bpm: 150,
        promptTemplate: 'epic boss battle theme, dramatic orchestral, choir, intense and powerful'
    },
    {
        id: 'victory',
        name: 'Victory',
        description: 'Triumphant celebration music',
        genre: 'orchestral',
        mood: 'uplifting',
        tempo: 'medium',
        bpm: 120,
        promptTemplate: 'victory fanfare, triumphant orchestral, celebration theme, uplifting'
    },
    {
        id: 'defeat',
        name: 'Defeat/Game Over',
        description: 'Somber, melancholic music',
        genre: 'orchestral',
        mood: 'sad',
        tempo: 'slow',
        bpm: 60,
        promptTemplate: 'melancholic game over theme, sad orchestral, somber and reflective'
    },
    {
        id: 'town',
        name: 'Town/Village',
        description: 'Warm, welcoming town atmosphere',
        genre: 'folk',
        mood: 'peaceful',
        tempo: 'medium',
        bpm: 90,
        promptTemplate: 'medieval village music, warm folk instruments, peaceful town atmosphere'
    },
    {
        id: 'dungeon',
        name: 'Dungeon',
        description: 'Dark, mysterious dungeon atmosphere',
        genre: 'ambient',
        mood: 'mysterious',
        tempo: 'slow',
        bpm: 70,
        promptTemplate: 'dark dungeon ambience, mysterious and tense, echoing atmosphere'
    },
    {
        id: 'horror',
        name: 'Horror',
        description: 'Creepy, unsettling atmosphere',
        genre: 'horror',
        mood: 'dark',
        tempo: 'slow',
        bpm: 60,
        promptTemplate: 'horror atmosphere, creepy ambient, unsettling tension, suspenseful'
    },
    {
        id: 'scifi',
        name: 'Sci-Fi',
        description: 'Futuristic electronic atmosphere',
        genre: 'scifi',
        mood: 'mysterious',
        tempo: 'medium',
        bpm: 110,
        promptTemplate: 'futuristic sci-fi music, electronic synths, space atmosphere'
    },
    {
        id: 'romantic',
        name: 'Romantic',
        description: 'Soft, emotional romantic theme',
        genre: 'classical',
        mood: 'romantic',
        tempo: 'slow',
        bpm: 75,
        promptTemplate: 'romantic piano melody, soft strings, emotional and tender'
    },
    {
        id: 'chase',
        name: 'Chase/Escape',
        description: 'Fast-paced pursuit music',
        genre: 'action',
        mood: 'intense',
        tempo: 'fast',
        bpm: 160,
        promptTemplate: 'intense chase music, fast-paced action, urgent drums, escape theme'
    }
];

/**
 * Music Generation Client
 * Generates background music and soundtracks using AI models
 */
class MusicClient {
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
     * Check if music generation is available
     */
    isAvailable(): boolean {
        return true; // Music generation is available
    }

    /**
     * Get available music presets
     */
    getPresets(): MusicPreset[] {
        return MUSIC_PRESETS;
    }

    /**
     * Get a specific preset by ID
     */
    getPreset(presetId: string): MusicPreset | undefined {
        return MUSIC_PRESETS.find(p => p.id === presetId);
    }

    /**
     * Generate music from text prompt
     * Cost: 15 credits for 30s, scales with duration
     *
     * @param request - Music generation parameters
     * @returns Generated music result or async job
     */
    async generateMusic(
        request: MusicGenerationRequest,
        onProgress?: (progress: number, message: string) => void
    ): Promise<MusicGenerationResult | MusicGenerationResponse> {
        if (!this.isAvailable()) {
            return {
                success: false,
                error: 'Music generation is not available.',
                creditsCost: 0,
                creditsRemaining: 0
            };
        }

        onProgress?.(0, 'Starting music generation...');

        // Build enhanced prompt with genre/mood
        let fullPrompt = request.prompt;
        if (request.genre) {
            fullPrompt = `${request.genre} style, ${fullPrompt}`;
        }
        if (request.mood) {
            fullPrompt = `${request.mood} mood, ${fullPrompt}`;
        }
        if (request.instruments && request.instruments.length > 0) {
            fullPrompt = `${fullPrompt}, featuring ${request.instruments.join(', ')}`;
        }
        if (request.loopable) {
            fullPrompt = `${fullPrompt}, seamless loop`;
        }

        const result = await this.request<MusicGenerationResult | MusicGenerationResponse>('/audio/music', {
            method: 'POST',
            body: JSON.stringify({
                prompt: fullPrompt,
                duration: request.duration ?? 30,
                bpm: request.bpm,
                key: request.key,
                loopable: request.loopable ?? false,
                model: request.model ?? 'suno'
            })
        });

        // Check if async job
        if (this._isAsyncJob(result)) {
            onProgress?.(10, 'Music generation started, this may take a few minutes...');

            // Add to job manager for tracking
            const job: GenerationJob = {
                requestId: result.requestId,
                endpointId: 'audio/music',
                mediaType: 'music',
                status: result.status || 'pending',
                progress: result.progress || 0,
                createdAt: Date.now(),
                creditsCost: result.creditsCost,
                input: { prompt: request.prompt }
            };
            jobsManager.addJob(job);

            return result;
        }

        onProgress?.(100, 'Music generation complete!');
        return result as MusicGenerationResult;
    }

    /**
     * Generate music from a preset
     * Cost: 15 credits for 30s
     *
     * @param presetId - Preset ID to use
     * @param options - Additional options to override preset
     */
    async generateFromPreset(
        presetId: string,
        options?: {
            duration?: number;
            customPrompt?: string;
            loopable?: boolean;
        },
        onProgress?: (progress: number, message: string) => void
    ): Promise<MusicGenerationResult | MusicGenerationResponse> {
        const preset = this.getPreset(presetId);
        if (!preset) {
            return {
                success: false,
                error: `Unknown preset: ${presetId}`,
                creditsCost: 0,
                creditsRemaining: 0
            };
        }

        onProgress?.(0, `Generating ${preset.name} music...`);

        const prompt = options?.customPrompt
            ? `${preset.promptTemplate}, ${options.customPrompt}`
            : preset.promptTemplate;

        return this.generateMusic({
            prompt,
            genre: preset.genre,
            mood: preset.mood,
            tempo: preset.tempo,
            bpm: preset.bpm,
            duration: options?.duration ?? 30,
            loopable: options?.loopable ?? true
        }, onProgress);
    }

    /**
     * Continue/extend existing music
     * Cost: 10 credits per 30s
     *
     * @param request - Music continuation parameters
     * @returns Extended music result
     */
    async continueMusic(
        request: MusicContinuationRequest,
        onProgress?: (progress: number, message: string) => void
    ): Promise<MusicGenerationResult | MusicGenerationResponse> {
        if (!this.isAvailable()) {
            return {
                success: false,
                error: 'Music generation is not available.',
                creditsCost: 0,
                creditsRemaining: 0
            };
        }

        onProgress?.(0, 'Extending music...');

        const result = await this.request<MusicGenerationResult | MusicGenerationResponse>('/audio/music/continue', {
            method: 'POST',
            body: JSON.stringify({
                audioUrl: request.audioUrl,
                duration: request.duration ?? 30,
                style: request.style,
                fadeOut: request.fadeOut ?? false
            })
        });

        if (this._isAsyncJob(result)) {
            onProgress?.(10, 'Music continuation started...');

            const job: GenerationJob = {
                requestId: result.requestId,
                endpointId: 'audio/music/continue',
                mediaType: 'music',
                status: result.status || 'pending',
                progress: result.progress || 0,
                createdAt: Date.now(),
                creditsCost: result.creditsCost,
                input: { audioUrl: request.audioUrl }
            };
            jobsManager.addJob(job);

            return result;
        }

        onProgress?.(100, 'Music extension complete!');
        return result as MusicGenerationResult;
    }

    /**
     * Download music as Blob for PlayCanvas import
     *
     * @param audioUrl - URL of the generated music
     * @returns Blob of the audio file
     */
    async downloadMusicBlob(audioUrl: string): Promise<Blob> {
        const response = await fetch(audioUrl);
        if (!response.ok) {
            throw new Error(`Failed to download music: ${response.status}`);
        }
        return response.blob();
    }

    /**
     * Check if result is an async job
     */
    private _isAsyncJob(result: any): result is MusicGenerationResponse {
        return result && result.requestId &&
               (result.status === 'pending' || result.status === 'in_progress');
    }

    /**
     * Get estimated credits for music generation
     */
    getEstimatedCredits(durationSeconds: number): number {
        // 15 credits per 30 seconds, minimum 15
        return Math.max(15, Math.ceil(durationSeconds / 30) * 15);
    }
}

// Singleton instance
const musicClient = new MusicClient();

export { MusicClient, musicClient, MUSIC_PRESETS };

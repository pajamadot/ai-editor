/**
 * Video Generation Client
 * AIGC module for generating videos for PlayCanvas
 *
 * Supports:
 * - Text-to-Video generation
 * - Image-to-Video animation
 * - Video style transfer
 */

import { PajamaDotTokenManager } from './token-manager';
import { jobsManager } from './jobs-manager';
import type { APIError, GenerationJob, GenerationJobStatus } from './types';

/**
 * Video style options
 */
export type VideoStyle =
    | 'cinematic' | 'cartoon' | 'anime' | 'realistic'
    | 'watercolor' | 'oil_painting' | 'pixel_art' | 'claymation'
    | 'noir' | 'retro' | 'fantasy' | 'scifi';

/**
 * Video motion intensity
 */
export type MotionIntensity = 'subtle' | 'gentle' | 'moderate' | 'dynamic' | 'intense';

/**
 * Video generation request parameters
 */
export interface VideoGenerationRequest {
    prompt: string;
    duration?: number;           // Duration in seconds (3, 5, 10)
    aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
    style?: VideoStyle;
    motion?: MotionIntensity;
    fps?: number;                // Frames per second (24, 30)
    negativePrompt?: string;     // What to avoid
    seed?: number;               // For reproducibility
    model?: 'minimax' | 'runway' | 'pika' | 'kling';
}

/**
 * Image-to-video request
 */
export interface ImageToVideoRequest {
    imageUrl: string;
    prompt?: string;             // Motion/action description
    duration?: number;
    motion?: MotionIntensity;
    cameraMotion?: 'static' | 'pan_left' | 'pan_right' | 'zoom_in' | 'zoom_out' | 'orbit';
    style?: VideoStyle;
}

/**
 * Video generation result
 */
export interface VideoGenerationResult {
    success: boolean;
    videoUrl?: string;
    thumbnailUrl?: string;
    assetId?: string;
    duration?: number;
    width?: number;
    height?: number;
    fps?: number;
    creditsCost: number;
    creditsRemaining: number;
    requestId?: string;
    error?: string;
}

/**
 * Async video generation response (for polling)
 */
export interface VideoGenerationResponse {
    requestId: string;
    status: GenerationJobStatus;
    progress: number;
    videoUrl?: string;
    thumbnailUrl?: string;
    creditsCost?: number;
    error?: string;
}

/**
 * Video Generation Client
 * Generates videos using AI models
 */
class VideoClient {
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
     * Check if video generation is available
     */
    isAvailable(): boolean {
        return true; // Video generation is now available
    }

    /**
     * Generate a video from a text prompt
     * Cost: 25 credits for 5s, scales with duration
     *
     * @param request - Video generation parameters
     * @returns Generated video result or async job
     */
    async generateVideo(
        request: VideoGenerationRequest,
        onProgress?: (progress: number, message: string) => void
    ): Promise<VideoGenerationResult | VideoGenerationResponse> {
        if (!this.isAvailable()) {
            return {
                success: false,
                error: 'Video generation is not available.',
                creditsCost: 0,
                creditsRemaining: 0
            };
        }

        onProgress?.(0, 'Starting video generation...');

        // Build enhanced prompt with style
        let fullPrompt = request.prompt;
        if (request.style) {
            fullPrompt = `${request.style} style, ${fullPrompt}`;
        }
        if (request.motion) {
            fullPrompt = `${fullPrompt}, ${request.motion} motion`;
        }

        const result = await this.request<VideoGenerationResult | VideoGenerationResponse>('/video/generate', {
            method: 'POST',
            body: JSON.stringify({
                prompt: fullPrompt,
                negativePrompt: request.negativePrompt,
                duration: request.duration ?? 5,
                aspectRatio: request.aspectRatio ?? '16:9',
                fps: request.fps ?? 24,
                seed: request.seed,
                model: request.model ?? 'minimax'
            })
        });

        // Check if async job (video generation is usually async)
        if (this._isAsyncJob(result)) {
            onProgress?.(10, 'Video generation started, this may take a few minutes...');

            // Add to job manager for tracking
            const job: GenerationJob = {
                requestId: result.requestId,
                endpointId: `video/generate/${request.model ?? 'minimax'}`,
                mediaType: 'video',
                status: result.status || 'pending',
                progress: result.progress || 0,
                createdAt: Date.now(),
                creditsCost: result.creditsCost,
                input: { prompt: request.prompt }
            };
            jobsManager.addJob(job);

            return result;
        }

        onProgress?.(100, 'Video generation complete!');
        return result as VideoGenerationResult;
    }

    /**
     * Generate video from an image (image-to-video)
     * Cost: 20 credits for 5s
     *
     * @param request - Image-to-video parameters
     * @returns Generated video result or async job
     */
    async generateVideoFromImage(
        request: ImageToVideoRequest,
        onProgress?: (progress: number, message: string) => void
    ): Promise<VideoGenerationResult | VideoGenerationResponse> {
        if (!this.isAvailable()) {
            return {
                success: false,
                error: 'Video generation is not available.',
                creditsCost: 0,
                creditsRemaining: 0
            };
        }

        onProgress?.(0, 'Starting image-to-video conversion...');

        const result = await this.request<VideoGenerationResult | VideoGenerationResponse>('/video/image-to-video', {
            method: 'POST',
            body: JSON.stringify({
                imageUrl: request.imageUrl,
                prompt: request.prompt,
                duration: request.duration ?? 5,
                motion: request.motion ?? 'moderate',
                cameraMotion: request.cameraMotion ?? 'static',
                style: request.style
            })
        });

        if (this._isAsyncJob(result)) {
            onProgress?.(10, 'Image-to-video conversion started...');

            const job: GenerationJob = {
                requestId: result.requestId,
                endpointId: 'video/image-to-video',
                mediaType: 'video',
                status: result.status || 'pending',
                progress: result.progress || 0,
                createdAt: Date.now(),
                creditsCost: result.creditsCost,
                input: { imageUrl: request.imageUrl, prompt: request.prompt }
            };
            jobsManager.addJob(job);

            return result;
        }

        onProgress?.(100, 'Video generated!');
        return result as VideoGenerationResult;
    }

    /**
     * Download video as Blob for PlayCanvas import
     *
     * @param videoUrl - URL of the generated video
     * @returns Blob of the video file
     */
    async downloadVideoBlob(videoUrl: string): Promise<Blob> {
        const response = await fetch(videoUrl);
        if (!response.ok) {
            throw new Error(`Failed to download video: ${response.status}`);
        }
        return response.blob();
    }

    /**
     * Check if result is an async job
     */
    private _isAsyncJob(result: any): result is VideoGenerationResponse {
        return result && result.requestId &&
               (result.status === 'pending' || result.status === 'in_progress');
    }

    /**
     * Get estimated credits for video generation
     */
    getEstimatedCredits(durationSeconds: number, isImageToVideo: boolean = false): number {
        const baseCredits = isImageToVideo ? 20 : 25;
        // Scale: 25 credits per 5 seconds for text-to-video
        // 20 credits per 5 seconds for image-to-video
        return Math.ceil(durationSeconds / 5) * baseCredits;
    }

    /**
     * Get available video styles
     */
    getAvailableStyles(): { value: VideoStyle; label: string }[] {
        return [
            { value: 'cinematic', label: 'Cinematic' },
            { value: 'realistic', label: 'Realistic' },
            { value: 'cartoon', label: 'Cartoon' },
            { value: 'anime', label: 'Anime' },
            { value: 'watercolor', label: 'Watercolor' },
            { value: 'oil_painting', label: 'Oil Painting' },
            { value: 'pixel_art', label: 'Pixel Art' },
            { value: 'claymation', label: 'Claymation' },
            { value: 'noir', label: 'Film Noir' },
            { value: 'retro', label: 'Retro' },
            { value: 'fantasy', label: 'Fantasy' },
            { value: 'scifi', label: 'Sci-Fi' }
        ];
    }

    /**
     * Get available motion intensities
     */
    getMotionOptions(): { value: MotionIntensity; label: string }[] {
        return [
            { value: 'subtle', label: 'Subtle' },
            { value: 'gentle', label: 'Gentle' },
            { value: 'moderate', label: 'Moderate' },
            { value: 'dynamic', label: 'Dynamic' },
            { value: 'intense', label: 'Intense' }
        ];
    }
}

// Singleton instance
const videoClient = new VideoClient();

export { VideoClient, videoClient };

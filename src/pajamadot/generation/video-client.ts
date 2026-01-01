/**
 * Video Generation Client
 * AIGC module for generating videos for PlayCanvas
 *
 * Note: Video generation is planned but not yet available in the backend.
 * This client is prepared for future integration.
 */

import { PajamaDotTokenManager } from './token-manager';
import type { APIError } from './types';

/**
 * Video generation request parameters
 */
export interface VideoGenerationRequest {
    prompt: string;
    duration?: number;        // Duration in seconds (5, 10, 15)
    aspectRatio?: '16:9' | '9:16' | '1:1';
    style?: string;           // e.g., "cinematic", "cartoon", "realistic"
    fps?: number;             // Frames per second (24, 30, 60)
    model?: 'minimax' | 'runway' | 'pika';
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
    creditsCost: number;
    creditsRemaining: number;
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
     * Returns false until backend support is added
     */
    isAvailable(): boolean {
        return false; // Video generation not yet implemented in backend
    }

    /**
     * Generate a video from a text prompt
     * Cost: TBD credits
     *
     * @param request - Video generation parameters
     * @returns Generated video result
     */
    async generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResult> {
        if (!this.isAvailable()) {
            return {
                success: false,
                error: 'Video generation is not yet available. Coming soon!',
                creditsCost: 0,
                creditsRemaining: 0
            };
        }

        return this.request<VideoGenerationResult>('/video/generate', {
            method: 'POST',
            body: JSON.stringify({
                prompt: request.prompt,
                duration: request.duration ?? 5,
                aspectRatio: request.aspectRatio ?? '16:9',
                style: request.style,
                fps: request.fps ?? 24,
                model: request.model ?? 'minimax'
            })
        });
    }

    /**
     * Generate video from an image (image-to-video)
     * Cost: TBD credits
     */
    async generateVideoFromImage(
        imageUrl: string,
        options?: {
            duration?: number;
            motion?: 'gentle' | 'moderate' | 'dynamic';
            style?: string;
        }
    ): Promise<VideoGenerationResult> {
        if (!this.isAvailable()) {
            return {
                success: false,
                error: 'Video generation is not yet available. Coming soon!',
                creditsCost: 0,
                creditsRemaining: 0
            };
        }

        return this.request<VideoGenerationResult>('/video/image-to-video', {
            method: 'POST',
            body: JSON.stringify({
                imageUrl,
                duration: options?.duration ?? 5,
                motion: options?.motion ?? 'moderate',
                style: options?.style
            })
        });
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
}

// Singleton instance
const videoClient = new VideoClient();

export { VideoClient, videoClient };

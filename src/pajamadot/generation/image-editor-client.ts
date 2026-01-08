/**
 * Image Editor Client
 * AIGC module for editing and manipulating images using AI
 *
 * Supports:
 * - Inpainting (edit specific regions)
 * - Outpainting (extend image boundaries)
 * - Background replacement
 * - Object removal
 * - Image enhancement
 * - Style transfer
 */

import { PajamaDotTokenManager } from './token-manager';
import { jobsManager } from './jobs-manager';
import type { APIError, GenerationJob, GenerationJobStatus } from './types';

/**
 * Mask mode for inpainting
 */
export type MaskMode = 'paint' | 'auto' | 'segment';

/**
 * Outpainting direction
 */
export type OutpaintDirection = 'left' | 'right' | 'up' | 'down' | 'all';

/**
 * Image enhancement type
 */
export type EnhancementType = 'upscale' | 'denoise' | 'sharpen' | 'colorize' | 'restore';

/**
 * Inpainting request
 */
export interface InpaintingRequest {
    imageUrl: string;
    maskUrl?: string;           // Binary mask image (white = edit area)
    maskData?: string;          // Base64 mask data
    prompt: string;             // What to generate in the masked area
    negativePrompt?: string;
    strength?: number;          // 0.0 - 1.0 (how much to change)
    guidance?: number;          // 1.0 - 20.0
    seed?: number;
}

/**
 * Outpainting request
 */
export interface OutpaintingRequest {
    imageUrl: string;
    direction: OutpaintDirection | OutpaintDirection[];
    extension: number;          // Pixels to extend (64-512)
    prompt?: string;            // Guide the extension
    seamless?: boolean;         // Try to make seamless
}

/**
 * Background replacement request
 */
export interface BackgroundReplaceRequest {
    imageUrl: string;
    backgroundPrompt: string;   // Describe new background
    preserveSubject?: boolean;  // Auto-detect and preserve foreground
    featherEdge?: number;       // Edge blending (0-50 pixels)
}

/**
 * Object removal request
 */
export interface ObjectRemovalRequest {
    imageUrl: string;
    maskUrl?: string;           // Mask of area to remove
    maskData?: string;          // Base64 mask
    prompt?: string;            // What to replace with (optional, default: intelligent fill)
}

/**
 * Image enhancement request
 */
export interface EnhancementRequest {
    imageUrl: string;
    enhancement: EnhancementType;
    scale?: number;             // For upscale: 2 or 4
    strength?: number;          // Enhancement strength 0.0 - 1.0
}

/**
 * Style transfer request
 */
export interface StyleTransferRequest {
    contentImageUrl: string;
    styleImageUrl?: string;     // Reference style image
    stylePrompt?: string;       // Or text description of style
    strength?: number;          // 0.0 - 1.0
    preserveContent?: boolean;  // Keep structure, change style
}

/**
 * Image editing result
 */
export interface ImageEditResult {
    success: boolean;
    imageUrl?: string;
    assetId?: string;
    creditsCost: number;
    creditsRemaining: number;
    requestId?: string;
    error?: string;
}

/**
 * Async image editing response
 */
export interface ImageEditResponse {
    requestId: string;
    status: GenerationJobStatus;
    progress: number;
    imageUrl?: string;
    creditsCost?: number;
    error?: string;
}

/**
 * Image Editor Client
 * Provides AI-powered image editing capabilities
 */
class ImageEditorClient {
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
     * Check if image editing is available
     */
    isAvailable(): boolean {
        return true;
    }

    /**
     * Inpaint a specific region of an image
     * Cost: 8 credits
     *
     * @param request - Inpainting parameters
     * @returns Edited image result
     */
    async inpaint(
        request: InpaintingRequest,
        onProgress?: (progress: number, message: string) => void
    ): Promise<ImageEditResult | ImageEditResponse> {
        if (!this.isAvailable()) {
            return {
                success: false,
                error: 'Image editing is not available.',
                creditsCost: 0,
                creditsRemaining: 0
            };
        }

        onProgress?.(0, 'Starting inpainting...');

        const result = await this.request<ImageEditResult | ImageEditResponse>('/image/inpaint', {
            method: 'POST',
            body: JSON.stringify({
                imageUrl: request.imageUrl,
                maskUrl: request.maskUrl,
                maskData: request.maskData,
                prompt: request.prompt,
                negativePrompt: request.negativePrompt,
                strength: request.strength ?? 0.8,
                guidance: request.guidance ?? 7.5,
                seed: request.seed
            })
        });

        if (this._isAsyncJob(result)) {
            onProgress?.(10, 'Inpainting started...');

            const job: GenerationJob = {
                requestId: result.requestId,
                endpointId: 'image/inpaint',
                mediaType: 'image',
                status: result.status || 'pending',
                progress: result.progress || 0,
                createdAt: Date.now(),
                creditsCost: result.creditsCost,
                input: { prompt: request.prompt }
            };
            jobsManager.addJob(job);

            return result;
        }

        onProgress?.(100, 'Inpainting complete!');
        return result as ImageEditResult;
    }

    /**
     * Extend image boundaries (outpainting)
     * Cost: 10 credits
     *
     * @param request - Outpainting parameters
     * @returns Extended image result
     */
    async outpaint(
        request: OutpaintingRequest,
        onProgress?: (progress: number, message: string) => void
    ): Promise<ImageEditResult | ImageEditResponse> {
        if (!this.isAvailable()) {
            return {
                success: false,
                error: 'Image editing is not available.',
                creditsCost: 0,
                creditsRemaining: 0
            };
        }

        onProgress?.(0, 'Starting outpainting...');

        const directions = Array.isArray(request.direction)
            ? request.direction
            : [request.direction];

        const result = await this.request<ImageEditResult | ImageEditResponse>('/image/outpaint', {
            method: 'POST',
            body: JSON.stringify({
                imageUrl: request.imageUrl,
                directions,
                extension: request.extension,
                prompt: request.prompt,
                seamless: request.seamless ?? true
            })
        });

        if (this._isAsyncJob(result)) {
            onProgress?.(10, 'Outpainting started...');

            const job: GenerationJob = {
                requestId: result.requestId,
                endpointId: 'image/outpaint',
                mediaType: 'image',
                status: result.status || 'pending',
                progress: result.progress || 0,
                createdAt: Date.now(),
                creditsCost: result.creditsCost,
                input: { directions, extension: request.extension }
            };
            jobsManager.addJob(job);

            return result;
        }

        onProgress?.(100, 'Outpainting complete!');
        return result as ImageEditResult;
    }

    /**
     * Replace background of an image
     * Cost: 6 credits
     *
     * @param request - Background replacement parameters
     * @returns Image with new background
     */
    async replaceBackground(
        request: BackgroundReplaceRequest,
        onProgress?: (progress: number, message: string) => void
    ): Promise<ImageEditResult | ImageEditResponse> {
        if (!this.isAvailable()) {
            return {
                success: false,
                error: 'Image editing is not available.',
                creditsCost: 0,
                creditsRemaining: 0
            };
        }

        onProgress?.(0, 'Replacing background...');

        const result = await this.request<ImageEditResult | ImageEditResponse>('/image/background-replace', {
            method: 'POST',
            body: JSON.stringify({
                imageUrl: request.imageUrl,
                backgroundPrompt: request.backgroundPrompt,
                preserveSubject: request.preserveSubject ?? true,
                featherEdge: request.featherEdge ?? 5
            })
        });

        if (this._isAsyncJob(result)) {
            onProgress?.(10, 'Background replacement started...');

            const job: GenerationJob = {
                requestId: result.requestId,
                endpointId: 'image/background-replace',
                mediaType: 'image',
                status: result.status || 'pending',
                progress: result.progress || 0,
                createdAt: Date.now(),
                creditsCost: result.creditsCost,
                input: { backgroundPrompt: request.backgroundPrompt }
            };
            jobsManager.addJob(job);

            return result;
        }

        onProgress?.(100, 'Background replaced!');
        return result as ImageEditResult;
    }

    /**
     * Remove object from image
     * Cost: 5 credits
     *
     * @param request - Object removal parameters
     * @returns Image with object removed
     */
    async removeObject(
        request: ObjectRemovalRequest,
        onProgress?: (progress: number, message: string) => void
    ): Promise<ImageEditResult | ImageEditResponse> {
        if (!this.isAvailable()) {
            return {
                success: false,
                error: 'Image editing is not available.',
                creditsCost: 0,
                creditsRemaining: 0
            };
        }

        onProgress?.(0, 'Removing object...');

        const result = await this.request<ImageEditResult | ImageEditResponse>('/image/remove-object', {
            method: 'POST',
            body: JSON.stringify({
                imageUrl: request.imageUrl,
                maskUrl: request.maskUrl,
                maskData: request.maskData,
                prompt: request.prompt
            })
        });

        if (this._isAsyncJob(result)) {
            onProgress?.(10, 'Object removal started...');

            const job: GenerationJob = {
                requestId: result.requestId,
                endpointId: 'image/remove-object',
                mediaType: 'image',
                status: result.status || 'pending',
                progress: result.progress || 0,
                createdAt: Date.now(),
                creditsCost: result.creditsCost,
                input: {}
            };
            jobsManager.addJob(job);

            return result;
        }

        onProgress?.(100, 'Object removed!');
        return result as ImageEditResult;
    }

    /**
     * Enhance image quality
     * Cost: 3-8 credits depending on enhancement
     *
     * @param request - Enhancement parameters
     * @returns Enhanced image
     */
    async enhance(
        request: EnhancementRequest,
        onProgress?: (progress: number, message: string) => void
    ): Promise<ImageEditResult | ImageEditResponse> {
        if (!this.isAvailable()) {
            return {
                success: false,
                error: 'Image editing is not available.',
                creditsCost: 0,
                creditsRemaining: 0
            };
        }

        onProgress?.(0, `Starting ${request.enhancement}...`);

        const result = await this.request<ImageEditResult | ImageEditResponse>('/image/enhance', {
            method: 'POST',
            body: JSON.stringify({
                imageUrl: request.imageUrl,
                enhancement: request.enhancement,
                scale: request.scale ?? 2,
                strength: request.strength ?? 0.5
            })
        });

        if (this._isAsyncJob(result)) {
            onProgress?.(10, `${request.enhancement} started...`);

            const job: GenerationJob = {
                requestId: result.requestId,
                endpointId: 'image/enhance',
                mediaType: 'image',
                status: result.status || 'pending',
                progress: result.progress || 0,
                createdAt: Date.now(),
                creditsCost: result.creditsCost,
                input: { enhancement: request.enhancement }
            };
            jobsManager.addJob(job);

            return result;
        }

        onProgress?.(100, `${request.enhancement} complete!`);
        return result as ImageEditResult;
    }

    /**
     * Apply style transfer
     * Cost: 10 credits
     *
     * @param request - Style transfer parameters
     * @returns Styled image
     */
    async styleTransfer(
        request: StyleTransferRequest,
        onProgress?: (progress: number, message: string) => void
    ): Promise<ImageEditResult | ImageEditResponse> {
        if (!this.isAvailable()) {
            return {
                success: false,
                error: 'Image editing is not available.',
                creditsCost: 0,
                creditsRemaining: 0
            };
        }

        onProgress?.(0, 'Applying style transfer...');

        const result = await this.request<ImageEditResult | ImageEditResponse>('/image/style-transfer', {
            method: 'POST',
            body: JSON.stringify({
                contentImageUrl: request.contentImageUrl,
                styleImageUrl: request.styleImageUrl,
                stylePrompt: request.stylePrompt,
                strength: request.strength ?? 0.7,
                preserveContent: request.preserveContent ?? true
            })
        });

        if (this._isAsyncJob(result)) {
            onProgress?.(10, 'Style transfer started...');

            const job: GenerationJob = {
                requestId: result.requestId,
                endpointId: 'image/style-transfer',
                mediaType: 'image',
                status: result.status || 'pending',
                progress: result.progress || 0,
                createdAt: Date.now(),
                creditsCost: result.creditsCost,
                input: { stylePrompt: request.stylePrompt }
            };
            jobsManager.addJob(job);

            return result;
        }

        onProgress?.(100, 'Style transfer complete!');
        return result as ImageEditResult;
    }

    /**
     * Check if result is an async job
     */
    private _isAsyncJob(result: any): result is ImageEditResponse {
        return result && result.requestId &&
               (result.status === 'pending' || result.status === 'in_progress');
    }

    /**
     * Get estimated credits for editing operation
     */
    getEstimatedCredits(operation: string): number {
        const costs: Record<string, number> = {
            'inpaint': 8,
            'outpaint': 10,
            'background-replace': 6,
            'remove-object': 5,
            'upscale': 3,
            'denoise': 3,
            'sharpen': 2,
            'colorize': 5,
            'restore': 8,
            'style-transfer': 10
        };
        return costs[operation] || 5;
    }
}

// Singleton instance
const imageEditorClient = new ImageEditorClient();

export { ImageEditorClient, imageEditorClient };

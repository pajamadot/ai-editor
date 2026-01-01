/**
 * Generation Client
 * API client for PajamaDot AIGC generation services
 */

import { PajamaDotTokenManager } from './token-manager';
import type {
    GenerationResult,
    CreditsBalance,
    ForgePromptResult,
    CharacterGenerationRequest,
    SceneGenerationRequest,
    ForgePromptRequest,
    EnhancePromptRequest,
    APIError
} from './types';

class GenerationClient {
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
     * Get user credit balance
     */
    async getCredits(): Promise<CreditsBalance> {
        return this.request<CreditsBalance>('/credits/balance', {
            method: 'GET'
        });
    }

    /**
     * Generate character portrait
     * Cost: 10 credits (includes background removal)
     */
    async generateCharacter(request: CharacterGenerationRequest): Promise<GenerationResult> {
        return this.request<GenerationResult>('/image/generate-character', {
            method: 'POST',
            body: JSON.stringify({
                prompt: request.prompt,
                removeBackground: request.removeBackground ?? true,
                aspectRatio: request.aspectRatio ?? '1:1'
            })
        });
    }

    /**
     * Generate scene/location background
     * Cost: 8-15 credits based on quality
     */
    async generateScene(request: SceneGenerationRequest): Promise<GenerationResult> {
        return this.request<GenerationResult>('/image/generate-scene', {
            method: 'POST',
            body: JSON.stringify({
                prompt: request.prompt,
                quality: request.quality ?? 'standard',
                timeOfDay: request.timeOfDay,
                weather: request.weather,
                style: request.style
            })
        });
    }

    /**
     * Forge a detailed prompt from entity data
     * Uses AI to create an optimized image generation prompt
     */
    async forgePrompt(request: ForgePromptRequest): Promise<ForgePromptResult> {
        return this.request<ForgePromptResult>('/text/forge-prompt', {
            method: 'POST',
            body: JSON.stringify({
                type: request.type,
                data: request.data
            })
        });
    }

    /**
     * Enhance/refine an existing prompt
     * Cost: 1 credit
     */
    async enhancePrompt(request: EnhancePromptRequest): Promise<ForgePromptResult> {
        return this.request<ForgePromptResult>('/text/enhance', {
            method: 'POST',
            body: JSON.stringify({
                prompt: request.prompt,
                type: request.type
            })
        });
    }

    /**
     * Generate generic image with specified model
     */
    async generateImage(request: {
        prompt: string;
        model?: string;
        aspectRatio?: string;
        style?: string;
    }): Promise<GenerationResult> {
        return this.request<GenerationResult>('/image/generate', {
            method: 'POST',
            body: JSON.stringify({
                prompt: request.prompt,
                model: request.model ?? 'flux-schnell',
                aspectRatio: request.aspectRatio ?? '1:1',
                style: request.style
            })
        });
    }
}

// Singleton instance
const generationClient = new GenerationClient();

export { GenerationClient, generationClient };

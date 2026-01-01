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
    TextureGenerationRequest,
    TextureGenerationResult,
    MeshGenerationRequest,
    MeshGenerationResult,
    APIError,
    GenerationJob,
    GenerationJobStatus,
    GenerationListResponse,
    GenerationHistoryItem,
    GenerationHistoryResponse,
    CreditTransaction,
    CreditHistoryResponse,
    CreditPricingResponse
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
        return this.request<ForgePromptResult>('/text/forge', {
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

    // ============================================================
    // Generation Job Management
    // ============================================================

    /**
     * Get status of a specific generation job
     */
    async getJobStatus(requestId: string): Promise<GenerationJob> {
        return this.request<GenerationJob>(`/generations/${requestId}/status`, {
            method: 'GET'
        });
    }

    /**
     * List all generation jobs
     */
    async listJobs(options?: {
        status?: GenerationJobStatus;
        limit?: number;
        offset?: number;
    }): Promise<GenerationListResponse> {
        const params = new URLSearchParams();
        if (options?.status) params.set('status', options.status);
        if (options?.limit) params.set('limit', options.limit.toString());
        if (options?.offset) params.set('offset', options.offset.toString());

        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request<GenerationListResponse>(`/generations/list${query}`, {
            method: 'GET'
        });
    }

    /**
     * Get active (in-progress) jobs
     */
    async getActiveJobs(): Promise<GenerationJob[]> {
        const response = await this.listJobs({ status: 'in_progress', limit: 50 });
        return response.generations;
    }

    /**
     * Poll a job until completion
     */
    async pollUntilComplete(
        requestId: string,
        options?: {
            interval?: number;
            maxAttempts?: number;
            onProgress?: (job: GenerationJob) => void;
        }
    ): Promise<GenerationJob> {
        const interval = options?.interval ?? 2000;
        const maxAttempts = options?.maxAttempts ?? 150; // 5 minutes at 2s intervals

        let attempts = 0;
        while (attempts < maxAttempts) {
            attempts++;
            const job = await this.getJobStatus(requestId);

            if (options?.onProgress) {
                options.onProgress(job);
            }

            if (job.status === 'completed' || job.status === 'failed') {
                return job;
            }

            await new Promise(resolve => setTimeout(resolve, interval));
        }

        throw new Error(`Job ${requestId} timed out after ${maxAttempts} attempts`);
    }

    // ============================================================
    // Generation History
    // ============================================================

    /**
     * Get generation history (media + text unified)
     */
    async getHistory(options?: {
        type?: 'media' | 'text' | 'all';
        limit?: number;
        offset?: number;
    }): Promise<GenerationHistoryResponse> {
        const params = new URLSearchParams();
        if (options?.type && options.type !== 'all') params.set('type', options.type);
        if (options?.limit) params.set('limit', options.limit.toString());
        if (options?.offset) params.set('offset', options.offset.toString());

        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request<GenerationHistoryResponse>(`/generations/history${query}`, {
            method: 'GET'
        });
    }

    // ============================================================
    // Credit Management
    // ============================================================

    /**
     * Get credit transaction history
     */
    async getCreditHistory(options?: {
        type?: 'grant' | 'spend' | 'refund' | 'all';
        limit?: number;
        offset?: number;
    }): Promise<CreditHistoryResponse> {
        const params = new URLSearchParams();
        if (options?.type && options.type !== 'all') params.set('type', options.type);
        if (options?.limit) params.set('limit', options.limit.toString());
        if (options?.offset) params.set('offset', options.offset.toString());

        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request<CreditHistoryResponse>(`/credits/history${query}`, {
            method: 'GET'
        });
    }

    /**
     * Get credit pricing for all endpoints
     */
    async getCreditPricing(): Promise<CreditPricingResponse> {
        return this.request<CreditPricingResponse>('/credits/pricing', {
            method: 'GET'
        });
    }
}

// Singleton instance
const generationClient = new GenerationClient();

export { GenerationClient, generationClient };

/**
 * Mesh Generation Client
 * AIGC module for generating 3D meshes from images for PlayCanvas
 */

import { PajamaDotTokenManager } from './token-manager';
import type {
    MeshGenerationRequest,
    MeshGenerationResult,
    GenerationResult,
    APIError
} from './types';

/**
 * Mesh Generation Client
 * Generates 3D meshes from images using AI (fal.ai Trellis)
 *
 * Note: Mesh generation is synchronous - the API blocks until completion
 * (typically 30-60 seconds). No polling needed.
 */
class MeshClient {

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
     * Generate a reference image for mesh generation
     * Cost: 8 credits
     *
     * @param prompt - Description of the 3D object to generate
     * @param style - Optional style modifier
     * @returns Generated image result
     */
    async generateReferenceImage(prompt: string, style?: string): Promise<GenerationResult> {
        const meshPrompt = this.buildMeshReferencePrompt(prompt);

        return this.request<GenerationResult>('/image/generate', {
            method: 'POST',
            body: JSON.stringify({
                prompt: meshPrompt,
                model: 'flux-schnell',
                aspectRatio: '1:1',
                style: style ?? 'clean 3D render'
            })
        });
    }

    /**
     * Generate 3D mesh from an image
     * Cost: 20 credits
     *
     * @param request - Mesh generation parameters
     * @returns Generated mesh result with GLB URL
     */
    async generateMesh(request: MeshGenerationRequest): Promise<MeshGenerationResult> {
        return this.request<MeshGenerationResult>('/mesh/generate', {
            method: 'POST',
            body: JSON.stringify({
                imageUrl: request.imageUrl,
                meshSimplify: request.meshSimplify ?? 0.9,
                textureResolution: request.textureResolution ?? 1024
            })
        });
    }

    /**
     * Generate 3D mesh from a text prompt (end-to-end)
     * Cost: 28 credits (8 for image + 20 for mesh)
     *
     * @param prompt - Description of the 3D object
     * @param options - Generation options
     * @param onProgress - Optional progress callback
     * @returns Generated mesh result
     */
    async generateMeshFromPrompt(
        prompt: string,
        options?: {
            style?: string;
            meshSimplify?: number;
            textureResolution?: number;
        },
        onProgress?: (stage: 'image' | 'mesh', progress: number) => void
    ): Promise<MeshGenerationResult & { referenceImageUrl: string }> {
        // Stage 1: Generate reference image
        onProgress?.('image', 0);
        const imageResult = await this.generateReferenceImage(prompt, options?.style);
        onProgress?.('image', 100);

        if (!imageResult.imageUrl) {
            throw new Error('Failed to generate reference image');
        }

        // Stage 2: Generate mesh from image
        onProgress?.('mesh', 0);
        const meshResult = await this.generateMesh({
            imageUrl: imageResult.imageUrl,
            meshSimplify: options?.meshSimplify,
            textureResolution: options?.textureResolution
        });
        onProgress?.('mesh', 100);

        return {
            ...meshResult,
            referenceImageUrl: imageResult.imageUrl,
            creditsCost: imageResult.creditsCost + meshResult.creditsCost
        };
    }

    // Note: Polling is not needed - mesh generation is synchronous
    // The /mesh/generate endpoint blocks until the mesh is ready (30-60 seconds)

    /**
     * Build optimized prompt for 3D mesh reference image
     */
    private buildMeshReferencePrompt(prompt: string): string {
        const parts: string[] = [
            prompt,
            'isolated object',
            'white background',
            'studio lighting',
            '3D render style',
            'centered composition',
            'no shadows on background',
            'product photography',
            'high detail'
        ];

        return parts.join(', ');
    }

    /**
     * Download mesh as Blob for PlayCanvas import
     *
     * @param meshUrl - URL of the generated GLB mesh
     * @returns Blob of the mesh file
     */
    async downloadMeshBlob(meshUrl: string): Promise<Blob> {
        const response = await fetch(meshUrl);
        if (!response.ok) {
            throw new Error(`Failed to download mesh: ${response.status}`);
        }
        return response.blob();
    }

    /**
     * Download texture from mesh result
     *
     * @param textureUrl - URL of the texture from mesh result
     * @returns Blob of the texture image
     */
    async downloadTextureBlob(textureUrl: string): Promise<Blob> {
        const response = await fetch(textureUrl);
        if (!response.ok) {
            throw new Error(`Failed to download texture: ${response.status}`);
        }
        return response.blob();
    }
}

// Singleton instance
const meshClient = new MeshClient();

export { MeshClient, meshClient };

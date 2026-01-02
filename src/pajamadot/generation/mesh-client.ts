/**
 * Mesh Generation Client
 * AIGC module for generating 3D meshes from images or text for PlayCanvas
 *
 * Supports two modes:
 * - Image-to-3D: Convert 2D images to 3D meshes (Trellis, 20 credits, ~30-60s)
 * - Text-to-3D: Generate 3D directly from text (Meshy v6, 30 credits, ~3-10 min)
 */

import { PajamaDotTokenManager } from './token-manager';
import type {
    MeshGenerationRequest,
    MeshGenerationResult,
    GenerationResult,
    GenerationJob,
    GenerationJobStatus,
    APIError
} from './types';

export type MeshGenerationMode = 'image_to_3d' | 'text_to_3d';

/**
 * Response from mesh generation API
 * Can be either:
 * - Async job (status: 'pending') - needs polling
 * - Completed result (has mesh.url)
 */
export interface MeshGenerationResponse extends Partial<MeshGenerationFullResult> {
    success: boolean;
    requestId: string;
    mode: MeshGenerationMode;
    status?: GenerationJobStatus;
    progress?: number;
    message?: string;
    creditsCost: number;
    creditsRemaining: number;
    error?: string;
}

export interface TextTo3DRequest {
    prompt: string;
    artStyle?: 'realistic' | 'sculpture';
    enablePbr?: boolean; // Generate PBR maps
    texturePrompt?: string;
    targetPolycount?: number; // 100-300000, default 30000
    topology?: 'quad' | 'triangle';
    seed?: number;
}

export interface ImageTo3DRequest {
    imageUrl: string;
    meshSimplify?: number; // 0.0-1.0
    textureResolution?: number; // default 1024
}

export interface MeshGenerationFullResult extends MeshGenerationResult {
    mode: MeshGenerationMode;
    thumbnail?: string;
    seed?: number;
    meshFormats?: {
        glb?: string;
        fbx?: string;
        obj?: string;
        usdz?: string;
    };
    pbrTextures?: {
        baseColor?: string;
        metallic?: string;
        normal?: string;
        roughness?: string;
    };
}

/**
 * Mesh Generation Client
 * Generates 3D meshes using AI
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
     * Generate 3D mesh from text prompt using Meshy v6
     * Cost: 30 credits, Time: 3-10 minutes
     *
     * NOTE: This is now an async operation. The response will have:
     * - status: 'pending' with requestId for long-running jobs
     * - Poll /status/:requestId to track progress
     *
     * @param request - Text-to-3D generation parameters
     * @param onProgress - Optional progress callback
     * @returns Response with requestId for job tracking (async) or completed result
     */
    async generateFromText(
        request: TextTo3DRequest,
        onProgress?: (progress: number, message: string) => void
    ): Promise<MeshGenerationResponse> {
        onProgress?.(0, 'Starting 3D generation...');

        const result = await this.request<MeshGenerationResponse>('/mesh/generate', {
            method: 'POST',
            body: JSON.stringify({
                mode: 'text_to_3d',
                prompt: request.prompt,
                artStyle: request.artStyle ?? 'realistic',
                enablePbr: request.enablePbr ?? false,
                texturePrompt: request.texturePrompt,
                targetPolycount: request.targetPolycount ?? 30000,
                topology: request.topology ?? 'triangle',
                seed: request.seed
            })
        });

        // Check if this is an async job (pending status)
        if (result.status === 'pending' || result.status === 'in_progress') {
            onProgress?.(result.progress ?? 0, result.message ?? 'Generation started...');
        } else {
            onProgress?.(100, 'Generation complete!');
        }

        return result;
    }

    /**
     * Generate 3D mesh from an image using Trellis
     * Cost: 20 credits, Time: ~30-60 seconds
     *
     * NOTE: This is now an async operation for longer-running jobs.
     *
     * @param request - Image-to-3D generation parameters
     * @param onProgress - Optional progress callback
     * @returns Response with requestId for job tracking (async) or completed result
     */
    async generateFromImage(
        request: ImageTo3DRequest,
        onProgress?: (progress: number, message: string) => void
    ): Promise<MeshGenerationResponse> {
        onProgress?.(0, 'Converting image to 3D...');

        const result = await this.request<MeshGenerationResponse>('/mesh/generate', {
            method: 'POST',
            body: JSON.stringify({
                mode: 'image_to_3d',
                imageUrl: request.imageUrl,
                meshSimplify: request.meshSimplify ?? 0.95,
                textureResolution: request.textureResolution ?? 1024
            })
        });

        // Check if this is an async job (pending status)
        if (result.status === 'pending' || result.status === 'in_progress') {
            onProgress?.(result.progress ?? 0, result.message ?? 'Generation started...');
        } else {
            onProgress?.(100, 'Generation complete!');
        }

        return result;
    }

    /**
     * Generate 3D mesh from an image (legacy method name)
     * @deprecated Use generateFromImage instead
     */
    async generateMesh(request: MeshGenerationRequest): Promise<MeshGenerationResult> {
        return this.generateFromImage({
            imageUrl: request.imageUrl,
            meshSimplify: request.meshSimplify,
            textureResolution: request.textureResolution
        });
    }

    /**
     * Generate reference image optimized for 3D mesh generation
     * Cost: 8 credits
     *
     * @param prompt - Description of the 3D object
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
     * Two-step workflow: Generate image, then convert to 3D
     * Cost: 28 credits (8 for image + 20 for mesh)
     * Time: ~1-2 minutes
     *
     * @param prompt - Description of the 3D object
     * @param options - Generation options
     * @param onProgress - Optional progress callback
     * @returns Generated mesh result with reference image
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

        // Extract URL from result
        const imageUrl = imageResult.images?.[0]?.url || imageResult.imageUrl;
        if (!imageUrl) {
            throw new Error('Failed to generate reference image');
        }

        // Stage 2: Generate mesh from image
        onProgress?.('mesh', 0);
        const meshResult = await this.generateFromImage({
            imageUrl: imageUrl,
            meshSimplify: options?.meshSimplify,
            textureResolution: options?.textureResolution
        });
        onProgress?.('mesh', 100);

        return {
            ...meshResult,
            referenceImageUrl: imageUrl,
            creditsCost: imageResult.creditsCost + meshResult.creditsCost
        };
    }

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

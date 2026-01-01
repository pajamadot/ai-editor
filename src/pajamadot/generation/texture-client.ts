/**
 * Texture Generation Client
 * AIGC module for generating seamless/tileable textures for PlayCanvas
 */

import { PajamaDotTokenManager } from './token-manager';
import type {
    TextureGenerationRequest,
    TextureGenerationResult,
    APIError
} from './types';

/**
 * Texture Generation Client
 * Generates seamless/tileable textures for 3D materials
 */
class TextureClient {
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
     * Generate a seamless/tileable texture
     * Cost: 8 credits (standard quality)
     *
     * @param request - Texture generation parameters
     * @returns Generated texture result with image URL
     */
    async generateTexture(request: TextureGenerationRequest): Promise<TextureGenerationResult> {
        return this.request<TextureGenerationResult>('/image/generate', {
            method: 'POST',
            body: JSON.stringify({
                prompt: this.buildTexturePrompt(request),
                model: 'flux-schnell',
                aspectRatio: '1:1', // Textures are typically square
                style: request.style
            })
        });
    }

    /**
     * Generate a tileset/sprite sheet texture
     * Cost: 15 credits
     *
     * @param request - Tileset generation parameters
     * @returns Generated tileset result with image URL
     */
    async generateTileset(request: {
        prompt: string;
        tileSize?: 32 | 64 | 128;
        gridSize?: '4x4' | '8x8' | '16x16';
        style?: string;
    }): Promise<TextureGenerationResult> {
        return this.request<TextureGenerationResult>('/image/generate-tileset', {
            method: 'POST',
            body: JSON.stringify({
                prompt: request.prompt,
                tileSize: request.tileSize ?? 64,
                gridSize: request.gridSize ?? '8x8',
                style: request.style
            })
        });
    }

    /**
     * Generate PBR texture maps (diffuse, normal, roughness)
     * Cost: 24 credits (8 per map × 3)
     *
     * @param request - Base texture parameters
     * @returns Array of generated texture maps
     */
    async generatePBRMaps(request: TextureGenerationRequest): Promise<{
        diffuse: TextureGenerationResult;
        normal: TextureGenerationResult;
        roughness: TextureGenerationResult;
        totalCost: number;
    }> {
        // Generate diffuse (base color) map
        const diffuse = await this.generateTexture({
            ...request,
            type: 'diffuse'
        });

        // Generate normal map
        const normal = await this.generateTexture({
            ...request,
            prompt: `${request.prompt}, normal map, purple-blue tones, surface detail`,
            type: 'normal'
        });

        // Generate roughness map
        const roughness = await this.generateTexture({
            ...request,
            prompt: `${request.prompt}, roughness map, grayscale, surface texture`,
            type: 'roughness'
        });

        return {
            diffuse,
            normal,
            roughness,
            totalCost: diffuse.creditsCost + normal.creditsCost + roughness.creditsCost
        };
    }

    /**
     * Build optimized prompt for texture generation
     */
    private buildTexturePrompt(request: TextureGenerationRequest): string {
        const parts: string[] = [request.prompt];

        // Add seamless/tileable modifiers
        if (request.seamless !== false) {
            parts.push('seamless texture', 'tileable', 'repeating pattern');
        }

        // Add resolution hints
        if (request.resolution) {
            parts.push(`${request.resolution}px resolution`, 'high detail');
        }

        // Add texture type modifiers
        switch (request.type) {
            case 'normal':
                parts.push('normal map', 'purple-blue color scheme', 'surface detail bump');
                break;
            case 'roughness':
                parts.push('roughness map', 'grayscale', 'surface roughness variation');
                break;
            case 'diffuse':
            default:
                parts.push('diffuse texture', 'base color');
                break;
        }

        // Add style if specified
        if (request.style) {
            parts.push(request.style);
        }

        return parts.join(', ');
    }

    /**
     * Download texture as Blob for PlayCanvas import
     *
     * @param imageUrl - URL of the generated texture
     * @returns Blob of the texture image
     */
    async downloadTextureBlob(imageUrl: string): Promise<Blob> {
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`Failed to download texture: ${response.status}`);
        }
        return response.blob();
    }
}

// Singleton instance
const textureClient = new TextureClient();

export { TextureClient, textureClient };

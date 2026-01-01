/**
 * Generation Types
 * Type definitions for PajamaDot AIGC generation API
 */

// API Response types
export interface GenerationResult {
    success: boolean;
    imageUrl?: string;
    assetId?: string;
    creditsCost: number;
    creditsRemaining: number;
    error?: string;
}

export interface CreditsBalance {
    balance: number;
    lifetimeGranted?: number;
    lifetimeSpent?: number;
}

export interface ForgePromptResult {
    prompt: string;
}

// Character generation request
export interface CharacterGenerationRequest {
    prompt: string;
    removeBackground?: boolean;  // default: true
    aspectRatio?: string;        // default: '1:1'
}

// Scene/location generation request
export interface SceneGenerationRequest {
    prompt: string;
    quality?: 'fast' | 'standard' | 'high';
    timeOfDay?: string;
    weather?: string;
    style?: string;
}

// Forge prompt request
export interface ForgePromptRequest {
    type: 'character' | 'location' | 'item';
    data: Record<string, unknown>;
}

// Enhance prompt request
export interface EnhancePromptRequest {
    prompt: string;
    type?: 'character' | 'location' | 'item';
}

// API Error response
export interface APIError {
    success: false;
    error: string;
    creditsCost?: number;
    currentBalance?: number;
    status?: number;
}

// Generation status for polling
export interface GenerationStatus {
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number;
    result?: GenerationResult;
    error?: string;
}

// Texture generation request
export interface TextureGenerationRequest {
    prompt: string;
    seamless?: boolean;      // default: true (tileable)
    resolution?: '512' | '1024' | '2048';  // default: 1024
    style?: string;          // e.g., "photorealistic", "stylized", "painted"
    type?: 'diffuse' | 'normal' | 'roughness' | 'all';  // default: diffuse
}

// Texture generation result
export interface TextureGenerationResult {
    success: boolean;
    imageUrl?: string;
    assetId?: string;
    creditsCost: number;
    creditsRemaining: number;
    error?: string;
}

// Mesh generation request
export interface MeshGenerationRequest {
    imageUrl: string;
    meshSimplify?: number;      // 0.0-1.0, default 0.9
    textureResolution?: number; // default 1024
}

// Mesh generation result
export interface MeshGenerationResult {
    success: boolean;
    mesh?: {
        url: string;
        format: 'glb';
        fileSize?: number;
    };
    texture?: {
        url: string;
        format: string;
        width?: number;
        height?: number;
    };
    creditsCost: number;
    creditsRemaining: number;
    error?: string;
}

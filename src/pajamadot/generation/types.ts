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

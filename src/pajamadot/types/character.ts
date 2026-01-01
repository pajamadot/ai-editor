/**
 * Character Types
 * Character definitions for story narrative
 */

export interface CharacterRelationship {
    characterId: string;
    type: string;           // e.g., 'friend', 'enemy', 'family', 'romantic'
    description: string;
}

/**
 * Visual attributes for AIGC character portrait generation
 */
export interface CharacterVisuals {
    pose: 'standing' | 'sitting' | 'action' | 'portrait';
    expression: 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'thoughtful';
    cameraAngle: 'front' | 'side' | 'three-quarter';
    costume: string;              // Free-form description
    style: 'anime' | 'realistic' | 'painted' | 'pixel' | 'comic';
}

/**
 * Personality profile using MBTI-style sliders
 */
export interface PersonalityProfile {
    mbtiSliders: {
        ei: number;  // 0-100: Introvert (0) to Extrovert (100)
        sn: number;  // 0-100: Sensing (0) to Intuition (100)
        tf: number;  // 0-100: Thinking (0) to Feeling (100)
        jp: number;  // 0-100: Judging (0) to Perceiving (100)
    };
    alignment?: string;  // D&D style alignment (e.g., 'lawful-good', 'chaotic-neutral')
}

/**
 * Default visual attributes
 */
export function getDefaultCharacterVisuals(): CharacterVisuals {
    return {
        pose: 'portrait',
        expression: 'neutral',
        cameraAngle: 'front',
        costume: '',
        style: 'anime'
    };
}

/**
 * Default personality profile
 */
export function getDefaultPersonalityProfile(): PersonalityProfile {
    return {
        mbtiSliders: {
            ei: 50,
            sn: 50,
            tf: 50,
            jp: 50
        }
    };
}

export interface StoryCharacterData {
    name: string;
    biography: string;
    age?: string;                    // Character age (string for flexibility)
    portraitAssetId?: number;       // PlayCanvas texture asset
    fullBodyAssetId?: number;       // PlayCanvas texture asset
    modelAssetId?: number;          // PlayCanvas model asset (for 3D)

    // Expression variants mapped to asset IDs
    expressionAssets: {
        [expression: string]: number;   // e.g., { happy: 123, sad: 124, angry: 125 }
    };

    // Character traits
    traits: string[];

    // Relationships with other characters
    relationships: CharacterRelationship[];

    // Voice settings
    voiceId?: string;               // For TTS or voice actor reference

    // AIGC generation attributes
    visuals?: CharacterVisuals;
    personality?: PersonalityProfile;
    generationPrompt?: string;      // Last used generation prompt

    // Additional metadata
    metadata: Record<string, unknown>;
}

// Default character data
export function getDefaultCharacterData(): StoryCharacterData {
    return {
        name: 'New Character',
        biography: '',
        expressionAssets: {},
        traits: [],
        relationships: [],
        visuals: getDefaultCharacterVisuals(),
        personality: getDefaultPersonalityProfile(),
        metadata: {}
    };
}

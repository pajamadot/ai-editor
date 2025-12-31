/**
 * Character Types
 * Character definitions for story narrative
 */

export interface CharacterRelationship {
    characterId: string;
    type: string;           // e.g., 'friend', 'enemy', 'family', 'romantic'
    description: string;
}

export interface StoryCharacterData {
    name: string;
    biography: string;
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
        metadata: {}
    };
}

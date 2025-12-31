/**
 * Location Types
 * Location/scene definitions for story narrative
 */

export interface StoryLocationData {
    name: string;
    description: string;

    // Visual assets
    backgroundAssetId?: number;     // PlayCanvas texture asset
    thumbnailAssetId?: number;      // Preview thumbnail

    // Audio
    ambientSoundId?: number;        // PlayCanvas audio asset
    musicAssetId?: number;          // Background music

    // Mood/atmosphere
    mood: string;                   // e.g., 'peaceful', 'tense', 'mysterious'

    // Connections to other locations
    connectedLocations: string[];   // Location asset IDs

    // Items found at this location
    items: string[];                // Item asset IDs

    // NPCs at this location
    npcs: string[];                 // Character asset IDs

    // 3D scene reference (if using 3D)
    sceneAssetId?: number;          // PlayCanvas scene asset

    // Entity tags for this location
    entityTags?: string[];          // Tags to activate in PlayCanvas scene

    // Additional metadata
    metadata: Record<string, unknown>;
}

// Default location data
export function getDefaultLocationData(): StoryLocationData {
    return {
        name: 'New Location',
        description: '',
        mood: 'neutral',
        connectedLocations: [],
        items: [],
        npcs: [],
        metadata: {}
    };
}

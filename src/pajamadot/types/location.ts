/**
 * Location Types
 * Location/scene definitions for story narrative
 */

/**
 * Visual attributes for AIGC location/scene generation
 */
export interface LocationVisuals {
    timeOfDay: 'morning' | 'noon' | 'sunset' | 'night' | 'dawn' | 'dusk';
    weather: 'clear' | 'cloudy' | 'rain' | 'snow' | 'fog' | 'storm';
    mood: 'peaceful' | 'tense' | 'mysterious' | 'romantic' | 'melancholic' | 'cheerful';
    locationType: 'indoor' | 'outdoor' | 'urban' | 'nature' | 'fantasy' | 'sci-fi';
    style: 'anime' | 'realistic' | 'painted' | 'pixel' | 'watercolor';
}

/**
 * Default visual attributes for location
 */
export function getDefaultLocationVisuals(): LocationVisuals {
    return {
        timeOfDay: 'noon',
        weather: 'clear',
        mood: 'peaceful',
        locationType: 'outdoor',
        style: 'anime'
    };
}

export interface StoryLocationData {
    name: string;
    description: string;

    // Visual assets
    backgroundAssetId?: number;     // PlayCanvas texture asset
    thumbnailAssetId?: number;      // Preview thumbnail

    // Audio
    ambientSoundId?: number;        // PlayCanvas audio asset
    musicAssetId?: number;          // Background music

    // Mood/atmosphere (legacy - use visuals.mood instead)
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

    // AIGC generation attributes
    visuals?: LocationVisuals;
    generationPrompt?: string;      // Last used generation prompt

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
        visuals: getDefaultLocationVisuals(),
        metadata: {}
    };
}

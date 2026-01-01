/**
 * PajamaDot Story Constants
 */

// Node type numeric IDs for pcui-graph
// Note: Conditions are on choices within scenes, not separate nodes
export const STORY_NODE_TYPES = {
    SCENE: 0,
    START: 1,
    END: 2
} as const;

// Node type string values
export const NODE_TYPE_NAMES = {
    [STORY_NODE_TYPES.SCENE]: 'scene',
    [STORY_NODE_TYPES.START]: 'start',
    [STORY_NODE_TYPES.END]: 'end'
} as const;

// Edge type numeric IDs for pcui-graph
export const STORY_EDGE_TYPES = {
    FLOW: 0,
    CHOICE: 1
} as const;

// Node colors
export const NODE_COLORS = {
    SCENE: {
        fill: 'rgba(59, 130, 246, 0.85)',   // Blue
        stroke: '#1d4ed8'
    },
    START: {
        fill: 'rgba(34, 197, 94, 0.85)',    // Green
        stroke: '#15803d'
    },
    END: {
        fill: 'rgba(239, 68, 68, 0.85)',    // Red
        stroke: '#b91c1c'
    }
} as const;

// Edge colors
export const EDGE_COLORS = {
    FLOW: '#6b7280',        // Gray
    CHOICE: '#f59e0b'       // Amber
} as const;

// Custom asset type identifiers (stored in meta.pajamadot_type)
export const PAJAMADOT_ASSET_TYPES = {
    STORY_GRAPH: 'storygraph',
    CHARACTER: 'storycharacter',
    LOCATION: 'storylocation',
    ITEM: 'storyitem'
} as const;

// Default story graph version
export const STORY_GRAPH_VERSION = 1;

// Character positions
export const CHARACTER_POSITIONS = ['left', 'center', 'right'] as const;

// Scene effects
export const SCENE_EFFECTS = [
    'fadeIn',
    'fadeOut',
    'shake',
    'flash'
] as const;

// Entity trigger actions
export const ENTITY_TRIGGER_ACTIONS = [
    'show',
    'hide',
    'animate',
    'play'
] as const;

// Ending types
export const ENDING_TYPES = [
    'good',
    'bad',
    'neutral'
] as const;

// Item types
export const ITEM_TYPES = [
    'key',
    'weapon',
    'consumable',
    'quest',
    'misc'
] as const;

// Mood types for locations
export const MOOD_TYPES = [
    'peaceful',
    'tense',
    'mysterious',
    'romantic',
    'scary',
    'happy',
    'sad',
    'neutral'
] as const;

// Character relationship types
export const RELATIONSHIP_TYPES = [
    'friend',
    'enemy',
    'family',
    'romantic',
    'rival',
    'mentor',
    'acquaintance',
    'neutral'
] as const;

// Story events (for PlayCanvas script integration)
export const STORY_EVENTS = {
    SCENE_ENTER: 'story:scene:enter',
    SCENE_EXIT: 'story:scene:exit',
    DIALOGUE_SHOW: 'story:dialogue:show',
    DIALOGUE_HIDE: 'story:dialogue:hide',
    CHOICE_PRESENT: 'story:choice:present',
    CHOICE_SELECTED: 'story:choice:selected',
    CHARACTER_ENTER: 'story:character:enter',
    CHARACTER_EXIT: 'story:character:exit',
    EFFECT_PLAY: 'story:effect:play',
    STORY_START: 'story:start',
    STORY_END: 'story:end'
} as const;

// =====================
// AIGC Generation Options
// =====================

// Character poses for generation
export const CHARACTER_POSES = [
    { v: 'portrait', t: 'Portrait (Head)' },
    { v: 'standing', t: 'Standing (Full Body)' },
    { v: 'sitting', t: 'Sitting' },
    { v: 'action', t: 'Action Pose' }
] as const;

// Character expressions
export const CHARACTER_EXPRESSIONS = [
    { v: 'neutral', t: 'Neutral' },
    { v: 'happy', t: 'Happy' },
    { v: 'sad', t: 'Sad' },
    { v: 'angry', t: 'Angry' },
    { v: 'surprised', t: 'Surprised' },
    { v: 'thoughtful', t: 'Thoughtful' }
] as const;

// Camera angles
export const CAMERA_ANGLES = [
    { v: 'front', t: 'Front View' },
    { v: 'side', t: 'Side Profile' },
    { v: 'three-quarter', t: 'Three-Quarter' }
] as const;

// Art styles for character and location
export const ART_STYLES = [
    { v: 'anime', t: 'Anime' },
    { v: 'realistic', t: 'Realistic' },
    { v: 'painted', t: 'Painted' },
    { v: 'pixel', t: 'Pixel Art' },
    { v: 'comic', t: 'Comic' },
    { v: 'watercolor', t: 'Watercolor' }
] as const;

// Time of day options
export const TIME_OF_DAY = [
    { v: 'dawn', t: 'Dawn' },
    { v: 'morning', t: 'Morning' },
    { v: 'noon', t: 'Noon' },
    { v: 'sunset', t: 'Sunset' },
    { v: 'dusk', t: 'Dusk' },
    { v: 'night', t: 'Night' }
] as const;

// Weather options
export const WEATHER_OPTIONS = [
    { v: 'clear', t: 'Clear' },
    { v: 'cloudy', t: 'Cloudy' },
    { v: 'rain', t: 'Rain' },
    { v: 'snow', t: 'Snow' },
    { v: 'fog', t: 'Fog' },
    { v: 'storm', t: 'Storm' }
] as const;

// Location types
export const LOCATION_TYPES = [
    { v: 'indoor', t: 'Indoor' },
    { v: 'outdoor', t: 'Outdoor' },
    { v: 'urban', t: 'Urban' },
    { v: 'nature', t: 'Nature' },
    { v: 'fantasy', t: 'Fantasy' },
    { v: 'sci-fi', t: 'Sci-Fi' }
] as const;

// Scene moods for generation
export const SCENE_MOODS = [
    { v: 'peaceful', t: 'Peaceful' },
    { v: 'tense', t: 'Tense' },
    { v: 'mysterious', t: 'Mysterious' },
    { v: 'romantic', t: 'Romantic' },
    { v: 'melancholic', t: 'Melancholic' },
    { v: 'cheerful', t: 'Cheerful' }
] as const;

// D&D Alignments
export const ALIGNMENTS = [
    { v: 'lawful-good', t: 'Lawful Good' },
    { v: 'neutral-good', t: 'Neutral Good' },
    { v: 'chaotic-good', t: 'Chaotic Good' },
    { v: 'lawful-neutral', t: 'Lawful Neutral' },
    { v: 'true-neutral', t: 'True Neutral' },
    { v: 'chaotic-neutral', t: 'Chaotic Neutral' },
    { v: 'lawful-evil', t: 'Lawful Evil' },
    { v: 'neutral-evil', t: 'Neutral Evil' },
    { v: 'chaotic-evil', t: 'Chaotic Evil' }
] as const;

// Generation quality options
export const GENERATION_QUALITY = [
    { v: 'fast', t: 'Fast (8 credits)' },
    { v: 'standard', t: 'Standard (10 credits)' },
    { v: 'high', t: 'High (15 credits)' }
] as const;

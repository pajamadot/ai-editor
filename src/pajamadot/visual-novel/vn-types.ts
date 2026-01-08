/**
 * Visual Novel Types
 * Core types for the PlayCanvas Visual Novel System
 */

import type { StoryGraphData, SceneNode, StoryNode, Dialogue, Choice } from '../types/story-graph';
import type { StoryCharacterData } from '../types/character';
import type { StoryLocationData } from '../types/location';

// ============================================================================
// Runtime State Types
// ============================================================================

/**
 * Current state of the visual novel runtime
 */
export interface VNRuntimeState {
    /** Current node ID */
    currentNodeId: string;

    /** Current dialogue index within the node */
    dialogueIndex: number;

    /** Whether waiting for player input */
    waitingForInput: boolean;

    /** Whether showing choices */
    showingChoices: boolean;

    /** Game variables for conditions */
    variables: Record<string, any>;

    /** Characters currently visible on screen */
    visibleCharacters: VNCharacterState[];

    /** Current background */
    currentBackground: string | null;

    /** Current BGM */
    currentBGM: string | null;

    /** History of dialogues for backlog */
    history: VNHistoryEntry[];

    /** Choices made (for analytics/achievements) */
    choicesMade: { nodeId: string; choiceId: string; timestamp: number }[];

    /** Total playtime in seconds */
    playtime: number;

    /** Is the game paused */
    isPaused: boolean;

    /** Auto-play mode */
    autoPlay: boolean;

    /** Skip mode */
    skipMode: boolean;

    /** Text speed (0-1) */
    textSpeed: number;
}

/**
 * Character display state
 */
export interface VNCharacterState {
    characterId: string;
    position: 'left' | 'center' | 'right' | 'far-left' | 'far-right';
    expression: string;
    scale: number;
    alpha: number;
    offsetX: number;
    offsetY: number;
    highlighted: boolean;
}

/**
 * History entry for dialogue backlog
 */
export interface VNHistoryEntry {
    nodeId: string;
    dialogueId: string;
    speakerName: string | null;
    text: string;
    timestamp: number;
}

// ============================================================================
// Save/Load Types
// ============================================================================

/**
 * Save data structure
 */
export interface VNSaveData {
    /** Save slot ID */
    slotId: number;

    /** Save name/label */
    label: string;

    /** Screenshot thumbnail (base64) */
    thumbnail?: string;

    /** Story identifier */
    storyId: string;

    /** Runtime state snapshot */
    state: VNRuntimeState;

    /** Creation timestamp */
    createdAt: number;

    /** Last modified timestamp */
    updatedAt: number;

    /** Play session count */
    sessionCount: number;
}

/**
 * Global save data (persists across saves)
 */
export interface VNGlobalData {
    /** Story completion flags */
    completedEndings: string[];

    /** Unlocked CG gallery items */
    unlockedCGs: string[];

    /** Unlocked music tracks */
    unlockedMusic: string[];

    /** Achievement flags */
    achievements: string[];

    /** Total playtime across all saves */
    totalPlaytime: number;

    /** Settings */
    settings: VNSettings;
}

// ============================================================================
// Settings Types
// ============================================================================

/**
 * Visual novel settings
 */
export interface VNSettings {
    /** Master volume (0-1) */
    masterVolume: number;

    /** BGM volume (0-1) */
    bgmVolume: number;

    /** SFX volume (0-1) */
    sfxVolume: number;

    /** Voice volume (0-1) */
    voiceVolume: number;

    /** Text display speed (0-1, 1 = instant) */
    textSpeed: number;

    /** Auto-play delay in seconds */
    autoPlayDelay: number;

    /** Skip unread text */
    skipUnread: boolean;

    /** Show text window */
    showTextWindow: boolean;

    /** UI scale (0.5-2) */
    uiScale: number;

    /** Fullscreen mode */
    fullscreen: boolean;

    /** Language */
    language: string;
}

/**
 * Default settings
 */
export function getDefaultVNSettings(): VNSettings {
    return {
        masterVolume: 0.8,
        bgmVolume: 0.7,
        sfxVolume: 0.8,
        voiceVolume: 1.0,
        textSpeed: 0.5,
        autoPlayDelay: 2.0,
        skipUnread: false,
        showTextWindow: true,
        uiScale: 1.0,
        fullscreen: false,
        language: 'en'
    };
}

// ============================================================================
// UI Configuration Types
// ============================================================================

/**
 * Dialogue box configuration
 */
export interface DialogueBoxConfig {
    /** Position on screen */
    position: 'bottom' | 'top' | 'center' | 'full';

    /** Box style */
    style: 'classic' | 'modern' | 'minimal' | 'adv' | 'nvl';

    /** Background color/image */
    background: string;

    /** Background opacity */
    opacity: number;

    /** Padding */
    padding: { top: number; right: number; bottom: number; left: number };

    /** Name box position */
    nameBoxPosition: 'inside' | 'outside-left' | 'outside-center';

    /** Font settings */
    font: {
        family: string;
        size: number;
        color: string;
        lineHeight: number;
    };

    /** Name font settings */
    nameFont: {
        family: string;
        size: number;
        color: string;
    };

    /** Show continue indicator */
    showContinueIndicator: boolean;

    /** Continue indicator animation */
    continueIndicatorType: 'bounce' | 'pulse' | 'blink' | 'arrow';
}

/**
 * Character sprite configuration
 */
export interface CharacterSpriteConfig {
    /** Base scale */
    baseScale: number;

    /** Position presets */
    positions: {
        'far-left': { x: number; y: number };
        'left': { x: number; y: number };
        'center': { x: number; y: number };
        'right': { x: number; y: number };
        'far-right': { x: number; y: number };
    };

    /** Highlight effect (dim non-speaking characters) */
    highlightSpeaker: boolean;

    /** Dim amount for non-speakers (0-1) */
    dimAmount: number;

    /** Entrance animation */
    entranceAnimation: 'none' | 'fade' | 'slide' | 'bounce';

    /** Exit animation */
    exitAnimation: 'none' | 'fade' | 'slide';

    /** Speaking animation */
    speakingAnimation: 'none' | 'bounce' | 'shake';
}

/**
 * Choice button configuration
 */
export interface ChoiceConfig {
    /** Layout style */
    layout: 'vertical' | 'horizontal' | 'grid';

    /** Position */
    position: 'center' | 'right' | 'bottom';

    /** Button style */
    buttonStyle: {
        background: string;
        hoverBackground: string;
        textColor: string;
        hoverTextColor: string;
        borderRadius: number;
        padding: { x: number; y: number };
    };

    /** Animation */
    animation: 'none' | 'fade' | 'slide' | 'scale';

    /** Show after text completes */
    showAfterText: boolean;
}

/**
 * Transition effect types
 */
export type TransitionType =
    | 'none'
    | 'fade'
    | 'crossfade'
    | 'dissolve'
    | 'slide-left'
    | 'slide-right'
    | 'slide-up'
    | 'slide-down'
    | 'zoom-in'
    | 'zoom-out'
    | 'blur'
    | 'pixelate'
    | 'flash'
    | 'shake';

/**
 * Transition configuration
 */
export interface TransitionConfig {
    type: TransitionType;
    duration: number;
    easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
    params?: Record<string, any>;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * VN runtime events
 */
export type VNEventType =
    | 'dialogue:start'
    | 'dialogue:complete'
    | 'dialogue:skip'
    | 'choice:show'
    | 'choice:select'
    | 'character:enter'
    | 'character:exit'
    | 'character:expression'
    | 'background:change'
    | 'bgm:play'
    | 'bgm:stop'
    | 'sfx:play'
    | 'voice:play'
    | 'transition:start'
    | 'transition:complete'
    | 'scene:enter'
    | 'scene:exit'
    | 'ending:reach'
    | 'save'
    | 'load'
    | 'pause'
    | 'resume';

/**
 * VN event payload
 */
export interface VNEvent {
    type: VNEventType;
    timestamp: number;
    data: any;
}

/**
 * Event listener type
 */
export type VNEventListener = (event: VNEvent) => void;

// ============================================================================
// Asset Reference Types
// ============================================================================

/**
 * Asset reference with fallback
 */
export interface VNAssetRef {
    /** PlayCanvas asset ID */
    assetId?: number;

    /** Asset URL (fallback or external) */
    url?: string;

    /** Asset type */
    type: 'texture' | 'audio' | 'model' | 'json';
}

/**
 * Character asset bundle
 */
export interface VNCharacterAssets {
    /** Character ID */
    characterId: string;

    /** Character data */
    data: StoryCharacterData;

    /** Expression textures */
    expressions: Record<string, VNAssetRef>;

    /** Voice audio clips */
    voiceClips?: Record<string, VNAssetRef>;
}

/**
 * Location asset bundle
 */
export interface VNLocationAssets {
    /** Location ID */
    locationId: string;

    /** Location data */
    data: StoryLocationData;

    /** Background texture */
    background: VNAssetRef;

    /** Ambient sound */
    ambientSound?: VNAssetRef;

    /** Background music */
    music?: VNAssetRef;
}

// ============================================================================
// Command Types (for scripting)
// ============================================================================

/**
 * VN command types for scripting beyond the graph
 */
export type VNCommandType =
    | 'say'           // Display dialogue
    | 'narrator'      // Narration (no speaker)
    | 'show'          // Show character
    | 'hide'          // Hide character
    | 'move'          // Move character
    | 'expression'    // Change expression
    | 'bg'            // Change background
    | 'bgm'           // Play BGM
    | 'sfx'           // Play SFX
    | 'voice'         // Play voice
    | 'wait'          // Wait for time
    | 'transition'    // Screen transition
    | 'shake'         // Screen shake
    | 'flash'         // Screen flash
    | 'choice'        // Show choices
    | 'jump'          // Jump to node
    | 'set'           // Set variable
    | 'if'            // Conditional
    | 'call'          // Call subroutine
    | 'return'        // Return from subroutine
    | 'effect'        // Custom effect
    | 'entity';       // Trigger PlayCanvas entity

/**
 * VN command
 */
export interface VNCommand {
    type: VNCommandType;
    params: Record<string, any>;
    async?: boolean;
}

// ============================================================================
// Default Configurations
// ============================================================================

export function getDefaultDialogueBoxConfig(): DialogueBoxConfig {
    return {
        position: 'bottom',
        style: 'modern',
        background: 'rgba(0, 0, 0, 0.8)',
        opacity: 0.9,
        padding: { top: 20, right: 30, bottom: 20, left: 30 },
        nameBoxPosition: 'outside-left',
        font: {
            family: 'sans-serif',
            size: 24,
            color: '#ffffff',
            lineHeight: 1.6
        },
        nameFont: {
            family: 'sans-serif',
            size: 20,
            color: '#ffcc00'
        },
        showContinueIndicator: true,
        continueIndicatorType: 'bounce'
    };
}

export function getDefaultCharacterSpriteConfig(): CharacterSpriteConfig {
    return {
        baseScale: 1.0,
        positions: {
            'far-left': { x: 0.1, y: 0.5 },
            'left': { x: 0.25, y: 0.5 },
            'center': { x: 0.5, y: 0.5 },
            'right': { x: 0.75, y: 0.5 },
            'far-right': { x: 0.9, y: 0.5 }
        },
        highlightSpeaker: true,
        dimAmount: 0.5,
        entranceAnimation: 'fade',
        exitAnimation: 'fade',
        speakingAnimation: 'none'
    };
}

export function getDefaultChoiceConfig(): ChoiceConfig {
    return {
        layout: 'vertical',
        position: 'center',
        buttonStyle: {
            background: 'rgba(40, 40, 60, 0.9)',
            hoverBackground: 'rgba(80, 80, 120, 0.95)',
            textColor: '#ffffff',
            hoverTextColor: '#ffcc00',
            borderRadius: 8,
            padding: { x: 40, y: 15 }
        },
        animation: 'fade',
        showAfterText: true
    };
}

export function getDefaultRuntimeState(): VNRuntimeState {
    return {
        currentNodeId: '',
        dialogueIndex: 0,
        waitingForInput: false,
        showingChoices: false,
        variables: {},
        visibleCharacters: [],
        currentBackground: null,
        currentBGM: null,
        history: [],
        choicesMade: [],
        playtime: 0,
        isPaused: false,
        autoPlay: false,
        skipMode: false,
        textSpeed: 0.5
    };
}

/**
 * PajamaDot Visual Novel System
 * A complete visual novel engine for PlayCanvas
 *
 * Features:
 * - Story runtime with graph-based navigation
 * - Rich UI system (dialogue, characters, choices)
 * - Save/load with multiple slots
 * - Transition effects
 * - AIGC integration for asset generation
 * - Editor panel for authoring
 */

console.log('[PajamaDot] Visual Novel module initializing...');

// Types
export * from './vn-types';

// Core runtime
export { VNRuntime, vnRuntime } from './vn-runtime';

// UI management
export { VNUIManager, vnUIManager } from './vn-ui-manager';

// Save/load system
export { VNSaveManager, vnSaveManager } from './vn-save-manager';
export type { VNSaveManagerConfig, SaveSlotInfo } from './vn-save-manager';

// Transition effects
export { VNTransitionManager, vnTransitionManager } from './vn-transitions';

// Main controller
export { VNController, vnController } from './vn-controller';
export type { VNControllerConfig, VNAssetLoaders } from './vn-controller';

// AIGC integration
export { VNAIGCIntegration, vnAIGC } from './vn-aigc-integration';
export type {
    VNExpression,
    CharacterPortraitRequest,
    BackgroundRequest,
    CGRequest,
    VoiceRequest,
    BGMRequest,
    SFXRequest,
    GenerationResult,
    BatchGenerationResult
} from './vn-aigc-integration';

// Audio management
export { VNAudioManager, vnAudioManager } from './vn-audio-manager';
export type { AudioChannel, VNAudioState, AudioPlayOptions, BGMTrack } from './vn-audio-manager';

// Gallery system
export { VNGallery, vnGallery } from './vn-gallery';
export type {
    CGEntry,
    MusicEntry,
    SceneEntry,
    AchievementEntry,
    GalleryConfig
} from './vn-gallery';

// Settings panel
export { VNSettingsPanel, vnSettingsPanel } from './vn-settings-panel';
export type { SettingsChangeCallback } from './vn-settings-panel';

// Backlog/history viewer
export { VNBacklog, vnBacklog, getDefaultBacklogConfig } from './vn-backlog';
export type { BacklogEntry, BacklogConfig } from './vn-backlog';

// Editor panel (only in editor context)
export { VNEditorPanel, vnEditorPanel } from './vn-editor-panel';

console.log('[PajamaDot] Visual Novel module loaded successfully');

/**
 * PajamaDot Generation Module
 * AIGC generation clients and utilities for PlayCanvas Editor
 */

console.log('[PajamaDot] Generation module initializing...');

// Types
export * from './types';

// Token management
export * from './token-manager';

// Generation clients
export * from './generation-client';
export * from './texture-client';
export * from './mesh-client';
export * from './video-client';
export * from './audio-client';
export * from './music-client';

// Image editing (inpainting, style transfer, etc.)
export * from './image-editor-client';

// Batch generation
export * from './batch-generator';

// Presets management
export * from './presets-manager';

// Asset import utilities
export * from './asset-importer';

// Jobs manager (tracks active generation jobs)
export * from './jobs-manager';

// Token settings picker (registers editor methods)
// Has internal checks for editor availability
import './token-settings';

console.log('[PajamaDot] Generation module loaded successfully');

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

// Asset import utilities
export * from './asset-importer';

// Token settings picker (registers editor methods)
// Has internal checks for editor availability
import './token-settings';

console.log('[PajamaDot] Generation module loaded successfully');

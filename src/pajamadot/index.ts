/**
 * PajamaDot Story Extensions for PlayCanvas Editor
 *
 * This module provides story narrative management capabilities
 * with AI-assisted authoring support via MCP-compatible APIs.
 *
 * All code is isolated in src/pajamadot/ for easy upstream merging.
 */

// Types
export * from './types';

// Constants
export * from './constants';

// Utilities
export * from './utils';

// YAML data management
import './yaml-data-manager';

// Asset creation (Phase 2)
import './assets';

// Graph view (Phase 3)
export * from './graph';

// Inspector panels (Phase 4)
import './inspector';

// API layer (Phase 5)
import './api';

// Layout panels (Phase 6)
import './panels';

// Fullscreen editor (Phase 7)
import './fullscreen';

// Entity integration (Phase 8)
import './entity';

// AIGC Generation (Phase 9)
import './generation';
export * from './generation';

// Visual Novel System (Phase 10)
export * from './visual-novel';

// Asset Browser Integration (Phase 12) - Context menus, overlays, filters
import './browser';

// Toolbar Integration (Phase 13) - AIGC button in asset panel
import './toolbar/aigc-button';

// Inspector integration (must be last - overrides assets:edit after everything is loaded)
import './inspector/inspector-integration';

console.log('[PajamaDot] Story extensions loaded');

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

// Asset Browser Integration (Phase 10) - Context menus, overlays, filters
import './browser';

// Inspector integration (must be last - overrides assets:edit after everything is loaded)
import './inspector/inspector-integration';

console.log('[PajamaDot] Story extensions loaded');

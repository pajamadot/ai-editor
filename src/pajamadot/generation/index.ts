/**
 * PajamaDot Generation Module
 * AIGC generation client and token management
 */

export * from './types';
export * from './token-manager';
export * from './generation-client';

// Token settings picker (registers editor methods)
import './token-settings';

console.log('[PajamaDot] Generation module loaded');

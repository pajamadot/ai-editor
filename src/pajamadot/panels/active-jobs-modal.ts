/**
 * Active Jobs Modal
 * Redirects to the Jobs tab in the Asset Generation Modal
 *
 * This module exists for backwards compatibility - the Active Jobs UI
 * is now integrated into the main AIGC modal as a tab.
 */

declare const editor: any;

/**
 * Show the active jobs panel (via AIGC modal jobs tab)
 */
function showActiveJobsModal(): void {
    editor.call('picker:pajamadot:assetgen', 'jobs');
}

/**
 * Toggle the active jobs panel
 */
function toggleActiveJobsModal(): void {
    editor.call('picker:pajamadot:assetgen', 'jobs');
}

// Note: The picker:pajamadot:activejobs method is registered in asset-generation-modal.ts
// This file just exports the helper functions for programmatic access

export { showActiveJobsModal, toggleActiveJobsModal };

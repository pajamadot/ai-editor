/**
 * Texture Generation Panel
 * Redirects to the Asset Generation Modal with texture tab selected
 */

declare const editor: any;

/**
 * Initialize texture generation panel methods
 * These methods now redirect to the modal-based approach
 */
function initTextureGenerationPanel(): void {
    // Safe method registration
    const safeMethod = (name: string, fn: (...args: any[]) => any) => {
        try {
            editor.method(name, fn);
        } catch (e) {
            // Method already registered, ignore
        }
    };

    // All texture panel methods now open the asset generation modal with texture tab
    safeMethod('pajamadot:panel:texture:show', () => {
        // Open asset generation modal - it defaults to texture tab
        editor.call('picker:pajamadot:assetgen');
    });

    safeMethod('pajamadot:panel:texture:hide', () => {
        // No-op for modal - user closes it manually
    });

    safeMethod('pajamadot:panel:texture:toggle', () => {
        // Open asset generation modal
        editor.call('picker:pajamadot:assetgen');
    });

    console.log('[PajamaDot] Texture generation panel methods registered (modal mode)');
}

// Initialize on editor load
editor.once('load', () => {
    setTimeout(() => {
        initTextureGenerationPanel();
    }, 600);
});

export { initTextureGenerationPanel };

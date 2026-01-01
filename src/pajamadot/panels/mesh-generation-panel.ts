/**
 * Mesh Generation Panel
 * Redirects to the Asset Generation Modal with mesh tab selected
 */

declare const editor: any;

/**
 * Initialize mesh generation panel methods
 * These methods now redirect to the modal-based approach
 */
function initMeshGenerationPanel(): void {
    // Safe method registration
    const safeMethod = (name: string, fn: (...args: any[]) => any) => {
        try {
            editor.method(name, fn);
        } catch (e) {
            // Method already registered, ignore
        }
    };

    // All mesh panel methods now open the asset generation modal with mesh tab
    safeMethod('pajamadot:panel:mesh:show', () => {
        // Open asset generation modal with mesh tab
        editor.call('pajamadot:generate:mesh');
    });

    safeMethod('pajamadot:panel:mesh:hide', () => {
        // No-op for modal - user closes it manually
    });

    safeMethod('pajamadot:panel:mesh:toggle', () => {
        // Open asset generation modal with mesh tab
        editor.call('pajamadot:generate:mesh');
    });

    console.log('[PajamaDot] Mesh generation panel methods registered (modal mode)');
}

// Initialize on editor load
editor.once('load', () => {
    setTimeout(() => {
        initMeshGenerationPanel();
    }, 600);
});

export { initMeshGenerationPanel };

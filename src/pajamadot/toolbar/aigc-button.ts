/**
 * AIGC Asset Browser Integration
 * Uses the Editor API to add AI generation to:
 * 1. The Create menu (+ button)
 * 2. The right-click context menu
 */

import { PajamaDotTokenManager } from '../generation/token-manager';

declare const editor: any;

/**
 * Initialize AIGC integration with asset browser
 * Uses proper Editor API instead of DOM manipulation
 */
function initAIGCAssetBrowserIntegration(): void {
    // Add to Create menu (+ button)
    addToCreateMenu();

    // Add to right-click context menu
    addToContextMenu();

    console.log('[PajamaDot] AIGC asset browser integration initialized');
}

/**
 * Add AIGC options to the Create menu (+ button)
 */
function addToCreateMenu(): void {
    // Add AI Generate submenu to Create menu
    editor.call('assets:contextmenu:addcreate', {
        text: 'AI Generate',
        icon: 'E195', // Magic wand icon
        items: [
            {
                text: 'Image / Texture',
                icon: 'E159',
                onSelect: () => {
                    if (!checkToken()) return;
                    editor.call('picker:pajamadot:assetgen', 'image');
                }
            },
            {
                text: '3D Model',
                icon: 'E207',
                onSelect: () => {
                    if (!checkToken()) return;
                    editor.call('picker:pajamadot:assetgen', 'mesh');
                }
            },
            {
                text: 'Character Portrait',
                icon: 'E192',
                onSelect: () => {
                    if (!checkToken()) return;
                    editor.call('assets:create:storycharacter');
                }
            },
            {
                text: 'Scene Background',
                icon: 'E201',
                onSelect: () => {
                    if (!checkToken()) return;
                    editor.call('assets:create:storylocation');
                }
            },
            {
                text: 'Asset Generator...',
                icon: 'E195',
                onSelect: () => {
                    if (!checkToken()) return;
                    editor.call('picker:pajamadot:assetgen');
                }
            }
        ]
    });
}

/**
 * Add AIGC options to right-click context menu
 */
function addToContextMenu(): void {
    // Add AI Generate submenu based on asset type
    editor.call('assets:contextmenu:add', {
        text: 'AI Generate',
        icon: 'E195',
        onIsVisible: (asset) => {
            // Show for texture, material, model, image assets
            if (!asset) return true; // Show in empty area
            const type = asset.get('type');
            return ['texture', 'material', 'model', 'container', 'folder'].includes(type);
        },
        items: [
            {
                text: 'Generate Variant',
                icon: 'E249', // Refresh/variant icon
                onIsVisible: (asset) => {
                    return asset && ['texture', 'material'].includes(asset.get('type'));
                },
                onSelect: (asset) => {
                    if (!checkToken()) return;
                    // Open generator with reference to this asset
                    editor.call('picker:pajamadot:assetgen', 'image');
                }
            },
            {
                text: 'Generate 3D from Image',
                icon: 'E207',
                onIsVisible: (asset) => {
                    if (!asset) return false;
                    const type = asset.get('type');
                    return type === 'texture';
                },
                onSelect: (asset) => {
                    if (!checkToken()) return;
                    // Open mesh generator with this image
                    editor.call('picker:pajamadot:assetgen', 'mesh');
                }
            },
            {
                text: 'Generate New Texture',
                icon: 'E159',
                onSelect: () => {
                    if (!checkToken()) return;
                    editor.call('picker:pajamadot:assetgen', 'image');
                }
            },
            {
                text: 'Generate New 3D Model',
                icon: 'E207',
                onSelect: () => {
                    if (!checkToken()) return;
                    editor.call('picker:pajamadot:assetgen', 'mesh');
                }
            },
            {
                text: 'Asset Generator...',
                icon: 'E195',
                onSelect: () => {
                    if (!checkToken()) return;
                    editor.call('picker:pajamadot:assetgen');
                }
            }
        ]
    });
}

/**
 * Check if API token is configured, show settings if not
 */
function checkToken(): boolean {
    if (!PajamaDotTokenManager.hasToken()) {
        editor.call('picker:pajamadot:token');
        return false;
    }
    return true;
}

// Initialize on editor load
editor.once('load', () => {
    // Wait for asset panel and context menu to be ready
    setTimeout(() => {
        initAIGCAssetBrowserIntegration();
    }, 2000);
});

export { initAIGCAssetBrowserIntegration };

/**
 * Asset Context Menu Integration
 * Adds AI generation options to the PlayCanvas asset browser context menu
 */

import { generationClient } from '../generation/generation-client';

declare const editor: any;

/**
 * Initialize context menu integration for right-click on assets
 * Note: PlayCanvas's createCustomContextMenu supports nested 'items' arrays
 * where each item is a plain object with { text, icon, onSelect, onIsVisible, items? }
 */
function initContextMenuIntegration(): void {
    // Check if assets:contextmenu:add method exists
    try {
        if (typeof editor.call !== 'function') {
            console.warn('[PajamaDot] Editor call method not available');
            return;
        }
    } catch (e) {
        console.warn('[PajamaDot] Editor not ready for context menu integration');
        return;
    }

    // Add PajamaDot submenu to context menu with nested items
    try {
        editor.call('assets:contextmenu:add', {
            text: '✨ PajamaDot',
            icon: 'E195', // Magic wand icon
            onIsVisible: (asset: any) => {
                // Check if we have a valid token
                const hasToken = editor.call('pajamadot:hasToken');
                if (!hasToken) return false;

                // Always show for assets that support AI generation
                const type = asset.get('type');
                const isSource = asset.get('source');
                const name = asset.get('name') || '';

                // Check for image source files
                const isImage = isSource && ['png', 'jpg', 'jpeg', 'webp'].some(ext =>
                    name.toLowerCase().endsWith(`.${ext}`)
                );

                // Check for supported asset types
                const supportedTypes = ['texture', 'material', 'model', 'container', 'folder', 'storycharacter', 'storylocation', 'storyitem'];

                return supportedTypes.includes(type) || isImage;
            },
            // Nested items for submenu
            items: [
                // --- AI Generation Section ---
                {
                    text: 'Generate Texture',
                    icon: 'E159',
                    onSelect: () => {
                        editor.call('pajamadot:panel:texture:show');
                    }
                },
                {
                    text: 'Generate 3D Model',
                    icon: 'E207',
                    onSelect: () => {
                        editor.call('pajamadot:panel:mesh:show');
                    }
                },
                {
                    text: 'Generate Image',
                    icon: 'E159',
                    onSelect: () => {
                        editor.call('picker:pajamadot:assetgen', 'image');
                    }
                },
                // --- Separator ---
                {
                    text: '─────────────',
                    onIsVisible: () => true,
                    onSelect: () => {}
                },
                // --- Story Assets Section ---
                {
                    text: 'Create Character',
                    icon: 'E192',
                    onSelect: () => {
                        editor.call('assets:create:storycharacter');
                    }
                },
                {
                    text: 'Create Background',
                    icon: 'E201',
                    onSelect: () => {
                        editor.call('assets:create:storylocation');
                    }
                },
                {
                    text: 'Create Item',
                    icon: 'E209',
                    onSelect: () => {
                        editor.call('assets:create:storyitem');
                    }
                },
                // --- Separator ---
                {
                    text: '─────────────',
                    onIsVisible: () => true,
                    onSelect: () => {}
                },
                // --- Asset Generator ---
                {
                    text: 'Asset Generator...',
                    icon: 'E195',
                    onSelect: () => {
                        editor.call('picker:pajamadot:assetgen');
                    }
                },
                {
                    text: 'Generation History',
                    icon: 'E164',
                    onSelect: () => {
                        editor.call('picker:pajamadot:assetgen', 'history');
                    }
                },
                // --- Separator ---
                {
                    text: '─────────────',
                    onIsVisible: () => true,
                    onSelect: () => {}
                },
                // --- API Settings ---
                {
                    text: 'API Settings...',
                    icon: 'E136',
                    onSelect: () => {
                        editor.call('picker:pajamadot:token');
                    }
                }
            ]
        });

        console.log('[PajamaDot] Asset context menu registered');
    } catch (e) {
        console.warn('[PajamaDot] Failed to register asset context menu:', e);
    }
}

/**
 * Initialize create menu integration (+ button)
 */
function initCreateMenuIntegration(): void {
    try {
        // Add PajamaDot submenu to the + button / create menu
        editor.call('assets:contextmenu:addcreate', {
            text: '✨ PajamaDot',
            icon: 'E195', // Magic wand icon
            onIsVisible: () => {
                return editor.call('pajamadot:hasToken') && editor.call('permissions:write');
            },
            items: [
                // --- AI Generation ---
                {
                    text: 'Generate Texture',
                    icon: 'E159',
                    onSelect: () => {
                        editor.call('pajamadot:panel:texture:show');
                    }
                },
                {
                    text: 'Generate 3D Model',
                    icon: 'E207',
                    onSelect: () => {
                        editor.call('pajamadot:panel:mesh:show');
                    }
                },
                {
                    text: 'Generate Image',
                    icon: 'E159',
                    onSelect: () => {
                        editor.call('picker:pajamadot:assetgen', 'image');
                    }
                },
                // --- Separator ---
                {
                    text: '─────────────',
                    onIsVisible: () => true,
                    onSelect: () => {}
                },
                // --- Story Assets ---
                {
                    text: 'Create Character',
                    icon: 'E192',
                    onSelect: () => {
                        editor.call('assets:create:storycharacter');
                    }
                },
                {
                    text: 'Create Background',
                    icon: 'E201',
                    onSelect: () => {
                        editor.call('assets:create:storylocation');
                    }
                },
                {
                    text: 'Create Item',
                    icon: 'E209',
                    onSelect: () => {
                        editor.call('assets:create:storyitem');
                    }
                },
                // --- Separator ---
                {
                    text: '─────────────',
                    onIsVisible: () => true,
                    onSelect: () => {}
                },
                // --- Asset Generator ---
                {
                    text: 'Asset Generator...',
                    icon: 'E195',
                    onSelect: () => {
                        editor.call('picker:pajamadot:assetgen');
                    }
                }
            ]
        });

        console.log('[PajamaDot] Create menu registered');
    } catch (e) {
        console.warn('[PajamaDot] Failed to register create menu:', e);
    }
}

/**
 * Register quick action methods
 */
function registerQuickActions(): void {
    // Safe method registration to avoid duplicate registration errors
    const safeMethod = (name: string, fn: (...args: any[]) => any) => {
        try {
            editor.method(name, fn);
        } catch (e) {
            // Method already registered, ignore
        }
    };

    // Upscale quick action
    safeMethod('pajamadot:quick:upscale', async (assetId: number, scale: 2 | 4) => {
        try {
            editor.call('status:log', `Upscaling asset ${scale}x...`);

            const asset = editor.call('assets:get', assetId);
            if (!asset) {
                editor.call('status:error', 'Asset not found');
                return;
            }

            // Get asset file URL - the correct way in PlayCanvas
            const fileUrl = asset.get('file.url');
            if (!fileUrl) {
                editor.call('status:error', 'Could not get asset URL - asset has no file');
                return;
            }

            // Build full URL if relative
            const url = fileUrl.startsWith('http') ? fileUrl : `${window.location.origin}${fileUrl}`;

            // Call upscale API
            const result = await generationClient.upscaleImage({
                image_url: url,
                scale_factor: scale
            });

            if (result.url) {
                editor.call('status:log', `Upscale complete! Importing...`);
                // Import the upscaled image using assetImporter
                const { assetImporter } = await import('../generation/asset-importer');
                const assetName = asset.get('name') || 'upscaled';
                const baseName = assetName.replace(/\.(png|jpg|jpeg|webp)$/i, '');
                await assetImporter.importTextureFromUrl(result.url, `${baseName}_${scale}x`, {
                    tags: ['aigc', 'upscaled']
                });
                editor.call('status:log', `Upscaled image imported!`);
                editor.call('aigc:credits:refresh');
            } else {
                editor.call('status:error', result.error || 'Upscale failed');
            }
        } catch (error) {
            console.error('[PajamaDot] Upscale error:', error);
            editor.call('status:error', `Upscale failed: ${error}`);
        }
    });

    // PBR generation quick action
    safeMethod('pajamadot:quick:pbr', async (assetId: number) => {
        try {
            editor.call('status:log', 'Generating PBR texture set...');

            const asset = editor.call('assets:get', assetId);
            if (!asset) {
                editor.call('status:error', 'Asset not found');
                return;
            }

            // Get asset file URL - the correct way in PlayCanvas
            const fileUrl = asset.get('file.url');
            if (!fileUrl) {
                editor.call('status:error', 'Could not get asset URL - asset has no file');
                return;
            }

            // Build full URL if relative
            const url = fileUrl.startsWith('http') ? fileUrl : `${window.location.origin}${fileUrl}`;

            // TODO: Implement PBR generation via generation client
            // For now, show that we at least got the URL correctly
            console.log('[PajamaDot] PBR source URL:', url);
            editor.call('status:log', 'PBR generation coming soon!');
        } catch (error) {
            console.error('[PajamaDot] PBR generation error:', error);
            editor.call('status:error', `PBR generation failed: ${error}`);
        }
    });

    // Remove background quick action
    safeMethod('pajamadot:quick:remove-bg', async (assetId: number) => {
        try {
            editor.call('status:log', 'Removing background...');

            const asset = editor.call('assets:get', assetId);
            if (!asset) {
                editor.call('status:error', 'Asset not found');
                return;
            }

            // Get asset file URL - the correct way in PlayCanvas
            const fileUrl = asset.get('file.url');
            if (!fileUrl) {
                editor.call('status:error', 'Could not get asset URL - asset has no file');
                return;
            }

            // Build full URL if relative
            const url = fileUrl.startsWith('http') ? fileUrl : `${window.location.origin}${fileUrl}`;

            // Call remove background API
            const result = await generationClient.removeBackground({
                image_url: url
            });

            if (result.url) {
                editor.call('status:log', 'Background removed! Importing...');
                // Import the result using assetImporter
                const { assetImporter } = await import('../generation/asset-importer');
                const assetName = asset.get('name') || 'image';
                const baseName = assetName.replace(/\.(png|jpg|jpeg|webp)$/i, '');
                await assetImporter.importTextureFromUrl(result.url, `${baseName}_nobg`, {
                    tags: ['aigc', 'background-removed']
                });
                editor.call('status:log', `Background removed and imported!`);
                editor.call('aigc:credits:refresh');
            } else {
                editor.call('status:error', result.error || 'Background removal failed');
            }
        } catch (error) {
            console.error('[PajamaDot] Remove background error:', error);
            editor.call('status:error', `Remove background failed: ${error}`);
        }
    });

    console.log('[PajamaDot] Quick actions registered');
}

/**
 * Initialize all asset browser integrations
 */
function initAssetBrowserIntegration(): void {
    initContextMenuIntegration();
    initCreateMenuIntegration();
    registerQuickActions();
}

// Initialize on editor load
editor.once('load', () => {
    setTimeout(() => {
        initAssetBrowserIntegration();
    }, 500);
});

export { initAssetBrowserIntegration };

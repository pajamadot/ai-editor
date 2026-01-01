/**
 * Asset Context Menu Integration
 * Adds AI generation options to the PlayCanvas asset browser context menu
 */

import { Menu, MenuItem } from '@playcanvas/pcui';

declare const editor: any;

/**
 * Get AI menu items for texture assets
 */
function getTextureMenuItems(asset: any): MenuItem[] {
    return [
        new MenuItem({
            text: 'Generate Variant',
            icon: 'E195', // Magic wand
            onSelect: () => {
                const prompt = asset.get('meta.aigc.prompt') || asset.get('name');
                editor.call('pajamadot:generate:texture', { prompt, variant: true });
            }
        }),
        new MenuItem({
            text: 'Upscale 2x',
            icon: 'E149', // Expand
            onSelect: () => {
                editor.call('pajamadot:quick:upscale', asset.get('id'), 2);
            }
        }),
        new MenuItem({
            text: 'Upscale 4x',
            icon: 'E149', // Expand
            onSelect: () => {
                editor.call('pajamadot:quick:upscale', asset.get('id'), 4);
            }
        }),
        new MenuItem({
            text: 'Generate PBR Set',
            icon: 'E207', // 3D cube
            onSelect: () => {
                editor.call('pajamadot:quick:pbr', asset.get('id'));
            }
        }),
        new MenuItem({
            text: 'Remove Background',
            icon: 'E163', // Cut
            onSelect: () => {
                editor.call('pajamadot:quick:remove-bg', asset.get('id'));
            }
        })
    ];
}

/**
 * Get AI menu items for material assets
 */
function getMaterialMenuItems(asset: any): MenuItem[] {
    return [
        new MenuItem({
            text: 'Generate All Textures',
            icon: 'E195', // Magic wand
            onSelect: () => {
                const name = asset.get('name') || 'material';
                editor.call('pajamadot:generate:material-textures', {
                    materialId: asset.get('id'),
                    prompt: name,
                    slots: ['diffuse', 'normal', 'roughness', 'ao']
                });
            }
        }),
        new MenuItem({
            text: 'Generate Diffuse',
            icon: 'E159', // Texture
            onSelect: () => {
                editor.call('pajamadot:generate:material-textures', {
                    materialId: asset.get('id'),
                    slots: ['diffuse']
                });
            }
        }),
        new MenuItem({
            text: 'Generate Normal Map',
            icon: 'E159', // Texture
            onSelect: () => {
                editor.call('pajamadot:generate:material-textures', {
                    materialId: asset.get('id'),
                    slots: ['normal']
                });
            }
        }),
        new MenuItem({
            text: 'Generate Roughness',
            icon: 'E159', // Texture
            onSelect: () => {
                editor.call('pajamadot:generate:material-textures', {
                    materialId: asset.get('id'),
                    slots: ['roughness']
                });
            }
        })
    ];
}

/**
 * Get AI menu items for model/container assets
 */
function getModelMenuItems(asset: any): MenuItem[] {
    return [
        new MenuItem({
            text: 'Generate Texture',
            icon: 'E159', // Texture
            onSelect: () => {
                editor.call('pajamadot:generate:model-texture', {
                    modelId: asset.get('id')
                });
            }
        }),
        new MenuItem({
            text: 'Re-texture with AI',
            icon: 'E195', // Magic wand
            onSelect: () => {
                editor.call('picker:pajamadot:assetgen', 'texture');
            }
        })
    ];
}

/**
 * Get AI menu items for image assets (source files)
 */
function getImageMenuItems(asset: any): MenuItem[] {
    return [
        new MenuItem({
            text: 'Generate 3D Model',
            icon: 'E207', // 3D cube
            onSelect: async () => {
                // Get the image URL and generate a 3D model from it
                const url = await editor.call('assets:get:url', asset.get('id'));
                editor.call('pajamadot:generate:mesh', { imageUrl: url });
            }
        }),
        new MenuItem({
            text: 'Upscale 2x',
            icon: 'E149', // Expand
            onSelect: () => {
                editor.call('pajamadot:quick:upscale', asset.get('id'), 2);
            }
        }),
        new MenuItem({
            text: 'Upscale 4x',
            icon: 'E149', // Expand
            onSelect: () => {
                editor.call('pajamadot:quick:upscale', asset.get('id'), 4);
            }
        }),
        new MenuItem({
            text: 'Remove Background',
            icon: 'E163', // Cut
            onSelect: () => {
                editor.call('pajamadot:quick:remove-bg', asset.get('id'));
            }
        })
    ];
}

/**
 * Get AI menu items for folder
 */
function getFolderMenuItems(asset: any): MenuItem[] {
    return [
        new MenuItem({
            text: 'Generate Assets Here...',
            icon: 'E195', // Magic wand
            onSelect: () => {
                // Open asset generator with this folder as target
                editor.call('picker:pajamadot:assetgen', {
                    targetFolder: asset.get('id')
                });
            }
        })
    ];
}

/**
 * Create AI Generate submenu based on asset type
 */
function createAISubmenu(asset: any): Menu | null {
    const type = asset.get('type');
    const isSource = asset.get('source');

    let items: MenuItem[] = [];

    if (type === 'texture') {
        items = getTextureMenuItems(asset);
    } else if (type === 'material') {
        items = getMaterialMenuItems(asset);
    } else if (type === 'model' || type === 'container') {
        items = getModelMenuItems(asset);
    } else if (isSource && ['png', 'jpg', 'jpeg', 'webp'].some(ext =>
        asset.get('name')?.toLowerCase().endsWith(`.${ext}`)
    )) {
        items = getImageMenuItems(asset);
    } else if (type === 'folder') {
        items = getFolderMenuItems(asset);
    }

    if (items.length === 0) {
        return null;
    }

    const menu = new Menu();
    items.forEach(item => menu.append(item));
    return menu;
}

/**
 * Initialize asset browser context menu integration
 */
function initContextMenuIntegration(): void {
    const root = editor.call('layout.root');
    if (!root) {
        console.warn('[PajamaDot] Layout root not available for context menu');
        return;
    }

    // Track current asset for submenu
    let currentAsset: any = null;
    let aiSubmenu: Menu | null = null;

    // Add AI Generate item to context menu
    editor.call('assets:contextmenu:add', {
        text: 'AI Generate',
        icon: 'E195', // Magic wand icon
        onIsVisible: (asset: any) => {
            // Check if we have a valid token
            const hasToken = editor.call('pajamadot:hasToken');
            if (!hasToken) return false;

            // Check if this asset type supports AI generation
            const type = asset.get('type');
            const isSource = asset.get('source');
            const name = asset.get('name') || '';

            const supportedTypes = ['texture', 'material', 'model', 'container', 'folder'];
            const isImage = isSource && ['png', 'jpg', 'jpeg', 'webp'].some(ext =>
                name.toLowerCase().endsWith(`.${ext}`)
            );

            return supportedTypes.includes(type) || isImage;
        },
        onSelect: (asset: any) => {
            // Show appropriate generation panel or modal based on asset type
            const type = asset.get('type');

            if (type === 'texture' || type === 'material') {
                // Open texture generation with context
                editor.call('pajamadot:panel:texture:show');
            } else if (type === 'model' || type === 'container') {
                // Open mesh panel
                editor.call('pajamadot:panel:mesh:show');
            } else {
                // Open full modal
                editor.call('picker:pajamadot:assetgen');
            }
        },
        items: (asset: any) => {
            // Return submenu items based on asset type
            const type = asset.get('type');
            const isSource = asset.get('source');
            const name = asset.get('name') || '';

            if (type === 'texture') {
                return [
                    { text: 'Generate Variant', icon: 'E195', onSelect: () => {
                        const prompt = asset.get('meta.aigc.prompt') || name;
                        editor.call('pajamadot:generate:texture', { prompt, variant: true });
                    }},
                    { text: 'Upscale 2x', icon: 'E149', onSelect: () => {
                        editor.call('pajamadot:quick:upscale', asset.get('id'), 2);
                    }},
                    { text: 'Upscale 4x', icon: 'E149', onSelect: () => {
                        editor.call('pajamadot:quick:upscale', asset.get('id'), 4);
                    }},
                    { text: 'Generate PBR Set', icon: 'E207', onSelect: () => {
                        editor.call('pajamadot:quick:pbr', asset.get('id'));
                    }},
                    { text: 'Remove Background', icon: 'E163', onSelect: () => {
                        editor.call('pajamadot:quick:remove-bg', asset.get('id'));
                    }}
                ];
            } else if (type === 'material') {
                return [
                    { text: 'Generate All Textures', icon: 'E195', onSelect: () => {
                        editor.call('pajamadot:generate:material-textures', {
                            materialId: asset.get('id'),
                            prompt: name,
                            slots: ['diffuse', 'normal', 'roughness', 'ao']
                        });
                    }},
                    { text: 'Generate Diffuse', icon: 'E159', onSelect: () => {
                        editor.call('pajamadot:generate:material-textures', {
                            materialId: asset.get('id'),
                            slots: ['diffuse']
                        });
                    }},
                    { text: 'Generate Normal Map', icon: 'E159', onSelect: () => {
                        editor.call('pajamadot:generate:material-textures', {
                            materialId: asset.get('id'),
                            slots: ['normal']
                        });
                    }}
                ];
            } else if (type === 'model' || type === 'container') {
                return [
                    { text: 'Generate Texture', icon: 'E159', onSelect: () => {
                        editor.call('pajamadot:generate:model-texture', { modelId: asset.get('id') });
                    }},
                    { text: 'Re-texture with AI', icon: 'E195', onSelect: () => {
                        editor.call('picker:pajamadot:assetgen', 'texture');
                    }}
                ];
            } else if (isSource && ['png', 'jpg', 'jpeg', 'webp'].some(ext =>
                name.toLowerCase().endsWith(`.${ext}`)
            )) {
                return [
                    { text: 'Generate 3D Model', icon: 'E207', onSelect: async () => {
                        const url = await editor.call('assets:get:url', asset.get('id'));
                        editor.call('pajamadot:generate:mesh', { imageUrl: url });
                    }},
                    { text: 'Upscale 2x', icon: 'E149', onSelect: () => {
                        editor.call('pajamadot:quick:upscale', asset.get('id'), 2);
                    }},
                    { text: 'Remove Background', icon: 'E163', onSelect: () => {
                        editor.call('pajamadot:quick:remove-bg', asset.get('id'));
                    }}
                ];
            } else if (type === 'folder') {
                return [
                    { text: 'Generate Assets Here...', icon: 'E195', onSelect: () => {
                        editor.call('picker:pajamadot:assetgen', { targetFolder: asset.get('id') });
                    }}
                ];
            }

            return [];
        }
    });

    console.log('[PajamaDot] Asset context menu AI options registered');
}

/**
 * Initialize create menu integration (+ button)
 */
function initCreateMenuIntegration(): void {
    // Add AI Generate submenu to the + button / create menu
    editor.call('assets:contextmenu:addcreate', {
        text: 'AI Generate',
        icon: 'E195', // Magic wand icon
        onIsVisible: () => {
            return editor.call('pajamadot:hasToken') && editor.call('permissions:write');
        },
        items: [
            {
                text: 'Generate Texture',
                icon: 'E159', // Texture icon
                onSelect: () => {
                    editor.call('pajamadot:panel:texture:show');
                }
            },
            {
                text: 'Generate 3D Model',
                icon: 'E207', // 3D cube icon
                onSelect: () => {
                    editor.call('pajamadot:panel:mesh:show');
                }
            },
            {
                text: 'Generate Image',
                icon: 'E159', // Image icon
                onSelect: () => {
                    editor.call('picker:pajamadot:assetgen', 'image');
                }
            },
            {
                text: '─────────────',
                onIsVisible: () => true,
                onSelect: () => {}
            },
            {
                text: 'Generate Character',
                icon: 'E192', // Person icon
                onSelect: () => {
                    editor.call('assets:create:storycharacter');
                }
            },
            {
                text: 'Generate Background',
                icon: 'E201', // Landscape icon
                onSelect: () => {
                    editor.call('assets:create:storylocation');
                }
            },
            {
                text: '─────────────',
                onIsVisible: () => true,
                onSelect: () => {}
            },
            {
                text: 'Asset Generator...',
                icon: 'E195', // Magic wand
                onSelect: () => {
                    editor.call('picker:pajamadot:assetgen');
                }
            }
        ]
    });

    console.log('[PajamaDot] Create menu AI options registered');
}

/**
 * Register quick action methods
 */
function registerQuickActions(): void {
    // Upscale quick action
    editor.method('pajamadot:quick:upscale', async (assetId: number, scale: 2 | 4) => {
        try {
            editor.call('status:log', `Upscaling asset ${scale}x...`);

            const asset = editor.call('assets:get', assetId);
            if (!asset) {
                editor.call('status:error', 'Asset not found');
                return;
            }

            // Get asset URL
            const url = await editor.call('assets:get:url', assetId);
            if (!url) {
                editor.call('status:error', 'Could not get asset URL');
                return;
            }

            // Import upscale client
            const { generationClient } = await import('../generation/generation-client');

            // Call upscale API (using the upscale_image endpoint)
            const result = await generationClient.upscaleImage(url, scale);

            if (result.success && result.imageUrl) {
                // Import the upscaled image as a new asset
                const { assetImporter } = await import('../generation/asset-importer');
                const folder = asset.get('parent') || editor.call('assets:panel:currentFolder');
                const name = `${asset.get('name')}_${scale}x`;

                await assetImporter.importTextureFromUrl(result.imageUrl, name, folder);
                editor.call('status:success', `Upscaled to ${scale}x!`);
                editor.call('aigc:credits:refresh');
            } else {
                editor.call('status:error', result.error || 'Upscale failed');
            }
        } catch (error) {
            console.error('[PajamaDot] Upscale error:', error);
            editor.call('status:error', `Upscale failed: ${error}`);
        }
    });

    // PBR set generation quick action
    editor.method('pajamadot:quick:pbr', async (assetId: number) => {
        try {
            editor.call('status:log', 'Generating PBR texture set...');

            const asset = editor.call('assets:get', assetId);
            if (!asset) {
                editor.call('status:error', 'Asset not found');
                return;
            }

            // Get the texture URL
            const url = await editor.call('assets:get:url', assetId);
            if (!url) {
                editor.call('status:error', 'Could not get asset URL');
                return;
            }

            // Import texture client
            const { textureClient } = await import('../generation/texture-client');
            const { assetImporter } = await import('../generation/asset-importer');

            // Generate PBR maps
            const result = await textureClient.generatePBRMaps(url);

            if (result.success) {
                const folder = asset.get('parent') || editor.call('assets:panel:currentFolder');
                const baseName = asset.get('name').replace(/\.(png|jpg|jpeg|webp)$/i, '');

                // Import each map
                if (result.diffuseUrl) {
                    await assetImporter.importTextureFromUrl(result.diffuseUrl, `${baseName}_diffuse`, folder);
                }
                if (result.normalUrl) {
                    await assetImporter.importTextureFromUrl(result.normalUrl, `${baseName}_normal`, folder);
                }
                if (result.roughnessUrl) {
                    await assetImporter.importTextureFromUrl(result.roughnessUrl, `${baseName}_roughness`, folder);
                }
                if (result.aoUrl) {
                    await assetImporter.importTextureFromUrl(result.aoUrl, `${baseName}_ao`, folder);
                }

                editor.call('status:success', 'PBR set generated!');
                editor.call('aigc:credits:refresh');
            } else {
                editor.call('status:error', result.error || 'PBR generation failed');
            }
        } catch (error) {
            console.error('[PajamaDot] PBR generation error:', error);
            editor.call('status:error', `PBR generation failed: ${error}`);
        }
    });

    // Remove background quick action
    editor.method('pajamadot:quick:remove-bg', async (assetId: number) => {
        try {
            editor.call('status:log', 'Removing background...');

            const asset = editor.call('assets:get', assetId);
            if (!asset) {
                editor.call('status:error', 'Asset not found');
                return;
            }

            // Get asset URL
            const url = await editor.call('assets:get:url', assetId);
            if (!url) {
                editor.call('status:error', 'Could not get asset URL');
                return;
            }

            // Import generation client
            const { generationClient } = await import('../generation/generation-client');
            const { assetImporter } = await import('../generation/asset-importer');

            // Call background removal
            const result = await generationClient.removeBackground(url);

            if (result.success && result.imageUrl) {
                const folder = asset.get('parent') || editor.call('assets:panel:currentFolder');
                const name = `${asset.get('name')}_nobg`;

                await assetImporter.importTextureFromUrl(result.imageUrl, name, folder);
                editor.call('status:success', 'Background removed!');
                editor.call('aigc:credits:refresh');
            } else {
                editor.call('status:error', result.error || 'Background removal failed');
            }
        } catch (error) {
            console.error('[PajamaDot] Background removal error:', error);
            editor.call('status:error', `Background removal failed: ${error}`);
        }
    });

    // Generate variant quick action
    editor.method('pajamadot:quick:variant', async (assetId: number) => {
        try {
            editor.call('status:log', 'Generating variant...');

            const asset = editor.call('assets:get', assetId);
            if (!asset) {
                editor.call('status:error', 'Asset not found');
                return;
            }

            // Get original prompt if available
            const prompt = asset.get('meta.aigc.prompt') || asset.get('name');

            // Open texture panel with pre-filled prompt
            editor.call('pajamadot:panel:texture:show', { prompt });
        } catch (error) {
            console.error('[PajamaDot] Variant generation error:', error);
            editor.call('status:error', `Variant generation failed: ${error}`);
        }
    });

    // Material textures generation
    editor.method('pajamadot:generate:material-textures', async (options: {
        materialId: number;
        prompt?: string;
        slots: string[];
    }) => {
        try {
            editor.call('status:log', 'Generating material textures...');

            const material = editor.call('assets:get', options.materialId);
            if (!material) {
                editor.call('status:error', 'Material not found');
                return;
            }

            const { textureClient } = await import('../generation/texture-client');
            const { assetImporter } = await import('../generation/asset-importer');

            const folder = material.get('parent') || editor.call('assets:panel:currentFolder');
            const baseName = material.get('name');
            const prompt = options.prompt || baseName;

            for (const slot of options.slots) {
                editor.call('status:log', `Generating ${slot} texture...`);

                let result;
                if (slot === 'normal') {
                    result = await textureClient.generateTexture(`${prompt} normal map, blue-purple tones`, { seamless: true });
                } else if (slot === 'roughness') {
                    result = await textureClient.generateTexture(`${prompt} roughness map, grayscale`, { seamless: true });
                } else if (slot === 'ao') {
                    result = await textureClient.generateTexture(`${prompt} ambient occlusion map, grayscale`, { seamless: true });
                } else {
                    result = await textureClient.generateTexture(prompt, { seamless: true });
                }

                if (result.success && result.textureUrl) {
                    await assetImporter.importTextureFromUrl(result.textureUrl, `${baseName}_${slot}`, folder);
                }
            }

            editor.call('status:success', 'Material textures generated!');
            editor.call('aigc:credits:refresh');
        } catch (error) {
            console.error('[PajamaDot] Material texture generation error:', error);
            editor.call('status:error', `Generation failed: ${error}`);
        }
    });

    // Model texture generation
    editor.method('pajamadot:generate:model-texture', async (options: {
        modelId: number;
        prompt?: string;
    }) => {
        try {
            const model = editor.call('assets:get', options.modelId);
            if (!model) {
                editor.call('status:error', 'Model not found');
                return;
            }

            const prompt = options.prompt || model.get('name');

            // Open texture panel with context
            editor.call('pajamadot:panel:texture:show', { prompt: `texture for 3D model: ${prompt}` });
        } catch (error) {
            console.error('[PajamaDot] Model texture generation error:', error);
            editor.call('status:error', `Generation failed: ${error}`);
        }
    });

    console.log('[PajamaDot] Quick actions registered');
}

// Initialize on editor load
editor.once('load', () => {
    // Delay to ensure other systems are ready
    setTimeout(() => {
        initContextMenuIntegration();
        initCreateMenuIntegration();
        registerQuickActions();
    }, 600);
});

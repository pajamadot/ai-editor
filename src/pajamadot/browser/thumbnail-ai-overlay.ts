/**
 * Thumbnail AI Overlay
 * Adds hover action buttons on asset thumbnails for quick AI operations
 */

import { Button, Container } from '@playcanvas/pcui';

declare const editor: any;

/**
 * CSS styles for thumbnail overlay
 */
const OVERLAY_STYLES = `
/* Thumbnail AI overlay container */
.ai-thumbnail-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.85));
    padding: 6px 4px 4px;
    display: flex;
    gap: 2px;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.15s ease-out;
    pointer-events: none;
    z-index: 15;
}

.asset-grid-item:hover .ai-thumbnail-overlay {
    opacity: 1;
    pointer-events: auto;
}

/* Overlay action buttons */
.ai-thumbnail-overlay .ai-action-btn {
    width: 24px;
    height: 24px;
    min-width: 24px;
    padding: 0;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.15);
    border: none;
    color: white;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.1s ease-out;
}

.ai-thumbnail-overlay .ai-action-btn:hover {
    background: #a855f7;
    transform: scale(1.1);
}

.ai-thumbnail-overlay .ai-action-btn:active {
    transform: scale(0.95);
}

/* Tooltip for buttons */
.ai-thumbnail-overlay .ai-action-btn::before {
    content: attr(data-tooltip);
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: #1a1a1a;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 10px;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.1s;
    margin-bottom: 4px;
}

.ai-thumbnail-overlay .ai-action-btn:hover::before {
    opacity: 1;
}
`;

/**
 * Action button configuration
 */
interface ActionButton {
    icon: string;
    tooltip: string;
    action: string;
    visibleFor: string[];
}

/**
 * Get action buttons for asset type
 */
function getActionsForAssetType(type: string, isSource: boolean, name: string): ActionButton[] {
    const isImage = isSource && ['png', 'jpg', 'jpeg', 'webp'].some(ext =>
        name.toLowerCase().endsWith(`.${ext}`)
    );

    if (type === 'texture') {
        return [
            { icon: 'E195', tooltip: 'Variant', action: 'variant', visibleFor: ['texture'] },
            { icon: 'E149', tooltip: 'Upscale', action: 'upscale', visibleFor: ['texture'] },
            { icon: 'E207', tooltip: 'PBR Set', action: 'pbr', visibleFor: ['texture'] }
        ];
    } else if (type === 'material') {
        return [
            { icon: 'E195', tooltip: 'Generate', action: 'material-gen', visibleFor: ['material'] },
            { icon: 'E159', tooltip: 'Textures', action: 'material-textures', visibleFor: ['material'] }
        ];
    } else if (type === 'model' || type === 'container') {
        return [
            { icon: 'E159', tooltip: 'Texture', action: 'model-texture', visibleFor: ['model', 'container'] },
            { icon: 'E195', tooltip: 'Retexture', action: 'retexture', visibleFor: ['model', 'container'] }
        ];
    } else if (isImage) {
        return [
            { icon: 'E207', tooltip: '3D Model', action: 'image-to-3d', visibleFor: ['image'] },
            { icon: 'E149', tooltip: 'Upscale', action: 'upscale', visibleFor: ['image'] },
            { icon: 'E163', tooltip: 'Remove BG', action: 'remove-bg', visibleFor: ['image'] }
        ];
    }

    return [];
}

/**
 * Handle action button click
 */
async function handleAction(action: string, assetId: number): Promise<void> {
    const asset = editor.call('assets:get', assetId);
    if (!asset) return;

    switch (action) {
        case 'variant':
            editor.call('pajamadot:quick:variant', assetId);
            break;

        case 'upscale':
            // Default to 2x upscale
            editor.call('pajamadot:quick:upscale', assetId, 2);
            break;

        case 'pbr':
            editor.call('pajamadot:quick:pbr', assetId);
            break;

        case 'remove-bg':
            editor.call('pajamadot:quick:remove-bg', assetId);
            break;

        case 'image-to-3d':
            const url = await editor.call('assets:get:url', assetId);
            if (url) {
                editor.call('pajamadot:generate:mesh', { imageUrl: url });
            }
            break;

        case 'material-gen':
            editor.call('pajamadot:panel:texture:show', {
                prompt: asset.get('name'),
                targetMaterial: assetId
            });
            break;

        case 'material-textures':
            editor.call('pajamadot:generate:material-textures', {
                materialId: assetId,
                prompt: asset.get('name'),
                slots: ['diffuse', 'normal', 'roughness']
            });
            break;

        case 'model-texture':
            editor.call('pajamadot:generate:model-texture', { modelId: assetId });
            break;

        case 'retexture':
            editor.call('picker:pajamadot:assetgen', 'texture');
            break;

        default:
            console.warn('[PajamaDot] Unknown action:', action);
    }
}

/**
 * Create overlay for a grid item
 */
function createOverlay(itemDom: HTMLElement, asset: any): void {
    // Check if overlay already exists
    if (itemDom.querySelector('.ai-thumbnail-overlay')) return;

    // Check if we have a token
    const hasToken = editor.call('pajamadot:hasToken');
    if (!hasToken) return;

    const type = asset.get('type');
    const isSource = asset.get('source');
    const name = asset.get('name') || '';

    const actions = getActionsForAssetType(type, isSource, name);
    if (actions.length === 0) return;

    // Create overlay container
    const overlay = document.createElement('div');
    overlay.className = 'ai-thumbnail-overlay';

    // Create action buttons
    actions.forEach(actionConfig => {
        const btn = document.createElement('button');
        btn.className = 'ai-action-btn';
        btn.setAttribute('data-tooltip', actionConfig.tooltip);
        btn.innerHTML = `<span class="pcui-icon" style="font-family: 'pc-icon'; font-size: 14px;">&#x${actionConfig.icon.slice(1)};</span>`;

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            handleAction(actionConfig.action, asset.get('id'));
        });

        overlay.appendChild(btn);
    });

    // Add overlay to grid item
    itemDom.style.position = 'relative';
    itemDom.appendChild(overlay);
}

/**
 * Add styles to document
 */
function addStyles(): void {
    const styleId = 'pajamadot-thumbnail-overlay-styles';
    if (document.getElementById(styleId)) return;

    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = OVERLAY_STYLES;
    document.head.appendChild(styleEl);
}

/**
 * Initialize thumbnail overlay system
 */
function initThumbnailOverlay(): void {
    // Hook into grid item creation
    editor.on('assets:panel:grid:item:create', (item: any, asset: any) => {
        if (item && item.dom && asset) {
            // Delay slightly to ensure DOM is ready
            setTimeout(() => {
                createOverlay(item.dom, asset);
            }, 10);
        }
    });

    // Also handle panel refresh
    editor.on('assets:panel:refresh', () => {
        // Re-scan all grid items
        setTimeout(() => {
            const gridItems = document.querySelectorAll('.ui-panel-assets .asset-grid-item');
            gridItems.forEach((itemDom: Element) => {
                const assetId = (itemDom as HTMLElement).dataset.assetId;
                if (assetId) {
                    const asset = editor.call('assets:get', parseInt(assetId, 10));
                    if (asset) {
                        createOverlay(itemDom as HTMLElement, asset);
                    }
                }
            });
        }, 100);
    });

    // MutationObserver for dynamically added items
    const setupObserver = () => {
        const assetPanel = document.querySelector('.ui-panel-assets');
        if (!assetPanel) {
            setTimeout(setupObserver, 1000);
            return;
        }

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node instanceof HTMLElement) {
                        // Check if it's a grid item
                        if (node.classList.contains('asset-grid-item')) {
                            const assetId = node.dataset.assetId;
                            if (assetId) {
                                const asset = editor.call('assets:get', parseInt(assetId, 10));
                                if (asset) {
                                    createOverlay(node, asset);
                                }
                            }
                        }

                        // Check for grid items inside added nodes
                        const gridItems = node.querySelectorAll('.asset-grid-item');
                        gridItems.forEach((itemDom: Element) => {
                            const assetId = (itemDom as HTMLElement).dataset.assetId;
                            if (assetId) {
                                const asset = editor.call('assets:get', parseInt(assetId, 10));
                                if (asset) {
                                    createOverlay(itemDom as HTMLElement, asset);
                                }
                            }
                        });
                    }
                });
            });
        });

        observer.observe(assetPanel, {
            childList: true,
            subtree: true
        });

        console.log('[PajamaDot] Thumbnail overlay observer initialized');
    };

    setTimeout(setupObserver, 600);
}

// Initialize on editor load
editor.once('load', () => {
    addStyles();

    setTimeout(() => {
        initThumbnailOverlay();
        console.log('[PajamaDot] Thumbnail AI overlay initialized');
    }, 500);
});

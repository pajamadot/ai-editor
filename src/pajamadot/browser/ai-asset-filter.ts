/**
 * AI Asset Filter and Badge Display
 * Adds filtering for AI-generated assets and displays badges on thumbnails
 */

declare const editor: any;

/**
 * CSS styles for AI asset badges
 */
const AI_BADGE_STYLES = `
/* AIGC Badge on asset thumbnails */
.aigc-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    background: linear-gradient(135deg, #a855f7, #6366f1);
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 9px;
    font-weight: 600;
    color: white;
    z-index: 10;
    pointer-events: none;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

/* Asset grid item needs relative positioning for badge */
.ui-panel-assets .asset-grid-item {
    position: relative;
}

/* Hover effect for AI assets */
.ui-panel-assets .asset-grid-item.aigc-asset:hover {
    box-shadow: 0 0 0 2px #a855f7;
}

/* AI Generated filter button active state */
.filter-aigc-active {
    background: linear-gradient(135deg, #a855f7, #6366f1) !important;
    color: white !important;
}

/* AI asset indicator in tree view */
.ui-panel-assets .tree-item.aigc-asset .tree-item-text::after {
    content: ' \\2728';
    font-size: 10px;
}
`;

/**
 * Check if an asset is AI-generated
 */
function isAIGenerated(asset: any): boolean {
    if (!asset) return false;

    // Check for aigc tag
    const tags = asset.get('tags') || [];
    if (tags.includes('aigc')) return true;

    // Check for aigc metadata
    const aigcMeta = asset.get('meta.aigc');
    if (aigcMeta) return true;

    return false;
}

/**
 * Add badge to asset thumbnail
 */
function addBadgeToThumbnail(itemDom: HTMLElement, asset: any): void {
    if (!isAIGenerated(asset)) return;

    // Check if badge already exists
    if (itemDom.querySelector('.aigc-badge')) return;

    // Create badge element
    const badge = document.createElement('div');
    badge.className = 'aigc-badge';
    badge.textContent = 'AI';
    badge.title = 'AI Generated';

    // Add class to grid item for styling
    itemDom.classList.add('aigc-asset');

    // Append badge
    itemDom.appendChild(badge);
}

/**
 * Initialize asset filter integration
 */
function initAssetFilter(): void {
    // Try to add AI Generated filter option
    // This depends on the editor's filter system being available
    try {
        // Check if filter system exists
        if (typeof editor.call === 'function') {
            // Register filter method if the system supports it
            editor.method('pajamadot:filter:aigc', (assets: any[]) => {
                return assets.filter(asset => isAIGenerated(asset));
            });

            // Try to add to filter dropdown if available
            const filterAdd = editor.method('assets:filter:add');
            if (filterAdd) {
                editor.call('assets:filter:add', {
                    name: 'AI Generated',
                    icon: 'E195',
                    filter: (asset: any) => isAIGenerated(asset)
                });
            }
        }
    } catch (e) {
        // Filter system not available, skip
        console.log('[PajamaDot] Asset filter system not available');
    }
}

/**
 * Initialize badge display on grid items
 */
function initBadgeDisplay(): void {
    // Hook into grid item creation
    // Try different event patterns that PlayCanvas editor might use

    // Pattern 1: Direct grid item creation event
    editor.on('assets:panel:grid:item:create', (item: any, asset: any) => {
        if (item && item.dom) {
            addBadgeToThumbnail(item.dom, asset);
        }
    });

    // Pattern 2: Asset panel refresh
    editor.on('assets:panel:refresh', () => {
        // Scan all grid items and add badges
        const gridItems = document.querySelectorAll('.ui-panel-assets .asset-grid-item');
        gridItems.forEach((itemDom: Element) => {
            const assetId = (itemDom as HTMLElement).dataset.assetId;
            if (assetId) {
                const asset = editor.call('assets:get', parseInt(assetId, 10));
                if (asset) {
                    addBadgeToThumbnail(itemDom as HTMLElement, asset);
                }
            }
        });
    });

    // Pattern 3: Use MutationObserver to catch dynamically added items
    const setupObserver = () => {
        const assetPanel = document.querySelector('.ui-panel-assets');
        if (!assetPanel) {
            // Try again later
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
                                    addBadgeToThumbnail(node, asset);
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
                                    addBadgeToThumbnail(itemDom as HTMLElement, asset);
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

        console.log('[PajamaDot] Asset badge observer initialized');
    };

    // Start observer after a delay
    setTimeout(setupObserver, 500);
}

/**
 * Add styles to document
 */
function addStyles(): void {
    const styleId = 'pajamadot-ai-asset-styles';
    if (document.getElementById(styleId)) return;

    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = AI_BADGE_STYLES;
    document.head.appendChild(styleEl);
}

/**
 * Expose utility method to check if asset is AI generated
 */
function registerMethods(): void {
    editor.method('pajamadot:asset:isAIGenerated', (assetId: number) => {
        const asset = editor.call('assets:get', assetId);
        return isAIGenerated(asset);
    });

    // Method to get all AI generated assets
    editor.method('pajamadot:assets:getAIGenerated', () => {
        const allAssets = editor.call('assets:list');
        return allAssets.filter((asset: any) => isAIGenerated(asset));
    });

    // Method to tag an asset as AI generated
    editor.method('pajamadot:asset:markAsAIGenerated', (assetId: number, metadata?: {
        prompt?: string;
        model?: string;
        cost?: number;
    }) => {
        const asset = editor.call('assets:get', assetId);
        if (!asset) return;

        // Add aigc tag
        const tags = asset.get('tags') || [];
        if (!tags.includes('aigc')) {
            tags.push('aigc');
            asset.set('tags', tags);
        }

        // Add metadata if provided
        if (metadata) {
            asset.set('meta.aigc', {
                prompt: metadata.prompt,
                model: metadata.model,
                cost: metadata.cost,
                generatedAt: new Date().toISOString()
            });
        }
    });
}

// Initialize on editor load
editor.once('load', () => {
    addStyles();

    setTimeout(() => {
        initAssetFilter();
        initBadgeDisplay();
        registerMethods();
        console.log('[PajamaDot] AI asset filter and badges initialized');
    }, 500);
});

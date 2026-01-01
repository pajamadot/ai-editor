/**
 * PajamaDot Inspector Integration
 *
 * Registers custom inspectors for PajamaDot asset types and adds context menu items.
 * Assets are detected by their name suffix pattern:
 * - *.storygraph - Story graphs
 * - *.character - Characters
 * - *.location - Locations
 * - *.item - Items
 */

import { CharacterAssetInspector } from './character-inspector';
import { LocationAssetInspector } from './location-inspector';
import { ItemAssetInspector } from './item-inspector';

declare const editor: any;

/**
 * Name suffixes for PajamaDot asset types
 */
const NAME_SUFFIXES = {
    STORY_GRAPH: '.storygraph',
    CHARACTER: '.character',
    LOCATION: '.location',
    ITEM: '.item'
};

/**
 * Check if asset is a specific PajamaDot type by checking the asset name
 */
function isAssetType(asset: any, suffix: string): boolean {
    if (!asset) return false;
    const name = asset.get('name') || '';
    return name.endsWith(suffix);
}

/**
 * Get PajamaDot asset type from asset
 */
function getPajamaDotType(asset: any): string | null {
    if (!asset) return null;
    const name = asset.get('name') || '';

    if (name.endsWith(NAME_SUFFIXES.STORY_GRAPH)) return 'storygraph';
    if (name.endsWith(NAME_SUFFIXES.CHARACTER)) return 'character';
    if (name.endsWith(NAME_SUFFIXES.LOCATION)) return 'location';
    if (name.endsWith(NAME_SUFFIXES.ITEM)) return 'item';

    return null;
}

// Track active inspectors
let activeInspector: any = null;

editor.once('load', () => {
    // Register inspector for PajamaDot assets
    editor.on('attributes:inspect[asset]', (assets: any[]) => {
        if (!assets || assets.length === 0) return;

        const asset = assets[0];
        const pajamadotType = getPajamaDotType(asset);

        // Only handle PajamaDot assets (not storygraph - has its own handler)
        if (!pajamadotType || pajamadotType === 'storygraph') return;

        // Get the inspector panel
        const inspectorPanel = editor.call('layout.attributes');
        if (!inspectorPanel) return;

        // Find and hide the default text inspector
        const textInspector = inspectorPanel.dom.querySelector('.asset-text-inspector');
        if (textInspector) {
            textInspector.style.display = 'none';
        }

        // Remove any existing PajamaDot inspector
        const existingInspector = inspectorPanel.dom.querySelector('.asset-character-inspector, .asset-location-inspector, .asset-item-inspector');
        if (existingInspector) {
            existingInspector.remove();
        }

        // Clean up previous active inspector
        if (activeInspector) {
            activeInspector.destroy();
            activeInspector = null;
        }

        // Create the appropriate inspector
        let inspector: any = null;
        const inspectorArgs = { history: editor.call('editor:history') };

        switch (pajamadotType) {
            case 'character':
                inspector = new CharacterAssetInspector(inspectorArgs);
                break;
            case 'location':
                inspector = new LocationAssetInspector(inspectorArgs);
                break;
            case 'item':
                inspector = new ItemAssetInspector(inspectorArgs);
                break;
        }

        if (inspector) {
            // Find the asset inspector container and append to it
            const assetInspector = inspectorPanel.dom.querySelector('.asset-inspector');
            if (assetInspector) {
                assetInspector.appendChild(inspector.dom);
            } else {
                // Fallback: append to panel content
                inspectorPanel.content?.dom?.appendChild(inspector.dom);
            }

            inspector.link(assets);
            activeInspector = inspector;
        }
    });

    // Clean up when selection changes
    editor.on('attributes:clear', () => {
        const inspectorPanel = editor.call('layout.attributes');
        if (!inspectorPanel) return;

        // Remove PajamaDot inspectors
        const pajamadotInspectors = inspectorPanel.dom.querySelectorAll('.asset-character-inspector, .asset-location-inspector, .asset-item-inspector');
        pajamadotInspectors.forEach((el: Element) => el.remove());

        // Show text inspector again
        const textInspector = inspectorPanel.dom.querySelector('.asset-text-inspector');
        if (textInspector) {
            (textInspector as HTMLElement).style.display = '';
        }

        // Clean up active inspector
        if (activeInspector) {
            activeInspector.destroy();
            activeInspector = null;
        }
    });

    // Add "Open Story Editor" context menu item for story graph assets
    editor.call('assets:contextmenu:add', {
        text: 'Open Story Editor',
        icon: 'E412',
        onIsVisible: (asset: any) => {
            return isAssetType(asset, NAME_SUFFIXES.STORY_GRAPH);
        },
        onSelect: (asset: any) => {
            if (asset) {
                const assetId = asset.get('id');
                console.log('[PajamaDot] Opening story editor window for asset:', assetId);
                editor.call('pajamadot:window:open', assetId);
            }
        }
    });

    // Add "View Character" context menu item for character assets
    editor.call('assets:contextmenu:add', {
        text: 'View Character Details',
        icon: 'E186',
        onIsVisible: (asset: any) => {
            return isAssetType(asset, NAME_SUFFIXES.CHARACTER);
        },
        onSelect: (asset: any) => {
            if (asset) {
                editor.call('selector:set', 'asset', [asset]);
            }
        }
    });

    // Add "Open Character Editor" context menu item for character assets
    editor.call('assets:contextmenu:add', {
        text: 'Open Character Editor',
        icon: 'E135',
        onIsVisible: (asset: any) => {
            return isAssetType(asset, NAME_SUFFIXES.CHARACTER);
        },
        onSelect: (asset: any) => {
            if (asset) {
                const assetId = asset.get('id');
                console.log('[PajamaDot] Opening character editor window for asset:', assetId);
                editor.call('pajamadot:character:window:open', assetId);
            }
        }
    });

    // Add "View Location" context menu item for location assets
    editor.call('assets:contextmenu:add', {
        text: 'View Location Details',
        icon: 'E139',
        onIsVisible: (asset: any) => {
            return isAssetType(asset, NAME_SUFFIXES.LOCATION);
        },
        onSelect: (asset: any) => {
            if (asset) {
                editor.call('selector:set', 'asset', [asset]);
            }
        }
    });

    // Add "Open Location Editor" context menu item for location assets
    editor.call('assets:contextmenu:add', {
        text: 'Open Location Editor',
        icon: 'E135',
        onIsVisible: (asset: any) => {
            return isAssetType(asset, NAME_SUFFIXES.LOCATION);
        },
        onSelect: (asset: any) => {
            if (asset) {
                const assetId = asset.get('id');
                console.log('[PajamaDot] Opening location editor window for asset:', assetId);
                editor.call('pajamadot:location:window:open', assetId);
            }
        }
    });

    // Add "View Item" context menu item for item assets
    editor.call('assets:contextmenu:add', {
        text: 'View Item Details',
        icon: 'E195',
        onIsVisible: (asset: any) => {
            return isAssetType(asset, NAME_SUFFIXES.ITEM);
        },
        onSelect: (asset: any) => {
            if (asset) {
                editor.call('selector:set', 'asset', [asset]);
            }
        }
    });

    // Add "Open Item Editor" context menu item for item assets
    editor.call('assets:contextmenu:add', {
        text: 'Open Item Editor',
        icon: 'E135',
        onIsVisible: (asset: any) => {
            return isAssetType(asset, NAME_SUFFIXES.ITEM);
        },
        onSelect: (asset: any) => {
            if (asset) {
                const assetId = asset.get('id');
                console.log('[PajamaDot] Opening item editor window for asset:', assetId);
                editor.call('pajamadot:item:window:open', assetId);
            }
        }
    });

    console.log('[PajamaDot] Inspector integration registered');
});

console.log('[PajamaDot] Inspector integration loaded');

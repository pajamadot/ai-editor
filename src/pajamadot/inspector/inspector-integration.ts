/**
 * PajamaDot Inspector Integration
 *
 * Adds context menu items for PajamaDot YAML story assets.
 * Identifies assets by their filename extension pattern:
 * - *.storygraph.yaml - Story graphs
 * - *.character.yaml - Characters
 * - *.location.yaml - Locations
 * - *.item.yaml - Items
 */

// Note: Detection is based on asset name suffix, not filename

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

editor.once('load', () => {
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

    console.log('[PajamaDot] Context menu items registered');
});

console.log('[PajamaDot] Inspector integration loaded');

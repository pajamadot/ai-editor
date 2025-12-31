/**
 * Item API
 * MCP-compatible methods for manipulating item assets
 */

import { PAJAMADOT_ASSET_TYPES } from '../constants';
import type { StoryItemData } from '../types';

declare const editor: any;

editor.once('load', () => {
    /**
     * Get an item by asset ID
     */
    editor.method('pajamadot:item:get', (assetId: number | string): StoryItemData | null => {
        // If string, try to find by name or meta
        if (typeof assetId === 'string') {
            const assets = editor.call('assets:list');
            for (const asset of assets) {
                const pajamadotType = asset.get('meta.pajamadot_type');
                if (pajamadotType === PAJAMADOT_ASSET_TYPES.ITEM) {
                    if (asset.get('id') === assetId || asset.get('name') === assetId) {
                        return asset.get('data') as StoryItemData;
                    }
                }
            }
            return null;
        }

        const asset = editor.call('assets:get', assetId);
        if (!asset) return null;

        const pajamadotType = asset.get('meta.pajamadot_type');
        if (pajamadotType !== PAJAMADOT_ASSET_TYPES.ITEM) {
            return null;
        }

        return asset.get('data') as StoryItemData;
    });

    /**
     * List all item assets
     */
    editor.method('pajamadot:item:list', () => {
        const assets = editor.call('assets:list');
        const items: any[] = [];

        for (const asset of assets) {
            const pajamadotType = asset.get('meta.pajamadot_type');
            if (pajamadotType === PAJAMADOT_ASSET_TYPES.ITEM) {
                items.push({
                    id: asset.get('id'),
                    name: asset.get('name'),
                    data: asset.get('data')
                });
            }
        }

        return items;
    });

    /**
     * Create a new item asset
     */
    editor.method('pajamadot:item:create', (
        data: Partial<StoryItemData>,
        options: { parent?: number } = {}
    ) => {
        return new Promise((resolve, reject) => {
            editor.call('assets:create:storyitem', {
                name: data.name || 'New Item',
                data,
                parent: options.parent,
                callback: (err: Error | null, asset: any) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            id: asset.get('id'),
                            name: asset.get('name'),
                            data: asset.get('data')
                        });
                    }
                }
            });
        });
    });

    /**
     * Update an item
     */
    editor.method('pajamadot:item:update', (
        assetId: number,
        updates: Partial<StoryItemData>
    ): boolean => {
        const asset = editor.call('assets:get', assetId);
        if (!asset) return false;

        const pajamadotType = asset.get('meta.pajamadot_type');
        if (pajamadotType !== PAJAMADOT_ASSET_TYPES.ITEM) {
            return false;
        }

        const currentData = asset.get('data') || {};
        const updatedData = { ...currentData, ...updates };
        asset.set('data', updatedData);

        // Update asset name if item name changed
        if (updates.name) {
            asset.set('name', updates.name);
        }

        return true;
    });

    console.log('[PajamaDot] Item API registered');
});

/**
 * Location API
 * MCP-compatible methods for manipulating location assets
 */

import { PAJAMADOT_ASSET_TYPES } from '../constants';
import type { StoryLocationData } from '../types';

declare const editor: any;

editor.once('load', () => {
    /**
     * Get a location by asset ID
     */
    editor.method('pajamadot:location:get', (assetId: number | string): StoryLocationData | null => {
        // If string, try to find by name or meta
        if (typeof assetId === 'string') {
            const assets = editor.call('assets:list');
            for (const asset of assets) {
                const pajamadotType = asset.get('meta.pajamadot_type');
                if (pajamadotType === PAJAMADOT_ASSET_TYPES.LOCATION) {
                    if (asset.get('id') === assetId || asset.get('name') === assetId) {
                        return asset.get('data') as StoryLocationData;
                    }
                }
            }
            return null;
        }

        const asset = editor.call('assets:get', assetId);
        if (!asset) return null;

        const pajamadotType = asset.get('meta.pajamadot_type');
        if (pajamadotType !== PAJAMADOT_ASSET_TYPES.LOCATION) {
            return null;
        }

        return asset.get('data') as StoryLocationData;
    });

    /**
     * List all location assets
     */
    editor.method('pajamadot:location:list', () => {
        const assets = editor.call('assets:list');
        const locations: any[] = [];

        for (const asset of assets) {
            const pajamadotType = asset.get('meta.pajamadot_type');
            if (pajamadotType === PAJAMADOT_ASSET_TYPES.LOCATION) {
                locations.push({
                    id: asset.get('id'),
                    name: asset.get('name'),
                    data: asset.get('data')
                });
            }
        }

        return locations;
    });

    /**
     * Create a new location asset
     */
    editor.method('pajamadot:location:create', (
        data: Partial<StoryLocationData>,
        options: { parent?: number } = {}
    ) => {
        return new Promise((resolve, reject) => {
            editor.call('assets:create:storylocation', {
                name: data.name || 'New Location',
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
     * Update a location
     */
    editor.method('pajamadot:location:update', (
        assetId: number,
        updates: Partial<StoryLocationData>
    ): boolean => {
        const asset = editor.call('assets:get', assetId);
        if (!asset) return false;

        const pajamadotType = asset.get('meta.pajamadot_type');
        if (pajamadotType !== PAJAMADOT_ASSET_TYPES.LOCATION) {
            return false;
        }

        const currentData = asset.get('data') || {};
        const updatedData = { ...currentData, ...updates };
        asset.set('data', updatedData);

        // Update asset name if location name changed
        if (updates.name) {
            asset.set('name', updates.name);
        }

        return true;
    });

    /**
     * Connect two locations
     */
    editor.method('pajamadot:location:connect', (
        assetId: number,
        targetLocationId: string
    ): boolean => {
        const asset = editor.call('assets:get', assetId);
        if (!asset) return false;

        const connected = asset.get('data.connectedLocations') || [];
        if (connected.includes(targetLocationId)) return false;

        connected.push(targetLocationId);
        asset.set('data.connectedLocations', connected);

        return true;
    });

    /**
     * Disconnect two locations
     */
    editor.method('pajamadot:location:disconnect', (
        assetId: number,
        targetLocationId: string
    ): boolean => {
        const asset = editor.call('assets:get', assetId);
        if (!asset) return false;

        const connected = asset.get('data.connectedLocations') || [];
        const index = connected.indexOf(targetLocationId);
        if (index === -1) return false;

        connected.splice(index, 1);
        asset.set('data.connectedLocations', connected);

        return true;
    });

    console.log('[PajamaDot] Location API registered');
});

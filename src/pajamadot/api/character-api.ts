/**
 * Character API
 * MCP-compatible methods for manipulating character assets
 */

import { PAJAMADOT_ASSET_TYPES } from '../constants';
import type { StoryCharacterData } from '../types';

declare const editor: any;

editor.once('load', () => {
    /**
     * Get a character by asset ID
     */
    editor.method('pajamadot:character:get', (assetId: number | string): StoryCharacterData | null => {
        // If string, try to find by name or meta
        if (typeof assetId === 'string') {
            const assets = editor.call('assets:list');
            for (const asset of assets) {
                const pajamadotType = asset.get('meta.pajamadot_type');
                if (pajamadotType === PAJAMADOT_ASSET_TYPES.CHARACTER) {
                    if (asset.get('id') === assetId || asset.get('name') === assetId) {
                        return asset.get('data') as StoryCharacterData;
                    }
                }
            }
            return null;
        }

        const asset = editor.call('assets:get', assetId);
        if (!asset) return null;

        const pajamadotType = asset.get('meta.pajamadot_type');
        if (pajamadotType !== PAJAMADOT_ASSET_TYPES.CHARACTER) {
            return null;
        }

        return asset.get('data') as StoryCharacterData;
    });

    /**
     * List all character assets
     */
    editor.method('pajamadot:character:list', () => {
        const assets = editor.call('assets:list');
        const characters: any[] = [];

        for (const asset of assets) {
            const pajamadotType = asset.get('meta.pajamadot_type');
            if (pajamadotType === PAJAMADOT_ASSET_TYPES.CHARACTER) {
                characters.push({
                    id: asset.get('id'),
                    name: asset.get('name'),
                    data: asset.get('data')
                });
            }
        }

        return characters;
    });

    /**
     * Create a new character asset
     */
    editor.method('pajamadot:character:create', (
        data: Partial<StoryCharacterData>,
        options: { parent?: number } = {}
    ) => {
        return new Promise((resolve, reject) => {
            editor.call('assets:create:storycharacter', {
                name: data.name || 'New Character',
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
     * Update a character
     */
    editor.method('pajamadot:character:update', (
        assetId: number,
        updates: Partial<StoryCharacterData>
    ): boolean => {
        const asset = editor.call('assets:get', assetId);
        if (!asset) return false;

        const pajamadotType = asset.get('meta.pajamadot_type');
        if (pajamadotType !== PAJAMADOT_ASSET_TYPES.CHARACTER) {
            return false;
        }

        const currentData = asset.get('data') || {};
        const updatedData = { ...currentData, ...updates };
        asset.set('data', updatedData);

        // Update asset name if character name changed
        if (updates.name) {
            asset.set('name', updates.name);
        }

        return true;
    });

    /**
     * Add a trait to a character
     */
    editor.method('pajamadot:character:addTrait', (
        assetId: number,
        trait: string
    ): boolean => {
        const asset = editor.call('assets:get', assetId);
        if (!asset) return false;

        const traits = asset.get('data.traits') || [];
        if (traits.includes(trait)) return false;

        traits.push(trait);
        asset.set('data.traits', traits);

        return true;
    });

    /**
     * Remove a trait from a character
     */
    editor.method('pajamadot:character:removeTrait', (
        assetId: number,
        trait: string
    ): boolean => {
        const asset = editor.call('assets:get', assetId);
        if (!asset) return false;

        const traits = asset.get('data.traits') || [];
        const index = traits.indexOf(trait);
        if (index === -1) return false;

        traits.splice(index, 1);
        asset.set('data.traits', traits);

        return true;
    });

    /**
     * Add a relationship
     */
    editor.method('pajamadot:character:addRelationship', (
        assetId: number,
        relationship: {
            characterId: string;
            type: string;
            description: string;
        }
    ): boolean => {
        const asset = editor.call('assets:get', assetId);
        if (!asset) return false;

        const relationships = asset.get('data.relationships') || [];
        relationships.push(relationship);
        asset.set('data.relationships', relationships);

        return true;
    });

    console.log('[PajamaDot] Character API registered');
});

/**
 * Persistence API
 * Methods for saving and loading story data to/from files
 */

import { PAJAMADOT_ASSET_TYPES } from '../constants';
import type { StoryGraphData, StoryCharacterData, StoryLocationData, StoryItemData } from '../types';

declare const editor: any;

interface ExportedStoryBundle {
    version: number;
    exportedAt: string;
    story: {
        id: number;
        name: string;
        data: StoryGraphData;
    } | null;
    characters: Array<{
        id: number;
        name: string;
        data: StoryCharacterData;
    }>;
    locations: Array<{
        id: number;
        name: string;
        data: StoryLocationData;
    }>;
    items: Array<{
        id: number;
        name: string;
        data: StoryItemData;
    }>;
}

editor.once('load', () => {
    /**
     * Export a story graph and all related assets to JSON
     */
    editor.method('pajamadot:export:story', (assetId: number): ExportedStoryBundle | null => {
        const asset = editor.call('assets:get', assetId);
        if (!asset) return null;

        const pajamadotType = asset.get('meta.pajamadot_type');
        if (pajamadotType !== PAJAMADOT_ASSET_TYPES.STORY_GRAPH) {
            console.warn('[PajamaDot] Asset is not a story graph');
            return null;
        }

        const storyData = asset.get('data') as StoryGraphData;

        // Collect referenced characters and locations
        const characterIds = new Set<string>();
        const locationIds = new Set<string>();

        if (storyData.nodes) {
            for (const node of Object.values(storyData.nodes)) {
                if (node.nodeType === 'scene') {
                    if (node.locationId) {
                        locationIds.add(node.locationId);
                    }
                    for (const char of node.characters || []) {
                        characterIds.add(char.characterId);
                    }
                }
            }
        }

        // Get character data
        const characters = editor.call('pajamadot:character:list') || [];
        const exportedCharacters = characters.filter((c: any) =>
            characterIds.has(String(c.id)) || characterIds.has(c.name)
        );

        // Get location data
        const locations = editor.call('pajamadot:location:list') || [];
        const exportedLocations = locations.filter((l: any) =>
            locationIds.has(String(l.id)) || locationIds.has(l.name)
        );

        // Get item data (export all for now)
        const items = editor.call('pajamadot:item:list') || [];

        const bundle: ExportedStoryBundle = {
            version: 1,
            exportedAt: new Date().toISOString(),
            story: {
                id: asset.get('id'),
                name: asset.get('name'),
                data: storyData
            },
            characters: exportedCharacters,
            locations: exportedLocations,
            items: items
        };

        return bundle;
    });

    /**
     * Export story to downloadable JSON file
     */
    editor.method('pajamadot:export:download', (assetId: number) => {
        const bundle = editor.call('pajamadot:export:story', assetId);
        if (!bundle) {
            console.error('[PajamaDot] Failed to export story');
            return;
        }

        const json = JSON.stringify(bundle, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${bundle.story?.name || 'story'}-export.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('[PajamaDot] Story exported:', a.download);
    });

    /**
     * Import a story bundle from JSON
     */
    editor.method('pajamadot:import:story', async (bundle: ExportedStoryBundle): Promise<{
        storyAssetId: number | null;
        characterAssetIds: number[];
        locationAssetIds: number[];
        itemAssetIds: number[];
    }> => {
        const result = {
            storyAssetId: null as number | null,
            characterAssetIds: [] as number[],
            locationAssetIds: [] as number[],
            itemAssetIds: [] as number[]
        };

        // Import characters first (story may reference them)
        for (const char of bundle.characters) {
            try {
                const created = await editor.call('pajamadot:character:create', char.data);
                if (created) {
                    result.characterAssetIds.push(created.id);
                }
            } catch (e) {
                console.error('[PajamaDot] Failed to import character:', char.name, e);
            }
        }

        // Import locations
        for (const loc of bundle.locations) {
            try {
                const created = await editor.call('pajamadot:location:create', loc.data);
                if (created) {
                    result.locationAssetIds.push(created.id);
                }
            } catch (e) {
                console.error('[PajamaDot] Failed to import location:', loc.name, e);
            }
        }

        // Import items
        for (const item of bundle.items) {
            try {
                const created = await editor.call('pajamadot:item:create', item.data);
                if (created) {
                    result.itemAssetIds.push(created.id);
                }
            } catch (e) {
                console.error('[PajamaDot] Failed to import item:', item.name, e);
            }
        }

        // Import story graph
        if (bundle.story) {
            try {
                const storyAsset = await new Promise<any>((resolve, reject) => {
                    editor.call('assets:create:storygraph', {
                        name: bundle.story!.name,
                        callback: (err: Error | null, asset: any) => {
                            if (err) reject(err);
                            else resolve(asset);
                        }
                    });
                });

                if (storyAsset) {
                    // Update with imported data
                    storyAsset.set('data', bundle.story.data);
                    result.storyAssetId = storyAsset.get('id');
                }
            } catch (e) {
                console.error('[PajamaDot] Failed to import story graph:', e);
            }
        }

        console.log('[PajamaDot] Import complete:', result);
        return result;
    });

    /**
     * Import from file picker
     */
    editor.method('pajamadot:import:fromFile', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            try {
                const text = await file.text();
                const bundle = JSON.parse(text) as ExportedStoryBundle;

                // Validate bundle
                if (!bundle.version || !bundle.story) {
                    throw new Error('Invalid story bundle format');
                }

                const result = await editor.call('pajamadot:import:story', bundle);
                console.log('[PajamaDot] Imported from file:', result);

                // Select the imported story
                if (result.storyAssetId) {
                    const asset = editor.call('assets:get', result.storyAssetId);
                    if (asset) {
                        editor.call('selector:set', 'asset', [asset]);
                    }
                }
            } catch (err) {
                console.error('[PajamaDot] Failed to import file:', err);
                alert('Failed to import story file. Please check the file format.');
            }
        };

        input.click();
    });

    /**
     * Save current story graph data to localStorage (for local backup)
     */
    editor.method('pajamadot:local:save', (assetId: number) => {
        const bundle = editor.call('pajamadot:export:story', assetId);
        if (!bundle) return false;

        const key = `pajamadot:backup:${assetId}`;
        try {
            localStorage.setItem(key, JSON.stringify(bundle));
            localStorage.setItem(`${key}:timestamp`, new Date().toISOString());
            console.log('[PajamaDot] Saved local backup:', key);
            return true;
        } catch (e) {
            console.error('[PajamaDot] Failed to save local backup:', e);
            return false;
        }
    });

    /**
     * Load story graph from localStorage backup
     */
    editor.method('pajamadot:local:load', (assetId: number): ExportedStoryBundle | null => {
        const key = `pajamadot:backup:${assetId}`;
        try {
            const data = localStorage.getItem(key);
            if (!data) return null;
            return JSON.parse(data) as ExportedStoryBundle;
        } catch (e) {
            console.error('[PajamaDot] Failed to load local backup:', e);
            return null;
        }
    });

    /**
     * List all local backups
     */
    editor.method('pajamadot:local:list', (): Array<{ assetId: string; timestamp: string }> => {
        const backups: Array<{ assetId: string; timestamp: string }> = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith('pajamadot:backup:') && !key.endsWith(':timestamp')) {
                const assetId = key.replace('pajamadot:backup:', '');
                const timestamp = localStorage.getItem(`${key}:timestamp`) || 'unknown';
                backups.push({ assetId, timestamp });
            }
        }

        return backups;
    });

    /**
     * Clear a local backup
     */
    editor.method('pajamadot:local:clear', (assetId: number) => {
        const key = `pajamadot:backup:${assetId}`;
        localStorage.removeItem(key);
        localStorage.removeItem(`${key}:timestamp`);
    });

    console.log('[PajamaDot] Persistence API registered');
});

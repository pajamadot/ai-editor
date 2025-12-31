/**
 * Story Graph API
 * MCP-compatible methods for manipulating story graphs
 */

import { FILE_PATTERNS } from '../yaml';
import {
    loadYamlData,
    getCachedData,
    setCachedDataPath,
    getCachedDataPath,
    saveYamlData,
    isDataCached,
    getAssetPajamaDotType
} from '../yaml-data-manager';
import {
    generateId,
    getTimestamp,
    getDefaultStoryGraphData,
    findSceneNodes,
    findStartNode,
    findEndNodes,
    getOutgoingEdges,
    getIncomingEdges,
    validateStoryGraph,
    generateStorySummary
} from '../utils';
import type { StoryGraphData, StoryNode, StoryEdge, SceneNode } from '../types';

declare const editor: any;

/**
 * Check if an asset is a story graph by filename
 */
function isStoryGraphAsset(asset: any): boolean {
    const filename = asset.get('file.filename') || asset.get('filename') || '';
    return filename.endsWith(FILE_PATTERNS.STORY_GRAPH);
}

editor.once('load', () => {
    /**
     * Get a story graph asset data by ID
     * Returns cached data or loads from file
     */
    editor.method('pajamadot:story:get', async (assetId: number): Promise<StoryGraphData | null> => {
        const asset = editor.call('assets:get', assetId);
        if (!asset) {
            console.warn(`[PajamaDot] Asset not found: ${assetId}`);
            return null;
        }

        if (!isStoryGraphAsset(asset)) {
            console.warn(`[PajamaDot] Asset ${assetId} is not a story graph`);
            return null;
        }

        // Try to get cached data first
        let data = getCachedData<StoryGraphData>(assetId);
        if (!data) {
            // Load from file
            data = await loadYamlData<StoryGraphData>(assetId);
        }

        return data;
    });

    /**
     * Get story graph data synchronously (requires prior load)
     */
    editor.method('pajamadot:story:getSync', (assetId: number): StoryGraphData | null => {
        return getCachedData<StoryGraphData>(assetId);
    });

    /**
     * Ensure story data is loaded
     */
    editor.method('pajamadot:story:ensureLoaded', async (assetId: number): Promise<boolean> => {
        if (isDataCached(assetId)) {
            return true;
        }

        const data = await loadYamlData<StoryGraphData>(assetId);
        return data !== null;
    });

    /**
     * Get full story context for AI consumption
     * Includes story data, characters, locations
     */
    editor.method('pajamadot:story:getContext', async (assetId: number) => {
        const asset = editor.call('assets:get', assetId);
        if (!asset) {
            return null;
        }

        // Ensure data is loaded
        let data = getCachedData<StoryGraphData>(assetId);
        if (!data) {
            data = await loadYamlData<StoryGraphData>(assetId);
        }

        if (!data) {
            return null;
        }

        // Collect all referenced character and location IDs
        const characterIds = new Set<string>();
        const locationIds = new Set<string>();

        const scenes = findSceneNodes(data);
        for (const scene of scenes) {
            if (scene.locationId) {
                locationIds.add(scene.locationId);
            }
            for (const char of scene.characters) {
                characterIds.add(char.characterId);
            }
        }

        // Get character data
        const characters: any[] = [];
        for (const charId of characterIds) {
            const charData = await editor.call('pajamadot:character:get', charId);
            if (charData) {
                characters.push(charData);
            }
        }

        // Get location data
        const locations: any[] = [];
        for (const locId of locationIds) {
            const locData = await editor.call('pajamadot:location:get', locId);
            if (locData) {
                locations.push(locData);
            }
        }

        // Generate summary
        const summary = generateStorySummary(data);

        // Validate structure
        const validation = validateStoryGraph(data);

        return {
            assetId,
            story: data,
            characters,
            locations,
            summary,
            validation
        };
    });

    /**
     * List all story graph assets in the project
     */
    editor.method('pajamadot:story:list', () => {
        const assets = editor.call('assets:list');
        const storyGraphs: any[] = [];

        for (const asset of assets) {
            if (isStoryGraphAsset(asset)) {
                storyGraphs.push({
                    id: asset.get('id'),
                    name: asset.get('name'),
                    filename: asset.get('file.filename') || asset.get('filename')
                });
            }
        }

        return storyGraphs;
    });

    /**
     * Create a new story graph asset
     */
    editor.method('pajamadot:story:create', (options: {
        name?: string;
        title?: string;
        description?: string;
        parent?: number;
    } = {}) => {
        return new Promise((resolve, reject) => {
            editor.call('assets:create:storygraph', {
                name: options.name || options.title || 'New Story',
                parent: options.parent,
                callback: (err: Error | null, asset: any) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            id: asset.get('id'),
                            name: asset.get('name')
                        });
                    }
                }
            });
        });
    });

    /**
     * Update story metadata
     */
    editor.method('pajamadot:story:updateMetadata', async (
        assetId: number,
        metadata: Partial<StoryGraphData['metadata']>
    ) => {
        // Ensure data is loaded
        let data = getCachedData<StoryGraphData>(assetId);
        if (!data) {
            data = await loadYamlData<StoryGraphData>(assetId);
        }

        if (!data) {
            return false;
        }

        const currentMetadata = data.metadata || {};
        const updatedMetadata = {
            ...currentMetadata,
            ...metadata,
            updatedAt: getTimestamp()
        };

        setCachedDataPath(assetId, 'metadata', updatedMetadata);

        // Save changes
        await saveYamlData(assetId);
        return true;
    });

    /**
     * Validate a story graph
     */
    editor.method('pajamadot:story:validate', async (assetId: number) => {
        const data = await editor.call('pajamadot:story:get', assetId);
        if (!data) {
            return { valid: false, errors: ['Story graph not found'] };
        }

        return validateStoryGraph(data);
    });

    /**
     * Get a summary of the story (for AI context)
     */
    editor.method('pajamadot:story:getSummary', async (assetId: number) => {
        const data = await editor.call('pajamadot:story:get', assetId);
        if (!data) {
            return null;
        }

        return generateStorySummary(data);
    });

    /**
     * Save story graph data
     */
    editor.method('pajamadot:story:save', async (assetId: number) => {
        return saveYamlData(assetId);
    });

    console.log('[PajamaDot] Story API registered');
});

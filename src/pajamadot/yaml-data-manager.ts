/**
 * YAML Data Manager
 *
 * Handles loading, caching, and saving YAML data from text assets.
 * Since YAML files are stored as 'text' type in PlayCanvas, the content
 * is in a file that needs to be fetched and parsed.
 */

import { fromYaml, toYaml } from './yaml';
import type { StoryGraphData } from './types';

declare const editor: any;

// Cache for loaded YAML data
// Key: asset ID, Value: parsed data
const dataCache = new Map<number, any>();

// Track which assets have unsaved changes
const dirtyAssets = new Set<number>();

// Name suffixes for PajamaDot asset types
const NAME_SUFFIXES = {
    STORY_GRAPH: '.storygraph',
    CHARACTER: '.character',
    LOCATION: '.location',
    ITEM: '.item'
};

/**
 * Check if an asset is a PajamaDot YAML asset by name suffix
 */
export function isPajamaDotYamlAsset(asset: any): boolean {
    if (!asset) return false;
    const name = asset.get('name') || '';
    return Object.values(NAME_SUFFIXES).some(suffix => name.endsWith(suffix));
}

/**
 * Get the PajamaDot type of an asset by name suffix
 */
export function getAssetPajamaDotType(asset: any): string | null {
    if (!asset) return null;
    const name = asset.get('name') || '';

    if (name.endsWith(NAME_SUFFIXES.STORY_GRAPH)) return 'storygraph';
    if (name.endsWith(NAME_SUFFIXES.CHARACTER)) return 'character';
    if (name.endsWith(NAME_SUFFIXES.LOCATION)) return 'location';
    if (name.endsWith(NAME_SUFFIXES.ITEM)) return 'item';

    return null;
}

/**
 * Load YAML data from an asset
 * Returns cached data if available, otherwise fetches and parses
 */
export async function loadYamlData<T = any>(assetId: number): Promise<T | null> {
    // Check cache first
    if (dataCache.has(assetId)) {
        return dataCache.get(assetId) as T;
    }

    const asset = editor.call('assets:get', assetId);
    if (!asset) {
        console.warn(`[PajamaDot] Asset not found: ${assetId}`);
        return null;
    }

    // Get file URL
    const fileUrl = asset.get('file.url');
    if (!fileUrl) {
        console.warn(`[PajamaDot] Asset has no file URL: ${assetId}`);
        return null;
    }

    try {
        // Fetch the file content
        const response = await fetch(fileUrl);
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const yamlText = await response.text();
        const data = fromYaml(yamlText) as T;

        // Cache the parsed data
        dataCache.set(assetId, data);

        console.log(`[PajamaDot] Loaded YAML data for asset ${assetId}`);
        return data;
    } catch (err) {
        console.error(`[PajamaDot] Failed to load YAML data for asset ${assetId}:`, err);
        return null;
    }
}

/**
 * Get cached YAML data for an asset (sync version)
 * Returns null if not loaded yet - use loadYamlData to load first
 */
export function getCachedData<T = any>(assetId: number): T | null {
    return dataCache.get(assetId) as T ?? null;
}

/**
 * Check if data is cached for an asset
 */
export function isDataCached(assetId: number): boolean {
    return dataCache.has(assetId);
}

/**
 * Update cached data and mark as dirty
 */
export function updateCachedData(assetId: number, data: any): void {
    dataCache.set(assetId, data);
    dirtyAssets.add(assetId);
}

/**
 * Set a specific path in the cached data
 */
export function setCachedDataPath(assetId: number, path: string, value: any): boolean {
    const data = dataCache.get(assetId);
    if (!data) {
        console.warn(`[PajamaDot] No cached data for asset ${assetId}`);
        return false;
    }

    // Parse the path and set the value
    const parts = path.split('.');
    let current = data;

    for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i];
        if (current[key] === undefined) {
            current[key] = {};
        }
        current = current[key];
    }

    const lastKey = parts[parts.length - 1];
    current[lastKey] = value;

    dirtyAssets.add(assetId);
    return true;
}

/**
 * Get a specific path from cached data
 */
export function getCachedDataPath<T = any>(assetId: number, path: string): T | undefined {
    const data = dataCache.get(assetId);
    if (!data) return undefined;

    const parts = path.split('.');
    let current = data;

    for (const key of parts) {
        if (current === undefined || current === null) {
            return undefined;
        }
        current = current[key];
    }

    return current as T;
}

/**
 * Save YAML data back to the asset file
 */
export async function saveYamlData(assetId: number): Promise<boolean> {
    const data = dataCache.get(assetId);
    if (!data) {
        console.warn(`[PajamaDot] No cached data to save for asset ${assetId}`);
        return false;
    }

    const asset = editor.call('assets:get', assetId);
    if (!asset) {
        console.warn(`[PajamaDot] Asset not found: ${assetId}`);
        return false;
    }

    try {
        const yamlText = toYaml(data);
        const blob = new Blob([yamlText], { type: 'text/yaml' });

        // Use PlayCanvas asset update API
        await new Promise<void>((resolve, reject) => {
            editor.call('assets:uploadFile', { asset, file: blob }, (err: Error | null) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });

        dirtyAssets.delete(assetId);
        console.log(`[PajamaDot] Saved YAML data for asset ${assetId}`);
        return true;
    } catch (err) {
        console.error(`[PajamaDot] Failed to save YAML data for asset ${assetId}:`, err);
        return false;
    }
}

/**
 * Check if an asset has unsaved changes
 */
export function hasUnsavedChanges(assetId: number): boolean {
    return dirtyAssets.has(assetId);
}

/**
 * Clear cache for an asset
 */
export function clearCache(assetId: number): void {
    dataCache.delete(assetId);
    dirtyAssets.delete(assetId);
}

/**
 * Clear all cache
 */
export function clearAllCache(): void {
    dataCache.clear();
    dirtyAssets.clear();
}

/**
 * Get all dirty asset IDs
 */
export function getDirtyAssets(): number[] {
    return Array.from(dirtyAssets);
}

// Register editor methods for YAML data management
editor.once('load', () => {
    /**
     * Load YAML data for an asset
     */
    editor.method('pajamadot:yaml:load', async (assetId: number) => {
        return loadYamlData(assetId);
    });

    /**
     * Get cached YAML data for an asset
     */
    editor.method('pajamadot:yaml:get', (assetId: number) => {
        return getCachedData(assetId);
    });

    /**
     * Set a path in YAML data
     */
    editor.method('pajamadot:yaml:set', (assetId: number, path: string, value: any) => {
        return setCachedDataPath(assetId, path, value);
    });

    /**
     * Get a path from YAML data
     */
    editor.method('pajamadot:yaml:getPath', (assetId: number, path: string) => {
        return getCachedDataPath(assetId, path);
    });

    /**
     * Save YAML data to asset
     */
    editor.method('pajamadot:yaml:save', async (assetId: number) => {
        return saveYamlData(assetId);
    });

    /**
     * Check if asset has unsaved changes
     */
    editor.method('pajamadot:yaml:isDirty', (assetId: number) => {
        return hasUnsavedChanges(assetId);
    });

    /**
     * Clear cache for asset
     */
    editor.method('pajamadot:yaml:clearCache', (assetId: number) => {
        clearCache(assetId);
    });

    console.log('[PajamaDot] YAML data manager registered');
});

export {
    loadYamlData as loadData,
    getCachedData as getData,
    setCachedDataPath as setDataPath,
    getCachedDataPath as getDataPath,
    saveYamlData as saveData
};

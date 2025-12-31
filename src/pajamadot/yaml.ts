/**
 * Simple YAML utilities for PajamaDot
 * Uses js-yaml library for parsing and stringifying
 */

import * as jsYaml from 'js-yaml';

/**
 * Convert JavaScript object to YAML string
 */
export function toYaml(data: any): string {
    return jsYaml.dump(data, {
        indent: 2,
        lineWidth: -1, // Don't wrap lines
        noRefs: true,  // Don't use anchors/aliases
        sortKeys: false // Preserve key order
    });
}

/**
 * Parse YAML string to JavaScript object
 */
export function fromYaml(yaml: string): any {
    return jsYaml.load(yaml);
}

/**
 * File extension patterns for PajamaDot assets
 */
export const FILE_PATTERNS = {
    STORY_GRAPH: '.storygraph.yaml',
    CHARACTER: '.character.yaml',
    LOCATION: '.location.yaml',
    ITEM: '.item.yaml'
};

/**
 * Check if filename matches a PajamaDot pattern
 */
export function getPajamaDotType(filename: string): string | null {
    if (!filename) return null;

    if (filename.endsWith(FILE_PATTERNS.STORY_GRAPH)) return 'storygraph';
    if (filename.endsWith(FILE_PATTERNS.CHARACTER)) return 'character';
    if (filename.endsWith(FILE_PATTERNS.LOCATION)) return 'location';
    if (filename.endsWith(FILE_PATTERNS.ITEM)) return 'item';

    return null;
}

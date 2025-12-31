/**
 * Item Types
 * Item definitions for story narrative
 */

export interface StoryItemData {
    name: string;
    description: string;

    // Visual assets
    iconAssetId?: number;           // PlayCanvas texture asset (2D icon)
    modelAssetId?: number;          // PlayCanvas model asset (3D)
    spriteAssetId?: number;         // PlayCanvas sprite asset

    // Item classification
    itemType: string;               // e.g., 'key', 'weapon', 'consumable', 'quest'

    // Item properties (game-specific)
    properties: Record<string, unknown>;

    // Can this item be used?
    usable: boolean;

    // Can this item be combined with others?
    combinable: boolean;
    combinesWith?: string[];        // Item IDs this can combine with

    // Stackable items
    stackable: boolean;
    maxStack?: number;

    // Additional metadata
    metadata: Record<string, unknown>;
}

// Default item data
export function getDefaultItemData(): StoryItemData {
    return {
        name: 'New Item',
        description: '',
        itemType: 'misc',
        properties: {},
        usable: false,
        combinable: false,
        stackable: false,
        metadata: {}
    };
}

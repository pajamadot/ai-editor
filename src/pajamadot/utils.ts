/**
 * PajamaDot Story Utilities
 */

import { STORY_GRAPH_VERSION, PAJAMADOT_ASSET_TYPES } from './constants';
import type {
    StoryGraphData,
    StoryNode,
    StoryEdge,
    SceneNode,
    StartNode,
    EndNode
} from './types';

/**
 * Generate a unique ID
 */
export function generateId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get current timestamp in ISO format
 */
export function getTimestamp(): string {
    return new Date().toISOString();
}

/**
 * Create default story graph data
 */
export function getDefaultStoryGraphData(): StoryGraphData {
    const startNodeId = generateId();

    return {
        version: STORY_GRAPH_VERSION,
        metadata: {
            title: 'Untitled Story',
            description: '',
            createdAt: getTimestamp(),
            updatedAt: getTimestamp()
        },
        nodes: {
            [startNodeId]: {
                id: startNodeId,
                nodeType: 'start',
                posX: 100,
                posY: 200,
                name: 'Start'
            } as StartNode
        },
        edges: {}
    };
}

/**
 * Create a new scene node
 */
export function createSceneNode(partial: Partial<SceneNode> = {}): SceneNode {
    const id = partial.id ?? generateId();
    return {
        id,
        nodeType: 'scene',
        posX: partial.posX ?? 0,
        posY: partial.posY ?? 0,
        name: partial.name ?? 'New Scene',
        locationId: partial.locationId,
        characters: partial.characters ?? [],
        dialogues: partial.dialogues ?? [],
        choices: partial.choices ?? [],
        effects: partial.effects,
        entityTriggers: partial.entityTriggers
    };
}

/**
 * Create a new start node
 */
export function createStartNode(partial: Partial<StartNode> = {}): StartNode {
    const id = partial.id ?? generateId();
    return {
        id,
        nodeType: 'start',
        posX: partial.posX ?? 0,
        posY: partial.posY ?? 0,
        name: partial.name ?? 'Start'
    };
}

/**
 * Create a new end node
 */
export function createEndNode(partial: Partial<EndNode> = {}): EndNode {
    const id = partial.id ?? generateId();
    return {
        id,
        nodeType: 'end',
        posX: partial.posX ?? 0,
        posY: partial.posY ?? 0,
        name: partial.name ?? 'End',
        endingType: partial.endingType
    };
}

/**
 * Create a new edge
 */
export function createEdge(from: string, to: string, options: Partial<StoryEdge> = {}): StoryEdge {
    const id = options.id ?? generateId();
    return {
        id,
        from,
        to,
        edgeType: options.choiceId ? 'choice' : 'flow',
        choiceId: options.choiceId,
        condition: options.condition,
        priority: options.priority
    };
}

/**
 * Check if an asset is a PajamaDot asset type
 */
export function isPajamaDotAsset(asset: any): boolean {
    const type = asset?.get?.('meta.pajamadot_type') ?? asset?.meta?.pajamadot_type;
    return Object.values(PAJAMADOT_ASSET_TYPES).includes(type);
}

/**
 * Get PajamaDot asset type from asset
 */
export function getPajamaDotAssetType(asset: any): string | null {
    return asset?.get?.('meta.pajamadot_type') ?? asset?.meta?.pajamadot_type ?? null;
}

/**
 * Find all scene nodes in a story graph
 */
export function findSceneNodes(data: StoryGraphData): SceneNode[] {
    return Object.values(data.nodes).filter(
        (node): node is SceneNode => node.nodeType === 'scene'
    );
}

/**
 * Find the start node in a story graph
 */
export function findStartNode(data: StoryGraphData): StartNode | undefined {
    return Object.values(data.nodes).find(
        (node): node is StartNode => node.nodeType === 'start'
    );
}

/**
 * Find all end nodes in a story graph
 */
export function findEndNodes(data: StoryGraphData): EndNode[] {
    return Object.values(data.nodes).filter(
        (node): node is EndNode => node.nodeType === 'end'
    );
}

/**
 * Get all edges leading from a node
 */
export function getOutgoingEdges(data: StoryGraphData, nodeId: string): StoryEdge[] {
    return Object.values(data.edges).filter(edge => edge.from === nodeId);
}

/**
 * Get all edges leading to a node
 */
export function getIncomingEdges(data: StoryGraphData, nodeId: string): StoryEdge[] {
    return Object.values(data.edges).filter(edge => edge.to === nodeId);
}

/**
 * Get connected node IDs from a node
 */
export function getConnectedNodeIds(data: StoryGraphData, nodeId: string): string[] {
    const outgoing = getOutgoingEdges(data, nodeId).map(e => e.to);
    const incoming = getIncomingEdges(data, nodeId).map(e => e.from);
    return [...new Set([...outgoing, ...incoming])];
}

/**
 * Validate story graph structure
 */
export function validateStoryGraph(data: StoryGraphData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for start node
    const startNodes = Object.values(data.nodes).filter(n => n.nodeType === 'start');
    if (startNodes.length === 0) {
        errors.push('Story must have at least one start node');
    } else if (startNodes.length > 1) {
        errors.push('Story should have only one start node');
    }

    // Check for end node
    const endNodes = Object.values(data.nodes).filter(n => n.nodeType === 'end');
    if (endNodes.length === 0) {
        errors.push('Story should have at least one end node');
    }

    // Check for orphan nodes (except start)
    for (const node of Object.values(data.nodes)) {
        if (node.nodeType === 'start') continue;

        const incoming = getIncomingEdges(data, node.id);
        if (incoming.length === 0) {
            errors.push(`Node "${node.name}" (${node.id}) has no incoming connections`);
        }
    }

    // Check edge validity
    for (const edge of Object.values(data.edges)) {
        if (!data.nodes[edge.from]) {
            errors.push(`Edge ${edge.id} references non-existent source node ${edge.from}`);
        }
        if (!data.nodes[edge.to]) {
            errors.push(`Edge ${edge.id} references non-existent target node ${edge.to}`);
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Generate AI-friendly story summary
 */
export function generateStorySummary(data: StoryGraphData): string {
    const scenes = findSceneNodes(data);
    const characters = new Set<string>();
    const locations = new Set<string>();

    for (const scene of scenes) {
        if (scene.locationId) {
            locations.add(scene.locationId);
        }
        for (const char of scene.characters) {
            characters.add(char.characterId);
        }
    }

    const totalDialogues = scenes.reduce((sum, s) => sum + s.dialogues.length, 0);
    const totalChoices = scenes.reduce((sum, s) => sum + s.choices.length, 0);

    return `Story: "${data.metadata.title}"
Description: ${data.metadata.description || 'No description'}
Scenes: ${scenes.length}
Total Dialogues: ${totalDialogues}
Total Choices: ${totalChoices}
Unique Characters: ${characters.size}
Unique Locations: ${locations.size}
End Nodes: ${findEndNodes(data).length}`;
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
}

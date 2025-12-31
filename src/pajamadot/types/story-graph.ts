/**
 * Story Graph Types
 * Scene-centric design where scenes are the main interaction unit
 */

// Base node interface
interface BaseNode {
    id: string;
    posX: number;
    posY: number;
    name: string;
}

// Scene Node - The main interaction unit
export interface SceneNode extends BaseNode {
    nodeType: 'scene';

    // Scene context
    locationId?: string;           // Reference to location asset

    // Characters present in this scene
    characters: SceneCharacter[];

    // Dialogue sequence within this scene
    dialogues: Dialogue[];

    // Choices at end of scene (creates branching edges)
    choices: Choice[];

    // Optional scene effects
    effects?: SceneEffect[];

    // Entity triggers for PlayCanvas scene
    entityTriggers?: EntityTrigger[];
}

export interface SceneCharacter {
    characterId: string;         // Reference to character asset
    position?: 'left' | 'center' | 'right';
    expression?: string;
}

export interface Dialogue {
    id: string;
    speakerId?: string;          // Character ID or null for narration
    text: string;
    emotion?: string;
    voiceAssetId?: number;       // PlayCanvas audio asset
}

export interface Choice {
    id: string;
    text: string;
    condition?: string;          // Optional condition expression
    targetNodeId?: string;       // Can be set here or via edge
}

export interface SceneEffect {
    type: 'fadeIn' | 'fadeOut' | 'shake' | 'flash' | string;
    params?: Record<string, unknown>;
}

export interface EntityTrigger {
    tag: string;                    // Entity tag in scene
    action: 'show' | 'hide' | 'animate' | 'play' | string;
    params?: Record<string, unknown>;
}

// Start Node - Entry point
export interface StartNode extends BaseNode {
    nodeType: 'start';
}

// End Node - Story ending
export interface EndNode extends BaseNode {
    nodeType: 'end';
    endingType?: 'good' | 'bad' | 'neutral' | string;
}

// Union type for all node types
// Note: Conditions are handled on the Choice level within SceneNode, not as separate nodes
export type StoryNode = SceneNode | StartNode | EndNode;

// Edge connecting nodes
export interface StoryEdge {
    id: string;
    from: string;                  // Source node ID
    to: string;                    // Target node ID
    edgeType: 'flow' | 'choice';
    choiceId?: string;             // If from a choice
    condition?: string;            // Optional condition
    priority?: number;             // For condition ordering
}

// Story metadata
export interface StoryMetadata {
    title: string;
    description: string;
    coverAssetId?: number;      // PlayCanvas texture asset
    createdAt: string;
    updatedAt: string;
}

// Main Story Graph Data structure
export interface StoryGraphData {
    version: number;
    metadata: StoryMetadata;

    // Main graph structure
    nodes: {
        [id: string]: StoryNode;
    };

    edges: {
        [id: string]: StoryEdge;
    };
}

// Type guards
export function isSceneNode(node: StoryNode): node is SceneNode {
    return node.nodeType === 'scene';
}

export function isStartNode(node: StoryNode): node is StartNode {
    return node.nodeType === 'start';
}

export function isEndNode(node: StoryNode): node is EndNode {
    return node.nodeType === 'end';
}

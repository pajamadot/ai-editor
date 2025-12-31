/**
 * Story Graph Schema for pcui-graph
 * Defines node types and edge types for the story graph visualization
 */

import { STORY_NODE_TYPES, STORY_EDGE_TYPES, NODE_COLORS, EDGE_COLORS } from '../constants';

// Graph action event names (from pcui-graph)
export const GRAPH_ACTIONS = {
    ADD_NODE: 'EVENT_ADD_NODE',
    UPDATE_NODE_POSITION: 'EVENT_UPDATE_NODE_POSITION',
    UPDATE_NODE_ATTRIBUTE: 'EVENT_UPDATE_NODE_ATTRIBUTE',
    DELETE_NODE: 'EVENT_DELETE_NODE',
    SELECT_NODE: 'EVENT_SELECT_NODE',
    ADD_EDGE: 'EVENT_ADD_EDGE',
    DELETE_EDGE: 'EVENT_DELETE_EDGE',
    SELECT_EDGE: 'EVENT_SELECT_EDGE',
    DESELECT_ITEM: 'EVENT_DESELECT_ITEM',
    UPDATE_TRANSLATE: 'EVENT_UPDATE_TRANSLATE',
    UPDATE_SCALE: 'EVENT_UPDATE_SCALE'
} as const;

/**
 * Create the story graph schema
 * Scene-centric design: Scene nodes contain dialogues, choices, and character references
 */
export const createStoryGraphSchema = () => ({
    nodes: {
        // Scene Node - The main interaction unit
        [STORY_NODE_TYPES.SCENE]: {
            name: 'Scene',
            fill: NODE_COLORS.SCENE.fill,
            stroke: NODE_COLORS.SCENE.stroke,
            icon: '',
            iconColor: '#3b82f6',
            headerTextFormatter: (attributes: any) => attributes.name || 'Scene',
            contextMenuItems: [
                {
                    text: 'Add connection',
                    action: GRAPH_ACTIONS.ADD_EDGE,
                    edgeType: STORY_EDGE_TYPES.FLOW
                },
                {
                    text: 'Delete scene',
                    action: GRAPH_ACTIONS.DELETE_NODE
                }
            ],
            attributes: [
                {
                    name: 'name',
                    type: 'TEXT_INPUT'
                }
            ]
        },

        // Start Node - Entry point
        [STORY_NODE_TYPES.START]: {
            name: 'Start',
            fill: NODE_COLORS.START.fill,
            stroke: NODE_COLORS.START.stroke,
            icon: '',
            iconColor: '#22c55e',
            headerTextFormatter: () => 'Start',
            contextMenuItems: [
                {
                    text: 'Add connection',
                    action: GRAPH_ACTIONS.ADD_EDGE,
                    edgeType: STORY_EDGE_TYPES.FLOW
                }
            ],
            attributes: []
        },

        // End Node - Story ending
        [STORY_NODE_TYPES.END]: {
            name: 'End',
            fill: NODE_COLORS.END.fill,
            stroke: NODE_COLORS.END.stroke,
            icon: '',
            iconColor: '#ef4444',
            headerTextFormatter: (attributes: any) => attributes.endingType
                ? `End (${attributes.endingType})`
                : 'End',
            contextMenuItems: [
                {
                    text: 'Delete end',
                    action: GRAPH_ACTIONS.DELETE_NODE
                }
            ],
            attributes: [
                {
                    name: 'name',
                    type: 'TEXT_INPUT'
                },
                {
                    name: 'endingType',
                    type: 'TEXT_INPUT'
                }
            ]
        }
    },

    edges: {
        // Flow edge - Standard transition between nodes
        [STORY_EDGE_TYPES.FLOW]: {
            stroke: EDGE_COLORS.FLOW,
            strokeWidth: 2,
            targetMarker: true,
            from: [
                STORY_NODE_TYPES.START,
                STORY_NODE_TYPES.SCENE
            ],
            to: [
                STORY_NODE_TYPES.SCENE,
                STORY_NODE_TYPES.END
            ],
            contextMenuItems: [
                {
                    text: 'Delete connection',
                    action: GRAPH_ACTIONS.DELETE_EDGE
                }
            ]
        },

        // Choice edge - Connection from a choice
        [STORY_EDGE_TYPES.CHOICE]: {
            stroke: EDGE_COLORS.CHOICE,
            strokeWidth: 2,
            targetMarker: true,
            targetMarkerStroke: EDGE_COLORS.CHOICE,
            from: [
                STORY_NODE_TYPES.SCENE
            ],
            to: [
                STORY_NODE_TYPES.SCENE,
                STORY_NODE_TYPES.END
            ],
            contextMenuItems: [
                {
                    text: 'Delete choice connection',
                    action: GRAPH_ACTIONS.DELETE_EDGE
                }
            ]
        }
    }
});

/**
 * Context menu items for the graph canvas
 */
export const storyContextMenuItems = [
    {
        text: 'Add new scene',
        action: GRAPH_ACTIONS.ADD_NODE,
        nodeType: STORY_NODE_TYPES.SCENE,
        attributes: {
            name: 'New Scene'
        }
    },
    {
        text: 'Add end node',
        action: GRAPH_ACTIONS.ADD_NODE,
        nodeType: STORY_NODE_TYPES.END,
        attributes: {
            name: 'End',
            endingType: 'neutral'
        }
    }
];

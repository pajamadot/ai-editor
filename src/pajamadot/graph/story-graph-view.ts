/**
 * Story Graph View
 * Visual editor for story graphs using pcui-graph
 */

import { default as PCUIGraph } from '@playcanvas/pcui-graph';

import { GRAPH_ACTIONS, createStoryGraphSchema, storyContextMenuItems } from './story-graph-schema';
import { STORY_NODE_TYPES, STORY_EDGE_TYPES } from '../constants';
import {
    loadYamlData,
    getCachedData,
    setCachedDataPath,
    getCachedDataPath,
    saveYamlData
} from '../yaml-data-manager';
import {
    generateId,
    createSceneNode,
    createStartNode,
    createEndNode,
    createEdge
} from '../utils';
import type { StoryGraphData, StoryNode, StoryEdge, SceneNode, StartNode, EndNode } from '../types';

declare const editor: any;

export class StoryGraphView {
    private _parent: any;
    private _args: any;
    private _assetId: number | null = null;
    private _graph: any = null;
    private _graphElement: HTMLDivElement;
    private _suppressGraphDataEvents: boolean = false;
    private _keyboardListenerBound: (e: KeyboardEvent) => void;
    private _saveDebounceTimer: any = null;

    constructor(parent: any, args: any = {}) {
        this._parent = parent;
        this._args = args;

        // Create graph container element
        this._graphElement = document.createElement('div');
        this._graphElement.setAttribute('style', `
            position: absolute;
            width: 100%;
            left: 0;
            background-color: #1a1a2e;
            height: 100%;
            border: none;
            display: none;
        `);

        // Append to viewport
        const viewport = document.getElementById('layout-viewport');
        if (viewport) {
            viewport.prepend(this._graphElement);
        }

        // Bind event handlers
        this._keyboardListenerBound = this._keyboardListener.bind(this);
    }

    get parent() {
        return this._parent;
    }

    get selectedItem() {
        return this._graph?.selectedItem;
    }

    get assetId() {
        return this._assetId;
    }

    /**
     * Link the view to asset(s) - async because we need to load YAML data
     */
    async link(assets: any[]) {
        this.unlink();

        if (!assets || assets.length === 0) {
            return;
        }

        const asset = assets[0];
        this._assetId = asset.get('id');

        // Load YAML data first
        const data = await loadYamlData<StoryGraphData>(this._assetId);
        if (!data) {
            console.error('[PajamaDot] Failed to load story graph data');
            return;
        }

        // Generate graph data from loaded YAML
        const graphData = this._generateGraphData(data);

        // Create the graph
        this._graph = new PCUIGraph(createStoryGraphSchema(), {
            dom: this._graphElement,
            initialData: graphData,
            contextMenuItems: storyContextMenuItems,
            readOnly: this._args.readOnly || false,
            includeFonts: false,
            incrementNodeNames: true,
            passiveUIEvents: true,
            useGlobalPCUI: true,
            adjustVertices: true,
            defaultStyles: {
                background: {
                    color: '#1a1a2e',
                    gridSize: 20
                }
            }
        });

        // Register event handlers
        this._graph.on(GRAPH_ACTIONS.ADD_NODE, this._onAddNode.bind(this));
        this._graph.on(GRAPH_ACTIONS.DELETE_NODE, this._onDeleteNode.bind(this));
        this._graph.on(GRAPH_ACTIONS.UPDATE_NODE_POSITION, this._onUpdateNodePosition.bind(this));
        this._graph.on(GRAPH_ACTIONS.UPDATE_NODE_ATTRIBUTE, this._onUpdateNodeAttribute.bind(this));
        this._graph.on(GRAPH_ACTIONS.SELECT_NODE, this._onSelectNode.bind(this));
        this._graph.on(GRAPH_ACTIONS.ADD_EDGE, this._onAddEdge.bind(this));
        this._graph.on(GRAPH_ACTIONS.DELETE_EDGE, this._onDeleteEdge.bind(this));
        this._graph.on(GRAPH_ACTIONS.SELECT_EDGE, this._onSelectEdge.bind(this));
        this._graph.on(GRAPH_ACTIONS.DESELECT_ITEM, this._onDeselectItem.bind(this));

        // Add keyboard listener
        window.addEventListener('keydown', this._keyboardListenerBound);

        // Show the graph
        this._graphElement.style.display = 'block';

        console.log('[PajamaDot] Graph view linked to asset', this._assetId);
    }

    /**
     * Unlink from assets
     */
    unlink() {
        window.removeEventListener('keydown', this._keyboardListenerBound);

        if (this._saveDebounceTimer) {
            clearTimeout(this._saveDebounceTimer);
            this._saveDebounceTimer = null;
        }

        if (this._graph) {
            this._graph.destroy();
            this._graph = null;
        }

        this._graphElement.style.display = 'none';
        this._assetId = null;
    }

    /**
     * Destroy the view
     */
    destroy() {
        this.unlink();
        if (this._graphElement.parentNode) {
            this._graphElement.parentNode.removeChild(this._graphElement);
        }
    }

    /**
     * Refresh the graph from cached data
     */
    refresh() {
        if (!this._assetId) return;

        const data = getCachedData<StoryGraphData>(this._assetId);
        if (!data) return;

        // Regenerate and update graph
        // For now, just log - full refresh would require recreating the graph
        console.log('[PajamaDot] Graph refresh requested');
    }

    /**
     * Generate graph data from story graph data
     */
    private _generateGraphData(data: StoryGraphData): { nodes: Record<string, any>; edges: Record<string, any> } {
        const graphData: { nodes: Record<string, any>; edges: Record<string, any> } = {
            nodes: {},
            edges: {}
        };

        if (!data || !data.nodes) {
            return graphData;
        }

        // Convert nodes to graph format
        for (const [nodeId, node] of Object.entries(data.nodes)) {
            const nodeType = this._getNodeTypeNumber(node.nodeType);

            graphData.nodes[nodeId] = {
                id: nodeId,
                nodeType: nodeType,
                posX: node.posX,
                posY: node.posY,
                attributes: this._getNodeAttributes(node)
            };
        }

        // Convert edges to graph format
        for (const [edgeId, edge] of Object.entries(data.edges)) {
            graphData.edges[edgeId] = {
                from: edge.from,
                to: edge.to,
                edgeType: edge.edgeType === 'choice' ? STORY_EDGE_TYPES.CHOICE : STORY_EDGE_TYPES.FLOW
            };
        }

        return graphData;
    }

    /**
     * Get numeric node type from string
     */
    private _getNodeTypeNumber(nodeType: string): number {
        switch (nodeType) {
            case 'start': return STORY_NODE_TYPES.START;
            case 'end': return STORY_NODE_TYPES.END;
            case 'scene':
            default: return STORY_NODE_TYPES.SCENE;
        }
    }

    /**
     * Get string node type from number
     */
    private _getNodeTypeString(nodeType: number): 'scene' | 'start' | 'end' {
        switch (nodeType) {
            case STORY_NODE_TYPES.START: return 'start';
            case STORY_NODE_TYPES.END: return 'end';
            case STORY_NODE_TYPES.SCENE:
            default: return 'scene';
        }
    }

    /**
     * Extract attributes from node for graph display
     */
    private _getNodeAttributes(node: StoryNode): Record<string, any> {
        const attrs: Record<string, any> = {
            name: node.name
        };

        if (node.nodeType === 'end') {
            attrs.endingType = (node as EndNode).endingType || '';
        }

        return attrs;
    }

    /**
     * Schedule a save with debouncing
     */
    private _scheduleSave() {
        if (this._saveDebounceTimer) {
            clearTimeout(this._saveDebounceTimer);
        }

        this._saveDebounceTimer = setTimeout(() => {
            if (this._assetId) {
                saveYamlData(this._assetId).then(() => {
                    console.log('[PajamaDot] Auto-saved story graph');
                }).catch((err) => {
                    console.error('[PajamaDot] Failed to auto-save:', err);
                });
            }
            this._saveDebounceTimer = null;
        }, 1000); // Save after 1 second of inactivity
    }

    /**
     * Keyboard event handler
     */
    private _keyboardListener(e: KeyboardEvent) {
        // Escape - deselect or close
        if (e.keyCode === 27) {
            if (this._graph?.selectedItem) {
                this._graph.deselectItem();
            }
        }

        // Delete - delete selected item
        if (e.keyCode === 46 && this._graph?.selectedItem) {
            const activeElement = document.activeElement;
            if (activeElement && activeElement.constructor.name === 'HTMLInputElement') {
                return;
            }

            const item = this._graph.selectedItem;
            if (item.type === 'NODE') {
                // Don't allow deleting start node
                const node = getCachedDataPath<StoryNode>(this._assetId!, `nodes.${item.id}`);
                if (node?.nodeType !== 'start') {
                    this._graph.deleteNode(item.id);
                }
            } else if (item.type === 'EDGE') {
                this._graph.deleteEdge(item.edgeId);
            }
        }
    }

    // Event handlers

    private _onAddNode({ node }: { node: any }) {
        if (!this._assetId) return;

        this._suppressGraphDataEvents = true;

        const nodeTypeString = this._getNodeTypeString(node.nodeType);
        let newNode: StoryNode;

        switch (nodeTypeString) {
            case 'start':
                newNode = createStartNode({
                    id: node.id,
                    posX: node.posX,
                    posY: node.posY,
                    name: node.attributes?.name || 'Start'
                });
                break;
            case 'end':
                newNode = createEndNode({
                    id: node.id,
                    posX: node.posX,
                    posY: node.posY,
                    name: node.attributes?.name || 'End',
                    endingType: node.attributes?.endingType
                });
                break;
            case 'scene':
            default:
                newNode = createSceneNode({
                    id: node.id,
                    posX: node.posX,
                    posY: node.posY,
                    name: node.attributes?.name || 'New Scene'
                });
                break;
        }

        setCachedDataPath(this._assetId, `nodes.${node.id}`, newNode);
        this._scheduleSave();

        this._suppressGraphDataEvents = false;

        console.log('[PajamaDot] Node added:', node.id);
    }

    private _onDeleteNode({ node }: { node: any }) {
        if (!this._assetId) return;

        this._suppressGraphDataEvents = true;

        const data = getCachedData<StoryGraphData>(this._assetId);
        if (data) {
            // Remove node
            delete data.nodes[node.id];

            // Remove connected edges
            for (const [edgeId, edge] of Object.entries(data.edges)) {
                if (edge.from === node.id || edge.to === node.id) {
                    delete data.edges[edgeId];
                }
            }

            this._scheduleSave();
        }

        this._suppressGraphDataEvents = false;

        console.log('[PajamaDot] Node deleted:', node.id);
    }

    private _onUpdateNodePosition({ node }: { node: any }) {
        if (!this._assetId) return;

        this._suppressGraphDataEvents = true;

        setCachedDataPath(this._assetId, `nodes.${node.id}.posX`, node.posX);
        setCachedDataPath(this._assetId, `nodes.${node.id}.posY`, node.posY);
        this._scheduleSave();

        this._suppressGraphDataEvents = false;
    }

    private _onUpdateNodeAttribute({ node, attribute }: { node: any; attribute: string }) {
        if (!this._assetId) return;

        this._suppressGraphDataEvents = true;

        const value = node.attributes[attribute];
        setCachedDataPath(this._assetId, `nodes.${node.id}.${attribute}`, value);
        this._scheduleSave();

        this._suppressGraphDataEvents = false;
    }

    private _onSelectNode({ node }: { node: any }) {
        console.log('[PajamaDot] Node selected:', node.id);

        // Emit event for inspector to handle
        editor?.emit?.('pajamadot:node:select', {
            assetId: this._assetId,
            nodeId: node.id
        });
    }

    private _onAddEdge({ edge, edgeId }: { edge: any; edgeId: string }) {
        if (!this._assetId) return;

        this._suppressGraphDataEvents = true;

        const newEdge = createEdge(edge.from, edge.to, {
            id: edgeId,
            choiceId: edge.edgeType === STORY_EDGE_TYPES.CHOICE ? generateId() : undefined
        });

        setCachedDataPath(this._assetId, `edges.${edgeId}`, newEdge);
        this._scheduleSave();

        this._suppressGraphDataEvents = false;

        console.log('[PajamaDot] Edge added:', edgeId);
    }

    private _onDeleteEdge({ edge, edgeId }: { edge: any; edgeId: string }) {
        if (!this._assetId) return;

        this._suppressGraphDataEvents = true;

        const data = getCachedData<StoryGraphData>(this._assetId);
        if (data) {
            delete data.edges[edgeId];
            this._scheduleSave();
        }

        this._suppressGraphDataEvents = false;

        console.log('[PajamaDot] Edge deleted:', edgeId);
    }

    private _onSelectEdge({ edge, edgeId }: { edge: any; edgeId: string }) {
        console.log('[PajamaDot] Edge selected:', edgeId);

        // Emit event for inspector to handle
        editor?.emit?.('pajamadot:edge:select', {
            assetId: this._assetId,
            edgeId: edgeId
        });
    }

    private _onDeselectItem({ prevItem }: { prevItem: any }) {
        console.log('[PajamaDot] Item deselected');

        // Emit event for inspector to handle
        editor?.emit?.('pajamadot:item:deselect', {
            assetId: this._assetId
        });
    }
}

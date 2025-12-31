/**
 * Edge API
 * MCP-compatible methods for manipulating story edges/connections
 */

import { generateId, createEdge } from '../utils';
import type { StoryEdge } from '../types';

declare const editor: any;

editor.once('load', () => {
    /**
     * Get an edge by ID
     */
    editor.method('pajamadot:edge:get', (assetId: number, edgeId: string): StoryEdge | null => {
        const asset = editor.call('assets:get', assetId);
        if (!asset) return null;

        return asset.get(`data.edges.${edgeId}`) as StoryEdge | null;
    });

    /**
     * List all edges for a story
     */
    editor.method('pajamadot:edge:list', (assetId: number): StoryEdge[] => {
        const asset = editor.call('assets:get', assetId);
        if (!asset) return [];

        const edges = asset.get('data.edges') || {};
        return Object.values(edges) as StoryEdge[];
    });

    /**
     * Create a new edge between nodes
     */
    editor.method('pajamadot:edge:create', (
        assetId: number,
        from: string,
        to: string,
        options: {
            choiceId?: string;
            condition?: string;
            priority?: number;
        } = {}
    ): StoryEdge | null => {
        const asset = editor.call('assets:get', assetId);
        if (!asset) return null;

        // Validate nodes exist
        const fromNode = asset.get(`data.nodes.${from}`);
        const toNode = asset.get(`data.nodes.${to}`);

        if (!fromNode || !toNode) {
            console.warn(`[PajamaDot] Cannot create edge: node not found`);
            return null;
        }

        const edge = createEdge(from, to, options);
        asset.set(`data.edges.${edge.id}`, edge);

        console.log(`[PajamaDot] Edge created: ${edge.id} (${from} -> ${to})`);
        return edge;
    });

    /**
     * Update an edge
     */
    editor.method('pajamadot:edge:update', (
        assetId: number,
        edgeId: string,
        updates: Partial<StoryEdge>
    ): boolean => {
        const asset = editor.call('assets:get', assetId);
        if (!asset) return false;

        const edge = asset.get(`data.edges.${edgeId}`);
        if (!edge) return false;

        const updated = { ...edge, ...updates };
        asset.set(`data.edges.${edgeId}`, updated);

        return true;
    });

    /**
     * Delete an edge
     */
    editor.method('pajamadot:edge:delete', (assetId: number, edgeId: string): boolean => {
        const asset = editor.call('assets:get', assetId);
        if (!asset) return false;

        const edges = asset.get('data.edges');
        if (!edges[edgeId]) return false;

        delete edges[edgeId];
        asset.set('data.edges', edges);

        console.log(`[PajamaDot] Edge deleted: ${edgeId}`);
        return true;
    });

    /**
     * Get all outgoing edges from a node
     */
    editor.method('pajamadot:edge:getOutgoing', (assetId: number, nodeId: string): StoryEdge[] => {
        const edges = editor.call('pajamadot:edge:list', assetId);
        return edges.filter((e: StoryEdge) => e.from === nodeId);
    });

    /**
     * Get all incoming edges to a node
     */
    editor.method('pajamadot:edge:getIncoming', (assetId: number, nodeId: string): StoryEdge[] => {
        const edges = editor.call('pajamadot:edge:list', assetId);
        return edges.filter((e: StoryEdge) => e.to === nodeId);
    });

    /**
     * Connect a choice to a target node
     */
    editor.method('pajamadot:edge:connectChoice', (
        assetId: number,
        fromSceneId: string,
        choiceId: string,
        toNodeId: string
    ): StoryEdge | null => {
        return editor.call('pajamadot:edge:create', assetId, fromSceneId, toNodeId, {
            choiceId
        });
    });

    console.log('[PajamaDot] Edge API registered');
});

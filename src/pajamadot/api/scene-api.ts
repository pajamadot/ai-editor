/**
 * Scene Node API
 * MCP-compatible methods for manipulating scene nodes
 */

import {
    getCachedData,
    getCachedDataPath,
    setCachedDataPath,
    saveYamlData,
    isDataCached
} from '../yaml-data-manager';
import {
    generateId,
    createSceneNode,
    createEndNode,
    createEdge
} from '../utils';
import type { SceneNode, StoryEdge, Dialogue, Choice, SceneCharacter, StoryGraphData } from '../types';

declare const editor: any;

editor.once('load', () => {
    /**
     * Get a scene node by ID
     */
    editor.method('pajamadot:scene:get', (assetId: number, sceneId: string): SceneNode | null => {
        const node = getCachedDataPath<SceneNode>(assetId, `nodes.${sceneId}`);
        if (!node || node.nodeType !== 'scene') return null;
        return node;
    });

    /**
     * Get scene with full context (characters, location)
     */
    editor.method('pajamadot:scene:getWithContext', async (assetId: number, sceneId: string) => {
        const scene = editor.call('pajamadot:scene:get', assetId, sceneId);
        if (!scene) return null;

        // Get location data
        let location = null;
        if (scene.locationId) {
            location = await editor.call('pajamadot:location:get', scene.locationId);
        }

        // Get character data
        const characters = await Promise.all(
            scene.characters.map(async (c: SceneCharacter) => {
                const charData = await editor.call('pajamadot:character:get', c.characterId);
                return {
                    ...c,
                    character: charData
                };
            })
        );

        return {
            scene,
            location,
            characters
        };
    });

    /**
     * Create a new scene node
     */
    editor.method('pajamadot:scene:create', async (
        assetId: number,
        scene: Partial<SceneNode>
    ): Promise<SceneNode | null> => {
        const data = getCachedData<StoryGraphData>(assetId);
        if (!data) return null;

        const newScene = createSceneNode({
            ...scene,
            id: scene.id || generateId()
        });

        data.nodes[newScene.id] = newScene;
        await saveYamlData(assetId);

        console.log(`[PajamaDot] Scene created: ${newScene.id}`);
        return newScene;
    });

    /**
     * Update scene properties
     */
    editor.method('pajamadot:scene:update', async (
        assetId: number,
        sceneId: string,
        updates: Partial<SceneNode>
    ): Promise<boolean> => {
        const current = getCachedDataPath<SceneNode>(assetId, `nodes.${sceneId}`);
        if (!current || current.nodeType !== 'scene') return false;

        // Merge updates
        const updated = { ...current, ...updates };
        setCachedDataPath(assetId, `nodes.${sceneId}`, updated);
        await saveYamlData(assetId);

        return true;
    });

    /**
     * Delete a scene node
     */
    editor.method('pajamadot:scene:delete', async (assetId: number, sceneId: string): Promise<boolean> => {
        const data = getCachedData<StoryGraphData>(assetId);
        if (!data) return false;

        const node = data.nodes[sceneId];
        if (!node) return false;

        // Don't allow deleting start node
        if (node.nodeType === 'start') {
            console.warn('[PajamaDot] Cannot delete start node');
            return false;
        }

        // Remove node
        delete data.nodes[sceneId];

        // Remove connected edges
        for (const [edgeId, edge] of Object.entries(data.edges)) {
            if (edge.from === sceneId || edge.to === sceneId) {
                delete data.edges[edgeId];
            }
        }

        await saveYamlData(assetId);

        console.log(`[PajamaDot] Scene deleted: ${sceneId}`);
        return true;
    });

    /**
     * Add a dialogue line to a scene
     */
    editor.method('pajamadot:scene:addDialogue', async (
        assetId: number,
        sceneId: string,
        dialogue: Omit<Dialogue, 'id'>
    ): Promise<string | null> => {
        const scene = getCachedDataPath<SceneNode>(assetId, `nodes.${sceneId}`);
        if (!scene || scene.nodeType !== 'scene') return null;

        const dialogueId = generateId();
        const newDialogue: Dialogue = {
            id: dialogueId,
            ...dialogue
        };

        const dialogues = [...(scene.dialogues || []), newDialogue];
        setCachedDataPath(assetId, `nodes.${sceneId}.dialogues`, dialogues);
        await saveYamlData(assetId);

        console.log(`[PajamaDot] Dialogue added to scene ${sceneId}: ${dialogueId}`);
        return dialogueId;
    });

    /**
     * Update a dialogue line
     */
    editor.method('pajamadot:scene:updateDialogue', async (
        assetId: number,
        sceneId: string,
        dialogueId: string,
        updates: Partial<Dialogue>
    ): Promise<boolean> => {
        const scene = getCachedDataPath<SceneNode>(assetId, `nodes.${sceneId}`);
        if (!scene || scene.nodeType !== 'scene') return false;

        const dialogues = [...(scene.dialogues || [])];
        const index = dialogues.findIndex((d: Dialogue) => d.id === dialogueId);
        if (index === -1) return false;

        dialogues[index] = { ...dialogues[index], ...updates };
        setCachedDataPath(assetId, `nodes.${sceneId}.dialogues`, dialogues);
        await saveYamlData(assetId);

        return true;
    });

    /**
     * Remove a dialogue line
     */
    editor.method('pajamadot:scene:removeDialogue', async (
        assetId: number,
        sceneId: string,
        dialogueId: string
    ): Promise<boolean> => {
        const scene = getCachedDataPath<SceneNode>(assetId, `nodes.${sceneId}`);
        if (!scene || scene.nodeType !== 'scene') return false;

        const dialogues = (scene.dialogues || []).filter((d: Dialogue) => d.id !== dialogueId);
        setCachedDataPath(assetId, `nodes.${sceneId}.dialogues`, dialogues);
        await saveYamlData(assetId);

        return true;
    });

    /**
     * Add a choice to a scene
     */
    editor.method('pajamadot:scene:addChoice', async (
        assetId: number,
        sceneId: string,
        choice: Omit<Choice, 'id'>
    ): Promise<string | null> => {
        const scene = getCachedDataPath<SceneNode>(assetId, `nodes.${sceneId}`);
        if (!scene || scene.nodeType !== 'scene') return null;

        const choiceId = generateId();
        const newChoice: Choice = {
            id: choiceId,
            ...choice
        };

        const choices = [...(scene.choices || []), newChoice];
        setCachedDataPath(assetId, `nodes.${sceneId}.choices`, choices);
        await saveYamlData(assetId);

        console.log(`[PajamaDot] Choice added to scene ${sceneId}: ${choiceId}`);
        return choiceId;
    });

    /**
     * Update a choice
     */
    editor.method('pajamadot:scene:updateChoice', async (
        assetId: number,
        sceneId: string,
        choiceId: string,
        updates: Partial<Choice>
    ): Promise<boolean> => {
        const scene = getCachedDataPath<SceneNode>(assetId, `nodes.${sceneId}`);
        if (!scene || scene.nodeType !== 'scene') return false;

        const choices = [...(scene.choices || [])];
        const index = choices.findIndex((c: Choice) => c.id === choiceId);
        if (index === -1) return false;

        choices[index] = { ...choices[index], ...updates };
        setCachedDataPath(assetId, `nodes.${sceneId}.choices`, choices);
        await saveYamlData(assetId);

        return true;
    });

    /**
     * Remove a choice
     */
    editor.method('pajamadot:scene:removeChoice', async (
        assetId: number,
        sceneId: string,
        choiceId: string
    ): Promise<boolean> => {
        const scene = getCachedDataPath<SceneNode>(assetId, `nodes.${sceneId}`);
        if (!scene || scene.nodeType !== 'scene') return false;

        const choices = (scene.choices || []).filter((c: Choice) => c.id !== choiceId);
        setCachedDataPath(assetId, `nodes.${sceneId}.choices`, choices);
        await saveYamlData(assetId);

        return true;
    });

    /**
     * Add a character to a scene
     */
    editor.method('pajamadot:scene:addCharacter', async (
        assetId: number,
        sceneId: string,
        character: SceneCharacter
    ): Promise<boolean> => {
        const scene = getCachedDataPath<SceneNode>(assetId, `nodes.${sceneId}`);
        if (!scene || scene.nodeType !== 'scene') return false;

        const characters = [...(scene.characters || [])];

        // Check if character already exists
        if (characters.some((c: SceneCharacter) => c.characterId === character.characterId)) {
            return false;
        }

        characters.push(character);
        setCachedDataPath(assetId, `nodes.${sceneId}.characters`, characters);
        await saveYamlData(assetId);

        return true;
    });

    /**
     * Remove a character from a scene
     */
    editor.method('pajamadot:scene:removeCharacter', async (
        assetId: number,
        sceneId: string,
        characterId: string
    ): Promise<boolean> => {
        const scene = getCachedDataPath<SceneNode>(assetId, `nodes.${sceneId}`);
        if (!scene || scene.nodeType !== 'scene') return false;

        const characters = (scene.characters || []).filter((c: SceneCharacter) => c.characterId !== characterId);
        setCachedDataPath(assetId, `nodes.${sceneId}.characters`, characters);
        await saveYamlData(assetId);

        return true;
    });

    /**
     * Set the location for a scene
     */
    editor.method('pajamadot:scene:setLocation', async (
        assetId: number,
        sceneId: string,
        locationId: string | null
    ): Promise<boolean> => {
        const scene = getCachedDataPath<SceneNode>(assetId, `nodes.${sceneId}`);
        if (!scene || scene.nodeType !== 'scene') return false;

        setCachedDataPath(assetId, `nodes.${sceneId}.locationId`, locationId);
        await saveYamlData(assetId);
        return true;
    });

    console.log('[PajamaDot] Scene API registered');
});

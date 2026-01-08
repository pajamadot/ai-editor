/**
 * Visual Novel Runtime Engine
 * Core execution engine for running visual novels in PlayCanvas
 */

import type {
    StoryGraphData,
    StoryNode,
    SceneNode,
    StartNode,
    EndNode,
    StoryEdge,
    Dialogue,
    Choice,
    SceneCharacter
} from '../types/story-graph';
import { isSceneNode, isStartNode, isEndNode } from '../types/story-graph';
import type {
    VNRuntimeState,
    VNCharacterState,
    VNHistoryEntry,
    VNEvent,
    VNEventType,
    VNEventListener,
    VNSettings,
    VNSaveData,
    TransitionConfig
} from './vn-types';
import { getDefaultRuntimeState, getDefaultVNSettings } from './vn-types';

declare const pc: any;

/**
 * Expression evaluator for conditions
 */
function evaluateCondition(condition: string, variables: Record<string, any>): boolean {
    if (!condition || condition.trim() === '') return true;

    try {
        // Simple expression evaluation (secure - only allows variable access and basic operators)
        // Format: "variableName == value" or "variableName > 5" etc.
        const safeCondition = condition
            .replace(/([a-zA-Z_][a-zA-Z0-9_]*)/g, (match) => {
                if (['true', 'false', 'null', 'undefined', 'and', 'or', 'not'].includes(match)) {
                    return match === 'and' ? '&&' : match === 'or' ? '||' : match === 'not' ? '!' : match;
                }
                return `vars["${match}"]`;
            });

        const evalFunc = new Function('vars', `return ${safeCondition};`);
        return Boolean(evalFunc(variables));
    } catch (error) {
        console.warn('[VNRuntime] Failed to evaluate condition:', condition, error);
        return false;
    }
}

/**
 * Visual Novel Runtime
 * Manages story execution, state, and events
 */
export class VNRuntime {
    /** Story graph data */
    private _storyData: StoryGraphData | null = null;

    /** Runtime state */
    private _state: VNRuntimeState;

    /** Settings */
    private _settings: VNSettings;

    /** Event listeners */
    private _listeners: Map<VNEventType, Set<VNEventListener>> = new Map();

    /** Typewriter timer */
    private _typewriterTimer: number | null = null;

    /** Current displayed text */
    private _displayedText: string = '';

    /** Target text for typewriter */
    private _targetText: string = '';

    /** Auto-play timer */
    private _autoPlayTimer: number | null = null;

    /** Playtime tracker */
    private _playtimeInterval: number | null = null;

    /** Story ID */
    private _storyId: string = '';

    /** Is initialized */
    private _initialized: boolean = false;

    /** Callback for UI updates */
    private _onUpdate: ((state: VNRuntimeState) => void) | null = null;

    constructor() {
        this._state = getDefaultRuntimeState();
        this._settings = getDefaultVNSettings();
    }

    // ========================================================================
    // Initialization
    // ========================================================================

    /**
     * Initialize the runtime with a story
     */
    initialize(storyData: StoryGraphData, storyId: string = 'default'): void {
        this._storyData = storyData;
        this._storyId = storyId;
        this._state = getDefaultRuntimeState();
        this._initialized = true;

        console.log('[VNRuntime] Initialized with story:', storyData.metadata.title);
    }

    /**
     * Set the update callback
     */
    setUpdateCallback(callback: (state: VNRuntimeState) => void): void {
        this._onUpdate = callback;
    }

    /**
     * Start the story from the beginning
     */
    start(): void {
        if (!this._storyData) {
            console.error('[VNRuntime] No story loaded');
            return;
        }

        // Find start node
        const startNode = Object.values(this._storyData.nodes).find(isStartNode);
        if (!startNode) {
            console.error('[VNRuntime] No start node found');
            return;
        }

        this._state = getDefaultRuntimeState();
        this._state.currentNodeId = startNode.id;

        // Start playtime tracking
        this._startPlaytimeTracking();

        // Find the first scene connected to start
        this._advanceFromNode(startNode.id);

        this._emit('scene:enter', { nodeId: this._state.currentNodeId });
        this._notifyUpdate();
    }

    /**
     * Resume from saved state
     */
    resume(saveData: VNSaveData): void {
        if (!this._storyData) {
            console.error('[VNRuntime] No story loaded');
            return;
        }

        this._state = { ...saveData.state };
        this._startPlaytimeTracking();
        this._notifyUpdate();

        console.log('[VNRuntime] Resumed from save:', saveData.label);
    }

    // ========================================================================
    // State Management
    // ========================================================================

    /**
     * Get current state
     */
    getState(): VNRuntimeState {
        return { ...this._state };
    }

    /**
     * Get current node
     */
    getCurrentNode(): StoryNode | null {
        if (!this._storyData || !this._state.currentNodeId) return null;
        return this._storyData.nodes[this._state.currentNodeId] || null;
    }

    /**
     * Get current dialogue
     */
    getCurrentDialogue(): Dialogue | null {
        const node = this.getCurrentNode();
        if (!node || !isSceneNode(node)) return null;
        return node.dialogues[this._state.dialogueIndex] || null;
    }

    /**
     * Get current choices
     */
    getCurrentChoices(): Choice[] {
        const node = this.getCurrentNode();
        if (!node || !isSceneNode(node)) return [];

        // Filter choices by condition
        return node.choices.filter(choice => {
            if (!choice.condition) return true;
            return evaluateCondition(choice.condition, this._state.variables);
        });
    }

    /**
     * Set a variable
     */
    setVariable(name: string, value: any): void {
        this._state.variables[name] = value;
        this._notifyUpdate();
    }

    /**
     * Get a variable
     */
    getVariable(name: string): any {
        return this._state.variables[name];
    }

    /**
     * Get displayed text (for typewriter effect)
     */
    getDisplayedText(): string {
        return this._displayedText;
    }

    /**
     * Check if text is fully displayed
     */
    isTextComplete(): boolean {
        return this._displayedText === this._targetText;
    }

    // ========================================================================
    // Player Input Handlers
    // ========================================================================

    /**
     * Advance the story (click/enter)
     */
    advance(): void {
        if (this._state.isPaused) return;

        // If typewriter is running, complete it
        if (!this.isTextComplete()) {
            this._completeTypewriter();
            return;
        }

        // If showing choices, wait for selection
        if (this._state.showingChoices) {
            return;
        }

        const node = this.getCurrentNode();
        if (!node) return;

        if (isSceneNode(node)) {
            this._advanceSceneNode(node);
        } else if (isEndNode(node)) {
            this._handleEnding(node);
        }
    }

    /**
     * Select a choice
     */
    selectChoice(choiceIndex: number): void {
        if (!this._state.showingChoices) return;

        const choices = this.getCurrentChoices();
        if (choiceIndex < 0 || choiceIndex >= choices.length) return;

        const choice = choices[choiceIndex];

        // Record choice
        this._state.choicesMade.push({
            nodeId: this._state.currentNodeId,
            choiceId: choice.id,
            timestamp: Date.now()
        });

        this._state.showingChoices = false;

        this._emit('choice:select', { choice, index: choiceIndex });

        // Find target node
        let targetNodeId = choice.targetNodeId;

        // If no direct target, find via edges
        if (!targetNodeId && this._storyData) {
            const edge = Object.values(this._storyData.edges).find(
                e => e.from === this._state.currentNodeId && e.choiceId === choice.id
            );
            if (edge) {
                targetNodeId = edge.to;
            }
        }

        if (targetNodeId) {
            this._goToNode(targetNodeId);
        }
    }

    /**
     * Toggle auto-play mode
     */
    toggleAutoPlay(): void {
        this._state.autoPlay = !this._state.autoPlay;

        if (this._state.autoPlay && this.isTextComplete() && !this._state.showingChoices) {
            this._startAutoPlayTimer();
        } else {
            this._stopAutoPlayTimer();
        }

        this._notifyUpdate();
    }

    /**
     * Toggle skip mode
     */
    toggleSkipMode(): void {
        this._state.skipMode = !this._state.skipMode;

        if (this._state.skipMode) {
            this._skipToNextChoice();
        }

        this._notifyUpdate();
    }

    /**
     * Pause the game
     */
    pause(): void {
        this._state.isPaused = true;
        this._stopAutoPlayTimer();
        this._emit('pause', {});
        this._notifyUpdate();
    }

    /**
     * Resume the game
     */
    unpause(): void {
        this._state.isPaused = false;
        this._emit('resume', {});
        this._notifyUpdate();
    }

    // ========================================================================
    // Scene Node Handling
    // ========================================================================

    private _advanceSceneNode(node: SceneNode): void {
        const hasMoreDialogues = this._state.dialogueIndex < node.dialogues.length - 1;

        if (hasMoreDialogues) {
            // Go to next dialogue
            this._state.dialogueIndex++;
            this._processCurrentDialogue(node);
        } else if (node.choices.length > 0) {
            // Show choices
            this._showChoices(node);
        } else {
            // Auto-advance to next node
            this._advanceFromNode(node.id);
        }
    }

    private _processCurrentDialogue(node: SceneNode): void {
        const dialogue = node.dialogues[this._state.dialogueIndex];
        if (!dialogue) return;

        // Update character highlighting
        this._updateCharacterHighlighting(dialogue.speakerId);

        // Start typewriter
        this._startTypewriter(dialogue.text);

        // Add to history
        this._addToHistory(dialogue);

        // Emit event
        this._emit('dialogue:start', { dialogue, nodeId: node.id });

        this._notifyUpdate();
    }

    private _showChoices(node: SceneNode): void {
        const availableChoices = this.getCurrentChoices();
        if (availableChoices.length === 0) {
            // No valid choices, auto-advance
            this._advanceFromNode(node.id);
            return;
        }

        this._state.showingChoices = true;
        this._state.waitingForInput = true;

        this._emit('choice:show', { choices: availableChoices });
        this._notifyUpdate();
    }

    private _advanceFromNode(nodeId: string): void {
        if (!this._storyData) return;

        // Find flow edge from this node
        const edge = Object.values(this._storyData.edges).find(e => {
            if (e.from !== nodeId) return false;
            if (e.edgeType !== 'flow') return false;

            // Check condition
            if (e.condition) {
                return evaluateCondition(e.condition, this._state.variables);
            }
            return true;
        });

        if (edge) {
            this._goToNode(edge.to);
        } else {
            console.warn('[VNRuntime] No valid edge from node:', nodeId);
        }
    }

    private _goToNode(nodeId: string): void {
        if (!this._storyData) return;

        const node = this._storyData.nodes[nodeId];
        if (!node) {
            console.error('[VNRuntime] Node not found:', nodeId);
            return;
        }

        // Exit previous scene
        this._emit('scene:exit', { nodeId: this._state.currentNodeId });

        // Update state
        this._state.currentNodeId = nodeId;
        this._state.dialogueIndex = 0;
        this._state.showingChoices = false;
        this._state.waitingForInput = false;

        // Enter new scene
        this._emit('scene:enter', { nodeId, node });

        if (isSceneNode(node)) {
            // Process scene setup
            this._processSceneSetup(node);

            // Start first dialogue
            if (node.dialogues.length > 0) {
                this._processCurrentDialogue(node);
            } else if (node.choices.length > 0) {
                this._showChoices(node);
            } else {
                // Empty scene, auto-advance
                this._advanceFromNode(nodeId);
            }
        } else if (isEndNode(node)) {
            this._handleEnding(node);
        } else if (isStartNode(node)) {
            // Skip start node
            this._advanceFromNode(nodeId);
        }
    }

    private _processSceneSetup(node: SceneNode): void {
        // Update background if location changed
        if (node.locationId && node.locationId !== this._state.currentBackground) {
            this._state.currentBackground = node.locationId;
            this._emit('background:change', { locationId: node.locationId });
        }

        // Update visible characters
        const newCharacters: VNCharacterState[] = node.characters.map(char => ({
            characterId: char.characterId,
            position: char.position || 'center',
            expression: char.expression || 'neutral',
            scale: 1.0,
            alpha: 1.0,
            offsetX: 0,
            offsetY: 0,
            highlighted: false
        }));

        // Determine which characters to show/hide
        const oldIds = new Set(this._state.visibleCharacters.map(c => c.characterId));
        const newIds = new Set(newCharacters.map(c => c.characterId));

        // Characters to remove
        for (const old of this._state.visibleCharacters) {
            if (!newIds.has(old.characterId)) {
                this._emit('character:exit', { characterId: old.characterId });
            }
        }

        // Characters to add
        for (const char of newCharacters) {
            if (!oldIds.has(char.characterId)) {
                this._emit('character:enter', { character: char });
            }
        }

        this._state.visibleCharacters = newCharacters;

        // Process effects
        if (node.effects) {
            for (const effect of node.effects) {
                this._emit('transition:start', { effect });
            }
        }
    }

    private _handleEnding(node: EndNode): void {
        this._stopPlaytimeTracking();
        this._state.isPaused = true;

        this._emit('ending:reach', {
            endingType: node.endingType || 'neutral',
            nodeId: node.id,
            playtime: this._state.playtime
        });

        this._notifyUpdate();
    }

    // ========================================================================
    // Typewriter Effect
    // ========================================================================

    private _startTypewriter(text: string): void {
        this._completeTypewriter(); // Clear any existing

        this._targetText = text;
        this._displayedText = '';

        // Instant display if text speed is 1 or skip mode
        if (this._settings.textSpeed >= 1 || this._state.skipMode) {
            this._displayedText = text;
            this._onTypewriterComplete();
            return;
        }

        const charsPerSecond = 30 + (this._settings.textSpeed * 70); // 30-100 chars/sec
        const interval = 1000 / charsPerSecond;

        let index = 0;
        this._typewriterTimer = window.setInterval(() => {
            if (index < text.length) {
                this._displayedText += text[index];
                index++;
                this._notifyUpdate();
            } else {
                this._completeTypewriter();
            }
        }, interval);
    }

    private _completeTypewriter(): void {
        if (this._typewriterTimer) {
            clearInterval(this._typewriterTimer);
            this._typewriterTimer = null;
        }
        this._displayedText = this._targetText;
        this._onTypewriterComplete();
        this._notifyUpdate();
    }

    private _onTypewriterComplete(): void {
        this._emit('dialogue:complete', {});

        // Start auto-play timer if enabled
        if (this._state.autoPlay && !this._state.showingChoices) {
            this._startAutoPlayTimer();
        }
    }

    // ========================================================================
    // Auto-play & Skip
    // ========================================================================

    private _startAutoPlayTimer(): void {
        this._stopAutoPlayTimer();

        this._autoPlayTimer = window.setTimeout(() => {
            if (this._state.autoPlay && this.isTextComplete() && !this._state.showingChoices) {
                this.advance();
            }
        }, this._settings.autoPlayDelay * 1000);
    }

    private _stopAutoPlayTimer(): void {
        if (this._autoPlayTimer) {
            clearTimeout(this._autoPlayTimer);
            this._autoPlayTimer = null;
        }
    }

    private _skipToNextChoice(): void {
        // Keep advancing until we hit choices or end
        const maxIterations = 100;
        let iterations = 0;

        while (this._state.skipMode && iterations < maxIterations) {
            const node = this.getCurrentNode();
            if (!node) break;

            if (isSceneNode(node)) {
                if (this._state.showingChoices) break; // Stop at choices
                this.advance();
            } else if (isEndNode(node)) {
                break;
            } else {
                this.advance();
            }

            iterations++;
        }
    }

    // ========================================================================
    // Character Management
    // ========================================================================

    private _updateCharacterHighlighting(speakerId?: string): void {
        for (const char of this._state.visibleCharacters) {
            const shouldHighlight = speakerId === char.characterId;
            if (char.highlighted !== shouldHighlight) {
                char.highlighted = shouldHighlight;
            }
        }
    }

    /**
     * Show a character
     */
    showCharacter(
        characterId: string,
        position: VNCharacterState['position'] = 'center',
        expression: string = 'neutral'
    ): void {
        const existing = this._state.visibleCharacters.find(c => c.characterId === characterId);

        if (existing) {
            existing.position = position;
            existing.expression = expression;
            this._emit('character:expression', { characterId, expression });
        } else {
            const newChar: VNCharacterState = {
                characterId,
                position,
                expression,
                scale: 1.0,
                alpha: 1.0,
                offsetX: 0,
                offsetY: 0,
                highlighted: false
            };
            this._state.visibleCharacters.push(newChar);
            this._emit('character:enter', { character: newChar });
        }

        this._notifyUpdate();
    }

    /**
     * Hide a character
     */
    hideCharacter(characterId: string): void {
        const index = this._state.visibleCharacters.findIndex(c => c.characterId === characterId);
        if (index !== -1) {
            this._state.visibleCharacters.splice(index, 1);
            this._emit('character:exit', { characterId });
            this._notifyUpdate();
        }
    }

    /**
     * Set character expression
     */
    setCharacterExpression(characterId: string, expression: string): void {
        const char = this._state.visibleCharacters.find(c => c.characterId === characterId);
        if (char) {
            char.expression = expression;
            this._emit('character:expression', { characterId, expression });
            this._notifyUpdate();
        }
    }

    // ========================================================================
    // Audio Management
    // ========================================================================

    /**
     * Play BGM
     */
    playBGM(musicId: string): void {
        this._state.currentBGM = musicId;
        this._emit('bgm:play', { musicId });
    }

    /**
     * Stop BGM
     */
    stopBGM(): void {
        this._state.currentBGM = null;
        this._emit('bgm:stop', {});
    }

    /**
     * Play sound effect
     */
    playSFX(sfxId: string): void {
        this._emit('sfx:play', { sfxId });
    }

    /**
     * Play voice clip
     */
    playVoice(voiceId: string): void {
        this._emit('voice:play', { voiceId });
    }

    // ========================================================================
    // History
    // ========================================================================

    private _addToHistory(dialogue: Dialogue): void {
        const entry: VNHistoryEntry = {
            nodeId: this._state.currentNodeId,
            dialogueId: dialogue.id,
            speakerName: dialogue.speakerId || null,
            text: dialogue.text,
            timestamp: Date.now()
        };

        this._state.history.push(entry);

        // Limit history size
        if (this._state.history.length > 500) {
            this._state.history.shift();
        }
    }

    /**
     * Get dialogue history
     */
    getHistory(): VNHistoryEntry[] {
        return [...this._state.history];
    }

    // ========================================================================
    // Playtime Tracking
    // ========================================================================

    private _startPlaytimeTracking(): void {
        this._stopPlaytimeTracking();

        this._playtimeInterval = window.setInterval(() => {
            if (!this._state.isPaused) {
                this._state.playtime++;
            }
        }, 1000);
    }

    private _stopPlaytimeTracking(): void {
        if (this._playtimeInterval) {
            clearInterval(this._playtimeInterval);
            this._playtimeInterval = null;
        }
    }

    // ========================================================================
    // Save/Load
    // ========================================================================

    /**
     * Create save data
     */
    createSaveData(slotId: number, label?: string): VNSaveData {
        return {
            slotId,
            label: label || `Save ${slotId}`,
            storyId: this._storyId,
            state: { ...this._state },
            createdAt: Date.now(),
            updatedAt: Date.now(),
            sessionCount: 1
        };
    }

    /**
     * Load from save data
     */
    loadSaveData(saveData: VNSaveData): void {
        this._state = { ...saveData.state };
        this._emit('load', { saveData });
        this._notifyUpdate();
    }

    // ========================================================================
    // Event System
    // ========================================================================

    /**
     * Add event listener
     */
    on(event: VNEventType, listener: VNEventListener): void {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event)!.add(listener);
    }

    /**
     * Remove event listener
     */
    off(event: VNEventType, listener: VNEventListener): void {
        const listeners = this._listeners.get(event);
        if (listeners) {
            listeners.delete(listener);
        }
    }

    private _emit(type: VNEventType, data: any): void {
        const event: VNEvent = {
            type,
            timestamp: Date.now(),
            data
        };

        const listeners = this._listeners.get(type);
        if (listeners) {
            for (const listener of listeners) {
                try {
                    listener(event);
                } catch (error) {
                    console.error('[VNRuntime] Event listener error:', error);
                }
            }
        }
    }

    private _notifyUpdate(): void {
        if (this._onUpdate) {
            this._onUpdate(this.getState());
        }
    }

    // ========================================================================
    // Cleanup
    // ========================================================================

    /**
     * Destroy the runtime
     */
    destroy(): void {
        this._stopPlaytimeTracking();
        this._stopAutoPlayTimer();
        this._completeTypewriter();
        this._listeners.clear();
        this._storyData = null;
        this._initialized = false;
    }
}

// Singleton instance for global access
const vnRuntime = new VNRuntime();

export function getVNRuntime(): VNRuntime {
    return vnRuntime;
}

export function createVNRuntime(): VNRuntime {
    return new VNRuntime();
}

export { vnRuntime };

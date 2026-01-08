/**
 * VN Controller
 * Main controller that orchestrates the visual novel system
 *
 * Connects:
 * - VNRuntime (story execution)
 * - VNUIManager (visual rendering)
 * - VNSaveManager (persistence)
 * - VNTransitionManager (visual effects)
 *
 * Features:
 * - Full lifecycle management
 * - Event routing between components
 * - Input handling
 * - Debug mode
 * - Screenshot capture for saves
 */

import type { StoryGraphData } from '../types/story-graph';
import type { StoryCharacterData } from '../types/character';
import type { StoryLocationData } from '../types/location';
import type {
    VNRuntimeState,
    VNSettings,
    VNEvent,
    VNEventType,
    TransitionConfig,
    VNCharacterAssets,
    VNLocationAssets
} from './vn-types';
import { VNRuntime } from './vn-runtime';
import { VNUIManager } from './vn-ui-manager';
import { VNSaveManager, vnSaveManager } from './vn-save-manager';
import { VNTransitionManager, vnTransitionManager } from './vn-transitions';

declare const pc: any;

/**
 * VN Controller configuration
 */
export interface VNControllerConfig {
    /** PlayCanvas application instance */
    app: any;

    /** Enable debug mode */
    debug: boolean;

    /** Auto-start on initialization */
    autoStart: boolean;

    /** Show UI immediately */
    showUIOnStart: boolean;

    /** Enable keyboard input */
    keyboardEnabled: boolean;

    /** Enable mouse/touch input */
    pointerEnabled: boolean;

    /** Key bindings */
    keyBindings: {
        advance: string[];
        skip: string[];
        auto: string[];
        save: string[];
        load: string[];
        log: string[];
        menu: string[];
    };
}

/**
 * Default controller configuration
 */
export function getDefaultControllerConfig(): VNControllerConfig {
    return {
        app: null,
        debug: false,
        autoStart: false,
        showUIOnStart: true,
        keyboardEnabled: true,
        pointerEnabled: true,
        keyBindings: {
            advance: ['Space', 'Enter'],
            skip: ['ControlLeft', 'ControlRight'],
            auto: ['KeyA'],
            save: ['F5'],
            load: ['F9'],
            log: ['KeyL'],
            menu: ['Escape']
        }
    };
}

/**
 * Asset loaders interface
 */
export interface VNAssetLoaders {
    loadCharacter: (characterId: string) => Promise<VNCharacterAssets | null>;
    loadLocation: (locationId: string) => Promise<VNLocationAssets | null>;
    loadTexture: (url: string) => Promise<any>;
    loadAudio: (url: string) => Promise<any>;
}

/**
 * Controller state
 */
type ControllerState = 'uninitialized' | 'initialized' | 'running' | 'paused' | 'ended';

/**
 * VN Controller
 * Main orchestrator for the visual novel system
 */
class VNController {
    private config: VNControllerConfig;
    private state: ControllerState = 'uninitialized';

    // Core components
    private runtime: VNRuntime;
    private uiManager: VNUIManager;
    private saveManager: VNSaveManager;
    private transitionManager: VNTransitionManager;

    // Asset management
    private assetLoaders: VNAssetLoaders | null = null;
    private characterCache: Map<string, VNCharacterAssets> = new Map();
    private locationCache: Map<string, VNLocationAssets> = new Map();

    // Story data
    private storyData: StoryGraphData | null = null;
    private storyId: string = '';
    private characters: Map<string, StoryCharacterData> = new Map();
    private locations: Map<string, StoryLocationData> = new Map();

    // Input state
    private keyDownHandler: ((e: KeyboardEvent) => void) | null = null;
    private keyUpHandler: ((e: KeyboardEvent) => void) | null = null;
    private skipHeld: boolean = false;

    // Callbacks
    private onEnd: ((endingId: string) => void) | null = null;
    private onEvent: ((event: VNEvent) => void) | null = null;
    private onMenuRequested: (() => void) | null = null;
    private onLogRequested: (() => void) | null = null;

    constructor(config: Partial<VNControllerConfig> = {}) {
        this.config = { ...getDefaultControllerConfig(), ...config };

        this.runtime = new VNRuntime();
        this.uiManager = new VNUIManager();
        this.saveManager = vnSaveManager;
        this.transitionManager = vnTransitionManager;
    }

    /**
     * Initialize the controller
     */
    initialize(app: any): void {
        if (this.state !== 'uninitialized') {
            console.warn('[VNController] Already initialized');
            return;
        }

        this.config.app = app;

        // Initialize all components
        this.runtime.initialize(null as any, '');
        this.uiManager.initialize(app);
        this.transitionManager.initialize(app);

        // Connect runtime events to UI
        this.setupEventRouting();

        // Setup input handling
        if (this.config.keyboardEnabled) {
            this.setupKeyboardInput();
        }

        // Setup auto-save callback
        this.saveManager.setAutoSaveCallback(() => {
            return this.runtime.getState();
        });

        this.state = 'initialized';
        console.log('[VNController] Initialized');
    }

    /**
     * Load and start a story
     */
    async loadStory(
        storyData: StoryGraphData,
        storyId: string,
        characters: StoryCharacterData[] = [],
        locations: StoryLocationData[] = []
    ): Promise<void> {
        if (this.state === 'uninitialized') {
            throw new Error('Controller not initialized');
        }

        this.storyData = storyData;
        this.storyId = storyId;

        // Cache characters and locations
        this.characters.clear();
        for (const char of characters) {
            this.characters.set(char.id, char);
        }

        this.locations.clear();
        for (const loc of locations) {
            this.locations.set(loc.id, loc);
        }

        // Initialize save manager for this story
        this.saveManager.initialize(storyId);

        // Initialize runtime with story data
        this.runtime.initialize(storyData, storyId);

        // Pre-load initial assets
        await this.preloadInitialAssets();

        this.state = 'initialized';
        console.log('[VNController] Story loaded:', storyId);

        // Auto-start if configured
        if (this.config.autoStart) {
            await this.start();
        }
    }

    /**
     * Start the story
     */
    async start(): Promise<void> {
        if (!this.storyData) {
            throw new Error('No story loaded');
        }

        // Fade in
        await this.transitionManager.fadeIn(0.5);

        // Start runtime
        this.runtime.start();
        this.state = 'running';

        // Show UI
        if (this.config.showUIOnStart) {
            this.uiManager.show();
        }

        console.log('[VNController] Story started');
    }

    /**
     * Resume from a save
     */
    async resumeFromSave(slotId: number): Promise<boolean> {
        const saveData = this.saveManager.load(slotId);
        if (!saveData) {
            return false;
        }

        // Fade out
        await this.transitionManager.fadeOut(0.3);

        // Restore state
        this.runtime.restoreState(saveData.state);

        // Update UI
        const state = this.runtime.getState();
        await this.updateUIFromState(state);

        // Fade in
        await this.transitionManager.fadeIn(0.3);

        this.state = 'running';
        console.log('[VNController] Resumed from slot', slotId);
        return true;
    }

    /**
     * Resume from auto-save
     */
    async resumeFromAutoSave(): Promise<boolean> {
        const saveData = this.saveManager.loadAutoSave();
        if (!saveData) {
            return false;
        }

        // Fade out
        await this.transitionManager.fadeOut(0.3);

        // Restore state
        this.runtime.restoreState(saveData.state);

        // Update UI
        const state = this.runtime.getState();
        await this.updateUIFromState(state);

        // Fade in
        await this.transitionManager.fadeIn(0.3);

        this.state = 'running';
        console.log('[VNController] Resumed from auto-save');
        return true;
    }

    /**
     * Set asset loaders
     */
    setAssetLoaders(loaders: VNAssetLoaders): void {
        this.assetLoaders = loaders;
    }

    /**
     * Cleanup
     */
    destroy(): void {
        this.removeKeyboardInput();
        this.saveManager.destroy();
        this.uiManager.destroy();
        this.transitionManager.destroy();

        this.characterCache.clear();
        this.locationCache.clear();
        this.characters.clear();
        this.locations.clear();

        this.state = 'uninitialized';
        console.log('[VNController] Destroyed');
    }

    // ========================================================================
    // Event Routing
    // ========================================================================

    private setupEventRouting(): void {
        // Listen to runtime events and route to UI
        this.runtime.on('dialogue:start', async (event) => {
            const state = this.runtime.getState();
            const currentNode = this.getCurrentNode();

            if (currentNode) {
                const dialogue = this.getCurrentDialogue();
                const displayText = dialogue?.text || '';

                // Update UI with new dialogue
                await this.uiManager.updateFromState(state, displayText);

                // Highlight speaker
                if (dialogue?.speakerId) {
                    this.uiManager.highlightSpeaker(dialogue.speakerId);
                }
            }

            this.emitEvent(event);
        });

        this.runtime.on('dialogue:complete', (event) => {
            // Show continue indicator
            this.uiManager.showContinueIndicator();
            this.emitEvent(event);
        });

        this.runtime.on('choice:show', (event) => {
            const currentNode = this.getCurrentNode();
            if (currentNode?.type === 'choice') {
                this.uiManager.showChoices(currentNode.choices || []);
            }
            this.emitEvent(event);
        });

        this.runtime.on('choice:select', async (event) => {
            this.uiManager.hideChoices();
            this.emitEvent(event);
        });

        this.runtime.on('character:enter', async (event) => {
            const { characterId, position, expression } = event.data;
            const charData = this.characters.get(characterId);

            if (charData) {
                await this.uiManager.showCharacter({
                    characterId,
                    position,
                    expression: expression || 'default',
                    scale: 1,
                    alpha: 1,
                    offsetX: 0,
                    offsetY: 0,
                    highlighted: true
                }, charData);
            }

            this.emitEvent(event);
        });

        this.runtime.on('character:exit', async (event) => {
            const { characterId } = event.data;
            await this.uiManager.hideCharacter(characterId);
            this.emitEvent(event);
        });

        this.runtime.on('background:change', async (event) => {
            const { backgroundUrl, transition } = event.data;

            if (transition) {
                await this.transitionManager.transition(transition);
            }

            await this.uiManager.setBackground(backgroundUrl);
            this.emitEvent(event);
        });

        this.runtime.on('transition:start', async (event) => {
            const config = event.data as TransitionConfig;
            await this.transitionManager.transition(config);
            this.emitEvent(event);
        });

        this.runtime.on('ending:reach', (event) => {
            this.state = 'ended';
            const endingId = event.data.endingId;

            // Mark ending as completed
            this.saveManager.completeEnding(endingId);

            if (this.onEnd) {
                this.onEnd(endingId);
            }

            this.emitEvent(event);
        });

        this.runtime.on('bgm:play', (event) => {
            const { trackId, url, loop } = event.data;

            // Unlock music track
            if (trackId) {
                this.saveManager.unlockMusic(trackId);
            }

            // Audio playback would be handled here
            this.emitEvent(event);
        });
    }

    private emitEvent(event: VNEvent): void {
        if (this.onEvent) {
            this.onEvent(event);
        }
    }

    // ========================================================================
    // Input Handling
    // ========================================================================

    private setupKeyboardInput(): void {
        this.keyDownHandler = this.handleKeyDown.bind(this);
        this.keyUpHandler = this.handleKeyUp.bind(this);

        window.addEventListener('keydown', this.keyDownHandler);
        window.addEventListener('keyup', this.keyUpHandler);
    }

    private removeKeyboardInput(): void {
        if (this.keyDownHandler) {
            window.removeEventListener('keydown', this.keyDownHandler);
        }
        if (this.keyUpHandler) {
            window.removeEventListener('keyup', this.keyUpHandler);
        }
    }

    private handleKeyDown(e: KeyboardEvent): void {
        if (this.state !== 'running') return;

        const bindings = this.config.keyBindings;

        // Advance dialogue
        if (bindings.advance.includes(e.code)) {
            this.advance();
            e.preventDefault();
        }

        // Skip (hold)
        if (bindings.skip.includes(e.code) && !this.skipHeld) {
            this.skipHeld = true;
            this.runtime.setSkipMode(true);
        }

        // Toggle auto
        if (bindings.auto.includes(e.code)) {
            this.toggleAuto();
            e.preventDefault();
        }

        // Quick save
        if (bindings.save.includes(e.code)) {
            this.quickSave();
            e.preventDefault();
        }

        // Quick load
        if (bindings.load.includes(e.code)) {
            this.quickLoad();
            e.preventDefault();
        }

        // Toggle log
        if (bindings.log.includes(e.code)) {
            this.requestLog();
            e.preventDefault();
        }

        // Menu
        if (bindings.menu.includes(e.code)) {
            this.requestMenu();
            e.preventDefault();
        }
    }

    private handleKeyUp(e: KeyboardEvent): void {
        const bindings = this.config.keyBindings;

        // Release skip
        if (bindings.skip.includes(e.code) && this.skipHeld) {
            this.skipHeld = false;
            this.runtime.setSkipMode(false);
        }
    }

    /**
     * Handle click/tap input
     */
    handleClick(): void {
        if (this.state !== 'running') return;

        const state = this.runtime.getState();

        // If showing choices, let choice buttons handle it
        if (state.showingChoices) return;

        this.advance();
    }

    /**
     * Select a choice
     */
    selectChoice(choiceIndex: number): void {
        if (this.state !== 'running') return;
        this.runtime.selectChoice(choiceIndex);
    }

    // ========================================================================
    // Game Control
    // ========================================================================

    /**
     * Advance the story
     */
    advance(): void {
        if (this.transitionManager.isTransitioning()) {
            this.transitionManager.skip();
            return;
        }

        // Skip typewriter if in progress
        if (this.uiManager.isTypewriting()) {
            this.uiManager.skipTypewriter();
            return;
        }

        this.runtime.advance();
    }

    /**
     * Toggle auto-play mode
     */
    toggleAuto(): void {
        const state = this.runtime.getState();
        this.runtime.setAutoPlay(!state.autoPlay);
    }

    /**
     * Pause the game
     */
    pause(): void {
        if (this.state !== 'running') return;
        this.runtime.pause();
        this.state = 'paused';
    }

    /**
     * Resume the game
     */
    resume(): void {
        if (this.state !== 'paused') return;
        this.runtime.resume();
        this.state = 'running';
    }

    /**
     * Quick save
     */
    async quickSave(): Promise<boolean> {
        const state = this.runtime.getState();
        return this.saveManager.quickSave(state);
    }

    /**
     * Quick load
     */
    async quickLoad(): Promise<boolean> {
        return this.resumeFromSave(0);
    }

    /**
     * Save to slot
     */
    async saveToSlot(slotId: number, label?: string): Promise<boolean> {
        const state = this.runtime.getState();
        return this.saveManager.save(slotId, state, label);
    }

    /**
     * Load from slot
     */
    async loadFromSlot(slotId: number): Promise<boolean> {
        return this.resumeFromSave(slotId);
    }

    /**
     * Request menu
     */
    requestMenu(): void {
        this.pause();
        if (this.onMenuRequested) {
            this.onMenuRequested();
        }
    }

    /**
     * Request log/history
     */
    requestLog(): void {
        if (this.onLogRequested) {
            this.onLogRequested();
        }
    }

    // ========================================================================
    // Settings
    // ========================================================================

    /**
     * Get current settings
     */
    getSettings(): VNSettings {
        return this.saveManager.getSettings();
    }

    /**
     * Update settings
     */
    updateSettings(settings: Partial<VNSettings>): void {
        this.saveManager.updateSettings(settings);

        // Apply to runtime
        if (settings.textSpeed !== undefined) {
            this.runtime.setTextSpeed(settings.textSpeed);
        }
    }

    // ========================================================================
    // Callbacks
    // ========================================================================

    /**
     * Set ending callback
     */
    setOnEnd(callback: (endingId: string) => void): void {
        this.onEnd = callback;
    }

    /**
     * Set event callback
     */
    setOnEvent(callback: (event: VNEvent) => void): void {
        this.onEvent = callback;
    }

    /**
     * Set menu callback
     */
    setOnMenuRequested(callback: () => void): void {
        this.onMenuRequested = callback;
    }

    /**
     * Set log callback
     */
    setOnLogRequested(callback: () => void): void {
        this.onLogRequested = callback;
    }

    // ========================================================================
    // State Getters
    // ========================================================================

    /**
     * Get current state
     */
    getState(): VNRuntimeState {
        return this.runtime.getState();
    }

    /**
     * Get current controller state
     */
    getControllerState(): ControllerState {
        return this.state;
    }

    /**
     * Get current node
     */
    getCurrentNode(): any {
        // Access runtime internals
        return (this.runtime as any).currentNode;
    }

    /**
     * Get current dialogue
     */
    getCurrentDialogue(): any {
        const node = this.getCurrentNode();
        const state = this.runtime.getState();
        if (node?.dialogues && state.dialogueIndex < node.dialogues.length) {
            return node.dialogues[state.dialogueIndex];
        }
        return null;
    }

    /**
     * Get history
     */
    getHistory(): any[] {
        return this.runtime.getState().history;
    }

    /**
     * Get save slots
     */
    getSaveSlots(): any[] {
        return this.saveManager.getAllSlots();
    }

    /**
     * Check if auto-save exists
     */
    hasAutoSave(): boolean {
        return this.saveManager.hasAutoSave();
    }

    // ========================================================================
    // Asset Loading
    // ========================================================================

    private async preloadInitialAssets(): Promise<void> {
        if (!this.storyData || !this.assetLoaders) return;

        // Find start node
        const startNodeId = this.storyData.startNodeId;
        const startNode = this.storyData.nodes.find(n => n.id === startNodeId);
        if (!startNode) return;

        // Preload characters in start node
        const characterIds = startNode.characterIds || [];
        for (const charId of characterIds) {
            await this.loadCharacterAssets(charId);
        }

        // Preload start location
        if (startNode.locationId) {
            await this.loadLocationAssets(startNode.locationId);
        }
    }

    private async loadCharacterAssets(characterId: string): Promise<VNCharacterAssets | null> {
        if (this.characterCache.has(characterId)) {
            return this.characterCache.get(characterId)!;
        }

        if (!this.assetLoaders) return null;

        const assets = await this.assetLoaders.loadCharacter(characterId);
        if (assets) {
            this.characterCache.set(characterId, assets);
        }
        return assets;
    }

    private async loadLocationAssets(locationId: string): Promise<VNLocationAssets | null> {
        if (this.locationCache.has(locationId)) {
            return this.locationCache.get(locationId)!;
        }

        if (!this.assetLoaders) return null;

        const assets = await this.assetLoaders.loadLocation(locationId);
        if (assets) {
            this.locationCache.set(locationId, assets);
        }
        return assets;
    }

    private async updateUIFromState(state: VNRuntimeState): Promise<void> {
        // Update background
        if (state.currentBackground) {
            await this.uiManager.setBackground(state.currentBackground);
        }

        // Show visible characters
        for (const charState of state.visibleCharacters) {
            const charData = this.characters.get(charState.characterId);
            await this.uiManager.showCharacter(charState, charData);
        }

        // Update dialogue
        const dialogue = this.getCurrentDialogue();
        if (dialogue) {
            await this.uiManager.updateFromState(state, dialogue.text);
        }
    }

    // ========================================================================
    // Debug
    // ========================================================================

    /**
     * Jump to a specific node (debug)
     */
    debugJumpToNode(nodeId: string): void {
        if (!this.config.debug) {
            console.warn('[VNController] Debug mode not enabled');
            return;
        }

        (this.runtime as any).jumpToNode(nodeId);
    }

    /**
     * Set a variable (debug)
     */
    debugSetVariable(key: string, value: any): void {
        if (!this.config.debug) return;
        (this.runtime as any).setVariable(key, value);
    }

    /**
     * Get all variables (debug)
     */
    debugGetVariables(): Record<string, any> {
        if (!this.config.debug) return {};
        return this.runtime.getState().variables;
    }

    /**
     * Log current state (debug)
     */
    debugLogState(): void {
        if (!this.config.debug) return;
        console.log('[VNController Debug] State:', this.runtime.getState());
        console.log('[VNController Debug] Current Node:', this.getCurrentNode());
    }
}

// Singleton instance
const vnController = new VNController();

export { vnController, VNController };

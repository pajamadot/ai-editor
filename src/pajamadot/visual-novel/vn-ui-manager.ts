/**
 * Visual Novel UI Manager
 * Handles all UI rendering for the visual novel system in PlayCanvas
 */

import type {
    VNRuntimeState,
    VNCharacterState,
    DialogueBoxConfig,
    CharacterSpriteConfig,
    ChoiceConfig,
    TransitionConfig,
    VNEvent
} from './vn-types';
import {
    getDefaultDialogueBoxConfig,
    getDefaultCharacterSpriteConfig,
    getDefaultChoiceConfig
} from './vn-types';
import type { Choice } from '../types/story-graph';
import type { StoryCharacterData } from '../types/character';
import type { StoryLocationData } from '../types/location';

declare const pc: any;

/**
 * Character data cache
 */
interface CharacterCache {
    data: StoryCharacterData;
    textures: Map<string, any>; // expression -> pc.Texture
}

/**
 * Location data cache
 */
interface LocationCache {
    data: StoryLocationData;
    backgroundTexture?: any;
}

/**
 * VN UI Manager
 * Creates and manages PlayCanvas entities for visual novel display
 */
class VNUIManager {
    /** PlayCanvas application */
    private _app: any;

    /** Root entity for VN UI */
    private _rootEntity: any;

    /** Background entity */
    private _backgroundEntity: any;

    /** Character layer entity */
    private _characterLayer: any;

    /** Dialogue box entity */
    private _dialogueBoxEntity: any;

    /** Name box entity */
    private _nameBoxEntity: any;

    /** Text entity */
    private _textEntity: any;

    /** Name text entity */
    private _nameTextEntity: any;

    /** Continue indicator entity */
    private _continueIndicator: any;

    /** Choice container entity */
    private _choiceContainer: any;

    /** Choice button entities */
    private _choiceButtons: any[] = [];

    /** Transition overlay entity */
    private _transitionOverlay: any;

    /** Character entities */
    private _characterEntities: Map<string, any> = new Map();

    /** Character data cache */
    private _characterCache: Map<string, CharacterCache> = new Map();

    /** Location data cache */
    private _locationCache: Map<string, LocationCache> = new Map();

    /** Configurations */
    private _dialogueConfig: DialogueBoxConfig;
    private _characterConfig: CharacterSpriteConfig;
    private _choiceConfig: ChoiceConfig;

    /** Screen dimensions */
    private _screenWidth: number = 1920;
    private _screenHeight: number = 1080;

    /** Is initialized */
    private _initialized: boolean = false;

    /** Click handler */
    private _onAdvance: (() => void) | null = null;

    /** Choice handler */
    private _onChoice: ((index: number) => void) | null = null;

    constructor(app: any) {
        this._app = app;
        this._dialogueConfig = getDefaultDialogueBoxConfig();
        this._characterConfig = getDefaultCharacterSpriteConfig();
        this._choiceConfig = getDefaultChoiceConfig();
    }

    // ========================================================================
    // Initialization
    // ========================================================================

    /**
     * Initialize the UI system
     */
    initialize(): void {
        if (this._initialized) return;

        this._screenWidth = this._app.graphicsDevice.width;
        this._screenHeight = this._app.graphicsDevice.height;

        // Create root UI entity
        this._createRootEntity();

        // Create background layer
        this._createBackgroundEntity();

        // Create character layer
        this._createCharacterLayer();

        // Create transition overlay
        this._createTransitionOverlay();

        // Create dialogue box
        this._createDialogueBox();

        // Create choice container
        this._createChoiceContainer();

        // Setup input handlers
        this._setupInputHandlers();

        this._initialized = true;
        console.log('[VNUIManager] Initialized');
    }

    /**
     * Set advance callback
     */
    setAdvanceCallback(callback: () => void): void {
        this._onAdvance = callback;
    }

    /**
     * Set choice callback
     */
    setChoiceCallback(callback: (index: number) => void): void {
        this._onChoice = callback;
    }

    // ========================================================================
    // Entity Creation
    // ========================================================================

    private _createRootEntity(): void {
        this._rootEntity = new pc.Entity('VN_Root');
        this._rootEntity.addComponent('screen', {
            referenceResolution: new pc.Vec2(1920, 1080),
            scaleMode: pc.SCALEMODE_BLEND,
            scaleBlend: 0.5,
            screenSpace: true
        });
        this._app.root.addChild(this._rootEntity);
    }

    private _createBackgroundEntity(): void {
        this._backgroundEntity = new pc.Entity('VN_Background');
        this._backgroundEntity.addComponent('element', {
            type: 'image',
            anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5),
            pivot: new pc.Vec2(0.5, 0.5),
            width: this._screenWidth,
            height: this._screenHeight,
            color: new pc.Color(0.1, 0.1, 0.1)
        });
        this._rootEntity.addChild(this._backgroundEntity);
    }

    private _createCharacterLayer(): void {
        this._characterLayer = new pc.Entity('VN_Characters');
        this._characterLayer.addComponent('element', {
            type: 'group',
            anchor: new pc.Vec4(0, 0, 1, 1),
            pivot: new pc.Vec2(0.5, 0.5)
        });
        this._rootEntity.addChild(this._characterLayer);
    }

    private _createTransitionOverlay(): void {
        this._transitionOverlay = new pc.Entity('VN_TransitionOverlay');
        this._transitionOverlay.addComponent('element', {
            type: 'image',
            anchor: new pc.Vec4(0, 0, 1, 1),
            pivot: new pc.Vec2(0.5, 0.5),
            color: new pc.Color(0, 0, 0),
            opacity: 0
        });
        this._transitionOverlay.enabled = false;
        this._rootEntity.addChild(this._transitionOverlay);
    }

    private _createDialogueBox(): void {
        const config = this._dialogueConfig;

        // Main dialogue box container
        this._dialogueBoxEntity = new pc.Entity('VN_DialogueBox');
        this._dialogueBoxEntity.addComponent('element', {
            type: 'image',
            anchor: new pc.Vec4(0, 0, 1, 0.25),
            pivot: new pc.Vec2(0.5, 0),
            margin: new pc.Vec4(20, 20, 20, 20),
            color: this._parseColor(config.background),
            opacity: config.opacity
        });

        // Make it clickable
        this._dialogueBoxEntity.addComponent('button', {
            active: true
        });

        this._rootEntity.addChild(this._dialogueBoxEntity);

        // Name box
        this._nameBoxEntity = new pc.Entity('VN_NameBox');
        this._nameBoxEntity.addComponent('element', {
            type: 'image',
            anchor: new pc.Vec4(0, 1, 0, 1),
            pivot: new pc.Vec2(0, 0),
            width: 250,
            height: 40,
            margin: new pc.Vec4(20, 5, 0, 0),
            color: new pc.Color(0.15, 0.1, 0.2),
            opacity: 0.95
        });
        this._dialogueBoxEntity.addChild(this._nameBoxEntity);

        // Name text
        this._nameTextEntity = new pc.Entity('VN_NameText');
        this._nameTextEntity.addComponent('element', {
            type: 'text',
            anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5),
            pivot: new pc.Vec2(0.5, 0.5),
            text: '',
            fontAsset: null, // Will use system font
            fontSize: config.nameFont.size,
            color: this._parseColor(config.nameFont.color),
            alignment: new pc.Vec2(0.5, 0.5)
        });
        this._nameBoxEntity.addChild(this._nameTextEntity);

        // Main text
        this._textEntity = new pc.Entity('VN_DialogueText');
        this._textEntity.addComponent('element', {
            type: 'text',
            anchor: new pc.Vec4(0, 0, 1, 1),
            pivot: new pc.Vec2(0, 1),
            margin: new pc.Vec4(
                config.padding.left,
                config.padding.top,
                config.padding.right,
                config.padding.bottom
            ),
            text: '',
            fontAsset: null,
            fontSize: config.font.size,
            color: this._parseColor(config.font.color),
            lineHeight: config.font.lineHeight * config.font.size,
            wrapLines: true,
            alignment: new pc.Vec2(0, 1)
        });
        this._dialogueBoxEntity.addChild(this._textEntity);

        // Continue indicator
        if (config.showContinueIndicator) {
            this._continueIndicator = new pc.Entity('VN_ContinueIndicator');
            this._continueIndicator.addComponent('element', {
                type: 'text',
                anchor: new pc.Vec4(1, 0, 1, 0),
                pivot: new pc.Vec2(1, 0),
                margin: new pc.Vec4(0, 0, 20, 10),
                text: '▼',
                fontSize: 20,
                color: new pc.Color(1, 0.8, 0)
            });
            this._continueIndicator.enabled = false;
            this._dialogueBoxEntity.addChild(this._continueIndicator);
        }
    }

    private _createChoiceContainer(): void {
        this._choiceContainer = new pc.Entity('VN_ChoiceContainer');
        this._choiceContainer.addComponent('element', {
            type: 'group',
            anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5),
            pivot: new pc.Vec2(0.5, 0.5)
        });
        this._choiceContainer.enabled = false;
        this._rootEntity.addChild(this._choiceContainer);
    }

    private _createChoiceButton(index: number, text: string, yOffset: number): any {
        const config = this._choiceConfig;

        const button = new pc.Entity(`VN_Choice_${index}`);
        button.addComponent('element', {
            type: 'image',
            anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5),
            pivot: new pc.Vec2(0.5, 0.5),
            width: 600,
            height: 50,
            margin: new pc.Vec4(0, yOffset, 0, 0),
            color: this._parseColor(config.buttonStyle.background)
        });

        button.addComponent('button', {
            active: true,
            hoverTint: this._parseColor(config.buttonStyle.hoverBackground)
        });

        // Button text
        const textEntity = new pc.Entity('Text');
        textEntity.addComponent('element', {
            type: 'text',
            anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5),
            pivot: new pc.Vec2(0.5, 0.5),
            text: text,
            fontSize: 22,
            color: this._parseColor(config.buttonStyle.textColor),
            alignment: new pc.Vec2(0.5, 0.5)
        });
        button.addChild(textEntity);

        // Click handler
        button.button.on('click', () => {
            if (this._onChoice) {
                this._onChoice(index);
            }
        });

        return button;
    }

    // ========================================================================
    // Input Handling
    // ========================================================================

    private _setupInputHandlers(): void {
        // Mouse click on dialogue box
        if (this._dialogueBoxEntity.button) {
            this._dialogueBoxEntity.button.on('click', () => {
                if (this._onAdvance) {
                    this._onAdvance();
                }
            });
        }

        // Keyboard input
        this._app.keyboard.on('keydown', (event: any) => {
            if (event.key === pc.KEY_SPACE || event.key === pc.KEY_RETURN) {
                if (this._onAdvance) {
                    this._onAdvance();
                }
            }
        });
    }

    // ========================================================================
    // State Updates
    // ========================================================================

    /**
     * Update UI from runtime state
     */
    updateFromState(state: VNRuntimeState, text: string): void {
        // Update dialogue text
        this._updateDialogueText(text);

        // Update continue indicator
        this._updateContinueIndicator(state);

        // Update choices visibility
        this._updateChoicesVisibility(state.showingChoices);
    }

    /**
     * Set speaker name
     */
    setSpeakerName(name: string | null): void {
        if (this._nameTextEntity) {
            this._nameTextEntity.element.text = name || '';
        }
        if (this._nameBoxEntity) {
            this._nameBoxEntity.enabled = !!name;
        }
    }

    /**
     * Update dialogue text
     */
    private _updateDialogueText(text: string): void {
        if (this._textEntity) {
            this._textEntity.element.text = text;
        }
    }

    /**
     * Update continue indicator
     */
    private _updateContinueIndicator(state: VNRuntimeState): void {
        if (!this._continueIndicator) return;

        // Show when text is complete and not showing choices
        const shouldShow = !state.showingChoices && state.waitingForInput === false;
        this._continueIndicator.enabled = shouldShow;
    }

    // ========================================================================
    // Character Display
    // ========================================================================

    /**
     * Show a character sprite
     */
    showCharacter(characterState: VNCharacterState, characterData?: StoryCharacterData): void {
        let entity = this._characterEntities.get(characterState.characterId);

        if (!entity) {
            entity = this._createCharacterEntity(characterState.characterId);
            this._characterEntities.set(characterState.characterId, entity);
        }

        // Position
        const pos = this._characterConfig.positions[characterState.position];
        entity.setLocalPosition(
            (pos.x - 0.5) * this._screenWidth + characterState.offsetX,
            (pos.y - 0.5) * this._screenHeight + characterState.offsetY,
            0
        );

        // Scale
        entity.setLocalScale(characterState.scale, characterState.scale, 1);

        // Alpha/Highlighting
        if (entity.element) {
            const dimAmount = this._characterConfig.highlightSpeaker && !characterState.highlighted
                ? this._characterConfig.dimAmount
                : 1.0;
            entity.element.opacity = characterState.alpha * dimAmount;
        }

        // Load texture for expression if we have character data
        if (characterData && characterData.expressionAssets) {
            const expressionAssetId = characterData.expressionAssets[characterState.expression];
            if (expressionAssetId) {
                const asset = this._app.assets.get(expressionAssetId);
                if (asset && entity.element) {
                    entity.element.textureAsset = expressionAssetId;
                }
            }
        }

        entity.enabled = true;
    }

    /**
     * Hide a character sprite
     */
    hideCharacter(characterId: string): void {
        const entity = this._characterEntities.get(characterId);
        if (entity) {
            entity.enabled = false;
        }
    }

    /**
     * Update character expression
     */
    setCharacterExpression(characterId: string, expression: string): void {
        const cache = this._characterCache.get(characterId);
        const entity = this._characterEntities.get(characterId);

        if (cache && entity) {
            const expressionAssetId = cache.data.expressionAssets?.[expression];
            if (expressionAssetId && entity.element) {
                entity.element.textureAsset = expressionAssetId;
            }
        }
    }

    private _createCharacterEntity(characterId: string): any {
        const entity = new pc.Entity(`VN_Character_${characterId}`);
        entity.addComponent('element', {
            type: 'image',
            anchor: new pc.Vec4(0.5, 0, 0.5, 0),
            pivot: new pc.Vec2(0.5, 0),
            width: 600,
            height: 900,
            color: new pc.Color(1, 1, 1)
        });
        entity.enabled = false;
        this._characterLayer.addChild(entity);
        return entity;
    }

    // ========================================================================
    // Background
    // ========================================================================

    /**
     * Set background image
     */
    setBackground(textureAssetId: number | null): void {
        if (!this._backgroundEntity || !this._backgroundEntity.element) return;

        if (textureAssetId) {
            this._backgroundEntity.element.textureAsset = textureAssetId;
        } else {
            this._backgroundEntity.element.textureAsset = null;
        }
    }

    /**
     * Set background color
     */
    setBackgroundColor(color: string): void {
        if (!this._backgroundEntity || !this._backgroundEntity.element) return;
        this._backgroundEntity.element.color = this._parseColor(color);
    }

    // ========================================================================
    // Choices
    // ========================================================================

    /**
     * Show choices
     */
    showChoices(choices: Choice[]): void {
        // Clear existing buttons
        this._clearChoiceButtons();

        const buttonHeight = 60;
        const spacing = 10;
        const totalHeight = choices.length * buttonHeight + (choices.length - 1) * spacing;
        const startY = totalHeight / 2;

        for (let i = 0; i < choices.length; i++) {
            const yOffset = startY - i * (buttonHeight + spacing);
            const button = this._createChoiceButton(i, choices[i].text, yOffset);
            this._choiceButtons.push(button);
            this._choiceContainer.addChild(button);
        }

        this._choiceContainer.enabled = true;
    }

    /**
     * Hide choices
     */
    hideChoices(): void {
        this._choiceContainer.enabled = false;
        this._clearChoiceButtons();
    }

    private _updateChoicesVisibility(showing: boolean): void {
        if (this._choiceContainer) {
            this._choiceContainer.enabled = showing;
        }
    }

    private _clearChoiceButtons(): void {
        for (const button of this._choiceButtons) {
            button.destroy();
        }
        this._choiceButtons = [];
    }

    // ========================================================================
    // Transitions
    // ========================================================================

    /**
     * Perform a transition effect
     */
    async transition(config: TransitionConfig): Promise<void> {
        return new Promise((resolve) => {
            const duration = config.duration || 0.5;

            switch (config.type) {
                case 'fade':
                    this._fadeTransition(duration, resolve);
                    break;
                case 'flash':
                    this._flashTransition(duration, config.params?.color || '#ffffff', resolve);
                    break;
                case 'shake':
                    this._shakeTransition(duration, config.params?.intensity || 10, resolve);
                    break;
                default:
                    resolve();
            }
        });
    }

    private _fadeTransition(duration: number, onComplete: () => void): void {
        if (!this._transitionOverlay) {
            onComplete();
            return;
        }

        this._transitionOverlay.enabled = true;
        this._transitionOverlay.element.opacity = 0;

        // Fade in
        this._tweenValue(0, 1, duration / 2, (value) => {
            this._transitionOverlay.element.opacity = value;
        }, () => {
            // Fade out
            this._tweenValue(1, 0, duration / 2, (value) => {
                this._transitionOverlay.element.opacity = value;
            }, () => {
                this._transitionOverlay.enabled = false;
                onComplete();
            });
        });
    }

    private _flashTransition(duration: number, color: string, onComplete: () => void): void {
        if (!this._transitionOverlay) {
            onComplete();
            return;
        }

        this._transitionOverlay.element.color = this._parseColor(color);
        this._transitionOverlay.enabled = true;
        this._transitionOverlay.element.opacity = 1;

        this._tweenValue(1, 0, duration, (value) => {
            this._transitionOverlay.element.opacity = value;
        }, () => {
            this._transitionOverlay.enabled = false;
            onComplete();
        });
    }

    private _shakeTransition(duration: number, intensity: number, onComplete: () => void): void {
        const startTime = Date.now();
        const originalPos = this._rootEntity.getLocalPosition().clone();

        const shake = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            if (elapsed >= duration) {
                this._rootEntity.setLocalPosition(originalPos);
                onComplete();
                return;
            }

            const factor = 1 - elapsed / duration;
            const offsetX = (Math.random() - 0.5) * intensity * 2 * factor;
            const offsetY = (Math.random() - 0.5) * intensity * 2 * factor;

            this._rootEntity.setLocalPosition(
                originalPos.x + offsetX,
                originalPos.y + offsetY,
                originalPos.z
            );

            requestAnimationFrame(shake);
        };

        shake();
    }

    private _tweenValue(
        from: number,
        to: number,
        duration: number,
        onUpdate: (value: number) => void,
        onComplete: () => void
    ): void {
        const startTime = Date.now();

        const update = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            const t = Math.min(elapsed / duration, 1);
            const value = from + (to - from) * t;

            onUpdate(value);

            if (t < 1) {
                requestAnimationFrame(update);
            } else {
                onComplete();
            }
        };

        update();
    }

    // ========================================================================
    // Visibility
    // ========================================================================

    /**
     * Show the VN UI
     */
    show(): void {
        if (this._rootEntity) {
            this._rootEntity.enabled = true;
        }
    }

    /**
     * Hide the VN UI
     */
    hide(): void {
        if (this._rootEntity) {
            this._rootEntity.enabled = false;
        }
    }

    /**
     * Show/hide dialogue box
     */
    setDialogueBoxVisible(visible: boolean): void {
        if (this._dialogueBoxEntity) {
            this._dialogueBoxEntity.enabled = visible;
        }
    }

    // ========================================================================
    // Utility
    // ========================================================================

    private _parseColor(colorString: string): any {
        if (colorString.startsWith('rgba')) {
            const match = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (match) {
                return new pc.Color(
                    parseInt(match[1]) / 255,
                    parseInt(match[2]) / 255,
                    parseInt(match[3]) / 255
                );
            }
        } else if (colorString.startsWith('#')) {
            const hex = colorString.slice(1);
            return new pc.Color(
                parseInt(hex.slice(0, 2), 16) / 255,
                parseInt(hex.slice(2, 4), 16) / 255,
                parseInt(hex.slice(4, 6), 16) / 255
            );
        }
        return new pc.Color(1, 1, 1);
    }

    // ========================================================================
    // Cache Management
    // ========================================================================

    /**
     * Register character data
     */
    registerCharacter(characterId: string, data: StoryCharacterData): void {
        this._characterCache.set(characterId, {
            data,
            textures: new Map()
        });
    }

    /**
     * Register location data
     */
    registerLocation(locationId: string, data: StoryLocationData): void {
        this._locationCache.set(locationId, { data });
    }

    // ========================================================================
    // Cleanup
    // ========================================================================

    /**
     * Destroy the UI manager
     */
    destroy(): void {
        this._clearChoiceButtons();

        for (const entity of this._characterEntities.values()) {
            entity.destroy();
        }
        this._characterEntities.clear();

        if (this._rootEntity) {
            this._rootEntity.destroy();
        }

        this._characterCache.clear();
        this._locationCache.clear();
        this._initialized = false;
    }
}

// Singleton instance
const vnUIManager = new VNUIManager();

export { vnUIManager, VNUIManager };

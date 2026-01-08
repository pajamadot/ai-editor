/**
 * VN Editor Panel
 * PlayCanvas Editor panel for authoring and testing visual novels
 *
 * Features:
 * - Story graph visualization
 * - Node editing (dialogues, choices, characters)
 * - Live preview in editor viewport
 * - Asset management integration
 * - AIGC generation for VN assets
 * - Export/import story data
 */

import type { StoryGraphData, SceneNode, StoryNode, Dialogue, Choice } from '../types/story-graph';
import type { StoryCharacterData } from '../types/character';
import type { StoryLocationData } from '../types/location';
import type { VNSettings, DialogueBoxConfig, CharacterSpriteConfig } from './vn-types';
import { getDefaultDialogueBoxConfig, getDefaultCharacterSpriteConfig, getDefaultChoiceConfig } from './vn-types';

declare const editor: any;
declare const pcui: any;

/**
 * VN Editor Panel state
 */
interface VNEditorState {
    currentStoryId: string | null;
    currentNodeId: string | null;
    selectedDialogueIndex: number;
    isPreviewMode: boolean;
    isDirty: boolean;
    zoomLevel: number;
    panOffset: { x: number; y: number };
}

/**
 * VN Editor Panel
 * Provides authoring tools for visual novels in PlayCanvas Editor
 */
class VNEditorPanel {
    private panel: any = null;
    private container: HTMLElement | null = null;
    private state: VNEditorState = {
        currentStoryId: null,
        currentNodeId: null,
        selectedDialogueIndex: 0,
        isPreviewMode: false,
        isDirty: false,
        zoomLevel: 1,
        panOffset: { x: 0, y: 0 }
    };

    // Cached data
    private storyData: StoryGraphData | null = null;
    private characters: Map<string, StoryCharacterData> = new Map();
    private locations: Map<string, StoryLocationData> = new Map();

    // UI elements
    private toolbar: HTMLElement | null = null;
    private graphCanvas: HTMLCanvasElement | null = null;
    private graphCtx: CanvasRenderingContext2D | null = null;
    private propertiesPanel: HTMLElement | null = null;
    private dialogueEditor: HTMLElement | null = null;

    // Graph interaction
    private isDragging: boolean = false;
    private dragStartPos: { x: number; y: number } = { x: 0, y: 0 };
    private selectedNodes: Set<string> = new Set();

    /**
     * Register the panel with PlayCanvas Editor
     */
    static register(): void {
        if (typeof editor === 'undefined') {
            console.warn('[VNEditorPanel] Editor not available');
            return;
        }

        // Register as a panel
        editor.once('load', () => {
            const vnPanel = new VNEditorPanel();
            vnPanel.initialize();
        });

        console.log('[VNEditorPanel] Registered');
    }

    /**
     * Initialize the panel
     */
    initialize(): void {
        if (typeof editor === 'undefined') return;

        // Create panel container
        this.createPanel();

        // Build UI
        this.buildToolbar();
        this.buildGraphView();
        this.buildPropertiesPanel();
        this.buildDialogueEditor();

        // Setup event handlers
        this.setupEventHandlers();

        console.log('[VNEditorPanel] Initialized');
    }

    /**
     * Create the main panel
     */
    private createPanel(): void {
        // Create panel container
        this.container = document.createElement('div');
        this.container.className = 'vn-editor-panel';
        this.container.innerHTML = `
            <style>
                .vn-editor-panel {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    background: #1a1a2e;
                    color: #fff;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }

                .vn-toolbar {
                    display: flex;
                    gap: 8px;
                    padding: 8px;
                    background: #16213e;
                    border-bottom: 1px solid #0f3460;
                }

                .vn-toolbar button {
                    padding: 6px 12px;
                    background: #0f3460;
                    color: #fff;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                }

                .vn-toolbar button:hover {
                    background: #1a508b;
                }

                .vn-toolbar button.active {
                    background: #e94560;
                }

                .vn-main-area {
                    display: flex;
                    flex: 1;
                    overflow: hidden;
                }

                .vn-graph-container {
                    flex: 1;
                    position: relative;
                    overflow: hidden;
                }

                .vn-graph-canvas {
                    position: absolute;
                    top: 0;
                    left: 0;
                }

                .vn-sidebar {
                    width: 300px;
                    background: #16213e;
                    border-left: 1px solid #0f3460;
                    overflow-y: auto;
                }

                .vn-section {
                    padding: 12px;
                    border-bottom: 1px solid #0f3460;
                }

                .vn-section-title {
                    font-size: 12px;
                    font-weight: 600;
                    color: #9ca3af;
                    margin-bottom: 8px;
                    text-transform: uppercase;
                }

                .vn-field {
                    margin-bottom: 8px;
                }

                .vn-field label {
                    display: block;
                    font-size: 11px;
                    color: #9ca3af;
                    margin-bottom: 4px;
                }

                .vn-field input,
                .vn-field select,
                .vn-field textarea {
                    width: 100%;
                    padding: 6px 8px;
                    background: #1a1a2e;
                    border: 1px solid #0f3460;
                    border-radius: 4px;
                    color: #fff;
                    font-size: 12px;
                }

                .vn-field textarea {
                    min-height: 80px;
                    resize: vertical;
                }

                .vn-dialogue-list {
                    max-height: 200px;
                    overflow-y: auto;
                }

                .vn-dialogue-item {
                    padding: 8px;
                    background: #1a1a2e;
                    border-radius: 4px;
                    margin-bottom: 4px;
                    cursor: pointer;
                    font-size: 12px;
                }

                .vn-dialogue-item:hover {
                    background: #252542;
                }

                .vn-dialogue-item.selected {
                    background: #e94560;
                }

                .vn-choice-list {
                    margin-top: 8px;
                }

                .vn-choice-item {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 8px;
                }

                .vn-choice-item input {
                    flex: 1;
                }

                .vn-btn-add {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                    width: 100%;
                    padding: 8px;
                    background: #0f3460;
                    border: 1px dashed #1a508b;
                    border-radius: 4px;
                    color: #9ca3af;
                    cursor: pointer;
                    font-size: 12px;
                }

                .vn-btn-add:hover {
                    background: #1a508b;
                    color: #fff;
                }

                .vn-node {
                    position: absolute;
                    padding: 12px;
                    background: #16213e;
                    border: 2px solid #0f3460;
                    border-radius: 8px;
                    min-width: 150px;
                    cursor: move;
                }

                .vn-node.selected {
                    border-color: #e94560;
                }

                .vn-node-title {
                    font-size: 12px;
                    font-weight: 600;
                    margin-bottom: 4px;
                }

                .vn-node-type {
                    font-size: 10px;
                    color: #9ca3af;
                    text-transform: uppercase;
                }

                .vn-node-dialogue {
                    background: #1a508b;
                    border-color: #1a508b;
                }

                .vn-node-choice {
                    background: #e94560;
                    border-color: #e94560;
                }

                .vn-node-scene {
                    background: #0f9b8e;
                    border-color: #0f9b8e;
                }

                .vn-preview-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 100;
                }

                .vn-preview-content {
                    width: 80%;
                    max-width: 800px;
                    background: #1a1a2e;
                    border-radius: 8px;
                    overflow: hidden;
                }

                .vn-minimap {
                    position: absolute;
                    bottom: 10px;
                    right: 10px;
                    width: 150px;
                    height: 100px;
                    background: rgba(22, 33, 62, 0.9);
                    border: 1px solid #0f3460;
                    border-radius: 4px;
                }

                .vn-zoom-controls {
                    position: absolute;
                    bottom: 10px;
                    left: 10px;
                    display: flex;
                    gap: 4px;
                }

                .vn-zoom-btn {
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #16213e;
                    border: 1px solid #0f3460;
                    border-radius: 4px;
                    color: #fff;
                    cursor: pointer;
                }

                .vn-zoom-btn:hover {
                    background: #1a508b;
                }
            </style>

            <div class="vn-toolbar"></div>
            <div class="vn-main-area">
                <div class="vn-graph-container">
                    <canvas class="vn-graph-canvas"></canvas>
                    <div class="vn-zoom-controls">
                        <button class="vn-zoom-btn" data-action="zoom-in">+</button>
                        <button class="vn-zoom-btn" data-action="zoom-out">-</button>
                        <button class="vn-zoom-btn" data-action="zoom-fit">Fit</button>
                    </div>
                    <div class="vn-minimap"></div>
                </div>
                <div class="vn-sidebar"></div>
            </div>
        `;

        // Get references to key elements
        this.toolbar = this.container.querySelector('.vn-toolbar');
        this.graphCanvas = this.container.querySelector('.vn-graph-canvas');
        this.graphCtx = this.graphCanvas?.getContext('2d') || null;
        this.propertiesPanel = this.container.querySelector('.vn-sidebar');
    }

    /**
     * Build the toolbar
     */
    private buildToolbar(): void {
        if (!this.toolbar) return;

        this.toolbar.innerHTML = `
            <button data-action="new-story">New Story</button>
            <button data-action="load-story">Load Story</button>
            <button data-action="save-story">Save Story</button>
            <div style="flex: 1;"></div>
            <button data-action="add-node">+ Add Node</button>
            <button data-action="add-dialogue">+ Dialogue</button>
            <button data-action="add-choice">+ Choice</button>
            <button data-action="add-scene">+ Scene</button>
            <div style="flex: 1;"></div>
            <button data-action="preview">Preview</button>
            <button data-action="export">Export</button>
            <button data-action="aigc">AIGC</button>
        `;

        // Add click handlers
        this.toolbar.addEventListener('click', (e: Event) => {
            const target = e.target as HTMLElement;
            const action = target.dataset.action;
            if (action) {
                this.handleToolbarAction(action);
            }
        });
    }

    /**
     * Build the graph view
     */
    private buildGraphView(): void {
        if (!this.graphCanvas) return;

        // Set canvas size
        this.resizeCanvas();

        // Add event listeners
        this.graphCanvas.addEventListener('mousedown', this.handleGraphMouseDown.bind(this));
        this.graphCanvas.addEventListener('mousemove', this.handleGraphMouseMove.bind(this));
        this.graphCanvas.addEventListener('mouseup', this.handleGraphMouseUp.bind(this));
        this.graphCanvas.addEventListener('wheel', this.handleGraphWheel.bind(this));
        this.graphCanvas.addEventListener('dblclick', this.handleGraphDoubleClick.bind(this));

        // Initial render
        this.renderGraph();

        // Handle resize
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    /**
     * Resize canvas to fit container
     */
    private resizeCanvas(): void {
        if (!this.graphCanvas) return;

        const container = this.graphCanvas.parentElement;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        this.graphCanvas.width = rect.width;
        this.graphCanvas.height = rect.height;

        this.renderGraph();
    }

    /**
     * Build the properties panel
     */
    private buildPropertiesPanel(): void {
        if (!this.propertiesPanel) return;

        this.propertiesPanel.innerHTML = `
            <div class="vn-section">
                <div class="vn-section-title">Node Properties</div>
                <div class="vn-field">
                    <label>Node ID</label>
                    <input type="text" id="vn-node-id" readonly />
                </div>
                <div class="vn-field">
                    <label>Title</label>
                    <input type="text" id="vn-node-title" placeholder="Enter title..." />
                </div>
                <div class="vn-field">
                    <label>Type</label>
                    <select id="vn-node-type">
                        <option value="story">Story</option>
                        <option value="dialogue">Dialogue</option>
                        <option value="choice">Choice</option>
                        <option value="scene">Scene Change</option>
                        <option value="ending">Ending</option>
                    </select>
                </div>
            </div>

            <div class="vn-section" id="vn-dialogue-section">
                <div class="vn-section-title">Dialogues</div>
                <div class="vn-dialogue-list" id="vn-dialogue-list"></div>
                <button class="vn-btn-add" data-action="add-dialogue-line">+ Add Dialogue</button>
            </div>

            <div class="vn-section" id="vn-dialogue-editor-section" style="display: none;">
                <div class="vn-section-title">Edit Dialogue</div>
                <div class="vn-field">
                    <label>Speaker</label>
                    <select id="vn-dialogue-speaker">
                        <option value="">Narrator</option>
                    </select>
                </div>
                <div class="vn-field">
                    <label>Expression</label>
                    <select id="vn-dialogue-expression">
                        <option value="default">Default</option>
                        <option value="happy">Happy</option>
                        <option value="sad">Sad</option>
                        <option value="angry">Angry</option>
                        <option value="surprised">Surprised</option>
                    </select>
                </div>
                <div class="vn-field">
                    <label>Text</label>
                    <textarea id="vn-dialogue-text" placeholder="Enter dialogue text..."></textarea>
                </div>
                <div class="vn-field">
                    <label>Voice Clip (optional)</label>
                    <input type="text" id="vn-dialogue-voice" placeholder="Asset ID or URL" />
                </div>
            </div>

            <div class="vn-section" id="vn-choices-section" style="display: none;">
                <div class="vn-section-title">Choices</div>
                <div class="vn-choice-list" id="vn-choice-list"></div>
                <button class="vn-btn-add" data-action="add-choice-option">+ Add Choice</button>
            </div>

            <div class="vn-section" id="vn-scene-section" style="display: none;">
                <div class="vn-section-title">Scene Settings</div>
                <div class="vn-field">
                    <label>Location</label>
                    <select id="vn-scene-location"></select>
                </div>
                <div class="vn-field">
                    <label>Background</label>
                    <input type="text" id="vn-scene-background" placeholder="Asset ID or URL" />
                    <button class="vn-btn-add" data-action="generate-background">Generate with AI</button>
                </div>
                <div class="vn-field">
                    <label>BGM</label>
                    <input type="text" id="vn-scene-bgm" placeholder="Asset ID or URL" />
                    <button class="vn-btn-add" data-action="generate-bgm">Generate with AI</button>
                </div>
                <div class="vn-field">
                    <label>Transition</label>
                    <select id="vn-scene-transition">
                        <option value="none">None</option>
                        <option value="fade">Fade</option>
                        <option value="dissolve">Dissolve</option>
                        <option value="slide-left">Slide Left</option>
                        <option value="slide-right">Slide Right</option>
                    </select>
                </div>
            </div>

            <div class="vn-section" id="vn-characters-section">
                <div class="vn-section-title">Characters in Scene</div>
                <div id="vn-characters-list"></div>
                <button class="vn-btn-add" data-action="add-character">+ Add Character</button>
            </div>
        `;

        // Add event listeners for property changes
        this.setupPropertyListeners();
    }

    /**
     * Build the dialogue editor
     */
    private buildDialogueEditor(): void {
        // The dialogue editor is embedded in properties panel
        this.dialogueEditor = this.propertiesPanel?.querySelector('#vn-dialogue-editor-section') || null;
    }

    /**
     * Setup property change listeners
     */
    private setupPropertyListeners(): void {
        if (!this.propertiesPanel) return;

        // Node title
        const titleInput = this.propertiesPanel.querySelector('#vn-node-title') as HTMLInputElement;
        titleInput?.addEventListener('input', () => {
            this.updateNodeProperty('title', titleInput.value);
        });

        // Node type
        const typeSelect = this.propertiesPanel.querySelector('#vn-node-type') as HTMLSelectElement;
        typeSelect?.addEventListener('change', () => {
            this.updateNodeProperty('type', typeSelect.value);
            this.updatePropertySections(typeSelect.value);
        });

        // Dialogue text
        const dialogueText = this.propertiesPanel.querySelector('#vn-dialogue-text') as HTMLTextAreaElement;
        dialogueText?.addEventListener('input', () => {
            this.updateDialogueProperty('text', dialogueText.value);
        });

        // Speaker
        const speakerSelect = this.propertiesPanel.querySelector('#vn-dialogue-speaker') as HTMLSelectElement;
        speakerSelect?.addEventListener('change', () => {
            this.updateDialogueProperty('speakerId', speakerSelect.value || null);
        });

        // Expression
        const expressionSelect = this.propertiesPanel.querySelector('#vn-dialogue-expression') as HTMLSelectElement;
        expressionSelect?.addEventListener('change', () => {
            this.updateDialogueProperty('expression', expressionSelect.value);
        });

        // Add dialogue line button
        const addDialogueBtn = this.propertiesPanel.querySelector('[data-action="add-dialogue-line"]');
        addDialogueBtn?.addEventListener('click', () => this.addDialogueLine());

        // Add choice button
        const addChoiceBtn = this.propertiesPanel.querySelector('[data-action="add-choice-option"]');
        addChoiceBtn?.addEventListener('click', () => this.addChoiceOption());

        // Add character button
        const addCharBtn = this.propertiesPanel.querySelector('[data-action="add-character"]');
        addCharBtn?.addEventListener('click', () => this.addCharacterToScene());

        // Generate background button
        const genBgBtn = this.propertiesPanel.querySelector('[data-action="generate-background"]');
        genBgBtn?.addEventListener('click', () => this.generateBackgroundWithAI());

        // Generate BGM button
        const genBgmBtn = this.propertiesPanel.querySelector('[data-action="generate-bgm"]');
        genBgmBtn?.addEventListener('click', () => this.generateBGMWithAI());
    }

    /**
     * Setup event handlers
     */
    private setupEventHandlers(): void {
        // Zoom controls
        const zoomControls = this.container?.querySelector('.vn-zoom-controls');
        zoomControls?.addEventListener('click', (e: Event) => {
            const target = e.target as HTMLElement;
            const action = target.dataset.action;
            if (action === 'zoom-in') {
                this.state.zoomLevel = Math.min(2, this.state.zoomLevel + 0.1);
            } else if (action === 'zoom-out') {
                this.state.zoomLevel = Math.max(0.25, this.state.zoomLevel - 0.1);
            } else if (action === 'zoom-fit') {
                this.fitGraphToView();
            }
            this.renderGraph();
        });
    }

    // ========================================================================
    // Toolbar Actions
    // ========================================================================

    private handleToolbarAction(action: string): void {
        switch (action) {
            case 'new-story':
                this.createNewStory();
                break;
            case 'load-story':
                this.loadStory();
                break;
            case 'save-story':
                this.saveStory();
                break;
            case 'add-node':
                this.addNode('story');
                break;
            case 'add-dialogue':
                this.addNode('dialogue');
                break;
            case 'add-choice':
                this.addNode('choice');
                break;
            case 'add-scene':
                this.addNode('scene');
                break;
            case 'preview':
                this.togglePreview();
                break;
            case 'export':
                this.exportStory();
                break;
            case 'aigc':
                this.openAIGCPanel();
                break;
        }
    }

    // ========================================================================
    // Graph Rendering
    // ========================================================================

    private renderGraph(): void {
        if (!this.graphCanvas || !this.graphCtx || !this.storyData) {
            this.renderEmptyState();
            return;
        }

        const ctx = this.graphCtx;
        const width = this.graphCanvas.width;
        const height = this.graphCanvas.height;

        // Clear canvas
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, width, height);

        // Draw grid
        this.drawGrid(ctx, width, height);

        // Apply transform
        ctx.save();
        ctx.translate(this.state.panOffset.x, this.state.panOffset.y);
        ctx.scale(this.state.zoomLevel, this.state.zoomLevel);

        // Draw connections
        this.drawConnections(ctx);

        // Draw nodes
        this.drawNodes(ctx);

        ctx.restore();
    }

    private renderEmptyState(): void {
        if (!this.graphCanvas || !this.graphCtx) return;

        const ctx = this.graphCtx;
        const width = this.graphCanvas.width;
        const height = this.graphCanvas.height;

        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#9ca3af';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No story loaded', width / 2, height / 2 - 10);
        ctx.font = '12px sans-serif';
        ctx.fillText('Click "New Story" or "Load Story" to begin', width / 2, height / 2 + 15);
    }

    private drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number): void {
        const gridSize = 50 * this.state.zoomLevel;
        const offsetX = this.state.panOffset.x % gridSize;
        const offsetY = this.state.panOffset.y % gridSize;

        ctx.strokeStyle = 'rgba(15, 52, 96, 0.5)';
        ctx.lineWidth = 1;

        // Vertical lines
        for (let x = offsetX; x < width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        // Horizontal lines
        for (let y = offsetY; y < height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    }

    private drawConnections(ctx: CanvasRenderingContext2D): void {
        if (!this.storyData) return;

        const connections = this.storyData.connections || [];
        const nodeMap = new Map(this.storyData.nodes.map(n => [n.id, n]));

        ctx.strokeStyle = '#0f3460';
        ctx.lineWidth = 2;

        for (const conn of connections) {
            const fromNode = nodeMap.get(conn.fromNodeId);
            const toNode = nodeMap.get(conn.toNodeId);

            if (!fromNode || !toNode) continue;

            const fromPos = fromNode.position || { x: 0, y: 0 };
            const toPos = toNode.position || { x: 0, y: 0 };

            // Draw bezier curve
            const startX = fromPos.x + 75; // Center of node
            const startY = fromPos.y + 25;
            const endX = toPos.x + 75;
            const endY = toPos.y + 25;

            const midX = (startX + endX) / 2;

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.bezierCurveTo(midX, startY, midX, endY, endX, endY);
            ctx.stroke();

            // Draw arrow
            this.drawArrow(ctx, midX, (startY + endY) / 2, endX, endY);
        }
    }

    private drawArrow(ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number): void {
        const angle = Math.atan2(toY - fromY, toX - fromX);
        const arrowSize = 8;

        ctx.fillStyle = '#0f3460';
        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(
            toX - arrowSize * Math.cos(angle - Math.PI / 6),
            toY - arrowSize * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
            toX - arrowSize * Math.cos(angle + Math.PI / 6),
            toY - arrowSize * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
    }

    private drawNodes(ctx: CanvasRenderingContext2D): void {
        if (!this.storyData) return;

        for (const node of this.storyData.nodes) {
            this.drawNode(ctx, node);
        }
    }

    private drawNode(ctx: CanvasRenderingContext2D, node: SceneNode): void {
        const pos = node.position || { x: 0, y: 0 };
        const width = 150;
        const height = 50;
        const isSelected = this.selectedNodes.has(node.id);

        // Node colors by type
        const colors: Record<string, { bg: string; border: string }> = {
            'story': { bg: '#16213e', border: '#0f3460' },
            'dialogue': { bg: '#1a508b', border: '#1a508b' },
            'choice': { bg: '#e94560', border: '#e94560' },
            'scene': { bg: '#0f9b8e', border: '#0f9b8e' },
            'ending': { bg: '#9b59b6', border: '#9b59b6' }
        };

        const color = colors[node.type] || colors['story'];

        // Draw node background
        ctx.fillStyle = color.bg;
        ctx.strokeStyle = isSelected ? '#fff' : color.border;
        ctx.lineWidth = isSelected ? 3 : 2;

        ctx.beginPath();
        ctx.roundRect(pos.x, pos.y, width, height, 8);
        ctx.fill();
        ctx.stroke();

        // Draw title
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(node.title || 'Untitled', pos.x + 10, pos.y + 20, width - 20);

        // Draw type
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '10px sans-serif';
        ctx.fillText(node.type.toUpperCase(), pos.x + 10, pos.y + 35);

        // Draw connection points
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y + height / 2, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(pos.x + width, pos.y + height / 2, 5, 0, Math.PI * 2);
        ctx.fill();
    }

    // ========================================================================
    // Graph Interaction
    // ========================================================================

    private handleGraphMouseDown(e: MouseEvent): void {
        const rect = this.graphCanvas!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check if clicked on a node
        const clickedNode = this.getNodeAtPosition(x, y);

        if (clickedNode) {
            if (e.ctrlKey || e.metaKey) {
                // Toggle selection
                if (this.selectedNodes.has(clickedNode.id)) {
                    this.selectedNodes.delete(clickedNode.id);
                } else {
                    this.selectedNodes.add(clickedNode.id);
                }
            } else {
                // Select single node
                this.selectedNodes.clear();
                this.selectedNodes.add(clickedNode.id);
            }

            this.state.currentNodeId = clickedNode.id;
            this.updatePropertiesPanel(clickedNode);
        } else {
            // Start panning
            this.isDragging = true;
            this.dragStartPos = { x, y };
        }

        this.renderGraph();
    }

    private handleGraphMouseMove(e: MouseEvent): void {
        if (!this.isDragging) return;

        const rect = this.graphCanvas!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const dx = x - this.dragStartPos.x;
        const dy = y - this.dragStartPos.y;

        this.state.panOffset.x += dx;
        this.state.panOffset.y += dy;

        this.dragStartPos = { x, y };
        this.renderGraph();
    }

    private handleGraphMouseUp(_e: MouseEvent): void {
        this.isDragging = false;
    }

    private handleGraphWheel(e: WheelEvent): void {
        e.preventDefault();

        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        this.state.zoomLevel = Math.max(0.25, Math.min(2, this.state.zoomLevel + delta));

        this.renderGraph();
    }

    private handleGraphDoubleClick(e: MouseEvent): void {
        const rect = this.graphCanvas!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const clickedNode = this.getNodeAtPosition(x, y);

        if (clickedNode) {
            // Open node editor
            this.openNodeEditor(clickedNode);
        } else {
            // Create new node at position
            const worldX = (x - this.state.panOffset.x) / this.state.zoomLevel;
            const worldY = (y - this.state.panOffset.y) / this.state.zoomLevel;
            this.addNodeAtPosition('story', worldX, worldY);
        }
    }

    private getNodeAtPosition(screenX: number, screenY: number): SceneNode | null {
        if (!this.storyData) return null;

        // Convert screen to world coordinates
        const worldX = (screenX - this.state.panOffset.x) / this.state.zoomLevel;
        const worldY = (screenY - this.state.panOffset.y) / this.state.zoomLevel;

        for (const node of this.storyData.nodes) {
            const pos = node.position || { x: 0, y: 0 };
            if (
                worldX >= pos.x &&
                worldX <= pos.x + 150 &&
                worldY >= pos.y &&
                worldY <= pos.y + 50
            ) {
                return node;
            }
        }

        return null;
    }

    private fitGraphToView(): void {
        if (!this.storyData || this.storyData.nodes.length === 0) return;

        // Find bounding box
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        for (const node of this.storyData.nodes) {
            const pos = node.position || { x: 0, y: 0 };
            minX = Math.min(minX, pos.x);
            minY = Math.min(minY, pos.y);
            maxX = Math.max(maxX, pos.x + 150);
            maxY = Math.max(maxY, pos.y + 50);
        }

        const padding = 50;
        const width = maxX - minX + padding * 2;
        const height = maxY - minY + padding * 2;

        const canvasWidth = this.graphCanvas?.width || 800;
        const canvasHeight = this.graphCanvas?.height || 600;

        this.state.zoomLevel = Math.min(canvasWidth / width, canvasHeight / height, 1);
        this.state.panOffset = {
            x: (canvasWidth - width * this.state.zoomLevel) / 2 - minX * this.state.zoomLevel + padding,
            y: (canvasHeight - height * this.state.zoomLevel) / 2 - minY * this.state.zoomLevel + padding
        };
    }

    // ========================================================================
    // Story Operations
    // ========================================================================

    private createNewStory(): void {
        this.storyData = {
            id: `story_${Date.now()}`,
            name: 'New Story',
            description: '',
            startNodeId: '',
            nodes: [],
            connections: []
        };

        this.state.currentStoryId = this.storyData.id;
        this.state.isDirty = true;

        // Add initial start node
        this.addNode('story');

        this.renderGraph();
    }

    private loadStory(): void {
        // Would integrate with project assets
        console.log('[VNEditorPanel] Load story - integrate with project system');
    }

    private saveStory(): void {
        if (!this.storyData) return;

        // Would save to project
        console.log('[VNEditorPanel] Save story:', this.storyData);
        this.state.isDirty = false;
    }

    private exportStory(): void {
        if (!this.storyData) return;

        const json = JSON.stringify(this.storyData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.storyData.name || 'story'}.json`;
        a.click();

        URL.revokeObjectURL(url);
    }

    private addNode(type: string): void {
        this.addNodeAtPosition(type, 100 + Math.random() * 200, 100 + Math.random() * 200);
    }

    private addNodeAtPosition(type: string, x: number, y: number): void {
        if (!this.storyData) {
            this.createNewStory();
        }

        const node: SceneNode = {
            id: `node_${Date.now()}`,
            type: type as any,
            title: `New ${type}`,
            content: '',
            dialogues: type === 'dialogue' || type === 'story' ? [] : undefined,
            choices: type === 'choice' ? [] : undefined,
            position: { x, y }
        };

        this.storyData!.nodes.push(node);

        // Set as start node if first
        if (this.storyData!.nodes.length === 1) {
            this.storyData!.startNodeId = node.id;
        }

        this.state.isDirty = true;
        this.selectedNodes.clear();
        this.selectedNodes.add(node.id);
        this.state.currentNodeId = node.id;

        this.updatePropertiesPanel(node);
        this.renderGraph();
    }

    private openNodeEditor(node: SceneNode): void {
        this.state.currentNodeId = node.id;
        this.updatePropertiesPanel(node);
    }

    // ========================================================================
    // Properties Panel
    // ========================================================================

    private updatePropertiesPanel(node: SceneNode): void {
        if (!this.propertiesPanel) return;

        const idInput = this.propertiesPanel.querySelector('#vn-node-id') as HTMLInputElement;
        const titleInput = this.propertiesPanel.querySelector('#vn-node-title') as HTMLInputElement;
        const typeSelect = this.propertiesPanel.querySelector('#vn-node-type') as HTMLSelectElement;

        if (idInput) idInput.value = node.id;
        if (titleInput) titleInput.value = node.title || '';
        if (typeSelect) typeSelect.value = node.type;

        this.updatePropertySections(node.type);
        this.updateDialogueList(node);
        this.updateChoiceList(node);
    }

    private updatePropertySections(type: string): void {
        if (!this.propertiesPanel) return;

        const dialogueSection = this.propertiesPanel.querySelector('#vn-dialogue-section') as HTMLElement;
        const dialogueEditorSection = this.propertiesPanel.querySelector('#vn-dialogue-editor-section') as HTMLElement;
        const choicesSection = this.propertiesPanel.querySelector('#vn-choices-section') as HTMLElement;
        const sceneSection = this.propertiesPanel.querySelector('#vn-scene-section') as HTMLElement;

        // Hide all optional sections
        if (dialogueSection) dialogueSection.style.display = 'none';
        if (dialogueEditorSection) dialogueEditorSection.style.display = 'none';
        if (choicesSection) choicesSection.style.display = 'none';
        if (sceneSection) sceneSection.style.display = 'none';

        // Show relevant sections
        switch (type) {
            case 'story':
            case 'dialogue':
                if (dialogueSection) dialogueSection.style.display = 'block';
                if (dialogueEditorSection) dialogueEditorSection.style.display = 'block';
                break;
            case 'choice':
                if (choicesSection) choicesSection.style.display = 'block';
                break;
            case 'scene':
                if (sceneSection) sceneSection.style.display = 'block';
                break;
        }
    }

    private updateDialogueList(node: SceneNode): void {
        const dialogueList = this.propertiesPanel?.querySelector('#vn-dialogue-list');
        if (!dialogueList) return;

        const dialogues = node.dialogues || [];

        dialogueList.innerHTML = dialogues.map((d, i) => `
            <div class="vn-dialogue-item ${i === this.state.selectedDialogueIndex ? 'selected' : ''}"
                 data-index="${i}">
                <strong>${d.speakerId || 'Narrator'}</strong>: ${d.text?.substring(0, 40) || '(empty)'}...
            </div>
        `).join('');

        // Add click handlers
        dialogueList.querySelectorAll('.vn-dialogue-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.getAttribute('data-index') || '0');
                this.selectDialogue(index, node);
            });
        });
    }

    private updateChoiceList(node: SceneNode): void {
        const choiceList = this.propertiesPanel?.querySelector('#vn-choice-list');
        if (!choiceList) return;

        const choices = node.choices || [];

        choiceList.innerHTML = choices.map((c, i) => `
            <div class="vn-choice-item">
                <input type="text" value="${c.text || ''}" data-index="${i}" placeholder="Choice text..." />
                <button data-action="delete-choice" data-index="${i}">X</button>
            </div>
        `).join('');

        // Add event handlers
        choiceList.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', (e) => {
                const index = parseInt(input.getAttribute('data-index') || '0');
                const target = e.target as HTMLInputElement;
                this.updateChoiceText(index, target.value);
            });
        });
    }

    private selectDialogue(index: number, node: SceneNode): void {
        this.state.selectedDialogueIndex = index;
        const dialogue = node.dialogues?.[index];

        if (dialogue && this.propertiesPanel) {
            const speakerSelect = this.propertiesPanel.querySelector('#vn-dialogue-speaker') as HTMLSelectElement;
            const expressionSelect = this.propertiesPanel.querySelector('#vn-dialogue-expression') as HTMLSelectElement;
            const textArea = this.propertiesPanel.querySelector('#vn-dialogue-text') as HTMLTextAreaElement;

            if (speakerSelect) speakerSelect.value = dialogue.speakerId || '';
            if (expressionSelect) expressionSelect.value = dialogue.expression || 'default';
            if (textArea) textArea.value = dialogue.text || '';
        }

        this.updateDialogueList(node);
    }

    // ========================================================================
    // Node/Dialogue Updates
    // ========================================================================

    private updateNodeProperty(property: string, value: any): void {
        if (!this.storyData || !this.state.currentNodeId) return;

        const node = this.storyData.nodes.find(n => n.id === this.state.currentNodeId);
        if (node) {
            (node as any)[property] = value;
            this.state.isDirty = true;
            this.renderGraph();
        }
    }

    private updateDialogueProperty(property: string, value: any): void {
        if (!this.storyData || !this.state.currentNodeId) return;

        const node = this.storyData.nodes.find(n => n.id === this.state.currentNodeId);
        if (node?.dialogues && node.dialogues[this.state.selectedDialogueIndex]) {
            (node.dialogues[this.state.selectedDialogueIndex] as any)[property] = value;
            this.state.isDirty = true;
            this.updateDialogueList(node);
        }
    }

    private addDialogueLine(): void {
        if (!this.storyData || !this.state.currentNodeId) return;

        const node = this.storyData.nodes.find(n => n.id === this.state.currentNodeId);
        if (node) {
            if (!node.dialogues) node.dialogues = [];
            node.dialogues.push({
                id: `dialogue_${Date.now()}`,
                text: '',
                speakerId: null
            });
            this.state.selectedDialogueIndex = node.dialogues.length - 1;
            this.state.isDirty = true;
            this.updateDialogueList(node);
            this.selectDialogue(this.state.selectedDialogueIndex, node);
        }
    }

    private addChoiceOption(): void {
        if (!this.storyData || !this.state.currentNodeId) return;

        const node = this.storyData.nodes.find(n => n.id === this.state.currentNodeId);
        if (node) {
            if (!node.choices) node.choices = [];
            node.choices.push({
                id: `choice_${Date.now()}`,
                text: '',
                targetNodeId: ''
            });
            this.state.isDirty = true;
            this.updateChoiceList(node);
        }
    }

    private updateChoiceText(index: number, text: string): void {
        if (!this.storyData || !this.state.currentNodeId) return;

        const node = this.storyData.nodes.find(n => n.id === this.state.currentNodeId);
        if (node?.choices?.[index]) {
            node.choices[index].text = text;
            this.state.isDirty = true;
        }
    }

    private addCharacterToScene(): void {
        // Would open character picker
        console.log('[VNEditorPanel] Add character to scene');
    }

    // ========================================================================
    // AIGC Integration
    // ========================================================================

    private generateBackgroundWithAI(): void {
        // Would open AIGC modal for background generation
        console.log('[VNEditorPanel] Generate background with AI');

        // Import and show asset generation modal
        import('../panels/asset-generation-modal').then(({ showAssetGenerationModal }) => {
            showAssetGenerationModal();
        }).catch(err => {
            console.error('[VNEditorPanel] Failed to load AIGC modal:', err);
        });
    }

    private generateBGMWithAI(): void {
        // Would open AIGC modal for music generation
        console.log('[VNEditorPanel] Generate BGM with AI');

        import('../panels/asset-generation-modal').then(({ showAssetGenerationModal }) => {
            showAssetGenerationModal();
        }).catch(err => {
            console.error('[VNEditorPanel] Failed to load AIGC modal:', err);
        });
    }

    private openAIGCPanel(): void {
        import('../panels/asset-generation-modal').then(({ showAssetGenerationModal }) => {
            showAssetGenerationModal();
        }).catch(err => {
            console.error('[VNEditorPanel] Failed to load AIGC modal:', err);
        });
    }

    // ========================================================================
    // Preview
    // ========================================================================

    private togglePreview(): void {
        this.state.isPreviewMode = !this.state.isPreviewMode;

        if (this.state.isPreviewMode) {
            this.startPreview();
        } else {
            this.stopPreview();
        }
    }

    private startPreview(): void {
        console.log('[VNEditorPanel] Starting preview...');
        // Would launch VN runtime in editor viewport
    }

    private stopPreview(): void {
        console.log('[VNEditorPanel] Stopping preview');
    }

    // ========================================================================
    // Public API
    // ========================================================================

    /**
     * Get the panel container element
     */
    getContainer(): HTMLElement | null {
        return this.container;
    }

    /**
     * Set story data
     */
    setStoryData(data: StoryGraphData): void {
        this.storyData = data;
        this.state.currentStoryId = data.id;
        this.fitGraphToView();
        this.renderGraph();
    }

    /**
     * Get current story data
     */
    getStoryData(): StoryGraphData | null {
        return this.storyData;
    }

    /**
     * Set characters
     */
    setCharacters(characters: StoryCharacterData[]): void {
        this.characters.clear();
        for (const char of characters) {
            this.characters.set(char.id, char);
        }

        // Update speaker dropdown
        this.updateSpeakerDropdown();
    }

    /**
     * Set locations
     */
    setLocations(locations: StoryLocationData[]): void {
        this.locations.clear();
        for (const loc of locations) {
            this.locations.set(loc.id, loc);
        }

        // Update location dropdown
        this.updateLocationDropdown();
    }

    private updateSpeakerDropdown(): void {
        const select = this.propertiesPanel?.querySelector('#vn-dialogue-speaker') as HTMLSelectElement;
        if (!select) return;

        select.innerHTML = '<option value="">Narrator</option>';
        for (const char of this.characters.values()) {
            select.innerHTML += `<option value="${char.id}">${char.name}</option>`;
        }
    }

    private updateLocationDropdown(): void {
        const select = this.propertiesPanel?.querySelector('#vn-scene-location') as HTMLSelectElement;
        if (!select) return;

        select.innerHTML = '';
        for (const loc of this.locations.values()) {
            select.innerHTML += `<option value="${loc.id}">${loc.name}</option>`;
        }
    }

    /**
     * Check if there are unsaved changes
     */
    isDirty(): boolean {
        return this.state.isDirty;
    }

    /**
     * Force re-render
     */
    refresh(): void {
        this.renderGraph();
    }
}

// Auto-register if in editor context
if (typeof editor !== 'undefined') {
    VNEditorPanel.register();
}

// Export singleton
const vnEditorPanel = new VNEditorPanel();

export { vnEditorPanel, VNEditorPanel };

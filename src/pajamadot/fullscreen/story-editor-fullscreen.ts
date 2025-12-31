/**
 * Full-Screen Story Editor
 * Overlay for comprehensive story graph editing
 */

import { Button, Container, Label, Panel, Spinner } from '@playcanvas/pcui';

import { StoryGraphView } from '../graph/story-graph-view';
import {
    loadYamlData,
    getCachedData,
    getCachedDataPath,
    setCachedDataPath,
    saveYamlData
} from '../yaml-data-manager';
import type { SceneNode, StoryGraphData } from '../types';

declare const editor: any;

interface StoryEditorFullscreenOptions {
    assetId: number;
}

class StoryEditorFullscreen extends Container {
    private assetId: number;
    private graphView: StoryGraphView | null = null;
    private nodeInspector: Container | null = null;
    private selectedNodeId: string | null = null;
    private loadingSpinner: Spinner | null = null;

    constructor(options: StoryEditorFullscreenOptions) {
        super({
            class: 'pajamadot-fullscreen-editor',
            flex: true
        });

        this.assetId = options.assetId;
        this.buildUI();
        this.bindEvents();
        this.loadData();
    }

    private buildUI() {
        // Header bar
        const header = new Container({
            class: 'fullscreen-header',
            flex: true,
            flexDirection: 'row'
        });
        this.append(header);

        // Title
        const asset = editor.call('assets:get', this.assetId);
        const title = new Label({
            text: asset ? `Story: ${asset.get('name')}` : 'Story Editor',
            class: 'fullscreen-title'
        });
        header.append(title);

        // Spacer
        const spacer = new Container({ flex: true });
        header.append(spacer);

        // Toolbar buttons
        const btnAddScene = new Button({
            text: '+ Scene',
            class: 'toolbar-btn'
        });
        btnAddScene.on('click', () => this.addScene());
        header.append(btnAddScene);

        const btnSave = new Button({
            text: 'Save',
            class: 'toolbar-btn'
        });
        btnSave.on('click', () => this.save());
        header.append(btnSave);

        const btnClose = new Button({
            text: 'Close',
            class: 'toolbar-btn-close'
        });
        btnClose.class.add('toolbar-btn');
        btnClose.on('click', () => this.close());
        header.append(btnClose);

        // Main content area
        const content = new Container({
            class: 'fullscreen-content',
            flex: true,
            flexDirection: 'row'
        });
        this.append(content);

        // Graph view area
        const graphContainer = new Container({
            class: 'fullscreen-graph',
            flex: true
        });
        content.append(graphContainer);

        // Loading spinner
        this.loadingSpinner = new Spinner({
            size: 32
        });
        graphContainer.append(this.loadingSpinner);

        // Create graph view (will be linked after data loads)
        this.graphView = new StoryGraphView(graphContainer, {});

        // Right panel - Node inspector
        this.nodeInspector = new Container({
            class: 'fullscreen-inspector',
            scrollable: true
        });
        content.append(this.nodeInspector);

        this.renderEmptyInspector();
    }

    private async loadData() {
        // Load YAML data
        const data = await loadYamlData<StoryGraphData>(this.assetId);

        // Hide spinner
        if (this.loadingSpinner) {
            this.loadingSpinner.hidden = true;
        }

        if (!data) {
            console.error('[PajamaDot] Failed to load story data');
            return;
        }

        // Link graph view to asset
        if (this.graphView) {
            const asset = editor.call('assets:get', this.assetId);
            if (asset) {
                await this.graphView.link([asset]);
            }
        }
    }

    private bindEvents() {
        // Listen for node selection from graph view
        editor.on('pajamadot:node:select', (data: { assetId: number; nodeId: string }) => {
            if (data.assetId === this.assetId) {
                this.selectedNodeId = data.nodeId;
                this.renderNodeInspector(data.nodeId);
            }
        });

        editor.on('pajamadot:item:deselect', (data: { assetId: number }) => {
            if (data.assetId === this.assetId) {
                this.selectedNodeId = null;
                this.renderEmptyInspector();
            }
        });

        // Keyboard shortcuts
        this.dom.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                this.close();
            }
            if (e.key === 'Delete' && this.selectedNodeId) {
                this.deleteSelectedNode();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.save();
            }
        });
    }

    private renderEmptyInspector() {
        if (!this.nodeInspector) return;
        this.nodeInspector.clear();

        const placeholder = new Label({
            text: 'Select a node to edit its properties',
            class: 'inspector-placeholder'
        });
        this.nodeInspector.append(placeholder);
    }

    private renderNodeInspector(nodeId: string) {
        if (!this.nodeInspector) return;
        this.nodeInspector.clear();

        const node = getCachedDataPath<any>(this.assetId, `nodes.${nodeId}`);
        if (!node) return;

        // Node type header
        const typeLabel = new Label({
            text: `${node.nodeType.toUpperCase()} NODE`,
            class: 'inspector-section-header'
        });
        this.nodeInspector.append(typeLabel);

        // Node name
        const namePanel = new Panel({
            headerText: 'Name',
            collapsible: false
        });
        this.nodeInspector.append(namePanel);

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'pcui-string pcui-text-input';
        nameInput.value = node.name || '';
        nameInput.addEventListener('change', () => {
            setCachedDataPath(this.assetId, `nodes.${nodeId}.name`, nameInput.value);
            this.scheduleSave();
        });
        namePanel.content.dom.appendChild(nameInput);

        // Scene-specific properties
        if (node.nodeType === 'scene') {
            this.renderSceneInspector(node, nodeId);
        }

        // End node properties
        if (node.nodeType === 'end') {
            this.renderEndNodeInspector(node, nodeId);
        }

        // Delete button
        if (node.nodeType !== 'start') {
            const deleteBtn = new Button({
                text: 'Delete Node',
                class: 'btn-danger'
            });
            deleteBtn.on('click', () => this.deleteSelectedNode());
            this.nodeInspector.append(deleteBtn);
        }
    }

    private renderSceneInspector(node: SceneNode, nodeId: string) {
        if (!this.nodeInspector) return;

        // Location
        const locationPanel = new Panel({
            headerText: 'Location',
            collapsible: true
        });
        this.nodeInspector.append(locationPanel);

        const locationSelect = document.createElement('select');
        locationSelect.className = 'pcui-select';

        // Add empty option
        const emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = '-- None --';
        locationSelect.appendChild(emptyOpt);

        // Populate locations
        const locations = editor.call('pajamadot:location:list') || [];
        for (const loc of locations) {
            const opt = document.createElement('option');
            opt.value = loc.id;
            opt.textContent = loc.name;
            if (node.locationId === loc.id) opt.selected = true;
            locationSelect.appendChild(opt);
        }

        locationSelect.addEventListener('change', () => {
            setCachedDataPath(this.assetId, `nodes.${nodeId}.locationId`, locationSelect.value || null);
            this.scheduleSave();
        });
        locationPanel.content.dom.appendChild(locationSelect);

        // Characters
        const charsPanel = new Panel({
            headerText: 'Characters',
            collapsible: true
        });
        this.nodeInspector.append(charsPanel);

        const charsList = new Container({ class: 'chars-list' });
        charsPanel.content.append(charsList);

        for (const char of node.characters || []) {
            const charItem = new Container({ class: 'char-item', flex: true, flexDirection: 'row' });
            const charLabel = new Label({ text: char.characterId });
            charItem.append(charLabel);

            const removeBtn = new Button({ text: 'X', class: 'btn-small' });
            removeBtn.on('click', () => {
                const chars = (node.characters || []).filter((c: any) => c.characterId !== char.characterId);
                setCachedDataPath(this.assetId, `nodes.${nodeId}.characters`, chars);
                this.scheduleSave();
                this.renderNodeInspector(nodeId);
            });
            charItem.append(removeBtn);
            charsList.append(charItem);
        }

        const addCharBtn = new Button({ text: '+ Add Character' });
        addCharBtn.on('click', () => {
            const characters = editor.call('pajamadot:character:list') || [];
            if (characters.length === 0) {
                alert('No characters available. Create a character first.');
                return;
            }
            const charId = prompt('Enter character ID:', characters[0]?.id || '');
            if (charId) {
                const chars = [...(node.characters || []), { characterId: charId, position: 'center' }];
                setCachedDataPath(this.assetId, `nodes.${nodeId}.characters`, chars);
                this.scheduleSave();
                this.renderNodeInspector(nodeId);
            }
        });
        charsPanel.content.append(addCharBtn);

        // Dialogues
        const dialoguesPanel = new Panel({
            headerText: 'Dialogues',
            collapsible: true
        });
        this.nodeInspector.append(dialoguesPanel);

        const dialoguesList = new Container({ class: 'dialogues-list' });
        dialoguesPanel.content.append(dialoguesList);

        for (let i = 0; i < (node.dialogues || []).length; i++) {
            const dialogue = node.dialogues[i];
            const dialogueItem = new Container({ class: 'dialogue-item' });

            const speakerLabel = new Label({
                text: dialogue.speakerId || '[Narrator]',
                class: 'dialogue-speaker'
            });
            dialogueItem.append(speakerLabel);

            const textArea = document.createElement('textarea');
            textArea.className = 'pcui-text-area dialogue-text';
            textArea.value = dialogue.text || '';
            textArea.rows = 3;
            textArea.addEventListener('change', () => {
                const dialogues = [...(node.dialogues || [])];
                dialogues[i] = { ...dialogues[i], text: textArea.value };
                setCachedDataPath(this.assetId, `nodes.${nodeId}.dialogues`, dialogues);
                this.scheduleSave();
            });
            dialogueItem.dom.appendChild(textArea);

            const removeDialogueBtn = new Button({ text: 'Remove', class: 'btn-small' });
            removeDialogueBtn.on('click', () => {
                const dialogues = (node.dialogues || []).filter((_: any, idx: number) => idx !== i);
                setCachedDataPath(this.assetId, `nodes.${nodeId}.dialogues`, dialogues);
                this.scheduleSave();
                this.renderNodeInspector(nodeId);
            });
            dialogueItem.append(removeDialogueBtn);

            dialoguesList.append(dialogueItem);
        }

        const addDialogueBtn = new Button({ text: '+ Add Dialogue' });
        addDialogueBtn.on('click', () => {
            const dialogues = [...(node.dialogues || []), {
                id: `d-${Date.now()}`,
                text: 'New dialogue line...'
            }];
            setCachedDataPath(this.assetId, `nodes.${nodeId}.dialogues`, dialogues);
            this.scheduleSave();
            this.renderNodeInspector(nodeId);
        });
        dialoguesPanel.content.append(addDialogueBtn);

        // Choices
        const choicesPanel = new Panel({
            headerText: 'Choices',
            collapsible: true
        });
        this.nodeInspector.append(choicesPanel);

        const choicesList = new Container({ class: 'choices-list' });
        choicesPanel.content.append(choicesList);

        for (let i = 0; i < (node.choices || []).length; i++) {
            const choice = node.choices[i];
            const choiceItem = new Container({ class: 'choice-item' });

            const textInput = document.createElement('input');
            textInput.type = 'text';
            textInput.className = 'pcui-string pcui-text-input choice-text';
            textInput.value = choice.text || '';
            textInput.addEventListener('change', () => {
                const choices = [...(node.choices || [])];
                choices[i] = { ...choices[i], text: textInput.value };
                setCachedDataPath(this.assetId, `nodes.${nodeId}.choices`, choices);
                this.scheduleSave();
            });
            choiceItem.dom.appendChild(textInput);

            if (choice.condition) {
                const condLabel = new Label({
                    text: `Condition: ${choice.condition}`,
                    class: 'choice-condition'
                });
                choiceItem.append(condLabel);
            }

            const removeChoiceBtn = new Button({ text: 'Remove', class: 'btn-small' });
            removeChoiceBtn.on('click', () => {
                const choices = (node.choices || []).filter((_: any, idx: number) => idx !== i);
                setCachedDataPath(this.assetId, `nodes.${nodeId}.choices`, choices);
                this.scheduleSave();
                this.renderNodeInspector(nodeId);
            });
            choiceItem.append(removeChoiceBtn);

            choicesList.append(choiceItem);
        }

        const addChoiceBtn = new Button({ text: '+ Add Choice' });
        addChoiceBtn.on('click', () => {
            const choices = [...(node.choices || []), {
                id: `c-${Date.now()}`,
                text: 'New choice...'
            }];
            setCachedDataPath(this.assetId, `nodes.${nodeId}.choices`, choices);
            this.scheduleSave();
            this.renderNodeInspector(nodeId);
        });
        choicesPanel.content.append(addChoiceBtn);
    }

    private renderEndNodeInspector(node: any, nodeId: string) {
        if (!this.nodeInspector) return;

        const endingPanel = new Panel({
            headerText: 'Ending Type',
            collapsible: false
        });
        this.nodeInspector.append(endingPanel);

        const endingSelect = document.createElement('select');
        endingSelect.className = 'pcui-select';

        const types = ['good', 'bad', 'neutral', 'secret'];
        for (const type of types) {
            const opt = document.createElement('option');
            opt.value = type;
            opt.textContent = type.charAt(0).toUpperCase() + type.slice(1);
            if (node.endingType === type) opt.selected = true;
            endingSelect.appendChild(opt);
        }

        endingSelect.addEventListener('change', () => {
            setCachedDataPath(this.assetId, `nodes.${nodeId}.endingType`, endingSelect.value);
            this.scheduleSave();
        });
        endingPanel.content.dom.appendChild(endingSelect);
    }

    private saveDebounceTimer: any = null;

    private scheduleSave() {
        if (this.saveDebounceTimer) {
            clearTimeout(this.saveDebounceTimer);
        }

        this.saveDebounceTimer = setTimeout(() => {
            this.save();
            this.saveDebounceTimer = null;
        }, 1000);
    }

    private async save() {
        const success = await saveYamlData(this.assetId);
        if (success) {
            console.log('[PajamaDot] Story saved');
        } else {
            console.error('[PajamaDot] Failed to save story');
        }
    }

    private addScene() {
        const data = getCachedData<StoryGraphData>(this.assetId);
        if (!data) return;

        const id = `scene-${Date.now()}`;
        const newScene: SceneNode = {
            id,
            nodeType: 'scene',
            name: 'New Scene',
            posX: 200,
            posY: 200,
            characters: [],
            dialogues: [],
            choices: []
        };

        data.nodes[id] = newScene;
        this.scheduleSave();

        if (this.graphView) {
            this.graphView.refresh();
        }
    }

    private deleteSelectedNode() {
        if (!this.selectedNodeId) return;

        const node = getCachedDataPath<any>(this.assetId, `nodes.${this.selectedNodeId}`);
        if (node?.nodeType === 'start') {
            alert('Cannot delete the start node');
            return;
        }

        const confirmed = confirm('Delete this node and all connected edges?');
        if (!confirmed) return;

        const data = getCachedData<StoryGraphData>(this.assetId);
        if (data) {
            // Remove node
            delete data.nodes[this.selectedNodeId];

            // Remove connected edges
            for (const [edgeId, edge] of Object.entries(data.edges)) {
                if (edge.from === this.selectedNodeId || edge.to === this.selectedNodeId) {
                    delete data.edges[edgeId];
                }
            }

            this.scheduleSave();
            this.selectedNodeId = null;
            this.renderEmptyInspector();

            if (this.graphView) {
                this.graphView.refresh();
            }
        }
    }

    close() {
        // Clear debounce timer and save immediately if dirty
        if (this.saveDebounceTimer) {
            clearTimeout(this.saveDebounceTimer);
            this.saveDebounceTimer = null;
            this.save();
        }

        if (this.graphView) {
            this.graphView.destroy();
            this.graphView = null;
        }

        this.emit('close');
        this.destroy();
    }
}

// Register fullscreen editor methods
editor.once('load', () => {
    let currentEditor: StoryEditorFullscreen | null = null;

    editor.method('pajamadot:fullscreen:open', (assetId: number) => {
        // Close existing editor if any
        if (currentEditor) {
            currentEditor.destroy();
        }

        currentEditor = new StoryEditorFullscreen({ assetId });
        document.body.appendChild(currentEditor.dom);

        currentEditor.on('close', () => {
            currentEditor = null;
        });

        return currentEditor;
    });

    editor.method('pajamadot:fullscreen:close', () => {
        if (currentEditor) {
            currentEditor.close();
            currentEditor = null;
        }
    });

    editor.method('pajamadot:fullscreen:isOpen', () => {
        return currentEditor !== null;
    });

    console.log('[PajamaDot] Fullscreen editor registered');
});

export { StoryEditorFullscreen };

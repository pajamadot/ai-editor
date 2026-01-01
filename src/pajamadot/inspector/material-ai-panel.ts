/**
 * Material AI Inspector Panel
 * Adds AI texture generation capabilities to the material asset inspector
 */

import { Button, Container, Label, Panel, SelectInput, TextInput, BooleanInput } from '@playcanvas/pcui';

declare const editor: any;

/**
 * Material AI Panel Component
 */
export class MaterialAIPanel extends Container {
    private _asset: any = null;
    private _promptInput: TextInput;
    private _styleSelect: SelectInput;
    private _diffuseCheck: BooleanInput;
    private _normalCheck: BooleanInput;
    private _roughnessCheck: BooleanInput;
    private _aoCheck: BooleanInput;
    private _statusLabel: Label;
    private _generateBtn: Button;
    private _generateAllBtn: Button;

    constructor() {
        super({
            class: 'material-ai-panel'
        });

        this._buildUI();
    }

    private _buildUI(): void {
        // Panel header
        const panel = new Panel({
            headerText: 'AI TEXTURE GENERATION',
            collapsible: true,
            collapsed: false,
            class: 'material-ai-panel-container'
        });

        // Description
        const descLabel = new Label({
            text: 'Generate textures for material slots with AI',
            class: 'material-ai-description'
        });
        panel.append(descLabel);

        // Prompt input
        const promptContainer = new Container({ class: 'material-ai-row' });
        const promptLabel = new Label({ text: 'Prompt:' });
        this._promptInput = new TextInput({
            placeholder: 'Describe the material appearance...',
            class: 'material-ai-prompt'
        });
        promptContainer.append(promptLabel);
        promptContainer.append(this._promptInput);
        panel.append(promptContainer);

        // Style selector
        const styleContainer = new Container({ class: 'material-ai-row' });
        const styleLabel = new Label({ text: 'Style:' });
        this._styleSelect = new SelectInput({
            options: [
                { v: 'photorealistic', t: 'Photorealistic' },
                { v: 'stylized', t: 'Stylized' },
                { v: 'hand-painted', t: 'Hand Painted' },
                { v: 'pixel-art', t: 'Pixel Art' },
                { v: 'pbr', t: 'PBR Realistic' }
            ],
            value: 'pbr'
        });
        styleContainer.append(styleLabel);
        styleContainer.append(this._styleSelect);
        panel.append(styleContainer);

        // Texture slots checkboxes
        const slotsLabel = new Label({
            text: 'Generate textures for:',
            class: 'material-ai-slots-label'
        });
        panel.append(slotsLabel);

        const slotsContainer = new Container({ class: 'material-ai-slots' });

        // Diffuse
        const diffuseContainer = new Container({ class: 'material-ai-slot-check' });
        this._diffuseCheck = new BooleanInput({ value: true });
        const diffuseLabel = new Label({ text: 'Diffuse (8cr)' });
        diffuseContainer.append(this._diffuseCheck);
        diffuseContainer.append(diffuseLabel);
        slotsContainer.append(diffuseContainer);

        // Normal
        const normalContainer = new Container({ class: 'material-ai-slot-check' });
        this._normalCheck = new BooleanInput({ value: true });
        const normalLabel = new Label({ text: 'Normal (8cr)' });
        normalContainer.append(this._normalCheck);
        normalContainer.append(normalLabel);
        slotsContainer.append(normalContainer);

        // Roughness
        const roughnessContainer = new Container({ class: 'material-ai-slot-check' });
        this._roughnessCheck = new BooleanInput({ value: true });
        const roughnessLabel = new Label({ text: 'Roughness (8cr)' });
        roughnessContainer.append(this._roughnessCheck);
        roughnessContainer.append(roughnessLabel);
        slotsContainer.append(roughnessContainer);

        // AO
        const aoContainer = new Container({ class: 'material-ai-slot-check' });
        this._aoCheck = new BooleanInput({ value: false });
        const aoLabel = new Label({ text: 'AO (8cr)' });
        aoContainer.append(this._aoCheck);
        aoContainer.append(aoLabel);
        slotsContainer.append(aoContainer);

        panel.append(slotsContainer);

        // Cost estimate
        const costContainer = new Container({ class: 'material-ai-cost' });
        const costLabel = new Label({ text: 'Estimated cost: 24 credits', class: 'material-ai-cost-label' });
        costContainer.append(costLabel);
        panel.append(costContainer);

        // Update cost when checkboxes change
        const updateCost = () => {
            let cost = 0;
            if (this._diffuseCheck.value) cost += 8;
            if (this._normalCheck.value) cost += 8;
            if (this._roughnessCheck.value) cost += 8;
            if (this._aoCheck.value) cost += 8;
            costLabel.text = `Estimated cost: ${cost} credits`;
        };

        this._diffuseCheck.on('change', updateCost);
        this._normalCheck.on('change', updateCost);
        this._roughnessCheck.on('change', updateCost);
        this._aoCheck.on('change', updateCost);

        // Action buttons
        const actionsContainer = new Container({ class: 'material-ai-actions' });

        this._generateBtn = new Button({
            text: 'Generate Selected',
            icon: 'E195',
            class: 'material-ai-btn'
        });
        this._generateBtn.on('click', () => this._onGenerateSelected());
        actionsContainer.append(this._generateBtn);

        this._generateAllBtn = new Button({
            text: 'Generate All (32cr)',
            icon: 'E207',
            class: 'material-ai-btn'
        });
        this._generateAllBtn.class.add('primary');
        this._generateAllBtn.on('click', () => this._onGenerateAll());
        actionsContainer.append(this._generateAllBtn);

        panel.append(actionsContainer);

        // Status label
        this._statusLabel = new Label({
            text: '',
            class: 'material-ai-status'
        });
        panel.append(this._statusLabel);

        this.append(panel);
        this._addStyles();
    }

    private _addStyles(): void {
        const styleId = 'pajamadot-material-ai-panel-styles';
        if (document.getElementById(styleId)) return;

        const styles = document.createElement('style');
        styles.id = styleId;
        styles.textContent = `
            .material-ai-panel-container {
                margin-top: 10px;
                border-top: 1px solid #3a3a3a;
            }

            .material-ai-panel-container .pcui-panel-header {
                background: linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(99, 102, 241, 0.1));
            }

            .material-ai-description {
                color: #888;
                font-size: 11px;
                margin-bottom: 8px;
            }

            .material-ai-row {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 8px;
            }

            .material-ai-row > .pcui-label {
                min-width: 50px;
                color: #aaa;
            }

            .material-ai-prompt {
                flex: 1;
            }

            .material-ai-slots-label {
                color: #aaa;
                font-size: 11px;
                margin-bottom: 6px;
            }

            .material-ai-slots {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 6px;
                margin-bottom: 8px;
            }

            .material-ai-slot-check {
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .material-ai-slot-check .pcui-label {
                font-size: 11px;
                color: #ccc;
            }

            .material-ai-cost {
                margin-bottom: 8px;
            }

            .material-ai-cost-label {
                color: #a855f7;
                font-size: 11px;
                font-weight: 600;
            }

            .material-ai-actions {
                display: flex;
                gap: 6px;
                margin-bottom: 6px;
            }

            .material-ai-btn {
                flex: 1;
                font-size: 11px;
            }

            .material-ai-btn.primary {
                background: linear-gradient(135deg, #a855f7, #6366f1);
            }

            .material-ai-btn.primary:hover {
                background: linear-gradient(135deg, #9333ea, #4f46e5);
            }

            .material-ai-status {
                color: #888;
                font-size: 11px;
                text-align: center;
                min-height: 16px;
            }

            .material-ai-status.success { color: #22c55e; }
            .material-ai-status.error { color: #ef4444; }
            .material-ai-status.loading { color: #a855f7; }
        `;
        document.head.appendChild(styles);
    }

    /**
     * Link to asset
     */
    link(asset: any): void {
        this._asset = asset;

        // Pre-fill prompt from material name
        const materialName = asset.get('name') || 'material';
        this._promptInput.value = materialName.replace(/\.json$/i, '');
    }

    /**
     * Unlink from asset
     */
    unlink(): void {
        this._asset = null;
    }

    private _setStatus(text: string, type: 'success' | 'error' | 'loading' | '' = ''): void {
        this._statusLabel.text = text;
        this._statusLabel.class.remove('success', 'error', 'loading');
        if (type) {
            this._statusLabel.class.add(type);
        }
    }

    private _setButtonsEnabled(enabled: boolean): void {
        this._generateBtn.enabled = enabled;
        this._generateAllBtn.enabled = enabled;
    }

    private _getSelectedSlots(): string[] {
        const slots: string[] = [];
        if (this._diffuseCheck.value) slots.push('diffuse');
        if (this._normalCheck.value) slots.push('normal');
        if (this._roughnessCheck.value) slots.push('roughness');
        if (this._aoCheck.value) slots.push('ao');
        return slots;
    }

    private async _onGenerateSelected(): Promise<void> {
        if (!this._asset) return;

        const hasToken = editor.call('pajamadot:hasToken');
        if (!hasToken) {
            editor.call('picker:pajamadot:token');
            return;
        }

        const slots = this._getSelectedSlots();
        if (slots.length === 0) {
            this._setStatus('Please select at least one texture slot', 'error');
            return;
        }

        this._setStatus(`Generating ${slots.length} texture(s)...`, 'loading');
        this._setButtonsEnabled(false);

        try {
            const prompt = this._promptInput.value || this._asset.get('name');

            editor.call('pajamadot:generate:material-textures', {
                materialId: this._asset.get('id'),
                prompt: prompt,
                slots: slots
            });

            this._setStatus('Generation started...', 'loading');

            // Give some time for the generation to complete
            setTimeout(() => {
                this._setButtonsEnabled(true);
                this._setStatus('');
            }, 5000);
        } catch (error) {
            console.error('[MaterialAIPanel] Generate error:', error);
            this._setStatus(`Error: ${error}`, 'error');
            this._setButtonsEnabled(true);
        }
    }

    private async _onGenerateAll(): Promise<void> {
        if (!this._asset) return;

        const hasToken = editor.call('pajamadot:hasToken');
        if (!hasToken) {
            editor.call('picker:pajamadot:token');
            return;
        }

        this._setStatus('Generating full texture set...', 'loading');
        this._setButtonsEnabled(false);

        try {
            const prompt = this._promptInput.value || this._asset.get('name');

            editor.call('pajamadot:generate:material-textures', {
                materialId: this._asset.get('id'),
                prompt: prompt,
                slots: ['diffuse', 'normal', 'roughness', 'ao']
            });

            this._setStatus('Generation started...', 'loading');

            setTimeout(() => {
                this._setButtonsEnabled(true);
                this._setStatus('');
            }, 8000);
        } catch (error) {
            console.error('[MaterialAIPanel] Generate all error:', error);
            this._setStatus(`Error: ${error}`, 'error');
            this._setButtonsEnabled(true);
        }
    }
}

// Track active panel
let activeMaterialPanel: MaterialAIPanel | null = null;

/**
 * Initialize material AI panel integration
 */
function initMaterialAIPanel(): void {
    // Hook into material asset inspection
    editor.on('attributes:inspect[asset]', (assets: any[]) => {
        if (!assets || assets.length === 0) return;

        const asset = assets[0];
        const type = asset.get('type');

        // Only for material assets
        if (type !== 'material') return;

        // Check if we have a token
        const hasToken = editor.call('pajamadot:hasToken');
        if (!hasToken) return;

        // Get the inspector panel
        const inspectorPanel = editor.call('layout.attributes');
        if (!inspectorPanel) return;

        // Find the asset inspector container
        const assetInspector = inspectorPanel.dom.querySelector('.asset-inspector');
        if (!assetInspector) return;

        // Remove any existing material AI panel
        const existing = assetInspector.querySelector('.material-ai-panel');
        if (existing) {
            existing.remove();
        }

        // Clean up previous panel
        if (activeMaterialPanel) {
            activeMaterialPanel.unlink();
            activeMaterialPanel.destroy();
            activeMaterialPanel = null;
        }

        // Create and append new panel
        activeMaterialPanel = new MaterialAIPanel();
        activeMaterialPanel.link(asset);
        assetInspector.appendChild(activeMaterialPanel.dom);
    });

    // Clean up on clear
    editor.on('attributes:clear', () => {
        if (activeMaterialPanel) {
            activeMaterialPanel.unlink();
            activeMaterialPanel.destroy();
            activeMaterialPanel = null;
        }
    });

    console.log('[PajamaDot] Material AI panel integration initialized');
}

// Initialize on editor load
editor.once('load', () => {
    setTimeout(() => {
        initMaterialAIPanel();
    }, 750);
});

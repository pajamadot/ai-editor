/**
 * Model AI Inspector Panel
 * Adds AI texture generation capabilities to the model/container asset inspector
 */

import { Button, Container, Label, Panel, SelectInput, TextInput, BooleanInput } from '@playcanvas/pcui';

declare const editor: any;

/**
 * Model AI Panel Component
 */
export class ModelAIPanel extends Container {
    private _asset: any = null;
    private _promptInput: TextInput;
    private _styleSelect: SelectInput;
    private _uvAwareCheck: BooleanInput;
    private _statusLabel: Label;
    private _generateBtn: Button;
    private _retextureBtn: Button;
    private _extractBtn: Button;

    constructor() {
        super({
            class: 'model-ai-panel'
        });

        this._buildUI();
    }

    private _buildUI(): void {
        // Panel header
        const panel = new Panel({
            headerText: 'AI TEXTURE GENERATION',
            collapsible: true,
            collapsed: false,
            class: 'model-ai-panel-container'
        });

        // Description
        const descLabel = new Label({
            text: 'Generate textures for this 3D model with AI',
            class: 'model-ai-description'
        });
        panel.append(descLabel);

        // Prompt input
        const promptContainer = new Container({ class: 'model-ai-row' });
        const promptLabel = new Label({ text: 'Prompt:' });
        this._promptInput = new TextInput({
            placeholder: 'Describe the texture style...',
            class: 'model-ai-prompt'
        });
        promptContainer.append(promptLabel);
        promptContainer.append(this._promptInput);
        panel.append(promptContainer);

        // Style selector
        const styleContainer = new Container({ class: 'model-ai-row' });
        const styleLabel = new Label({ text: 'Style:' });
        this._styleSelect = new SelectInput({
            options: [
                { v: 'photorealistic', t: 'Photorealistic' },
                { v: 'stylized', t: 'Stylized' },
                { v: 'hand-painted', t: 'Hand Painted' },
                { v: 'pixel-art', t: 'Pixel Art' },
                { v: 'pbr', t: 'PBR Realistic' },
                { v: 'cartoon', t: 'Cartoon' },
                { v: 'low-poly', t: 'Low Poly' }
            ],
            value: 'pbr'
        });
        styleContainer.append(styleLabel);
        styleContainer.append(this._styleSelect);
        panel.append(styleContainer);

        // UV-aware texturing option
        const uvContainer = new Container({ class: 'model-ai-row' });
        this._uvAwareCheck = new BooleanInput({ value: true });
        const uvLabel = new Label({ text: 'UV-aware texturing (better seam handling)' });
        uvContainer.append(this._uvAwareCheck);
        uvContainer.append(uvLabel);
        panel.append(uvContainer);

        // Info label
        const infoLabel = new Label({
            text: 'Model texturing uses the model\'s UV layout to generate seamless textures that wrap correctly around the mesh.',
            class: 'model-ai-info'
        });
        panel.append(infoLabel);

        // Cost estimate
        const costContainer = new Container({ class: 'model-ai-cost' });
        const costLabel = new Label({ text: 'Estimated cost: 15-25 credits', class: 'model-ai-cost-label' });
        costContainer.append(costLabel);
        panel.append(costContainer);

        // Action buttons
        const actionsContainer = new Container({ class: 'model-ai-actions' });

        this._generateBtn = new Button({
            text: 'Generate Texture (15cr)',
            icon: 'E159',
            class: 'model-ai-btn'
        });
        this._generateBtn.class.add('primary');
        this._generateBtn.on('click', () => this._onGenerateTexture());
        actionsContainer.append(this._generateBtn);

        this._retextureBtn = new Button({
            text: 'Retexture (25cr)',
            icon: 'E195',
            class: 'model-ai-btn'
        });
        this._retextureBtn.on('click', () => this._onRetexture());
        actionsContainer.append(this._retextureBtn);

        panel.append(actionsContainer);

        // Secondary actions
        const actionsRow2 = new Container({ class: 'model-ai-actions' });

        this._extractBtn = new Button({
            text: 'Extract & Enhance Textures',
            icon: 'E149',
            class: 'model-ai-btn'
        });
        this._extractBtn.on('click', () => this._onExtractTextures());
        actionsRow2.append(this._extractBtn);

        panel.append(actionsRow2);

        // Status label
        this._statusLabel = new Label({
            text: '',
            class: 'model-ai-status'
        });
        panel.append(this._statusLabel);

        this.append(panel);
        this._addStyles();
    }

    private _addStyles(): void {
        const styleId = 'pajamadot-model-ai-panel-styles';
        if (document.getElementById(styleId)) return;

        const styles = document.createElement('style');
        styles.id = styleId;
        styles.textContent = `
            .model-ai-panel-container {
                margin-top: 10px;
                border-top: 1px solid #3a3a3a;
            }

            .model-ai-panel-container .pcui-panel-header {
                background: linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(99, 102, 241, 0.1));
            }

            .model-ai-description {
                color: #888;
                font-size: 11px;
                margin-bottom: 8px;
            }

            .model-ai-row {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 8px;
            }

            .model-ai-row > .pcui-label {
                min-width: 50px;
                color: #aaa;
            }

            .model-ai-row > .pcui-boolean-input + .pcui-label {
                min-width: unset;
                flex: 1;
                font-size: 11px;
            }

            .model-ai-prompt {
                flex: 1;
            }

            .model-ai-info {
                color: #666;
                font-size: 10px;
                font-style: italic;
                margin-bottom: 8px;
                line-height: 1.4;
            }

            .model-ai-cost {
                margin-bottom: 8px;
            }

            .model-ai-cost-label {
                color: #a855f7;
                font-size: 11px;
                font-weight: 600;
            }

            .model-ai-actions {
                display: flex;
                gap: 6px;
                margin-bottom: 6px;
            }

            .model-ai-btn {
                flex: 1;
                font-size: 11px;
            }

            .model-ai-btn.primary {
                background: linear-gradient(135deg, #a855f7, #6366f1);
            }

            .model-ai-btn.primary:hover {
                background: linear-gradient(135deg, #9333ea, #4f46e5);
            }

            .model-ai-status {
                color: #888;
                font-size: 11px;
                text-align: center;
                min-height: 16px;
            }

            .model-ai-status.success { color: #22c55e; }
            .model-ai-status.error { color: #ef4444; }
            .model-ai-status.loading { color: #a855f7; }
        `;
        document.head.appendChild(styles);
    }

    /**
     * Link to asset
     */
    link(asset: any): void {
        this._asset = asset;

        // Pre-fill prompt from model name
        const modelName = asset.get('name') || 'model';
        this._promptInput.value = modelName
            .replace(/\.(glb|gltf|fbx|obj)$/i, '')
            .replace(/_/g, ' ')
            .replace(/-/g, ' ');
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
        this._retextureBtn.enabled = enabled;
        this._extractBtn.enabled = enabled;
    }

    private async _onGenerateTexture(): Promise<void> {
        if (!this._asset) return;

        const hasToken = editor.call('pajamadot:hasToken');
        if (!hasToken) {
            editor.call('picker:pajamadot:token');
            return;
        }

        this._setStatus('Generating texture for model...', 'loading');
        this._setButtonsEnabled(false);

        try {
            const prompt = this._promptInput.value || this._asset.get('name');
            const style = this._styleSelect.value;
            const uvAware = this._uvAwareCheck.value;

            editor.call('pajamadot:generate:model-texture', {
                modelId: this._asset.get('id'),
                prompt: `${prompt}, ${style} style`,
                uvAware: uvAware
            });

            this._setStatus('Generation started...', 'loading');

            // Give some time for the generation to complete
            setTimeout(() => {
                this._setButtonsEnabled(true);
                this._setStatus('');
            }, 8000);
        } catch (error) {
            console.error('[ModelAIPanel] Generate texture error:', error);
            this._setStatus(`Error: ${error}`, 'error');
            this._setButtonsEnabled(true);
        }
    }

    private async _onRetexture(): Promise<void> {
        if (!this._asset) return;

        const hasToken = editor.call('pajamadot:hasToken');
        if (!hasToken) {
            editor.call('picker:pajamadot:token');
            return;
        }

        this._setStatus('Re-texturing model with AI...', 'loading');
        this._setButtonsEnabled(false);

        try {
            const prompt = this._promptInput.value || this._asset.get('name');
            const style = this._styleSelect.value;

            // Retexture generates a complete new texture set
            editor.call('pajamadot:generate:model-retexture', {
                modelId: this._asset.get('id'),
                prompt: `${prompt}, ${style} style, high quality, detailed`,
                generatePBR: true
            });

            this._setStatus('Retexture started...', 'loading');

            setTimeout(() => {
                this._setButtonsEnabled(true);
                this._setStatus('');
            }, 12000);
        } catch (error) {
            console.error('[ModelAIPanel] Retexture error:', error);
            this._setStatus(`Error: ${error}`, 'error');
            this._setButtonsEnabled(true);
        }
    }

    private async _onExtractTextures(): Promise<void> {
        if (!this._asset) return;

        const hasToken = editor.call('pajamadot:hasToken');
        if (!hasToken) {
            editor.call('picker:pajamadot:token');
            return;
        }

        this._setStatus('Extracting and enhancing textures...', 'loading');
        this._setButtonsEnabled(false);

        try {
            // Extract existing textures and upscale/enhance them
            editor.call('pajamadot:generate:model-extract-enhance', {
                modelId: this._asset.get('id'),
                upscale: true,
                generateMissing: true // Generate missing PBR maps
            });

            this._setStatus('Extraction started...', 'loading');

            setTimeout(() => {
                this._setButtonsEnabled(true);
                this._setStatus('');
            }, 10000);
        } catch (error) {
            console.error('[ModelAIPanel] Extract textures error:', error);
            this._setStatus(`Error: ${error}`, 'error');
            this._setButtonsEnabled(true);
        }
    }
}

// Track active panel
let activeModelPanel: ModelAIPanel | null = null;

/**
 * Initialize model AI panel integration
 */
function initModelAIPanel(): void {
    // Hook into model/container asset inspection
    editor.on('attributes:inspect[asset]', (assets: any[]) => {
        if (!assets || assets.length === 0) return;

        const asset = assets[0];
        const type = asset.get('type');

        // Only for model and container assets
        if (type !== 'model' && type !== 'container') return;

        // Check if we have a token
        const hasToken = editor.call('pajamadot:hasToken');
        if (!hasToken) return;

        // Get the inspector panel
        const inspectorPanel = editor.call('layout.attributes');
        if (!inspectorPanel) return;

        // Find the asset inspector container
        const assetInspector = inspectorPanel.dom.querySelector('.asset-inspector');
        if (!assetInspector) return;

        // Remove any existing model AI panel
        const existing = assetInspector.querySelector('.model-ai-panel');
        if (existing) {
            existing.remove();
        }

        // Clean up previous panel
        if (activeModelPanel) {
            activeModelPanel.unlink();
            activeModelPanel.destroy();
            activeModelPanel = null;
        }

        // Create and append new panel
        activeModelPanel = new ModelAIPanel();
        activeModelPanel.link(asset);
        assetInspector.appendChild(activeModelPanel.dom);
    });

    // Clean up on clear
    editor.on('attributes:clear', () => {
        if (activeModelPanel) {
            activeModelPanel.unlink();
            activeModelPanel.destroy();
            activeModelPanel = null;
        }
    });

    console.log('[PajamaDot] Model AI panel integration initialized');
}

// Initialize on editor load
editor.once('load', () => {
    setTimeout(() => {
        initModelAIPanel();
    }, 800);
});

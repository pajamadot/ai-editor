/**
 * Texture AI Inspector Panel
 * Adds AI generation capabilities to the texture asset inspector
 */

import { Button, Container, Label, Panel, SelectInput, TextInput } from '@playcanvas/pcui';
import { textureClient } from '../generation/texture-client';
import { assetImporter } from '../generation/asset-importer';

declare const editor: any;

/**
 * Texture AI Panel Component
 */
export class TextureAIPanel extends Container {
    private _asset: any = null;
    private _promptInput: TextInput;
    private _styleSelect: SelectInput;
    private _statusLabel: Label;
    private _generateBtn: Button;
    private _upscaleBtn: Button;
    private _pbrBtn: Button;
    private _removeBgBtn: Button;

    constructor() {
        super({
            class: 'texture-ai-panel'
        });

        this._buildUI();
    }

    private _buildUI(): void {
        // Panel header
        const panel = new Panel({
            headerText: 'AI GENERATION',
            collapsible: true,
            collapsed: false,
            class: 'texture-ai-panel-container'
        });

        // Description
        const descLabel = new Label({
            text: 'Generate texture variants or enhance with AI',
            class: 'texture-ai-description'
        });
        panel.append(descLabel);

        // Prompt input
        const promptContainer = new Container({ class: 'texture-ai-row' });
        const promptLabel = new Label({ text: 'Prompt:' });
        this._promptInput = new TextInput({
            placeholder: 'Describe the texture style...',
            class: 'texture-ai-prompt'
        });
        promptContainer.append(promptLabel);
        promptContainer.append(this._promptInput);
        panel.append(promptContainer);

        // Style selector
        const styleContainer = new Container({ class: 'texture-ai-row' });
        const styleLabel = new Label({ text: 'Style:' });
        this._styleSelect = new SelectInput({
            options: [
                { v: 'photorealistic', t: 'Photorealistic' },
                { v: 'stylized', t: 'Stylized' },
                { v: 'hand-painted', t: 'Hand Painted' },
                { v: 'pixel-art', t: 'Pixel Art' },
                { v: 'cartoon', t: 'Cartoon' }
            ],
            value: 'photorealistic'
        });
        styleContainer.append(styleLabel);
        styleContainer.append(this._styleSelect);
        panel.append(styleContainer);

        // Action buttons row 1
        const actionsRow1 = new Container({ class: 'texture-ai-actions' });

        this._generateBtn = new Button({
            text: 'Generate Variant (8cr)',
            icon: 'E195',
            class: 'texture-ai-btn'
        });
        this._generateBtn.class.add('primary');
        this._generateBtn.on('click', () => this._onGenerateVariant());
        actionsRow1.append(this._generateBtn);

        this._upscaleBtn = new Button({
            text: 'Upscale 2x (3cr)',
            icon: 'E149',
            class: 'texture-ai-btn'
        });
        this._upscaleBtn.on('click', () => this._onUpscale());
        actionsRow1.append(this._upscaleBtn);

        panel.append(actionsRow1);

        // Action buttons row 2
        const actionsRow2 = new Container({ class: 'texture-ai-actions' });

        this._pbrBtn = new Button({
            text: 'Generate PBR Set (24cr)',
            icon: 'E207',
            class: 'texture-ai-btn'
        });
        this._pbrBtn.on('click', () => this._onGeneratePBR());
        actionsRow2.append(this._pbrBtn);

        this._removeBgBtn = new Button({
            text: 'Remove BG (2cr)',
            icon: 'E163',
            class: 'texture-ai-btn'
        });
        this._removeBgBtn.on('click', () => this._onRemoveBackground());
        actionsRow2.append(this._removeBgBtn);

        panel.append(actionsRow2);

        // Status label
        this._statusLabel = new Label({
            text: '',
            class: 'texture-ai-status'
        });
        panel.append(this._statusLabel);

        this.append(panel);
        this._addStyles();
    }

    private _addStyles(): void {
        const styleId = 'pajamadot-texture-ai-panel-styles';
        if (document.getElementById(styleId)) return;

        const styles = document.createElement('style');
        styles.id = styleId;
        styles.textContent = `
            .texture-ai-panel-container {
                margin-top: 10px;
                border-top: 1px solid #3a3a3a;
            }

            .texture-ai-panel-container .pcui-panel-header {
                background: linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(99, 102, 241, 0.1));
            }

            .texture-ai-description {
                color: #888;
                font-size: 11px;
                margin-bottom: 8px;
            }

            .texture-ai-row {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 8px;
            }

            .texture-ai-row > .pcui-label {
                min-width: 50px;
                color: #aaa;
            }

            .texture-ai-prompt {
                flex: 1;
            }

            .texture-ai-actions {
                display: flex;
                gap: 6px;
                margin-bottom: 6px;
                flex-wrap: wrap;
            }

            .texture-ai-btn {
                flex: 1;
                font-size: 11px;
                min-width: 80px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .texture-ai-btn .pcui-button-text {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .texture-ai-btn.primary {
                background: linear-gradient(135deg, #a855f7, #6366f1);
            }

            .texture-ai-btn.primary:hover {
                background: linear-gradient(135deg, #9333ea, #4f46e5);
            }

            .texture-ai-status {
                color: #888;
                font-size: 11px;
                text-align: center;
                min-height: 16px;
            }

            .texture-ai-status.success {
                color: #22c55e;
            }

            .texture-ai-status.error {
                color: #ef4444;
            }

            .texture-ai-status.loading {
                color: #a855f7;
            }
        `;
        document.head.appendChild(styles);
    }

    /**
     * Link to asset
     */
    link(asset: any): void {
        this._asset = asset;

        // Pre-fill prompt from asset name or existing aigc metadata
        const existingPrompt = asset.get('meta.aigc.prompt');
        const assetName = asset.get('name') || '';
        this._promptInput.value = existingPrompt || assetName.replace(/\.(png|jpg|jpeg|webp)$/i, '');
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
        this._upscaleBtn.enabled = enabled;
        this._pbrBtn.enabled = enabled;
        this._removeBgBtn.enabled = enabled;
    }

    private async _onGenerateVariant(): Promise<void> {
        if (!this._asset) return;

        const hasToken = editor.call('pajamadot:hasToken');
        if (!hasToken) {
            editor.call('picker:pajamadot:token');
            return;
        }

        this._setStatus('Generating variant...', 'loading');
        this._setButtonsEnabled(false);

        try {
            const prompt = this._promptInput.value || this._asset.get('name');
            const style = this._styleSelect.value;

            const result = await textureClient.generateTexture(`${prompt}, ${style} style`, {
                seamless: true
            });

            if (result.success && result.textureUrl) {
                const folder = this._asset.get('parent') || editor.call('assets:panel:currentFolder');
                const baseName = this._asset.get('name').replace(/\.(png|jpg|jpeg|webp)$/i, '');
                const name = `${baseName}_variant`;

                await assetImporter.importTextureFromUrl(result.textureUrl, name, folder);

                this._setStatus('Variant generated!', 'success');
                editor.call('aigc:credits:refresh');
            } else {
                this._setStatus(result.error || 'Generation failed', 'error');
            }
        } catch (error) {
            console.error('[TextureAIPanel] Generate variant error:', error);
            this._setStatus(`Error: ${error}`, 'error');
        } finally {
            this._setButtonsEnabled(true);
        }
    }

    private async _onUpscale(): Promise<void> {
        if (!this._asset) return;

        const hasToken = editor.call('pajamadot:hasToken');
        if (!hasToken) {
            editor.call('picker:pajamadot:token');
            return;
        }

        this._setStatus('Upscaling 2x...', 'loading');
        this._setButtonsEnabled(false);

        try {
            editor.call('pajamadot:quick:upscale', this._asset.get('id'), 2);
            this._setStatus('Upscale started...', 'loading');

            // The actual completion will be handled by the quick:upscale method
            setTimeout(() => {
                this._setButtonsEnabled(true);
                this._setStatus('');
            }, 2000);
        } catch (error) {
            console.error('[TextureAIPanel] Upscale error:', error);
            this._setStatus(`Error: ${error}`, 'error');
            this._setButtonsEnabled(true);
        }
    }

    private async _onGeneratePBR(): Promise<void> {
        if (!this._asset) return;

        const hasToken = editor.call('pajamadot:hasToken');
        if (!hasToken) {
            editor.call('picker:pajamadot:token');
            return;
        }

        this._setStatus('Generating PBR set...', 'loading');
        this._setButtonsEnabled(false);

        try {
            editor.call('pajamadot:quick:pbr', this._asset.get('id'));
            this._setStatus('PBR generation started...', 'loading');

            // The actual completion will be handled by the quick:pbr method
            setTimeout(() => {
                this._setButtonsEnabled(true);
                this._setStatus('');
            }, 5000);
        } catch (error) {
            console.error('[TextureAIPanel] PBR generation error:', error);
            this._setStatus(`Error: ${error}`, 'error');
            this._setButtonsEnabled(true);
        }
    }

    private async _onRemoveBackground(): Promise<void> {
        if (!this._asset) return;

        const hasToken = editor.call('pajamadot:hasToken');
        if (!hasToken) {
            editor.call('picker:pajamadot:token');
            return;
        }

        this._setStatus('Removing background...', 'loading');
        this._setButtonsEnabled(false);

        try {
            editor.call('pajamadot:quick:remove-bg', this._asset.get('id'));
            this._setStatus('Background removal started...', 'loading');

            setTimeout(() => {
                this._setButtonsEnabled(true);
                this._setStatus('');
            }, 3000);
        } catch (error) {
            console.error('[TextureAIPanel] Remove background error:', error);
            this._setStatus(`Error: ${error}`, 'error');
            this._setButtonsEnabled(true);
        }
    }
}

// Track active panel
let activeTexturePanel: TextureAIPanel | null = null;

/**
 * Initialize texture AI panel integration
 */
function initTextureAIPanel(): void {
    // Hook into texture asset inspection
    editor.on('attributes:inspect[asset]', (assets: any[]) => {
        if (!assets || assets.length === 0) return;

        const asset = assets[0];
        const type = asset.get('type');

        // Only for texture assets
        if (type !== 'texture') return;

        // Check if we have a token
        const hasToken = editor.call('pajamadot:hasToken');
        if (!hasToken) return;

        // Get the inspector panel
        const inspectorPanel = editor.call('layout.attributes');
        if (!inspectorPanel) return;

        // Find the asset inspector container
        const assetInspector = inspectorPanel.dom.querySelector('.asset-inspector');
        if (!assetInspector) return;

        // Remove any existing texture AI panel
        const existing = assetInspector.querySelector('.texture-ai-panel');
        if (existing) {
            existing.remove();
        }

        // Clean up previous panel
        if (activeTexturePanel) {
            activeTexturePanel.unlink();
            activeTexturePanel.destroy();
            activeTexturePanel = null;
        }

        // Create and append new panel
        activeTexturePanel = new TextureAIPanel();
        activeTexturePanel.link(asset);
        assetInspector.appendChild(activeTexturePanel.dom);
    });

    // Clean up on clear
    editor.on('attributes:clear', () => {
        if (activeTexturePanel) {
            activeTexturePanel.unlink();
            activeTexturePanel.destroy();
            activeTexturePanel = null;
        }
    });

    console.log('[PajamaDot] Texture AI panel integration initialized');
}

// Initialize on editor load
editor.once('load', () => {
    setTimeout(() => {
        initTextureAIPanel();
    }, 700);
});

/**
 * Texture Generation Panel
 * AIGC panel for generating seamless textures in PlayCanvas Editor
 */

import {
    Button,
    Container,
    Label,
    Panel,
    TextInput,
    SelectInput,
    BooleanInput,
    Spinner
} from '@playcanvas/pcui';

import { textureClient } from '../generation/texture-client';
import { assetImporter } from '../generation/asset-importer';
import { generationClient } from '../generation/generation-client';

declare const editor: any;

/**
 * Texture Generation Panel
 * Allows users to generate seamless/tileable textures using AI
 */
class TextureGenerationPanel extends Container {
    private _panel: Panel;
    private _promptInput: TextInput;
    private _seamlessToggle: BooleanInput;
    private _resolutionSelect: SelectInput;
    private _styleSelect: SelectInput;
    private _typeSelect: SelectInput;
    private _generateBtn: Button;
    private _importBtn: Button;
    private _previewContainer: Container;
    private _previewImage: HTMLImageElement | null = null;
    private _statusLabel: Label;
    private _creditsLabel: Label;
    private _spinner: Spinner;

    private _lastGeneratedUrl: string | null = null;
    private _lastPrompt: string = '';
    private _isGenerating: boolean = false;

    constructor() {
        super({
            flex: true,
            class: 'pajamadot-aigc-panel'
        });

        // Main panel
        this._panel = new Panel({
            headerText: 'AI TEXTURE GENERATOR',
            collapsible: true,
            collapsed: false,
            flex: true
        });
        this.append(this._panel);

        // Credits display
        const creditsRow = new Container({ flex: true, class: 'aigc-row' });
        this._creditsLabel = new Label({ text: 'Credits: Loading...' });
        creditsRow.append(this._creditsLabel);
        this._panel.content.append(creditsRow);

        // Prompt input
        const promptRow = new Container({ flex: true, class: 'aigc-row' });
        promptRow.append(new Label({ text: 'Prompt:' }));
        this._promptInput = new TextInput({
            placeholder: 'e.g., stone brick wall, worn metal plate, wooden planks',
            class: 'aigc-prompt-input'
        });
        promptRow.append(this._promptInput);
        this._panel.content.append(promptRow);

        // Options row 1: Seamless + Resolution
        const optionsRow1 = new Container({ flex: true, class: 'aigc-row aigc-options' });

        const seamlessContainer = new Container({ flex: true });
        seamlessContainer.append(new Label({ text: 'Seamless:' }));
        this._seamlessToggle = new BooleanInput({ value: true });
        seamlessContainer.append(this._seamlessToggle);
        optionsRow1.append(seamlessContainer);

        const resolutionContainer = new Container({ flex: true });
        resolutionContainer.append(new Label({ text: 'Resolution:' }));
        this._resolutionSelect = new SelectInput({
            options: [
                { v: '512', t: '512px' },
                { v: '1024', t: '1024px' },
                { v: '2048', t: '2048px' }
            ],
            value: '1024'
        });
        resolutionContainer.append(this._resolutionSelect);
        optionsRow1.append(resolutionContainer);

        this._panel.content.append(optionsRow1);

        // Options row 2: Style + Type
        const optionsRow2 = new Container({ flex: true, class: 'aigc-row aigc-options' });

        const styleContainer = new Container({ flex: true });
        styleContainer.append(new Label({ text: 'Style:' }));
        this._styleSelect = new SelectInput({
            options: [
                { v: '', t: 'Auto' },
                { v: 'photorealistic', t: 'Photorealistic' },
                { v: 'stylized', t: 'Stylized' },
                { v: 'painted', t: 'Hand Painted' },
                { v: 'pixel art', t: 'Pixel Art' },
                { v: 'sci-fi', t: 'Sci-Fi' },
                { v: 'fantasy', t: 'Fantasy' }
            ],
            value: ''
        });
        styleContainer.append(this._styleSelect);
        optionsRow2.append(styleContainer);

        const typeContainer = new Container({ flex: true });
        typeContainer.append(new Label({ text: 'Map Type:' }));
        this._typeSelect = new SelectInput({
            options: [
                { v: 'diffuse', t: 'Diffuse (Color)' },
                { v: 'normal', t: 'Normal Map' },
                { v: 'roughness', t: 'Roughness' }
            ],
            value: 'diffuse'
        });
        typeContainer.append(this._typeSelect);
        optionsRow2.append(typeContainer);

        this._panel.content.append(optionsRow2);

        // Generate button row
        const btnRow = new Container({ flex: true, class: 'aigc-row aigc-btn-row' });

        this._generateBtn = new Button({
            text: 'Generate Texture (8 credits)',
            class: 'pajamadot-btn-primary aigc-generate-btn'
        });
        this._generateBtn.on('click', () => this._onGenerate());
        btnRow.append(this._generateBtn);

        this._spinner = new Spinner({ size: 24 });
        this._spinner.hidden = true;
        btnRow.append(this._spinner);

        this._panel.content.append(btnRow);

        // Status label
        const statusRow = new Container({ flex: true, class: 'aigc-row' });
        this._statusLabel = new Label({ text: '', class: 'aigc-status' });
        statusRow.append(this._statusLabel);
        this._panel.content.append(statusRow);

        // Preview container
        this._previewContainer = new Container({
            flex: true,
            class: 'aigc-preview-container'
        });
        this._previewContainer.hidden = true;
        this._panel.content.append(this._previewContainer);

        // Import button
        const importRow = new Container({ flex: true, class: 'aigc-row' });
        this._importBtn = new Button({
            text: 'Import to Project',
            class: 'pajamadot-btn-secondary'
        });
        this._importBtn.on('click', () => this._onImport());
        this._importBtn.hidden = true;
        importRow.append(this._importBtn);
        this._panel.content.append(importRow);

        // Load initial credits
        this._loadCredits();

        // Add custom styles
        this._addStyles();
    }

    private async _loadCredits(): Promise<void> {
        try {
            const credits = await generationClient.getCredits();
            this._creditsLabel.text = `Credits: ${credits.balance}`;
        } catch (error) {
            this._creditsLabel.text = 'Credits: --';
            console.warn('[TextureGen] Failed to load credits:', error);
        }
    }

    private async _onGenerate(): Promise<void> {
        const prompt = this._promptInput.value?.trim();
        if (!prompt) {
            this._statusLabel.text = 'Please enter a prompt';
            return;
        }

        if (this._isGenerating) return;

        this._isGenerating = true;
        this._generateBtn.enabled = false;
        this._spinner.hidden = false;
        this._statusLabel.text = 'Generating texture...';
        this._previewContainer.hidden = true;
        this._importBtn.hidden = true;

        try {
            const result = await textureClient.generateTexture({
                prompt: prompt,
                seamless: this._seamlessToggle.value,
                resolution: this._resolutionSelect.value as '512' | '1024' | '2048',
                style: this._styleSelect.value || undefined,
                type: this._typeSelect.value as 'diffuse' | 'normal' | 'roughness'
            });

            if (result.success && result.imageUrl) {
                this._lastGeneratedUrl = result.imageUrl;
                this._lastPrompt = prompt;
                this._showPreview(result.imageUrl);
                this._statusLabel.text = `Generated! Importing... (${result.creditsCost} credits)`;
                this._creditsLabel.text = `Credits: ${result.creditsRemaining}`;

                // Auto-import the texture
                await this._autoImport();
            } else {
                this._statusLabel.text = result.error || 'Generation failed';
            }
        } catch (error) {
            this._statusLabel.text = error instanceof Error ? error.message : 'Generation failed';
            console.error('[TextureGen] Generation error:', error);
        } finally {
            this._isGenerating = false;
            this._generateBtn.enabled = true;
            this._spinner.hidden = true;
        }
    }

    private async _autoImport(): Promise<void> {
        if (!this._lastGeneratedUrl) return;

        try {
            // Get or create AIGC folder
            const folder = await assetImporter.getOrCreateAIGCFolder();

            // Generate asset name from prompt
            const baseName = this._lastPrompt
                .slice(0, 30)
                .replace(/[^a-zA-Z0-9 ]/g, '')
                .trim()
                .replace(/\s+/g, '_');
            const mapType = this._typeSelect.value;
            const assetName = `${baseName}_${mapType}`;

            // Import texture
            const result = await assetImporter.importTextureFromUrl(
                this._lastGeneratedUrl,
                assetName,
                {
                    folder: folder,
                    tags: ['aigc', 'texture', mapType]
                }
            );

            if (result.success) {
                // Add AIGC metadata
                if (result.asset) {
                    assetImporter.addAIGCMetadata(result.asset, {
                        prompt: this._lastPrompt,
                        model: 'flux-schnell',
                        generatedAt: new Date()
                    });
                }

                this._statusLabel.text = `✓ Imported as "${assetName}"`;
                this._importBtn.hidden = true;

                // Select the new asset in the editor
                if (result.asset) {
                    editor.call('selector:set', 'asset', [result.asset]);
                }
            } else {
                this._statusLabel.text = `Generated but import failed: ${result.error}`;
                this._importBtn.hidden = false; // Show manual import button as fallback
            }
        } catch (error) {
            this._statusLabel.text = `Generated but import failed`;
            this._importBtn.hidden = false; // Show manual import button as fallback
            console.error('[TextureGen] Auto-import error:', error);
        }
    }

    private _showPreview(imageUrl: string): void {
        this._previewContainer.clear();
        this._previewContainer.hidden = false;

        // Create image element
        this._previewImage = document.createElement('img');
        this._previewImage.src = imageUrl;
        this._previewImage.className = 'aigc-preview-image';
        this._previewImage.alt = 'Generated texture preview';
        this._previewContainer.dom.appendChild(this._previewImage);
    }

    private async _onImport(): Promise<void> {
        if (!this._lastGeneratedUrl) {
            this._statusLabel.text = 'No texture to import';
            return;
        }

        this._importBtn.enabled = false;
        this._statusLabel.text = 'Importing to project...';

        try {
            // Get or create AIGC folder
            const folder = await assetImporter.getOrCreateAIGCFolder();

            // Generate asset name from prompt
            const baseName = this._lastPrompt
                .slice(0, 30)
                .replace(/[^a-zA-Z0-9 ]/g, '')
                .trim()
                .replace(/\s+/g, '_');
            const mapType = this._typeSelect.value;
            const assetName = `${baseName}_${mapType}`;

            // Import texture
            const result = await assetImporter.importTextureFromUrl(
                this._lastGeneratedUrl,
                assetName,
                {
                    folder: folder,
                    tags: ['aigc', 'texture', mapType]
                }
            );

            if (result.success) {
                // Add AIGC metadata
                if (result.asset) {
                    assetImporter.addAIGCMetadata(result.asset, {
                        prompt: this._lastPrompt,
                        model: 'flux-schnell',
                        generatedAt: new Date()
                    });
                }

                this._statusLabel.text = `Imported as "${assetName}"`;

                // Select the new asset
                if (result.asset) {
                    editor.call('selector:set', 'asset', [result.asset]);
                }
            } else {
                this._statusLabel.text = result.error || 'Import failed';
            }
        } catch (error) {
            this._statusLabel.text = error instanceof Error ? error.message : 'Import failed';
            console.error('[TextureGen] Import error:', error);
        } finally {
            this._importBtn.enabled = true;
        }
    }

    private _addStyles(): void {
        const styleId = 'pajamadot-texture-gen-styles';
        if (document.getElementById(styleId)) return;

        const styles = document.createElement('style');
        styles.id = styleId;
        styles.textContent = `
            .pajamadot-aigc-panel {
                padding: 0;
            }
            .aigc-row {
                margin-bottom: 8px;
            }
            .aigc-row label {
                min-width: 80px;
                color: #888;
            }
            .aigc-prompt-input {
                flex: 1;
            }
            .aigc-options {
                gap: 16px;
            }
            .aigc-options > div {
                flex: 1;
            }
            .aigc-btn-row {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .aigc-generate-btn {
                flex: 1;
            }
            .aigc-status {
                color: #888;
                font-size: 12px;
            }
            .aigc-preview-container {
                margin: 8px 0;
                border: 1px solid #333;
                border-radius: 4px;
                overflow: hidden;
                background: #1a1a1a;
            }
            .aigc-preview-image {
                width: 100%;
                height: auto;
                display: block;
            }
            .pajamadot-btn-primary {
                background: #4a90d9;
                color: white;
            }
            .pajamadot-btn-primary:hover {
                background: #5a9fe9;
            }
            .pajamadot-btn-secondary {
                background: #444;
                color: white;
            }
            .pajamadot-btn-secondary:hover {
                background: #555;
            }
        `;
        document.head.appendChild(styles);
    }

    show(): void {
        this.hidden = false;
        this._loadCredits();
    }

    hide(): void {
        this.hidden = true;
    }
}

// Singleton instance
let texturePanel: TextureGenerationPanel | null = null;

/**
 * Initialize texture generation panel
 */
function initTextureGenerationPanel(): void {
    if (texturePanel) return;

    texturePanel = new TextureGenerationPanel();
    texturePanel.hidden = true;

    // Add to the main layout
    const root = editor.call('layout.root');
    if (root) {
        root.append(texturePanel);
    }

    // Register methods
    editor.method('pajamadot:panel:texture:show', () => {
        texturePanel?.show();
    });

    editor.method('pajamadot:panel:texture:hide', () => {
        texturePanel?.hide();
    });

    editor.method('pajamadot:panel:texture:toggle', () => {
        if (texturePanel) {
            if (texturePanel.hidden) {
                texturePanel.show();
            } else {
                texturePanel.hide();
            }
        }
    });

    console.log('[PajamaDot] Texture generation panel registered');
}

// Initialize on editor load
editor.once('load', () => {
    initTextureGenerationPanel();
});

export { TextureGenerationPanel, texturePanel };

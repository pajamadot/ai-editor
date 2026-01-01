/**
 * Mesh Generation Panel
 * AIGC panel for generating 3D meshes from images/prompts in PlayCanvas Editor
 */

import {
    Button,
    Container,
    Label,
    Panel,
    TextInput,
    SelectInput,
    SliderInput,
    Spinner
} from '@playcanvas/pcui';

import { meshClient } from '../generation/mesh-client';
import { assetImporter } from '../generation/asset-importer';
import { generationClient } from '../generation/generation-client';

declare const editor: any;

/**
 * Generation mode for mesh generation
 */
type GenerationMode = 'prompt' | 'image';

/**
 * Mesh Generation Panel
 * Allows users to generate 3D meshes using AI (image-to-3D)
 */
class MeshGenerationPanel extends Container {
    private _panel: Panel;
    private _modeSelect: SelectInput;
    private _promptInput: TextInput;
    private _imageUrlInput: TextInput;
    private _promptContainer: Container;
    private _imageContainer: Container;
    private _simplifySlider: SliderInput;
    private _textureResSelect: SelectInput;
    private _styleSelect: SelectInput;
    private _generateBtn: Button;
    private _importBtn: Button;
    private _previewContainer: Container;
    private _statusLabel: Label;
    private _creditsLabel: Label;
    private _costLabel: Label;
    private _spinner: Spinner;
    private _progressLabel: Label;

    private _lastGeneratedMeshUrl: string | null = null;
    private _lastGeneratedTextureUrl: string | null = null;
    private _lastReferenceImageUrl: string | null = null;
    private _lastPrompt: string = '';
    private _isGenerating: boolean = false;

    constructor() {
        super({
            flex: true,
            class: 'pajamadot-aigc-panel'
        });

        // Main panel
        this._panel = new Panel({
            headerText: 'AI 3D MESH GENERATOR',
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

        // Mode selection
        const modeRow = new Container({ flex: true, class: 'aigc-row' });
        modeRow.append(new Label({ text: 'Generate from:' }));
        this._modeSelect = new SelectInput({
            options: [
                { v: 'prompt', t: 'Text Prompt (28 credits)' },
                { v: 'image', t: 'Image URL (20 credits)' }
            ],
            value: 'prompt'
        });
        this._modeSelect.on('change', () => this._onModeChange());
        modeRow.append(this._modeSelect);
        this._panel.content.append(modeRow);

        // Prompt input container
        this._promptContainer = new Container({ flex: true, class: 'aigc-row' });
        this._promptContainer.append(new Label({ text: 'Prompt:' }));
        this._promptInput = new TextInput({
            placeholder: 'e.g., wooden treasure chest, sci-fi robot, medieval sword',
            class: 'aigc-prompt-input'
        });
        this._promptContainer.append(this._promptInput);
        this._panel.content.append(this._promptContainer);

        // Image URL input container
        this._imageContainer = new Container({ flex: true, class: 'aigc-row' });
        this._imageContainer.append(new Label({ text: 'Image URL:' }));
        this._imageUrlInput = new TextInput({
            placeholder: 'https://example.com/object-image.png',
            class: 'aigc-prompt-input'
        });
        this._imageContainer.append(this._imageUrlInput);
        this._imageContainer.hidden = true;
        this._panel.content.append(this._imageContainer);

        // Style selection (only for prompt mode)
        const styleRow = new Container({ flex: true, class: 'aigc-row' });
        styleRow.append(new Label({ text: 'Style:' }));
        this._styleSelect = new SelectInput({
            options: [
                { v: '', t: 'Clean 3D Render' },
                { v: 'low poly', t: 'Low Poly' },
                { v: 'realistic', t: 'Realistic' },
                { v: 'stylized cartoon', t: 'Stylized/Cartoon' },
                { v: 'sci-fi', t: 'Sci-Fi' },
                { v: 'fantasy medieval', t: 'Fantasy/Medieval' }
            ],
            value: ''
        });
        styleRow.append(this._styleSelect);
        this._panel.content.append(styleRow);

        // Options row: Simplify + Texture Resolution
        const optionsRow = new Container({ flex: true, class: 'aigc-row' });
        optionsRow.class.add('aigc-options');

        const simplifyContainer = new Container({ flex: true });
        simplifyContainer.append(new Label({ text: 'Mesh Detail:' }));
        this._simplifySlider = new SliderInput({
            min: 0.1,
            max: 1.0,
            step: 0.1,
            value: 0.9,
            sliderMin: 0.1,
            sliderMax: 1.0
        });
        simplifyContainer.append(this._simplifySlider);
        optionsRow.append(simplifyContainer);

        const texResContainer = new Container({ flex: true });
        texResContainer.append(new Label({ text: 'Texture:' }));
        this._textureResSelect = new SelectInput({
            options: [
                { v: '512', t: '512px' },
                { v: '1024', t: '1024px' },
                { v: '2048', t: '2048px' }
            ],
            value: '1024'
        });
        texResContainer.append(this._textureResSelect);
        optionsRow.append(texResContainer);

        this._panel.content.append(optionsRow);

        // Cost display
        const costRow = new Container({ flex: true, class: 'aigc-row' });
        this._costLabel = new Label({
            text: 'Cost: 28 credits (8 image + 20 mesh)',
            class: 'aigc-cost'
        });
        costRow.append(this._costLabel);
        this._panel.content.append(costRow);

        // Generate button row
        const btnRow = new Container({ flex: true, class: 'aigc-row' });
        btnRow.class.add('aigc-btn-row');

        this._generateBtn = new Button({
            text: 'Generate 3D Mesh',
            class: 'pajamadot-btn-primary'
        });
        this._generateBtn.class.add('aigc-generate-btn');
        this._generateBtn.on('click', () => this._onGenerate());
        btnRow.append(this._generateBtn);

        this._spinner = new Spinner({ size: 24 });
        this._spinner.hidden = true;
        btnRow.append(this._spinner);

        this._panel.content.append(btnRow);

        // Progress label
        const progressRow = new Container({ flex: true, class: 'aigc-row' });
        this._progressLabel = new Label({ text: '', class: 'aigc-progress' });
        progressRow.append(this._progressLabel);
        this._panel.content.append(progressRow);

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
        this._previewContainer.class.add('aigc-mesh-preview');
        this._previewContainer.hidden = true;
        this._panel.content.append(this._previewContainer);

        // Import button
        const importRow = new Container({ flex: true, class: 'aigc-row' });
        this._importBtn = new Button({
            text: 'Import Model to Project',
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

    private _onModeChange(): void {
        const mode = this._modeSelect.value as GenerationMode;
        this._promptContainer.hidden = mode !== 'prompt';
        this._imageContainer.hidden = mode !== 'image';
        this._styleSelect.parent!.hidden = mode !== 'prompt';

        // Update cost label
        if (mode === 'prompt') {
            this._costLabel.text = 'Cost: 28 credits (8 image + 20 mesh)';
        } else {
            this._costLabel.text = 'Cost: 20 credits (mesh only)';
        }
    }

    private async _loadCredits(): Promise<void> {
        try {
            const credits = await generationClient.getCredits();
            this._creditsLabel.text = `Credits: ${credits.balance}`;
        } catch (error) {
            this._creditsLabel.text = 'Credits: --';
            console.warn('[MeshGen] Failed to load credits:', error);
        }
    }

    private async _onGenerate(): Promise<void> {
        const mode = this._modeSelect.value as GenerationMode;

        if (mode === 'prompt') {
            const prompt = this._promptInput.value?.trim();
            if (!prompt) {
                this._statusLabel.text = 'Please enter a prompt';
                return;
            }
            await this._generateFromPrompt(prompt);
        } else {
            const imageUrl = this._imageUrlInput.value?.trim();
            if (!imageUrl) {
                this._statusLabel.text = 'Please enter an image URL';
                return;
            }
            await this._generateFromImage(imageUrl);
        }
    }

    private async _generateFromPrompt(prompt: string): Promise<void> {
        if (this._isGenerating) return;

        this._isGenerating = true;
        this._generateBtn.enabled = false;
        this._spinner.hidden = false;
        this._statusLabel.text = '';
        this._progressLabel.text = 'Step 1/2: Generating reference image...';
        this._previewContainer.hidden = true;
        this._importBtn.hidden = true;

        try {
            const result = await meshClient.generateMeshFromPrompt(
                prompt,
                {
                    style: this._styleSelect.value || undefined,
                    meshSimplify: this._simplifySlider.value,
                    textureResolution: parseInt(this._textureResSelect.value)
                },
                (stage, progress) => {
                    if (stage === 'image') {
                        this._progressLabel.text = progress < 100
                            ? 'Step 1/2: Generating reference image...'
                            : 'Step 1/2: Reference image complete!';
                    } else {
                        this._progressLabel.text = progress < 100
                            ? 'Step 2/2: Creating 3D mesh...'
                            : 'Step 2/2: Mesh generation complete!';
                    }
                }
            );

            if (result.success && result.mesh?.url) {
                this._lastGeneratedMeshUrl = result.mesh.url;
                this._lastGeneratedTextureUrl = result.texture?.url || null;
                this._lastReferenceImageUrl = result.referenceImageUrl;
                this._lastPrompt = prompt;

                this._showPreview(result.referenceImageUrl, result.mesh.url);
                this._progressLabel.text = 'Importing to project...';
                this._creditsLabel.text = `Credits: ${result.creditsRemaining}`;

                // Auto-import the mesh
                await this._autoImport(result.creditsCost);
            } else {
                this._statusLabel.text = result.error || 'Generation failed';
                this._progressLabel.text = '';
            }
        } catch (error) {
            this._statusLabel.text = error instanceof Error ? error.message : 'Generation failed';
            this._progressLabel.text = '';
            console.error('[MeshGen] Generation error:', error);
        } finally {
            this._isGenerating = false;
            this._generateBtn.enabled = true;
            this._spinner.hidden = true;
        }
    }

    private async _generateFromImage(imageUrl: string): Promise<void> {
        if (this._isGenerating) return;

        this._isGenerating = true;
        this._generateBtn.enabled = false;
        this._spinner.hidden = false;
        this._statusLabel.text = '';
        this._progressLabel.text = 'Creating 3D mesh from image...';
        this._previewContainer.hidden = true;
        this._importBtn.hidden = true;

        try {
            const result = await meshClient.generateMesh({
                imageUrl: imageUrl,
                meshSimplify: this._simplifySlider.value,
                textureResolution: parseInt(this._textureResSelect.value)
            });

            if (result.success && result.mesh?.url) {
                this._lastGeneratedMeshUrl = result.mesh.url;
                this._lastGeneratedTextureUrl = result.texture?.url || null;
                this._lastReferenceImageUrl = imageUrl;
                this._lastPrompt = 'image-to-3d';

                this._showPreview(imageUrl, result.mesh.url);
                this._progressLabel.text = 'Importing to project...';
                this._creditsLabel.text = `Credits: ${result.creditsRemaining}`;

                // Auto-import the mesh
                await this._autoImport(result.creditsCost);
            } else {
                this._statusLabel.text = result.error || 'Generation failed';
                this._progressLabel.text = '';
            }
        } catch (error) {
            this._statusLabel.text = error instanceof Error ? error.message : 'Generation failed';
            this._progressLabel.text = '';
            console.error('[MeshGen] Generation error:', error);
        } finally {
            this._isGenerating = false;
            this._generateBtn.enabled = true;
            this._spinner.hidden = true;
        }
    }

    private _showPreview(referenceImageUrl: string, meshUrl: string): void {
        this._previewContainer.clear();
        this._previewContainer.hidden = false;

        // Create preview layout
        const previewHTML = `
            <div class="mesh-preview-content">
                <div class="mesh-preview-image">
                    <img src="${referenceImageUrl}" alt="Reference image" />
                    <span class="mesh-preview-label">Reference Image</span>
                </div>
                <div class="mesh-preview-info">
                    <div class="mesh-preview-icon">📦</div>
                    <span>3D Model Ready</span>
                    <a href="${meshUrl}" target="_blank" class="mesh-download-link">Download GLB</a>
                </div>
            </div>
        `;
        this._previewContainer.dom.innerHTML = previewHTML;
    }

    private async _autoImport(creditsCost: number): Promise<void> {
        if (!this._lastGeneratedMeshUrl) return;

        try {
            // Get or create AIGC folder
            const folder = await assetImporter.getOrCreateAIGCFolder();

            // Generate asset name from prompt
            const baseName = this._lastPrompt === 'image-to-3d'
                ? 'ai_model'
                : this._lastPrompt
                    .slice(0, 30)
                    .replace(/[^a-zA-Z0-9 ]/g, '')
                    .trim()
                    .replace(/\s+/g, '_');

            const assetName = `${baseName}_mesh`;

            // Import mesh
            const result = await assetImporter.importModelFromUrl(
                this._lastGeneratedMeshUrl,
                assetName,
                {
                    folder: folder,
                    tags: ['aigc', 'mesh', '3d']
                }
            );

            if (result.success) {
                // Add AIGC metadata
                if (result.asset) {
                    assetImporter.addAIGCMetadata(result.asset, {
                        prompt: this._lastPrompt,
                        model: 'trellis',
                        generatedAt: new Date(),
                        cost: creditsCost
                    });
                }

                this._statusLabel.text = `✓ Imported as "${assetName}" (${creditsCost} credits)`;
                this._progressLabel.text = '';
                this._importBtn.hidden = true;

                // Select the new asset in the editor
                if (result.asset) {
                    editor.call('selector:set', 'asset', [result.asset]);
                }
            } else {
                this._statusLabel.text = `Generated but import failed: ${result.error}`;
                this._progressLabel.text = '';
                this._importBtn.hidden = false; // Show manual import as fallback
            }
        } catch (error) {
            this._statusLabel.text = `Generated but import failed`;
            this._progressLabel.text = '';
            this._importBtn.hidden = false; // Show manual import as fallback
            console.error('[MeshGen] Auto-import error:', error);
        }
    }

    private async _onImport(): Promise<void> {
        if (!this._lastGeneratedMeshUrl) {
            this._statusLabel.text = 'No mesh to import';
            return;
        }

        this._importBtn.enabled = false;
        this._statusLabel.text = 'Importing model to project...';

        try {
            // Get or create AIGC folder
            const folder = await assetImporter.getOrCreateAIGCFolder();

            // Generate asset name from prompt
            const baseName = this._lastPrompt === 'image-to-3d'
                ? 'ai_model'
                : this._lastPrompt
                    .slice(0, 30)
                    .replace(/[^a-zA-Z0-9 ]/g, '')
                    .trim()
                    .replace(/\s+/g, '_');

            const assetName = `${baseName}_mesh`;

            // Import mesh
            const result = await assetImporter.importModelFromUrl(
                this._lastGeneratedMeshUrl,
                assetName,
                {
                    folder: folder,
                    tags: ['aigc', 'mesh', '3d']
                }
            );

            if (result.success) {
                // Add AIGC metadata
                if (result.asset) {
                    assetImporter.addAIGCMetadata(result.asset, {
                        prompt: this._lastPrompt,
                        model: 'trellis',
                        generatedAt: new Date()
                    });
                }

                this._statusLabel.text = `✓ Imported as "${assetName}"`;
                this._importBtn.hidden = true;

                // Select the new asset
                if (result.asset) {
                    editor.call('selector:set', 'asset', [result.asset]);
                }
            } else {
                this._statusLabel.text = result.error || 'Import failed';
            }
        } catch (error) {
            this._statusLabel.text = error instanceof Error ? error.message : 'Import failed';
            console.error('[MeshGen] Import error:', error);
        } finally {
            this._importBtn.enabled = true;
        }
    }

    private _addStyles(): void {
        const styleId = 'pajamadot-mesh-gen-styles';
        if (document.getElementById(styleId)) return;

        const styles = document.createElement('style');
        styles.id = styleId;
        styles.textContent = `
            .aigc-mesh-preview {
                min-height: 120px;
            }
            .mesh-preview-content {
                display: flex;
                gap: 16px;
                padding: 8px;
            }
            .mesh-preview-image {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
            }
            .mesh-preview-image img {
                max-width: 120px;
                max-height: 120px;
                border-radius: 4px;
            }
            .mesh-preview-label {
                font-size: 10px;
                color: #888;
                margin-top: 4px;
            }
            .mesh-preview-info {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
            .mesh-preview-icon {
                font-size: 32px;
            }
            .mesh-preview-info span {
                color: #4a90d9;
                font-weight: 500;
            }
            .mesh-download-link {
                font-size: 11px;
                color: #888;
                text-decoration: underline;
            }
            .mesh-download-link:hover {
                color: #4a90d9;
            }
            .aigc-progress {
                color: #4a90d9;
                font-size: 12px;
                font-style: italic;
            }
            .aigc-cost {
                color: #888;
                font-size: 11px;
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
let meshPanel: MeshGenerationPanel | null = null;

/**
 * Initialize mesh generation panel
 */
function initMeshGenerationPanel(): void {
    if (meshPanel) return;

    meshPanel = new MeshGenerationPanel();
    meshPanel.hidden = true;

    // Add to the main layout
    const root = editor.call('layout.root');
    if (root) {
        root.append(meshPanel);
    }

    // Register methods
    editor.method('pajamadot:panel:mesh:show', () => {
        meshPanel?.show();
    });

    editor.method('pajamadot:panel:mesh:hide', () => {
        meshPanel?.hide();
    });

    editor.method('pajamadot:panel:mesh:toggle', () => {
        if (meshPanel) {
            if (meshPanel.hidden) {
                meshPanel.show();
            } else {
                meshPanel.hide();
            }
        }
    });

    console.log('[PajamaDot] Mesh generation panel registered');
}

// Initialize on editor load
editor.once('load', () => {
    initMeshGenerationPanel();
});

export { MeshGenerationPanel, meshPanel };

/**
 * Asset Generation Modal
 * Unified modal for generating textures, 3D meshes, and videos using PajamaDot AIGC
 */

import {
    Button,
    Container,
    Label,
    Panel,
    TextInput,
    TextAreaInput,
    SelectInput,
    SliderInput,
    Spinner,
    NumericInput
} from '@playcanvas/pcui';

import { PajamaDotTokenManager } from '../generation/token-manager';
import { generationClient } from '../generation/generation-client';
import { textureClient } from '../generation/texture-client';
import { meshClient } from '../generation/mesh-client';
import { videoClient } from '../generation/video-client';
import type {
    GenerationResult,
    TextureGenerationResult,
    MeshGenerationResult,
    CreditsBalance
} from '../generation/types';
import type { VideoGenerationResult } from '../generation/video-client';

declare const editor: any;

type GenerationType = 'texture' | 'image' | 'mesh' | 'video';
type GenerationStatus = 'idle' | 'generating' | 'completed' | 'failed';

interface GenerationHistoryItem {
    id: string;
    type: GenerationType;
    prompt: string;
    status: GenerationStatus;
    resultUrl?: string;
    thumbnailUrl?: string;
    creditsCost: number;
    createdAt: Date;
    error?: string;
}

/**
 * Asset Generation Modal
 * Provides a unified interface for generating assets using AI
 */
class AssetGenerationModal extends Container {
    private _overlay: HTMLElement | null = null;
    private _currentTab: GenerationType = 'texture';
    private _status: GenerationStatus = 'idle';
    private _history: GenerationHistoryItem[] = [];
    private _creditsBalance: number = 0;

    // UI Elements
    private _tabButtons: Map<GenerationType, Button> = new Map();
    private _contentPanels: Map<GenerationType, Container> = new Map();
    private _balanceLabel: Label;
    private _statusLabel: Label;
    private _generateButton: Button;
    private _resultPreview: Container;
    private _historyPanel: Container;
    private _spinner: Spinner;

    // Input fields
    private _promptInput: TextAreaInput;
    private _styleSelect: SelectInput;
    private _qualitySelect: SelectInput;
    private _aspectRatioSelect: SelectInput;
    private _meshSimplifySlider: SliderInput;
    private _textureResolutionSelect: SelectInput;
    private _videoDurationInput: NumericInput;
    private _imageUrlInput: TextInput;

    constructor() {
        super({
            class: 'pajamadot-asset-gen-modal'
        });

        this._buildUI();
        this._loadHistory();
        this._loadCredits();
    }

    private _buildUI() {
        // Main container with flex layout
        const mainContainer = new Container({
            flex: true,
            flexDirection: 'row',
            class: 'pajamadot-asset-gen-main'
        });
        this.append(mainContainer);

        // Left panel - Generation controls
        const leftPanel = new Container({
            class: 'pajamadot-asset-gen-left'
        });
        mainContainer.append(leftPanel);

        // Header with title and balance
        const header = new Container({
            flex: true,
            flexDirection: 'row',
            class: 'pajamadot-asset-gen-header'
        });
        leftPanel.append(header);

        const titleLabel = new Label({
            text: 'AIGC Asset Generation',
            class: 'pajamadot-asset-gen-title'
        });
        header.append(titleLabel);

        this._balanceLabel = new Label({
            text: 'Credits: --',
            class: 'pajamadot-balance-label'
        });
        header.append(this._balanceLabel);

        // Tabs
        const tabsContainer = new Container({
            flex: true,
            flexDirection: 'row',
            class: 'pajamadot-tabs'
        });
        leftPanel.append(tabsContainer);

        const tabs: { type: GenerationType; label: string; icon: string }[] = [
            { type: 'texture', label: 'Texture', icon: '🎨' },
            { type: 'image', label: 'Image', icon: '🖼️' },
            { type: 'mesh', label: '3D Mesh', icon: '📦' },
            { type: 'video', label: 'Video', icon: '🎬' }
        ];

        tabs.forEach(tab => {
            const button = new Button({
                text: `${tab.icon} ${tab.label}`,
                class: `pajamadot-tab ${tab.type === this._currentTab ? 'active' : ''}`
            });
            button.on('click', () => this._switchTab(tab.type));
            tabsContainer.append(button);
            this._tabButtons.set(tab.type, button);
        });

        // Content panels
        const contentContainer = new Container({
            class: 'pajamadot-tab-content'
        });
        leftPanel.append(contentContainer);

        // Create content panels for each tab
        this._createTexturePanel(contentContainer);
        this._createImagePanel(contentContainer);
        this._createMeshPanel(contentContainer);
        this._createVideoPanel(contentContainer);

        // Show initial tab
        this._switchTab('texture');

        // Status and generate button
        const actionsContainer = new Container({
            flex: true,
            flexDirection: 'column',
            class: 'pajamadot-actions'
        });
        leftPanel.append(actionsContainer);

        this._statusLabel = new Label({
            text: '',
            class: 'pajamadot-status-label'
        });
        actionsContainer.append(this._statusLabel);

        const buttonRow = new Container({
            flex: true,
            flexDirection: 'row',
            class: 'pajamadot-button-row'
        });
        actionsContainer.append(buttonRow);

        this._spinner = new Spinner({
            hidden: true,
            class: 'pajamadot-spinner'
        });
        buttonRow.append(this._spinner);

        this._generateButton = new Button({
            text: 'Generate',
            class: 'pajamadot-btn-primary'
        });
        this._generateButton.class.add('pajamadot-generate-btn');
        this._generateButton.on('click', () => this._handleGenerate());
        buttonRow.append(this._generateButton);

        const closeButton = new Button({
            text: 'Close',
            class: 'pajamadot-btn-secondary'
        });
        closeButton.on('click', () => this.close());
        buttonRow.append(closeButton);

        // Result preview
        this._resultPreview = new Container({
            class: 'pajamadot-result-preview',
            hidden: true
        });
        leftPanel.append(this._resultPreview);

        // Right panel - History
        const rightPanel = new Container({
            class: 'pajamadot-asset-gen-right'
        });
        mainContainer.append(rightPanel);

        const historyHeader = new Label({
            text: 'Generation History',
            class: 'pajamadot-history-header'
        });
        rightPanel.append(historyHeader);

        this._historyPanel = new Container({
            class: 'pajamadot-history-panel'
        });
        rightPanel.append(this._historyPanel);
    }

    private _createTexturePanel(parent: Container) {
        const panel = new Container({
            class: 'pajamadot-gen-panel',
            hidden: true
        });
        parent.append(panel);
        this._contentPanels.set('texture', panel);

        // Prompt input
        const promptLabel = new Label({ text: 'Texture Description' });
        panel.append(promptLabel);

        this._promptInput = new TextAreaInput({
            placeholder: 'Describe the texture you want to generate...\ne.g., "weathered wooden planks with moss", "polished marble with gold veins"',
            class: 'pajamadot-prompt-input',
            rows: 3
        });
        panel.append(this._promptInput);

        // Texture options row
        const optionsRow = new Container({
            flex: true,
            flexDirection: 'row',
            class: 'pajamadot-options-row'
        });
        panel.append(optionsRow);

        // Resolution
        const resContainer = new Container({ class: 'pajamadot-option' });
        resContainer.append(new Label({ text: 'Resolution' }));
        this._textureResolutionSelect = new SelectInput({
            options: [
                { v: '512', t: '512px' },
                { v: '1024', t: '1024px' },
                { v: '2048', t: '2048px' }
            ],
            value: '1024'
        });
        resContainer.append(this._textureResolutionSelect);
        optionsRow.append(resContainer);

        // Style
        const styleContainer = new Container({ class: 'pajamadot-option' });
        styleContainer.append(new Label({ text: 'Style' }));
        this._styleSelect = new SelectInput({
            options: [
                { v: 'photorealistic', t: 'Photorealistic' },
                { v: 'stylized', t: 'Stylized' },
                { v: 'painted', t: 'Hand-Painted' },
                { v: 'pixel', t: 'Pixel Art' }
            ],
            value: 'photorealistic'
        });
        styleContainer.append(this._styleSelect);
        optionsRow.append(styleContainer);

        // PBR maps option
        const pbrContainer = new Container({
            flex: true,
            class: 'pajamadot-pbr-option'
        });
        panel.append(pbrContainer);

        const pbrLabel = new Label({
            text: 'Generate PBR maps: Diffuse, Normal, Roughness (+16 credits)',
            class: 'pajamadot-info-text'
        });
        pbrContainer.append(pbrLabel);

        // Credit estimate
        const costLabel = new Label({
            text: '💰 Estimated cost: 8 credits',
            class: 'pajamadot-cost-label'
        });
        panel.append(costLabel);
    }

    private _createImagePanel(parent: Container) {
        const panel = new Container({
            class: 'pajamadot-gen-panel',
            hidden: true
        });
        parent.append(panel);
        this._contentPanels.set('image', panel);

        // Prompt input
        const promptLabel = new Label({ text: 'Image Description' });
        panel.append(promptLabel);

        const promptInput = new TextAreaInput({
            placeholder: 'Describe the image you want to generate...',
            class: 'pajamadot-prompt-input',
            rows: 3
        });
        panel.append(promptInput);

        // Options row
        const optionsRow = new Container({
            flex: true,
            flexDirection: 'row',
            class: 'pajamadot-options-row'
        });
        panel.append(optionsRow);

        // Aspect ratio
        const aspectContainer = new Container({ class: 'pajamadot-option' });
        aspectContainer.append(new Label({ text: 'Aspect Ratio' }));
        this._aspectRatioSelect = new SelectInput({
            options: [
                { v: '1:1', t: 'Square (1:1)' },
                { v: '16:9', t: 'Landscape (16:9)' },
                { v: '9:16', t: 'Portrait (9:16)' },
                { v: '4:3', t: 'Standard (4:3)' }
            ],
            value: '1:1'
        });
        aspectContainer.append(this._aspectRatioSelect);
        optionsRow.append(aspectContainer);

        // Model selection
        const modelContainer = new Container({ class: 'pajamadot-option' });
        modelContainer.append(new Label({ text: 'Model' }));
        const modelSelect = new SelectInput({
            options: [
                { v: 'flux-schnell', t: 'Flux Schnell (Fast)' },
                { v: 'nano-banana-pro', t: 'Nano Banana Pro' },
                { v: 'seedream-v4.5', t: 'Seedream v4.5' }
            ],
            value: 'flux-schnell'
        });
        modelContainer.append(modelSelect);
        optionsRow.append(modelContainer);

        // Credit estimate
        const costLabel = new Label({
            text: '💰 Estimated cost: 4-8 credits',
            class: 'pajamadot-cost-label'
        });
        panel.append(costLabel);
    }

    private _createMeshPanel(parent: Container) {
        const panel = new Container({
            class: 'pajamadot-gen-panel',
            hidden: true
        });
        parent.append(panel);
        this._contentPanels.set('mesh', panel);

        // Mode selection
        const modeLabel = new Label({ text: 'Generation Mode' });
        panel.append(modeLabel);

        const modeSelect = new SelectInput({
            options: [
                { v: 'text', t: 'Text to 3D (28 credits)' },
                { v: 'image', t: 'Image to 3D (20 credits)' }
            ],
            value: 'text',
            class: 'pajamadot-mode-select'
        });
        panel.append(modeSelect);

        // Prompt input (for text mode)
        const promptContainer = new Container({
            class: 'pajamadot-prompt-container'
        });
        panel.append(promptContainer);

        const promptLabel = new Label({ text: '3D Object Description' });
        promptContainer.append(promptLabel);

        const promptInput = new TextAreaInput({
            placeholder: 'Describe the 3D object you want to generate...\ne.g., "a treasure chest with golden ornaments", "futuristic laser rifle"',
            class: 'pajamadot-prompt-input',
            rows: 3
        });
        promptContainer.append(promptInput);

        // Image URL input (for image mode)
        const imageContainer = new Container({
            class: 'pajamadot-image-container',
            hidden: true
        });
        panel.append(imageContainer);

        const imageLabel = new Label({ text: 'Source Image URL' });
        imageContainer.append(imageLabel);

        this._imageUrlInput = new TextInput({
            placeholder: 'https://... or paste an image',
            class: 'pajamadot-url-input'
        });
        imageContainer.append(this._imageUrlInput);

        // Toggle based on mode
        modeSelect.on('change', (value: string) => {
            promptContainer.hidden = value === 'image';
            imageContainer.hidden = value === 'text';
        });

        // Mesh options
        const optionsRow = new Container({
            flex: true,
            flexDirection: 'row',
            class: 'pajamadot-options-row'
        });
        panel.append(optionsRow);

        // Mesh simplify slider
        const simplifyContainer = new Container({ class: 'pajamadot-option' });
        simplifyContainer.append(new Label({ text: 'Mesh Simplify' }));
        this._meshSimplifySlider = new SliderInput({
            min: 0.5,
            max: 1.0,
            step: 0.05,
            value: 0.9
        });
        simplifyContainer.append(this._meshSimplifySlider);
        simplifyContainer.append(new Label({ text: 'Higher = faster, lower poly', class: 'pajamadot-hint' }));
        optionsRow.append(simplifyContainer);

        // Texture resolution
        const texResContainer = new Container({ class: 'pajamadot-option' });
        texResContainer.append(new Label({ text: 'Texture Resolution' }));
        const texResSelect = new SelectInput({
            options: [
                { v: '512', t: '512px' },
                { v: '1024', t: '1024px' },
                { v: '2048', t: '2048px' }
            ],
            value: '1024'
        });
        texResContainer.append(texResSelect);
        optionsRow.append(texResContainer);

        // Info text
        const infoLabel = new Label({
            text: '⏱️ 3D mesh generation takes 30-60 seconds',
            class: 'pajamadot-info-text'
        });
        panel.append(infoLabel);

        // Credit estimate
        const costLabel = new Label({
            text: '💰 Estimated cost: 20-28 credits',
            class: 'pajamadot-cost-label'
        });
        panel.append(costLabel);
    }

    private _createVideoPanel(parent: Container) {
        const panel = new Container({
            class: 'pajamadot-gen-panel',
            hidden: true
        });
        parent.append(panel);
        this._contentPanels.set('video', panel);

        // Coming soon banner
        const comingSoonBanner = new Container({
            class: 'pajamadot-coming-soon'
        });
        panel.append(comingSoonBanner);

        const comingSoonIcon = new Label({
            text: '🚧',
            class: 'pajamadot-coming-soon-icon'
        });
        comingSoonBanner.append(comingSoonIcon);

        const comingSoonTitle = new Label({
            text: 'Video Generation Coming Soon!',
            class: 'pajamadot-coming-soon-title'
        });
        comingSoonBanner.append(comingSoonTitle);

        const comingSoonDesc = new Label({
            text: 'AI video generation for cinematics, cutscenes, and animated textures is in development. Stay tuned!',
            class: 'pajamadot-coming-soon-desc'
        });
        comingSoonBanner.append(comingSoonDesc);

        // Disabled options preview
        const previewLabel = new Label({
            text: 'Planned features:',
            class: 'pajamadot-preview-label'
        });
        panel.append(previewLabel);

        const features = [
            '• Text-to-video generation',
            '• Image-to-video animation',
            '• 5-15 second clips',
            '• Multiple AI models (Minimax, Runway, Pika)',
            '• Direct import to PlayCanvas'
        ];

        features.forEach(feature => {
            const featureLabel = new Label({
                text: feature,
                class: 'pajamadot-feature-item'
            });
            panel.append(featureLabel);
        });
    }

    private _switchTab(tab: GenerationType) {
        this._currentTab = tab;

        // Update tab button states
        this._tabButtons.forEach((button, type) => {
            if (type === tab) {
                button.class.add('active');
            } else {
                button.class.remove('active');
            }
        });

        // Show/hide content panels
        this._contentPanels.forEach((panel, type) => {
            panel.hidden = type !== tab;
        });

        // Update generate button state for video tab
        this._generateButton.enabled = tab !== 'video';
        this._generateButton.text = tab === 'video' ? 'Coming Soon' : 'Generate';
    }

    private async _loadCredits() {
        if (!PajamaDotTokenManager.hasToken()) {
            this._balanceLabel.text = 'Credits: Sign in required';
            return;
        }

        try {
            const credits = await generationClient.getCredits();
            this._creditsBalance = credits.balance;
            this._balanceLabel.text = `Credits: ${credits.balance}`;
        } catch (error) {
            this._balanceLabel.text = 'Credits: --';
        }
    }

    private _loadHistory() {
        // Load from localStorage
        try {
            const stored = localStorage.getItem('pajamadot_generation_history');
            if (stored) {
                this._history = JSON.parse(stored);
                this._renderHistory();
            }
        } catch (e) {
            console.warn('[AssetGen] Failed to load history:', e);
        }
    }

    private _saveHistory() {
        try {
            // Keep only last 20 items
            const toSave = this._history.slice(0, 20);
            localStorage.setItem('pajamadot_generation_history', JSON.stringify(toSave));
        } catch (e) {
            console.warn('[AssetGen] Failed to save history:', e);
        }
    }

    private _addToHistory(item: GenerationHistoryItem) {
        this._history.unshift(item);
        this._saveHistory();
        this._renderHistory();
    }

    private _updateHistoryItem(id: string, updates: Partial<GenerationHistoryItem>) {
        const index = this._history.findIndex(item => item.id === id);
        if (index !== -1) {
            this._history[index] = { ...this._history[index], ...updates };
            this._saveHistory();
            this._renderHistory();
        }
    }

    private _renderHistory() {
        this._historyPanel.clear();

        if (this._history.length === 0) {
            const emptyLabel = new Label({
                text: 'No generations yet',
                class: 'pajamadot-history-empty'
            });
            this._historyPanel.append(emptyLabel);
            return;
        }

        this._history.forEach(item => {
            const historyItem = new Container({
                class: `pajamadot-history-item ${item.status}`
            });
            this._historyPanel.append(historyItem);

            // Thumbnail/preview
            if (item.thumbnailUrl || item.resultUrl) {
                const thumbnail = document.createElement('img');
                thumbnail.src = item.thumbnailUrl || item.resultUrl || '';
                thumbnail.className = 'pajamadot-history-thumbnail';
                thumbnail.alt = item.prompt.slice(0, 30);
                historyItem.dom.appendChild(thumbnail);
            } else {
                const placeholder = new Container({
                    class: 'pajamadot-history-placeholder'
                });
                const icon = new Label({
                    text: item.type === 'texture' ? '🎨' :
                          item.type === 'mesh' ? '📦' :
                          item.type === 'video' ? '🎬' : '🖼️'
                });
                placeholder.append(icon);
                historyItem.append(placeholder);
            }

            // Info
            const info = new Container({
                class: 'pajamadot-history-info'
            });
            historyItem.append(info);

            const typeLabel = new Label({
                text: item.type.charAt(0).toUpperCase() + item.type.slice(1),
                class: 'pajamadot-history-type'
            });
            info.append(typeLabel);

            const promptLabel = new Label({
                text: item.prompt.length > 40 ? item.prompt.slice(0, 40) + '...' : item.prompt,
                class: 'pajamadot-history-prompt'
            });
            info.append(promptLabel);

            // Status indicator
            const statusLabel = new Label({
                text: item.status === 'generating' ? '⏳' :
                      item.status === 'completed' ? '✅' :
                      item.status === 'failed' ? '❌' : '',
                class: 'pajamadot-history-status'
            });
            historyItem.append(statusLabel);

            // Click to use result
            if (item.status === 'completed' && item.resultUrl) {
                historyItem.dom.style.cursor = 'pointer';
                historyItem.dom.addEventListener('click', () => {
                    this._showResult(item);
                });
            }
        });
    }

    private _showResult(item: GenerationHistoryItem) {
        this._resultPreview.hidden = false;
        this._resultPreview.clear();

        const previewTitle = new Label({
            text: 'Generated Result',
            class: 'pajamadot-preview-title'
        });
        this._resultPreview.append(previewTitle);

        if (item.type === 'mesh' && item.resultUrl) {
            // 3D mesh preview would need a WebGL viewer
            const meshInfo = new Label({
                text: '3D Mesh (GLB format)',
                class: 'pajamadot-mesh-info'
            });
            this._resultPreview.append(meshInfo);
        } else if (item.resultUrl) {
            const img = document.createElement('img');
            img.src = item.resultUrl;
            img.className = 'pajamadot-preview-image';
            this._resultPreview.dom.appendChild(img);
        }

        // Action buttons
        const actions = new Container({
            flex: true,
            flexDirection: 'row',
            class: 'pajamadot-preview-actions'
        });
        this._resultPreview.append(actions);

        const importButton = new Button({
            text: 'Import to Project',
            class: 'pajamadot-btn-primary'
        });
        importButton.on('click', () => this._importAsset(item));
        actions.append(importButton);

        const downloadButton = new Button({
            text: 'Download',
            class: 'pajamadot-btn-secondary'
        });
        downloadButton.on('click', () => {
            if (item.resultUrl) {
                window.open(item.resultUrl, '_blank');
            }
        });
        actions.append(downloadButton);
    }

    private async _importAsset(item: GenerationHistoryItem) {
        if (!item.resultUrl) return;

        this._setStatus('Importing asset...', 'pending');

        try {
            let blob: Blob;
            let filename: string;
            let assetType: string;

            if (item.type === 'mesh') {
                blob = await meshClient.downloadMeshBlob(item.resultUrl);
                filename = `generated_mesh_${Date.now()}.glb`;
                assetType = 'model';
            } else if (item.type === 'video') {
                blob = await videoClient.downloadVideoBlob(item.resultUrl);
                filename = `generated_video_${Date.now()}.mp4`;
                assetType = 'video';
            } else {
                blob = await textureClient.downloadTextureBlob(item.resultUrl);
                filename = `generated_${item.type}_${Date.now()}.png`;
                assetType = 'texture';
            }

            // Upload to PlayCanvas project
            const file = new File([blob], filename, { type: blob.type });

            // Use PlayCanvas editor API to upload
            if (typeof editor !== 'undefined' && editor.call) {
                await editor.call('assets:upload', [file]);
                this._setStatus('Asset imported successfully!', 'success');
            } else {
                // Fallback: download the file
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
                this._setStatus('File downloaded (editor not available)', 'success');
            }
        } catch (error) {
            this._setStatus(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        }
    }

    private async _handleGenerate() {
        if (!PajamaDotTokenManager.hasToken()) {
            editor.call('picker:pajamadot:token');
            return;
        }

        const historyId = crypto.randomUUID();
        const prompt = this._promptInput.value.trim();

        if (!prompt && this._currentTab !== 'mesh') {
            this._setStatus('Please enter a description', 'error');
            return;
        }

        this._setStatus('Generating...', 'pending');
        this._generateButton.enabled = false;
        this._spinner.hidden = false;
        this._status = 'generating';

        // Add to history immediately
        this._addToHistory({
            id: historyId,
            type: this._currentTab,
            prompt: prompt || 'Image to 3D',
            status: 'generating',
            creditsCost: 0,
            createdAt: new Date()
        });

        try {
            let result: GenerationResult | TextureGenerationResult | MeshGenerationResult;

            switch (this._currentTab) {
                case 'texture':
                    result = await textureClient.generateTexture({
                        prompt,
                        resolution: this._textureResolutionSelect.value as '512' | '1024' | '2048',
                        style: this._styleSelect.value as string
                    });
                    break;

                case 'image':
                    result = await generationClient.generateImage({
                        prompt,
                        aspectRatio: this._aspectRatioSelect.value as string
                    });
                    break;

                case 'mesh':
                    const imageUrl = this._imageUrlInput.value.trim();
                    if (imageUrl) {
                        // Image to 3D
                        result = await meshClient.generateMesh({
                            imageUrl,
                            meshSimplify: this._meshSimplifySlider.value,
                            textureResolution: 1024
                        });
                    } else if (prompt) {
                        // Text to 3D (generates image first)
                        result = await meshClient.generateMeshFromPrompt(prompt, {
                            meshSimplify: this._meshSimplifySlider.value,
                            textureResolution: 1024
                        }, (stage, progress) => {
                            this._setStatus(`${stage === 'image' ? 'Generating reference image' : 'Creating 3D mesh'}...`, 'pending');
                        });
                    } else {
                        throw new Error('Please enter a description or image URL');
                    }
                    break;

                default:
                    throw new Error('Invalid generation type');
            }

            // Handle result
            const resultUrl = 'mesh' in result ? result.mesh?.url :
                             'imageUrl' in result ? result.imageUrl : undefined;

            if (result.success && resultUrl) {
                this._updateHistoryItem(historyId, {
                    status: 'completed',
                    resultUrl,
                    thumbnailUrl: resultUrl,
                    creditsCost: result.creditsCost
                });

                this._setStatus(`Generated! Cost: ${result.creditsCost} credits`, 'success');
                this._loadCredits(); // Refresh balance

                // Show preview
                this._showResult({
                    id: historyId,
                    type: this._currentTab,
                    prompt,
                    status: 'completed',
                    resultUrl,
                    creditsCost: result.creditsCost,
                    createdAt: new Date()
                });
            } else {
                throw new Error(result.error || 'Generation failed');
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Generation failed';
            this._updateHistoryItem(historyId, {
                status: 'failed',
                error: errorMessage
            });
            this._setStatus(`Error: ${errorMessage}`, 'error');
        } finally {
            this._generateButton.enabled = true;
            this._spinner.hidden = true;
            this._status = 'idle';
        }
    }

    private _setStatus(message: string, type: 'success' | 'error' | 'pending') {
        this._statusLabel.text = message;
        this._statusLabel.class.remove('success', 'error', 'pending');
        this._statusLabel.class.add(type);
    }

    show() {
        if (this._overlay) return;

        // Create overlay
        this._overlay = document.createElement('div');
        this._overlay.className = 'pajamadot-modal-overlay';
        this._overlay.addEventListener('click', (e) => {
            if (e.target === this._overlay) {
                this.close();
            }
        });

        // Add modal content
        this._overlay.appendChild(this.dom);
        document.body.appendChild(this._overlay);

        // Add styles
        addAssetGenStyles();

        // Focus prompt input
        this._promptInput?.focus();
    }

    close() {
        if (this._overlay) {
            this._overlay.remove();
            this._overlay = null;
        }
        this.destroy();
    }
}

/**
 * Add styles for the asset generation modal
 */
function addAssetGenStyles(): void {
    const styleId = 'pajamadot-asset-gen-styles';
    if (document.getElementById(styleId)) return;

    const styles = document.createElement('style');
    styles.id = styleId;
    styles.textContent = `
        .pajamadot-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        }

        .pajamadot-asset-gen-modal {
            background: #2a2a2a;
            border-radius: 12px;
            width: 900px;
            max-width: 95vw;
            max-height: 85vh;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        }

        .pajamadot-asset-gen-main {
            display: flex;
            height: 600px;
        }

        .pajamadot-asset-gen-left {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            border-right: 1px solid #3a3a3a;
        }

        .pajamadot-asset-gen-right {
            width: 280px;
            padding: 16px;
            background: #252525;
            overflow-y: auto;
        }

        .pajamadot-asset-gen-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
        }

        .pajamadot-asset-gen-title {
            font-size: 18px;
            font-weight: 600;
            color: #fff;
        }

        .pajamadot-balance-label {
            color: #4a90d9;
            font-weight: 500;
        }

        .pajamadot-tabs {
            display: flex;
            gap: 4px;
            margin-bottom: 16px;
            background: #1a1a1a;
            padding: 4px;
            border-radius: 8px;
        }

        .pajamadot-tab {
            flex: 1;
            text-align: center;
            padding: 8px 12px;
            border-radius: 6px;
            background: transparent;
            border: none;
            color: #888;
            cursor: pointer;
            transition: all 0.2s;
        }

        .pajamadot-tab:hover {
            background: #333;
            color: #fff;
        }

        .pajamadot-tab.active {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #fff;
        }

        .pajamadot-tab-content {
            min-height: 300px;
        }

        .pajamadot-gen-panel {
            padding: 16px 0;
        }

        .pajamadot-prompt-input {
            width: 100%;
            margin: 8px 0 16px 0;
        }

        .pajamadot-options-row {
            display: flex;
            gap: 16px;
            margin-bottom: 16px;
        }

        .pajamadot-option {
            flex: 1;
        }

        .pajamadot-option label {
            display: block;
            margin-bottom: 4px;
            color: #888;
            font-size: 12px;
        }

        .pajamadot-hint {
            font-size: 11px;
            color: #666;
            margin-top: 4px;
        }

        .pajamadot-info-text {
            color: #888;
            font-size: 12px;
            margin: 8px 0;
        }

        .pajamadot-cost-label {
            color: #4caf50;
            font-size: 13px;
            margin-top: 12px;
        }

        .pajamadot-actions {
            margin-top: 20px;
            padding-top: 16px;
            border-top: 1px solid #3a3a3a;
        }

        .pajamadot-status-label {
            margin-bottom: 12px;
            min-height: 20px;
        }

        .pajamadot-status-label.success { color: #4caf50; }
        .pajamadot-status-label.error { color: #f44336; }
        .pajamadot-status-label.pending { color: #ff9800; }

        .pajamadot-button-row {
            display: flex;
            gap: 8px;
            align-items: center;
        }

        .pajamadot-generate-btn {
            flex: 1;
        }

        .pajamadot-btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
        }

        .pajamadot-btn-primary:hover {
            opacity: 0.9;
        }

        .pajamadot-btn-primary:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .pajamadot-btn-secondary {
            background: #444;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
        }

        .pajamadot-btn-secondary:hover {
            background: #555;
        }

        .pajamadot-spinner {
            width: 24px;
            height: 24px;
        }

        .pajamadot-result-preview {
            margin-top: 16px;
            padding: 16px;
            background: #1a1a1a;
            border-radius: 8px;
        }

        .pajamadot-preview-title {
            font-weight: 600;
            margin-bottom: 12px;
        }

        .pajamadot-preview-image {
            max-width: 100%;
            max-height: 200px;
            border-radius: 8px;
            margin-bottom: 12px;
        }

        .pajamadot-preview-actions {
            display: flex;
            gap: 8px;
        }

        .pajamadot-history-header {
            font-weight: 600;
            margin-bottom: 12px;
            color: #fff;
        }

        .pajamadot-history-panel {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .pajamadot-history-empty {
            color: #666;
            text-align: center;
            padding: 20px;
        }

        .pajamadot-history-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px;
            background: #2a2a2a;
            border-radius: 6px;
            transition: background 0.2s;
        }

        .pajamadot-history-item:hover {
            background: #333;
        }

        .pajamadot-history-item.generating {
            border-left: 3px solid #ff9800;
        }

        .pajamadot-history-item.completed {
            border-left: 3px solid #4caf50;
        }

        .pajamadot-history-item.failed {
            border-left: 3px solid #f44336;
        }

        .pajamadot-history-thumbnail {
            width: 40px;
            height: 40px;
            object-fit: cover;
            border-radius: 4px;
        }

        .pajamadot-history-placeholder {
            width: 40px;
            height: 40px;
            background: #1a1a1a;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
        }

        .pajamadot-history-info {
            flex: 1;
            overflow: hidden;
        }

        .pajamadot-history-type {
            font-size: 11px;
            color: #888;
            text-transform: uppercase;
        }

        .pajamadot-history-prompt {
            font-size: 12px;
            color: #ccc;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .pajamadot-history-status {
            font-size: 16px;
        }

        .pajamadot-coming-soon {
            text-align: center;
            padding: 40px 20px;
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
            border-radius: 12px;
            margin-bottom: 20px;
        }

        .pajamadot-coming-soon-icon {
            font-size: 48px;
            margin-bottom: 16px;
        }

        .pajamadot-coming-soon-title {
            font-size: 20px;
            font-weight: 600;
            color: #fff;
            margin-bottom: 8px;
        }

        .pajamadot-coming-soon-desc {
            color: #888;
            line-height: 1.5;
        }

        .pajamadot-preview-label {
            color: #888;
            font-size: 13px;
            margin-bottom: 8px;
        }

        .pajamadot-feature-item {
            color: #666;
            font-size: 12px;
            margin: 4px 0;
        }

        .pajamadot-url-input {
            width: 100%;
            margin: 8px 0;
        }
    `;
    document.head.appendChild(styles);
}

/**
 * Register editor methods for the asset generation modal
 */
function registerAssetGenerationMethods() {
    if (typeof editor === 'undefined') return;

    editor.method('picker:pajamadot:assetgen', () => {
        const modal = new AssetGenerationModal();
        modal.show();
        return modal;
    });

    // Shortcut methods for specific generation types
    editor.method('pajamadot:generate:texture', () => {
        const modal = new AssetGenerationModal();
        modal.show();
        // Tab will be set to texture by default
        return modal;
    });

    editor.method('pajamadot:generate:mesh', () => {
        const modal = new AssetGenerationModal();
        modal['_switchTab']('mesh');
        modal.show();
        return modal;
    });

    editor.method('pajamadot:generate:image', () => {
        const modal = new AssetGenerationModal();
        modal['_switchTab']('image');
        modal.show();
        return modal;
    });
}

// Register when editor is available
if (typeof editor !== 'undefined' && editor) {
    try {
        editor.once('load', registerAssetGenerationMethods);
    } catch (err) {
        console.warn('[PajamaDot] Could not register asset generation methods:', err);
    }
}

export { AssetGenerationModal };

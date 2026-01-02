/**
 * Asset Generation Modal
 * Simplified modal with Image and 3D Model generation tabs
 * 3D Model supports two modes: Image-to-3D (Trellis) and Text-to-3D (Meshy v6)
 * Uses PlayCanvas CSS variables for consistent theming
 */

import { Button, Container, Label, TextAreaInput, SelectInput, SliderInput, BooleanInput, TextInput } from '@playcanvas/pcui';
import { PajamaDotTokenManager } from '../generation/token-manager';
import { generationClient } from '../generation/generation-client';
import { meshClient, type MeshGenerationMode, type MeshGenerationResponse } from '../generation/mesh-client';
import { assetImporter } from '../generation/asset-importer';
import { jobsManager } from '../generation/jobs-manager';
import type { GenerationJob } from '../generation/types';

declare const editor: any;

type GenerationType = 'image' | 'mesh' | 'jobs';

interface GenerationConfig {
    type: GenerationType;
    label: string;
    icon: string;
    description: string;
    costCredits: number | null; // null for jobs tab
}

const GENERATION_TYPES: GenerationConfig[] = [
    {
        type: 'image',
        label: 'Image / Texture',
        icon: '🎨',
        description: 'Generate images, textures, and sprites',
        costCredits: 4
    },
    {
        type: 'mesh',
        label: '3D Model',
        icon: '📦',
        description: 'Generate 3D models from text or image',
        costCredits: 20 // Base cost (image_to_3d)
    },
    {
        type: 'jobs',
        label: 'Active Jobs',
        icon: '⏳',
        description: 'View and manage active generation jobs',
        costCredits: null
    }
];

// Mesh mode configurations
const MESH_MODES = {
    image_to_3d: {
        label: 'Image → 3D',
        description: 'Convert an image to 3D model',
        cost: 20,
        time: '30-60 sec'
    },
    text_to_3d: {
        label: 'Text → 3D',
        description: 'Generate 3D directly from text',
        cost: 30,
        time: '3-10 min'
    }
};

/**
 * Check if result is an async job (needs polling)
 */
function isAsyncJob(result: any): result is MeshGenerationResponse {
    return result && result.requestId &&
           (result.status === 'pending' || result.status === 'in_progress');
}

/**
 * Extract URL from API response
 */
function extractResultUrl(result: any): string | null {
    if (!result) return null;

    // Check if this is an async job - no URL yet
    if (isAsyncJob(result)) {
        return null;
    }

    // Primary: images array (flux models)
    if (result.images?.[0]?.url) {
        return result.images[0].url;
    }

    // Fallback: direct imageUrl property
    if (result.imageUrl) {
        return result.imageUrl;
    }

    // Fallback: mesh url
    if (result.mesh?.url) {
        return result.mesh.url;
    }

    // Fallback: generatedUrl from completed job
    if (result.generatedUrl) {
        return result.generatedUrl;
    }

    console.warn('[AIGC] No URL found in result:', result);
    return null;
}

/**
 * Asset Generation Modal
 */
class AssetGenerationModal {
    private _overlay: HTMLElement | null = null;
    private _modal: HTMLElement | null = null;
    private _currentType: GenerationType = 'image';
    private _currentMeshMode: MeshGenerationMode = 'image_to_3d';
    private _isGenerating: boolean = false;
    private _credits: number = 0;

    // UI Elements
    private _promptInput: TextAreaInput | null = null;
    private _styleSelect: SelectInput | null = null;
    private _aspectSelect: SelectInput | null = null;
    private _generateBtn: Button | null = null;
    private _saveBtn: Button | null = null;
    private _statusLabel: HTMLElement | null = null;
    private _previewContainer: HTMLElement | null = null;
    private _creditsLabel: HTMLElement | null = null;

    // Mesh-specific UI elements
    private _meshModeContainer: HTMLElement | null = null;
    private _imageOptionsContainer: HTMLElement | null = null;
    private _textOptionsContainer: HTMLElement | null = null;
    private _imageUrlInput: TextInput | null = null;
    private _meshArtStyleSelect: SelectInput | null = null;
    private _pbrToggle: BooleanInput | null = null;
    private _polycountSlider: SliderInput | null = null;
    private _topologySelect: SelectInput | null = null;

    // Current generation result
    private _currentResult: { url: string; prompt: string } | null = null;

    // Jobs panel
    private _jobsPanelContainer: HTMLElement | null = null;
    private _jobsListElement: HTMLElement | null = null;
    private _jobsUnsubscribe: (() => void) | null = null;
    private _generationContent: HTMLElement | null = null;

    constructor() {
        this._buildUI();
        this._loadCredits();
    }

    private _buildUI(): void {
        // Create overlay using PCUI overlay pattern
        this._overlay = document.createElement('div');
        this._overlay.className = 'pcui-overlay pajamadot-aigc-overlay';
        this._overlay.addEventListener('click', (e) => {
            if (e.target === this._overlay) {
                this.close();
            }
        });

        // Create modal container
        this._modal = document.createElement('div');
        this._modal.className = 'pcui-overlay-content pajamadot-aigc-modal';
        this._overlay.appendChild(this._modal);

        // Header
        const header = document.createElement('div');
        header.className = 'pajamadot-aigc-header';
        header.innerHTML = `
            <div class="pajamadot-aigc-title">
                <span class="pcui-icon" style="font-size: 16px;">E195</span>
                <span>AI Asset Generator</span>
            </div>
            <div class="pajamadot-aigc-credits">Credits: --</div>
            <button class="pajamadot-aigc-close pcui-button">&times;</button>
        `;
        this._modal.appendChild(header);

        // Credits label reference
        this._creditsLabel = header.querySelector('.pajamadot-aigc-credits');

        // Close button
        header.querySelector('.pajamadot-aigc-close')?.addEventListener('click', () => this.close());

        // Tab navigation
        const tabs = document.createElement('div');
        tabs.className = 'pajamadot-aigc-tabs';

        GENERATION_TYPES.forEach(config => {
            const tab = document.createElement('button');
            tab.className = `pajamadot-aigc-tab ${config.type === this._currentType ? 'active' : ''}`;
            tab.dataset.type = config.type;
            const costText = config.costCredits !== null ? `${config.costCredits}cr` : '';
            tab.innerHTML = `
                <span class="tab-icon">${config.icon}</span>
                <span class="tab-label">${config.label}</span>
                <span class="tab-cost">${costText}</span>
            `;
            tab.addEventListener('click', () => this._switchType(config.type));
            tabs.appendChild(tab);
        });

        this._modal.appendChild(tabs);

        // Content area
        const content = document.createElement('div');
        content.className = 'pajamadot-aigc-content';

        // Prompt section
        const promptSection = document.createElement('div');
        promptSection.className = 'pajamadot-aigc-section';
        promptSection.innerHTML = `<label class="pajamadot-aigc-label">Describe what you want to generate</label>`;

        const promptContainer = new Container({ class: 'pajamadot-aigc-prompt-wrap' });
        this._promptInput = new TextAreaInput({
            placeholder: 'e.g., seamless stone brick wall texture, weathered and mossy...',
            class: 'pajamadot-aigc-prompt',
            rows: 3
        });
        promptContainer.append(this._promptInput);
        promptSection.appendChild(promptContainer.dom);
        content.appendChild(promptSection);

        // Options row
        const optionsRow = document.createElement('div');
        optionsRow.className = 'pajamadot-aigc-options';

        // Style section
        const styleSection = document.createElement('div');
        styleSection.className = 'pajamadot-aigc-section pajamadot-aigc-half';
        styleSection.innerHTML = `<label class="pajamadot-aigc-label">Style</label>`;

        const styleContainer = new Container({ class: 'pajamadot-aigc-select-wrap' });
        this._styleSelect = new SelectInput({
            options: [
                { v: 'realistic', t: 'Realistic' },
                { v: 'stylized', t: 'Stylized' },
                { v: 'pixel', t: 'Pixel Art' },
                { v: 'handpainted', t: 'Hand Painted' },
                { v: 'scifi', t: 'Sci-Fi' },
                { v: 'fantasy', t: 'Fantasy' },
                { v: 'seamless', t: 'Seamless Texture' }
            ],
            value: 'realistic'
        });
        styleContainer.append(this._styleSelect);
        styleSection.appendChild(styleContainer.dom);
        optionsRow.appendChild(styleSection);

        // Aspect ratio section
        const aspectSection = document.createElement('div');
        aspectSection.className = 'pajamadot-aigc-section pajamadot-aigc-half';
        aspectSection.innerHTML = `<label class="pajamadot-aigc-label">Aspect Ratio</label>`;

        const aspectContainer = new Container({ class: 'pajamadot-aigc-select-wrap' });
        this._aspectSelect = new SelectInput({
            options: [
                { v: '1:1', t: '1:1 Square' },
                { v: '16:9', t: '16:9 Wide' },
                { v: '9:16', t: '9:16 Tall' },
                { v: '4:3', t: '4:3' },
                { v: '3:4', t: '3:4' }
            ],
            value: '1:1'
        });
        aspectContainer.append(this._aspectSelect);
        aspectSection.appendChild(aspectContainer.dom);
        optionsRow.appendChild(aspectSection);

        content.appendChild(optionsRow);

        // Mesh mode selector (hidden by default, shown when mesh tab is active)
        this._meshModeContainer = document.createElement('div');
        this._meshModeContainer.className = 'pajamadot-aigc-mesh-modes';
        this._meshModeContainer.style.display = 'none';
        this._meshModeContainer.innerHTML = `
            <label class="pajamadot-aigc-label">Generation Mode</label>
            <div class="pajamadot-mesh-mode-buttons">
                <button class="pajamadot-mesh-mode-btn active" data-mode="image_to_3d">
                    <span class="mode-icon">🖼️</span>
                    <span class="mode-label">Image → 3D</span>
                    <span class="mode-info">20cr • 30-60s</span>
                </button>
                <button class="pajamadot-mesh-mode-btn" data-mode="text_to_3d">
                    <span class="mode-icon">💬</span>
                    <span class="mode-label">Text → 3D</span>
                    <span class="mode-info">30cr • 3-10min</span>
                </button>
            </div>
        `;
        this._meshModeContainer.querySelectorAll('.pajamadot-mesh-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = (btn as HTMLElement).dataset.mode as MeshGenerationMode;
                this._switchMeshMode(mode);
            });
        });
        content.appendChild(this._meshModeContainer);

        // Image-to-3D options (shown when mesh + image_to_3d mode)
        this._imageOptionsContainer = document.createElement('div');
        this._imageOptionsContainer.className = 'pajamadot-aigc-section';
        this._imageOptionsContainer.style.display = 'none';
        this._imageOptionsContainer.innerHTML = `<label class="pajamadot-aigc-label">Source Image URL</label>`;

        const imageUrlContainer = new Container({ class: 'pajamadot-aigc-input-wrap' });
        this._imageUrlInput = new TextInput({
            placeholder: 'https://... or leave empty to generate from prompt above',
            class: 'pajamadot-aigc-url-input'
        });
        imageUrlContainer.append(this._imageUrlInput);
        this._imageOptionsContainer.appendChild(imageUrlContainer.dom);

        const imageHint = document.createElement('div');
        imageHint.className = 'pajamadot-aigc-hint';
        imageHint.textContent = 'Tip: Use a clean image with isolated object on white/transparent background for best results.';
        this._imageOptionsContainer.appendChild(imageHint);
        content.appendChild(this._imageOptionsContainer);

        // Text-to-3D options (shown when mesh + text_to_3d mode)
        this._textOptionsContainer = document.createElement('div');
        this._textOptionsContainer.className = 'pajamadot-aigc-text3d-options';
        this._textOptionsContainer.style.display = 'none';

        // Art style row
        const artStyleSection = document.createElement('div');
        artStyleSection.className = 'pajamadot-aigc-section';
        artStyleSection.innerHTML = `<label class="pajamadot-aigc-label">Art Style</label>`;
        const artStyleContainer = new Container({ class: 'pajamadot-aigc-select-wrap' });
        this._meshArtStyleSelect = new SelectInput({
            options: [
                { v: 'realistic', t: 'Realistic' },
                { v: 'sculpture', t: 'Sculpture' }
            ],
            value: 'realistic'
        });
        artStyleContainer.append(this._meshArtStyleSelect);
        artStyleSection.appendChild(artStyleContainer.dom);
        this._textOptionsContainer.appendChild(artStyleSection);

        // PBR and Topology row
        const meshOptionsRow = document.createElement('div');
        meshOptionsRow.className = 'pajamadot-aigc-options';

        const pbrSection = document.createElement('div');
        pbrSection.className = 'pajamadot-aigc-section pajamadot-aigc-half';
        pbrSection.innerHTML = `<label class="pajamadot-aigc-label">Generate PBR Textures</label>`;
        const pbrContainer = new Container({ class: 'pajamadot-aigc-toggle-wrap' });
        this._pbrToggle = new BooleanInput({ value: false });
        pbrContainer.append(this._pbrToggle);
        pbrSection.appendChild(pbrContainer.dom);
        meshOptionsRow.appendChild(pbrSection);

        const topoSection = document.createElement('div');
        topoSection.className = 'pajamadot-aigc-section pajamadot-aigc-half';
        topoSection.innerHTML = `<label class="pajamadot-aigc-label">Topology</label>`;
        const topoContainer = new Container({ class: 'pajamadot-aigc-select-wrap' });
        this._topologySelect = new SelectInput({
            options: [
                { v: 'triangle', t: 'Triangles' },
                { v: 'quad', t: 'Quads' }
            ],
            value: 'triangle'
        });
        topoContainer.append(this._topologySelect);
        topoSection.appendChild(topoContainer.dom);
        meshOptionsRow.appendChild(topoSection);

        this._textOptionsContainer.appendChild(meshOptionsRow);

        // Polycount slider
        const polycountSection = document.createElement('div');
        polycountSection.className = 'pajamadot-aigc-section';
        polycountSection.innerHTML = `<label class="pajamadot-aigc-label">Target Polycount: <span class="polycount-value">30,000</span></label>`;
        const polycountContainer = new Container({ class: 'pajamadot-aigc-slider-wrap' });
        this._polycountSlider = new SliderInput({
            min: 5000,
            max: 100000,
            step: 5000,
            value: 30000
        });
        this._polycountSlider.on('change', (value: number) => {
            const valueSpan = polycountSection.querySelector('.polycount-value');
            if (valueSpan) valueSpan.textContent = value.toLocaleString();
        });
        polycountContainer.append(this._polycountSlider);
        polycountSection.appendChild(polycountContainer.dom);
        this._textOptionsContainer.appendChild(polycountSection);

        content.appendChild(this._textOptionsContainer);

        // Preview area
        this._previewContainer = document.createElement('div');
        this._previewContainer.className = 'pajamadot-aigc-preview';
        this._previewContainer.innerHTML = `
            <div class="pajamadot-aigc-placeholder">
                <span class="placeholder-icon">🎨</span>
                <span class="placeholder-text">Preview will appear here</span>
            </div>
        `;
        content.appendChild(this._previewContainer);

        // Store reference to generation content for show/hide
        this._generationContent = content;
        this._modal.appendChild(content);

        // Jobs panel (hidden by default)
        this._jobsPanelContainer = document.createElement('div');
        this._jobsPanelContainer.className = 'pajamadot-aigc-jobs-panel';
        this._jobsPanelContainer.style.display = 'none';
        this._jobsPanelContainer.innerHTML = `
            <div class="pajamadot-jobs-header">
                <span class="jobs-title">Active Generation Jobs</span>
                <button class="pajamadot-jobs-refresh pcui-button">Refresh</button>
            </div>
            <div class="pajamadot-jobs-list"></div>
            <div class="pajamadot-jobs-footer">
                <button class="pajamadot-jobs-clear pcui-button">Clear Completed</button>
            </div>
        `;
        this._jobsListElement = this._jobsPanelContainer.querySelector('.pajamadot-jobs-list');

        // Wire up jobs panel buttons
        this._jobsPanelContainer.querySelector('.pajamadot-jobs-refresh')?.addEventListener('click', () => {
            this._refreshJobsList();
        });
        this._jobsPanelContainer.querySelector('.pajamadot-jobs-clear')?.addEventListener('click', () => {
            this._clearCompletedJobs();
        });

        this._modal.appendChild(this._jobsPanelContainer);

        // Subscribe to job events
        // NOTE: Auto-import of mesh/3d_model jobs is handled globally by jobs-manager
        this._jobsUnsubscribe = jobsManager.on((event) => {
            if (this._currentType === 'jobs') {
                this._refreshJobsList();
            }
            // Update jobs tab indicator
            this._updateJobsTabIndicator();
        });

        // Footer
        const footer = document.createElement('div');
        footer.className = 'pajamadot-aigc-footer';

        // Status
        this._statusLabel = document.createElement('div');
        this._statusLabel.className = 'pajamadot-aigc-status';
        footer.appendChild(this._statusLabel);

        // Buttons
        const buttons = document.createElement('div');
        buttons.className = 'pajamadot-aigc-buttons';

        const cancelBtn = new Button({
            text: 'Close',
            class: 'pajamadot-aigc-btn-cancel'
        });
        cancelBtn.on('click', () => this.close());
        buttons.appendChild(cancelBtn.dom);

        this._saveBtn = new Button({
            text: 'Save to Assets',
            class: 'pajamadot-aigc-btn-save'
        });
        this._saveBtn.enabled = false;
        this._saveBtn.on('click', () => this._handleSave());
        buttons.appendChild(this._saveBtn.dom);

        this._generateBtn = new Button({
            text: 'Generate',
            class: 'pajamadot-aigc-btn-generate'
        });
        this._generateBtn.on('click', () => this._handleGenerate());
        buttons.appendChild(this._generateBtn.dom);

        footer.appendChild(buttons);
        this._modal.appendChild(footer);

        // Add styles
        this._addStyles();
    }

    private _switchType(type: GenerationType): void {
        this._currentType = type;

        // Update tab states
        this._modal?.querySelectorAll('.pajamadot-aigc-tab').forEach(tab => {
            const tabEl = tab as HTMLElement;
            if (tabEl.dataset.type === type) {
                tabEl.classList.add('active');
            } else {
                tabEl.classList.remove('active');
            }
        });

        // Handle jobs panel visibility
        if (type === 'jobs') {
            // Show jobs panel, hide generation content and footer buttons
            if (this._generationContent) this._generationContent.style.display = 'none';
            if (this._jobsPanelContainer) this._jobsPanelContainer.style.display = 'block';
            if (this._generateBtn) this._generateBtn.dom.style.display = 'none';
            if (this._saveBtn) this._saveBtn.dom.style.display = 'none';
            this._refreshJobsList();
            return;
        }

        // Show generation content, hide jobs panel
        if (this._generationContent) this._generationContent.style.display = 'block';
        if (this._jobsPanelContainer) this._jobsPanelContainer.style.display = 'none';
        if (this._generateBtn) this._generateBtn.dom.style.display = 'inline-block';
        if (this._saveBtn) this._saveBtn.dom.style.display = 'inline-block';

        // Update placeholder text
        if (this._promptInput) {
            const placeholders: Record<string, string> = {
                image: 'e.g., seamless stone brick texture, fantasy sword icon, game UI button...',
                mesh: 'e.g., low-poly medieval castle tower, sci-fi spaceship, treasure chest...'
            };
            this._promptInput.placeholder = placeholders[type] || '';
        }

        // Show/hide mesh-specific UI
        if (type === 'mesh') {
            if (this._meshModeContainer) this._meshModeContainer.style.display = 'block';
            this._updateMeshModeUI();
        } else {
            if (this._meshModeContainer) this._meshModeContainer.style.display = 'none';
            if (this._imageOptionsContainer) this._imageOptionsContainer.style.display = 'none';
            if (this._textOptionsContainer) this._textOptionsContainer.style.display = 'none';
        }

        // Reset result
        this._currentResult = null;
        if (this._saveBtn) {
            this._saveBtn.enabled = false;
        }
    }

    private _switchMeshMode(mode: MeshGenerationMode): void {
        this._currentMeshMode = mode;

        // Update mode button states
        this._meshModeContainer?.querySelectorAll('.pajamadot-mesh-mode-btn').forEach(btn => {
            const btnEl = btn as HTMLElement;
            if (btnEl.dataset.mode === mode) {
                btnEl.classList.add('active');
            } else {
                btnEl.classList.remove('active');
            }
        });

        // Update tab cost display
        const meshTab = this._modal?.querySelector('.pajamadot-aigc-tab[data-type="mesh"] .tab-cost');
        if (meshTab) {
            const cost = mode === 'text_to_3d' ? 30 : 20;
            meshTab.textContent = `${cost}cr`;
        }

        this._updateMeshModeUI();
    }

    private _updateMeshModeUI(): void {
        const isTextMode = this._currentMeshMode === 'text_to_3d';

        // Show/hide appropriate options
        if (this._imageOptionsContainer) {
            this._imageOptionsContainer.style.display = isTextMode ? 'none' : 'block';
        }
        if (this._textOptionsContainer) {
            this._textOptionsContainer.style.display = isTextMode ? 'block' : 'none';
        }

        // Update prompt label based on mode
        const promptLabel = this._modal?.querySelector('.pajamadot-aigc-content .pajamadot-aigc-label');
        if (promptLabel) {
            promptLabel.textContent = isTextMode
                ? 'Describe the 3D model'
                : 'Describe the object (for reference image)';
        }
    }

    private async _loadCredits(): Promise<void> {
        if (!PajamaDotTokenManager.hasToken()) {
            if (this._creditsLabel) {
                this._creditsLabel.textContent = 'Credits: Sign in';
            }
            return;
        }

        try {
            const credits = await generationClient.getCredits();
            this._credits = credits.balance;
            if (this._creditsLabel) {
                this._creditsLabel.textContent = `Credits: ${credits.balance}`;
            }
        } catch (error) {
            if (this._creditsLabel) {
                this._creditsLabel.textContent = 'Credits: --';
            }
        }
    }

    private async _handleGenerate(): Promise<void> {
        if (this._isGenerating) return;

        const prompt = this._promptInput?.value?.trim();
        if (!prompt) {
            this._setStatus('Please enter a description', 'error');
            return;
        }

        if (!PajamaDotTokenManager.hasToken()) {
            editor.call('picker:pajamadot:token');
            return;
        }

        this._isGenerating = true;
        this._currentResult = null;
        if (this._saveBtn) this._saveBtn.enabled = false;

        this._setStatus('Generating...', 'loading');
        if (this._generateBtn) {
            this._generateBtn.enabled = false;
            this._generateBtn.text = 'Generating...';
        }

        // Show loading in preview
        if (this._previewContainer) {
            this._previewContainer.innerHTML = `
                <div class="pajamadot-aigc-placeholder">
                    <div class="pajamadot-spinner"></div>
                    <span class="placeholder-text">Generating...</span>
                </div>
            `;
        }

        try {
            const style = this._styleSelect?.value || 'realistic';
            const aspect = this._aspectSelect?.value || '1:1';
            let result: any;

            switch (this._currentType) {
                case 'image':
                    result = await this._generateImage(prompt, style, aspect);
                    break;
                case 'mesh':
                    result = await this._generateMesh(prompt, style);
                    break;
            }

            // Check if this is an async job that needs tracking
            if (isAsyncJob(result)) {
                // Add job to jobs manager for tracking
                const job: GenerationJob = {
                    requestId: result.requestId,
                    endpointId: result.mode === 'text_to_3d' ? 'fal-ai/meshy/v6-preview/text-to-3d' : 'fal-ai/trellis',
                    mediaType: 'mesh',
                    status: result.status || 'pending',
                    progress: result.progress || 0,
                    createdAt: Date.now(),
                    creditsCost: result.creditsCost,
                    input: { prompt }
                };
                jobsManager.addJob(job);

                // Show async job message and update UI
                this._showAsyncJobStarted(result.requestId);
                this._setStatus('🚀 3D generation started! Track progress in Active Jobs panel.', 'success');

                // Try to show the active jobs modal/panel
                try {
                    editor.call('picker:pajamadot:activejobs');
                } catch (e) {
                    // Modal might not be registered yet
                    console.log('[AIGC] Active jobs modal not available');
                }
            } else {
                // Synchronous result - extract URL immediately
                const resultUrl = extractResultUrl(result);
                if (resultUrl) {
                    this._currentResult = { url: resultUrl, prompt };
                    this._showPreview(resultUrl);
                    this._setStatus('✓ Generated! Click "Save to Assets" to import.', 'success');
                    if (this._saveBtn) this._saveBtn.enabled = true;
                } else {
                    console.error('[AIGC] Could not extract URL from result:', result);
                    throw new Error('No result URL returned - check console for API response details');
                }
            }

        } catch (error) {
            console.error('[AIGC] Generation error:', error);
            this._setStatus(`Error: ${error}`, 'error');
            this._showPreviewPlaceholder();
        } finally {
            this._isGenerating = false;
            if (this._generateBtn) {
                this._generateBtn.enabled = true;
                this._generateBtn.text = 'Generate';
            }
            this._loadCredits();
        }
    }

    private async _handleSave(): Promise<void> {
        if (!this._currentResult) return;

        this._setStatus('Saving to assets...', 'loading');
        if (this._saveBtn) this._saveBtn.enabled = false;

        try {
            await this._importToPlayCanvas(this._currentResult.url, this._currentResult.prompt);
            this._setStatus('✓ Saved to AIGC Generated folder!', 'success');
        } catch (error) {
            console.error('[AIGC] Save error:', error);
            this._setStatus(`Save failed: ${error}`, 'error');
            if (this._saveBtn) this._saveBtn.enabled = true;
        }
    }

    private async _generateImage(prompt: string, style: string, aspect: string): Promise<any> {
        let fullPrompt = prompt;

        // Add style modifiers
        if (style === 'seamless') {
            fullPrompt = `seamless tileable texture, ${prompt}, high quality, 4k`;
        } else if (style !== 'realistic') {
            fullPrompt = `${style} style, ${prompt}, high quality, detailed`;
        } else {
            fullPrompt = `${prompt}, photorealistic, high quality, detailed`;
        }

        return await generationClient.generateImage({
            prompt: fullPrompt,
            aspectRatio: aspect,
            model: 'flux-schnell'
        });
    }

    private async _generateMesh(prompt: string, style: string): Promise<MeshGenerationResponse | any> {
        if (this._currentMeshMode === 'text_to_3d') {
            // Direct text-to-3D using Meshy v6 (async job)
            this._setStatus('Starting 3D generation (3-10 min)...', 'loading');

            const result = await meshClient.generateFromText(
                {
                    prompt: prompt,
                    artStyle: (this._meshArtStyleSelect?.value as 'realistic' | 'sculpture') || 'realistic',
                    enablePbr: this._pbrToggle?.value || false,
                    targetPolycount: this._polycountSlider?.value || 30000,
                    topology: (this._topologySelect?.value as 'quad' | 'triangle') || 'triangle'
                },
                (progress, message) => {
                    this._setStatus(message, 'loading');
                }
            );

            // Return result directly - modal handles async vs sync
            return result;
        } else {
            // Image-to-3D: either use provided URL or generate reference image first
            const imageUrl = this._imageUrlInput?.value?.trim();

            if (imageUrl) {
                // Use provided image URL directly (async job)
                this._setStatus('Starting image-to-3D conversion...', 'loading');

                const result = await meshClient.generateFromImage(
                    {
                        imageUrl: imageUrl,
                        meshSimplify: 0.95,
                        textureResolution: 1024
                    },
                    (progress, message) => {
                        this._setStatus(message, 'loading');
                    }
                );

                // Return result directly - modal handles async vs sync
                return result;
            } else {
                // Generate reference image first, then convert to 3D (two-step)
                const result = await meshClient.generateMeshFromPrompt(
                    prompt,
                    {
                        style: style,
                        meshSimplify: 0.95,
                        textureResolution: 1024
                    },
                    (stage, progress) => {
                        if (stage === 'image') {
                            this._setStatus('Generating reference image...', 'loading');
                        } else {
                            this._setStatus('Starting 3D conversion...', 'loading');
                        }
                    }
                );

                // Return result directly - modal handles async vs sync
                return result;
            }
        }
    }

    private _showPreview(url: string): void {
        if (!this._previewContainer) return;

        this._previewContainer.innerHTML = `
            <img src="${url}" alt="Generated preview" class="pajamadot-preview-image" />
        `;
    }

    private _showPreviewPlaceholder(): void {
        if (!this._previewContainer) return;

        this._previewContainer.innerHTML = `
            <div class="pajamadot-aigc-placeholder">
                <span class="placeholder-icon">🎨</span>
                <span class="placeholder-text">Preview will appear here</span>
            </div>
        `;
    }

    /**
     * Show UI for async job that was started
     */
    private _showAsyncJobStarted(requestId: string): void {
        if (!this._previewContainer) return;

        this._previewContainer.innerHTML = `
            <div class="pajamadot-aigc-placeholder pajamadot-async-job">
                <span class="placeholder-icon">📦</span>
                <span class="placeholder-text">3D Model Generation Started</span>
                <span class="placeholder-subtext">This takes 3-10 minutes. Track progress in the Active Jobs panel.</span>
                <span class="placeholder-id">Job ID: ${requestId.slice(0, 8)}...</span>
            </div>
        `;
    }

    private async _importToPlayCanvas(url: string, prompt: string): Promise<void> {
        try {
            // Get or create AIGC folder
            const folder = await assetImporter.getOrCreateAIGCFolder();

            // Generate asset name from prompt
            const baseName = prompt
                .slice(0, 30)
                .replace(/[^a-zA-Z0-9 ]/g, '')
                .trim()
                .replace(/\s+/g, '_') || 'generated';

            const timestamp = Date.now().toString(36);
            const assetName = `${baseName}_${timestamp}`;

            let result;

            if (this._currentType === 'mesh') {
                // Import as 3D model
                result = await assetImporter.importModelFromUrl(url, assetName, {
                    folder: folder,
                    tags: ['aigc', 'mesh', '3d-model']
                });
            } else {
                // Import as texture
                result = await assetImporter.importTextureFromUrl(url, assetName, {
                    folder: folder,
                    tags: ['aigc', 'image', 'texture']
                });
            }

            if (result.success && result.asset) {
                // Add AIGC metadata
                assetImporter.addAIGCMetadata(result.asset, {
                    prompt: prompt,
                    model: 'flux-schnell',
                    generatedAt: new Date()
                });

                // Select the new asset in the editor
                editor.call('selector:set', 'asset', [result.asset]);

                console.log('[AIGC] Asset imported:', assetName, result.assetId);
            } else {
                throw new Error(result.error || 'Import failed');
            }
        } catch (error) {
            console.error('[AIGC] Import error:', error);
            throw error;
        }
    }

    private _setStatus(message: string, type: 'success' | 'error' | 'loading' | '' = ''): void {
        if (!this._statusLabel) return;

        this._statusLabel.textContent = message;
        this._statusLabel.className = 'pajamadot-aigc-status';
        if (type) {
            this._statusLabel.classList.add(`pajamadot-status-${type}`);
        }
    }

    // ---- Jobs Panel Methods ----

    private _refreshJobsList(): void {
        if (!this._jobsListElement) return;

        const jobs = jobsManager.getActiveJobs();

        if (jobs.length === 0) {
            this._jobsListElement.innerHTML = `
                <div class="pajamadot-jobs-empty">
                    <span class="empty-icon">✨</span>
                    <span class="empty-text">No active generation jobs</span>
                    <span class="empty-subtext">Start generating to see jobs here</span>
                </div>
            `;
            return;
        }

        this._jobsListElement.innerHTML = '';
        jobs.forEach(job => {
            const jobEl = this._createJobElement(job);
            this._jobsListElement!.appendChild(jobEl);
        });
    }

    private _createJobElement(job: GenerationJob): HTMLElement {
        const jobEl = document.createElement('div');
        jobEl.className = `pajamadot-job-item pajamadot-job-${job.status}`;
        jobEl.dataset.jobId = job.requestId;

        const statusEmoji = this._getStatusEmoji(job.status);
        const statusColor = this._getStatusColor(job.status);
        const typeLabel = this._getJobTypeLabel(job);
        const promptText = (job.input?.prompt || 'Unknown').slice(0, 50);

        jobEl.innerHTML = `
            <div class="job-header">
                <span class="job-type">${typeLabel}</span>
                <span class="job-status" style="color: ${statusColor}">${statusEmoji} ${job.status}</span>
            </div>
            <div class="job-prompt">${promptText}${promptText.length < (job.input?.prompt?.length || 0) ? '...' : ''}</div>
            ${job.status === 'pending' || job.status === 'in_progress' ? `
                <div class="job-progress">
                    <div class="job-progress-bar" style="width: ${job.progress || 0}%"></div>
                </div>
            ` : ''}
            ${job.status === 'failed' && job.errorMessage ? `
                <div class="job-error">⚠️ ${job.errorMessage}</div>
            ` : ''}
            <div class="job-actions">
                ${job.status === 'completed' && job.generatedUrl ? `
                    <button class="job-import-btn pcui-button">Import to Assets</button>
                ` : ''}
                <button class="job-remove-btn pcui-button">Remove</button>
            </div>
        `;

        // Wire up buttons
        jobEl.querySelector('.job-import-btn')?.addEventListener('click', () => {
            this._importJob(job);
        });
        jobEl.querySelector('.job-remove-btn')?.addEventListener('click', () => {
            jobsManager.removeJob(job.requestId);
            this._refreshJobsList();
        });

        return jobEl;
    }

    private _getStatusEmoji(status: string): string {
        switch (status) {
            case 'pending': return '⏳';
            case 'in_progress': return '🔄';
            case 'completed': return '✅';
            case 'failed': return '❌';
            default: return '❓';
        }
    }

    private _getStatusColor(status: string): string {
        switch (status) {
            case 'pending': return '#f59e0b';
            case 'in_progress': return '#3b82f6';
            case 'completed': return '#22c55e';
            case 'failed': return '#ef4444';
            default: return '#888';
        }
    }

    private _getJobTypeLabel(job: GenerationJob): string {
        if (job.endpointId?.includes('meshy')) {
            return '📦 Text-to-3D';
        } else if (job.endpointId?.includes('trellis')) {
            return '📦 Image-to-3D';
        } else if (job.mediaType === 'mesh' || job.mediaType === '3d_model') {
            return '📦 3D Model';
        } else if (job.mediaType === 'image') {
            return '🎨 Image';
        }
        return '⚡ Generation';
    }

    private async _importJob(job: GenerationJob): Promise<void> {
        if (!job.generatedUrl) return;

        try {
            const folder = await assetImporter.getOrCreateAIGCFolder();
            const prompt = String(job.input?.prompt || 'generated');
            const baseName = prompt
                .slice(0, 30)
                .replace(/[^a-zA-Z0-9 ]/g, '')
                .trim()
                .replace(/\s+/g, '_') || 'generated';

            const timestamp = Date.now().toString(36);
            const assetName = `${baseName}_${timestamp}`;

            let result;
            if (job.mediaType === 'mesh' || job.mediaType === '3d_model') {
                result = await assetImporter.importModelFromUrl(job.generatedUrl, assetName, {
                    folder: folder,
                    tags: ['aigc', 'mesh', '3d-model']
                });
            } else {
                result = await assetImporter.importTextureFromUrl(job.generatedUrl, assetName, {
                    folder: folder,
                    tags: ['aigc', 'image']
                });
            }

            if (result.success) {
                console.log('[AIGC] Imported job asset:', assetName);
                this._setStatus(`✓ Imported: ${assetName}`, 'success');
                jobsManager.removeJob(job.requestId);
                this._refreshJobsList();
            }
        } catch (error) {
            console.error('[AIGC] Failed to import job:', error);
            this._setStatus(`Import failed: ${error}`, 'error');
        }
    }

    private _clearCompletedJobs(): void {
        const jobs = jobsManager.getActiveJobs();
        jobs.forEach(job => {
            if (job.status === 'completed' || job.status === 'failed') {
                jobsManager.removeJob(job.requestId);
            }
        });
        this._refreshJobsList();
    }

    private _updateJobsTabIndicator(): void {
        const jobsTab = this._modal?.querySelector('.pajamadot-aigc-tab[data-type="jobs"]');
        if (!jobsTab) return;

        const activeCount = jobsManager.getActiveCount();
        const costSpan = jobsTab.querySelector('.tab-cost');
        if (costSpan) {
            if (activeCount > 0) {
                costSpan.textContent = `${activeCount}`;
                costSpan.classList.add('has-jobs');
            } else {
                costSpan.textContent = '';
                costSpan.classList.remove('has-jobs');
            }
        }
    }

    show(): void {
        if (this._overlay) {
            document.body.appendChild(this._overlay);
            this._loadCredits();
            this._updateJobsTabIndicator();
            this._promptInput?.focus();
        }
    }

    close(): void {
        if (this._overlay && this._overlay.parentNode) {
            this._overlay.parentNode.removeChild(this._overlay);
        }
    }

    destroy(): void {
        // Unsubscribe from job events
        if (this._jobsUnsubscribe) {
            this._jobsUnsubscribe();
            this._jobsUnsubscribe = null;
        }
        this.close();
    }

    private _addStyles(): void {
        const styleId = 'pajamadot-aigc-modal-styles';
        if (document.getElementById(styleId)) return;

        const styles = document.createElement('style');
        styles.id = styleId;
        styles.textContent = `
            /* Use PlayCanvas CSS variables for consistent theming */
            .pajamadot-aigc-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.75);
                backdrop-filter: blur(4px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            }

            .pajamadot-aigc-modal {
                background: var(--color-bg, #1e1e1e);
                border-radius: 8px;
                width: 520px;
                max-width: 90vw;
                max-height: 90vh;
                overflow: hidden;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
                border: 1px solid var(--color-divider, #3a3a3a);
                display: flex;
                flex-direction: column;
            }

            .pajamadot-aigc-header {
                display: flex;
                align-items: center;
                padding: 12px 16px;
                border-bottom: 1px solid var(--color-divider, #3a3a3a);
                background: var(--color-bg-darker, #1a1a1a);
            }

            .pajamadot-aigc-title {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
                font-weight: 600;
                color: var(--color-text, #fff);
            }

            .pajamadot-aigc-credits {
                margin-left: auto;
                padding: 4px 10px;
                background: var(--color-primary-alpha, rgba(168, 85, 247, 0.15));
                border-radius: 10px;
                font-size: 11px;
                color: var(--color-primary, #a855f7);
                font-weight: 500;
            }

            .pajamadot-aigc-close {
                margin-left: 10px;
                background: transparent;
                border: none;
                color: var(--color-text-secondary, #888);
                font-size: 20px;
                cursor: pointer;
                padding: 0;
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
                transition: all 0.15s;
            }

            .pajamadot-aigc-close:hover {
                background: var(--color-bg-hover, rgba(255, 255, 255, 0.1));
                color: var(--color-text, #fff);
            }

            .pajamadot-aigc-tabs {
                display: flex;
                padding: 10px 16px;
                gap: 10px;
                border-bottom: 1px solid var(--color-divider, #3a3a3a);
                background: var(--color-bg-darker, #1a1a1a);
            }

            .pajamadot-aigc-tab {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 12px 10px;
                background: var(--color-bg, #1e1e1e);
                border: 1px solid var(--color-divider, #3a3a3a);
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.15s;
                color: var(--color-text-secondary, #888);
            }

            .pajamadot-aigc-tab:hover {
                background: var(--color-bg-hover, #2a2a2a);
                border-color: var(--color-border-hover, #4a4a4a);
            }

            .pajamadot-aigc-tab.active {
                background: var(--color-primary-alpha, rgba(168, 85, 247, 0.15));
                border-color: var(--color-primary, #a855f7);
                color: var(--color-text, #fff);
            }

            .pajamadot-aigc-tab .tab-icon {
                font-size: 24px;
                margin-bottom: 4px;
            }

            .pajamadot-aigc-tab .tab-label {
                font-size: 12px;
                font-weight: 500;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                max-width: 100%;
            }

            .pajamadot-aigc-tab .tab-cost {
                font-size: 10px;
                color: var(--color-text-secondary, #666);
                margin-top: 2px;
            }

            .pajamadot-aigc-tab.active .tab-cost {
                color: var(--color-primary, #a855f7);
            }

            .pajamadot-aigc-content {
                padding: 16px;
                overflow-y: auto;
                flex: 1;
            }

            .pajamadot-aigc-section {
                margin-bottom: 14px;
            }

            .pajamadot-aigc-options {
                display: flex;
                gap: 12px;
            }

            .pajamadot-aigc-half {
                flex: 1;
            }

            .pajamadot-aigc-label {
                display: block;
                margin-bottom: 6px;
                font-size: 11px;
                font-weight: 500;
                color: var(--color-text-secondary, #aaa);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .pajamadot-aigc-prompt-wrap,
            .pajamadot-aigc-select-wrap {
                width: 100%;
            }

            .pajamadot-aigc-prompt {
                width: 100%;
            }

            .pajamadot-aigc-prompt textarea {
                background: var(--color-bg-darkest, #141414) !important;
                border: 1px solid var(--color-divider, #3a3a3a) !important;
                border-radius: 4px !important;
                padding: 10px !important;
                color: var(--color-text, #fff) !important;
                font-size: 12px !important;
                resize: none !important;
                width: 100% !important;
                box-sizing: border-box !important;
                min-height: 72px !important;
            }

            .pajamadot-aigc-prompt textarea:focus {
                border-color: var(--color-primary, #a855f7) !important;
                outline: none !important;
            }

            .pajamadot-aigc-prompt textarea::placeholder {
                color: var(--color-text-secondary, #666) !important;
            }

            .pajamadot-aigc-select-wrap .pcui-select-input {
                width: 100%;
                background: var(--color-bg-darkest, #141414);
            }

            .pajamadot-aigc-preview {
                background: var(--color-bg-darkest, #141414);
                border: 1px solid var(--color-divider, #3a3a3a);
                border-radius: 4px;
                min-height: 160px;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
            }

            .pajamadot-aigc-placeholder {
                display: flex;
                flex-direction: column;
                align-items: center;
                color: var(--color-text-secondary, #555);
            }

            .pajamadot-aigc-placeholder .placeholder-icon {
                font-size: 40px;
                margin-bottom: 10px;
                opacity: 0.4;
            }

            .pajamadot-aigc-placeholder .placeholder-text {
                font-size: 12px;
            }

            .pajamadot-aigc-preview .pajamadot-preview-image {
                max-width: 100%;
                max-height: 220px;
                border-radius: 2px;
            }

            .pajamadot-spinner {
                width: 32px;
                height: 32px;
                border: 3px solid var(--color-divider, #3a3a3a);
                border-top-color: var(--color-primary, #a855f7);
                border-radius: 50%;
                animation: pajamadot-spin 0.8s linear infinite;
                margin-bottom: 10px;
            }

            @keyframes pajamadot-spin {
                to { transform: rotate(360deg); }
            }

            .pajamadot-aigc-footer {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px 16px;
                border-top: 1px solid var(--color-divider, #3a3a3a);
                background: var(--color-bg-darker, #1a1a1a);
                gap: 12px;
                flex-wrap: wrap;
            }

            .pajamadot-aigc-status {
                font-size: 11px;
                color: var(--color-text-secondary, #888);
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                max-width: 50%;
            }

            .pajamadot-aigc-status.pajamadot-status-success {
                color: #22c55e;
            }

            .pajamadot-aigc-status.pajamadot-status-error {
                color: var(--color-error, #ef4444);
            }

            .pajamadot-aigc-status.pajamadot-status-loading {
                color: var(--color-primary, #a855f7);
            }

            .pajamadot-aigc-buttons {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
                flex-shrink: 0;
            }

            .pajamadot-aigc-btn-generate {
                background: linear-gradient(135deg, #a855f7, #6366f1) !important;
                color: #fff !important;
                border: none !important;
                padding: 8px 16px !important;
                border-radius: 4px !important;
                font-size: 12px !important;
                font-weight: 500 !important;
                cursor: pointer !important;
                transition: all 0.15s !important;
            }

            .pajamadot-aigc-btn-generate:hover:not(:disabled) {
                background: linear-gradient(135deg, #9333ea, #4f46e5) !important;
            }

            .pajamadot-aigc-btn-generate:disabled {
                opacity: 0.5 !important;
                cursor: not-allowed !important;
            }

            .pajamadot-aigc-btn-save {
                background: #22c55e !important;
                color: #fff !important;
                border: none !important;
                padding: 8px 14px !important;
                border-radius: 4px !important;
                font-size: 12px !important;
                font-weight: 500 !important;
                cursor: pointer !important;
                transition: all 0.15s !important;
            }

            .pajamadot-aigc-btn-save:hover:not(:disabled) {
                background: #16a34a !important;
            }

            .pajamadot-aigc-btn-save:disabled {
                opacity: 0.4 !important;
                cursor: not-allowed !important;
            }

            .pajamadot-aigc-btn-cancel {
                background: var(--color-bg, #1e1e1e) !important;
                color: var(--color-text-secondary, #aaa) !important;
                border: 1px solid var(--color-divider, #3a3a3a) !important;
                padding: 8px 14px !important;
                border-radius: 4px !important;
                font-size: 12px !important;
                cursor: pointer !important;
                transition: all 0.15s !important;
            }

            .pajamadot-aigc-btn-cancel:hover {
                background: var(--color-bg-hover, #2a2a2a) !important;
                color: var(--color-text, #fff) !important;
            }

            /* Mesh Mode Selector */
            .pajamadot-aigc-mesh-modes {
                margin-bottom: 14px;
            }

            .pajamadot-mesh-mode-buttons {
                display: flex;
                gap: 10px;
            }

            .pajamadot-mesh-mode-btn {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 12px 10px;
                background: var(--color-bg-darkest, #141414);
                border: 1px solid var(--color-divider, #3a3a3a);
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.15s;
                color: var(--color-text-secondary, #888);
            }

            .pajamadot-mesh-mode-btn:hover {
                background: var(--color-bg-hover, #2a2a2a);
                border-color: var(--color-border-hover, #4a4a4a);
            }

            .pajamadot-mesh-mode-btn.active {
                background: var(--color-primary-alpha, rgba(168, 85, 247, 0.15));
                border-color: var(--color-primary, #a855f7);
                color: var(--color-text, #fff);
            }

            .pajamadot-mesh-mode-btn .mode-icon {
                font-size: 20px;
                margin-bottom: 4px;
            }

            .pajamadot-mesh-mode-btn .mode-label {
                font-size: 12px;
                font-weight: 500;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                max-width: 100%;
            }

            .pajamadot-mesh-mode-btn .mode-info {
                font-size: 10px;
                color: var(--color-text-secondary, #666);
                margin-top: 2px;
            }

            .pajamadot-mesh-mode-btn.active .mode-info {
                color: var(--color-primary, #a855f7);
            }

            /* Image URL input */
            .pajamadot-aigc-input-wrap {
                width: 100%;
            }

            .pajamadot-aigc-url-input {
                width: 100%;
            }

            .pajamadot-aigc-url-input input {
                background: var(--color-bg-darkest, #141414) !important;
                border: 1px solid var(--color-divider, #3a3a3a) !important;
                border-radius: 4px !important;
                padding: 8px 10px !important;
                color: var(--color-text, #fff) !important;
                font-size: 12px !important;
                width: 100% !important;
                box-sizing: border-box !important;
            }

            .pajamadot-aigc-url-input input:focus {
                border-color: var(--color-primary, #a855f7) !important;
                outline: none !important;
            }

            .pajamadot-aigc-url-input input::placeholder {
                color: var(--color-text-secondary, #666) !important;
            }

            /* Hint text */
            .pajamadot-aigc-hint {
                font-size: 10px;
                color: var(--color-text-secondary, #666);
                margin-top: 6px;
                font-style: italic;
            }

            /* Text-to-3D options container */
            .pajamadot-aigc-text3d-options {
                margin-bottom: 14px;
            }

            /* Toggle wrap */
            .pajamadot-aigc-toggle-wrap {
                display: flex;
                align-items: center;
            }

            /* Slider wrap */
            .pajamadot-aigc-slider-wrap {
                width: 100%;
            }

            .pajamadot-aigc-slider-wrap .pcui-slider-input {
                width: 100%;
            }

            .pajamadot-aigc-label .polycount-value {
                color: var(--color-primary, #a855f7);
                font-weight: 600;
            }

            /* Async job started UI */
            .pajamadot-async-job {
                background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1));
                border: 1px dashed var(--color-primary, #a855f7);
                border-radius: 8px;
                padding: 20px;
                text-align: center;
            }

            .pajamadot-async-job .placeholder-icon {
                font-size: 48px;
                margin-bottom: 12px;
                opacity: 1;
            }

            .pajamadot-async-job .placeholder-text {
                font-size: 14px;
                font-weight: 600;
                color: var(--color-text, #fff);
                margin-bottom: 8px;
                display: block;
            }

            .pajamadot-async-job .placeholder-subtext {
                font-size: 12px;
                color: var(--color-text-secondary, #888);
                display: block;
                margin-bottom: 12px;
            }

            .pajamadot-async-job .placeholder-id {
                font-size: 10px;
                color: var(--color-text-secondary, #666);
                font-family: monospace;
                background: var(--color-bg-darkest, #141414);
                padding: 4px 8px;
                border-radius: 4px;
            }

            /* Jobs Panel Styles */
            .pajamadot-aigc-jobs-panel {
                padding: 16px;
                overflow-y: auto;
                flex: 1;
                display: flex;
                flex-direction: column;
            }

            .pajamadot-jobs-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }

            .pajamadot-jobs-header .jobs-title {
                font-size: 13px;
                font-weight: 600;
                color: var(--color-text, #fff);
            }

            .pajamadot-jobs-refresh {
                font-size: 11px !important;
                padding: 4px 10px !important;
                background: var(--color-bg, #1e1e1e) !important;
                border: 1px solid var(--color-divider, #3a3a3a) !important;
                color: var(--color-text-secondary, #888) !important;
            }

            .pajamadot-jobs-refresh:hover {
                background: var(--color-bg-hover, #2a2a2a) !important;
                color: var(--color-text, #fff) !important;
            }

            .pajamadot-jobs-list {
                flex: 1;
                overflow-y: auto;
                min-height: 200px;
                max-height: 350px;
            }

            .pajamadot-jobs-empty {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 40px 20px;
                text-align: center;
            }

            .pajamadot-jobs-empty .empty-icon {
                font-size: 40px;
                margin-bottom: 12px;
                opacity: 0.5;
            }

            .pajamadot-jobs-empty .empty-text {
                font-size: 14px;
                color: var(--color-text-secondary, #888);
                margin-bottom: 4px;
            }

            .pajamadot-jobs-empty .empty-subtext {
                font-size: 11px;
                color: var(--color-text-secondary, #666);
            }

            .pajamadot-job-item {
                background: var(--color-bg-darkest, #141414);
                border: 1px solid var(--color-divider, #3a3a3a);
                border-radius: 6px;
                padding: 12px;
                margin-bottom: 8px;
            }

            .pajamadot-job-item:last-child {
                margin-bottom: 0;
            }

            .pajamadot-job-item .job-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 6px;
            }

            .pajamadot-job-item .job-type {
                font-size: 12px;
                font-weight: 600;
                color: var(--color-text, #fff);
            }

            .pajamadot-job-item .job-status {
                font-size: 11px;
                font-weight: 500;
            }

            .pajamadot-job-item .job-prompt {
                font-size: 11px;
                color: var(--color-text-secondary, #888);
                margin-bottom: 8px;
                line-height: 1.4;
            }

            .pajamadot-job-item .job-progress {
                height: 4px;
                background: var(--color-divider, #3a3a3a);
                border-radius: 2px;
                overflow: hidden;
                margin-bottom: 8px;
            }

            .pajamadot-job-item .job-progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #a855f7, #6366f1);
                transition: width 0.3s ease;
            }

            .pajamadot-job-item .job-error {
                font-size: 10px;
                color: #ef4444;
                margin-bottom: 8px;
            }

            .pajamadot-job-item .job-actions {
                display: flex;
                gap: 8px;
                justify-content: flex-end;
            }

            .pajamadot-job-item .job-import-btn,
            .pajamadot-job-item .job-remove-btn {
                font-size: 10px !important;
                padding: 4px 8px !important;
            }

            .pajamadot-job-item .job-import-btn {
                background: #22c55e !important;
                color: #fff !important;
                border: none !important;
            }

            .pajamadot-job-item .job-import-btn:hover {
                background: #16a34a !important;
            }

            .pajamadot-job-item .job-remove-btn {
                background: transparent !important;
                color: var(--color-text-secondary, #888) !important;
                border: 1px solid var(--color-divider, #3a3a3a) !important;
            }

            .pajamadot-job-item .job-remove-btn:hover {
                color: #ef4444 !important;
                border-color: #ef4444 !important;
            }

            .pajamadot-jobs-footer {
                margin-top: 12px;
                padding-top: 12px;
                border-top: 1px solid var(--color-divider, #3a3a3a);
                display: flex;
                justify-content: flex-end;
            }

            .pajamadot-jobs-clear {
                font-size: 11px !important;
                padding: 6px 12px !important;
                background: var(--color-bg, #1e1e1e) !important;
                border: 1px solid var(--color-divider, #3a3a3a) !important;
                color: var(--color-text-secondary, #888) !important;
            }

            .pajamadot-jobs-clear:hover {
                background: var(--color-bg-hover, #2a2a2a) !important;
                color: var(--color-text, #fff) !important;
            }

            /* Jobs tab indicator */
            .pajamadot-aigc-tab .tab-cost.has-jobs {
                background: linear-gradient(135deg, #a855f7, #6366f1);
                color: #fff;
                padding: 2px 6px;
                border-radius: 8px;
                font-weight: 600;
            }
        `;
        document.head.appendChild(styles);
    }
}

/**
 * Register editor methods
 */
function registerAssetGenerationMethods(): void {
    if (typeof editor === 'undefined') return;

    const safeMethod = (name: string, fn: (...args: any[]) => any) => {
        try {
            editor.method(name, fn);
        } catch (e) {
            // Already registered
        }
    };

    safeMethod('picker:pajamadot:assetgen', (tab?: GenerationType) => {
        const modal = new AssetGenerationModal();
        if (tab) {
            modal['_switchType'](tab);
        }
        modal.show();
        return modal;
    });

    safeMethod('pajamadot:generate:texture', () => {
        const modal = new AssetGenerationModal();
        modal['_switchType']('image');
        modal.show();
        return modal;
    });

    safeMethod('pajamadot:generate:image', () => {
        const modal = new AssetGenerationModal();
        modal['_switchType']('image');
        modal.show();
        return modal;
    });

    safeMethod('pajamadot:generate:mesh', () => {
        const modal = new AssetGenerationModal();
        modal['_switchType']('mesh');
        modal.show();
        return modal;
    });

    // Open modal directly to jobs tab
    safeMethod('picker:pajamadot:activejobs', () => {
        const modal = new AssetGenerationModal();
        modal['_switchType']('jobs');
        modal.show();
        return modal;
    });

    safeMethod('picker:pajamadot:activejobs:toggle', () => {
        const modal = new AssetGenerationModal();
        modal['_switchType']('jobs');
        modal.show();
        return modal;
    });
}

// Register on editor load
if (typeof editor !== 'undefined' && editor) {
    try {
        editor.once('load', () => {
            setTimeout(registerAssetGenerationMethods, 500);
        });
    } catch (err) {
        console.warn('[PajamaDot] Could not register asset generation methods:', err);
    }
}

export { AssetGenerationModal };

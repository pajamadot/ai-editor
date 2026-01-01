/**
 * Character Asset Inspector
 * Inspector panel for character assets with AIGC generation
 */

import {
    Container,
    Panel,
    LabelGroup,
    TextInput,
    TextAreaInput,
    SelectInput,
    SliderInput,
    Button,
    Label
} from '@playcanvas/pcui';

import {
    CHARACTER_POSES,
    CHARACTER_EXPRESSIONS,
    CAMERA_ANGLES,
    ART_STYLES,
    ALIGNMENTS
} from '../constants';
import type { StoryCharacterData, CharacterVisuals, PersonalityProfile } from '../types';
import { getDefaultCharacterVisuals, getDefaultPersonalityProfile } from '../types/character';
import { generationClient, PajamaDotTokenManager } from '../generation';
import { loadYamlData, setCachedDataPath, getCachedData, saveYamlData } from '../yaml-data-manager';

declare const editor: any;

const CLASS_CHARACTER = 'asset-character-inspector';

class CharacterAssetInspector extends Container {
    private _args: any;
    private _assets: any[] | null = null;
    private _assetEvents: any[] = [];
    private _assetId: number | null = null;
    private _data: StoryCharacterData | null = null;
    private _saveTimeout: ReturnType<typeof setTimeout> | null = null;

    // Panels
    private _basicPanel: Panel;
    private _personalityPanel: Panel;
    private _visualsPanel: Panel;
    private _generationPanel: Panel;

    // Basic inputs
    private _nameInput: TextInput;
    private _ageInput: TextInput;
    private _biographyInput: TextAreaInput;

    // Personality inputs
    private _eiSlider: SliderInput;
    private _snSlider: SliderInput;
    private _tfSlider: SliderInput;
    private _jpSlider: SliderInput;
    private _alignmentSelect: SelectInput;

    // Visual inputs
    private _poseSelect: SelectInput;
    private _expressionSelect: SelectInput;
    private _cameraSelect: SelectInput;
    private _styleSelect: SelectInput;
    private _costumeInput: TextInput;

    // Generation inputs
    private _promptInput: TextAreaInput;
    private _previewContainer: Container;
    private _previewImage: HTMLImageElement | null = null;
    private _creditsLabel: Label;
    private _statusLabel: Label;
    private _forgeButton: Button;
    private _enhanceButton: Button;
    private _generateButton: Button;

    readonly history: any;

    constructor(args: any) {
        args = Object.assign({
            class: CLASS_CHARACTER
        }, args);
        super(args);

        this._args = args;
        this.history = args.history;
        this.readOnly = !editor.call('permissions:write');

        this._buildDom();
        this._updateCreditsDisplay();

        // Listen for token changes
        editor.on('pajamadot:token:changed', () => this._updateCreditsDisplay());
    }

    private _buildDom() {
        this._buildBasicPanel();
        this._buildPersonalityPanel();
        this._buildVisualsPanel();
        this._buildGenerationPanel();
    }

    private _buildBasicPanel() {
        this._basicPanel = new Panel({
            headerText: 'CHARACTER INFO',
            collapsible: true,
            collapsed: false
        });

        // Name input
        this._nameInput = new TextInput({
            placeholder: 'Character name'
        });
        this._basicPanel.append(new LabelGroup({
            text: 'Name',
            field: this._nameInput
        }));

        // Age input
        this._ageInput = new TextInput({
            placeholder: 'e.g., 25, Young Adult'
        });
        this._basicPanel.append(new LabelGroup({
            text: 'Age',
            field: this._ageInput
        }));

        // Biography input
        this._biographyInput = new TextAreaInput({
            placeholder: 'Character biography and backstory...'
        });
        this._biographyInput.dom.querySelector('textarea')!.rows = 5;
        this._basicPanel.append(new LabelGroup({
            text: 'Biography',
            field: this._biographyInput
        }));

        this.append(this._basicPanel);

        // Bind events
        this._nameInput.on('change', (value: string) => {
            this._updateData('name', value);
        });

        this._ageInput.on('change', (value: string) => {
            this._updateData('age', value);
        });

        this._biographyInput.on('change', (value: string) => {
            this._updateData('biography', value);
        });
    }

    private _buildPersonalityPanel() {
        this._personalityPanel = new Panel({
            headerText: 'PERSONALITY',
            collapsible: true,
            collapsed: true
        });

        // MBTI Sliders
        const mbtiContainer = new Container({
            class: 'pajamadot-mbti-sliders'
        });

        // E/I Slider
        this._eiSlider = new SliderInput({
            min: 0,
            max: 100,
            value: 50,
            step: 1
        });
        const eiGroup = new LabelGroup({
            text: 'I ← → E',
            field: this._eiSlider
        });
        mbtiContainer.append(eiGroup);

        // S/N Slider
        this._snSlider = new SliderInput({
            min: 0,
            max: 100,
            value: 50,
            step: 1
        });
        const snGroup = new LabelGroup({
            text: 'S ← → N',
            field: this._snSlider
        });
        mbtiContainer.append(snGroup);

        // T/F Slider
        this._tfSlider = new SliderInput({
            min: 0,
            max: 100,
            value: 50,
            step: 1
        });
        const tfGroup = new LabelGroup({
            text: 'T ← → F',
            field: this._tfSlider
        });
        mbtiContainer.append(tfGroup);

        // J/P Slider
        this._jpSlider = new SliderInput({
            min: 0,
            max: 100,
            value: 50,
            step: 1
        });
        const jpGroup = new LabelGroup({
            text: 'J ← → P',
            field: this._jpSlider
        });
        mbtiContainer.append(jpGroup);

        this._personalityPanel.append(mbtiContainer);

        // Alignment
        this._alignmentSelect = new SelectInput({
            options: [{ v: '', t: '-- Select Alignment --' }, ...ALIGNMENTS] as { v: string; t: string }[]
        });
        this._personalityPanel.append(new LabelGroup({
            text: 'Alignment',
            field: this._alignmentSelect
        }));

        this.append(this._personalityPanel);

        // Bind events
        this._eiSlider.on('change', (value: number) => this._updateData('personality.mbtiSliders.ei', value));
        this._snSlider.on('change', (value: number) => this._updateData('personality.mbtiSliders.sn', value));
        this._tfSlider.on('change', (value: number) => this._updateData('personality.mbtiSliders.tf', value));
        this._jpSlider.on('change', (value: number) => this._updateData('personality.mbtiSliders.jp', value));
        this._alignmentSelect.on('change', (value: string) => {
            this._updateData('personality.alignment', value);
        });
    }

    private _buildVisualsPanel() {
        this._visualsPanel = new Panel({
            headerText: 'VISUAL ATTRIBUTES',
            collapsible: true,
            collapsed: true
        });

        // Pose
        this._poseSelect = new SelectInput({
            options: [...CHARACTER_POSES]
        });
        this._visualsPanel.append(new LabelGroup({
            text: 'Pose',
            field: this._poseSelect
        }));

        // Expression
        this._expressionSelect = new SelectInput({
            options: [...CHARACTER_EXPRESSIONS]
        });
        this._visualsPanel.append(new LabelGroup({
            text: 'Expression',
            field: this._expressionSelect
        }));

        // Camera angle
        this._cameraSelect = new SelectInput({
            options: [...CAMERA_ANGLES]
        });
        this._visualsPanel.append(new LabelGroup({
            text: 'Camera',
            field: this._cameraSelect
        }));

        // Art style
        this._styleSelect = new SelectInput({
            options: [...ART_STYLES]
        });
        this._visualsPanel.append(new LabelGroup({
            text: 'Style',
            field: this._styleSelect
        }));

        // Costume
        this._costumeInput = new TextInput({
            placeholder: 'Describe clothing/armor...'
        });
        this._visualsPanel.append(new LabelGroup({
            text: 'Costume',
            field: this._costumeInput
        }));

        this.append(this._visualsPanel);

        // Bind events
        this._poseSelect.on('change', (value: string) => this._updateData('visuals.pose', value));
        this._expressionSelect.on('change', (value: string) => this._updateData('visuals.expression', value));
        this._cameraSelect.on('change', (value: string) => this._updateData('visuals.cameraAngle', value));
        this._styleSelect.on('change', (value: string) => this._updateData('visuals.style', value));
        this._costumeInput.on('change', (value: string) => this._updateData('visuals.costume', value));
    }

    private _buildGenerationPanel() {
        this._generationPanel = new Panel({
            headerText: 'AI GENERATION',
            collapsible: true,
            collapsed: false
        });

        // Preview container
        this._previewContainer = new Container({
            class: 'pajamadot-preview-container'
        });
        this._previewContainer.dom.style.cssText = `
            width: 100%;
            height: 200px;
            background: #2a2a2a;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 8px;
            overflow: hidden;
        `;
        const placeholderLabel = new Label({ text: 'No portrait generated' });
        placeholderLabel.dom.style.color = '#666';
        this._previewContainer.append(placeholderLabel);
        this._generationPanel.append(this._previewContainer);

        // Prompt textarea
        this._promptInput = new TextAreaInput({
            placeholder: 'Enter a prompt or click "Forge Prompt" to auto-generate from character data...'
        });
        this._promptInput.dom.querySelector('textarea')!.rows = 4;
        this._generationPanel.append(new LabelGroup({
            text: 'Prompt',
            field: this._promptInput
        }));

        // Prompt buttons row
        const promptButtons = new Container({
            flex: true,
            flexDirection: 'row',
            class: 'pajamadot-prompt-buttons'
        });
        promptButtons.dom.style.cssText = 'gap: 4px; margin-bottom: 8px;';

        this._forgeButton = new Button({
            text: 'Forge Prompt',
            class: 'pajamadot-btn-secondary'
        });
        this._forgeButton.on('click', () => this._forgePrompt());
        promptButtons.append(this._forgeButton);

        this._enhanceButton = new Button({
            text: 'Enhance (+1)',
            class: 'pajamadot-btn-secondary'
        });
        this._enhanceButton.on('click', () => this._enhancePrompt());
        promptButtons.append(this._enhanceButton);

        this._generationPanel.append(promptButtons);

        // Status label
        this._statusLabel = new Label({
            text: '',
            class: 'pajamadot-status-label'
        });
        this._statusLabel.dom.style.cssText = 'margin-bottom: 8px; font-size: 11px;';
        this._generationPanel.append(this._statusLabel);

        // Generate button
        this._generateButton = new Button({
            text: 'Generate Portrait (10 credits)',
            class: 'pajamadot-btn-primary'
        });
        this._generateButton.dom.style.cssText = 'width: 100%; margin-bottom: 8px;';
        this._generateButton.on('click', () => this._generatePortrait());
        this._generationPanel.append(this._generateButton);

        // Credits display
        this._creditsLabel = new Label({
            text: 'Credits: --',
            class: 'pajamadot-credits-label'
        });
        this._creditsLabel.dom.style.cssText = 'font-size: 11px; color: #888;';
        this._generationPanel.append(this._creditsLabel);

        // Configure token link
        const tokenLink = new Label({
            text: 'Configure API Token'
        });
        tokenLink.dom.style.cssText = 'font-size: 11px; color: #4a9eff; cursor: pointer; text-decoration: underline;';
        tokenLink.dom.addEventListener('click', () => {
            editor.call('picker:pajamadot:token');
        });
        this._generationPanel.append(tokenLink);

        this.append(this._generationPanel);

        // Bind prompt change
        this._promptInput.on('change', (value: string) => {
            this._updateData('generationPrompt', value);
        });
    }

    private async _updateCreditsDisplay() {
        if (!PajamaDotTokenManager.hasToken()) {
            this._creditsLabel.text = 'No API token configured';
            this._generateButton.enabled = false;
            this._forgeButton.enabled = false;
            this._enhanceButton.enabled = false;
            return;
        }

        try {
            const credits = await generationClient.getCredits();
            this._creditsLabel.text = `Credits: ${credits.balance}`;
            this._generateButton.enabled = credits.balance >= 10;
            this._forgeButton.enabled = true;
            this._enhanceButton.enabled = credits.balance >= 1;
        } catch (error) {
            this._creditsLabel.text = 'Could not load credits';
            this._generateButton.enabled = false;
        }
    }

    private async _forgePrompt() {
        if (!this._assetId) return;

        const data = getCachedData<StoryCharacterData>(this._assetId);
        if (!data) {
            this._setStatus('No data loaded', 'error');
            return;
        }

        this._setStatus('Forging prompt...', 'pending');
        this._forgeButton.enabled = false;

        try {
            const result = await generationClient.forgePrompt({
                type: 'character',
                data: {
                    name: data.name,
                    age: data.age,
                    biography: data.biography,
                    visuals: data.visuals,
                    personality: data.personality
                }
            });

            this._promptInput.value = result.prompt;
            this._updateData('generationPrompt', result.prompt);
            this._setStatus('Prompt forged!', 'success');
        } catch (error) {
            this._setStatus(`Error: ${error instanceof Error ? error.message : 'Failed'}`, 'error');
        } finally {
            this._forgeButton.enabled = true;
        }
    }

    private async _enhancePrompt() {
        const prompt = this._promptInput.value.trim();
        if (!prompt) {
            this._setStatus('Enter a prompt first', 'error');
            return;
        }

        this._setStatus('Enhancing prompt...', 'pending');
        this._enhanceButton.enabled = false;

        try {
            const result = await generationClient.enhancePrompt({
                prompt,
                type: 'character'
            });

            this._promptInput.value = result.prompt;
            this._updateData('generationPrompt', result.prompt);
            this._setStatus('Prompt enhanced!', 'success');
            this._updateCreditsDisplay();
        } catch (error) {
            this._setStatus(`Error: ${error instanceof Error ? error.message : 'Failed'}`, 'error');
        } finally {
            this._enhanceButton.enabled = true;
        }
    }

    private async _generatePortrait() {
        const prompt = this._promptInput.value.trim();
        if (!prompt) {
            this._setStatus('Enter a prompt first', 'error');
            return;
        }

        this._setStatus('Generating portrait...', 'pending');
        this._generateButton.enabled = false;

        try {
            const result = await generationClient.generateCharacter({
                prompt,
                removeBackground: true,
                aspectRatio: '1:1'
            });

            if (result.success && result.imageUrl) {
                this._setStatus('Portrait generated!', 'success');
                this._showPreview(result.imageUrl);

                // Upload to PlayCanvas assets
                await this._uploadGeneratedImage(result.imageUrl);

                this._updateCreditsDisplay();
            } else {
                this._setStatus(result.error || 'Generation failed', 'error');
            }
        } catch (error) {
            this._setStatus(`Error: ${error instanceof Error ? error.message : 'Failed'}`, 'error');
        } finally {
            this._generateButton.enabled = true;
        }
    }

    private _showPreview(imageUrl: string) {
        // Clear preview container
        this._previewContainer.clear();

        // Create image element
        this._previewImage = document.createElement('img');
        this._previewImage.src = imageUrl;
        this._previewImage.style.cssText = 'max-width: 100%; max-height: 100%; object-fit: contain;';
        this._previewContainer.dom.appendChild(this._previewImage);
    }

    private async _uploadGeneratedImage(imageUrl: string) {
        if (!this._assetId) return;

        const data = getCachedData<StoryCharacterData>(this._assetId);
        const name = data?.name || 'Character';

        try {
            // Fetch the image
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const file = new File([blob], `${name}_portrait.png`, { type: 'image/png' });

            // Upload as PlayCanvas texture asset
            const textureAsset = await new Promise<any>((resolve, reject) => {
                editor.call('assets:create', {
                    name: `${name} Portrait`,
                    type: 'texture',
                    file: file,
                    source: true
                }, (err: Error, asset: any) => {
                    if (err) reject(err);
                    else resolve(asset);
                });
            });

            // Link to character
            this._updateData('portraitAssetId', textureAsset.get('id'));
            this._setStatus('Portrait saved as asset!', 'success');
        } catch (error) {
            console.error('[PajamaDot] Failed to upload generated image:', error);
            this._setStatus('Generated but failed to save asset', 'error');
        }
    }

    private _setStatus(message: string, type: 'success' | 'error' | 'pending') {
        this._statusLabel.text = message;
        this._statusLabel.dom.style.color = type === 'success' ? '#4ade80' : type === 'error' ? '#f87171' : '#fbbf24';
    }

    /**
     * Update data and schedule auto-save
     */
    private _updateData(path: string, value: any) {
        if (!this._assetId) return;

        setCachedDataPath(this._assetId, path, value);

        // Debounce saves
        if (this._saveTimeout) {
            clearTimeout(this._saveTimeout);
        }
        this._saveTimeout = setTimeout(() => {
            if (this._assetId) {
                saveYamlData(this._assetId);
            }
        }, 500);
    }

    async link(assets: any[]) {
        this.unlink();

        this._assets = assets;

        if (!assets || assets.length === 0) {
            return;
        }

        const asset = assets[0];
        this._assetId = asset.get('id');

        // Load YAML data
        const data = await loadYamlData<StoryCharacterData>(this._assetId);
        this._data = data;

        if (data) {
            // Basic info
            this._nameInput.value = data.name || '';
            this._ageInput.value = data.age || '';
            this._biographyInput.value = data.biography || '';

            // Personality
            const personality = data.personality || getDefaultPersonalityProfile();
            this._eiSlider.value = personality.mbtiSliders?.ei ?? 50;
            this._snSlider.value = personality.mbtiSliders?.sn ?? 50;
            this._tfSlider.value = personality.mbtiSliders?.tf ?? 50;
            this._jpSlider.value = personality.mbtiSliders?.jp ?? 50;
            this._alignmentSelect.value = personality.alignment || '';

            // Visuals
            const visuals = data.visuals || getDefaultCharacterVisuals();
            this._poseSelect.value = visuals.pose || 'portrait';
            this._expressionSelect.value = visuals.expression || 'neutral';
            this._cameraSelect.value = visuals.cameraAngle || 'front';
            this._styleSelect.value = visuals.style || 'anime';
            this._costumeInput.value = visuals.costume || '';

            // Generation prompt
            this._promptInput.value = data.generationPrompt || '';

            // Show existing portrait if available
            if (data.portraitAssetId) {
                const portraitAsset = editor.call('assets:get', data.portraitAssetId);
                if (portraitAsset) {
                    const thumbnailUrl = portraitAsset.get('thumbnails.m') || portraitAsset.get('file.url');
                    if (thumbnailUrl) {
                        this._showPreview(thumbnailUrl);
                    }
                }
            }
        }
    }

    unlink() {
        // Cancel pending save
        if (this._saveTimeout) {
            clearTimeout(this._saveTimeout);
            this._saveTimeout = null;
        }

        for (const evt of this._assetEvents) {
            evt.unbind?.();
        }
        this._assetEvents = [];
        this._assets = null;
        this._assetId = null;
        this._data = null;
    }

    destroy() {
        this.unlink();
        super.destroy();
    }
}

export { CharacterAssetInspector };

/**
 * Location Asset Inspector
 * Inspector panel for location assets with AIGC generation
 */

import {
    Container,
    Panel,
    LabelGroup,
    TextInput,
    TextAreaInput,
    SelectInput,
    Button,
    Label
} from '@playcanvas/pcui';

import {
    TIME_OF_DAY,
    WEATHER_OPTIONS,
    SCENE_MOODS,
    LOCATION_TYPES,
    ART_STYLES,
    GENERATION_QUALITY
} from '../constants';
import type { StoryLocationData, LocationVisuals } from '../types';
import { getDefaultLocationVisuals } from '../types/location';
import { generationClient, PajamaDotTokenManager } from '../generation';
import { loadYamlData, setCachedDataPath, getCachedData, saveYamlData } from '../yaml-data-manager';

declare const editor: any;

const CLASS_LOCATION = 'asset-location-inspector';

class LocationAssetInspector extends Container {
    private _args: any;
    private _assets: any[] | null = null;
    private _assetEvents: any[] = [];
    private _assetId: number | null = null;
    private _data: StoryLocationData | null = null;
    private _saveTimeout: ReturnType<typeof setTimeout> | null = null;

    // Panels
    private _basicPanel: Panel;
    private _environmentPanel: Panel;
    private _generationPanel: Panel;

    // Basic inputs
    private _nameInput: TextInput;
    private _descriptionInput: TextAreaInput;

    // Environment inputs
    private _timeSelect: SelectInput;
    private _weatherSelect: SelectInput;
    private _moodSelect: SelectInput;
    private _typeSelect: SelectInput;
    private _styleSelect: SelectInput;

    // Generation inputs
    private _promptInput: TextAreaInput;
    private _qualitySelect: SelectInput;
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
            class: CLASS_LOCATION
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
        this._buildEnvironmentPanel();
        this._buildGenerationPanel();
    }

    private _buildBasicPanel() {
        this._basicPanel = new Panel({
            headerText: 'LOCATION INFO',
            collapsible: true,
            collapsed: false
        });

        // Name input
        this._nameInput = new TextInput({
            placeholder: 'Location name'
        });
        this._basicPanel.append(new LabelGroup({
            text: 'Name',
            field: this._nameInput
        }));

        // Description input
        this._descriptionInput = new TextAreaInput({
            placeholder: 'Describe the location, its features, and atmosphere...'
        });
        this._descriptionInput.dom.querySelector('textarea')!.rows = 5;
        this._basicPanel.append(new LabelGroup({
            text: 'Description',
            field: this._descriptionInput
        }));

        this.append(this._basicPanel);

        // Bind events
        this._nameInput.on('change', (value: string) => {
            this._updateData('name', value);
        });

        this._descriptionInput.on('change', (value: string) => {
            this._updateData('description', value);
        });
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

    private _buildEnvironmentPanel() {
        this._environmentPanel = new Panel({
            headerText: 'ENVIRONMENT',
            collapsible: true,
            collapsed: true
        });

        // Time of Day
        this._timeSelect = new SelectInput({
            options: [...TIME_OF_DAY]
        });
        this._environmentPanel.append(new LabelGroup({
            text: 'Time',
            field: this._timeSelect
        }));

        // Weather
        this._weatherSelect = new SelectInput({
            options: [...WEATHER_OPTIONS]
        });
        this._environmentPanel.append(new LabelGroup({
            text: 'Weather',
            field: this._weatherSelect
        }));

        // Mood
        this._moodSelect = new SelectInput({
            options: [...SCENE_MOODS]
        });
        this._environmentPanel.append(new LabelGroup({
            text: 'Mood',
            field: this._moodSelect
        }));

        // Location Type
        this._typeSelect = new SelectInput({
            options: [...LOCATION_TYPES]
        });
        this._environmentPanel.append(new LabelGroup({
            text: 'Type',
            field: this._typeSelect
        }));

        // Art Style
        this._styleSelect = new SelectInput({
            options: [...ART_STYLES]
        });
        this._environmentPanel.append(new LabelGroup({
            text: 'Style',
            field: this._styleSelect
        }));

        this.append(this._environmentPanel);

        // Bind events
        this._timeSelect.on('change', (value: string) => this._updateData('visuals.timeOfDay', value));
        this._weatherSelect.on('change', (value: string) => this._updateData('visuals.weather', value));
        this._moodSelect.on('change', (value: string) => {
            this._updateData('visuals.mood', value);
            this._updateData('mood', value); // Also update legacy mood field
        });
        this._typeSelect.on('change', (value: string) => this._updateData('visuals.locationType', value));
        this._styleSelect.on('change', (value: string) => this._updateData('visuals.style', value));
    }

    private _buildGenerationPanel() {
        this._generationPanel = new Panel({
            headerText: 'AI GENERATION',
            collapsible: true,
            collapsed: false
        });

        // Preview container (16:9 aspect for backgrounds)
        this._previewContainer = new Container({
            class: 'pajamadot-preview-container'
        });
        this._previewContainer.dom.style.cssText = `
            width: 100%;
            height: 150px;
            background: #2a2a2a;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 8px;
            overflow: hidden;
        `;
        const placeholderLabel = new Label({ text: 'No background generated' });
        placeholderLabel.dom.style.color = '#666';
        this._previewContainer.append(placeholderLabel);
        this._generationPanel.append(this._previewContainer);

        // Prompt textarea
        this._promptInput = new TextAreaInput({
            placeholder: 'Enter a prompt or click "Forge Prompt" to auto-generate from location data...'
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

        // Quality select
        this._qualitySelect = new SelectInput({
            options: [...GENERATION_QUALITY]
        });
        this._qualitySelect.value = 'standard';
        this._generationPanel.append(new LabelGroup({
            text: 'Quality',
            field: this._qualitySelect
        }));

        // Status label
        this._statusLabel = new Label({
            text: '',
            class: 'pajamadot-status-label'
        });
        this._statusLabel.dom.style.cssText = 'margin-bottom: 8px; font-size: 11px;';
        this._generationPanel.append(this._statusLabel);

        // Generate button
        this._generateButton = new Button({
            text: 'Generate Background',
            class: 'pajamadot-btn-primary'
        });
        this._generateButton.dom.style.cssText = 'width: 100%; margin-bottom: 8px;';
        this._generateButton.on('click', () => this._generateBackground());
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

        // Update button text when quality changes
        this._qualitySelect.on('change', () => this._updateGenerateButtonText());
    }

    private _updateGenerateButtonText() {
        const quality = this._qualitySelect.value as string;
        const costs: Record<string, number> = { fast: 8, standard: 10, high: 15 };
        const cost = costs[quality] || 10;
        this._generateButton.text = `Generate Background (${cost} credits)`;
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
            this._generateButton.enabled = credits.balance >= 8;
            this._forgeButton.enabled = true;
            this._enhanceButton.enabled = credits.balance >= 1;
            this._updateGenerateButtonText();
        } catch (error) {
            this._creditsLabel.text = 'Could not load credits';
            this._generateButton.enabled = false;
        }
    }

    private async _forgePrompt() {
        if (!this._assetId) return;

        const data = getCachedData<StoryLocationData>(this._assetId);
        if (!data) {
            this._setStatus('No data loaded', 'error');
            return;
        }

        this._setStatus('Forging prompt...', 'pending');
        this._forgeButton.enabled = false;

        try {
            const result = await generationClient.forgePrompt({
                type: 'location',
                data: {
                    name: data.name,
                    description: data.description,
                    visuals: data.visuals
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
                type: 'location'
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

    private async _generateBackground() {
        const prompt = this._promptInput.value.trim();
        if (!prompt) {
            this._setStatus('Enter a prompt first', 'error');
            return;
        }

        const data = this._assetId ? getCachedData<StoryLocationData>(this._assetId) : null;
        const visuals = data?.visuals || getDefaultLocationVisuals();
        const quality = this._qualitySelect.value as 'fast' | 'standard' | 'high';

        this._setStatus('Generating background...', 'pending');
        this._generateButton.enabled = false;

        try {
            const result = await generationClient.generateScene({
                prompt,
                quality,
                timeOfDay: visuals.timeOfDay,
                weather: visuals.weather,
                style: visuals.style
            });

            if (result.success && result.imageUrl) {
                this._setStatus('Background generated!', 'success');
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

        const data = getCachedData<StoryLocationData>(this._assetId);
        const name = data?.name || 'Location';

        try {
            // Fetch the image
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const file = new File([blob], `${name}_background.png`, { type: 'image/png' });

            // Upload as PlayCanvas texture asset
            const textureAsset = await new Promise<any>((resolve, reject) => {
                editor.call('assets:create', {
                    name: `${name} Background`,
                    type: 'texture',
                    file: file,
                    source: true
                }, (err: Error, asset: any) => {
                    if (err) reject(err);
                    else resolve(asset);
                });
            });

            // Link to location
            this._updateData('backgroundAssetId', textureAsset.get('id'));
            this._setStatus('Background saved as asset!', 'success');
        } catch (error) {
            console.error('[PajamaDot] Failed to upload generated image:', error);
            this._setStatus('Generated but failed to save asset', 'error');
        }
    }

    private _setStatus(message: string, type: 'success' | 'error' | 'pending') {
        this._statusLabel.text = message;
        this._statusLabel.dom.style.color = type === 'success' ? '#4ade80' : type === 'error' ? '#f87171' : '#fbbf24';
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
        const data = await loadYamlData<StoryLocationData>(this._assetId);
        this._data = data;

        if (data) {
            // Basic info
            this._nameInput.value = data.name || '';
            this._descriptionInput.value = data.description || '';

            // Environment visuals
            const visuals = data.visuals || getDefaultLocationVisuals();
            this._timeSelect.value = visuals.timeOfDay || 'noon';
            this._weatherSelect.value = visuals.weather || 'clear';
            this._moodSelect.value = visuals.mood || 'peaceful';
            this._typeSelect.value = visuals.locationType || 'outdoor';
            this._styleSelect.value = visuals.style || 'anime';

            // Generation prompt
            this._promptInput.value = data.generationPrompt || '';

            // Show existing background if available
            if (data.backgroundAssetId) {
                const bgAsset = editor.call('assets:get', data.backgroundAssetId);
                if (bgAsset) {
                    const thumbnailUrl = bgAsset.get('thumbnails.m') || bgAsset.get('file.url');
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

export { LocationAssetInspector };

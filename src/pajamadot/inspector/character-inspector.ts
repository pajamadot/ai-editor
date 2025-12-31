/**
 * Character Asset Inspector
 * Inspector panel for character assets
 */

import { Container, Panel, LabelGroup, TextInput, TextAreaInput, ArrayInput } from '@playcanvas/pcui';

import { PAJAMADOT_ASSET_TYPES } from '../constants';
import type { StoryCharacterData } from '../types';

declare const editor: any;

const CLASS_CHARACTER = 'asset-character-inspector';

class CharacterAssetInspector extends Container {
    private _args: any;
    private _assets: any[] | null = null;
    private _assetEvents: any[] = [];

    // Panels
    private _basicPanel: Panel;
    private _traitsPanel: Panel;

    // Inputs
    private _nameInput: TextInput;
    private _biographyInput: TextAreaInput;

    readonly history: any;
    readonly readOnly: boolean;

    constructor(args: any) {
        args = Object.assign({
            class: CLASS_CHARACTER
        }, args);
        super(args);

        this._args = args;
        this.history = args.history;
        this.readOnly = !editor.call('permissions:write');

        this._buildDom();
    }

    private _buildDom() {
        // Basic Info Panel
        this._basicPanel = new Panel({
            headerText: 'CHARACTER INFO',
            collapsible: true,
            collapsed: false
        });

        // Name input
        this._nameInput = new TextInput({
            placeholder: 'Character name'
        });
        const nameGroup = new LabelGroup({
            text: 'Name',
            field: this._nameInput
        });
        this._basicPanel.append(nameGroup);

        // Biography input
        this._biographyInput = new TextAreaInput({
            placeholder: 'Character biography...',
            rows: 5
        });
        const bioGroup = new LabelGroup({
            text: 'Biography',
            field: this._biographyInput
        });
        this._basicPanel.append(bioGroup);

        this.append(this._basicPanel);

        // Traits Panel
        this._traitsPanel = new Panel({
            headerText: 'TRAITS & RELATIONSHIPS',
            collapsible: true,
            collapsed: true
        });
        this.append(this._traitsPanel);

        // Bind input events
        this._nameInput.on('change', (value: string) => {
            if (this._assets?.[0]) {
                this._assets[0].set('data.name', value);
                // Also update asset name
                this._assets[0].set('name', value);
            }
        });

        this._biographyInput.on('change', (value: string) => {
            if (this._assets?.[0]) {
                this._assets[0].set('data.biography', value);
            }
        });
    }

    link(assets: any[]) {
        this.unlink();

        this._assets = assets;

        if (!assets || assets.length === 0) {
            return;
        }

        const asset = assets[0];
        const data = asset.get('data') as StoryCharacterData;

        if (data) {
            this._nameInput.value = data.name || '';
            this._biographyInput.value = data.biography || '';
        }

        // Listen for data changes
        this._assetEvents.push(
            asset.on('data.name:set', (value: string) => {
                this._nameInput.value = value;
            })
        );
        this._assetEvents.push(
            asset.on('data.biography:set', (value: string) => {
                this._biographyInput.value = value;
            })
        );
    }

    unlink() {
        for (const evt of this._assetEvents) {
            evt.unbind?.();
        }
        this._assetEvents = [];
        this._assets = null;
    }

    destroy() {
        this.unlink();
        super.destroy();
    }
}

export { CharacterAssetInspector };

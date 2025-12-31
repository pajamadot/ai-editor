/**
 * Location Asset Inspector
 * Inspector panel for location assets
 */

import { Container, Panel, LabelGroup, TextInput, TextAreaInput, SelectInput } from '@playcanvas/pcui';

import { PAJAMADOT_ASSET_TYPES, MOOD_TYPES } from '../constants';
import type { StoryLocationData } from '../types';

declare const editor: any;

const CLASS_LOCATION = 'asset-location-inspector';

class LocationAssetInspector extends Container {
    private _args: any;
    private _assets: any[] | null = null;
    private _assetEvents: any[] = [];

    // Panels
    private _basicPanel: Panel;

    // Inputs
    private _nameInput: TextInput;
    private _descriptionInput: TextAreaInput;
    private _moodSelect: SelectInput;

    readonly history: any;
    readonly readOnly: boolean;

    constructor(args: any) {
        args = Object.assign({
            class: CLASS_LOCATION
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
            headerText: 'LOCATION INFO',
            collapsible: true,
            collapsed: false
        });

        // Name input
        this._nameInput = new TextInput({
            placeholder: 'Location name'
        });
        const nameGroup = new LabelGroup({
            text: 'Name',
            field: this._nameInput
        });
        this._basicPanel.append(nameGroup);

        // Description input
        this._descriptionInput = new TextAreaInput({
            placeholder: 'Location description...',
            rows: 4
        });
        const descGroup = new LabelGroup({
            text: 'Description',
            field: this._descriptionInput
        });
        this._basicPanel.append(descGroup);

        // Mood select
        this._moodSelect = new SelectInput({
            options: MOOD_TYPES.map(mood => ({
                v: mood,
                t: mood.charAt(0).toUpperCase() + mood.slice(1)
            }))
        });
        const moodGroup = new LabelGroup({
            text: 'Mood',
            field: this._moodSelect
        });
        this._basicPanel.append(moodGroup);

        this.append(this._basicPanel);

        // Bind input events
        this._nameInput.on('change', (value: string) => {
            if (this._assets?.[0]) {
                this._assets[0].set('data.name', value);
                this._assets[0].set('name', value);
            }
        });

        this._descriptionInput.on('change', (value: string) => {
            if (this._assets?.[0]) {
                this._assets[0].set('data.description', value);
            }
        });

        this._moodSelect.on('change', (value: string) => {
            if (this._assets?.[0]) {
                this._assets[0].set('data.mood', value);
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
        const data = asset.get('data') as StoryLocationData;

        if (data) {
            this._nameInput.value = data.name || '';
            this._descriptionInput.value = data.description || '';
            this._moodSelect.value = data.mood || 'neutral';
        }

        // Listen for data changes
        this._assetEvents.push(
            asset.on('data.name:set', (value: string) => {
                this._nameInput.value = value;
            })
        );
        this._assetEvents.push(
            asset.on('data.description:set', (value: string) => {
                this._descriptionInput.value = value;
            })
        );
        this._assetEvents.push(
            asset.on('data.mood:set', (value: string) => {
                this._moodSelect.value = value;
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

export { LocationAssetInspector };

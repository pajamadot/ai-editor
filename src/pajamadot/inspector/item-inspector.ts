/**
 * Item Asset Inspector
 * Inspector panel for item assets
 */

import { Container, Panel, LabelGroup, TextInput, TextAreaInput, SelectInput, BooleanInput } from '@playcanvas/pcui';

import { ITEM_TYPES } from '../constants';
import type { StoryItemData } from '../types';
import { loadYamlData, setCachedDataPath, saveYamlData } from '../yaml-data-manager';

declare const editor: any;

const CLASS_ITEM = 'asset-item-inspector';

class ItemAssetInspector extends Container {
    private _args: any;
    private _assets: any[] | null = null;
    private _assetEvents: any[] = [];
    private _assetId: number | null = null;
    private _data: StoryItemData | null = null;
    private _saveTimeout: ReturnType<typeof setTimeout> | null = null;

    // Panels
    private _basicPanel: Panel;
    private _propertiesPanel: Panel;

    // Inputs
    private _nameInput: TextInput;
    private _descriptionInput: TextAreaInput;
    private _typeSelect: SelectInput;
    private _usableInput: BooleanInput;
    private _stackableInput: BooleanInput;

    readonly history: any;

    constructor(args: any) {
        args = Object.assign({
            class: CLASS_ITEM
        }, args);
        super(args);

        this._args = args;
        this.history = args.history;

        this._buildDom();
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

    private _buildDom() {
        // Basic Info Panel
        this._basicPanel = new Panel({
            headerText: 'ITEM INFO',
            collapsible: true,
            collapsed: false
        });

        // Name input
        this._nameInput = new TextInput({
            placeholder: 'Item name'
        });
        const nameGroup = new LabelGroup({
            text: 'Name',
            field: this._nameInput
        });
        this._basicPanel.append(nameGroup);

        // Description input
        this._descriptionInput = new TextAreaInput({
            placeholder: 'Item description...'
        });
        this._descriptionInput.dom.querySelector('textarea')!.rows = 3;
        const descGroup = new LabelGroup({
            text: 'Description',
            field: this._descriptionInput
        });
        this._basicPanel.append(descGroup);

        // Type select
        this._typeSelect = new SelectInput({
            options: ITEM_TYPES.map(type => ({
                v: type,
                t: type.charAt(0).toUpperCase() + type.slice(1)
            }))
        });
        const typeGroup = new LabelGroup({
            text: 'Type',
            field: this._typeSelect
        });
        this._basicPanel.append(typeGroup);

        this.append(this._basicPanel);

        // Properties Panel
        this._propertiesPanel = new Panel({
            headerText: 'PROPERTIES',
            collapsible: true,
            collapsed: false
        });

        // Usable
        this._usableInput = new BooleanInput({
            value: false
        });
        const usableGroup = new LabelGroup({
            text: 'Usable',
            field: this._usableInput
        });
        this._propertiesPanel.append(usableGroup);

        // Stackable
        this._stackableInput = new BooleanInput({
            value: false
        });
        const stackableGroup = new LabelGroup({
            text: 'Stackable',
            field: this._stackableInput
        });
        this._propertiesPanel.append(stackableGroup);

        this.append(this._propertiesPanel);

        // Bind input events
        this._nameInput.on('change', (value: string) => {
            this._updateData('name', value);
        });

        this._descriptionInput.on('change', (value: string) => {
            this._updateData('description', value);
        });

        this._typeSelect.on('change', (value: string) => {
            this._updateData('itemType', value);
        });

        this._usableInput.on('change', (value: boolean) => {
            this._updateData('usable', value);
        });

        this._stackableInput.on('change', (value: boolean) => {
            this._updateData('stackable', value);
        });
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
        const data = await loadYamlData<StoryItemData>(this._assetId);
        this._data = data;

        if (data) {
            this._nameInput.value = data.name || '';
            this._descriptionInput.value = data.description || '';
            this._typeSelect.value = data.itemType || 'misc';
            this._usableInput.value = data.usable || false;
            this._stackableInput.value = data.stackable || false;
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

export { ItemAssetInspector };

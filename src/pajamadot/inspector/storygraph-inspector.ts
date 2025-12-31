/**
 * Story Graph Asset Inspector
 * Inspector panel for story graph assets
 */

import { Button, Container, Panel, LabelGroup, TextInput, TextAreaInput } from '@playcanvas/pcui';

import { StoryGraphView } from '../graph/story-graph-view';
import { PAJAMADOT_ASSET_TYPES } from '../constants';
import type { StoryGraphData } from '../types';

declare const editor: any;

const CLASS_STORYGRAPH = 'asset-storygraph-inspector';
const CLASS_STORYGRAPH_OPEN_BUTTON = `${CLASS_STORYGRAPH}-open-button`;
const CLASS_STORYGRAPH_CLOSE_BUTTON = `${CLASS_STORYGRAPH}-close-button`;

class StoryGraphAssetInspector extends Container {
    private _args: any;
    private _assets: any[] | null = null;
    private _view: StoryGraphView;
    private _metadataPanel: Panel;
    private _openEditorButton: Button;
    private _closeButton: Button | null = null;
    private _assetEvents: any[] = [];
    private _openInFullscreen: boolean = false;

    // Metadata inputs
    private _titleInput: TextInput;
    private _descriptionInput: TextAreaInput;

    readonly history: any;
    readonly readOnly: boolean;

    constructor(args: any) {
        args = Object.assign({
            class: CLASS_STORYGRAPH
        }, args);
        super(args);

        this._args = args;
        this.history = args.history;
        this.readOnly = !editor.call('permissions:write');

        // Create the graph view
        this._view = new StoryGraphView(this, args);

        // Build the UI
        this._buildDom();

        // Register the inspector method
        editor.method('picker:storygraph', this.openAsset.bind(this));
    }

    private _buildDom() {
        // Metadata Panel
        this._metadataPanel = new Panel({
            headerText: 'STORY METADATA',
            collapsible: true,
            collapsed: false
        });

        // Title input
        this._titleInput = new TextInput({
            placeholder: 'Story Title'
        });
        const titleGroup = new LabelGroup({
            text: 'Title',
            field: this._titleInput
        });
        this._metadataPanel.append(titleGroup);

        // Description input
        this._descriptionInput = new TextAreaInput({
            placeholder: 'Story description...',
            rows: 3
        });
        const descGroup = new LabelGroup({
            text: 'Description',
            field: this._descriptionInput
        });
        this._metadataPanel.append(descGroup);

        this.append(this._metadataPanel);

        // Open Graph Editor Button
        this._openEditorButton = new Button({
            text: 'OPEN GRAPH EDITOR',
            icon: 'E412',
            class: CLASS_STORYGRAPH_OPEN_BUTTON
        });
        this._openEditorButton.on('click', () => {
            this.openFullscreenMode();
        });
        this.append(this._openEditorButton);

        // Bind input events
        this._titleInput.on('change', (value: string) => {
            if (this._assets?.[0]) {
                this._assets[0].set('data.metadata.title', value);
            }
        });

        this._descriptionInput.on('change', (value: string) => {
            if (this._assets?.[0]) {
                this._assets[0].set('data.metadata.description', value);
            }
        });
    }

    /**
     * Open asset in the inspector
     */
    openAsset(asset: any) {
        this._openInFullscreen = true;
        editor.call('selector:history', false);
        editor.call('selector:add', 'asset', asset);
        editor.once('selector:change', () => {
            editor.call('selector:history', true);
        });
    }

    /**
     * Close asset
     */
    closeAsset() {
        this._openInFullscreen = false;
        editor.call('selector:history', false);
        editor.call('selector:clear');
        editor.once('selector:change', () => {
            editor.call('selector:history', true);
        });
    }

    /**
     * Open fullscreen graph editor mode
     */
    openFullscreenMode() {
        if (!this._assets || this._assets.length === 0) {
            return;
        }

        // Link the graph view to the asset
        this._view.link(this._assets);

        // Hide regular UI, show fullscreen controls
        this._metadataPanel.hidden = true;
        this._openEditorButton.hidden = true;

        // Create close button
        this._closeButton = new Button({
            text: '',
            icon: 'E389',
            class: CLASS_STORYGRAPH_CLOSE_BUTTON
        });
        this._closeButton.on('click', () => {
            this.closeFullscreenMode();
        });

        const viewport = document.getElementById('layout-viewport');
        if (viewport) {
            viewport.prepend(this._closeButton.dom);
        }

        // Notify parent
        this.parent?.emit?.('fullscreenMode:on');
    }

    /**
     * Close fullscreen graph editor mode
     */
    closeFullscreenMode() {
        // Unlink the graph view
        this._view.unlink();

        // Show regular UI
        this._metadataPanel.hidden = false;
        this._openEditorButton.hidden = false;

        // Remove close button
        if (this._closeButton) {
            const viewport = document.getElementById('layout-viewport');
            if (viewport && this._closeButton.dom.parentNode === viewport) {
                viewport.removeChild(this._closeButton.dom);
            }
            this._closeButton = null;
        }

        // Notify parent
        this.parent?.emit?.('fullscreenMode:off');
    }

    /**
     * Link to assets
     */
    link(assets: any[]) {
        this.unlink();

        this._assets = assets;

        if (!assets || assets.length === 0) {
            return;
        }

        const asset = assets[0];
        const data = asset.get('data') as StoryGraphData;

        if (data?.metadata) {
            this._titleInput.value = data.metadata.title || '';
            this._descriptionInput.value = data.metadata.description || '';
        }

        // Listen for data changes
        this._assetEvents.push(
            asset.on('data.metadata.title:set', (value: string) => {
                this._titleInput.value = value;
            })
        );
        this._assetEvents.push(
            asset.on('data.metadata.description:set', (value: string) => {
                this._descriptionInput.value = value;
            })
        );

        // Open in fullscreen if requested
        if (this._openInFullscreen) {
            this.openFullscreenMode();
            this._openInFullscreen = false;
        }
    }

    /**
     * Unlink from assets
     */
    unlink() {
        // Cleanup events
        for (const evt of this._assetEvents) {
            evt.unbind?.();
        }
        this._assetEvents = [];

        // Close fullscreen if open
        this.closeFullscreenMode();

        this._assets = null;
    }

    /**
     * Destroy the inspector
     */
    destroy() {
        this.unlink();
        this._view.destroy();
        super.destroy();
    }
}

// Register the inspector - we need to hook into the asset inspection flow
editor.once('load', () => {
    // Listen for when assets are inspected
    editor.on('attributes:inspect[asset]', (assets: any[]) => {
        if (!assets || assets.length === 0) return;

        const asset = assets[0];
        const assetType = asset.get('type');
        const pajamadotType = asset.get('meta.pajamadot_type');

        // Only handle story graph assets
        if (assetType === 'json' && pajamadotType === PAJAMADOT_ASSET_TYPES.STORY_GRAPH) {
            // Get the inspector panel
            const inspectorPanel = editor.call('layout.attributes');
            if (!inspectorPanel) return;

            // Find and hide the default JSON inspector
            const jsonInspector = inspectorPanel.dom.querySelector('.asset-json-inspector');
            if (jsonInspector) {
                jsonInspector.style.display = 'none';
            }

            // Check if we already have a story graph inspector
            let storyInspector = inspectorPanel.dom.querySelector('.asset-storygraph-inspector');

            if (!storyInspector) {
                // Create and append our inspector
                const inspector = new StoryGraphAssetInspector({
                    history: editor.call('editor:history')
                });

                // Find the asset inspector container and append to it
                const assetInspector = inspectorPanel.dom.querySelector('.asset-inspector');
                if (assetInspector) {
                    assetInspector.appendChild(inspector.dom);
                }

                inspector.link(assets);
            }
        }
    });

    // Also clean up when selection changes
    editor.on('attributes:clear', () => {
        const inspectorPanel = editor.call('layout.attributes');
        if (!inspectorPanel) return;

        // Remove any story graph inspectors
        const storyInspector = inspectorPanel.dom.querySelector('.asset-storygraph-inspector');
        if (storyInspector) {
            storyInspector.remove();
        }

        // Show JSON inspector again
        const jsonInspector = inspectorPanel.dom.querySelector('.asset-json-inspector');
        if (jsonInspector) {
            jsonInspector.style.display = '';
        }
    });

    console.log('[PajamaDot] Story graph inspector registered');
});

export { StoryGraphAssetInspector };

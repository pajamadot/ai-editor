/**
 * Story Graph Inspector Panel
 *
 * Adds a custom panel to the inspector when a story graph asset is selected.
 * Shows an "Open Story Editor" button and story graph info.
 */

import { Button, Container, Label, Panel } from '@playcanvas/pcui';

declare const editor: any;

const NAME_SUFFIX = '.storygraph';

class StoryGraphInspectorPanel extends Container {
    private _assetId: number | null = null;
    private _panel: Panel;

    constructor() {
        super({
            flex: true
        });

        this.class.add('pajamadot-inspector-panel');

        // Main panel
        this._panel = new Panel({
            headerText: 'STORY GRAPH',
            collapsible: false,
            flex: true
        });
        this.append(this._panel);

        // Open Editor button
        const btnOpen = new Button({
            text: 'Open Story Editor',
            class: 'pajamadot-btn-primary'
        });
        btnOpen.on('click', () => {
            if (this._assetId) {
                editor.call('pajamadot:window:open', this._assetId);
            }
        });
        this._panel.content.append(btnOpen);

        // Info section
        const infoContainer = new Container({
            flex: true,
            class: 'pajamadot-info'
        });
        this._panel.content.append(infoContainer);

        const infoLabel = new Label({
            text: 'Click the button above to open the visual story editor where you can create scenes, add dialogues, and connect story branches.',
            class: 'pajamadot-info-text'
        });
        infoContainer.append(infoLabel);
    }

    link(assetId: number) {
        this._assetId = assetId;
        this.hidden = false;
    }

    unlink() {
        this._assetId = null;
        this.hidden = true;
    }
}

// Singleton instance
let inspectorPanel: StoryGraphInspectorPanel | null = null;

/**
 * Check if an asset is a story graph
 */
function isStoryGraphAsset(asset: any): boolean {
    if (!asset) return false;
    const name = asset.get('name') || '';
    return name.endsWith(NAME_SUFFIX);
}

editor.once('load', () => {
    // Create the panel
    inspectorPanel = new StoryGraphInspectorPanel();
    inspectorPanel.hidden = true;

    // Find the inspector panel container and append our panel
    const setupPanel = () => {
        const inspectorContainer = document.querySelector('.inspector-container');
        if (inspectorContainer && inspectorPanel) {
            // Insert at the top of the inspector
            inspectorContainer.insertBefore(inspectorPanel.dom, inspectorContainer.firstChild);
            return true;
        }
        return false;
    };

    // Try to set up immediately, or wait for DOM
    if (!setupPanel()) {
        // Retry after a short delay
        setTimeout(setupPanel, 1000);
    }

    // Listen for selection changes
    editor.on('selector:change', (type: string, items: any[]) => {
        if (!inspectorPanel) return;

        if (type === 'asset' && items.length === 1) {
            const asset = items[0];
            if (isStoryGraphAsset(asset)) {
                inspectorPanel.link(asset.get('id'));
                return;
            }
        }

        inspectorPanel.unlink();
    });

    console.log('[PajamaDot] Story graph inspector panel registered');
});

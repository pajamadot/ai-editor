/**
 * AIGC Menu Integration
 * Adds AI generation tools to the PlayCanvas Editor toolbar and menus
 */

import { Menu, MenuItem, Label } from '@playcanvas/pcui';

import { generationClient } from '../generation/generation-client';

declare const editor: any;

/**
 * AIGC Menu component for PlayCanvas Editor
 */
class AIGCMenu {
    private _menu: Menu;
    private _creditsLabel: Label | null = null;

    constructor() {
        this._menu = new Menu();
    }

    get menu(): Menu {
        return this._menu;
    }

    /**
     * Initialize the AIGC menu with all generation options
     */
    init(): void {
        const root = editor.call('layout.root');
        root.append(this._menu);

        // Credits header (non-clickable)
        const creditsItem = new MenuItem({
            text: 'Credits: Loading...',
            icon: 'E210', // Money/coins icon
            class: 'aigc-credits-item'
        });
        creditsItem.dom.style.pointerEvents = 'none';
        creditsItem.dom.style.opacity = '0.8';
        this._menu.append(creditsItem);
        this._creditsLabel = creditsItem.label;

        // Separator
        const separator1 = new MenuItem({
            text: '─────────────',
            class: 'aigc-separator'
        });
        separator1.dom.style.pointerEvents = 'none';
        separator1.dom.style.opacity = '0.3';
        this._menu.append(separator1);

        // Generate Texture
        const textureItem = new MenuItem({
            text: 'Generate Texture',
            icon: 'E159', // Texture/image icon
            onSelect: () => {
                editor.call('pajamadot:panel:texture:show');
                this._menu.open = false;
            }
        });
        this._menu.append(textureItem);

        // Generate 3D Mesh
        const meshItem = new MenuItem({
            text: 'Generate 3D Model',
            icon: 'E207', // 3D cube icon
            onSelect: () => {
                editor.call('pajamadot:panel:mesh:show');
                this._menu.open = false;
            }
        });
        this._menu.append(meshItem);

        // Separator
        const separator2 = new MenuItem({
            text: '─────────────',
            class: 'aigc-separator'
        });
        separator2.dom.style.pointerEvents = 'none';
        separator2.dom.style.opacity = '0.3';
        this._menu.append(separator2);

        // Generate Character (links to existing character inspector)
        const characterItem = new MenuItem({
            text: 'Generate Character',
            icon: 'E192', // Person icon
            onSelect: () => {
                // Open character creation
                editor.call('assets:create:storycharacter');
                this._menu.open = false;
            }
        });
        this._menu.append(characterItem);

        // Generate Scene Background
        const sceneItem = new MenuItem({
            text: 'Generate Background',
            icon: 'E201', // Landscape icon
            onSelect: () => {
                // Open location creation
                editor.call('assets:create:storylocation');
                this._menu.open = false;
            }
        });
        this._menu.append(sceneItem);

        // Separator
        const separator3 = new MenuItem({
            text: '─────────────',
            class: 'aigc-separator'
        });
        separator3.dom.style.pointerEvents = 'none';
        separator3.dom.style.opacity = '0.3';
        this._menu.append(separator3);

        // Asset Generator - full modal with all generation types
        const assetGenItem = new MenuItem({
            text: 'Asset Generator...',
            icon: 'E195', // Magic wand icon
            onSelect: () => {
                editor.call('picker:pajamadot:assetgen');
                this._menu.open = false;
            }
        });
        this._menu.append(assetGenItem);

        // Generation History
        const historyItem = new MenuItem({
            text: 'Generation History',
            icon: 'E164', // Clock/history icon
            onSelect: () => {
                editor.call('picker:pajamadot:assetgen', 'history');
                this._menu.open = false;
            }
        });
        this._menu.append(historyItem);

        // Separator
        const separator4 = new MenuItem({
            text: '─────────────',
            class: 'aigc-separator'
        });
        separator4.dom.style.pointerEvents = 'none';
        separator4.dom.style.opacity = '0.3';
        this._menu.append(separator4);

        // Settings / API Token
        const settingsItem = new MenuItem({
            text: 'API Settings...',
            icon: 'E136', // Settings gear icon
            onSelect: () => {
                editor.call('picker:pajamadot:token');
                this._menu.open = false;
            }
        });
        this._menu.append(settingsItem);

        // Load credits
        this._loadCredits();
    }

    /**
     * Load and display current credits
     */
    async _loadCredits(): Promise<void> {
        try {
            const credits = await generationClient.getCredits();
            if (this._creditsLabel) {
                this._creditsLabel.text = `Credits: ${credits.balance}`;
            }
        } catch (error) {
            if (this._creditsLabel) {
                this._creditsLabel.text = 'Credits: Not connected';
            }
            console.warn('[AIGC Menu] Failed to load credits:', error);
        }
    }

    /**
     * Refresh credits display
     */
    refreshCredits(): void {
        this._loadCredits();
    }

    /**
     * Show menu at position
     */
    showAt(x: number, y: number): void {
        this._loadCredits(); // Refresh on open
        this._menu.position(x, y);
        this._menu.open = true;
    }

    /**
     * Toggle menu visibility
     */
    toggle(anchorElement?: HTMLElement): void {
        if (this._menu.open) {
            this._menu.open = false;
        } else {
            this._loadCredits();
            if (anchorElement) {
                const rect = anchorElement.getBoundingClientRect();
                this._menu.position(rect.left, rect.bottom + 4);
            }
            this._menu.open = true;
        }
    }
}

// Singleton instance
let aigcMenu: AIGCMenu | null = null;

/**
 * Initialize AIGC menu and toolbar integration
 */
function initAIGCMenu(): void {
    if (aigcMenu) return;

    aigcMenu = new AIGCMenu();
    aigcMenu.init();

    const root = editor.call('layout.root');

    // Register menu accessor
    editor.method('menu:aigc', () => aigcMenu?.menu);

    // Show menu at position
    editor.method('picker:aigc', (x?: number, y?: number) => {
        if (typeof x === 'number' && typeof y === 'number') {
            aigcMenu?.showAt(x, y);
        } else {
            aigcMenu?.toggle();
        }
    });

    // Refresh credits
    editor.method('aigc:credits:refresh', () => {
        aigcMenu?.refreshCredits();
    });

    // NOTE: Toolbar button removed - AIGC features are accessed through:
    // - Right-click context menus on assets
    // - Asset browser "+" create menu
    // - Asset inspector AI panels
    // - Direct modal calls: editor.call('picker:pajamadot:assetgen')

    // Add styles
    addAIGCMenuStyles();

    console.log('[PajamaDot] AIGC menu registered');
}

/**
 * Add AIGC menu styles
 */
function addAIGCMenuStyles(): void {
    const styleId = 'pajamadot-aigc-menu-styles';
    if (document.getElementById(styleId)) return;

    const styles = document.createElement('style');
    styles.id = styleId;
    styles.textContent = `
        /* Menu credits header */
        .aigc-credits-item {
            background: rgba(74, 144, 217, 0.1);
            border-bottom: 1px solid rgba(74, 144, 217, 0.2);
        }
        .aigc-separator {
            height: 1px;
            padding: 0;
            margin: 4px 0;
        }
    `;
    document.head.appendChild(styles);
}

// Initialize on editor load
editor.once('load', () => {
    initAIGCMenu();
});

export { AIGCMenu, aigcMenu };

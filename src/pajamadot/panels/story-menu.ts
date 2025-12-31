/**
 * Story Menu Integration
 * Adds PajamaDot asset types to the asset context menu and toolbar
 */

import { Button, Container, Menu, MenuItem } from '@playcanvas/pcui';

import { LegacyTooltip } from '@/common/ui/tooltip';

declare const editor: any;

editor.once('load', () => {
    const root = editor.call('layout.root');

    // Create story assets submenu
    const storyMenu = new Menu();
    root.append(storyMenu);

    // Story Graph item
    const storyGraphItem = new MenuItem({
        text: 'Story Graph',
        icon: 'E412',
        onSelect: () => {
            editor.call('assets:create:storygraph');
        }
    });
    storyMenu.append(storyGraphItem);

    // Character item
    const characterItem = new MenuItem({
        text: 'Character',
        icon: 'E192',
        onSelect: () => {
            editor.call('assets:create:storycharacter');
        }
    });
    storyMenu.append(characterItem);

    // Location item
    const locationItem = new MenuItem({
        text: 'Location',
        icon: 'E201',
        onSelect: () => {
            editor.call('assets:create:storylocation');
        }
    });
    storyMenu.append(locationItem);

    // Item asset
    const itemAssetItem = new MenuItem({
        text: 'Item',
        icon: 'E195',
        onSelect: () => {
            editor.call('assets:create:storyitem');
        }
    });
    storyMenu.append(itemAssetItem);

    // Import story
    const importItem = new MenuItem({
        text: 'Import Story...',
        icon: 'E228',
        onSelect: () => {
            editor.call('pajamadot:import:fromFile');
        }
    });
    storyMenu.append(importItem);

    // Register menu accessor
    editor.method('menu:story:assets', () => storyMenu);

    // Show menu at position
    editor.method('picker:story:assets', (x?: number, y?: number) => {
        if (typeof x === 'number' && typeof y === 'number') {
            storyMenu.position(x, y);
        }
        storyMenu.open = true;
    });

    // Add toolbar button for story menu
    const toolbar = editor.call('layout.toolbar');
    if (toolbar) {
        // Create story button container
        const storyBtnContainer = new Container({
            class: 'toolbar-story-container'
        });

        const storyBtn = new Button({
            class: 'toolbar-story-btn',
            icon: 'E412',
            text: ''
        });

        storyBtn.on('click', (e: MouseEvent) => {
            const rect = storyBtn.dom.getBoundingClientRect();
            storyMenu.position(rect.left, rect.bottom + 4);
            storyMenu.open = !storyMenu.open;
        });

        storyBtnContainer.append(storyBtn);
        toolbar.append(storyBtnContainer);

        // Add tooltip
        LegacyTooltip.attach({
            target: storyBtn.dom,
            text: 'Story Assets',
            align: 'right',
            root: root
        });
    }

    // Add to asset panel's "+" button context menu
    editor.on('assets:panel:contextmenu', (contextMenu: any) => {
        // Add story submenu to the create menu
        const storySubmenu = new MenuItem({
            text: 'Story',
            icon: 'E412'
        });

        const submenu = new Menu();
        submenu.append(new MenuItem({
            text: 'Story Graph',
            onSelect: () => editor.call('assets:create:storygraph')
        }));
        submenu.append(new MenuItem({
            text: 'Character',
            onSelect: () => editor.call('assets:create:storycharacter')
        }));
        submenu.append(new MenuItem({
            text: 'Location',
            onSelect: () => editor.call('assets:create:storylocation')
        }));
        submenu.append(new MenuItem({
            text: 'Item',
            onSelect: () => editor.call('assets:create:storyitem')
        }));

        storySubmenu.menu = submenu;

        if (contextMenu && contextMenu.append) {
            contextMenu.append(storySubmenu);
        }
    });

    console.log('[PajamaDot] Story menu registered');
});

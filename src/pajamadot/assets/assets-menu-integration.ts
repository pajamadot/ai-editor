/**
 * PajamaDot Assets Menu Integration
 *
 * Adds story-related asset types to the "New Asset" context menu
 * and the + button menu in the assets panel.
 */

declare const editor: any;

// Icons for PajamaDot asset types
const PAJAMADOT_ICONS = {
    storygraph: 'E412',   // Graph icon
    character: 'E186',    // Person icon
    location: 'E139',     // Location/folder icon
    item: 'E195'          // Item/box icon
};

// Story asset definitions
const STORY_ASSETS = [
    {
        text: 'Story Graph',
        icon: PAJAMADOT_ICONS.storygraph,
        createMethod: 'assets:create:storygraph'
    },
    {
        text: 'Character',
        icon: PAJAMADOT_ICONS.character,
        createMethod: 'assets:create:storycharacter'
    },
    {
        text: 'Location',
        icon: PAJAMADOT_ICONS.location,
        createMethod: 'assets:create:storylocation'
    },
    {
        text: 'Item',
        icon: PAJAMADOT_ICONS.item,
        createMethod: 'assets:create:storyitem'
    }
];

editor.once('load', () => {
    // Wait a bit for the context menu to be fully initialized
    setTimeout(() => {
        // Add to right-click context menu
        STORY_ASSETS.forEach(asset => {
            editor.call('assets:contextmenu:add', {
                text: `New ${asset.text}`,
                icon: asset.icon,
                onIsVisible: () => editor.call('permissions:write'),
                onSelect: () => {
                    editor.call(asset.createMethod, {});
                }
            });
        });

        // Add to + button menu (create menu)
        STORY_ASSETS.forEach(asset => {
            editor.call('assets:contextmenu:addcreate', {
                text: asset.text,
                icon: asset.icon,
                onIsVisible: () => editor.call('permissions:write'),
                onSelect: () => {
                    editor.call(asset.createMethod, {});
                }
            });
        });

        console.log('[PajamaDot] Asset creation menu items added to both menus');
    }, 500);
});

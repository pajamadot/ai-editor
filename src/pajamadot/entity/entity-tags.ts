/**
 * Entity Tags Integration
 * Connects story elements with PlayCanvas entities via tags
 */

declare const editor: any;

// Reserved tag prefixes for story elements
export const STORY_TAG_PREFIXES = {
    SCENE: 'story-scene:',
    CHARACTER: 'story-char:',
    LOCATION: 'story-loc:',
    ITEM: 'story-item:',
    TRIGGER: 'story-trigger:'
} as const;

interface EntityTriggerAction {
    tag: string;
    action: 'show' | 'hide' | 'enable' | 'disable' | 'animate' | 'play' | 'stop' | 'custom';
    params?: Record<string, any>;
}

editor.once('load', () => {
    /**
     * Find entities by story-related tag
     */
    editor.method('pajamadot:entity:findByTag', (tag: string) => {
        const entities: any[] = [];

        const traverse = (entity: any) => {
            const tags = entity.get('tags') || [];
            if (tags.includes(tag)) {
                entities.push(entity);
            }

            const children = entity.get('children') || [];
            for (const childId of children) {
                const child = editor.call('entities:get', childId);
                if (child) {
                    traverse(child);
                }
            }
        };

        const root = editor.call('entities:root');
        if (root) {
            traverse(root);
        }

        return entities;
    });

    /**
     * Find entities for a specific scene
     */
    editor.method('pajamadot:entity:findForScene', (sceneId: string) => {
        return editor.call('pajamadot:entity:findByTag', `${STORY_TAG_PREFIXES.SCENE}${sceneId}`);
    });

    /**
     * Find entities for a specific character
     */
    editor.method('pajamadot:entity:findForCharacter', (characterId: string) => {
        return editor.call('pajamadot:entity:findByTag', `${STORY_TAG_PREFIXES.CHARACTER}${characterId}`);
    });

    /**
     * Find entities for a specific location
     */
    editor.method('pajamadot:entity:findForLocation', (locationId: string) => {
        return editor.call('pajamadot:entity:findByTag', `${STORY_TAG_PREFIXES.LOCATION}${locationId}`);
    });

    /**
     * Add a story tag to an entity
     */
    editor.method('pajamadot:entity:addTag', (entityId: string, tag: string) => {
        const entity = editor.call('entities:get', entityId);
        if (!entity) return false;

        const tags = entity.get('tags') || [];
        if (tags.includes(tag)) return false;

        tags.push(tag);
        entity.set('tags', tags);
        return true;
    });

    /**
     * Remove a story tag from an entity
     */
    editor.method('pajamadot:entity:removeTag', (entityId: string, tag: string) => {
        const entity = editor.call('entities:get', entityId);
        if (!entity) return false;

        const tags = entity.get('tags') || [];
        const index = tags.indexOf(tag);
        if (index === -1) return false;

        tags.splice(index, 1);
        entity.set('tags', tags);
        return true;
    });

    /**
     * Execute trigger actions on tagged entities
     * This is used when a scene activates to show/hide/animate entities
     */
    editor.method('pajamadot:entity:executeTriggers', (triggers: EntityTriggerAction[]) => {
        for (const trigger of triggers) {
            const entities = editor.call('pajamadot:entity:findByTag', trigger.tag);

            for (const entity of entities) {
                switch (trigger.action) {
                    case 'show':
                        entity.set('enabled', true);
                        break;
                    case 'hide':
                        entity.set('enabled', false);
                        break;
                    case 'enable':
                        entity.set('enabled', true);
                        break;
                    case 'disable':
                        entity.set('enabled', false);
                        break;
                    case 'animate':
                    case 'play':
                    case 'stop':
                    case 'custom':
                        // These would need runtime support - emit events for scripts to handle
                        editor.call('pajamadot:event:emit', 'story:entity:trigger', {
                            entityId: entity.get('resource_id'),
                            action: trigger.action,
                            params: trigger.params
                        });
                        break;
                }
            }
        }
    });

    /**
     * Get all story-related tags for an entity
     */
    editor.method('pajamadot:entity:getStoryTags', (entityId: string) => {
        const entity = editor.call('entities:get', entityId);
        if (!entity) return [];

        const tags = entity.get('tags') || [];
        return tags.filter((tag: string) => {
            return Object.values(STORY_TAG_PREFIXES).some(prefix => tag.startsWith(prefix));
        });
    });

    /**
     * List all entities with story tags
     */
    editor.method('pajamadot:entity:listTagged', () => {
        const result: { entity: any; tags: string[] }[] = [];

        const traverse = (entity: any) => {
            const storyTags = editor.call('pajamadot:entity:getStoryTags', entity.get('resource_id'));
            if (storyTags.length > 0) {
                result.push({
                    entity,
                    tags: storyTags
                });
            }

            const children = entity.get('children') || [];
            for (const childId of children) {
                const child = editor.call('entities:get', childId);
                if (child) {
                    traverse(child);
                }
            }
        };

        const root = editor.call('entities:root');
        if (root) {
            traverse(root);
        }

        return result;
    });

    console.log('[PajamaDot] Entity tags integration registered');
});

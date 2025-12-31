/**
 * Entity Events Integration
 * Connects story narrative events with PlayCanvas entities via custom events
 */

declare const editor: any;

// Event types that the story system emits
export const STORY_EVENTS = {
    // Scene events
    SCENE_ENTER: 'story:scene:enter',
    SCENE_EXIT: 'story:scene:exit',

    // Dialogue events
    DIALOGUE_START: 'story:dialogue:start',
    DIALOGUE_SHOW: 'story:dialogue:show',
    DIALOGUE_END: 'story:dialogue:end',

    // Choice events
    CHOICE_PRESENT: 'story:choice:present',
    CHOICE_SELECTED: 'story:choice:selected',

    // Character events
    CHARACTER_ENTER: 'story:character:enter',
    CHARACTER_EXIT: 'story:character:exit',
    CHARACTER_SPEAK: 'story:character:speak',

    // Location events
    LOCATION_CHANGE: 'story:location:change',

    // Story flow events
    STORY_START: 'story:start',
    STORY_END: 'story:end',
    STORY_PAUSE: 'story:pause',
    STORY_RESUME: 'story:resume'
} as const;

interface StoryEventData {
    timestamp: number;
    [key: string]: any;
}

editor.once('load', () => {
    // Event history for debugging
    const eventHistory: { event: string; data: StoryEventData }[] = [];
    const maxHistory = 100;

    /**
     * Emit a story event
     * PlayCanvas scripts can listen using: this.app.on('story:*', callback)
     */
    editor.method('pajamadot:event:emit', (eventName: string, data: any = {}) => {
        const eventData: StoryEventData = {
            ...data,
            timestamp: Date.now()
        };

        // Store in history
        eventHistory.push({ event: eventName, data: eventData });
        if (eventHistory.length > maxHistory) {
            eventHistory.shift();
        }

        // Emit via editor events (for editor-side listeners)
        editor.emit(eventName, eventData);

        // Emit to launch frame if available (for runtime scripts)
        try {
            const launchFrame = document.querySelector('iframe.launch-frame') as HTMLIFrameElement;
            if (launchFrame && launchFrame.contentWindow) {
                launchFrame.contentWindow.postMessage({
                    type: 'pajamadot:event',
                    event: eventName,
                    data: eventData
                }, '*');
            }
        } catch (e) {
            // Ignore cross-origin errors
        }

        console.log(`[PajamaDot] Event: ${eventName}`, eventData);
    });

    /**
     * Get event history
     */
    editor.method('pajamadot:event:history', () => {
        return [...eventHistory];
    });

    /**
     * Clear event history
     */
    editor.method('pajamadot:event:clearHistory', () => {
        eventHistory.length = 0;
    });

    // Convenience methods for common events
    editor.method('pajamadot:event:sceneEnter', (sceneId: string, sceneData: any) => {
        editor.call('pajamadot:event:emit', STORY_EVENTS.SCENE_ENTER, {
            sceneId,
            ...sceneData
        });
    });

    editor.method('pajamadot:event:sceneExit', (sceneId: string) => {
        editor.call('pajamadot:event:emit', STORY_EVENTS.SCENE_EXIT, { sceneId });
    });

    editor.method('pajamadot:event:dialogueShow', (dialogueData: any) => {
        editor.call('pajamadot:event:emit', STORY_EVENTS.DIALOGUE_SHOW, dialogueData);
    });

    editor.method('pajamadot:event:choicePresent', (choices: any[]) => {
        editor.call('pajamadot:event:emit', STORY_EVENTS.CHOICE_PRESENT, { choices });
    });

    editor.method('pajamadot:event:choiceSelected', (choiceId: string, choiceText: string) => {
        editor.call('pajamadot:event:emit', STORY_EVENTS.CHOICE_SELECTED, {
            choiceId,
            choiceText
        });
    });

    console.log('[PajamaDot] Entity events registered');
});

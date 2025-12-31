/**
 * Story Controller Script Template
 * This file provides a template for PlayCanvas runtime scripts
 * that can be added to entities to react to story events.
 *
 * Users should create this as a script asset in their project.
 */

export const STORY_CONTROLLER_TEMPLATE = `
/**
 * Story Controller
 * Attach this script to any entity to make it respond to story events.
 *
 * Usage:
 * 1. Add this script to an entity
 * 2. Add story tags to the entity (e.g., story-char:hero, story-loc:tavern)
 * 3. The entity will automatically respond to story events
 */
var StoryController = pc.createScript('storyController');

// Attributes
StoryController.attributes.add('reactToDialogue', {
    type: 'boolean',
    default: true,
    title: 'React to Dialogue',
    description: 'Enable reactions when this character speaks'
});

StoryController.attributes.add('fadeOnSceneChange', {
    type: 'boolean',
    default: false,
    title: 'Fade on Scene Change',
    description: 'Fade in/out when entering/exiting scenes'
});

StoryController.attributes.add('animationOnSpeak', {
    type: 'string',
    default: '',
    title: 'Animation on Speak',
    description: 'Animation to play when character speaks'
});

// Initialize
StoryController.prototype.initialize = function() {
    // Listen to story events
    this.app.on('story:scene:enter', this.onSceneEnter, this);
    this.app.on('story:scene:exit', this.onSceneExit, this);
    this.app.on('story:dialogue:show', this.onDialogueShow, this);
    this.app.on('story:character:speak', this.onCharacterSpeak, this);
    this.app.on('story:choice:present', this.onChoicePresent, this);
    this.app.on('story:entity:trigger', this.onEntityTrigger, this);

    // Listen for messages from editor
    window.addEventListener('message', this.onEditorMessage.bind(this));
};

// Handle messages from editor
StoryController.prototype.onEditorMessage = function(event) {
    if (event.data && event.data.type === 'pajamadot:event') {
        this.app.fire(event.data.event, event.data.data);
    }
};

// Scene enter handler
StoryController.prototype.onSceneEnter = function(data) {
    var sceneTag = 'story-scene:' + data.sceneId;
    if (this.entity.tags.has(sceneTag)) {
        this.entity.enabled = true;
        if (this.fadeOnSceneChange) {
            this.fadeIn();
        }
    }
};

// Scene exit handler
StoryController.prototype.onSceneExit = function(data) {
    var sceneTag = 'story-scene:' + data.sceneId;
    if (this.entity.tags.has(sceneTag)) {
        if (this.fadeOnSceneChange) {
            this.fadeOut(function() {
                this.entity.enabled = false;
            }.bind(this));
        } else {
            this.entity.enabled = false;
        }
    }
};

// Dialogue show handler
StoryController.prototype.onDialogueShow = function(data) {
    if (!this.reactToDialogue) return;

    var charTag = 'story-char:' + data.speakerId;
    if (this.entity.tags.has(charTag)) {
        this.onCharacterSpeak(data);
    }
};

// Character speak handler
StoryController.prototype.onCharacterSpeak = function(data) {
    var charTag = 'story-char:' + data.speakerId;
    if (!this.entity.tags.has(charTag)) return;

    // Play speak animation if configured
    if (this.animationOnSpeak && this.entity.anim) {
        this.entity.anim.setTrigger(this.animationOnSpeak);
    }

    // Emit local event for custom handling
    this.entity.fire('story:speak', data);
};

// Choice present handler
StoryController.prototype.onChoicePresent = function(data) {
    // Override this to show custom choice UI
    this.entity.fire('story:choices', data.choices);
};

// Entity trigger handler
StoryController.prototype.onEntityTrigger = function(data) {
    if (data.entityId !== this.entity.getGuid()) return;

    switch (data.action) {
        case 'animate':
            if (this.entity.anim && data.params && data.params.animation) {
                this.entity.anim.setTrigger(data.params.animation);
            }
            break;
        case 'play':
            if (this.entity.sound && data.params && data.params.slot) {
                this.entity.sound.play(data.params.slot);
            }
            break;
        case 'stop':
            if (this.entity.sound) {
                this.entity.sound.stop();
            }
            break;
        case 'custom':
            this.entity.fire('story:custom', data.params);
            break;
    }
};

// Fade in helper
StoryController.prototype.fadeIn = function(callback) {
    // Simple fade using scale (for sprites) or opacity (for elements)
    this.entity.setLocalScale(0, 0, 0);
    this.app.tween(this.entity.localScale)
        .to({x: 1, y: 1, z: 1}, 0.3, pc.SineOut)
        .on('complete', callback || function(){})
        .start();
};

// Fade out helper
StoryController.prototype.fadeOut = function(callback) {
    this.app.tween(this.entity.localScale)
        .to({x: 0, y: 0, z: 0}, 0.3, pc.SineIn)
        .on('complete', callback || function(){})
        .start();
};

// Cleanup
StoryController.prototype.destroy = function() {
    this.app.off('story:scene:enter', this.onSceneEnter, this);
    this.app.off('story:scene:exit', this.onSceneExit, this);
    this.app.off('story:dialogue:show', this.onDialogueShow, this);
    this.app.off('story:character:speak', this.onCharacterSpeak, this);
    this.app.off('story:choice:present', this.onChoicePresent, this);
    this.app.off('story:entity:trigger', this.onEntityTrigger, this);
};
`;

declare const editor: any;

editor.once('load', () => {
    /**
     * Create a story controller script asset
     */
    editor.method('pajamadot:entity:createControllerScript', () => {
        return new Promise((resolve, reject) => {
            editor.call('assets:create:script', {
                filename: 'storyController.js',
                content: STORY_CONTROLLER_TEMPLATE,
                callback: (err: Error | null, asset: any) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(asset);
                    }
                }
            });
        });
    });

    console.log('[PajamaDot] Story controller template registered');
});

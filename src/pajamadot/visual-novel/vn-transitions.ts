/**
 * VN Transitions
 * Visual effects for scene transitions in the visual novel system
 *
 * Supports:
 * - Fade (in/out/crossfade)
 * - Dissolve
 * - Slide (all directions)
 * - Zoom (in/out)
 * - Special effects (blur, pixelate, flash, shake)
 * - Custom shader-based transitions
 */

import type { TransitionType, TransitionConfig } from './vn-types';

declare const pc: any;

/**
 * Easing functions
 */
type EasingFunction = (t: number) => number;

const EASINGS: Record<string, EasingFunction> = {
    'linear': (t: number) => t,
    'ease-in': (t: number) => t * t,
    'ease-out': (t: number) => t * (2 - t),
    'ease-in-out': (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
};

/**
 * Transition state
 */
interface TransitionState {
    active: boolean;
    type: TransitionType;
    progress: number;
    duration: number;
    easing: EasingFunction;
    params: Record<string, any>;
    startTime: number;
    resolve: (() => void) | null;
}

/**
 * VN Transition Manager
 * Handles visual transitions between scenes
 */
class VNTransitionManager {
    private app: any = null;
    private transitionLayer: any = null;
    private overlayEntity: any = null;
    private shakeEntity: any = null;
    private currentState: TransitionState | null = null;
    private updateHandler: ((dt: number) => void) | null = null;

    // Screen shake state
    private shakeIntensity: number = 0;
    private shakeDuration: number = 0;
    private shakeElapsed: number = 0;
    private originalCameraPos: { x: number; y: number; z: number } | null = null;

    /**
     * Initialize the transition manager
     */
    initialize(app: any): void {
        this.app = app;

        // Create transition overlay entity
        this.createOverlay();

        // Register update handler
        this.updateHandler = this.update.bind(this);
        this.app.on('update', this.updateHandler);

        console.log('[VNTransitions] Initialized');
    }

    /**
     * Cleanup
     */
    destroy(): void {
        if (this.updateHandler && this.app) {
            this.app.off('update', this.updateHandler);
        }

        if (this.overlayEntity) {
            this.overlayEntity.destroy();
        }

        console.log('[VNTransitions] Destroyed');
    }

    /**
     * Create the overlay entity for transitions
     */
    private createOverlay(): void {
        if (!this.app?.root) return;

        // Create a 2D screen entity for overlay
        this.transitionLayer = new pc.Entity('VN_TransitionLayer');
        this.transitionLayer.addComponent('screen', {
            referenceResolution: new pc.Vec2(1920, 1080),
            scaleMode: pc.SCALEMODE_BLEND,
            scaleBlend: 0.5,
            screenSpace: true
        });
        this.app.root.addChild(this.transitionLayer);

        // Create overlay element
        this.overlayEntity = new pc.Entity('VN_TransitionOverlay');
        this.overlayEntity.addComponent('element', {
            type: 'image',
            anchor: new pc.Vec4(0, 0, 1, 1),
            pivot: new pc.Vec2(0.5, 0.5),
            color: new pc.Color(0, 0, 0, 0),
            opacity: 0
        });
        this.overlayEntity.enabled = false;
        this.transitionLayer.addChild(this.overlayEntity);
    }

    /**
     * Execute a transition
     */
    async transition(config: TransitionConfig): Promise<void> {
        return new Promise((resolve) => {
            const easing = EASINGS[config.easing] || EASINGS['ease-in-out'];

            this.currentState = {
                active: true,
                type: config.type,
                progress: 0,
                duration: config.duration,
                easing,
                params: config.params || {},
                startTime: Date.now(),
                resolve
            };

            // Enable overlay if needed
            if (this.overlayEntity && this.needsOverlay(config.type)) {
                this.overlayEntity.enabled = true;
                this.setupTransition(config);
            }

            // Special handling for instant transitions
            if (config.duration === 0 || config.type === 'none') {
                this.completeTransition();
            }
        });
    }

    /**
     * Update transition state
     */
    private update(dt: number): void {
        // Update current transition
        if (this.currentState?.active) {
            const elapsed = (Date.now() - this.currentState.startTime) / 1000;
            const rawProgress = Math.min(elapsed / this.currentState.duration, 1);
            this.currentState.progress = this.currentState.easing(rawProgress);

            this.updateTransition(this.currentState.progress);

            if (rawProgress >= 1) {
                this.completeTransition();
            }
        }

        // Update screen shake
        if (this.shakeIntensity > 0 && this.shakeDuration > 0) {
            this.updateShake(dt);
        }
    }

    /**
     * Check if transition type needs overlay
     */
    private needsOverlay(type: TransitionType): boolean {
        return [
            'fade', 'crossfade', 'dissolve', 'flash'
        ].includes(type);
    }

    /**
     * Setup transition based on type
     */
    private setupTransition(config: TransitionConfig): void {
        if (!this.overlayEntity) return;

        const elem = this.overlayEntity.element;
        const color = config.params?.color || new pc.Color(0, 0, 0, 1);

        switch (config.type) {
            case 'fade':
                elem.color = color;
                elem.opacity = 0;
                break;

            case 'flash':
                elem.color = config.params?.flashColor || new pc.Color(1, 1, 1, 1);
                elem.opacity = 1;
                break;

            case 'dissolve':
            case 'crossfade':
                elem.color = color;
                elem.opacity = 0;
                break;
        }
    }

    /**
     * Update transition based on progress
     */
    private updateTransition(progress: number): void {
        if (!this.overlayEntity || !this.currentState) return;

        const elem = this.overlayEntity.element;
        const type = this.currentState.type;
        const params = this.currentState.params;

        switch (type) {
            case 'fade':
                // Fade to black then back
                if (params.fadeOut) {
                    elem.opacity = progress;
                } else if (params.fadeIn) {
                    elem.opacity = 1 - progress;
                } else {
                    // Full fade cycle
                    elem.opacity = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
                }
                break;

            case 'flash':
                elem.opacity = 1 - progress;
                break;

            case 'dissolve':
                // Similar to fade but with different curve
                if (progress < 0.5) {
                    elem.opacity = Math.pow(progress * 2, 0.5);
                } else {
                    elem.opacity = Math.pow((1 - progress) * 2, 0.5);
                }
                break;

            case 'crossfade':
                // Used when swapping backgrounds
                elem.opacity = Math.sin(progress * Math.PI);
                break;

            case 'slide-left':
            case 'slide-right':
            case 'slide-up':
            case 'slide-down':
                this.updateSlideTransition(type, progress, params);
                break;

            case 'zoom-in':
            case 'zoom-out':
                this.updateZoomTransition(type, progress, params);
                break;

            case 'blur':
                this.updateBlurTransition(progress, params);
                break;

            case 'pixelate':
                this.updatePixelateTransition(progress, params);
                break;

            case 'shake':
                this.updateShakeTransition(progress, params);
                break;
        }
    }

    /**
     * Update slide transitions
     */
    private updateSlideTransition(
        type: TransitionType,
        progress: number,
        params: Record<string, any>
    ): void {
        // Would apply to background entity if we have reference
        const targetEntity = params.targetEntity;
        if (!targetEntity) return;

        const screenWidth = this.app?.graphicsDevice?.width || 1920;
        const screenHeight = this.app?.graphicsDevice?.height || 1080;

        let offsetX = 0;
        let offsetY = 0;

        switch (type) {
            case 'slide-left':
                offsetX = (1 - progress) * screenWidth;
                break;
            case 'slide-right':
                offsetX = (progress - 1) * screenWidth;
                break;
            case 'slide-up':
                offsetY = (1 - progress) * screenHeight;
                break;
            case 'slide-down':
                offsetY = (progress - 1) * screenHeight;
                break;
        }

        if (targetEntity.element) {
            // Animate position
        }
    }

    /**
     * Update zoom transitions
     */
    private updateZoomTransition(
        type: TransitionType,
        progress: number,
        params: Record<string, any>
    ): void {
        const targetEntity = params.targetEntity;
        if (!targetEntity) return;

        const startScale = type === 'zoom-in' ? 0.5 : 1.5;
        const endScale = 1;
        const currentScale = startScale + (endScale - startScale) * progress;

        if (targetEntity.element) {
            targetEntity.setLocalScale(currentScale, currentScale, 1);
        }
    }

    /**
     * Update blur transition (requires shader support)
     */
    private updateBlurTransition(progress: number, params: Record<string, any>): void {
        // Blur requires post-processing shader
        // For now, simulate with fade
        if (this.overlayEntity?.element) {
            const maxBlur = params.maxBlur || 0.5;
            this.overlayEntity.element.opacity = progress < 0.5
                ? progress * 2 * maxBlur
                : (1 - progress) * 2 * maxBlur;
        }
    }

    /**
     * Update pixelate transition (requires shader support)
     */
    private updatePixelateTransition(progress: number, params: Record<string, any>): void {
        // Pixelate requires post-processing shader
        // Placeholder implementation
        console.log('[VNTransitions] Pixelate transition at', progress);
    }

    /**
     * Update shake transition
     */
    private updateShakeTransition(progress: number, params: Record<string, any>): void {
        const intensity = params.intensity || 10;
        const decay = 1 - progress;

        // Apply to camera or screen
        const camera = this.app?.root?.findByName('Camera');
        if (camera) {
            const offsetX = (Math.random() - 0.5) * intensity * decay;
            const offsetY = (Math.random() - 0.5) * intensity * decay;

            if (!this.originalCameraPos) {
                const pos = camera.getLocalPosition();
                this.originalCameraPos = { x: pos.x, y: pos.y, z: pos.z };
            }

            camera.setLocalPosition(
                this.originalCameraPos.x + offsetX,
                this.originalCameraPos.y + offsetY,
                this.originalCameraPos.z
            );
        }
    }

    /**
     * Complete the current transition
     */
    private completeTransition(): void {
        if (!this.currentState) return;

        // Reset overlay
        if (this.overlayEntity) {
            this.overlayEntity.element.opacity = 0;
            this.overlayEntity.enabled = false;
        }

        // Reset camera position if shaken
        if (this.originalCameraPos) {
            const camera = this.app?.root?.findByName('Camera');
            if (camera) {
                camera.setLocalPosition(
                    this.originalCameraPos.x,
                    this.originalCameraPos.y,
                    this.originalCameraPos.z
                );
            }
            this.originalCameraPos = null;
        }

        // Resolve promise
        const resolve = this.currentState.resolve;
        this.currentState = null;

        if (resolve) {
            resolve();
        }
    }

    // ========================================================================
    // Convenience Methods
    // ========================================================================

    /**
     * Fade to black
     */
    async fadeOut(duration: number = 0.5, color?: any): Promise<void> {
        return this.transition({
            type: 'fade',
            duration,
            easing: 'ease-in',
            params: { fadeOut: true, color: color || new pc.Color(0, 0, 0, 1) }
        });
    }

    /**
     * Fade from black
     */
    async fadeIn(duration: number = 0.5): Promise<void> {
        if (this.overlayEntity) {
            this.overlayEntity.element.opacity = 1;
            this.overlayEntity.enabled = true;
        }

        return this.transition({
            type: 'fade',
            duration,
            easing: 'ease-out',
            params: { fadeIn: true }
        });
    }

    /**
     * Quick flash effect
     */
    async flash(
        duration: number = 0.3,
        color?: any
    ): Promise<void> {
        return this.transition({
            type: 'flash',
            duration,
            easing: 'ease-out',
            params: { flashColor: color || new pc.Color(1, 1, 1, 1) }
        });
    }

    /**
     * Screen shake
     */
    shake(intensity: number = 10, duration: number = 0.5): void {
        this.shakeIntensity = intensity;
        this.shakeDuration = duration;
        this.shakeElapsed = 0;

        // Store original camera position
        const camera = this.app?.root?.findByName('Camera');
        if (camera && !this.originalCameraPos) {
            const pos = camera.getLocalPosition();
            this.originalCameraPos = { x: pos.x, y: pos.y, z: pos.z };
        }
    }

    /**
     * Update shake effect
     */
    private updateShake(dt: number): void {
        this.shakeElapsed += dt;

        if (this.shakeElapsed >= this.shakeDuration) {
            // Reset camera
            if (this.originalCameraPos) {
                const camera = this.app?.root?.findByName('Camera');
                if (camera) {
                    camera.setLocalPosition(
                        this.originalCameraPos.x,
                        this.originalCameraPos.y,
                        this.originalCameraPos.z
                    );
                }
                this.originalCameraPos = null;
            }
            this.shakeIntensity = 0;
            this.shakeDuration = 0;
            return;
        }

        // Apply shake
        const decay = 1 - (this.shakeElapsed / this.shakeDuration);
        const camera = this.app?.root?.findByName('Camera');
        if (camera && this.originalCameraPos) {
            const offsetX = (Math.random() - 0.5) * this.shakeIntensity * decay;
            const offsetY = (Math.random() - 0.5) * this.shakeIntensity * decay;

            camera.setLocalPosition(
                this.originalCameraPos.x + offsetX,
                this.originalCameraPos.y + offsetY,
                this.originalCameraPos.z
            );
        }
    }

    /**
     * Crossfade (for background changes)
     */
    async crossfade(duration: number = 0.5): Promise<void> {
        return this.transition({
            type: 'crossfade',
            duration,
            easing: 'ease-in-out'
        });
    }

    /**
     * Dissolve effect
     */
    async dissolve(duration: number = 1.0): Promise<void> {
        return this.transition({
            type: 'dissolve',
            duration,
            easing: 'linear'
        });
    }

    /**
     * Slide transition
     */
    async slide(
        direction: 'left' | 'right' | 'up' | 'down',
        duration: number = 0.5,
        targetEntity?: any
    ): Promise<void> {
        const typeMap: Record<string, TransitionType> = {
            'left': 'slide-left',
            'right': 'slide-right',
            'up': 'slide-up',
            'down': 'slide-down'
        };

        return this.transition({
            type: typeMap[direction],
            duration,
            easing: 'ease-in-out',
            params: { targetEntity }
        });
    }

    /**
     * Zoom transition
     */
    async zoom(
        direction: 'in' | 'out',
        duration: number = 0.5,
        targetEntity?: any
    ): Promise<void> {
        return this.transition({
            type: direction === 'in' ? 'zoom-in' : 'zoom-out',
            duration,
            easing: 'ease-out',
            params: { targetEntity }
        });
    }

    /**
     * Check if a transition is currently running
     */
    isTransitioning(): boolean {
        return this.currentState?.active || false;
    }

    /**
     * Cancel current transition
     */
    cancel(): void {
        if (this.currentState) {
            this.completeTransition();
        }
    }

    /**
     * Skip to end of transition
     */
    skip(): void {
        if (this.currentState) {
            this.currentState.progress = 1;
            this.updateTransition(1);
            this.completeTransition();
        }
    }
}

// Singleton instance
const vnTransitionManager = new VNTransitionManager();

export { vnTransitionManager, VNTransitionManager };

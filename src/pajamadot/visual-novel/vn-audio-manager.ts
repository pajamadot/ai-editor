/**
 * VN Audio Manager
 * Handles audio playback for visual novels including BGM, SFX, and voice
 *
 * Features:
 * - BGM with crossfade transitions
 * - SFX with spatial positioning
 * - Voice playback with queuing
 * - Volume control per channel
 * - Save/restore audio state
 */

import type { VNSettings } from './vn-types';

declare const pc: any;

/**
 * Audio channel types
 */
export type AudioChannel = 'bgm' | 'sfx' | 'voice' | 'ambient';

/**
 * Audio state for save/load
 */
export interface VNAudioState {
    currentBGM: string | null;
    bgmPosition: number;
    currentAmbient: string | null;
    ambientPosition: number;
}

/**
 * Audio playback options
 */
export interface AudioPlayOptions {
    volume?: number;
    loop?: boolean;
    fadeIn?: number;
    fadeOut?: number;
    startTime?: number;
    pitch?: number;
    onEnd?: () => void;
}

/**
 * BGM track info
 */
export interface BGMTrack {
    id: string;
    url: string;
    title?: string;
    artist?: string;
    loopStart?: number;
    loopEnd?: number;
}

/**
 * VN Audio Manager
 * Manages all audio playback for visual novels
 */
class VNAudioManager {
    private _app: any = null;
    private _initialized: boolean = false;

    // Audio context
    private _audioContext: AudioContext | null = null;

    // Channel volumes
    private _masterVolume: number = 1.0;
    private _bgmVolume: number = 0.7;
    private _sfxVolume: number = 0.8;
    private _voiceVolume: number = 1.0;
    private _ambientVolume: number = 0.5;

    // Currently playing audio
    private _currentBGM: {
        source: AudioBufferSourceNode | null;
        gainNode: GainNode | null;
        track: BGMTrack | null;
        startTime: number;
    } | null = null;

    private _currentAmbient: {
        source: AudioBufferSourceNode | null;
        gainNode: GainNode | null;
        url: string | null;
    } | null = null;

    private _currentVoice: {
        source: AudioBufferSourceNode | null;
        gainNode: GainNode | null;
    } | null = null;

    // Audio buffers cache
    private _bufferCache: Map<string, AudioBuffer> = new Map();

    // Voice queue
    private _voiceQueue: Array<{ url: string; options?: AudioPlayOptions }> = [];
    private _isPlayingVoice: boolean = false;

    // Fade state
    private _isFading: boolean = false;
    private _fadeInterval: number | null = null;

    /**
     * Initialize the audio manager
     */
    initialize(app: any): void {
        if (this._initialized) return;

        this._app = app;

        // Create audio context
        this._audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

        // Handle suspended context (autoplay policy)
        if (this._audioContext.state === 'suspended') {
            const resumeContext = () => {
                this._audioContext?.resume();
                document.removeEventListener('click', resumeContext);
                document.removeEventListener('keydown', resumeContext);
            };
            document.addEventListener('click', resumeContext);
            document.addEventListener('keydown', resumeContext);
        }

        this._initialized = true;
        console.log('[VNAudioManager] Initialized');
    }

    /**
     * Cleanup
     */
    destroy(): void {
        this.stopAll();

        if (this._audioContext) {
            this._audioContext.close();
            this._audioContext = null;
        }

        this._bufferCache.clear();
        this._voiceQueue = [];
        this._initialized = false;

        console.log('[VNAudioManager] Destroyed');
    }

    // ========================================================================
    // Volume Control
    // ========================================================================

    /**
     * Apply settings
     */
    applySettings(settings: VNSettings): void {
        this._masterVolume = settings.masterVolume;
        this._bgmVolume = settings.bgmVolume;
        this._sfxVolume = settings.sfxVolume;
        this._voiceVolume = settings.voiceVolume;

        // Update currently playing audio
        this.updateVolumes();
    }

    /**
     * Set master volume
     */
    setMasterVolume(volume: number): void {
        this._masterVolume = Math.max(0, Math.min(1, volume));
        this.updateVolumes();
    }

    /**
     * Set channel volume
     */
    setChannelVolume(channel: AudioChannel, volume: number): void {
        const clampedVolume = Math.max(0, Math.min(1, volume));

        switch (channel) {
            case 'bgm':
                this._bgmVolume = clampedVolume;
                break;
            case 'sfx':
                this._sfxVolume = clampedVolume;
                break;
            case 'voice':
                this._voiceVolume = clampedVolume;
                break;
            case 'ambient':
                this._ambientVolume = clampedVolume;
                break;
        }

        this.updateVolumes();
    }

    /**
     * Get channel volume
     */
    getChannelVolume(channel: AudioChannel): number {
        switch (channel) {
            case 'bgm': return this._bgmVolume;
            case 'sfx': return this._sfxVolume;
            case 'voice': return this._voiceVolume;
            case 'ambient': return this._ambientVolume;
        }
    }

    /**
     * Get effective volume for a channel
     */
    getEffectiveVolume(channel: AudioChannel): number {
        return this._masterVolume * this.getChannelVolume(channel);
    }

    /**
     * Update volumes for currently playing audio
     */
    private updateVolumes(): void {
        if (this._currentBGM?.gainNode) {
            this._currentBGM.gainNode.gain.value = this.getEffectiveVolume('bgm');
        }

        if (this._currentAmbient?.gainNode) {
            this._currentAmbient.gainNode.gain.value = this.getEffectiveVolume('ambient');
        }

        if (this._currentVoice?.gainNode) {
            this._currentVoice.gainNode.gain.value = this.getEffectiveVolume('voice');
        }
    }

    // ========================================================================
    // BGM (Background Music)
    // ========================================================================

    /**
     * Play background music
     */
    async playBGM(
        track: BGMTrack | string,
        options: AudioPlayOptions = {}
    ): Promise<void> {
        if (!this._audioContext) return;

        const trackInfo: BGMTrack = typeof track === 'string'
            ? { id: track, url: track }
            : track;

        // If same track is playing, do nothing
        if (this._currentBGM?.track?.id === trackInfo.id) return;

        // Fade out current BGM
        if (this._currentBGM?.source) {
            await this.fadeOutBGM(options.fadeOut || 0.5);
        }

        try {
            // Load audio buffer
            const buffer = await this.loadAudioBuffer(trackInfo.url);

            // Create nodes
            const source = this._audioContext.createBufferSource();
            const gainNode = this._audioContext.createGain();

            source.buffer = buffer;
            source.loop = options.loop !== false;

            // Set loop points if specified
            if (trackInfo.loopStart !== undefined) {
                source.loopStart = trackInfo.loopStart;
            }
            if (trackInfo.loopEnd !== undefined) {
                source.loopEnd = trackInfo.loopEnd;
            }

            // Connect nodes
            source.connect(gainNode);
            gainNode.connect(this._audioContext.destination);

            // Start with fade in
            const fadeInTime = options.fadeIn || 0.5;
            if (fadeInTime > 0) {
                gainNode.gain.setValueAtTime(0, this._audioContext.currentTime);
                gainNode.gain.linearRampToValueAtTime(
                    this.getEffectiveVolume('bgm'),
                    this._audioContext.currentTime + fadeInTime
                );
            } else {
                gainNode.gain.value = this.getEffectiveVolume('bgm');
            }

            // Start playback
            source.start(0, options.startTime || 0);

            // Store reference
            this._currentBGM = {
                source,
                gainNode,
                track: trackInfo,
                startTime: this._audioContext.currentTime - (options.startTime || 0)
            };

            // Handle end
            source.onended = () => {
                if (this._currentBGM?.source === source) {
                    if (!source.loop) {
                        this._currentBGM = null;
                    }
                }
                options.onEnd?.();
            };

            console.log('[VNAudioManager] Playing BGM:', trackInfo.id);

        } catch (error) {
            console.error('[VNAudioManager] Failed to play BGM:', error);
        }
    }

    /**
     * Stop BGM with optional fade
     */
    async stopBGM(fadeTime: number = 0.5): Promise<void> {
        if (!this._currentBGM?.source) return;

        await this.fadeOutBGM(fadeTime);
    }

    /**
     * Fade out BGM
     */
    private async fadeOutBGM(duration: number): Promise<void> {
        return new Promise((resolve) => {
            if (!this._currentBGM?.gainNode || !this._audioContext) {
                resolve();
                return;
            }

            const gainNode = this._currentBGM.gainNode;
            const source = this._currentBGM.source;

            if (duration > 0) {
                gainNode.gain.linearRampToValueAtTime(
                    0,
                    this._audioContext.currentTime + duration
                );

                setTimeout(() => {
                    source?.stop();
                    this._currentBGM = null;
                    resolve();
                }, duration * 1000);
            } else {
                source?.stop();
                this._currentBGM = null;
                resolve();
            }
        });
    }

    /**
     * Crossfade to new BGM
     */
    async crossfadeBGM(
        newTrack: BGMTrack | string,
        duration: number = 1.0
    ): Promise<void> {
        // Start new track with fade in while fading out old
        const fadeOutPromise = this.stopBGM(duration);

        await this.playBGM(newTrack, {
            fadeIn: duration,
            loop: true
        });

        await fadeOutPromise;
    }

    /**
     * Pause BGM
     */
    pauseBGM(): void {
        if (this._audioContext && this._audioContext.state === 'running') {
            this._audioContext.suspend();
        }
    }

    /**
     * Resume BGM
     */
    resumeBGM(): void {
        if (this._audioContext && this._audioContext.state === 'suspended') {
            this._audioContext.resume();
        }
    }

    /**
     * Get current BGM position
     */
    getBGMPosition(): number {
        if (!this._currentBGM?.source || !this._audioContext) return 0;
        return this._audioContext.currentTime - this._currentBGM.startTime;
    }

    /**
     * Get current BGM track info
     */
    getCurrentBGM(): BGMTrack | null {
        return this._currentBGM?.track || null;
    }

    // ========================================================================
    // SFX (Sound Effects)
    // ========================================================================

    /**
     * Play sound effect
     */
    async playSFX(
        url: string,
        options: AudioPlayOptions = {}
    ): Promise<void> {
        if (!this._audioContext) return;

        try {
            const buffer = await this.loadAudioBuffer(url);

            const source = this._audioContext.createBufferSource();
            const gainNode = this._audioContext.createGain();

            source.buffer = buffer;
            source.loop = options.loop || false;

            if (options.pitch !== undefined) {
                source.playbackRate.value = options.pitch;
            }

            source.connect(gainNode);
            gainNode.connect(this._audioContext.destination);

            const volume = (options.volume ?? 1) * this.getEffectiveVolume('sfx');
            gainNode.gain.value = volume;

            source.start(0);

            source.onended = () => {
                options.onEnd?.();
            };

        } catch (error) {
            console.error('[VNAudioManager] Failed to play SFX:', error);
        }
    }

    /**
     * Play UI sound effect
     */
    playUISound(type: 'click' | 'hover' | 'confirm' | 'cancel' | 'save' | 'load'): void {
        // These would be preloaded UI sounds
        // For now, just log
        console.log('[VNAudioManager] UI sound:', type);
    }

    // ========================================================================
    // Voice
    // ========================================================================

    /**
     * Play voice line
     */
    async playVoice(
        url: string,
        options: AudioPlayOptions = {}
    ): Promise<void> {
        if (!this._audioContext) return;

        // Stop current voice if playing
        this.stopVoice();

        try {
            const buffer = await this.loadAudioBuffer(url);

            const source = this._audioContext.createBufferSource();
            const gainNode = this._audioContext.createGain();

            source.buffer = buffer;
            source.loop = false;

            source.connect(gainNode);
            gainNode.connect(this._audioContext.destination);

            gainNode.gain.value = this.getEffectiveVolume('voice');

            source.start(0);

            this._currentVoice = { source, gainNode };
            this._isPlayingVoice = true;

            source.onended = () => {
                this._currentVoice = null;
                this._isPlayingVoice = false;
                options.onEnd?.();

                // Play next queued voice
                this.processVoiceQueue();
            };

        } catch (error) {
            console.error('[VNAudioManager] Failed to play voice:', error);
        }
    }

    /**
     * Queue voice line for sequential playback
     */
    queueVoice(url: string, options?: AudioPlayOptions): void {
        this._voiceQueue.push({ url, options });

        if (!this._isPlayingVoice) {
            this.processVoiceQueue();
        }
    }

    /**
     * Process voice queue
     */
    private async processVoiceQueue(): Promise<void> {
        if (this._voiceQueue.length === 0 || this._isPlayingVoice) return;

        const next = this._voiceQueue.shift();
        if (next) {
            await this.playVoice(next.url, next.options);
        }
    }

    /**
     * Stop current voice
     */
    stopVoice(): void {
        if (this._currentVoice?.source) {
            this._currentVoice.source.stop();
            this._currentVoice = null;
            this._isPlayingVoice = false;
        }
    }

    /**
     * Clear voice queue
     */
    clearVoiceQueue(): void {
        this._voiceQueue = [];
    }

    /**
     * Check if voice is playing
     */
    isVoicePlaying(): boolean {
        return this._isPlayingVoice;
    }

    // ========================================================================
    // Ambient
    // ========================================================================

    /**
     * Play ambient sound (loops)
     */
    async playAmbient(
        url: string,
        options: AudioPlayOptions = {}
    ): Promise<void> {
        if (!this._audioContext) return;

        // Stop current ambient
        this.stopAmbient();

        try {
            const buffer = await this.loadAudioBuffer(url);

            const source = this._audioContext.createBufferSource();
            const gainNode = this._audioContext.createGain();

            source.buffer = buffer;
            source.loop = true;

            source.connect(gainNode);
            gainNode.connect(this._audioContext.destination);

            // Fade in
            const fadeIn = options.fadeIn || 1.0;
            gainNode.gain.setValueAtTime(0, this._audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(
                this.getEffectiveVolume('ambient'),
                this._audioContext.currentTime + fadeIn
            );

            source.start(0);

            this._currentAmbient = { source, gainNode, url };

            console.log('[VNAudioManager] Playing ambient:', url);

        } catch (error) {
            console.error('[VNAudioManager] Failed to play ambient:', error);
        }
    }

    /**
     * Stop ambient sound
     */
    async stopAmbient(fadeTime: number = 1.0): Promise<void> {
        return new Promise((resolve) => {
            if (!this._currentAmbient?.gainNode || !this._audioContext) {
                resolve();
                return;
            }

            const gainNode = this._currentAmbient.gainNode;
            const source = this._currentAmbient.source;

            gainNode.gain.linearRampToValueAtTime(
                0,
                this._audioContext.currentTime + fadeTime
            );

            setTimeout(() => {
                source?.stop();
                this._currentAmbient = null;
                resolve();
            }, fadeTime * 1000);
        });
    }

    // ========================================================================
    // Utility
    // ========================================================================

    /**
     * Load audio buffer from URL
     */
    private async loadAudioBuffer(url: string): Promise<AudioBuffer> {
        // Check cache
        const cached = this._bufferCache.get(url);
        if (cached) return cached;

        // Fetch and decode
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this._audioContext!.decodeAudioData(arrayBuffer);

        // Cache it
        this._bufferCache.set(url, audioBuffer);

        return audioBuffer;
    }

    /**
     * Preload audio files
     */
    async preload(urls: string[]): Promise<void> {
        const promises = urls.map(url => this.loadAudioBuffer(url));
        await Promise.all(promises);
    }

    /**
     * Clear audio cache
     */
    clearCache(): void {
        this._bufferCache.clear();
    }

    /**
     * Stop all audio
     */
    stopAll(): void {
        this.stopBGM(0);
        this.stopVoice();
        this.stopAmbient(0);
        this.clearVoiceQueue();
    }

    /**
     * Get audio state for saving
     */
    getState(): VNAudioState {
        return {
            currentBGM: this._currentBGM?.track?.id || null,
            bgmPosition: this.getBGMPosition(),
            currentAmbient: this._currentAmbient?.url || null,
            ambientPosition: 0 // Ambient loops, position doesn't matter
        };
    }

    /**
     * Restore audio state from save
     */
    async restoreState(state: VNAudioState): Promise<void> {
        // Stop current audio
        this.stopAll();

        // Restore BGM
        if (state.currentBGM) {
            await this.playBGM(
                { id: state.currentBGM, url: state.currentBGM },
                {
                    startTime: state.bgmPosition,
                    fadeIn: 0.5
                }
            );
        }

        // Restore ambient
        if (state.currentAmbient) {
            await this.playAmbient(state.currentAmbient, { fadeIn: 0.5 });
        }
    }

    /**
     * Check if audio manager is ready
     */
    isReady(): boolean {
        return this._initialized && this._audioContext?.state === 'running';
    }
}

// Singleton instance
const vnAudioManager = new VNAudioManager();

export { vnAudioManager, VNAudioManager };

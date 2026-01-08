/**
 * VN Gallery System
 * Unlockable galleries for CGs, music, and scenes
 *
 * Features:
 * - CG Gallery with unlock tracking
 * - Music Gallery with jukebox
 * - Scene Replay
 * - Achievement display
 */

import type { VNGlobalData } from './vn-types';

declare const pc: any;

/**
 * CG (Computer Graphics) entry
 */
export interface CGEntry {
    id: string;
    title: string;
    description?: string;
    thumbnailUrl: string;
    fullImageUrl: string;
    unlockCondition?: string;
    category?: string;
    sceneId?: string;
    order: number;
}

/**
 * Music track entry
 */
export interface MusicEntry {
    id: string;
    title: string;
    artist?: string;
    albumArt?: string;
    audioUrl: string;
    duration?: number;
    category?: string;
    order: number;
}

/**
 * Scene replay entry
 */
export interface SceneEntry {
    id: string;
    title: string;
    description?: string;
    thumbnailUrl?: string;
    nodeId: string;
    chapter?: string;
    order: number;
}

/**
 * Achievement entry
 */
export interface AchievementEntry {
    id: string;
    title: string;
    description: string;
    iconUrl?: string;
    iconLockedUrl?: string;
    points?: number;
    secret?: boolean;
    order: number;
}

/**
 * Gallery configuration
 */
export interface GalleryConfig {
    cgs: CGEntry[];
    music: MusicEntry[];
    scenes: SceneEntry[];
    achievements: AchievementEntry[];
}

/**
 * Gallery view state
 */
type GalleryView = 'cg' | 'music' | 'scene' | 'achievement';

/**
 * VN Gallery
 * Manages unlockable content galleries
 */
class VNGallery {
    private _config: GalleryConfig = {
        cgs: [],
        music: [],
        scenes: [],
        achievements: []
    };

    private _globalData: VNGlobalData | null = null;
    private _currentView: GalleryView = 'cg';

    // UI elements (if using DOM)
    private _container: HTMLElement | null = null;
    private _isOpen: boolean = false;

    // Callbacks
    private _onPlayMusic: ((entry: MusicEntry) => void) | null = null;
    private _onReplayScene: ((entry: SceneEntry) => void) | null = null;
    private _onViewCG: ((entry: CGEntry) => void) | null = null;

    /**
     * Initialize gallery with configuration
     */
    initialize(config: GalleryConfig): void {
        this._config = config;

        // Sort entries by order
        this._config.cgs.sort((a, b) => a.order - b.order);
        this._config.music.sort((a, b) => a.order - b.order);
        this._config.scenes.sort((a, b) => a.order - b.order);
        this._config.achievements.sort((a, b) => a.order - b.order);

        console.log('[VNGallery] Initialized with', {
            cgs: this._config.cgs.length,
            music: this._config.music.length,
            scenes: this._config.scenes.length,
            achievements: this._config.achievements.length
        });
    }

    /**
     * Set global data for unlock tracking
     */
    setGlobalData(data: VNGlobalData): void {
        this._globalData = data;
    }

    /**
     * Set callbacks
     */
    setCallbacks(callbacks: {
        onPlayMusic?: (entry: MusicEntry) => void;
        onReplayScene?: (entry: SceneEntry) => void;
        onViewCG?: (entry: CGEntry) => void;
    }): void {
        this._onPlayMusic = callbacks.onPlayMusic || null;
        this._onReplayScene = callbacks.onReplayScene || null;
        this._onViewCG = callbacks.onViewCG || null;
    }

    // ========================================================================
    // CG Gallery
    // ========================================================================

    /**
     * Get all CGs with unlock status
     */
    getAllCGs(): Array<CGEntry & { unlocked: boolean }> {
        return this._config.cgs.map(cg => ({
            ...cg,
            unlocked: this.isCGUnlocked(cg.id)
        }));
    }

    /**
     * Get CGs by category
     */
    getCGsByCategory(category: string): Array<CGEntry & { unlocked: boolean }> {
        return this.getAllCGs().filter(cg => cg.category === category);
    }

    /**
     * Check if CG is unlocked
     */
    isCGUnlocked(cgId: string): boolean {
        return this._globalData?.unlockedCGs.includes(cgId) || false;
    }

    /**
     * Get CG unlock progress
     */
    getCGProgress(): { unlocked: number; total: number; percentage: number } {
        const total = this._config.cgs.length;
        const unlocked = this._config.cgs.filter(cg => this.isCGUnlocked(cg.id)).length;
        return {
            unlocked,
            total,
            percentage: total > 0 ? Math.round((unlocked / total) * 100) : 0
        };
    }

    /**
     * View a CG
     */
    viewCG(cgId: string): void {
        if (!this.isCGUnlocked(cgId)) {
            console.warn('[VNGallery] CG not unlocked:', cgId);
            return;
        }

        const cg = this._config.cgs.find(c => c.id === cgId);
        if (cg && this._onViewCG) {
            this._onViewCG(cg);
        }
    }

    // ========================================================================
    // Music Gallery
    // ========================================================================

    /**
     * Get all music tracks with unlock status
     */
    getAllMusic(): Array<MusicEntry & { unlocked: boolean }> {
        return this._config.music.map(track => ({
            ...track,
            unlocked: this.isMusicUnlocked(track.id)
        }));
    }

    /**
     * Get music by category
     */
    getMusicByCategory(category: string): Array<MusicEntry & { unlocked: boolean }> {
        return this.getAllMusic().filter(track => track.category === category);
    }

    /**
     * Check if music track is unlocked
     */
    isMusicUnlocked(trackId: string): boolean {
        return this._globalData?.unlockedMusic.includes(trackId) || false;
    }

    /**
     * Get music unlock progress
     */
    getMusicProgress(): { unlocked: number; total: number; percentage: number } {
        const total = this._config.music.length;
        const unlocked = this._config.music.filter(m => this.isMusicUnlocked(m.id)).length;
        return {
            unlocked,
            total,
            percentage: total > 0 ? Math.round((unlocked / total) * 100) : 0
        };
    }

    /**
     * Play a music track
     */
    playMusic(trackId: string): void {
        if (!this.isMusicUnlocked(trackId)) {
            console.warn('[VNGallery] Music not unlocked:', trackId);
            return;
        }

        const track = this._config.music.find(m => m.id === trackId);
        if (track && this._onPlayMusic) {
            this._onPlayMusic(track);
        }
    }

    // ========================================================================
    // Scene Replay
    // ========================================================================

    /**
     * Get all replayable scenes
     */
    getAllScenes(): SceneEntry[] {
        // Scenes are always available once the story is completed
        // Could add unlock logic based on story progress
        return [...this._config.scenes];
    }

    /**
     * Replay a scene
     */
    replayScene(sceneId: string): void {
        const scene = this._config.scenes.find(s => s.id === sceneId);
        if (scene && this._onReplayScene) {
            this._onReplayScene(scene);
        }
    }

    // ========================================================================
    // Achievements
    // ========================================================================

    /**
     * Get all achievements with unlock status
     */
    getAllAchievements(): Array<AchievementEntry & { unlocked: boolean; unlockedAt?: number }> {
        return this._config.achievements.map(achievement => ({
            ...achievement,
            unlocked: this.isAchievementUnlocked(achievement.id)
        }));
    }

    /**
     * Get visible achievements (hides secret ones if not unlocked)
     */
    getVisibleAchievements(): Array<AchievementEntry & { unlocked: boolean }> {
        return this.getAllAchievements().filter(a => !a.secret || a.unlocked);
    }

    /**
     * Check if achievement is unlocked
     */
    isAchievementUnlocked(achievementId: string): boolean {
        return this._globalData?.achievements.includes(achievementId) || false;
    }

    /**
     * Get achievement progress
     */
    getAchievementProgress(): { unlocked: number; total: number; percentage: number; points: number } {
        const total = this._config.achievements.length;
        const unlockedAchievements = this._config.achievements.filter(a =>
            this.isAchievementUnlocked(a.id)
        );
        const points = unlockedAchievements.reduce((sum, a) => sum + (a.points || 0), 0);

        return {
            unlocked: unlockedAchievements.length,
            total,
            percentage: total > 0 ? Math.round((unlockedAchievements.length / total) * 100) : 0,
            points
        };
    }

    // ========================================================================
    // Overall Progress
    // ========================================================================

    /**
     * Get overall completion percentage
     */
    getOverallProgress(): number {
        const cgProgress = this.getCGProgress();
        const musicProgress = this.getMusicProgress();
        const achievementProgress = this.getAchievementProgress();

        const totalItems = cgProgress.total + musicProgress.total + achievementProgress.total;
        const unlockedItems = cgProgress.unlocked + musicProgress.unlocked + achievementProgress.unlocked;

        return totalItems > 0 ? Math.round((unlockedItems / totalItems) * 100) : 0;
    }

    /**
     * Get completion stats
     */
    getCompletionStats(): {
        cgs: { unlocked: number; total: number };
        music: { unlocked: number; total: number };
        achievements: { unlocked: number; total: number };
        endings: { completed: number; total: number };
        overall: number;
    } {
        return {
            cgs: this.getCGProgress(),
            music: this.getMusicProgress(),
            achievements: this.getAchievementProgress(),
            endings: {
                completed: this._globalData?.completedEndings.length || 0,
                total: 0 // Would need to be configured
            },
            overall: this.getOverallProgress()
        };
    }

    // ========================================================================
    // Gallery UI (DOM-based)
    // ========================================================================

    /**
     * Create gallery UI
     */
    createUI(container: HTMLElement): void {
        this._container = container;
        this.renderGallery();
    }

    /**
     * Open gallery
     */
    open(view: GalleryView = 'cg'): void {
        this._currentView = view;
        this._isOpen = true;
        this.renderGallery();

        if (this._container) {
            this._container.style.display = 'flex';
        }
    }

    /**
     * Close gallery
     */
    close(): void {
        this._isOpen = false;

        if (this._container) {
            this._container.style.display = 'none';
        }
    }

    /**
     * Render gallery
     */
    private renderGallery(): void {
        if (!this._container) return;

        this._container.innerHTML = `
            <style>
                .vn-gallery {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.95);
                    display: flex;
                    flex-direction: column;
                    z-index: 1000;
                }

                .vn-gallery-header {
                    display: flex;
                    padding: 20px;
                    background: linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 100%);
                }

                .vn-gallery-tabs {
                    display: flex;
                    gap: 10px;
                    flex: 1;
                }

                .vn-gallery-tab {
                    padding: 10px 20px;
                    background: rgba(255, 255, 255, 0.1);
                    border: none;
                    border-radius: 8px;
                    color: #fff;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.2s;
                }

                .vn-gallery-tab:hover {
                    background: rgba(255, 255, 255, 0.2);
                }

                .vn-gallery-tab.active {
                    background: rgba(233, 69, 96, 0.8);
                }

                .vn-gallery-close {
                    padding: 10px 20px;
                    background: none;
                    border: none;
                    color: #fff;
                    cursor: pointer;
                    font-size: 24px;
                }

                .vn-gallery-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                }

                .vn-gallery-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 20px;
                }

                .vn-gallery-item {
                    position: relative;
                    aspect-ratio: 16/9;
                    border-radius: 8px;
                    overflow: hidden;
                    cursor: pointer;
                    transition: transform 0.2s;
                }

                .vn-gallery-item:hover {
                    transform: scale(1.05);
                }

                .vn-gallery-item img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .vn-gallery-item.locked {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .vn-gallery-item.locked::after {
                    content: '🔒';
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    font-size: 48px;
                }

                .vn-gallery-item-title {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    padding: 10px;
                    background: linear-gradient(transparent, rgba(0,0,0,0.8));
                    color: #fff;
                    font-size: 12px;
                }

                .vn-music-list {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .vn-music-item {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    padding: 15px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 8px;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .vn-music-item:hover {
                    background: rgba(255, 255, 255, 0.1);
                }

                .vn-music-item.locked {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .vn-music-cover {
                    width: 60px;
                    height: 60px;
                    border-radius: 4px;
                    object-fit: cover;
                    background: #333;
                }

                .vn-music-info {
                    flex: 1;
                }

                .vn-music-title {
                    color: #fff;
                    font-size: 16px;
                    margin-bottom: 4px;
                }

                .vn-music-artist {
                    color: #888;
                    font-size: 12px;
                }

                .vn-music-play {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: rgba(233, 69, 96, 0.8);
                    border: none;
                    color: #fff;
                    cursor: pointer;
                    font-size: 16px;
                }

                .vn-achievement-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 15px;
                }

                .vn-achievement-item {
                    display: flex;
                    gap: 15px;
                    padding: 15px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 8px;
                }

                .vn-achievement-item.locked {
                    opacity: 0.5;
                }

                .vn-achievement-icon {
                    width: 50px;
                    height: 50px;
                    border-radius: 8px;
                    object-fit: cover;
                    background: #333;
                }

                .vn-achievement-info {
                    flex: 1;
                }

                .vn-achievement-title {
                    color: #fff;
                    font-size: 14px;
                    font-weight: bold;
                    margin-bottom: 4px;
                }

                .vn-achievement-desc {
                    color: #888;
                    font-size: 12px;
                }

                .vn-progress-bar {
                    margin-bottom: 20px;
                    padding: 10px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 8px;
                }

                .vn-progress-label {
                    display: flex;
                    justify-content: space-between;
                    color: #fff;
                    font-size: 14px;
                    margin-bottom: 8px;
                }

                .vn-progress-track {
                    height: 8px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 4px;
                    overflow: hidden;
                }

                .vn-progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #e94560, #f97316);
                    border-radius: 4px;
                    transition: width 0.3s;
                }
            </style>

            <div class="vn-gallery">
                <div class="vn-gallery-header">
                    <div class="vn-gallery-tabs">
                        <button class="vn-gallery-tab ${this._currentView === 'cg' ? 'active' : ''}" data-view="cg">
                            CG Gallery
                        </button>
                        <button class="vn-gallery-tab ${this._currentView === 'music' ? 'active' : ''}" data-view="music">
                            Music
                        </button>
                        <button class="vn-gallery-tab ${this._currentView === 'scene' ? 'active' : ''}" data-view="scene">
                            Scene Replay
                        </button>
                        <button class="vn-gallery-tab ${this._currentView === 'achievement' ? 'active' : ''}" data-view="achievement">
                            Achievements
                        </button>
                    </div>
                    <button class="vn-gallery-close">×</button>
                </div>
                <div class="vn-gallery-content">
                    ${this.renderContent()}
                </div>
            </div>
        `;

        // Add event listeners
        this.setupEventListeners();
    }

    /**
     * Render content based on current view
     */
    private renderContent(): string {
        switch (this._currentView) {
            case 'cg':
                return this.renderCGGallery();
            case 'music':
                return this.renderMusicGallery();
            case 'scene':
                return this.renderSceneGallery();
            case 'achievement':
                return this.renderAchievementGallery();
        }
    }

    private renderCGGallery(): string {
        const progress = this.getCGProgress();
        const cgs = this.getAllCGs();

        return `
            <div class="vn-progress-bar">
                <div class="vn-progress-label">
                    <span>CG Collection</span>
                    <span>${progress.unlocked} / ${progress.total} (${progress.percentage}%)</span>
                </div>
                <div class="vn-progress-track">
                    <div class="vn-progress-fill" style="width: ${progress.percentage}%"></div>
                </div>
            </div>
            <div class="vn-gallery-grid">
                ${cgs.map(cg => `
                    <div class="vn-gallery-item ${cg.unlocked ? '' : 'locked'}" data-id="${cg.id}" data-type="cg">
                        <img src="${cg.unlocked ? cg.thumbnailUrl : ''}" alt="${cg.title}">
                        <div class="vn-gallery-item-title">${cg.unlocked ? cg.title : '???'}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    private renderMusicGallery(): string {
        const progress = this.getMusicProgress();
        const music = this.getAllMusic();

        return `
            <div class="vn-progress-bar">
                <div class="vn-progress-label">
                    <span>Music Collection</span>
                    <span>${progress.unlocked} / ${progress.total} (${progress.percentage}%)</span>
                </div>
                <div class="vn-progress-track">
                    <div class="vn-progress-fill" style="width: ${progress.percentage}%"></div>
                </div>
            </div>
            <div class="vn-music-list">
                ${music.map(track => `
                    <div class="vn-music-item ${track.unlocked ? '' : 'locked'}" data-id="${track.id}" data-type="music">
                        ${track.albumArt ? `<img class="vn-music-cover" src="${track.albumArt}" alt="">` : '<div class="vn-music-cover"></div>'}
                        <div class="vn-music-info">
                            <div class="vn-music-title">${track.unlocked ? track.title : '???'}</div>
                            <div class="vn-music-artist">${track.unlocked ? (track.artist || 'Unknown') : '???'}</div>
                        </div>
                        ${track.unlocked ? '<button class="vn-music-play">▶</button>' : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }

    private renderSceneGallery(): string {
        const scenes = this.getAllScenes();

        return `
            <div class="vn-gallery-grid">
                ${scenes.map(scene => `
                    <div class="vn-gallery-item" data-id="${scene.id}" data-type="scene">
                        <img src="${scene.thumbnailUrl || ''}" alt="${scene.title}">
                        <div class="vn-gallery-item-title">${scene.title}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    private renderAchievementGallery(): string {
        const progress = this.getAchievementProgress();
        const achievements = this.getVisibleAchievements();

        return `
            <div class="vn-progress-bar">
                <div class="vn-progress-label">
                    <span>Achievements</span>
                    <span>${progress.unlocked} / ${progress.total} (${progress.points} pts)</span>
                </div>
                <div class="vn-progress-track">
                    <div class="vn-progress-fill" style="width: ${progress.percentage}%"></div>
                </div>
            </div>
            <div class="vn-achievement-grid">
                ${achievements.map(achievement => `
                    <div class="vn-achievement-item ${achievement.unlocked ? '' : 'locked'}">
                        <img class="vn-achievement-icon" src="${achievement.unlocked ? (achievement.iconUrl || '') : (achievement.iconLockedUrl || '')}" alt="">
                        <div class="vn-achievement-info">
                            <div class="vn-achievement-title">${achievement.unlocked ? achievement.title : '???'}</div>
                            <div class="vn-achievement-desc">${achievement.unlocked ? achievement.description : 'Achievement locked'}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Setup event listeners
     */
    private setupEventListeners(): void {
        if (!this._container) return;

        // Tab clicks
        this._container.querySelectorAll('.vn-gallery-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const view = tab.getAttribute('data-view') as GalleryView;
                if (view) {
                    this._currentView = view;
                    this.renderGallery();
                }
            });
        });

        // Close button
        const closeBtn = this._container.querySelector('.vn-gallery-close');
        closeBtn?.addEventListener('click', () => this.close());

        // Item clicks
        this._container.querySelectorAll('.vn-gallery-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.getAttribute('data-id');
                const type = item.getAttribute('data-type');
                if (!id) return;

                if (item.classList.contains('locked')) return;

                switch (type) {
                    case 'cg':
                        this.viewCG(id);
                        break;
                    case 'scene':
                        this.replayScene(id);
                        break;
                }
            });
        });

        // Music play buttons
        this._container.querySelectorAll('.vn-music-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.getAttribute('data-id');
                if (id && !item.classList.contains('locked')) {
                    this.playMusic(id);
                }
            });
        });
    }

    /**
     * Check if gallery is open
     */
    isOpen(): boolean {
        return this._isOpen;
    }
}

// Singleton instance
const vnGallery = new VNGallery();

export { vnGallery, VNGallery };

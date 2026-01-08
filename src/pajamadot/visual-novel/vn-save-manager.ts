/**
 * VN Save Manager
 * Handles saving and loading visual novel game state
 *
 * Features:
 * - Multiple save slots
 * - Auto-save functionality
 * - Thumbnail screenshots
 * - Global data persistence (achievements, unlocks)
 * - Cloud sync support (via callbacks)
 */

import type {
    VNSaveData,
    VNGlobalData,
    VNRuntimeState,
    VNSettings,
    getDefaultVNSettings
} from './vn-types';

/**
 * Save manager configuration
 */
export interface VNSaveManagerConfig {
    /** Maximum number of save slots */
    maxSlots: number;

    /** Enable auto-save */
    autoSaveEnabled: boolean;

    /** Auto-save interval in seconds */
    autoSaveInterval: number;

    /** Storage key prefix */
    storagePrefix: string;

    /** Enable cloud sync callbacks */
    cloudSyncEnabled: boolean;

    /** Cloud sync upload callback */
    onCloudUpload?: (key: string, data: string) => Promise<void>;

    /** Cloud sync download callback */
    onCloudDownload?: (key: string) => Promise<string | null>;

    /** Screenshot capture callback */
    onCaptureScreenshot?: () => Promise<string | null>;
}

/**
 * Default save manager configuration
 */
export function getDefaultSaveManagerConfig(): VNSaveManagerConfig {
    return {
        maxSlots: 20,
        autoSaveEnabled: true,
        autoSaveInterval: 60, // 1 minute
        storagePrefix: 'vn_save_',
        cloudSyncEnabled: false
    };
}

/**
 * Save slot info for listing
 */
export interface SaveSlotInfo {
    slotId: number;
    label: string;
    storyId: string;
    thumbnail?: string;
    createdAt: number;
    updatedAt: number;
    playtime: number;
    isEmpty: boolean;
}

/**
 * VN Save Manager
 * Manages save/load operations for visual novel state
 */
class VNSaveManager {
    private config: VNSaveManagerConfig;
    private globalData: VNGlobalData | null = null;
    private autoSaveTimer: number | null = null;
    private currentStoryId: string = '';
    private lastSaveTime: number = 0;

    constructor(config: Partial<VNSaveManagerConfig> = {}) {
        this.config = { ...getDefaultSaveManagerConfig(), ...config };
    }

    /**
     * Initialize save manager for a story
     */
    initialize(storyId: string): void {
        this.currentStoryId = storyId;
        this.loadGlobalData();

        if (this.config.autoSaveEnabled) {
            this.startAutoSave();
        }

        console.log('[VNSaveManager] Initialized for story:', storyId);
    }

    /**
     * Cleanup when done
     */
    destroy(): void {
        this.stopAutoSave();
        this.currentStoryId = '';
        console.log('[VNSaveManager] Destroyed');
    }

    // ========================================================================
    // Save Operations
    // ========================================================================

    /**
     * Save game state to a slot
     */
    async save(
        slotId: number,
        state: VNRuntimeState,
        label?: string
    ): Promise<boolean> {
        try {
            if (slotId < 0 || slotId >= this.config.maxSlots) {
                console.error('[VNSaveManager] Invalid slot ID:', slotId);
                return false;
            }

            // Capture screenshot if available
            let thumbnail: string | undefined;
            if (this.config.onCaptureScreenshot) {
                thumbnail = await this.config.onCaptureScreenshot() || undefined;
            }

            // Get existing save to preserve session count
            const existingSave = this.getSaveData(slotId);
            const sessionCount = existingSave ? existingSave.sessionCount + 1 : 1;

            const now = Date.now();
            const saveData: VNSaveData = {
                slotId,
                label: label || this.generateDefaultLabel(state),
                thumbnail,
                storyId: this.currentStoryId,
                state: this.cloneState(state),
                createdAt: existingSave?.createdAt || now,
                updatedAt: now,
                sessionCount
            };

            // Save to local storage
            const key = this.getSaveKey(slotId);
            localStorage.setItem(key, JSON.stringify(saveData));

            // Cloud sync if enabled
            if (this.config.cloudSyncEnabled && this.config.onCloudUpload) {
                try {
                    await this.config.onCloudUpload(key, JSON.stringify(saveData));
                } catch (e) {
                    console.warn('[VNSaveManager] Cloud sync failed:', e);
                }
            }

            this.lastSaveTime = now;
            console.log('[VNSaveManager] Saved to slot', slotId);
            return true;

        } catch (error) {
            console.error('[VNSaveManager] Save failed:', error);
            return false;
        }
    }

    /**
     * Quick save to slot 0
     */
    async quickSave(state: VNRuntimeState): Promise<boolean> {
        return this.save(0, state, 'Quick Save');
    }

    /**
     * Auto-save to a dedicated slot
     */
    async autoSave(state: VNRuntimeState): Promise<boolean> {
        // Use slot -1 conceptually but stored separately
        const key = `${this.config.storagePrefix}autosave_${this.currentStoryId}`;

        try {
            const saveData: VNSaveData = {
                slotId: -1,
                label: 'Auto Save',
                storyId: this.currentStoryId,
                state: this.cloneState(state),
                createdAt: Date.now(),
                updatedAt: Date.now(),
                sessionCount: 1
            };

            localStorage.setItem(key, JSON.stringify(saveData));
            this.lastSaveTime = Date.now();
            console.log('[VNSaveManager] Auto-saved');
            return true;

        } catch (error) {
            console.error('[VNSaveManager] Auto-save failed:', error);
            return false;
        }
    }

    // ========================================================================
    // Load Operations
    // ========================================================================

    /**
     * Load game state from a slot
     */
    load(slotId: number): VNSaveData | null {
        try {
            const saveData = this.getSaveData(slotId);
            if (!saveData) {
                console.warn('[VNSaveManager] No save found in slot', slotId);
                return null;
            }

            if (saveData.storyId !== this.currentStoryId) {
                console.warn('[VNSaveManager] Save is for different story:', saveData.storyId);
                // Still return it, let caller decide
            }

            console.log('[VNSaveManager] Loaded from slot', slotId);
            return saveData;

        } catch (error) {
            console.error('[VNSaveManager] Load failed:', error);
            return null;
        }
    }

    /**
     * Quick load from slot 0
     */
    quickLoad(): VNSaveData | null {
        return this.load(0);
    }

    /**
     * Load auto-save
     */
    loadAutoSave(): VNSaveData | null {
        try {
            const key = `${this.config.storagePrefix}autosave_${this.currentStoryId}`;
            const json = localStorage.getItem(key);
            if (!json) return null;

            return JSON.parse(json) as VNSaveData;

        } catch (error) {
            console.error('[VNSaveManager] Load auto-save failed:', error);
            return null;
        }
    }

    /**
     * Get save data without loading into runtime
     */
    getSaveData(slotId: number): VNSaveData | null {
        try {
            const key = this.getSaveKey(slotId);
            const json = localStorage.getItem(key);
            if (!json) return null;

            return JSON.parse(json) as VNSaveData;

        } catch {
            return null;
        }
    }

    /**
     * Get all save slot info
     */
    getAllSlots(): SaveSlotInfo[] {
        const slots: SaveSlotInfo[] = [];

        for (let i = 0; i < this.config.maxSlots; i++) {
            const save = this.getSaveData(i);

            if (save) {
                slots.push({
                    slotId: i,
                    label: save.label,
                    storyId: save.storyId,
                    thumbnail: save.thumbnail,
                    createdAt: save.createdAt,
                    updatedAt: save.updatedAt,
                    playtime: save.state.playtime,
                    isEmpty: false
                });
            } else {
                slots.push({
                    slotId: i,
                    label: `Slot ${i + 1}`,
                    storyId: '',
                    createdAt: 0,
                    updatedAt: 0,
                    playtime: 0,
                    isEmpty: true
                });
            }
        }

        return slots;
    }

    /**
     * Delete a save slot
     */
    deleteSave(slotId: number): boolean {
        try {
            const key = this.getSaveKey(slotId);
            localStorage.removeItem(key);
            console.log('[VNSaveManager] Deleted slot', slotId);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Delete all saves for current story
     */
    deleteAllSaves(): void {
        for (let i = 0; i < this.config.maxSlots; i++) {
            this.deleteSave(i);
        }

        // Delete auto-save too
        const autoSaveKey = `${this.config.storagePrefix}autosave_${this.currentStoryId}`;
        localStorage.removeItem(autoSaveKey);

        console.log('[VNSaveManager] Deleted all saves');
    }

    // ========================================================================
    // Global Data (Achievements, Unlocks, Settings)
    // ========================================================================

    /**
     * Load global data
     */
    loadGlobalData(): VNGlobalData {
        if (this.globalData) return this.globalData;

        try {
            const key = `${this.config.storagePrefix}global`;
            const json = localStorage.getItem(key);

            if (json) {
                this.globalData = JSON.parse(json) as VNGlobalData;
            } else {
                this.globalData = this.getDefaultGlobalData();
            }

            return this.globalData;

        } catch {
            this.globalData = this.getDefaultGlobalData();
            return this.globalData;
        }
    }

    /**
     * Save global data
     */
    saveGlobalData(): void {
        if (!this.globalData) return;

        try {
            const key = `${this.config.storagePrefix}global`;
            localStorage.setItem(key, JSON.stringify(this.globalData));
        } catch (error) {
            console.error('[VNSaveManager] Failed to save global data:', error);
        }
    }

    /**
     * Get settings
     */
    getSettings(): VNSettings {
        const global = this.loadGlobalData();
        return global.settings;
    }

    /**
     * Update settings
     */
    updateSettings(settings: Partial<VNSettings>): void {
        const global = this.loadGlobalData();
        global.settings = { ...global.settings, ...settings };
        this.saveGlobalData();
    }

    /**
     * Mark an ending as completed
     */
    completeEnding(endingId: string): void {
        const global = this.loadGlobalData();
        if (!global.completedEndings.includes(endingId)) {
            global.completedEndings.push(endingId);
            this.saveGlobalData();
        }
    }

    /**
     * Check if ending is completed
     */
    isEndingCompleted(endingId: string): boolean {
        const global = this.loadGlobalData();
        return global.completedEndings.includes(endingId);
    }

    /**
     * Unlock a CG
     */
    unlockCG(cgId: string): void {
        const global = this.loadGlobalData();
        if (!global.unlockedCGs.includes(cgId)) {
            global.unlockedCGs.push(cgId);
            this.saveGlobalData();
        }
    }

    /**
     * Get all unlocked CGs
     */
    getUnlockedCGs(): string[] {
        return this.loadGlobalData().unlockedCGs;
    }

    /**
     * Unlock music track
     */
    unlockMusic(trackId: string): void {
        const global = this.loadGlobalData();
        if (!global.unlockedMusic.includes(trackId)) {
            global.unlockedMusic.push(trackId);
            this.saveGlobalData();
        }
    }

    /**
     * Get all unlocked music
     */
    getUnlockedMusic(): string[] {
        return this.loadGlobalData().unlockedMusic;
    }

    /**
     * Award achievement
     */
    awardAchievement(achievementId: string): boolean {
        const global = this.loadGlobalData();
        if (!global.achievements.includes(achievementId)) {
            global.achievements.push(achievementId);
            this.saveGlobalData();
            return true; // Newly awarded
        }
        return false; // Already had it
    }

    /**
     * Check if achievement is earned
     */
    hasAchievement(achievementId: string): boolean {
        return this.loadGlobalData().achievements.includes(achievementId);
    }

    /**
     * Get all achievements
     */
    getAchievements(): string[] {
        return this.loadGlobalData().achievements;
    }

    /**
     * Update total playtime
     */
    addPlaytime(seconds: number): void {
        const global = this.loadGlobalData();
        global.totalPlaytime += seconds;
        this.saveGlobalData();
    }

    /**
     * Get total playtime across all saves
     */
    getTotalPlaytime(): number {
        return this.loadGlobalData().totalPlaytime;
    }

    // ========================================================================
    // Auto-Save
    // ========================================================================

    private autoSaveCallback: (() => VNRuntimeState | null) | null = null;

    /**
     * Set callback to get current state for auto-save
     */
    setAutoSaveCallback(callback: () => VNRuntimeState | null): void {
        this.autoSaveCallback = callback;
    }

    /**
     * Start auto-save timer
     */
    startAutoSave(): void {
        this.stopAutoSave();

        const intervalMs = this.config.autoSaveInterval * 1000;
        this.autoSaveTimer = window.setInterval(() => {
            if (this.autoSaveCallback) {
                const state = this.autoSaveCallback();
                if (state && !state.isPaused && !state.showingChoices) {
                    this.autoSave(state);
                }
            }
        }, intervalMs);

        console.log('[VNSaveManager] Auto-save started, interval:', this.config.autoSaveInterval, 's');
    }

    /**
     * Stop auto-save timer
     */
    stopAutoSave(): void {
        if (this.autoSaveTimer !== null) {
            window.clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }

    // ========================================================================
    // Cloud Sync
    // ========================================================================

    /**
     * Sync all saves to cloud
     */
    async syncToCloud(): Promise<boolean> {
        if (!this.config.cloudSyncEnabled || !this.config.onCloudUpload) {
            return false;
        }

        try {
            // Upload all saves
            for (let i = 0; i < this.config.maxSlots; i++) {
                const save = this.getSaveData(i);
                if (save) {
                    const key = this.getSaveKey(i);
                    await this.config.onCloudUpload(key, JSON.stringify(save));
                }
            }

            // Upload global data
            const globalKey = `${this.config.storagePrefix}global`;
            await this.config.onCloudUpload(globalKey, JSON.stringify(this.globalData));

            console.log('[VNSaveManager] Synced to cloud');
            return true;

        } catch (error) {
            console.error('[VNSaveManager] Cloud sync failed:', error);
            return false;
        }
    }

    /**
     * Download saves from cloud
     */
    async syncFromCloud(): Promise<boolean> {
        if (!this.config.cloudSyncEnabled || !this.config.onCloudDownload) {
            return false;
        }

        try {
            // Download all saves
            for (let i = 0; i < this.config.maxSlots; i++) {
                const key = this.getSaveKey(i);
                const data = await this.config.onCloudDownload(key);
                if (data) {
                    localStorage.setItem(key, data);
                }
            }

            // Download global data
            const globalKey = `${this.config.storagePrefix}global`;
            const globalData = await this.config.onCloudDownload(globalKey);
            if (globalData) {
                localStorage.setItem(globalKey, globalData);
                this.globalData = JSON.parse(globalData);
            }

            console.log('[VNSaveManager] Synced from cloud');
            return true;

        } catch (error) {
            console.error('[VNSaveManager] Cloud download failed:', error);
            return false;
        }
    }

    // ========================================================================
    // Import/Export
    // ========================================================================

    /**
     * Export all saves as JSON
     */
    exportSaves(): string {
        const exportData: {
            saves: (VNSaveData | null)[];
            global: VNGlobalData;
            exportedAt: number;
        } = {
            saves: [],
            global: this.loadGlobalData(),
            exportedAt: Date.now()
        };

        for (let i = 0; i < this.config.maxSlots; i++) {
            exportData.saves.push(this.getSaveData(i));
        }

        return JSON.stringify(exportData, null, 2);
    }

    /**
     * Import saves from JSON
     */
    importSaves(json: string): boolean {
        try {
            const data = JSON.parse(json);

            if (!data.saves || !Array.isArray(data.saves)) {
                console.error('[VNSaveManager] Invalid import data');
                return false;
            }

            // Import saves
            for (let i = 0; i < data.saves.length && i < this.config.maxSlots; i++) {
                const save = data.saves[i];
                if (save) {
                    const key = this.getSaveKey(i);
                    localStorage.setItem(key, JSON.stringify(save));
                }
            }

            // Import global data
            if (data.global) {
                const globalKey = `${this.config.storagePrefix}global`;
                localStorage.setItem(globalKey, JSON.stringify(data.global));
                this.globalData = data.global;
            }

            console.log('[VNSaveManager] Imported saves');
            return true;

        } catch (error) {
            console.error('[VNSaveManager] Import failed:', error);
            return false;
        }
    }

    // ========================================================================
    // Helpers
    // ========================================================================

    private getSaveKey(slotId: number): string {
        return `${this.config.storagePrefix}${this.currentStoryId}_slot${slotId}`;
    }

    private generateDefaultLabel(state: VNRuntimeState): string {
        const date = new Date();
        const dateStr = date.toLocaleDateString();
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `${dateStr} ${timeStr}`;
    }

    private cloneState(state: VNRuntimeState): VNRuntimeState {
        return JSON.parse(JSON.stringify(state));
    }

    private getDefaultGlobalData(): VNGlobalData {
        return {
            completedEndings: [],
            unlockedCGs: [],
            unlockedMusic: [],
            achievements: [],
            totalPlaytime: 0,
            settings: {
                masterVolume: 0.8,
                bgmVolume: 0.7,
                sfxVolume: 0.8,
                voiceVolume: 1.0,
                textSpeed: 0.5,
                autoPlayDelay: 2.0,
                skipUnread: false,
                showTextWindow: true,
                uiScale: 1.0,
                fullscreen: false,
                language: 'en'
            }
        };
    }

    /**
     * Get time since last save
     */
    getTimeSinceLastSave(): number {
        if (this.lastSaveTime === 0) return Infinity;
        return (Date.now() - this.lastSaveTime) / 1000;
    }

    /**
     * Check if there's an auto-save available
     */
    hasAutoSave(): boolean {
        const key = `${this.config.storagePrefix}autosave_${this.currentStoryId}`;
        return localStorage.getItem(key) !== null;
    }

    /**
     * Format playtime for display
     */
    static formatPlaytime(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}

// Singleton instance
const vnSaveManager = new VNSaveManager();

export { vnSaveManager, VNSaveManager };

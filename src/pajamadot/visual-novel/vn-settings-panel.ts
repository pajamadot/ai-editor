/**
 * VN Settings Panel
 * In-game settings UI for visual novel configuration
 *
 * Settings:
 * - Audio volumes (master, BGM, SFX, voice)
 * - Text display speed
 * - Auto-play delay
 * - Skip settings
 * - Display options
 */

import type { VNSettings } from './vn-types';
import { getDefaultVNSettings } from './vn-types';

/**
 * Settings change callback
 */
export type SettingsChangeCallback = (settings: VNSettings) => void;

/**
 * VN Settings Panel
 * Provides UI for adjusting visual novel settings
 */
class VNSettingsPanel {
    private _container: HTMLElement | null = null;
    private _settings: VNSettings;
    private _isOpen: boolean = false;
    private _onChange: SettingsChangeCallback | null = null;
    private _onClose: (() => void) | null = null;

    constructor() {
        this._settings = getDefaultVNSettings();
    }

    /**
     * Set the settings to display
     */
    setSettings(settings: VNSettings): void {
        this._settings = { ...settings };
        if (this._isOpen) {
            this.render();
        }
    }

    /**
     * Get current settings
     */
    getSettings(): VNSettings {
        return { ...this._settings };
    }

    /**
     * Set change callback
     */
    setOnChange(callback: SettingsChangeCallback): void {
        this._onChange = callback;
    }

    /**
     * Set close callback
     */
    setOnClose(callback: () => void): void {
        this._onClose = callback;
    }

    /**
     * Open settings panel
     */
    open(container?: HTMLElement): void {
        this._container = container || document.body;
        this._isOpen = true;
        this.render();
    }

    /**
     * Close settings panel
     */
    close(): void {
        this._isOpen = false;

        const panel = this._container?.querySelector('.vn-settings-panel');
        if (panel) {
            panel.remove();
        }

        this._onClose?.();
    }

    /**
     * Check if panel is open
     */
    isOpen(): boolean {
        return this._isOpen;
    }

    /**
     * Render the settings panel
     */
    private render(): void {
        if (!this._container) return;

        // Remove existing panel
        const existing = this._container.querySelector('.vn-settings-panel');
        if (existing) {
            existing.remove();
        }

        const panel = document.createElement('div');
        panel.className = 'vn-settings-panel';
        panel.innerHTML = `
            <style>
                .vn-settings-panel {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.9);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }

                .vn-settings-content {
                    width: 90%;
                    max-width: 600px;
                    max-height: 90vh;
                    background: linear-gradient(145deg, #1a1a2e 0%, #16213e 100%);
                    border-radius: 16px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }

                .vn-settings-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px 24px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                }

                .vn-settings-title {
                    color: #fff;
                    font-size: 20px;
                    font-weight: 600;
                    margin: 0;
                }

                .vn-settings-close {
                    background: none;
                    border: none;
                    color: #888;
                    font-size: 28px;
                    cursor: pointer;
                    padding: 0;
                    line-height: 1;
                }

                .vn-settings-close:hover {
                    color: #fff;
                }

                .vn-settings-body {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px 24px;
                }

                .vn-settings-section {
                    margin-bottom: 24px;
                }

                .vn-settings-section-title {
                    color: #e94560;
                    font-size: 14px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    margin-bottom: 16px;
                }

                .vn-settings-row {
                    margin-bottom: 16px;
                }

                .vn-settings-label {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    color: #fff;
                    font-size: 14px;
                    margin-bottom: 8px;
                }

                .vn-settings-value {
                    color: #888;
                    font-size: 12px;
                }

                .vn-settings-slider {
                    width: 100%;
                    height: 6px;
                    -webkit-appearance: none;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 3px;
                    outline: none;
                }

                .vn-settings-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    width: 18px;
                    height: 18px;
                    background: #e94560;
                    border-radius: 50%;
                    cursor: pointer;
                    transition: transform 0.1s;
                }

                .vn-settings-slider::-webkit-slider-thumb:hover {
                    transform: scale(1.2);
                }

                .vn-settings-checkbox-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 0;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                }

                .vn-settings-checkbox-label {
                    color: #fff;
                    font-size: 14px;
                }

                .vn-settings-checkbox-desc {
                    color: #888;
                    font-size: 12px;
                    margin-top: 4px;
                }

                .vn-settings-toggle {
                    position: relative;
                    width: 44px;
                    height: 24px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .vn-settings-toggle.active {
                    background: #e94560;
                }

                .vn-settings-toggle::after {
                    content: '';
                    position: absolute;
                    top: 2px;
                    left: 2px;
                    width: 20px;
                    height: 20px;
                    background: #fff;
                    border-radius: 50%;
                    transition: left 0.2s;
                }

                .vn-settings-toggle.active::after {
                    left: 22px;
                }

                .vn-settings-select {
                    width: 100%;
                    padding: 10px 12px;
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    color: #fff;
                    font-size: 14px;
                    cursor: pointer;
                    outline: none;
                }

                .vn-settings-select option {
                    background: #1a1a2e;
                }

                .vn-settings-footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    padding: 16px 24px;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                }

                .vn-settings-btn {
                    padding: 10px 24px;
                    border: none;
                    border-radius: 8px;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .vn-settings-btn-primary {
                    background: #e94560;
                    color: #fff;
                }

                .vn-settings-btn-primary:hover {
                    background: #d13a54;
                }

                .vn-settings-btn-secondary {
                    background: rgba(255, 255, 255, 0.1);
                    color: #fff;
                }

                .vn-settings-btn-secondary:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
            </style>

            <div class="vn-settings-content">
                <div class="vn-settings-header">
                    <h2 class="vn-settings-title">Settings</h2>
                    <button class="vn-settings-close">×</button>
                </div>

                <div class="vn-settings-body">
                    <!-- Audio Settings -->
                    <div class="vn-settings-section">
                        <div class="vn-settings-section-title">Audio</div>

                        <div class="vn-settings-row">
                            <div class="vn-settings-label">
                                <span>Master Volume</span>
                                <span class="vn-settings-value" id="master-value">${Math.round(this._settings.masterVolume * 100)}%</span>
                            </div>
                            <input type="range" class="vn-settings-slider" id="master-volume"
                                   min="0" max="100" value="${this._settings.masterVolume * 100}">
                        </div>

                        <div class="vn-settings-row">
                            <div class="vn-settings-label">
                                <span>BGM Volume</span>
                                <span class="vn-settings-value" id="bgm-value">${Math.round(this._settings.bgmVolume * 100)}%</span>
                            </div>
                            <input type="range" class="vn-settings-slider" id="bgm-volume"
                                   min="0" max="100" value="${this._settings.bgmVolume * 100}">
                        </div>

                        <div class="vn-settings-row">
                            <div class="vn-settings-label">
                                <span>SFX Volume</span>
                                <span class="vn-settings-value" id="sfx-value">${Math.round(this._settings.sfxVolume * 100)}%</span>
                            </div>
                            <input type="range" class="vn-settings-slider" id="sfx-volume"
                                   min="0" max="100" value="${this._settings.sfxVolume * 100}">
                        </div>

                        <div class="vn-settings-row">
                            <div class="vn-settings-label">
                                <span>Voice Volume</span>
                                <span class="vn-settings-value" id="voice-value">${Math.round(this._settings.voiceVolume * 100)}%</span>
                            </div>
                            <input type="range" class="vn-settings-slider" id="voice-volume"
                                   min="0" max="100" value="${this._settings.voiceVolume * 100}">
                        </div>
                    </div>

                    <!-- Text Settings -->
                    <div class="vn-settings-section">
                        <div class="vn-settings-section-title">Text</div>

                        <div class="vn-settings-row">
                            <div class="vn-settings-label">
                                <span>Text Speed</span>
                                <span class="vn-settings-value" id="text-speed-value">${this.getTextSpeedLabel(this._settings.textSpeed)}</span>
                            </div>
                            <input type="range" class="vn-settings-slider" id="text-speed"
                                   min="0" max="100" value="${this._settings.textSpeed * 100}">
                        </div>

                        <div class="vn-settings-row">
                            <div class="vn-settings-label">
                                <span>Auto-Play Delay</span>
                                <span class="vn-settings-value" id="auto-delay-value">${this._settings.autoPlayDelay}s</span>
                            </div>
                            <input type="range" class="vn-settings-slider" id="auto-delay"
                                   min="10" max="100" value="${this._settings.autoPlayDelay * 10}">
                        </div>
                    </div>

                    <!-- Skip Settings -->
                    <div class="vn-settings-section">
                        <div class="vn-settings-section-title">Skip</div>

                        <div class="vn-settings-checkbox-row">
                            <div>
                                <div class="vn-settings-checkbox-label">Skip Unread Text</div>
                                <div class="vn-settings-checkbox-desc">Allow skipping text that hasn't been read before</div>
                            </div>
                            <div class="vn-settings-toggle ${this._settings.skipUnread ? 'active' : ''}" id="skip-unread"></div>
                        </div>
                    </div>

                    <!-- Display Settings -->
                    <div class="vn-settings-section">
                        <div class="vn-settings-section-title">Display</div>

                        <div class="vn-settings-checkbox-row">
                            <div>
                                <div class="vn-settings-checkbox-label">Show Text Window</div>
                                <div class="vn-settings-checkbox-desc">Display the dialogue box</div>
                            </div>
                            <div class="vn-settings-toggle ${this._settings.showTextWindow ? 'active' : ''}" id="show-text-window"></div>
                        </div>

                        <div class="vn-settings-checkbox-row">
                            <div>
                                <div class="vn-settings-checkbox-label">Fullscreen</div>
                                <div class="vn-settings-checkbox-desc">Run in fullscreen mode</div>
                            </div>
                            <div class="vn-settings-toggle ${this._settings.fullscreen ? 'active' : ''}" id="fullscreen"></div>
                        </div>

                        <div class="vn-settings-row" style="margin-top: 16px;">
                            <div class="vn-settings-label">
                                <span>UI Scale</span>
                                <span class="vn-settings-value" id="ui-scale-value">${Math.round(this._settings.uiScale * 100)}%</span>
                            </div>
                            <input type="range" class="vn-settings-slider" id="ui-scale"
                                   min="50" max="200" value="${this._settings.uiScale * 100}">
                        </div>

                        <div class="vn-settings-row">
                            <div class="vn-settings-label">
                                <span>Language</span>
                            </div>
                            <select class="vn-settings-select" id="language">
                                <option value="en" ${this._settings.language === 'en' ? 'selected' : ''}>English</option>
                                <option value="ja" ${this._settings.language === 'ja' ? 'selected' : ''}>日本語</option>
                                <option value="zh" ${this._settings.language === 'zh' ? 'selected' : ''}>中文</option>
                                <option value="ko" ${this._settings.language === 'ko' ? 'selected' : ''}>한국어</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="vn-settings-footer">
                    <button class="vn-settings-btn vn-settings-btn-secondary" id="reset-defaults">Reset Defaults</button>
                    <button class="vn-settings-btn vn-settings-btn-primary" id="save-settings">Save</button>
                </div>
            </div>
        `;

        this._container.appendChild(panel);
        this.setupEventListeners(panel);
    }

    /**
     * Setup event listeners
     */
    private setupEventListeners(panel: HTMLElement): void {
        // Close button
        panel.querySelector('.vn-settings-close')?.addEventListener('click', () => this.close());

        // Click outside to close
        panel.addEventListener('click', (e) => {
            if (e.target === panel) {
                this.close();
            }
        });

        // Volume sliders
        this.setupSlider(panel, 'master-volume', 'master-value', (value) => {
            this._settings.masterVolume = value / 100;
            return `${Math.round(value)}%`;
        });

        this.setupSlider(panel, 'bgm-volume', 'bgm-value', (value) => {
            this._settings.bgmVolume = value / 100;
            return `${Math.round(value)}%`;
        });

        this.setupSlider(panel, 'sfx-volume', 'sfx-value', (value) => {
            this._settings.sfxVolume = value / 100;
            return `${Math.round(value)}%`;
        });

        this.setupSlider(panel, 'voice-volume', 'voice-value', (value) => {
            this._settings.voiceVolume = value / 100;
            return `${Math.round(value)}%`;
        });

        // Text speed slider
        this.setupSlider(panel, 'text-speed', 'text-speed-value', (value) => {
            this._settings.textSpeed = value / 100;
            return this.getTextSpeedLabel(this._settings.textSpeed);
        });

        // Auto delay slider
        this.setupSlider(panel, 'auto-delay', 'auto-delay-value', (value) => {
            this._settings.autoPlayDelay = value / 10;
            return `${this._settings.autoPlayDelay}s`;
        });

        // UI scale slider
        this.setupSlider(panel, 'ui-scale', 'ui-scale-value', (value) => {
            this._settings.uiScale = value / 100;
            return `${Math.round(value)}%`;
        });

        // Toggle switches
        this.setupToggle(panel, 'skip-unread', (active) => {
            this._settings.skipUnread = active;
        });

        this.setupToggle(panel, 'show-text-window', (active) => {
            this._settings.showTextWindow = active;
        });

        this.setupToggle(panel, 'fullscreen', (active) => {
            this._settings.fullscreen = active;
        });

        // Language select
        const languageSelect = panel.querySelector('#language') as HTMLSelectElement;
        languageSelect?.addEventListener('change', () => {
            this._settings.language = languageSelect.value;
        });

        // Reset defaults
        panel.querySelector('#reset-defaults')?.addEventListener('click', () => {
            this._settings = getDefaultVNSettings();
            this.render();
        });

        // Save button
        panel.querySelector('#save-settings')?.addEventListener('click', () => {
            this._onChange?.(this._settings);
            this.close();
        });
    }

    /**
     * Setup slider with live updates
     */
    private setupSlider(
        panel: HTMLElement,
        sliderId: string,
        valueId: string,
        onChange: (value: number) => string
    ): void {
        const slider = panel.querySelector(`#${sliderId}`) as HTMLInputElement;
        const valueDisplay = panel.querySelector(`#${valueId}`);

        slider?.addEventListener('input', () => {
            const value = parseFloat(slider.value);
            if (valueDisplay) {
                valueDisplay.textContent = onChange(value);
            }
        });
    }

    /**
     * Setup toggle switch
     */
    private setupToggle(
        panel: HTMLElement,
        toggleId: string,
        onChange: (active: boolean) => void
    ): void {
        const toggle = panel.querySelector(`#${toggleId}`);
        toggle?.addEventListener('click', () => {
            toggle.classList.toggle('active');
            onChange(toggle.classList.contains('active'));
        });
    }

    /**
     * Get text speed label
     */
    private getTextSpeedLabel(speed: number): string {
        if (speed >= 0.95) return 'Instant';
        if (speed >= 0.75) return 'Fast';
        if (speed >= 0.45) return 'Normal';
        if (speed >= 0.25) return 'Slow';
        return 'Very Slow';
    }
}

// Singleton instance
const vnSettingsPanel = new VNSettingsPanel();

export { vnSettingsPanel, VNSettingsPanel };

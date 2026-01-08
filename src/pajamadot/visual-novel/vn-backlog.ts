/**
 * VN Backlog/History Viewer
 * Shows dialogue history for players to review past conversations
 *
 * Features:
 * - Scrollable dialogue history
 * - Voice replay for voiced lines
 * - Jump to previous scene (if allowed)
 * - Search functionality
 */

import type { VNHistoryEntry } from './vn-types';
import type { StoryCharacterData } from '../types/character';

/**
 * Backlog entry with character info
 */
export interface BacklogEntry extends VNHistoryEntry {
    characterData?: StoryCharacterData;
    hasVoice?: boolean;
    voiceUrl?: string;
}

/**
 * Backlog configuration
 */
export interface BacklogConfig {
    maxEntries: number;
    enableVoiceReplay: boolean;
    enableJumpBack: boolean;
    showTimestamps: boolean;
}

/**
 * Default backlog configuration
 */
export function getDefaultBacklogConfig(): BacklogConfig {
    return {
        maxEntries: 100,
        enableVoiceReplay: true,
        enableJumpBack: false,
        showTimestamps: false
    };
}

/**
 * VN Backlog
 * Manages dialogue history and its display
 */
class VNBacklog {
    private _config: BacklogConfig;
    private _entries: BacklogEntry[] = [];
    private _characters: Map<string, StoryCharacterData> = new Map();

    // UI state
    private _container: HTMLElement | null = null;
    private _isOpen: boolean = false;
    private _scrollPosition: number = 0;

    // Callbacks
    private _onVoiceReplay: ((entry: BacklogEntry) => void) | null = null;
    private _onJumpTo: ((entry: BacklogEntry) => void) | null = null;
    private _onClose: (() => void) | null = null;

    constructor(config: Partial<BacklogConfig> = {}) {
        this._config = { ...getDefaultBacklogConfig(), ...config };
    }

    /**
     * Set characters for name/portrait display
     */
    setCharacters(characters: StoryCharacterData[]): void {
        this._characters.clear();
        for (const char of characters) {
            this._characters.set(char.id, char);
        }
    }

    /**
     * Add an entry to the backlog
     */
    addEntry(entry: VNHistoryEntry, voiceUrl?: string): void {
        const characterData = entry.speakerName
            ? this.findCharacterByName(entry.speakerName)
            : undefined;

        const backlogEntry: BacklogEntry = {
            ...entry,
            characterData,
            hasVoice: !!voiceUrl,
            voiceUrl
        };

        this._entries.push(backlogEntry);

        // Limit entries
        if (this._entries.length > this._config.maxEntries) {
            this._entries.shift();
        }

        // Update UI if open
        if (this._isOpen) {
            this.render();
            this.scrollToBottom();
        }
    }

    /**
     * Find character by name
     */
    private findCharacterByName(name: string): StoryCharacterData | undefined {
        for (const char of this._characters.values()) {
            if (char.name === name) {
                return char;
            }
        }
        return undefined;
    }

    /**
     * Get all entries
     */
    getEntries(): BacklogEntry[] {
        return [...this._entries];
    }

    /**
     * Clear all entries
     */
    clear(): void {
        this._entries = [];

        if (this._isOpen) {
            this.render();
        }
    }

    /**
     * Set callbacks
     */
    setCallbacks(callbacks: {
        onVoiceReplay?: (entry: BacklogEntry) => void;
        onJumpTo?: (entry: BacklogEntry) => void;
        onClose?: () => void;
    }): void {
        this._onVoiceReplay = callbacks.onVoiceReplay || null;
        this._onJumpTo = callbacks.onJumpTo || null;
        this._onClose = callbacks.onClose || null;
    }

    /**
     * Open the backlog
     */
    open(container?: HTMLElement): void {
        this._container = container || document.body;
        this._isOpen = true;
        this.render();
        this.scrollToBottom();
    }

    /**
     * Close the backlog
     */
    close(): void {
        this._isOpen = false;

        const panel = this._container?.querySelector('.vn-backlog-panel');
        if (panel) {
            panel.remove();
        }

        this._onClose?.();
    }

    /**
     * Check if backlog is open
     */
    isOpen(): boolean {
        return this._isOpen;
    }

    /**
     * Render the backlog
     */
    private render(): void {
        if (!this._container) return;

        // Remove existing panel
        const existing = this._container.querySelector('.vn-backlog-panel');
        if (existing) {
            existing.remove();
        }

        const panel = document.createElement('div');
        panel.className = 'vn-backlog-panel';
        panel.innerHTML = `
            <style>
                .vn-backlog-panel {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.95);
                    display: flex;
                    flex-direction: column;
                    z-index: 1000;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }

                .vn-backlog-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 24px;
                    background: rgba(0, 0, 0, 0.5);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                }

                .vn-backlog-title {
                    color: #fff;
                    font-size: 18px;
                    font-weight: 600;
                    margin: 0;
                }

                .vn-backlog-search {
                    display: flex;
                    gap: 8px;
                    flex: 1;
                    max-width: 300px;
                    margin: 0 20px;
                }

                .vn-backlog-search input {
                    flex: 1;
                    padding: 8px 12px;
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    color: #fff;
                    font-size: 14px;
                    outline: none;
                }

                .vn-backlog-search input::placeholder {
                    color: #888;
                }

                .vn-backlog-close {
                    background: none;
                    border: none;
                    color: #888;
                    font-size: 28px;
                    cursor: pointer;
                    padding: 0;
                    line-height: 1;
                }

                .vn-backlog-close:hover {
                    color: #fff;
                }

                .vn-backlog-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                }

                .vn-backlog-empty {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    color: #888;
                    font-size: 16px;
                }

                .vn-backlog-entry {
                    display: flex;
                    gap: 16px;
                    padding: 16px;
                    margin-bottom: 12px;
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 12px;
                    transition: background 0.2s;
                }

                .vn-backlog-entry:hover {
                    background: rgba(255, 255, 255, 0.05);
                }

                .vn-backlog-portrait {
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    object-fit: cover;
                    background: #333;
                    flex-shrink: 0;
                }

                .vn-backlog-portrait-placeholder {
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #fff;
                    font-size: 20px;
                    font-weight: bold;
                    flex-shrink: 0;
                }

                .vn-backlog-text-container {
                    flex: 1;
                    min-width: 0;
                }

                .vn-backlog-speaker {
                    color: #e94560;
                    font-size: 14px;
                    font-weight: 600;
                    margin-bottom: 4px;
                }

                .vn-backlog-speaker.narrator {
                    color: #888;
                    font-style: italic;
                }

                .vn-backlog-text {
                    color: #fff;
                    font-size: 15px;
                    line-height: 1.6;
                    white-space: pre-wrap;
                    word-break: break-word;
                }

                .vn-backlog-timestamp {
                    color: #666;
                    font-size: 11px;
                    margin-top: 8px;
                }

                .vn-backlog-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    flex-shrink: 0;
                }

                .vn-backlog-btn {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    border: none;
                    background: rgba(255, 255, 255, 0.1);
                    color: #fff;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                    transition: all 0.2s;
                }

                .vn-backlog-btn:hover {
                    background: rgba(233, 69, 96, 0.8);
                }

                .vn-backlog-btn:disabled {
                    opacity: 0.3;
                    cursor: not-allowed;
                }

                .vn-backlog-footer {
                    padding: 12px 24px;
                    background: rgba(0, 0, 0, 0.5);
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                    color: #888;
                    font-size: 12px;
                    text-align: center;
                }

                .highlight {
                    background: rgba(233, 69, 96, 0.3);
                    border-radius: 2px;
                }
            </style>

            <div class="vn-backlog-header">
                <h2 class="vn-backlog-title">Dialogue History</h2>
                <div class="vn-backlog-search">
                    <input type="text" placeholder="Search..." id="backlog-search">
                </div>
                <button class="vn-backlog-close">×</button>
            </div>

            <div class="vn-backlog-content" id="backlog-content">
                ${this._entries.length === 0
                    ? '<div class="vn-backlog-empty">No dialogue history yet</div>'
                    : this._entries.map((entry, index) => this.renderEntry(entry, index)).join('')
                }
            </div>

            <div class="vn-backlog-footer">
                ${this._entries.length} entries • Scroll or use arrow keys to navigate
            </div>
        `;

        this._container.appendChild(panel);
        this.setupEventListeners(panel);
    }

    /**
     * Render a single entry
     */
    private renderEntry(entry: BacklogEntry, index: number): string {
        const speakerName = entry.speakerName || 'Narrator';
        const isNarrator = !entry.speakerName;
        const initial = speakerName.charAt(0).toUpperCase();

        // Get portrait if available
        const portraitUrl = entry.characterData?.portraitUrl;

        const timestamp = this._config.showTimestamps
            ? `<div class="vn-backlog-timestamp">${this.formatTimestamp(entry.timestamp)}</div>`
            : '';

        return `
            <div class="vn-backlog-entry" data-index="${index}">
                ${portraitUrl
                    ? `<img class="vn-backlog-portrait" src="${portraitUrl}" alt="${speakerName}">`
                    : `<div class="vn-backlog-portrait-placeholder">${initial}</div>`
                }

                <div class="vn-backlog-text-container">
                    <div class="vn-backlog-speaker ${isNarrator ? 'narrator' : ''}">${speakerName}</div>
                    <div class="vn-backlog-text">${this.escapeHtml(entry.text)}</div>
                    ${timestamp}
                </div>

                <div class="vn-backlog-actions">
                    ${entry.hasVoice && this._config.enableVoiceReplay
                        ? `<button class="vn-backlog-btn" data-action="voice" data-index="${index}" title="Replay voice">🔊</button>`
                        : ''
                    }
                    ${this._config.enableJumpBack
                        ? `<button class="vn-backlog-btn" data-action="jump" data-index="${index}" title="Jump to this point">↩</button>`
                        : ''
                    }
                </div>
            </div>
        `;
    }

    /**
     * Setup event listeners
     */
    private setupEventListeners(panel: HTMLElement): void {
        // Close button
        panel.querySelector('.vn-backlog-close')?.addEventListener('click', () => this.close());

        // Click outside to close
        panel.addEventListener('click', (e) => {
            if (e.target === panel) {
                this.close();
            }
        });

        // Keyboard navigation
        panel.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.close();
            }
        });

        // Search
        const searchInput = panel.querySelector('#backlog-search') as HTMLInputElement;
        searchInput?.addEventListener('input', () => {
            this.filterEntries(searchInput.value);
        });

        // Action buttons
        panel.querySelectorAll('.vn-backlog-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = btn.getAttribute('data-action');
                const index = parseInt(btn.getAttribute('data-index') || '0');
                const entry = this._entries[index];

                if (action === 'voice' && entry && this._onVoiceReplay) {
                    this._onVoiceReplay(entry);
                } else if (action === 'jump' && entry && this._onJumpTo) {
                    this._onJumpTo(entry);
                }
            });
        });

        // Scroll wheel
        const content = panel.querySelector('#backlog-content');
        content?.addEventListener('scroll', () => {
            this._scrollPosition = content.scrollTop;
        });
    }

    /**
     * Filter entries by search term
     */
    private filterEntries(searchTerm: string): void {
        const content = this._container?.querySelector('#backlog-content');
        if (!content) return;

        const entries = content.querySelectorAll('.vn-backlog-entry');
        const term = searchTerm.toLowerCase();

        entries.forEach((entry, index) => {
            const entryData = this._entries[index];
            const textEl = entry.querySelector('.vn-backlog-text');

            if (!searchTerm) {
                (entry as HTMLElement).style.display = 'flex';
                if (textEl) {
                    textEl.innerHTML = this.escapeHtml(entryData.text);
                }
                return;
            }

            const matchesText = entryData.text.toLowerCase().includes(term);
            const matchesSpeaker = (entryData.speakerName || '').toLowerCase().includes(term);

            if (matchesText || matchesSpeaker) {
                (entry as HTMLElement).style.display = 'flex';

                // Highlight matches in text
                if (textEl && matchesText) {
                    textEl.innerHTML = this.highlightText(entryData.text, searchTerm);
                }
            } else {
                (entry as HTMLElement).style.display = 'none';
            }
        });
    }

    /**
     * Highlight search term in text
     */
    private highlightText(text: string, term: string): string {
        if (!term) return this.escapeHtml(text);

        const escaped = this.escapeHtml(text);
        const regex = new RegExp(`(${this.escapeRegExp(term)})`, 'gi');
        return escaped.replace(regex, '<span class="highlight">$1</span>');
    }

    /**
     * Escape HTML entities
     */
    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Escape regex special characters
     */
    private escapeRegExp(text: string): string {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Format timestamp
     */
    private formatTimestamp(timestamp: number): string {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    /**
     * Scroll to bottom of backlog
     */
    private scrollToBottom(): void {
        const content = this._container?.querySelector('#backlog-content');
        if (content) {
            content.scrollTop = content.scrollHeight;
        }
    }

    /**
     * Scroll to specific entry
     */
    scrollToEntry(index: number): void {
        const entry = this._container?.querySelector(`[data-index="${index}"]`);
        entry?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    /**
     * Get entry count
     */
    getEntryCount(): number {
        return this._entries.length;
    }
}

// Singleton instance
const vnBacklog = new VNBacklog();

export { vnBacklog, VNBacklog };

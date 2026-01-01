/**
 * Generation History Panel
 * Shows past generation history with filtering and detail view
 */

import { Button, Container, Label, Panel, SelectInput } from '@playcanvas/pcui';
import { generationClient } from '../generation/generation-client';
import type { GenerationHistoryItem, GenerationJobStatus } from '../generation/types';

declare const editor: any;

/**
 * Get status color
 */
function getStatusColor(status: GenerationJobStatus): string {
    switch (status) {
        case 'pending': return '#f59e0b';
        case 'in_progress': return '#3b82f6';
        case 'downloading': return '#8b5cf6';
        case 'uploading': return '#6366f1';
        case 'completed': return '#22c55e';
        case 'failed': return '#ef4444';
        default: return '#888';
    }
}

/**
 * Format timestamp to readable date
 */
function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return `${diffDays} days ago`;
    } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
}

/**
 * History Item Component
 */
class HistoryItem extends Container {
    private _item: GenerationHistoryItem;
    private _thumbnailEl: HTMLElement | null = null;

    constructor(item: GenerationHistoryItem, onClick: (item: GenerationHistoryItem) => void) {
        super({ class: 'history-item' });
        this._item = item;
        this._buildUI();

        this.dom.addEventListener('click', () => onClick(item));
    }

    private _buildUI(): void {
        // Thumbnail
        const thumbContainer = new Container({ class: 'history-item-thumb' });
        if (this._item.thumbnailUrl || this._item.resultPreview) {
            const img = document.createElement('img');
            img.src = this._item.thumbnailUrl || this._item.resultPreview || '';
            img.alt = '';
            img.loading = 'lazy';
            this._thumbnailEl = img;
            thumbContainer.dom.appendChild(img);
        } else {
            // Placeholder icon
            const icon = document.createElement('div');
            icon.className = 'history-item-thumb-placeholder';
            icon.innerHTML = this._item.mediaType === 'text' ? '📝' : '🖼️';
            thumbContainer.dom.appendChild(icon);
        }
        this.append(thumbContainer);

        // Info
        const info = new Container({ class: 'history-item-info' });

        // Top row: type + status
        const topRow = new Container({ class: 'history-item-row' });
        const typeLabel = new Label({
            text: `${this._item.mediaType.toUpperCase()}`,
            class: 'history-item-type'
        });
        topRow.append(typeLabel);

        const statusLabel = new Label({
            text: this._item.status,
            class: 'history-item-status'
        });
        statusLabel.dom.style.color = getStatusColor(this._item.status);
        topRow.append(statusLabel);
        info.append(topRow);

        // Prompt preview
        const promptLabel = new Label({
            text: this._item.inputPreview?.substring(0, 50) + (this._item.inputPreview?.length > 50 ? '...' : ''),
            class: 'history-item-prompt'
        });
        info.append(promptLabel);

        // Bottom row: time + credits
        const bottomRow = new Container({ class: 'history-item-row' });
        const timeLabel = new Label({
            text: formatDate(this._item.createdAt),
            class: 'history-item-time'
        });
        bottomRow.append(timeLabel);

        if (this._item.creditsCost) {
            const costLabel = new Label({
                text: `${this._item.creditsCost}cr`,
                class: 'history-item-cost'
            });
            bottomRow.append(costLabel);
        }
        info.append(bottomRow);

        this.append(info);
    }

    updateThumbnail(url: string): void {
        if (this._thumbnailEl && this._thumbnailEl.tagName === 'IMG') {
            (this._thumbnailEl as HTMLImageElement).src = url;
        }
    }
}

/**
 * History Detail Panel
 */
class HistoryDetailPanel extends Container {
    private _item: GenerationHistoryItem | null = null;

    constructor() {
        super({ class: 'history-detail-panel', hidden: true });
        this._buildUI();
    }

    private _buildUI(): void {
        // Will be rebuilt when item is set
    }

    show(item: GenerationHistoryItem): void {
        this._item = item;
        this._render();
        this.hidden = false;
    }

    hide(): void {
        this.hidden = true;
        this._item = null;
    }

    private _render(): void {
        if (!this._item) return;

        // Clear existing content
        while (this.dom.firstChild) {
            this.dom.removeChild(this.dom.firstChild);
        }

        // Back button
        const backBtn = new Button({
            text: '← Back',
            class: 'history-detail-back'
        });
        backBtn.on('click', () => this.hide());
        this.append(backBtn);

        // Preview image
        if (this._item.thumbnailUrl || this._item.resultPreview) {
            const preview = new Container({ class: 'history-detail-preview' });
            const img = document.createElement('img');
            img.src = this._item.thumbnailUrl || this._item.resultPreview || '';
            preview.dom.appendChild(img);
            this.append(preview);
        }

        // Details
        const details = new Container({ class: 'history-detail-info' });

        // Type
        this._addDetailRow(details, 'Type', this._item.mediaType.toUpperCase());

        // Model
        if (this._item.model) {
            this._addDetailRow(details, 'Model', this._item.model);
        }

        // Status
        const statusRow = this._addDetailRow(details, 'Status', this._item.status);
        statusRow.dom.querySelector('.history-detail-value')!.setAttribute('style', `color: ${getStatusColor(this._item.status)}`);

        // Credits
        if (this._item.creditsCost) {
            this._addDetailRow(details, 'Cost', `${this._item.creditsCost} credits`);
        }

        // Created
        this._addDetailRow(details, 'Created', new Date(this._item.createdAt).toLocaleString());

        // Completed
        if (this._item.completedAt) {
            this._addDetailRow(details, 'Completed', new Date(this._item.completedAt).toLocaleString());
        }

        // Prompt
        if (this._item.inputPreview) {
            const promptLabel = new Label({
                text: 'Prompt:',
                class: 'history-detail-label'
            });
            details.append(promptLabel);

            const promptText = new Label({
                text: this._item.inputPreview,
                class: 'history-detail-prompt'
            });
            details.append(promptText);
        }

        // Error
        if (this._item.errorMessage) {
            const errorLabel = new Label({
                text: `Error: ${this._item.errorMessage}`,
                class: 'history-detail-error'
            });
            details.append(errorLabel);
        }

        this.append(details);

        // Actions
        if (this._item.status === 'completed' && this._item.assetId) {
            const actions = new Container({ class: 'history-detail-actions' });

            const importBtn = new Button({
                text: 'Import to Project',
                icon: 'E194',
                class: 'history-detail-btn'
            });
            importBtn.class.add('primary');
            importBtn.on('click', () => this._importAsset());
            actions.append(importBtn);

            const copyBtn = new Button({
                text: 'Copy Prompt',
                icon: 'E184',
                class: 'history-detail-btn'
            });
            copyBtn.on('click', () => this._copyPrompt());
            actions.append(copyBtn);

            this.append(actions);
        }
    }

    private _addDetailRow(parent: Container, label: string, value: string): Container {
        const row = new Container({ class: 'history-detail-row' });

        const labelEl = new Label({
            text: label + ':',
            class: 'history-detail-label'
        });
        row.append(labelEl);

        const valueEl = new Label({
            text: value,
            class: 'history-detail-value'
        });
        row.append(valueEl);

        parent.append(row);
        return row;
    }

    private async _importAsset(): Promise<void> {
        if (!this._item?.assetId) return;

        try {
            // Import the asset to PlayCanvas project
            editor.call('pajamadot:import:asset', this._item.assetId, {
                type: this._item.mediaType === 'text' ? 'text' : 'texture'
            });
        } catch (e) {
            console.error('[HistoryDetail] Import failed:', e);
        }
    }

    private _copyPrompt(): void {
        if (this._item?.inputPreview) {
            navigator.clipboard.writeText(this._item.inputPreview);
            editor.call('toast:show', 'Prompt copied to clipboard');
        }
    }
}

/**
 * Generation History Panel
 */
export class GenerationHistoryPanel extends Panel {
    private _filterSelect: SelectInput;
    private _listContainer: Container;
    private _detailPanel: HistoryDetailPanel;
    private _loadMoreBtn: Button;
    private _loadingLabel: Label;
    private _emptyLabel: Label;
    private _items: GenerationHistoryItem[] = [];
    private _hasMore = false;
    private _isLoading = false;

    constructor() {
        super({
            headerText: 'GENERATION HISTORY',
            collapsible: true,
            collapsed: true,
            removable: true,
            class: 'generation-history-panel'
        });

        this._buildUI();
        this._addStyles();

        // Load on expand
        this.on('expand', () => {
            if (this._items.length === 0) {
                this._loadHistory();
            }
        });
    }

    private _buildUI(): void {
        // Filter row
        const filterRow = new Container({ class: 'history-filter-row' });

        const filterLabel = new Label({ text: 'Filter:' });
        filterRow.append(filterLabel);

        this._filterSelect = new SelectInput({
            options: [
                { v: 'all', t: 'All' },
                { v: 'media', t: 'Media' },
                { v: 'text', t: 'Text' }
            ],
            value: 'all',
            class: 'history-filter-select'
        });
        this._filterSelect.on('change', () => this._loadHistory());
        filterRow.append(this._filterSelect);

        const refreshBtn = new Button({
            icon: 'E134',
            class: 'history-refresh-btn'
        });
        refreshBtn.on('click', () => this._loadHistory());
        filterRow.append(refreshBtn);

        this.append(filterRow);

        // List container
        this._listContainer = new Container({ class: 'history-list' });
        this.append(this._listContainer);

        // Loading label
        this._loadingLabel = new Label({
            text: 'Loading...',
            class: 'history-loading',
            hidden: true
        });
        this.append(this._loadingLabel);

        // Empty label
        this._emptyLabel = new Label({
            text: 'No generation history',
            class: 'history-empty',
            hidden: true
        });
        this.append(this._emptyLabel);

        // Load more button
        this._loadMoreBtn = new Button({
            text: 'Load More',
            class: 'history-load-more',
            hidden: true
        });
        this._loadMoreBtn.on('click', () => this._loadMore());
        this.append(this._loadMoreBtn);

        // Detail panel
        this._detailPanel = new HistoryDetailPanel();
        this.append(this._detailPanel);
    }

    private async _loadHistory(): Promise<void> {
        if (this._isLoading) return;
        this._isLoading = true;

        // Clear existing items
        while (this._listContainer.dom.firstChild) {
            this._listContainer.dom.removeChild(this._listContainer.dom.firstChild);
        }
        this._items = [];

        this._loadingLabel.hidden = false;
        this._emptyLabel.hidden = true;
        this._loadMoreBtn.hidden = true;

        try {
            const type = this._filterSelect.value as 'all' | 'media' | 'text';
            const response = await generationClient.getHistory({
                type,
                limit: 20
            });

            this._items = response.items;
            this._hasMore = response.hasMore;

            this._renderItems();
        } catch (e) {
            console.error('[HistoryPanel] Failed to load history:', e);
            this._emptyLabel.text = 'Failed to load history';
            this._emptyLabel.hidden = false;
        } finally {
            this._isLoading = false;
            this._loadingLabel.hidden = true;
        }
    }

    private async _loadMore(): Promise<void> {
        if (this._isLoading || !this._hasMore) return;
        this._isLoading = true;
        this._loadMoreBtn.enabled = false;

        try {
            const type = this._filterSelect.value as 'all' | 'media' | 'text';
            const response = await generationClient.getHistory({
                type,
                limit: 20,
                offset: this._items.length
            });

            this._items.push(...response.items);
            this._hasMore = response.hasMore;

            // Render only new items
            response.items.forEach(item => {
                const historyItem = new HistoryItem(item, (i) => this._showDetail(i));
                this._listContainer.append(historyItem);
            });

            this._loadMoreBtn.hidden = !this._hasMore;
        } catch (e) {
            console.error('[HistoryPanel] Failed to load more:', e);
        } finally {
            this._isLoading = false;
            this._loadMoreBtn.enabled = true;
        }
    }

    private _renderItems(): void {
        if (this._items.length === 0) {
            this._emptyLabel.text = 'No generation history';
            this._emptyLabel.hidden = false;
            return;
        }

        this._items.forEach(item => {
            const historyItem = new HistoryItem(item, (i) => this._showDetail(i));
            this._listContainer.append(historyItem);
        });

        this._loadMoreBtn.hidden = !this._hasMore;
    }

    private _showDetail(item: GenerationHistoryItem): void {
        this._detailPanel.show(item);
        this._listContainer.hidden = true;
        this._filterSelect.parent!.hidden = true;
        this._loadMoreBtn.hidden = true;

        // Hide detail and show list when back is clicked
        const backHandler = () => {
            this._listContainer.hidden = false;
            this._filterSelect.parent!.hidden = false;
            this._loadMoreBtn.hidden = !this._hasMore;
        };

        this._detailPanel.dom.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target.closest('.history-detail-back')) {
                backHandler();
            }
        }, { once: true });
    }

    private _addStyles(): void {
        const styleId = 'pajamadot-generation-history-panel-styles';
        if (document.getElementById(styleId)) return;

        const styles = document.createElement('style');
        styles.id = styleId;
        styles.textContent = `
            .generation-history-panel {
                max-height: 400px;
                overflow-y: auto;
            }

            .generation-history-panel .pcui-panel-header {
                background: linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(99, 102, 241, 0.1));
            }

            .history-filter-row {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 10px;
                border-bottom: 1px solid #2a2a2a;
            }

            .history-filter-row > .pcui-label {
                color: #888;
                font-size: 11px;
            }

            .history-filter-select {
                flex: 1;
            }

            .history-refresh-btn {
                width: 28px;
                height: 28px;
                min-width: 28px;
                padding: 0;
            }

            .history-list {
                max-height: 300px;
                overflow-y: auto;
            }

            .history-loading,
            .history-empty {
                color: #666;
                font-size: 11px;
                text-align: center;
                padding: 20px;
            }

            .history-load-more {
                width: 100%;
                margin: 8px 0;
            }

            /* History Item */
            .history-item {
                display: flex;
                gap: 10px;
                padding: 8px 10px;
                border-bottom: 1px solid #2a2a2a;
                cursor: pointer;
                transition: background 0.1s;
            }

            .history-item:hover {
                background: rgba(255, 255, 255, 0.05);
            }

            .history-item-thumb {
                width: 48px;
                height: 48px;
                border-radius: 6px;
                overflow: hidden;
                background: #1a1a1a;
                flex-shrink: 0;
            }

            .history-item-thumb img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }

            .history-item-thumb-placeholder {
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
            }

            .history-item-info {
                flex: 1;
                min-width: 0;
            }

            .history-item-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 2px;
            }

            .history-item-type {
                font-size: 10px;
                font-weight: 600;
                color: #a5b4fc;
            }

            .history-item-status {
                font-size: 10px;
                text-transform: capitalize;
            }

            .history-item-prompt {
                font-size: 11px;
                color: #aaa;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                margin-bottom: 2px;
            }

            .history-item-time {
                font-size: 10px;
                color: #666;
            }

            .history-item-cost {
                font-size: 10px;
                color: #a855f7;
            }

            /* History Detail Panel */
            .history-detail-panel {
                padding: 10px;
            }

            .history-detail-back {
                margin-bottom: 10px;
            }

            .history-detail-preview {
                width: 100%;
                height: 150px;
                border-radius: 8px;
                overflow: hidden;
                background: #1a1a1a;
                margin-bottom: 10px;
            }

            .history-detail-preview img {
                width: 100%;
                height: 100%;
                object-fit: contain;
            }

            .history-detail-info {
                margin-bottom: 10px;
            }

            .history-detail-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 4px;
            }

            .history-detail-label {
                color: #888;
                font-size: 11px;
            }

            .history-detail-value {
                color: #ccc;
                font-size: 11px;
                text-align: right;
            }

            .history-detail-prompt {
                color: #aaa;
                font-size: 11px;
                background: #1a1a1a;
                padding: 8px;
                border-radius: 4px;
                margin-top: 4px;
                white-space: pre-wrap;
                word-break: break-word;
            }

            .history-detail-error {
                color: #ef4444;
                font-size: 11px;
                margin-top: 8px;
            }

            .history-detail-actions {
                display: flex;
                gap: 8px;
            }

            .history-detail-btn {
                flex: 1;
                font-size: 11px;
            }

            .history-detail-btn.primary {
                background: linear-gradient(135deg, #a855f7, #6366f1);
            }
        `;
        document.head.appendChild(styles);
    }
}

// Track panel instance
let historyPanelInstance: GenerationHistoryPanel | null = null;

/**
 * Show generation history panel
 */
function showHistoryPanel(): void {
    if (!historyPanelInstance) {
        historyPanelInstance = new GenerationHistoryPanel();

        // Find a place to add it
        const rightPanel = editor.call('layout.right');
        if (rightPanel) {
            rightPanel.append(historyPanelInstance);
        }
    }

    historyPanelInstance.collapsed = false;
}

/**
 * Initialize history panel
 */
function initHistoryPanel(): void {
    editor.method('pajamadot:panel:history:show', showHistoryPanel);
    console.log('[PajamaDot] Generation history panel initialized');
}

// Initialize on editor load
editor.once('load', () => {
    setTimeout(() => {
        initHistoryPanel();
    }, 1200);
});

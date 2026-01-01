/**
 * Credits History Panel
 * Shows credit transaction history with filtering
 */

import { Button, Container, Label, Panel, SelectInput } from '@playcanvas/pcui';
import { generationClient } from '../generation/generation-client';
import type { CreditTransaction, CreditTransactionType, CreditTransactionStatus } from '../generation/types';

declare const editor: any;

/**
 * Get transaction type color
 */
function getTransactionColor(type: CreditTransactionType): string {
    switch (type) {
        case 'grant': return '#22c55e';   // green
        case 'spend': return '#ef4444';    // red
        case 'reserve': return '#f59e0b'; // amber
        case 'refund': return '#3b82f6';  // blue
        default: return '#888';
    }
}

/**
 * Get transaction type icon
 */
function getTransactionIcon(type: CreditTransactionType): string {
    switch (type) {
        case 'grant': return '⬆️';
        case 'spend': return '⬇️';
        case 'reserve': return '⏳';
        case 'refund': return '↩️';
        default: return '•';
    }
}

/**
 * Get status badge color
 */
function getStatusColor(status: CreditTransactionStatus): string {
    switch (status) {
        case 'pending': return '#f59e0b';
        case 'confirmed': return '#22c55e';
        case 'cancelled': return '#ef4444';
        default: return '#888';
    }
}

/**
 * Format amount with sign
 */
function formatAmount(amount: number, type: CreditTransactionType): string {
    const sign = type === 'spend' || type === 'reserve' ? '-' : '+';
    return `${sign}${Math.abs(amount)}`;
}

/**
 * Format timestamp
 */
function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
        return 'Yesterday ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays < 7) {
        return `${diffDays}d ago`;
    } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
}

/**
 * Transaction Item Component
 */
class TransactionItem extends Container {
    constructor(transaction: CreditTransaction) {
        super({ class: 'transaction-item' });
        this._buildUI(transaction);
    }

    private _buildUI(tx: CreditTransaction): void {
        // Icon
        const icon = new Label({
            text: getTransactionIcon(tx.transactionType),
            class: 'transaction-icon'
        });
        this.append(icon);

        // Info container
        const info = new Container({ class: 'transaction-info' });

        // Top row: description + amount
        const topRow = new Container({ class: 'transaction-row' });

        const descLabel = new Label({
            text: tx.description || tx.transactionType.charAt(0).toUpperCase() + tx.transactionType.slice(1),
            class: 'transaction-desc'
        });
        topRow.append(descLabel);

        const amountLabel = new Label({
            text: formatAmount(tx.amount, tx.transactionType),
            class: 'transaction-amount'
        });
        amountLabel.dom.style.color = getTransactionColor(tx.transactionType);
        topRow.append(amountLabel);

        info.append(topRow);

        // Bottom row: time + status + media type
        const bottomRow = new Container({ class: 'transaction-row' });
        bottomRow.class.add('bottom');

        const timeLabel = new Label({
            text: formatDate(tx.createdAt),
            class: 'transaction-time'
        });
        bottomRow.append(timeLabel);

        if (tx.status !== 'confirmed') {
            const statusBadge = new Label({
                text: tx.status,
                class: 'transaction-status-badge'
            });
            statusBadge.dom.style.backgroundColor = getStatusColor(tx.status);
            bottomRow.append(statusBadge);
        }

        if (tx.mediaType) {
            const mediaLabel = new Label({
                text: tx.mediaType,
                class: 'transaction-media'
            });
            bottomRow.append(mediaLabel);
        }

        info.append(bottomRow);
        this.append(info);
    }
}

/**
 * Credits History Panel
 */
export class CreditsHistoryPanel extends Panel {
    private _filterSelect: SelectInput;
    private _listContainer: Container;
    private _loadMoreBtn: Button;
    private _loadingLabel: Label;
    private _emptyLabel: Label;
    private _summaryLabel: Label;
    private _transactions: CreditTransaction[] = [];
    private _hasMore = false;
    private _isLoading = false;

    constructor() {
        super({
            headerText: 'CREDIT HISTORY',
            collapsible: true,
            collapsed: true,
            removable: true,
            class: 'credits-history-panel'
        });

        this._buildUI();
        this._addStyles();

        // Load on expand
        this.on('expand', () => {
            if (this._transactions.length === 0) {
                this._loadHistory();
            }
        });
    }

    private _buildUI(): void {
        // Summary row
        this._summaryLabel = new Label({
            text: '',
            class: 'credits-summary',
            hidden: true
        });
        this.append(this._summaryLabel);

        // Filter row
        const filterRow = new Container({ class: 'credits-filter-row' });

        const filterLabel = new Label({ text: 'Filter:' });
        filterRow.append(filterLabel);

        this._filterSelect = new SelectInput({
            options: [
                { v: 'all', t: 'All' },
                { v: 'spend', t: 'Spent' },
                { v: 'grant', t: 'Granted' },
                { v: 'refund', t: 'Refunds' }
            ],
            value: 'all',
            class: 'credits-filter-select'
        });
        this._filterSelect.on('change', () => this._loadHistory());
        filterRow.append(this._filterSelect);

        const refreshBtn = new Button({
            icon: 'E134',
            class: 'credits-refresh-btn'
        });
        refreshBtn.on('click', () => this._loadHistory());
        filterRow.append(refreshBtn);

        this.append(filterRow);

        // List container
        this._listContainer = new Container({ class: 'credits-list' });
        this.append(this._listContainer);

        // Loading label
        this._loadingLabel = new Label({
            text: 'Loading...',
            class: 'credits-loading',
            hidden: true
        });
        this.append(this._loadingLabel);

        // Empty label
        this._emptyLabel = new Label({
            text: 'No transactions',
            class: 'credits-empty',
            hidden: true
        });
        this.append(this._emptyLabel);

        // Load more button
        this._loadMoreBtn = new Button({
            text: 'Load More',
            class: 'credits-load-more',
            hidden: true
        });
        this._loadMoreBtn.on('click', () => this._loadMore());
        this.append(this._loadMoreBtn);
    }

    private async _loadHistory(): Promise<void> {
        if (this._isLoading) return;
        this._isLoading = true;

        // Clear existing items
        while (this._listContainer.dom.firstChild) {
            this._listContainer.dom.removeChild(this._listContainer.dom.firstChild);
        }
        this._transactions = [];

        this._loadingLabel.hidden = false;
        this._emptyLabel.hidden = true;
        this._loadMoreBtn.hidden = true;
        this._summaryLabel.hidden = true;

        try {
            const type = this._filterSelect.value as 'all' | 'grant' | 'spend' | 'refund';
            const response = await generationClient.getCreditHistory({
                type,
                limit: 30
            });

            this._transactions = response.transactions;
            this._hasMore = response.hasMore;

            this._renderTransactions();
            this._updateSummary();
        } catch (e) {
            console.error('[CreditsHistoryPanel] Failed to load history:', e);
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
            const type = this._filterSelect.value as 'all' | 'grant' | 'spend' | 'refund';
            const response = await generationClient.getCreditHistory({
                type,
                limit: 30,
                offset: this._transactions.length
            });

            this._transactions.push(...response.transactions);
            this._hasMore = response.hasMore;

            // Render only new items
            response.transactions.forEach(tx => {
                const item = new TransactionItem(tx);
                this._listContainer.append(item);
            });

            this._loadMoreBtn.hidden = !this._hasMore;
        } catch (e) {
            console.error('[CreditsHistoryPanel] Failed to load more:', e);
        } finally {
            this._isLoading = false;
            this._loadMoreBtn.enabled = true;
        }
    }

    private _renderTransactions(): void {
        if (this._transactions.length === 0) {
            this._emptyLabel.text = 'No transactions';
            this._emptyLabel.hidden = false;
            return;
        }

        this._transactions.forEach(tx => {
            const item = new TransactionItem(tx);
            this._listContainer.append(item);
        });

        this._loadMoreBtn.hidden = !this._hasMore;
    }

    private _updateSummary(): void {
        const totalSpent = this._transactions
            .filter(tx => tx.transactionType === 'spend' && tx.status === 'confirmed')
            .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

        const totalGranted = this._transactions
            .filter(tx => tx.transactionType === 'grant')
            .reduce((sum, tx) => sum + tx.amount, 0);

        const totalRefunded = this._transactions
            .filter(tx => tx.transactionType === 'refund')
            .reduce((sum, tx) => sum + tx.amount, 0);

        if (totalSpent > 0 || totalGranted > 0) {
            let summary = [];
            if (totalSpent > 0) summary.push(`Spent: ${totalSpent}`);
            if (totalGranted > 0) summary.push(`Granted: ${totalGranted}`);
            if (totalRefunded > 0) summary.push(`Refunded: ${totalRefunded}`);

            this._summaryLabel.text = summary.join(' | ');
            this._summaryLabel.hidden = false;
        }
    }

    private _addStyles(): void {
        const styleId = 'pajamadot-credits-history-panel-styles';
        if (document.getElementById(styleId)) return;

        const styles = document.createElement('style');
        styles.id = styleId;
        styles.textContent = `
            .credits-history-panel {
                max-height: 400px;
                overflow-y: auto;
            }

            .credits-history-panel .pcui-panel-header {
                background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(99, 102, 241, 0.1));
            }

            .credits-summary {
                padding: 8px 10px;
                background: rgba(34, 197, 94, 0.1);
                font-size: 11px;
                color: #22c55e;
                text-align: center;
                border-bottom: 1px solid #2a2a2a;
            }

            .credits-filter-row {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 10px;
                border-bottom: 1px solid #2a2a2a;
            }

            .credits-filter-row > .pcui-label {
                color: #888;
                font-size: 11px;
            }

            .credits-filter-select {
                flex: 1;
            }

            .credits-refresh-btn {
                width: 28px;
                height: 28px;
                min-width: 28px;
                padding: 0;
            }

            .credits-list {
                max-height: 280px;
                overflow-y: auto;
            }

            .credits-loading,
            .credits-empty {
                color: #666;
                font-size: 11px;
                text-align: center;
                padding: 20px;
            }

            .credits-load-more {
                width: 100%;
                margin: 8px 0;
            }

            /* Transaction Item */
            .transaction-item {
                display: flex;
                gap: 10px;
                padding: 8px 10px;
                border-bottom: 1px solid #2a2a2a;
            }

            .transaction-item:last-child {
                border-bottom: none;
            }

            .transaction-icon {
                font-size: 16px;
                width: 24px;
                text-align: center;
            }

            .transaction-info {
                flex: 1;
                min-width: 0;
            }

            .transaction-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
            }

            .transaction-row.bottom {
                margin-top: 2px;
                gap: 6px;
            }

            .transaction-desc {
                font-size: 11px;
                color: #ccc;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                flex: 1;
            }

            .transaction-amount {
                font-size: 12px;
                font-weight: 600;
                margin-left: 8px;
            }

            .transaction-time {
                font-size: 10px;
                color: #666;
            }

            .transaction-status-badge {
                font-size: 9px;
                padding: 1px 4px;
                border-radius: 3px;
                color: white;
                text-transform: uppercase;
            }

            .transaction-media {
                font-size: 9px;
                color: #a5b4fc;
                background: rgba(99, 102, 241, 0.2);
                padding: 1px 4px;
                border-radius: 3px;
                text-transform: uppercase;
            }
        `;
        document.head.appendChild(styles);
    }
}

// Track panel instance
let creditsHistoryPanelInstance: CreditsHistoryPanel | null = null;

/**
 * Show credits history panel
 */
function showCreditsHistoryPanel(): void {
    if (!creditsHistoryPanelInstance) {
        creditsHistoryPanelInstance = new CreditsHistoryPanel();

        // Find a place to add it
        const rightPanel = editor.call('layout.right');
        if (rightPanel) {
            rightPanel.append(creditsHistoryPanelInstance);
        }
    }

    creditsHistoryPanelInstance.collapsed = false;
}

/**
 * Initialize credits history panel
 */
function initCreditsHistoryPanel(): void {
    editor.method('pajamadot:panel:credithistory:show', showCreditsHistoryPanel);
    console.log('[PajamaDot] Credits history panel initialized');
}

// Initialize on editor load
editor.once('load', () => {
    setTimeout(() => {
        initCreditsHistoryPanel();
    }, 1300);
});

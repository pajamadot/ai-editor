/**
 * Credits Display Component
 * Shows current credit balance with auto-refresh and status indicators
 */

import { Button, Container, Label } from '@playcanvas/pcui';
import { generationClient } from '../generation/generation-client';
import type { CreditsBalance } from '../generation/types';

declare const editor: any;

// Credit update event listeners
type CreditUpdateListener = (balance: CreditsBalance) => void;
const creditUpdateListeners: Set<CreditUpdateListener> = new Set();

/**
 * Subscribe to credit updates
 */
export function onCreditUpdate(listener: CreditUpdateListener): () => void {
    creditUpdateListeners.add(listener);
    return () => creditUpdateListeners.delete(listener);
}

/**
 * Notify all listeners of a credit update
 */
export function notifyCreditUpdate(balance: CreditsBalance): void {
    creditUpdateListeners.forEach(listener => {
        try {
            listener(balance);
        } catch (e) {
            console.error('[CreditsDisplay] Listener error:', e);
        }
    });
}

/**
 * Get color based on balance level
 */
function getBalanceColor(balance: number): string {
    if (balance <= 0) return '#ef4444';      // red - depleted
    if (balance < 10) return '#f59e0b';      // amber - critical
    if (balance < 100) return '#fbbf24';     // yellow - low
    return '#22c55e';                         // green - healthy
}

/**
 * Get status text based on balance
 */
function getBalanceStatus(balance: number): string {
    if (balance <= 0) return 'Depleted';
    if (balance < 10) return 'Critical';
    if (balance < 100) return 'Low';
    return '';
}

/**
 * Credits Display Component
 */
export class CreditsDisplay extends Container {
    private _balance: number = 0;
    private _balanceLabel: Label;
    private _statusLabel: Label;
    private _refreshInterval: number | null = null;
    private _unsubscribe: (() => void) | null = null;

    constructor(options?: { showIcon?: boolean; compact?: boolean }) {
        super({ class: 'credits-display' });

        if (options?.compact) {
            this.class.add('compact');
        }

        this._buildUI(options?.showIcon ?? true);
        this._subscribeToUpdates();
        this._startAutoRefresh();
        this._loadBalance();
    }

    private _buildUI(showIcon: boolean): void {
        if (showIcon) {
            const icon = new Label({
                text: '',
                class: 'credits-icon'
            });
            icon.dom.innerHTML = '💰';
            this.append(icon);
        }

        this._balanceLabel = new Label({
            text: '...',
            class: 'credits-balance'
        });
        this.append(this._balanceLabel);

        this._statusLabel = new Label({
            text: '',
            class: 'credits-status',
            hidden: true
        });
        this.append(this._statusLabel);

        // Click to show history
        this.dom.addEventListener('click', () => {
            editor.call('pajamadot:panel:credithistory:show');
        });
        this.dom.style.cursor = 'pointer';
        this.dom.title = 'Click to view credit history';
    }

    private _subscribeToUpdates(): void {
        this._unsubscribe = onCreditUpdate((balance) => {
            this._updateDisplay(balance);
        });
    }

    private _startAutoRefresh(): void {
        // Refresh every 60 seconds
        this._refreshInterval = window.setInterval(() => {
            this._loadBalance();
        }, 60000);
    }

    private async _loadBalance(): Promise<void> {
        try {
            const hasToken = editor.call('pajamadot:hasToken');
            if (!hasToken) {
                this._balanceLabel.text = '---';
                return;
            }

            const balance = await generationClient.getCredits();
            this._updateDisplay(balance);
        } catch (e) {
            console.warn('[CreditsDisplay] Failed to load balance:', e);
            this._balanceLabel.text = 'err';
        }
    }

    private _updateDisplay(balance: CreditsBalance): void {
        this._balance = balance.balance;
        this._balanceLabel.text = `${balance.balance} cr`;
        this._balanceLabel.dom.style.color = getBalanceColor(balance.balance);

        const status = getBalanceStatus(balance.balance);
        if (status) {
            this._statusLabel.text = status;
            this._statusLabel.hidden = false;
            this._statusLabel.dom.style.color = getBalanceColor(balance.balance);
        } else {
            this._statusLabel.hidden = true;
        }

        // Update tooltip
        this.dom.title = `Balance: ${balance.balance} credits\n` +
            (balance.lifetimeGranted ? `Lifetime granted: ${balance.lifetimeGranted}\n` : '') +
            (balance.lifetimeSpent ? `Lifetime spent: ${balance.lifetimeSpent}\n` : '') +
            'Click to view credit history';
    }

    /**
     * Force refresh the balance
     */
    async refresh(): Promise<void> {
        await this._loadBalance();
    }

    /**
     * Get current balance
     */
    getBalance(): number {
        return this._balance;
    }

    /**
     * Check if user has enough credits
     */
    hasCredits(amount: number): boolean {
        return this._balance >= amount;
    }

    /**
     * Check if credits are low
     */
    isLow(): boolean {
        return this._balance < 100;
    }

    destroy(): void {
        if (this._refreshInterval) {
            clearInterval(this._refreshInterval);
        }
        if (this._unsubscribe) {
            this._unsubscribe();
        }
        super.destroy();
    }
}

/**
 * Add CSS styles
 */
function addCreditsDisplayStyles(): void {
    const styleId = 'pajamadot-credits-display-styles';
    if (document.getElementById(styleId)) return;

    const styles = document.createElement('style');
    styles.id = styleId;
    styles.textContent = `
        .credits-display {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            background: rgba(34, 197, 94, 0.1);
            border-radius: 6px;
            border: 1px solid rgba(34, 197, 94, 0.2);
            transition: all 0.2s;
        }

        .credits-display:hover {
            background: rgba(34, 197, 94, 0.15);
        }

        .credits-display.compact {
            padding: 2px 6px;
        }

        .credits-icon {
            font-size: 14px;
        }

        .credits-display.compact .credits-icon {
            font-size: 12px;
        }

        .credits-balance {
            font-size: 12px;
            font-weight: 600;
            color: #22c55e;
        }

        .credits-display.compact .credits-balance {
            font-size: 11px;
        }

        .credits-status {
            font-size: 10px;
            font-weight: 500;
            text-transform: uppercase;
            padding: 1px 4px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 3px;
        }

        /* Low balance state */
        .credits-display[data-status="low"] {
            background: rgba(251, 191, 36, 0.1);
            border-color: rgba(251, 191, 36, 0.2);
        }

        /* Critical balance state */
        .credits-display[data-status="critical"] {
            background: rgba(245, 158, 11, 0.1);
            border-color: rgba(245, 158, 11, 0.2);
        }

        /* Depleted balance state */
        .credits-display[data-status="depleted"] {
            background: rgba(239, 68, 68, 0.1);
            border-color: rgba(239, 68, 68, 0.2);
        }
    `;
    document.head.appendChild(styles);
}

// Track global credits display instance
let globalCreditsDisplay: CreditsDisplay | null = null;

/**
 * Get or create the global credits display
 */
function getCreditsDisplay(): CreditsDisplay {
    if (!globalCreditsDisplay) {
        globalCreditsDisplay = new CreditsDisplay({ showIcon: true });
    }
    return globalCreditsDisplay;
}

/**
 * Refresh global credits balance
 */
async function refreshCreditsBalance(): Promise<void> {
    if (globalCreditsDisplay) {
        await globalCreditsDisplay.refresh();
    }
}

/**
 * Check if user has enough credits
 */
function hasCredits(amount: number): boolean {
    if (globalCreditsDisplay) {
        return globalCreditsDisplay.hasCredits(amount);
    }
    return false;
}

/**
 * Initialize credits display
 */
function initCreditsDisplay(): void {
    addCreditsDisplayStyles();

    // Register methods
    editor.method('pajamadot:credits:display', () => getCreditsDisplay());
    editor.method('pajamadot:credits:refresh', refreshCreditsBalance);
    editor.method('pajamadot:credits:hasEnough', hasCredits);
    editor.method('pajamadot:credits:notify', (balance: CreditsBalance) => notifyCreditUpdate(balance));

    // Also expose via the older name for compatibility
    editor.method('aigc:credits:refresh', refreshCreditsBalance);

    // Add credits display to toolbar area
    const toolbar = editor.call('layout.toolbar') || document.querySelector('.pcui-panel-header');
    if (toolbar) {
        const display = getCreditsDisplay();
        if (toolbar.dom) {
            toolbar.dom.appendChild(display.dom);
        } else if (toolbar.appendChild) {
            toolbar.appendChild(display.dom);
        }
    }

    console.log('[PajamaDot] Credits display initialized');
}

// Initialize on editor load
editor.once('load', () => {
    setTimeout(() => {
        initCreditsDisplay();
    }, 800);
});

export { CreditsDisplay as default, getCreditsDisplay, refreshCreditsBalance };

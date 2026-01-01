// BEGIN PAJAMADOT HACK
/**
 * PajamaDot Settings Panel
 * Settings for PajamaDot AI generation integration
 */

import { Panel, Container, Button, Label, TextInput } from '@playcanvas/pcui';

declare const editor: any;

// Token management
const STORAGE_KEY = 'pajamadot_api_token';
// Generation API for credits and AI generation (NOT MCP!)
const API_BASE_URL = 'https://generation.pajamadot.com';

const TokenManager = {
    getToken(): string | null {
        try {
            return localStorage.getItem(STORAGE_KEY);
        } catch {
            return null;
        }
    },
    setToken(token: string): void {
        try {
            localStorage.setItem(STORAGE_KEY, token);
        } catch (err) {
            console.error('[PajamaDot] Failed to save token:', err);
        }
    },
    clearToken(): void {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (err) {
            console.error('[PajamaDot] Failed to clear token:', err);
        }
    },
    hasToken(): boolean {
        return !!this.getToken();
    },
    isValidFormat(token: string): boolean {
        return token.startsWith('sp_live_') || token.startsWith('sp_test_');
    },
    async validate(token: string): Promise<boolean> {
        try {
            const response = await fetch(`${API_BASE_URL}/credits/balance`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            return response.ok;
        } catch {
            return false;
        }
    },
    async getCredits(): Promise<{ balance: number }> {
        const token = this.getToken();
        if (!token) throw new Error('No token');
        const response = await fetch(`${API_BASE_URL}/credits/balance`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    }
};

class PajamaDotSettingsPanel extends Panel {
    private _tokenInput: TextInput;
    private _verifyButton: Button;
    private _statusLabel: Label;
    private _creditsValue: Label;
    private _isVerifying: boolean = false;

    constructor(args: any) {
        args = Object.assign({}, args);
        args.headerText = 'PAJAMADOT AI';
        args.collapsible = true;
        args.collapsed = true;

        super(args);

        this.class.add('settings-panel', 'pajamadot-settings-panel');

        // Add user-only settings icon
        const settingsScopeIcon = new Label({ class: 'settings-scope-icon' });
        settingsScopeIcon.dom.setAttribute('data-icon', String.fromCodePoint(parseInt('E337', 16)));
        this.header.append(settingsScopeIcon);

        // Build UI directly
        this._buildUI();

        // Add styles
        this._addStyles();

        // Load initial state
        this._loadCurrentToken();

        console.log('[PajamaDot] Settings panel initialized');
    }

    private _buildUI(): void {
        // Token row
        const tokenRow = new Container({
            flex: true,
            flexDirection: 'row',
            class: 'pajamadot-token-row'
        });

        const tokenLabel = new Label({
            text: 'API Token',
            class: 'pajamadot-label'
        });

        this._tokenInput = new TextInput({
            placeholder: 'sp_live_xxxx or sp_test_xxxx',
            class: 'pajamadot-token-input'
        });

        tokenRow.append(tokenLabel);
        tokenRow.append(this._tokenInput);
        this.append(tokenRow);

        // Button row
        const buttonRow = new Container({
            flex: true,
            flexDirection: 'row',
            class: 'pajamadot-button-row'
        });

        this._verifyButton = new Button({
            text: 'Verify',
            class: ['pajamadot-btn', 'pajamadot-btn-verify']
        });

        const saveButton = new Button({
            text: 'Save',
            class: ['pajamadot-btn', 'pajamadot-btn-save']
        });

        const clearButton = new Button({
            text: 'Clear',
            class: ['pajamadot-btn', 'pajamadot-btn-clear']
        });

        buttonRow.append(this._verifyButton);
        buttonRow.append(saveButton);
        buttonRow.append(clearButton);
        this.append(buttonRow);

        // Status row
        const statusRow = new Container({
            class: 'pajamadot-status-row'
        });

        this._statusLabel = new Label({
            text: '',
            class: 'pajamadot-status'
        });

        statusRow.append(this._statusLabel);
        this.append(statusRow);

        // Credits row
        const creditsRow = new Container({
            flex: true,
            flexDirection: 'row',
            class: 'pajamadot-credits-row'
        });

        const creditsLabel = new Label({
            text: 'Credits:',
            class: 'pajamadot-label'
        });

        this._creditsValue = new Label({
            text: '—',
            class: 'pajamadot-credits-value'
        });

        creditsRow.append(creditsLabel);
        creditsRow.append(this._creditsValue);
        this.append(creditsRow);

        // Help row
        const helpRow = new Container({
            class: 'pajamadot-help-row'
        });

        const helpLink = new Label({
            text: 'Get token at story.pajamadot.com/settings/api-tokens',
            class: 'pajamadot-help-link'
        });
        helpLink.dom.style.cursor = 'pointer';
        helpLink.dom.addEventListener('click', () => {
            window.open('https://story.pajamadot.com/settings/api-tokens', '_blank');
        });

        helpRow.append(helpLink);
        this.append(helpRow);

        // Event handlers
        this._verifyButton.on('click', () => this._onVerify());
        saveButton.on('click', () => this._onSave());
        clearButton.on('click', () => this._onClear());
    }

    private _loadCurrentToken(): void {
        const token = TokenManager.getToken();
        if (token) {
            const masked = token.slice(0, 8) + '...' + token.slice(-4);
            this._tokenInput.value = masked;
            this._loadCredits();
        }
    }

    private async _onVerify(): Promise<void> {
        if (this._isVerifying) return;

        let token = this._tokenInput.value.trim();

        // If masked, use stored token
        if (token.includes('...') && TokenManager.hasToken()) {
            token = TokenManager.getToken()!;
        }

        if (!token) {
            this._setStatus('Enter a token', 'error');
            return;
        }

        if (!TokenManager.isValidFormat(token)) {
            this._setStatus('Invalid format (sp_live_* or sp_test_*)', 'error');
            return;
        }

        this._isVerifying = true;
        this._verifyButton.enabled = false;
        this._setStatus('Verifying...', 'pending');

        try {
            const isValid = await TokenManager.validate(token);
            if (isValid) {
                this._setStatus('Valid!', 'success');
                TokenManager.setToken(token);
                await this._loadCredits();
            } else {
                this._setStatus('Invalid or expired', 'error');
                this._creditsValue.text = '—';
            }
        } catch (err) {
            this._setStatus('Verification failed', 'error');
            this._creditsValue.text = '—';
        } finally {
            this._isVerifying = false;
            this._verifyButton.enabled = true;
        }
    }

    private _onSave(): void {
        const inputValue = this._tokenInput.value.trim();

        if (inputValue.includes('...') && TokenManager.hasToken()) {
            this._setStatus('Already saved', 'success');
            return;
        }

        if (!inputValue) {
            this._setStatus('Enter a token', 'error');
            return;
        }

        if (!TokenManager.isValidFormat(inputValue)) {
            this._setStatus('Invalid format', 'error');
            return;
        }

        TokenManager.setToken(inputValue);
        const masked = inputValue.slice(0, 8) + '...' + inputValue.slice(-4);
        this._tokenInput.value = masked;
        this._setStatus('Saved!', 'success');
        this._loadCredits();

        editor.emit('pajamadot:token:changed');
    }

    private _onClear(): void {
        TokenManager.clearToken();
        this._tokenInput.value = '';
        this._creditsValue.text = '—';
        this._setStatus('Cleared', 'success');

        editor.emit('pajamadot:token:changed');
    }

    private async _loadCredits(): Promise<void> {
        if (!TokenManager.hasToken()) {
            this._creditsValue.text = '—';
            return;
        }

        try {
            const data = await TokenManager.getCredits();
            this._creditsValue.text = data.balance.toString();
            this._creditsValue.class.remove('error');
        } catch {
            this._creditsValue.text = 'Error';
            this._creditsValue.class.add('error');
        }
    }

    private _setStatus(message: string, type: 'success' | 'error' | 'pending'): void {
        this._statusLabel.text = message;
        this._statusLabel.class.remove('success', 'error', 'pending');
        this._statusLabel.class.add(type);
    }

    private _addStyles(): void {
        const styleId = 'pajamadot-settings-styles';
        if (document.getElementById(styleId)) return;

        const styles = document.createElement('style');
        styles.id = styleId;
        styles.textContent = `
            .pajamadot-settings-panel .pcui-panel-content {
                padding: 8px;
            }
            .pajamadot-token-row {
                margin-bottom: 8px;
                gap: 8px;
                align-items: center;
            }
            .pajamadot-label {
                min-width: 70px;
                color: #aaa;
                font-size: 12px;
            }
            .pajamadot-token-input {
                flex: 1;
            }
            .pajamadot-button-row {
                margin-bottom: 8px;
                gap: 6px;
            }
            .pajamadot-btn {
                min-width: 60px;
                font-size: 11px;
            }
            .pajamadot-btn-verify {
                background: #4a90d9;
                color: white;
            }
            .pajamadot-btn-verify:hover {
                background: #5a9fe9;
            }
            .pajamadot-btn-save {
                background: #4caf50;
                color: white;
            }
            .pajamadot-btn-save:hover {
                background: #5cb85c;
            }
            .pajamadot-btn-clear {
                background: #555;
                color: white;
            }
            .pajamadot-btn-clear:hover {
                background: #666;
            }
            .pajamadot-status-row {
                margin-bottom: 8px;
            }
            .pajamadot-status {
                font-size: 11px;
                min-height: 16px;
            }
            .pajamadot-status.success { color: #4caf50; }
            .pajamadot-status.error { color: #f44336; }
            .pajamadot-status.pending { color: #ff9800; }
            .pajamadot-credits-row {
                margin-bottom: 8px;
                gap: 8px;
                align-items: center;
            }
            .pajamadot-credits-value {
                color: #4a90d9;
                font-weight: 500;
            }
            .pajamadot-credits-value.error {
                color: #f44336;
            }
            .pajamadot-help-row {
                margin-top: 4px;
            }
            .pajamadot-help-link {
                color: #4a90d9;
                font-size: 11px;
                text-decoration: underline;
            }
            .pajamadot-help-link:hover {
                color: #6ba8e5;
            }
        `;
        document.head.appendChild(styles);
    }
}

export { PajamaDotSettingsPanel };
// END PAJAMADOT HACK

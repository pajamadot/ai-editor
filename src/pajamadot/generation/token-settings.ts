/**
 * Token Settings Picker
 * Modal for configuring PajamaDot API token
 */

import { Button, Container, Label, Panel, TextInput } from '@playcanvas/pcui';

import { PajamaDotTokenManager } from './token-manager';
import { generationClient } from './generation-client';

declare const editor: any;

class TokenSettingsPicker extends Container {
    private _overlay: HTMLElement | null = null;
    private _tokenInput: TextInput;
    private _statusLabel: Label;
    private _balanceLabel: Label;
    private _testButton: Button;
    private _saveButton: Button;

    constructor() {
        super({
            class: 'pajamadot-token-picker'
        });

        this._buildUI();
    }

    private _buildUI() {
        // Main panel
        const panel = new Panel({
            headerText: 'PAJAMADOT API TOKEN',
            collapsible: false,
            flex: true
        });
        this.append(panel);

        // Info text
        const infoLabel = new Label({
            text: 'Enter your PajamaDot API token to enable AI generation features. Get your token from pajamadot.com/settings.',
            class: 'pajamadot-token-info'
        });
        panel.content.append(infoLabel);

        // Token input
        const inputContainer = new Container({
            flex: true,
            flexDirection: 'row',
            class: 'pajamadot-token-input-row'
        });

        this._tokenInput = new TextInput({
            placeholder: 'sp_live_xxxx or sp_test_xxxx',
            class: 'pajamadot-token-input'
        });
        this._tokenInput.value = PajamaDotTokenManager.getToken() || '';
        inputContainer.append(this._tokenInput);

        this._testButton = new Button({
            text: 'Test',
            class: 'pajamadot-btn-secondary'
        });
        this._testButton.on('click', () => this._testToken());
        inputContainer.append(this._testButton);

        panel.content.append(inputContainer);

        // Status label
        this._statusLabel = new Label({
            text: '',
            class: 'pajamadot-token-status'
        });
        panel.content.append(this._statusLabel);

        // Balance display
        this._balanceLabel = new Label({
            text: '',
            class: 'pajamadot-token-balance'
        });
        panel.content.append(this._balanceLabel);

        // Buttons row
        const buttonsContainer = new Container({
            flex: true,
            flexDirection: 'row',
            class: 'pajamadot-token-buttons'
        });

        const cancelButton = new Button({
            text: 'Cancel',
            class: 'pajamadot-btn-secondary'
        });
        cancelButton.on('click', () => this.close());
        buttonsContainer.append(cancelButton);

        this._saveButton = new Button({
            text: 'Save Token',
            class: 'pajamadot-btn-primary'
        });
        this._saveButton.on('click', () => this._saveToken());
        buttonsContainer.append(this._saveButton);

        panel.content.append(buttonsContainer);

        // Link to get token
        const linkLabel = new Label({
            text: 'Need a token? Visit pajamadot.com/settings',
            class: 'pajamadot-token-link'
        });
        linkLabel.dom.style.cursor = 'pointer';
        linkLabel.dom.addEventListener('click', () => {
            window.open('https://pajamadot.com/settings', '_blank');
        });
        panel.content.append(linkLabel);

        // Load initial balance if token exists
        if (PajamaDotTokenManager.hasToken()) {
            this._loadBalance();
        }
    }

    private async _testToken() {
        const token = this._tokenInput.value.trim();

        if (!token) {
            this._setStatus('Please enter a token', 'error');
            return;
        }

        if (!PajamaDotTokenManager.isValidTokenFormat(token)) {
            this._setStatus('Invalid token format. Tokens start with sp_live_ or sp_test_', 'error');
            return;
        }

        this._setStatus('Testing token...', 'pending');
        this._testButton.enabled = false;

        try {
            const isValid = await PajamaDotTokenManager.validateToken(token);

            if (isValid) {
                this._setStatus('Token is valid!', 'success');
                // Temporarily set token to load balance
                const oldToken = PajamaDotTokenManager.getToken();
                PajamaDotTokenManager.setToken(token);
                await this._loadBalance();
                if (oldToken && oldToken !== token) {
                    // Restore old token if we were just testing
                    PajamaDotTokenManager.setToken(oldToken);
                }
            } else {
                this._setStatus('Token is invalid or expired', 'error');
                this._balanceLabel.text = '';
            }
        } catch (error) {
            this._setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
            this._balanceLabel.text = '';
        } finally {
            this._testButton.enabled = true;
        }
    }

    private async _loadBalance() {
        try {
            const credits = await generationClient.getCredits();
            this._balanceLabel.text = `Credit Balance: ${credits.balance}`;
            this._balanceLabel.class.remove('error');
        } catch (error) {
            this._balanceLabel.text = 'Could not load balance';
            this._balanceLabel.class.add('error');
        }
    }

    private _saveToken() {
        const token = this._tokenInput.value.trim();

        if (!token) {
            PajamaDotTokenManager.clearToken();
            this._setStatus('Token cleared', 'success');
            this._balanceLabel.text = '';
            setTimeout(() => this.close(), 1000);
            return;
        }

        if (!PajamaDotTokenManager.isValidTokenFormat(token)) {
            this._setStatus('Invalid token format', 'error');
            return;
        }

        PajamaDotTokenManager.setToken(token);
        this._setStatus('Token saved!', 'success');
        this._loadBalance();

        // Emit event for other components
        editor.emit('pajamadot:token:changed');

        setTimeout(() => this.close(), 1000);
    }

    private _setStatus(message: string, type: 'success' | 'error' | 'pending') {
        this._statusLabel.text = message;
        this._statusLabel.class.remove('success', 'error', 'pending');
        this._statusLabel.class.add(type);
    }

    show() {
        if (this._overlay) return;

        // Create overlay
        this._overlay = document.createElement('div');
        this._overlay.className = 'pajamadot-picker-overlay';
        this._overlay.addEventListener('click', (e) => {
            if (e.target === this._overlay) {
                this.close();
            }
        });

        // Add picker content
        this._overlay.appendChild(this.dom);
        document.body.appendChild(this._overlay);

        // Focus input
        this._tokenInput.focus();
    }

    close() {
        if (this._overlay) {
            this._overlay.remove();
            this._overlay = null;
        }
        this.destroy();
    }
}

/**
 * Add token picker styles
 */
function addTokenPickerStyles(): void {
    const styleId = 'pajamadot-token-picker-styles';
    if (document.getElementById(styleId)) return;

    const styles = document.createElement('style');
    styles.id = styleId;
    styles.textContent = `
        .pajamadot-picker-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        }
        .pajamadot-token-picker {
            background: #2a2a2a;
            border-radius: 8px;
            min-width: 400px;
            max-width: 500px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        }
        .pajamadot-token-picker .pcui-panel-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 8px 8px 0 0;
        }
        .pajamadot-token-info {
            color: #888;
            font-size: 12px;
            margin-bottom: 12px;
            line-height: 1.4;
        }
        .pajamadot-token-input-row {
            display: flex;
            gap: 8px;
            margin-bottom: 12px;
        }
        .pajamadot-token-input {
            flex: 1;
        }
        .pajamadot-token-status {
            margin-bottom: 8px;
            font-size: 12px;
            min-height: 18px;
        }
        .pajamadot-token-status.success {
            color: #4caf50;
        }
        .pajamadot-token-status.error {
            color: #f44336;
        }
        .pajamadot-token-status.pending {
            color: #ff9800;
        }
        .pajamadot-token-balance {
            color: #4a90d9;
            font-size: 13px;
            margin-bottom: 12px;
        }
        .pajamadot-token-balance.error {
            color: #f44336;
        }
        .pajamadot-token-buttons {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
            margin-top: 16px;
        }
        .pajamadot-token-link {
            color: #4a90d9;
            font-size: 12px;
            margin-top: 12px;
            text-decoration: underline;
        }
        .pajamadot-token-link:hover {
            color: #6ba8e5;
        }
        .pajamadot-btn-primary {
            background: #4a90d9;
            color: white;
            border: none;
        }
        .pajamadot-btn-primary:hover {
            background: #5a9fe9;
        }
        .pajamadot-btn-secondary {
            background: #444;
            color: white;
            border: none;
        }
        .pajamadot-btn-secondary:hover {
            background: #555;
        }
    `;
    document.head.appendChild(styles);
}

// Register editor methods
function registerEditorMethods() {
    addTokenPickerStyles();

    editor.method('picker:pajamadot:token', () => {
        const picker = new TokenSettingsPicker();
        picker.show();
        return picker;
    });

    editor.method('pajamadot:hasToken', () => {
        return PajamaDotTokenManager.hasToken();
    });

    editor.method('pajamadot:getCredits', async () => {
        if (!PajamaDotTokenManager.hasToken()) {
            return null;
        }
        try {
            return await generationClient.getCredits();
        } catch {
            return null;
        }
    });
}

// Safely register when editor is available
if (typeof editor !== 'undefined' && editor) {
    try {
        editor.once('load', registerEditorMethods);
    } catch (err) {
        console.warn('[PajamaDot] Could not register editor load listener:', err);
    }
}

export { TokenSettingsPicker };

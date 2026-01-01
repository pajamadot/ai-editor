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

// Register editor method
editor.once('load', () => {
    editor.method('picker:pajamadot:token', () => {
        const picker = new TokenSettingsPicker();
        picker.show();
        return picker;
    });

    // Add method to check if token is configured
    editor.method('pajamadot:hasToken', () => {
        return PajamaDotTokenManager.hasToken();
    });

    // Add method to get current balance
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

    console.log('[PajamaDot] Token settings registered');
});

export { TokenSettingsPicker };

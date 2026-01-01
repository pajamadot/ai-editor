/**
 * Token Manager
 * Manages PajamaDot API tokens for AIGC generation
 */

declare const editor: any;

const TOKEN_KEY = 'pajamadot:api_token';
const BASE_URL_KEY = 'pajamadot:api_base_url';
const DEFAULT_BASE_URL = 'https://generation.pajamadot.com';

/**
 * Token validation regex patterns
 * Tokens start with sp_live_ or sp_test_
 */
const TOKEN_PATTERN = /^sp_(live|test)_[A-Za-z0-9]+$/;

/**
 * Safe localStorage wrapper with fallback
 */
function safeLocalStorageSet(key: string, value: string): void {
    try {
        // Try PlayCanvas editor method first
        if (typeof editor !== 'undefined' && editor && typeof editor.call === 'function') {
            try {
                editor.call('localStorage:set', key, value);
                return;
            } catch (e) {
                // Method not available, fall through to native localStorage
            }
        }
        // Fallback to native localStorage
        localStorage.setItem(key, value);
    } catch (e) {
        console.error('[PajamaDot] Failed to save to localStorage:', e);
    }
}

function safeLocalStorageGet(key: string): string | null {
    try {
        // Try PlayCanvas editor method first
        if (typeof editor !== 'undefined' && editor && typeof editor.call === 'function') {
            try {
                const value = editor.call('localStorage:get', key);
                if (value !== undefined) return value || null;
            } catch (e) {
                // Method not available, fall through to native localStorage
            }
        }
        // Fallback to native localStorage
        return localStorage.getItem(key);
    } catch (e) {
        console.error('[PajamaDot] Failed to read from localStorage:', e);
        return null;
    }
}

class PajamaDotTokenManager {
    /**
     * Store API token in localStorage
     */
    static setToken(token: string): void {
        safeLocalStorageSet(TOKEN_KEY, token);
        console.log('[PajamaDot] API token stored');
    }

    /**
     * Get stored API token
     * @returns Token string or null if not set
     */
    static getToken(): string | null {
        return safeLocalStorageGet(TOKEN_KEY);
    }

    /**
     * Remove stored API token
     */
    static clearToken(): void {
        safeLocalStorageSet(TOKEN_KEY, '');
        console.log('[PajamaDot] API token cleared');
    }

    /**
     * Check if a token has valid format
     * @param token Token to validate
     * @returns True if token format is valid
     */
    static isValidTokenFormat(token: string): boolean {
        if (!token || typeof token !== 'string') {
            return false;
        }
        return TOKEN_PATTERN.test(token);
    }

    /**
     * Test token by calling the credits balance endpoint
     * @param token Token to validate
     * @returns True if token is valid and accepted by API
     */
    static async validateToken(token: string): Promise<boolean> {
        if (!this.isValidTokenFormat(token)) {
            return false;
        }

        try {
            const response = await fetch(`${this.getBaseUrl()}/credits/balance`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.ok;
        } catch (error) {
            console.error('[PajamaDot] Token validation failed:', error);
            return false;
        }
    }

    /**
     * Get the API base URL
     * @returns Base URL for API calls
     */
    static getBaseUrl(): string {
        return safeLocalStorageGet(BASE_URL_KEY) || DEFAULT_BASE_URL;
    }

    /**
     * Set custom API base URL (for testing/staging)
     * @param url Custom base URL
     */
    static setBaseUrl(url: string): void {
        safeLocalStorageSet(BASE_URL_KEY, url);
    }

    /**
     * Reset base URL to default
     */
    static resetBaseUrl(): void {
        safeLocalStorageSet(BASE_URL_KEY, '');
    }

    /**
     * Check if a token is currently stored
     * @returns True if a token is stored
     */
    static hasToken(): boolean {
        const token = this.getToken();
        return token !== null && token.length > 0;
    }

    /**
     * Get authorization headers for API calls
     * @returns Headers object with Authorization header
     * @throws Error if no token is stored
     */
    static getAuthHeaders(): Record<string, string> {
        const token = this.getToken();
        if (!token) {
            throw new Error('No API token configured. Please set your PajamaDot API token.');
        }

        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }
}

export { PajamaDotTokenManager };

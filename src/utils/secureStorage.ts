/**
 * Secure storage utilities to replace direct localStorage usage
 * Provides encryption and validation for sensitive data
 */

import { encryptToken, decryptToken } from '@/lib/encryption';
import { logger } from '@/lib/logger';

type StorageType = 'localStorage' | 'sessionStorage';

interface SecureStorageOptions {
  encrypt?: boolean;
  ttl?: number; // Time to live in milliseconds
}

interface StorageItem {
  value: string;
  encrypted: boolean;
  timestamp: number;
  ttl?: number;
}

export class SecureStorage {
  private storage: Storage;

  constructor(type: StorageType = 'localStorage') {
    this.storage = type === 'sessionStorage' ? sessionStorage : localStorage;
  }

  /**
   * Set an item in storage with optional encryption and TTL
   */
  async setItem(
    key: string, 
    value: string, 
    options: SecureStorageOptions = {}
  ): Promise<void> {
    try {
      const { encrypt = false, ttl } = options;
      
      const item: StorageItem = {
        value: encrypt ? await encryptToken(value) : value,
        encrypted: encrypt,
        timestamp: Date.now(),
        ttl
      };

      this.storage.setItem(key, JSON.stringify(item));
    } catch (error) {
      logger.error('SecureStorage: Failed to set item', { key, error });
      throw new Error('Failed to store data securely');
    }
  }

  /**
   * Get an item from storage with automatic decryption and TTL check
   */
  async getItem(key: string): Promise<string | null> {
    try {
      const stored = this.storage.getItem(key);
      if (!stored) return null;

      const item: StorageItem = JSON.parse(stored);
      
      // Check TTL
      if (item.ttl && Date.now() - item.timestamp > item.ttl) {
        this.removeItem(key);
        return null;
      }

      // Decrypt if needed
      return item.encrypted ? await decryptToken(item.value) : item.value;
    } catch (error) {
      logger.error('SecureStorage: Failed to get item', { key, error });
      // Remove corrupted data
      this.removeItem(key);
      return null;
    }
  }

  /**
   * Remove an item from storage
   */
  removeItem(key: string): void {
    this.storage.removeItem(key);
  }

  /**
   * Clear all items from storage
   */
  clear(): void {
    this.storage.clear();
  }

  /**
   * Check if an item exists and is valid
   */
  hasItem(key: string): boolean {
    try {
      const stored = this.storage.getItem(key);
      if (!stored) return false;

      const item: StorageItem = JSON.parse(stored);
      
      // Check TTL
      if (item.ttl && Date.now() - item.timestamp > item.ttl) {
        this.removeItem(key);
        return false;
      }

      return true;
    } catch {
      this.removeItem(key);
      return false;
    }
  }

  /**
   * Clean up expired items
   */
  cleanup(): void {
    const keys = Object.keys(this.storage);
    keys.forEach(key => {
      try {
        const stored = this.storage.getItem(key);
        if (!stored) return;

        const item: StorageItem = JSON.parse(stored);
        if (item.ttl && Date.now() - item.timestamp > item.ttl) {
          this.removeItem(key);
        }
      } catch {
        // Remove malformed items
        this.removeItem(key);
      }
    });
  }
}

// Default instances
export const secureLocalStorage = new SecureStorage('localStorage');
export const secureSessionStorage = new SecureStorage('sessionStorage');

// Convenience functions for common use cases
export const userPreferences = {
  async setTheme(theme: string): Promise<void> {
    await secureLocalStorage.setItem('theme', theme);
  },

  async getTheme(): Promise<string | null> {
    return await secureLocalStorage.getItem('theme');
  },

  async setPrimaryAccount(accountId: string): Promise<void> {
    await secureLocalStorage.setItem('primaryAccountId', accountId);
  },

  async getPrimaryAccount(): Promise<string | null> {
    return await secureLocalStorage.getItem('primaryAccountId');
  },

  async setOnboardingComplete(): Promise<void> {
    await secureLocalStorage.setItem('welcome-completed', 'true');
  },

  async getOnboardingComplete(): Promise<boolean> {
    const completed = await secureLocalStorage.getItem('welcome-completed');
    return completed === 'true';
  }
};

// Deprecated: For backwards compatibility only
// These should be gradually migrated to secure storage
export const legacyStorage = {
  clearApiKeys(): void {
    localStorage.removeItem('openai_api_key');
    logger.warn('Cleared legacy API key from localStorage');
  },

  migrateToSecure(): void {
    // Migrate existing data to secure storage
    const theme = localStorage.getItem('theme');
    const primaryAccount = localStorage.getItem('primaryAccountId');
    const onboarding = localStorage.getItem('welcome-completed');

    if (theme) {
      userPreferences.setTheme(theme);
      localStorage.removeItem('theme');
    }

    if (primaryAccount) {
      userPreferences.setPrimaryAccount(primaryAccount);
      localStorage.removeItem('primaryAccountId');
    }

    if (onboarding) {
      userPreferences.setOnboardingComplete();
      localStorage.removeItem('welcome-completed');
    }

    logger.info('Migrated legacy storage to secure storage');
  }
};
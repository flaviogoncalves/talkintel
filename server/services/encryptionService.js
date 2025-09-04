import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.encryptionKey = this.getEncryptionKey();
  }

  getEncryptionKey() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('ENCRYPTION_KEY not found in environment variables');
    }
    // Convert hex string to Buffer
    return Buffer.from(key, 'hex');
  }

  /**
   * Encrypts an API key using AES-256-GCM
   * @param {string} apiKey - The API key to encrypt
   * @param {string} companyId - Company ID for additional context
   * @returns {object} - Object containing encrypted data and IV
   */
  encryptApiKey(apiKey, companyId) {
    try {
      // Generate a random initialization vector
      const iv = crypto.randomBytes(16);
      
      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
      
      // Add company ID as additional authenticated data (AAD)
      cipher.setAAD(Buffer.from(companyId, 'utf8'));
      
      // Encrypt the API key
      let encrypted = cipher.update(apiKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get the authentication tag
      const authTag = cipher.getAuthTag();
      
      // Combine encrypted data and auth tag
      const combined = encrypted + ':' + authTag.toString('hex');
      
      return {
        encrypted: combined,
        iv: iv.toString('hex')
      };
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt API key');
    }
  }

  /**
   * Decrypts an encrypted API key
   * @param {string} encryptedData - The encrypted API key with auth tag
   * @param {string} iv - The initialization vector (hex string)
   * @param {string} companyId - Company ID for verification
   * @returns {string} - The decrypted API key
   */
  decryptApiKey(encryptedData, iv, companyId) {
    try {
      if (!encryptedData || !iv) {
        throw new Error('Missing encrypted data or IV');
      }

      // Split encrypted data and auth tag
      const [encrypted, authTag] = encryptedData.split(':');
      if (!encrypted || !authTag) {
        throw new Error('Invalid encrypted data format');
      }
      
      // Convert IV from hex string to Buffer
      const ivBuffer = Buffer.from(iv, 'hex');
      
      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, ivBuffer);
      
      // Set the authentication tag
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      
      // Add company ID as additional authenticated data (AAD)
      decipher.setAAD(Buffer.from(companyId, 'utf8'));
      
      // Decrypt the API key
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt API key');
    }
  }

  /**
   * Masks an API key for display (shows only last 4 characters)
   * @param {string} apiKey - The API key to mask
   * @returns {string} - Masked API key
   */
  maskApiKey(apiKey) {
    if (!apiKey || apiKey.length < 8) {
      return '****';
    }
    const lastFour = apiKey.slice(-4);
    return '*'.repeat(apiKey.length - 4) + lastFour;
  }

  /**
   * Generates a new encryption key (for setup purposes)
   * @returns {string} - Hex string of the encryption key
   */
  static generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validates if an API key format is correct (basic validation)
   * @param {string} apiKey - The API key to validate
   * @returns {boolean} - True if valid format
   */
  validateApiKeyFormat(apiKey) {
    // Basic validation - at least 20 characters, alphanumeric with dashes
    const apiKeyRegex = /^[a-zA-Z0-9\-_]{20,}$/;
    return apiKeyRegex.test(apiKey);
  }
}

// Export singleton instance
export default new EncryptionService();
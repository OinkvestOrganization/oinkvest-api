import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // recomendado para GCM

export class CryptoUtil {
  private static key: Buffer;

  private static getKey(): Buffer {
    if (!this.key) {
      const keyStr = process.env.APP_ENCRYPTION_KEY;
      if (!keyStr) throw new Error('APP_ENCRYPTION_KEY is not set in .env');
      this.key = Buffer.from(keyStr, keyStr.length === 64 ? 'hex' : 'utf-8');
    }
    return this.key;
  }

  static encrypt(plainText: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.getKey(), iv);

    const encrypted = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  static decrypt(cipherText: string): string {
    const data = Buffer.from(cipherText, 'base64');
    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(IV_LENGTH, IV_LENGTH + 16);
    const encrypted = data.subarray(IV_LENGTH + 16);

    const decipher = crypto.createDecipheriv(ALGORITHM, this.getKey(), iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }
}

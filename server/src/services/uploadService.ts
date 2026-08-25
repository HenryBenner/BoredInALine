import { randomUUID } from 'crypto';
import { Client } from '@replit/object-storage';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

interface UploadResult {
  objectPath: string;
  publicUrl: string;
}

export class UploadService {
  private client: Client;

  constructor() {
    this.client = new Client();
  }

  validateRequest(mimeType: string, fileSize: number): { valid: boolean; error?: string } {
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return { valid: false, error: `File type ${mimeType} is not allowed` };
    }
    if (fileSize > MAX_FILE_SIZE) {
      return { valid: false, error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB` };
    }
    return { valid: true };
  }

  async uploadFile(
    fileBuffer: Buffer,
    mimeType: string,
    userId: string,
    folder: string = 'uploads'
  ): Promise<UploadResult> {
    const fileId = randomUUID();
    const extension = this.getExtensionFromMimeType(mimeType);
    const objectPath = `${folder}/${userId}/${fileId}${extension}`;

    const result = await this.client.uploadFromBytes(objectPath, fileBuffer);
    
    if (!result.ok) {
      console.error('Upload failed:', result.error);
      throw new Error('Failed to upload file. Please try again.');
    }

    return {
      objectPath,
      publicUrl: `/api/media/${objectPath}`,
    };
  }

  async downloadFile(objectPath: string): Promise<{ data: Buffer; mimeType: string } | null> {
    const result = await this.client.downloadAsBytes(objectPath);
    
    if (!result.ok) {
      console.error('Download failed:', result.error);
      return null;
    }

    const mimeType = this.getMimeTypeFromPath(objectPath);
    const bytes = result.value;
    
    let buffer: Buffer;
    if (Array.isArray(bytes) && bytes.length > 0 && Buffer.isBuffer(bytes[0])) {
      buffer = bytes[0];
    } else if (Buffer.isBuffer(bytes)) {
      buffer = bytes;
    } else if (bytes instanceof Uint8Array) {
      buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    } else if (bytes instanceof ArrayBuffer) {
      buffer = Buffer.from(bytes);
    } else {
      buffer = Buffer.from(bytes as any);
    }
    
    return {
      data: buffer,
      mimeType,
    };
  }

  async deleteFile(objectPath: string): Promise<boolean> {
    const result = await this.client.delete(objectPath);
    return result.ok;
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'video/mp4': '.mp4',
      'video/quicktime': '.mov',
      'video/webm': '.webm',
    };
    return extensions[mimeType] || '';
  }

  private getMimeTypeFromPath(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'mp4': 'video/mp4',
      'mov': 'video/quicktime',
      'webm': 'video/webm',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }
}

export const uploadService = new UploadService();

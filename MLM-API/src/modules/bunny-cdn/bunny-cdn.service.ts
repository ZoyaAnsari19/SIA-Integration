interface BunnyCDNConfig {
  apiKey: string;
  storageZoneName: string;
  storageEndpoint: string;
  cdnHostname: string;
}

export class BunnyCDNService {
  private config: BunnyCDNConfig;

  constructor() {
    this.config = {
      apiKey: process.env.BUNNY_API_KEY || '',
      storageZoneName: process.env.BUNNY_STORAGE_ZONE_NAME || 'mlm-storage',
      storageEndpoint: process.env.BUNNY_STORAGE_ENDPOINT || 'https://storage.bunnycdn.com',
      cdnHostname: process.env.BUNNY_CDN_HOSTNAME || 'mlm-cdn.b-cdn.net',
    };

    if (!this.config.apiKey) {
      throw new Error('BUNNY_API_KEY environment variable is required');
    }
  }

  /**
   * Upload a file to Bunny CDN
   * @param buffer File buffer
   * @param filename Unique filename
   * @param folder Folder path (e.g., 'profile_photos', 'payment_proofs')
   * @returns CDN URL of uploaded file
   */
  async uploadFile(buffer: Buffer, filename: string, folder: string = ''): Promise<string> {
    const path = folder ? `${folder}/${filename}` : filename;
    const url = `${this.config.storageEndpoint}/${this.config.storageZoneName}/${path}`;

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'AccessKey': this.config.apiKey,
          'Content-Type': 'application/octet-stream',
        },
        body: buffer,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Bunny CDN upload failed: ${response.status} - ${errorText}`);
      }

      return this.getCdnUrl(path);
    } catch (error) {
      console.error('Bunny CDN upload error:', error);
      throw error;
    }
  }

  /**
   * Delete a file from Bunny CDN
   * @param filepath Full path including folder and filename
   */
  async deleteFile(filepath: string): Promise<void> {
    const url = `${this.config.storageEndpoint}/${this.config.storageZoneName}/${filepath}`;

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'AccessKey': this.config.apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Bunny CDN delete failed: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('Bunny CDN delete error:', error);
      throw error;
    }
  }

  /**
   * Get public CDN URL for a file
   * @param filepath Path to file
   */
  getCdnUrl(filepath: string): string {
    return `https://${this.config.cdnHostname}/${filepath}`;
  }

  /**
   * Generate a unique filename with timestamp
   * @param userId User ID
   * @param originalFilename Original filename with extension
   */
  generateFilename(userId: bigint, originalFilename: string): string {
    const timestamp = Date.now();
    const extension = originalFilename.split('.').pop();
    return `${userId}_${timestamp}.${extension}`;
  }

  /**
   * Validate file type
   * @param mimetype MIME type of file
   * @param allowedTypes Array of allowed MIME types
   */
  isValidFileType(mimetype: string, allowedTypes: string[]): boolean {
    return allowedTypes.includes(mimetype);
  }

  /**
   * Validate file size
   * @param size File size in bytes
   * @param maxSizeMB Maximum size in megabytes
   */
  isValidFileSize(size: number, maxSizeMB: number): boolean {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return size <= maxSizeBytes;
  }

  /**
   * Generate presigned upload URL for direct browser upload
   * This allows browser to upload directly to Bunny CDN without going through server
   * 
   * ⚠️ SECURITY NOTE: Bunny CDN doesn't support true presigned URLs like AWS S3.
   * The AccessKey is exposed to the browser. For better security:
   * 1. Use a separate read-only upload API key (if available in Bunny CDN)
   * 2. Implement IP restrictions in Bunny CDN settings
   * 3. Consider using a proxy endpoint for validation before upload
   * 
   * @param filename Unique filename
   * @param folder Folder path (e.g., 'course_videos')
   * @param expiresIn Expiration time in seconds (default: 1 hour) - Note: Not enforced by Bunny CDN
   * @returns Object with upload URL, CDN URL, and access key
   */
  generatePresignedUploadUrl(
    filename: string,
    folder: string = '',
    expiresIn: number = 3600
  ): { uploadUrl: string; cdnUrl: string; accessKey: string } {
    const path = folder ? `${folder}/${filename}` : filename;
    const uploadUrl = `${this.config.storageEndpoint}/${this.config.storageZoneName}/${path}`;
    const cdnUrl = this.getCdnUrl(path);

    return {
      uploadUrl,
      cdnUrl,
      accessKey: this.config.apiKey, // ⚠️ Exposed to browser - see security note above
    };
  }

  /**
   * Generate upload URL with temporary token (more secure approach)
   * Server validates request, then provides upload URL
   * @param filename Unique filename
   * @param folder Folder path
   * @param fileSize File size in bytes (for validation)
   * @param mimeType MIME type (for validation)
   * @returns Upload URL information
   */
  generateSecureUploadUrl(
    filename: string,
    folder: string = '',
    fileSize?: number,
    mimeType?: string
  ): { uploadUrl: string; cdnUrl: string; expiresAt: string } {
    const path = folder ? `${folder}/${filename}` : filename;
    const uploadUrl = `${this.config.storageEndpoint}/${this.config.storageZoneName}/${path}`;
    const cdnUrl = this.getCdnUrl(path);
    const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now

    return {
      uploadUrl,
      cdnUrl,
      expiresAt,
    };
  }
}

export const bunnyCDNService = new BunnyCDNService();


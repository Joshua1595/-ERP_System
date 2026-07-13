export interface IStorageProvider {
  /**
   * Upload a file to storage and return its metadata and accessible URL.
   */
  uploadFile(
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
    },
    folder?: string
  ): Promise<{
    key: string;
    url: string;
    provider: string;
  }>;

  /**
   * Delete a file from storage using its unique key.
   */
  deleteFile(key: string): Promise<void>;
}

export interface StorageService {
  /**
   * Uploads an object buffer with the specified key and optional content-type.
   * Returns the storage key.
   */
  uploadObject(key: string, buffer: Buffer, contentType?: string): Promise<string>;

  /**
   * Retrieves an object as a readable stream.
   */
  getObjectStream(key: string): Promise<NodeJS.ReadableStream>;

  /**
   * Retrieves an object as a buffer.
   */
  getObjectBuffer(key: string): Promise<Buffer>;

  /**
   * Deletes an object by key.
   */
  deleteObject(key: string): Promise<void>;

  /**
   * Checks whether an object exists by key.
   */
  objectExists(key: string): Promise<boolean>;
}

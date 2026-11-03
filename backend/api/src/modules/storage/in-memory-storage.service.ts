import { Injectable, NotFoundException } from '@nestjs/common';
import { Readable } from 'stream';
import { StorageService } from './storage.interface';

@Injectable()
export class InMemoryStorageService implements StorageService {
  private readonly storage = new Map<string, Buffer>();

  public async uploadObject(key: string, buffer: Buffer, _contentType?: string): Promise<string> {
    this.storage.set(key, Buffer.from(buffer));
    return key;
  }

  public async getObjectStream(key: string): Promise<NodeJS.ReadableStream> {
    const data = this.storage.get(key);
    if (!data) {
      throw new NotFoundException(`Object with key ${key} not found`);
    }
    return Readable.from(Buffer.from(data));
  }

  public async getObjectBuffer(key: string): Promise<Buffer> {
    const data = this.storage.get(key);
    if (!data) {
      throw new NotFoundException(`Object with key ${key} not found`);
    }
    return Buffer.from(data);
  }

  public async deleteObject(key: string): Promise<void> {
    this.storage.delete(key);
  }

  public async objectExists(key: string): Promise<boolean> {
    return this.storage.has(key);
  }

  public clear(): void {
    this.storage.clear();
  }
}

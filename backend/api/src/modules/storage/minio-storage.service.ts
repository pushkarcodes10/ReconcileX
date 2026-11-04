import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { StorageService } from './storage.interface';

@Injectable()
export class MinioStorageService implements StorageService, OnModuleInit {
  private readonly logger = new Logger(MinioStorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly fallbackStorage = new Map<string, Buffer>();
  private isMinioAvailable = false;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('app.storage.endpoint', 'localhost');
    const port = this.configService.get<number>('app.storage.port', 9000);
    const useSsl = this.configService.get<boolean>('app.storage.useSsl', false);
    const accessKey = this.configService.get<string>('app.storage.accessKey', 'minioadmin');
    const secretKey = this.configService.get<string>('app.storage.secretKey', 'minioadmin');
    this.bucket = this.configService.get<string>('app.storage.bucket', 'reconcilex-imports');

    const protocol = useSsl ? 'https' : 'http';
    const s3Endpoint = `${protocol}://${endpoint}:${port}`;

    this.s3Client = new S3Client({
      endpoint: s3Endpoint,
      region: 'us-east-1',
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: true,
    });
  }

  public async onModuleInit(): Promise<void> {
    try {
      await this.ensureBucketExists();
      this.isMinioAvailable = true;
    } catch (err) {
      this.isMinioAvailable = false;
      this.logger.warn(
        `MinIO storage unreachable at bucket "${this.bucket}": ${(err as Error).message}. Operating with in-memory storage fallback.`,
      );
    }
  }

  private async ensureBucketExists(): Promise<void> {
    try {
      await this.s3Client.send(
        new CreateBucketCommand({
          Bucket: this.bucket,
        }),
      );
      this.logger.log(`Initialized storage bucket: ${this.bucket}`);
    } catch (err: unknown) {
      const errorName = (err as { name?: string })?.name;
      if (errorName === 'BucketAlreadyOwnedByYou' || errorName === 'BucketAlreadyExists') {
        return;
      }
      throw err;
    }
  }

  public async uploadObject(
    key: string,
    buffer: Buffer,
    contentType: string = 'text/csv',
  ): Promise<string> {
    if (this.isMinioAvailable) {
      try {
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: buffer,
            ContentType: contentType,
          }),
        );
        return key;
      } catch (err) {
        this.logger.warn(
          `Failed uploading to MinIO: ${(err as Error).message}. Falling back to in-memory buffer for key: ${key}`,
        );
      }
    }
    this.fallbackStorage.set(key, Buffer.from(buffer));
    return key;
  }

  public async getObjectStream(key: string): Promise<NodeJS.ReadableStream> {
    if (this.fallbackStorage.has(key)) {
      return Readable.from(this.fallbackStorage.get(key)!);
    }

    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      if (!response.Body) {
        throw new NotFoundException(`Object "${key}" in bucket "${this.bucket}" has empty body`);
      }
      return response.Body as unknown as NodeJS.ReadableStream;
    } catch (err: unknown) {
      if (this.fallbackStorage.has(key)) {
        return Readable.from(this.fallbackStorage.get(key)!);
      }
      if ((err as { name?: string })?.name === 'NoSuchKey') {
        throw new NotFoundException(`Object with key "${key}" not found`);
      }
      throw err;
    }
  }

  public async getObjectBuffer(key: string): Promise<Buffer> {
    if (this.fallbackStorage.has(key)) {
      return Buffer.from(this.fallbackStorage.get(key)!);
    }
    const stream = await this.getObjectStream(key);
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) =>
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
      );
      stream.on('error', (err) => reject(err));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  public async deleteObject(key: string): Promise<void> {
    this.fallbackStorage.delete(key);
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch {
      // Ignore cleanup error in fallback
    }
  }

  public async objectExists(key: string): Promise<boolean> {
    if (this.fallbackStorage.has(key)) {
      return true;
    }
    try {
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }
}

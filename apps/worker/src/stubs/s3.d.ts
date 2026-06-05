declare module '@aws-sdk/client-s3' {
  export class S3Client {
    constructor(config: {
      region: string;
      endpoint?: string;
      forcePathStyle?: boolean;
      credentials: { accessKeyId: string; secretAccessKey: string };
    });
    send(command: unknown): Promise<unknown>;
  }
  export class GetObjectCommand {
    constructor(input: { Bucket: string; Key: string });
  }
  export class PutObjectCommand {
    constructor(input: { Bucket: string; Key: string; Body: Buffer; ContentType?: string });
  }
  export class DeleteObjectCommand {
    constructor(input: { Bucket: string; Key: string });
  }
}

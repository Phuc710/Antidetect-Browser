# Backend Service: Synchronization & Storage (Sync, Storage, Upload)

This service manages S3/R2 storage connections, presigned URL generation, and multipart file upload streams.

---

## 1. Cloudflare R2 Storage (S3 API compatibility)
*   **Driver**: `@aws-sdk/client-s3` in Node.js.
*   **Bucket Isolation**: Files are stored under the bucket directory structure:
    `midnight-sync-bucket/profiles/{profile_id}/{file_path}`
*   **Decryption Keys**: The storage service has **no access** to encryption keys. Files are stored as raw AES-GCM ciphertext blobs.

---

## 2. Presigned Upload URLs Signer
To avoid uploading massive file streams through the NestJS process, the backend generates signed upload URLs allowing the Electron client to PUT files directly to the S3 bucket:

```typescript
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand } from '@aws-sdk/client-s3';

const command = new PutObjectCommand({
  Bucket: 'midnight-sync-bucket',
  Key: `profiles/${profileId}/${filePath}`,
});
const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
```

---

## 3. Multipart Upload Stream Handlers
For larger profile backup imports:
*   **Parser**: `multer` or custom stream parser handles multipart headers.
*   **Chunk Processing**: Chunks are parsed and streamed directly to S3 without writing intermediate files to local disk, preventing memory leaks on the API container nodes.

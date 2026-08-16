import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { WorkerEnvironment } from "@evidera/runtime";

export function createEvidenceStore(environment: WorkerEnvironment) {
  const client = new S3Client({
    endpoint: environment.S3_ENDPOINT,
    region: environment.S3_REGION,
    forcePathStyle: environment.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: environment.S3_ACCESS_KEY, secretAccessKey: environment.S3_SECRET_KEY },
  });

  return {
    async putHtml(input: { organizationId: string; siteId: string; runId: string; url: string; body: Buffer }): Promise<{ key: string; sha256: string; originalBytes: number }> {
      const sha256 = createHash("sha256").update(input.body).digest("hex");
      const urlHash = createHash("sha256").update(input.url).digest("hex").slice(0, 24);
      const key = `${input.organizationId}/${input.siteId}/${input.runId}/html/${urlHash}-${sha256.slice(0, 16)}.html.gz`;
      const compressed = gzipSync(input.body, { level: 9 });
      await client.send(new PutObjectCommand({
        Bucket: environment.S3_BUCKET,
        Key: key,
        Body: compressed,
        ContentType: "text/html; charset=utf-8",
        ContentEncoding: "gzip",
        Metadata: { sha256, sourceurlhash: urlHash },
        ...(environment.S3_SERVER_SIDE_ENCRYPTION === "AES256" ? { ServerSideEncryption: "AES256" as const } : {}),
      }));
      return { key, sha256, originalBytes: input.body.length };
    },
    async putArtifact(input: { organizationId: string; siteId: string; runId: string; url: string; folder: string; extension: string; contentType: string; body: Buffer }): Promise<{ key: string; sha256: string; originalBytes: number }> {
      const sha256 = createHash("sha256").update(input.body).digest("hex");
      const urlHash = createHash("sha256").update(input.url).digest("hex").slice(0, 24);
      const key = `${input.organizationId}/${input.siteId}/${input.runId}/${input.folder}/${urlHash}-${sha256.slice(0, 16)}.${input.extension}`;
      await client.send(new PutObjectCommand({ Bucket: environment.S3_BUCKET, Key: key, Body: input.body, ContentType: input.contentType, Metadata: { sha256, sourceurlhash: urlHash }, ...(environment.S3_SERVER_SIDE_ENCRYPTION === "AES256" ? { ServerSideEncryption: "AES256" as const } : {}) }));
      return { key, sha256, originalBytes: input.body.length };
    },
  };
}

export type EvidenceStore = ReturnType<typeof createEvidenceStore>;

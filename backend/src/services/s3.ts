import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const region = process.env.AWS_REGION ?? 'us-east-1'

const s3 = new S3Client({
  region,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID     ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
  },
})

const DEFAULT_BUCKET           = process.env.AWS_S3_BUCKET           ?? ''
const DEFAULT_DOWNLOADS_BUCKET = process.env.AWS_S3_DOWNLOADS_BUCKET ?? DEFAULT_BUCKET

export async function uploadToS3(
  buffer: Buffer,
  key: string,
  contentType: string,
  bucket: string = DEFAULT_BUCKET,
): Promise<string> {
  await s3.send(new PutObjectCommand({
    Bucket:      bucket,
    Key:         key,
    Body:        buffer,
    ContentType: contentType,
  }))
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`
}

export async function deleteFromS3(key: string, bucket: string = DEFAULT_BUCKET): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}

export async function getPresignedDownloadUrl(
  key: string,
  expiresIn: number = 3600,
  bucket: string = DEFAULT_DOWNLOADS_BUCKET,
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key })
  return getSignedUrl(s3, command, { expiresIn })
}

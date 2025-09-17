// Cloudflare R2 client configuration
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// R2 configuration
const r2Client = new S3Client({
  region: 'auto',
  endpoint: import.meta.env.VITE_R2_ENDPOINT,
  credentials: {
    accessKeyId: import.meta.env.VITE_CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_CLOUDFLARE_SECRET_ACCESS_KEY,
  },
})

const BUCKET_NAME = import.meta.env.VITE_R2_BUCKET_NAME

// Upload file to R2
export const uploadFile = async (key: string, file: Uint8Array, contentType: string) => {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file,
    ContentType: contentType,
  })
  
  return await r2Client.send(command)
}

// Get signed URL for file access
export const getSignedUrlForFile = async (key: string, expiresIn: number = 3600) => {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })
  
  return await getSignedUrl(r2Client, command, { expiresIn })
}

// Get public URL for file (if bucket is public)
export const getPublicUrl = (key: string) => {
  return `${import.meta.env.VITE_R2_ENDPOINT}/${BUCKET_NAME}/${key}`
}

// Delete file from R2
export const deleteFile = async (key: string) => {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })
  
  return await r2Client.send(command)
}

export { r2Client }

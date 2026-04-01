import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// S3 клиент для Railway Bucket
const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'auto',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: true, // Обязательно для S3-compatible хранилищ
})

const BUCKET_NAME = process.env.S3_BUCKET || 'efficient-pocket-ymzettfb'

// Загрузка файла в S3
export const uploadToS3 = async (fileBuffer, fileName, contentType) => {
  try {
    const key = `uploads/${Date.now()}-${fileName}`
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    })

    await s3Client.send(command)
    
    // Возвращаем публичный URL (или presigned URL если bucket приватный)
    const fileUrl = `${process.env.S3_ENDPOINT}/${BUCKET_NAME}/${key}`
    
    return {
      key,
      fileUrl,
    }
  } catch (err) {
    console.error('S3 upload error:', err)
    throw err
  }
}

// Генерация presigned URL для скачивания (действует 1 час)
export const getDownloadUrl = async (key) => {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600, // 1 час
    })

    return signedUrl
  } catch (err) {
    console.error('S3 getDownloadUrl error:', err)
    throw err
  }
}

// Удаление файла из S3
export const deleteFromS3 = async (key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })

    await s3Client.send(command)
    
    return { success: true }
  } catch (err) {
    console.error('S3 delete error:', err)
    throw err
  }
}

export default s3Client

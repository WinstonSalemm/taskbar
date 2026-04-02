import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// S3 клиент для Railway Bucket
const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || "auto",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
  forcePathStyle: true, // Обязательно для S3-compatible хранилищ
});

const BUCKET_NAME = process.env.S3_BUCKET || "efficient-pocket-ymzettfb";

// Загрузка файла в S3
export const uploadToS3 = async (fileBuffer, fileName, contentType) => {
  try {
    // Убираем пробелы и спецсимволы из имени
    const cleanFileName = fileName
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_");

    const key = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${cleanFileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    });

    await s3Client.send(command);

    // Возвращаем presigned URL для скачивания
    const downloadUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      }),
      {
        expiresIn: 86400 * 7, // 7 дней
      },
    );

    return {
      key,
      fileUrl: downloadUrl, // Сразу presigned URL
    };
  } catch (err) {
    console.error("S3 upload error:", err);
    throw err;
  }
};

// Генерация presigned URL для скачивания (действует 7 дней)
export const getDownloadUrl = async (key) => {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 86400 * 7, // 7 дней
    });

    return signedUrl;
  } catch (err) {
    console.error("S3 getDownloadUrl error:", err);
    throw err;
  }
};

// Удаление файла из S3
export const deleteFromS3 = async (key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);

    return { success: true };
  } catch (err) {
    console.error("S3 delete error:", err);
    throw err;
  }
};

export default s3Client;

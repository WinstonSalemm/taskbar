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
  forcePathStyle: true,
});

const BUCKET_NAME = process.env.S3_BUCKET || "efficient-pocket-ymzettfb";

// Транслитерация русского в английский
const transliterate = (text) => {
  const ru =
    "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя";
  const en =
    "ABVGDEEZHZIKLMNOPRSTUFHCCSHSHYIEYUabvgdeezhziklmnoprstufhccshshyieyu";

  let result = "";
  for (let char of text) {
    const index = ru.indexOf(char);
    result += index >= 0 ? en[index] : char;
  }

  // Заменяем пробелы и спецсимволы на подчёркивание
  return result
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
};

// Загрузка файла в S3
export const uploadToS3 = async (fileBuffer, fileName, contentType) => {
  try {
    const cleanFileName = transliterate(fileName);
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);

    const key = `${timestamp}-${random}-${cleanFileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    });

    await s3Client.send(command);

    const downloadUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      }),
      {
        expiresIn: 86400 * 7,
      },
    );

    console.log("S3 upload:", {
      original: fileName,
      clean: cleanFileName,
      key: key,
    });

    return {
      key,
      fileUrl: downloadUrl,
      fileName: cleanFileName,
    };
  } catch (err) {
    console.error("S3 upload error:", err);
    throw err;
  }
};

// Генерация presigned URL
export const getDownloadUrl = async (key) => {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 86400 * 7,
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

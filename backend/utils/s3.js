import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// S3 клиент для Railway Bucket (используем AWS_* переменные)
const s3Client = new S3Client({
  endpoint: process.env.AWS_ENDPOINT_URL,
  region: process.env.AWS_DEFAULT_REGION || "auto",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
  forcePathStyle: true, // Обязательно для S3-compatible хранилищ
});

const BUCKET_NAME =
  process.env.AWS_S3_BUCKET_NAME || "efficient-pocket-ymzettfb";

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

  return result
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
};

// Загрузка файла в S3
export const uploadToS3 = async (fileBuffer, fileName, contentType) => {
  console.log("📤 uploadToS3 called with:", {
    fileName,
    contentType,
    bufferSize: fileBuffer?.length,
  });

  try {
    const cleanFileName = transliterate(fileName);
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);

    const key = `${timestamp}-${random}-${cleanFileName}`;

    console.log("📝 S3 key will be:", key);
    console.log("🪣 Bucket:", BUCKET_NAME);
    console.log(
      "🔑 Credentials present:",
      !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
    );
    console.log("🌐 Endpoint:", process.env.AWS_ENDPOINT_URL);

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    });

    console.log("📤 Sending PutObjectCommand...");
    await s3Client.send(command);
    console.log("✅ S3 upload successful!");

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

    console.log(
      "🔗 Presigned URL generated:",
      downloadUrl.substring(0, 100) + "...",
    );

    return {
      key,
      fileUrl: downloadUrl,
      fileName: cleanFileName,
    };
  } catch (err) {
    console.error("❌ S3 upload ERROR:", err);
    console.error("Error stack:", err.stack);
    console.error("Error code:", err.code);
    console.error("Error name:", err.name);
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

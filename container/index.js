import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const videoId = uuidv4();

dotenv.config();

const RESOLUTIONS = [
  { name: "360p", width: 480, height: 360 },
  { name: "480p", width: 858, height: 480 },
  { name: "720p", width: 1280, height: 720 },
];

const s3Client = new S3Client({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.ACCESS_KEY_SECRET,
  },
});

const BUCKET_NAME = process.env.BUCKET_NAME;
const KEY = process.env.KEY;

async function init() {
  console.log("Downloading video from S3...");

  const getCmd = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: decodeURIComponent(KEY.replace(/\+/g, " ")),
  });

  const result = await s3Client.send(getCmd);

  // Ensure directories exist
  await fs.mkdir("videos", { recursive: true });
  await fs.mkdir("transcoded", { recursive: true });
  await fs.mkdir(`transcoded/${videoId}`, { recursive: true });

  const originalVideoPath = path.resolve("videos/original.mp4");

  // Save file
  await fs.writeFile(
    originalVideoPath,
    Buffer.from(await result.Body.transformToByteArray())
  );

  console.log("Original video saved:", originalVideoPath);

  // START TRANSCODING
  const promises = RESOLUTIONS.map((res) => {
    return new Promise((resolve, reject) => {
      const outputFile = `transcoded/${videoId}/video-${res.name}.mp4`;

      console.log(`Transcoding ${res.name}...`);

      ffmpeg(originalVideoPath)
        .output(outputFile)
        .videoCodec("libx264")
        .audioCodec("aac")
        .size(`${res.width}x${res.height}`)
        .format("mp4")
        .on("end", async () => {
          console.log(`Uploading ${res.name} to S3...`);

          const fileBuffer = await fs.readFile(outputFile);

          const putCmd = new PutObjectCommand({
            Bucket: "production-rishika",
            Key: `transcoded/${videoId}/video-${res.name}.mp4`,
            Body: fileBuffer,
            ContentType: "video/mp4",
          });

          await s3Client.send(putCmd);

          console.log(`${res.name} uploaded!`);
          resolve(true);
        })
        .on("error", reject)
        .run();
    });
  });

  await Promise.all(promises);

  console.log("All resolutions processed and uploaded!");
}

init().catch(console.error);

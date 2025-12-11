
# **🎞️ Video Transcoding Microservice**

This microservice automatically **processes uploaded videos**, **transcodes them into multiple resolutions using FFmpeg**, and **stores the final outputs into a production S3 bucket**.
It is deployed as a **container on AWS ECS** and triggered via **AWS SQS** events.

---

## **🚀 Tech Stack**

### **Backend**

* **Node.js**
* **Express (optional)**
* **AWS SDK**
* **FFmpeg (via Docker image: `jrottenberg/ffmpeg` or custom)**

### **AWS Services**

* **Amazon S3**

  * temp bucket → raw uploads
  * production bucket → transcoded outputs
* **Amazon SQS**

  * triggers transcoder jobs
* **Amazon ECS (Fargate or EC2)**
* **Amazon ECR**

  * for container images
* **IAM Roles**

  * S3 read/write
  * SQS receive/delete

Note: For this project used access keys directly but use IAM roles instead for security.

---

## **🧱 Architecture Overview**

<img width="842" height="450" alt="image" src="https://github.com/user-attachments/assets/39fba6ce-2613-4f73-b244-d18f46043821" />

---



# ✅ **1. Run Locally**

### Install dependencies

```bash
npm install
cd container
npm install
```

### Add `.env` in **both** `/` and `/container`

```
PRODUCTION_BUCKET_NAME=my-temp
ACCESS_KEY=your_key
ACCESS_KEY_SECRET=your_secret
```

### **Filesystem**

ECS uses **ephemeral storage**, so you should have `videos/` and `transcoded/` directories live *inside the container only* and are cleaned every task restart.

---

# 🐳 **3. Build & Push Docker (ECR)**

```bash
cd container
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin <ID>.dkr.ecr.ap-south-1.amazonaws.com
docker build -t video-transcoder .
docker tag video-transcoder:latest <ID>.dkr.ecr.ap-south-1.amazonaws.com/video-transcoder:latest
docker push <ID>.dkr.ecr.ap-south-1.amazonaws.com/video-transcoder:latest
```

**Directly use *view push commands* from ECR image.

---

# 🚀 **4. Deploy to ECS (Fargate or EC2)**

Make task definition, add your own subnets, security groups in worker code.

### Start worker/project

```bash
npm run dev
```

---

# 🧪 **2. Test Full Flow**

### **Step 1 — Upload video to S3**

Upload:

```
input/test.mp4
```

S3 → SQS event must be configured for PUT.

---

### **Step 2 — Check SQS**

Go to SQS → “Send & receive messages” → You should see:

```json
{"bucket":"my-temp","key":"input/test.mp4"}
```

---

### **Step 3 — Worker runs task**
---

Worker keeps polling SQS for any message and then runs the container and processes video using ffmpeg with resolutions 360p, 480p and 720p and uploads to prod_bucket of S3.


### Test again:

1. Upload new file → S3
2. Check SQS message
3. ECS logs should show job → output uploaded




## **📌 Notes / Limitations**

* ECS ephemeral storage defaults to **20GB** (configurable)
* If videos exceed storage:

  * Increase task storage to **50GB / 100GB**
  * Use chunked processing (future enhancement)
* FFmpeg is CPU-heavy → keep ECS tasks as **1 task per core**




# **🎞️ Video Transcoding Microservice**

This microservice automatically **processes uploaded videos**, **transcodes them into multiple resolutions using FFmpeg**, and **stores the final outputs into a production S3 bucket**.
It is deployed as a **container on AWS ECS** and triggered via **AWS SQS** events.

---

## **🚀 Tech Stack**

### **Backend**

* **Node.js**
* **Express (optional)**
* **AWS SDK**
* **FFmpeg (via Docker image)**

### **Pre-requisites**

* **Node.js** (22.x or higher)
* **Docker** (28.x or higher)
* **AWS CLI** (1.x or higher)

### **AWS Services**

* **Amazon S3**

  * temp-bucket/videos → raw uploads
  * production-bucket → transcoded outputs

* **Amazon SQS**
  * triggers transcoder jobs

* **Amazon ECS (Fargate or EC2)**
* **Amazon ECR**

  * for running docker container

* **IAM Roles**

  * S3 read/write
  * SQS receive/delete

Note: For this project used IAM access keys directly but use with IAM roles instead for security.

---

## **🧱 Architecture Overview**

When a user uploads a video, in a temporary Amazon S3 bucket it triggers the backend to send a message to an Amazon SQS queue containing the video’s S3 key and metadata. 

The main/worker code polls the queue for any message every 20 seconds. 

Upon receiving a message, it runs an ECS task which has a Node.js application inside a Docker container (with FFmpeg installed).


The container/task downloads the raw video from the temp S3 bucket, transcodes it into multiple resolutions (Here, 360p, 480p, 720p) using FFmpeg, and uploads the processed videos to a production S3 bucket under a unique video ID. 


<img width="842" height="450" alt="image" src="https://github.com/user-attachments/assets/39fba6ce-2613-4f73-b244-d18f46043821" />

---



# ✅ **1. Run Locally**

### Install dependencies

```bash
npm install
cd container
npm install
```

### Add `.env` in root directory

```
ACCESS_KEY=your_key
ACCESS_KEY_SECRET=your_secret
```

# **Steps**

#### 1. Go to amazon ECS console and create a IAM user. Generate Access key and add in project. Configure it with aws-cli.

```bash
aws configure
```

#### 2. Create two buckets in S3. One for temp uploads (add a folder /videos) and one for production outputs.

* Create an event notification for the temp bucket to trigger the SQS service.

* Allow all objects creations.

* Change production bucket name in container code.

#### 3. Create a SQS Service. Disable encryption(add later). Add Permissions allowing to recieve events from S3.

* Add this policy with your ARNs(copy from services).

```bash 
{
      "Sid": "allowS3BucketToSendMessage",
      "Effect": "Allow",
      "Principal": {
        "Service": "s3.amazonaws.com"
      },
      "Action": "SQS:SendMessage",
      "Resource": "arn:aws:sqs:ap-south-1:471112546627:TempRawVideoSQS",
      "Condition": {
        "ArnLike": {
          "aws:SourceArn": "arn:aws:s3:::temp-raw-videos-rishika"
        }
      }
    }
  ```

* Copy your ARN to main code.


#### 🐳 4. Build Image & Push Docker (ECR)

* Go to Elastic Container Registery (ECR) in AWS. Create a repository (video-transcoder). 

* View push commands and go to container and push the container in registry.

* Create and Elastic Container Service (ECS) cluster (dev) and task definition (transcoder-task).

* Task definition must have :latest image URL.

* Copy respective ARNs of cluster and task to code. Also go to cluster -> Run task -> Copy subnets and security groups and paste in main code.



#### 5. Start worker/project

```bash
npm run dev
```

---

# 🧪 Test Full Flow

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


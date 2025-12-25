import type { S3Event } from 'aws-lambda';
import { DeleteMessageCommand, ReceiveMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import dotenv from "dotenv";
import { ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs';
dotenv.config();

//connect to your  sqs client aws
const client = new SQSClient({
    region: "us-east-1",
    credentials: {
        accessKeyId: process.env.ACCESS_KEY!,
        secretAccessKey: process.env.ACCESS_KEY_SECRET!
    }
});

const ecsClient = new ECSClient({
    region: "us-east-1",
    credentials: {
        accessKeyId: process.env.ACCESS_KEY!,
        secretAccessKey: process.env.ACCESS_KEY_SECRET!
    }
})


async function init() {
    //your sqs url
    //wait 20 sec after one message and then check queue
    const command = new ReceiveMessageCommand({
        QueueUrl: "https://sqs.us-east-1.amazonaws.com/471112546627/TempRawVideoSQS",
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 20,
    })

    //retreive messages from queue
    try {
        while (true) {
            const { Messages } = await client.send(command);
            if (!Messages) {
                console.log("no message in queue");
                continue;
            }

            for (const message of Messages) {
                const { MessageId, Body } = message;
                console.log('message recieved', { MessageId, Body })

                //Validate and parse the event
                if (!Body) continue;
                //check if a sqs has an s3 event retry if failed like queue mechanism works
                const event = JSON.parse(Body) as S3Event;

                //dont use test event
                if ("Service" in event && "Event" in event) {
                    if (event.Event === "s3:TestEvent") {
                        await client.send(new DeleteMessageCommand({
                            QueueUrl: "https://sqs.us-east-1.amazonaws.com/471112546627/TempRawVideoSQS",
                            ReceiptHandle: message.ReceiptHandle,
                        }))
                        continue;
                    }
                }

                //every queue record have the s3 bucket thru which it is triggered
                for (const record of event.Records) {
                    const { s3 } = record;
                    const { bucket, object: { key } } = s3;
                    const decodedKey = decodeURIComponent(key.replace(/\+/g, " "));

                    // Spin the docker container from the temp s3 bucket
                    const runTaskCmd = new RunTaskCommand({
                        taskDefinition: "arn:aws:ecs:us-east-1:471112546627:task-definition/transcoder-task",
                        cluster: "arn:aws:ecs:us-east-1:471112546627:cluster/dev",
                        launchType: "FARGATE",
                        networkConfiguration: {
                            awsvpcConfiguration: {
                                assignPublicIp: "ENABLED",
                                securityGroups: ["sg-02f3bcf249107bc7b"],
                                subnets: [
                                    "subnet-048917ed4b29cacf3",
                                    "subnet-0e3876698af79dea0",
                                    "subnet-0c9f495b29954cd5c"
                                ]
                            }
                        },
                        overrides: {
                            containerOverrides: [{
                                name: "video-transcoder",
                                environment: [
                                    { name: "BUCKET_NAME", value: bucket.name },
                                    { name: "KEY", value: decodedKey },
                                    {name: "ACCESS_KEY", value: process.env.ACCESS_KEY},
                                    {name: "ACCESS_KEY_SECRET", value: process.env.ACCESS_KEY_SECRET},
                                ]
                            }]
                        }
                    });

                    await ecsClient.send(runTaskCmd);
                    //Delete the message from queue
                    await client.send(new DeleteMessageCommand({
                        QueueUrl: "https://sqs.us-east-1.amazonaws.com/471112546627/TempRawVideoSQS",
                        ReceiptHandle: message.ReceiptHandle,
                    }))
                }
            }
        }
    }
    catch (error) {
        console.log(error);
    }
}

init();

export default client;

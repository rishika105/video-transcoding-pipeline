import type { S3Event } from 'aws-lambda';
import { ReceiveMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import dotenv from "dotenv";
dotenv.config();

//connect to your  sqs client aws
const client = new SQSClient({
    region: "us-east-1",  
    credentials: {
        accessKeyId: process.env.ACCESS_KEY!,
        secretAccessKey: process.env.ACCESS_KEY_SECRET!
    }
});


async function init() {
    //your sqs url
    //wait 20 sec after one message and then check queue
    const command = new ReceiveMessageCommand({
        QueueUrl: "https://sqs.us-east-1.amazonaws.com/471112546627/TempRawVideoSQS",
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 20,
    })
    
    //retreive messages from queue
    try{
    while(true){
        const {Messages} = await client.send(command);
        if(!Messages){
            console.log("no message in queue");
            continue;
        }

        for(const message of Messages){   
            const {MessageId, Body} = message;
            console.log('message recieved', {MessageId, Body})

        //Validate and parse the event
        if(!Body) continue;
        //check if a sqs has an s3 event retry if failed like queue mechanism works
        const event = JSON.parse(Body) as S3Event;
       
        //dont use test event
        if("Service" in event && "Event" in event){
            if(event.Event === "s3:TestEvent") continue;
        }

        //every queue record have the s3 bucket thru which it is triggered
        for(const record of event.Records){
            const {s3} = record;
            const {bucket, object:{key}, } = s3;


            // Spin the docker container from the temp s3 bucket
            




        }

        //Delete the message from queue
        }

  
    } 
    }
    catch(error){
        console.log(error);
    }
}

init();

export default client;

import { Storage } from "@google-cloud/storage";
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg'

const storage = new Storage()

const rawBucketName = "colony-raw-vids"
const processedBucketName = "colony-processed-vids"

const localRawPath = "./raw-vids"
const localProcessedPath = "./processed-vids"

export function setUpDirectory() {
    confirmDirExists(localRawPath)
    confirmDirExists(localProcessedPath)
}

export function convertVideo(rawVideoTitle: string, processedVideoTitle: string) {
    return new Promise<void>((resolve, reject) => {
        ffmpeg(`${localRawPath}/${rawVideoTitle}`)
        .outputOptions('-vf', 'scale=-1:360') // 360p
        .on('end', function() {
            console.log('Processing finished successfully');
            resolve()
        })
        .on('error', function(err: any) {
            console.log('An error occurred: ' + err.message);
            reject(err)
        })
        .save(`${localProcessedPath}/${processedVideoTitle}`); 
    })
    
}

export async function downloadRawVideo(fileName: string) {

    await storage.bucket(rawBucketName)
        .file(fileName)
        .download({destination: `${localRawPath}/${fileName}`})

    console.log(
        `gs://${rawBucketName}/${fileName} downloaded to ${localRawPath}/${fileName}`
    )
}

export async function uploadProcessedVideo(fileName: string) {
    const bucket = storage.bucket(processedBucketName)

    bucket.upload(`${localProcessedPath}/${fileName}`, {
        destination: fileName
    })

    console.log(
        `gs://${localProcessedPath}/${fileName} uploaded to ${processedBucketName}/${fileName}`
    )

    await bucket.file(fileName).makePublic();
}

export function deleteRawvideo(fileName: string) {
    return deleteFile(`${localRawPath}/${fileName}`)
}

export function deleteProcessedVideo(fileName: string) {
    return deleteFile(`${localProcessedPath}/${fileName}`)
}

function deleteFile(filePath: string): Promise<void> {
    return new Promise((resolve,reject) => {
        if (fs.existsSync(filePath)) {
            fs.unlink(filePath, (err) => {
                if (err) {
                    console.log(`Failed to delete file at ${filePath}`, err)
                    reject(err)
                } else {
                    console.log(`File deleted at ${filePath}`)
                    resolve()
                }
            })
        } else {
            console.log(`File not found at ${filePath}, skipping...`)
            reject()
        }
    })
}

function confirmDirExists(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, {recursive: true})
        console.log(`Directory created at ${dirPath}`)
    }
}
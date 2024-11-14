import express from 'express';
import { convertVideo, deleteProcessedVideo, deleteRawvideo, downloadRawVideo, setUpDirectory, uploadProcessedVideo } from './storage';

setUpDirectory();

const app = express();
app.use(express.json());

app.post('/process-video', async (req, res) => {

  let data
  try {
    const msg = Buffer.from(req.body.message.data, 'base64').toString('utf8')
    data = JSON.parse(msg)
    if (!data.name) {
      throw new Error('Invalid message payload recieved')
    }
  } catch (error) {
    console.error(error)
    res.status(400).send('Bad Request: Missing Filename')
    return
  }

  const inputFileName = data.name
  const outputFileName = `processed-${inputFileName}`

  await downloadRawVideo(inputFileName)

  try {
    convertVideo(inputFileName, outputFileName)
  } catch (err) {
    await Promise.all([
      deleteRawvideo(inputFileName),
      deleteProcessedVideo(outputFileName)
    ])
    console.log(err)
    res.status(500).send('Internal Server Error: video processing failed')
    return
  }

  await uploadProcessedVideo(outputFileName)

  await Promise.all([
    deleteRawvideo(inputFileName),
    deleteProcessedVideo(outputFileName)
  ])

  res.status(200).send('Processing successful!')
  return
  
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

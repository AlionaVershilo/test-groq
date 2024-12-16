import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import multer from 'multer';
import Groq from 'groq-sdk';
import fs from 'fs/promises';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// console.log(process.env.GROQ_API_KEY);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const app = express();

app.use(cors({
  origin: '*'
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const upload = multer({ dest: '/Users/alenavershilo/dev/xbs/groq/uploads/' }); // Files will be saved to the 'uploads' directory

async function getGroqChatCompletion(userInput, сontext) {
  return groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `You are a helpful assistant. Use the following context to answer the user's question:\n\n${сontext}`,
      },
      {
        role: "user",
        content: userInput,
      },
    ],
    model: "llama3-8b-8192",
  });
}

// Endpoint to handle file and data
app.post('/answerByFileContext', upload.single('file'), async (req, res) => {
  // console.log(req);
  const { text } = req.body;
  const file = req.file;

  if (!text) {
    return res.status(400).json({ error: 'Field "question" is required' });
  }

  try {
    // Log the uploaded file for reference
    if (file) {
      // console.log('Uploaded file:', file);
    }

    let fileContent;
    if (file.mimetype === 'application/pdf') {
      const fileBuffer = await fs.readFile(file.path);
      const pdfData = await pdfParse(fileBuffer);
      fileContent = pdfData.text;
    }

    // Call Groq with user input
    const groqResponse = await getGroqChatCompletion(text, fileContent);
    res.json({ 
      message: groqResponse.choices[0]?.message?.content || "",
      fileInfo: file ? { filename: file.originalname, path: file.path } : null,
    });
  } catch (error) {
    console.error('Error processing request:', error.message);
    res.status(500).json({ error: 'Failed to process your request' });
  }
});

// Endpoint to handle link and data
app.post('/answerByLinkContext', async (req, res) => {
  console.log(req);
  const { question, link } = req.body;

  if (!question) {
    return res.status(400).json({ error: 'Field "question" is required' });
  }

  try {
    const response = await axios.get(link);
    const linkContent = response.data;

    const groqResponse = await getGroqChatCompletion(question, linkContent);
    res.json({ 
      message: groqResponse.choices[0]?.message?.content || "",
    });
  } catch (error) {
    console.error('Error processing request:', error.message);
    res.status(500).json({ error: 'Failed to process your request' });
  }
});

const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

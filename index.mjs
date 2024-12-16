import express from 'express';
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

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ dest: process.env.FOLDER_FOR_UPLOADED_FILES || 'uploads/' });

const getGroqChatCompletion = async (userInput, context) => {
  return groq.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: `You are an expert. Provide 2 paragraphs of key information followed by 3-4 concise bullet points. Use the following context to answer the user's question:\n\n${context}`,
      },
      {
        role: 'user',
        content: userInput,
      },
    ],
    model: 'llama3-8b-8192', // model
    temperature: 0.4, // creativity
    max_tokens: 300, // limit of response length
    top_p: 0.6, // variety
  });
};

const trimText = (text, maxLength) => {
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
};

app.post('/answerByFileContext', upload.single('file'), async (req, res) => {
  const { text } = req.body;
  const file = req.file;

  if (!text) {
    return res.status(400).json({ error: 'Field "text" is required' });
  }

  try {
    let fileContent = '';

    if (file && file.mimetype === 'application/pdf') {
      const fileBuffer = await fs.readFile(file.path);
      const pdfData = await pdfParse(fileBuffer);
      fileContent = pdfData.text;
    }

    const shortenedContent = trimText(fileContent, 20000);

    const groqResponse = await getGroqChatCompletion(text, shortenedContent);

    res.json({
      message: groqResponse.choices[0]?.message?.content || '',
      fileInfo: file ? { filename: file.originalname, path: file.path } : null,
    });
  } catch (error) {
    console.error('Error processing file request:', error.message);
    res.status(500).json({ error: 'Failed to process your request' });
  }
});

app.post('/answerByLinkContext', async (req, res) => {
  const { question, link } = req.body;

  if (!question) {
    return res.status(400).json({ error: 'Field "question" is required' });
  }

  try {
    const response = await axios.get(link);
    const linkContent = response.data;
    const shortenedContent = trimText(linkContent, 20000);
    const groqResponse = await getGroqChatCompletion(question, shortenedContent);

    res.json({
      message: groqResponse.choices[0]?.message?.content || '',
    });
  } catch (error) {
    console.error('Error processing link request:', error.message);
    res.status(500).json({ error: 'Failed to process your request' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

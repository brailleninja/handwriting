// server.js
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const fetch = require('node-fetch');
require('dotenv').config();

const upload = multer({ dest: 'uploads/' });
const app = express();

// Allow JSON parsing for other routes if needed
app.use(express.json());

// POST /api/transcribe
app.post('/api/transcribe', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send('No file uploaded.');

    const imagePath = req.file.path;
    const buffer = fs.readFileSync(imagePath);
    const base64 = buffer.toString('base64');

    // OpenAI API request payload
    const payload = {
      model: 'gpt-4o-mini-vision',
      input: [
        {
          role: 'system',
          content: 'You are a strict assistant. When given an image of text, return ONLY the exact transcription of the handwriting as plain text.'
        },
        {
          role: 'user',
          content: 'Transcribe the handwriting in the attached image exactly as shown. Return only the transcription, no extra text or labels.'
        },
        {
          role: 'user',
          content: [{ type: 'image', name: 'photo.jpg', data: base64 }]
        }
      ]
    };

    const openaiResp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!openaiResp.ok) {
      const t = await openaiResp.text();
      throw new Error('OpenAI error: ' + openaiResp.status + ' ' + t);
    }

    const data = await openaiResp.json();

    // Extract transcription
    let transcription = '';
    try {
      if (data.output && data.output.length > 0) {
        const first = data.output[0];
        if (first.content && first.content.length > 0) {

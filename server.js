import express from 'express';
import multer from 'multer';
import fs from 'fs';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const upload = multer({ dest: 'uploads/' });

// Allow JSON parsing
app.use(express.json());

// POST /api/transcribe
app.post('/api/transcribe', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send('No file uploaded.');

    const imagePath = req.file.path;
    const buffer = fs.readFileSync(imagePath);
    const base64 = buffer.toString('base64');

    // OpenAI API payload
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
    if (data.output && data.output.length > 0) {
      data.output.forEach(block => {
        if (block.type === 'output_text' && block.text) transcription += block.text + '\n';
      });
    }

    res.json({ transcription: transcription.trim() });

    // Cleanup uploaded file
    fs.unlinkSync(imagePath);

  } catch (err) {
    console.error(err);
    res.status(500).send('Error processing handwriting.');
  }
});

// Health check
app.get('/', (req, res) => res.send('Handwriting OCR backend is running.'));

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));

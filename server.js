import express from 'express';
import multer from 'multer';
import fs from 'fs';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.json());

// POST /api/transcribe
app.post('/api/transcribe', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send('No file uploaded.');

    const imagePath = req.file.path;
    const buffer = fs.readFileSync(imagePath);
    const base64 = buffer.toString('base64');

    const payload = {
      model: 'gpt-4o-mini-vision',
      input: [
        {
          role: 'system',
          content: 'You are a strict assistant. Return ONLY the exact transcription of handwriting as plain text.'
        },
        {
          role: 'user',
          content: 'Transcribe the handwriting in this image exactly as shown. Return only the transcription, no extra text.'
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

    let transcription = '';
    if (data.output && data.output.length > 0) {
      const first = data.output[0];
      if (first.content && first.content.length > 0) {
        const textObj = first.content.find(c => c.type === 'output_text' || c.type === 'text');
        transcription = textObj?.text || '';
      }
    }

    res.send(transcription || 'No text detected.');

  } catch (err) {
    console.error(err);
    res.status(500).send('Server error: ' + err.message);
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));

const express = require('express')
const multer = require('multer')
const fs = require('fs')
const fetch = require('node-fetch')
require('dotenv').config()

const upload = multer({ dest: 'uploads/' })
const app = express()

// Basic health check
app.get('/', (req, res) => {
  res.send('Transcription server running (Render.com)')
})

// Main endpoint to receive an image and forward to OpenAI
app.post('/api/transcribe', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send('No file uploaded')

    // Read uploaded file
    const imagePath = req.file.path
    const base64 = fs.readFileSync(imagePath).toString('base64')

    // Payload for OpenAI
    const payload = {
      model: 'gpt-4o-mini-vision',
      input: [
        {
          role: 'system',
          content:
            'You are a strict assistant. When given an image of handwritten text, return ONLY the exact transcription of the handwriting as plain text. No extra commentary.'
        },
        {
          role: 'user',
          content: 'Transcribe the handwriting in the attached image exactly. Return only the transcription.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'image',
              name: 'photo.jpg',
              data: base64
            }
          ]
        }
      ]
    }

    // Call OpenAI
    const openaiResp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(payload)
    })

    if (!openaiResp.ok) {
      const text = await openaiResp.text()
      throw new Error('OpenAI error: ' + text)
    }

    const data = await openaiResp.json()

    let transcription = ''

    // Extract transcription
    try {
      if (data.output && data.output[0] && data.output[0].content) {
        const chunk = data.output[0].content.find(
          c => c.type === 'output_text' || c.type === 'text'

import React, { useRef, useState } from 'react'

export default function HandwritingTranscribeApp() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [streaming, setStreaming] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Start camera
  async function startCamera() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setStreaming(true)
      }
    } catch (err) {
      setError('Camera access denied or not available: ' + err.message)
    }
  }

  // Stop camera
  function stopCamera() {
    setStreaming(false)
    const stream = videoRef.current?.srcObject
    if (stream) {
      stream.getTracks().forEach(t => t.stop())
      videoRef.current.srcObject = null
    }
  }

  // Take picture from video to canvas and create blob
  async function takePicture() {
    setError(null)
    if (!streaming) {
      setError('Camera not started')
      return
    }
    const video = videoRef.current
    const canvas = canvasRef.current
    const w = video.videoWidth
    const h = video.videoHeight
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, w, h)
    return new Promise((resolve) => {
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob)
        setPreviewUrl(url)
        resolve(blob)
      }, 'image/jpeg', 0.95)
    })
  }

  // Fallback: pick file from disk
  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPreviewUrl(URL.createObjectURL(file))
    await sendImageToServer(file)
  }

  // Upload to backend which forwards to ChatGPT/OpenAI
  async function sendImageToServer(imageBlob) {
    setLoading(true)
    setResult('')
    setError(null)
    try {
      const form = new FormData()
      // If imageBlob is a File, use it directly; otherwise convert blob -> File
      const file = imageBlob instanceof File ? imageBlob : new File([imageBlob], 'photo.jpg', { type: 'image/jpeg' })
      form.append('photo', file)

      const resp = await fetch('/api/transcribe', {
        method: 'POST',
        body: form
      })

      if (!resp.ok) {
        const text = await resp.text()
        throw new Error('Server error: ' + resp.status + ' ' + text)
      }

      // server returns only the transcription as plain text (per requirement)
      const transcription = await resp.text()
      setResult(transcription)
    } catch (err) {
      setError('Upload/transcription failed: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Take picture and send
  async function handleCaptureAndSend() {
    const blob = await takePicture()
    if (blob) await sendImageToServer(blob)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-4">Handwriting Transcribe</h1>

        <div className="mb-4">
          {!streaming ? (
            <button onClick={startCamera} className="px-4 py-2 rounded-lg shadow-sm hover:opacity-90">
              Start Camera
            </button>
          ) : (
            <button onClick={stopCamera} className="px-4 py-2 rounded-lg shadow-sm hover:opacity-90">
              Stop Camera
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <video ref={videoRef} className="w-full rounded-lg border" autoPlay muted playsInline style={{ display: streaming ? 'block' : 'none' }} />
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            <div className="flex gap-2">
              <button onClick={handleCaptureAndSend} disabled={!streaming || loading} className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50">
                {loading ? 'Processing…' : 'Take Picture & Transcribe'}
              </button>

              <label className="px-3 py-2 rounded border cursor-pointer">
                <input type="file" accept="image/*
  ==========================
  Render.com Backend Version
  ==========================

  Use this file as server.js when deploying to Render.com.

  Steps:
  1. Create a new Render "Web Service"
  2. Connect your GitHub repo containing this file
  3. Set the Build Command:   npm install
  4. Set the Start Command:   node server.js
  5. Add environment variable OPENAI_API_KEY in Render dashboard
  6. Render automatically provides HTTPS

  Required packages:
    npm install express multer node-fetch dotenv

  Place this server.js at the root of your repo.

  ==========================
  server.js (Render-compatible)
  ==========================

  const express = require('express')
  const multer = require('multer')
  const fs = require('fs')
  const fetch = require('node-fetch')
  require('dotenv').config()

  const upload = multer({ dest: 'uploads/' })
  const app = express()

  // Health check
  app.get('/', (req, res) => {
    res.send('Transcription server running (Render.com)')
  })

  // Transcription endpoint
  app.post('/api/transcribe', upload.single('photo'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).send('No file uploaded')

      const imagePath = req.file.path
      const base64 = fs.readFileSync(imagePath).toString('base64')

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

      try {
        if (data.output && data.output[0] && data.output[0].content) {
          const chunk = data.output[0].content.find(c => c.type === 'output_text' || c.type === 'text')
          if (chunk) transcription = chunk.text || chunk.content || ''
        }
      } catch (e) {}

      // Fallbacks
      if (!transcription && data.output_text) transcription = data.output_text
      if (!transcription && data.choices?.[0]?.message?.content)
        transcription = data.choices[0].message.content

      fs.unlinkSync(imagePath)

      res.setHeader('Content-Type', 'text/plain')
      res.send((transcription || '').trim())
    } catch (err) {
      console.error(err)
      res.status(500).send('Server error: ' + err.message)
    }
  })

  const PORT = process.env.PORT || 3000
  app.listen(PORT, () => console.log('Render backend running on port', PORT))

*/

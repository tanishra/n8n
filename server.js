// server.js
const express = require('express');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const YOUR_EURON_API_KEY = process.env.EURON_API_KEY;

// --- Multer Setup for File Uploads ---
const upload = multer({ dest: 'uploads/' });

// --- Chat Completion Route ---
app.post('/v1/chat/completions', async (req, res) => {
  const { model, messages, max_tokens, temperature } = req.body;

  const euronMessages = messages.map(m => {
    if (m.role === 'assistant' && typeof m.content === 'string') {
      return {
        role: m.role,
        content: [
          {
            type: 'text',
            text: m.content,
          },
        ],
      };
    }
    return m;
  });

  const euronPayload = {
    model,
    messages: euronMessages,
    max_tokens,
    temperature,
  };

  try {
    const response = await axios.post(
      'https://api.euron.one/api/v1/euri/chat/completions',
      euronPayload,
      {
        headers: {
          Authorization: `Bearer ${YOUR_EURON_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const euronReply = response.data;

    const rawContent = euronReply.choices?.[0]?.message?.content;
    const extractedContent = Array.isArray(rawContent)
      ? rawContent.map(item => item.text).join('\n\n')
      : (typeof rawContent === 'string' ? rawContent : '');

    const openAIFormattedResponse = {
      id: 'chatcmpl-fakeid',
      object: 'chat.completion',
      created: Date.now(),
      model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: extractedContent,
          },
          finish_reason: 'stop',
        },
      ],
      usage: euronReply.usage ?? {},
    };

    res.json(openAIFormattedResponse);
  } catch (err) {
    console.error('[Proxy Error]', err.response?.data || err.message);
    res.status(500).json({
      error: 'Failed to connect to Euron API',
      detail: err.response?.data || err.message,
    });
  }
});

// --- Audio Transcription Route ---
app.post('/v1/audio/transcriptions', upload.single('file'), async (req, res) => {
  const { model, language, prompt, response_format, temperature } = req.body;
  const audioFile = req.file;

  if (!audioFile || !model) {
    return res.status(400).json({ error: 'Missing required fields: file and model' });
  }

  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFile.path));
    formData.append('model', model);

    if (language) formData.append('language', language);
    if (prompt) formData.append('prompt', prompt);
    if (response_format) formData.append('response_format', response_format);
    if (temperature) formData.append('temperature', temperature);

    const response = await axios.post(
      'https://api.euron.one/api/v1/euri/audio/transcriptions',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${YOUR_EURON_API_KEY}`, 
        },
      }
    );

    res.json(response.data);
  } catch (err) {
    console.error('[Transcription Error]', err.response?.data || err.message);
    res.status(500).json({
      error: 'Failed to process transcription',
      detail: err.response?.data || err.message,
    });
  } finally {
    // Cleanup uploaded file
    if (audioFile?.path) {
      fs.unlink(audioFile.path, () => {});
    }
  }
});

// --- Health Check ---
app.get('/', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Start Server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Euron Proxy running on port ${PORT}`);
});

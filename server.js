// server.js
const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const YOUR_EURON_API_KEY = process.env.EURON_API_KEY;

app.post('/v1/chat/completions', async (req, res) => {
  const { model, messages, max_tokens, temperature } = req.body;

  // Convert assistant messages to Euron's structured format
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

    // Extract and flatten content from Euron's structured format
    const rawContent = euronReply.choices?.[0]?.message?.content;
    const extractedContent = Array.isArray(rawContent)
      ? rawContent.map(item => item.text).join('\n\n')
      : (typeof rawContent === 'string' ? rawContent : '');

    // Format response to match OpenAI's expected shape
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Euron Proxy running on port ${PORT}`);
});

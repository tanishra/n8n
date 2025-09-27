// server.js
const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const YOUR_EURON_API_KEY = process.env.EURON_API_KEY;

app.post('/v1/chat/completions', async (req, res) => {
  const { model, messages, max_tokens, temperature } = req.body;

  const euronPayload = {
    model,
    messages: messages.map(m => {
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
    }),
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
            content: euronReply.choices?.[0]?.message?.content?.[0]?.text ?? '',
          },
          finish_reason: 'stop',
        },
      ],
      usage: euronReply.usage ?? {},
    };

    res.json(openAIFormattedResponse);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to connect to Euron API' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));

/**
 * AI 助手接口：代理到可配置的 OpenAI 兼容 API（OpenAI、DeepSeek 等）
 */
const express = require('express');
const axios = require('axios');
const { loginRequired } = require('../auth');

const router = express.Router();

const AI_API_URL = (process.env.AI_API_URL || '').trim();
const AI_API_KEY = (process.env.AI_API_KEY || '').trim();
const AI_MODEL = (process.env.AI_MODEL || 'gpt-4o-mini').trim();

function isAiEnabled() {
  return !!AI_API_URL && !!AI_API_KEY;
}

/** 获取 AI 是否可用（不暴露密钥） */
router.get('/api/ai/config', loginRequired, (req, res) => {
  res.json({ enabled: isAiEnabled() });
});

/** 发送对话到配置的 AI 接口 */
router.post('/api/ai/chat', loginRequired, async (req, res) => {
  if (!isAiEnabled()) {
    return res.json({ success: false, message: 'AI 助手未配置，请在后台设置 AI_API_URL 与 AI_API_KEY' });
  }

  const { messages = [], context } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ success: false, message: '请提供 messages 数组' });
  }

  const apiMessages = [...messages];
  if (context && typeof context === 'string') {
    apiMessages.unshift({
      role: 'system',
      content: `以下是用户当前的持仓/基金相关上下文，可在回答时参考，但不要泄露敏感信息。\n\n${context}`,
    });
  }

  try {
    const chatUrl = AI_API_URL.replace(/\/$/, '') + '/v1/chat/completions';
    const response = await axios.post(
      chatUrl,
      {
        model: AI_MODEL,
        messages: apiMessages,
        max_tokens: 2048,
        temperature: 0.7,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${AI_API_KEY}`,
        },
        timeout: 60000,
        validateStatus: () => true,
      }
    );

    if (response.status !== 200) {
      const errBody = response.data;
      const msg = errBody?.error?.message || errBody?.message || response.statusText;
      return res.status(response.status).json({
        success: false,
        message: msg || 'AI 接口请求失败',
      });
    }

    const choice = response.data?.choices?.[0];
    const content = choice?.message?.content ?? '';
    return res.json({ success: true, reply: content });
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message || '网络或服务异常';
    return res.status(500).json({ success: false, message: String(msg) });
  }
});

module.exports = router;

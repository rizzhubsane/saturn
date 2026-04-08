import axios from 'axios';
import { OPENROUTER_API_KEY, OPENROUTER_MODEL } from '../config/env.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

/**
 * Send a text completion request to Gemini 2.5 Flash via OpenRouter.
 */
export async function complete(
  systemPrompt: string,
  userPrompt: string,
  options: LLMOptions = {}
): Promise<string> {
  const response = await axios.post(
    OPENROUTER_URL,
    {
      model: options.model || OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 1024,
    },
    {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://eventx.iitd.dev',
        'X-Title': 'EventX IITD',
      },
      timeout: 30000,
    }
  );

  return response.data.choices[0].message.content;
}

/**
 * Send a completion request and parse the response as JSON.
 * Handles markdown code blocks and retries on parse failure.
 */
export async function completeJSON<T = any>(
  systemPrompt: string,
  userPrompt: string,
  options: LLMOptions = {}
): Promise<T> {
  const raw = await complete(systemPrompt, userPrompt, options);

  // Strip markdown code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    console.error('❌ Failed to parse LLM JSON response:', cleaned.substring(0, 200));
    throw new Error(`LLM returned invalid JSON: ${(e as Error).message}`);
  }
}

/**
 * Send a multimodal completion request (text + image).
 * Used for OCR on poster images.
 */
export async function completeWithImage(
  systemPrompt: string,
  userPrompt: string,
  imageBase64: string,
  mimeType: string = 'image/jpeg',
  options: LLMOptions = {}
): Promise<string> {
  const response = await axios.post(
    OPENROUTER_URL,
    {
      model: options.model || OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 2048,
    },
    {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://eventx.iitd.dev',
        'X-Title': 'EventX IITD',
      },
      timeout: 60000, // Longer timeout for image processing
    }
  );

  return response.data.choices[0].message.content;
}

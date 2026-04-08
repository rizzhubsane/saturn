import { completeWithImage } from './llm.js';

const OCR_SYSTEM_PROMPT = `Extract all readable text from this event poster image. The poster is for a college campus event at IIT Delhi. Focus on: event title, date, time, venue, speaker names, registration links, QR code context, sponsor names. Return raw extracted text, preserve layout loosely. Do not interpret or summarize — just extract text.`;

/**
 * Extract text from a poster image using Gemini's vision capabilities.
 */
export async function extractTextFromImage(
  imageBase64: string,
  mimeType: string = 'image/jpeg'
): Promise<string> {
  try {
    const result = await completeWithImage(
      OCR_SYSTEM_PROMPT,
      'Extract all text from this event poster image.',
      imageBase64,
      mimeType,
      { temperature: 0.1 }
    );

    return result.trim();
  } catch (error: any) {
    console.error('❌ OCR failed:', error.message);
    return ''; // Return empty string if OCR fails — event can still be parsed from text
  }
}

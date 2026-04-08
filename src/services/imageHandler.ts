import sharp from 'sharp';
import { supabase } from '../db/supabase.js';
import { getMediaUrl, downloadMedia } from './whatsapp.js';

/**
 * Full image handling pipeline:
 * 1. Get download URL from WhatsApp Media API
 * 2. Download the binary image
 * 3. Compress/resize with Sharp
 * 4. Upload to Supabase Storage
 * 5. Return public URL + base64 for OCR
 */
export async function processEventImage(
  mediaId: string,
  clubSlug: string,
  eventId: string
): Promise<{ publicUrl: string; base64: string; mimeType: string }> {
  // Step 1 & 2: Get URL and download
  const mediaUrl = await getMediaUrl(mediaId);
  const rawBuffer = await downloadMedia(mediaUrl);

  // Step 3: Compress with Sharp
  const compressed = await sharp(rawBuffer)
    .resize(1200, null, { withoutEnlargement: true }) // max 1200px width
    .jpeg({ quality: 80 })
    .toBuffer();

  // Step 4: Upload to Supabase Storage
  const path = `posters/${clubSlug}/${eventId}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from('posters')
    .upload(path, compressed, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Failed to upload poster: ${uploadError.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage.from('posters').getPublicUrl(path);
  const publicUrl = urlData.publicUrl;

  // Return both public URL and base64 for OCR
  const base64 = compressed.toString('base64');

  return { publicUrl, base64, mimeType: 'image/jpeg' };
}

/**
 * Process an image for OCR only (no upload).
 * Used when we just need to read the poster text.
 */
export async function getImageBase64(mediaId: string): Promise<{ base64: string; mimeType: string }> {
  const mediaUrl = await getMediaUrl(mediaId);
  const rawBuffer = await downloadMedia(mediaUrl);

  // Light compression for OCR
  const compressed = await sharp(rawBuffer)
    .resize(1500, null, { withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  return {
    base64: compressed.toString('base64'),
    mimeType: 'image/jpeg',
  };
}

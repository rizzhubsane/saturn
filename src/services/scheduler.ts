import cron from 'node-cron';
import { expirePastEvents, cleanupExpiredStates } from '../db/supabase.js';

/**
 * Initialize background jobs. WhatsApp is reply-only: no cron-driven digests, reminder pings,
 * or subscriber blasts. Only DB maintenance runs here.
 */
export function initScheduler(): void {
  console.log('⏰ Initializing scheduler (reply-only mode — no scheduled WhatsApp sends)...');

  // Event expiry — midnight IST
  cron.schedule('0 0 * * *', async () => {
    console.log('🗑️ Running event expiry...');
    const count = await expirePastEvents();
    if (count > 0) console.log(`  Expired ${count} events.`);
  }, { timezone: 'Asia/Kolkata' });

  // Conversation state cleanup — every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    await cleanupExpiredStates();
  }, { timezone: 'Asia/Kolkata' });

  console.log('✅ Scheduler initialized (2 cron job(s): expiry + state cleanup)');
}

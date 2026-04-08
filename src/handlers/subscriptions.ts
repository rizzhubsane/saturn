import type { User } from '../types/index.js';
import { sendText } from '../services/whatsapp.js';
import { addSubscription, removeSubscription, getUserSubscriptions } from '../db/supabase.js';
import categoriesConfig from '../config/categories.json' with { type: "json" };

const validCategories = new Set(categoriesConfig.categories.map(c => c.slug));
const categoryMap = new Map(categoriesConfig.categories.map(c => [c.slug, c]));

/**
 * Handle /subscribe <category>.
 */
export async function handleSubscribe(user: User, category: string): Promise<void> {
  const slug = category.toLowerCase().trim();

  if (!validCategories.has(slug)) {
    const available = categoriesConfig.categories.map(c => `  ${c.emoji} ${c.slug} — ${c.label}`).join('\n');
    await sendText(user.phone, `❌ Unknown category "${category}".\n\nAvailable categories:\n${available}`);
    return;
  }

  try {
    await addSubscription(user.id, slug);
    const cat = categoryMap.get(slug)!;
    await sendText(user.phone,
      `${cat.emoji} Subscribed to *${cat.label}*!\n\n` +
      `You'll get notified when new ${cat.label.toLowerCase()} events are posted.\n\n` +
      `Manage: /mysubs · Unsubscribe: /unsubscribe ${slug}`
    );
  } catch (error: any) {
    console.error('❌ Subscribe error:', error.message);
    await sendText(user.phone, '❌ Couldn\'t subscribe. Please try again.');
  }
}

/**
 * Handle /unsubscribe <category>.
 */
export async function handleUnsubscribe(user: User, category: string): Promise<void> {
  const slug = category.toLowerCase().trim();

  try {
    await removeSubscription(user.id, slug);
    const cat = categoryMap.get(slug);
    await sendText(user.phone, `✅ Unsubscribed from ${cat?.emoji || ''} *${cat?.label || category}*.`);
  } catch (error: any) {
    console.error('❌ Unsubscribe error:', error.message);
    await sendText(user.phone, '❌ Couldn\'t unsubscribe. Please try again.');
  }
}

/**
 * Handle /mysubs — show active subscriptions.
 */
export async function handleMySubscriptions(user: User): Promise<void> {
  try {
    const subs = await getUserSubscriptions(user.id);

    if (subs.length === 0) {
      await sendText(user.phone,
        '📢 No active subscriptions.\n\n' +
        'Subscribe to a category to get notified about new events:\n' +
        '`/subscribe tech`\n' +
        '`/subscribe cultural`\n' +
        '`/subscribe sports`'
      );
      return;
    }

    const lines = ['📢 *Your Subscriptions*\n'];
    for (const slug of subs) {
      const cat = categoryMap.get(slug);
      lines.push(`  ${cat?.emoji || '📌'} ${cat?.label || slug}`);
    }
    lines.push('\nTo unsubscribe: `/unsubscribe <category>`');

    await sendText(user.phone, lines.join('\n'));

  } catch (error: any) {
    console.error('❌ Subscriptions error:', error.message);
    await sendText(user.phone, '❌ Couldn\'t load subscriptions. Please try again.');
  }
}

import express from 'express';
import { PORT, NODE_ENV } from './config/env.js';
import { verifyWebhook } from './webhook/verify.js';
import { handleWebhook } from './webhook/handler.js';
import { validateSignature } from './webhook/signature.js';
import { initScheduler } from './services/scheduler.js';
import { handleCalendarIcsRoute } from './webhook/calendarIcsRoute.js';

const app = express();

// ── Raw body capture for signature verification (limit size — webhook payloads are small) ──
app.use(express.json({
  limit: '256kb',
  verify: (req: any, _res, buf) => {
    req.rawBody = buf.toString('utf8');
  },
}));

// ── Public ICS for calendar apps (Apple Calendar, etc.) ──
app.get('/calendar/ics/:eventId', (req, res) => {
  void handleCalendarIcsRoute(req, res);
});

// ── Health check ──
app.get('/health', (_req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    service: 'Saturn IITD',
    timestamp: new Date().toISOString(),
    env: NODE_ENV,
  });
});

// ── Webhook routes ──
app.get('/webhook', verifyWebhook);
app.post('/webhook', validateSignature, handleWebhook);

// ── Start server ──
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║   🎯 Saturn — IIT Delhi Events Bot   ║
║   Running on port ${PORT}              ║
║   Environment: ${NODE_ENV}             ║
╚══════════════════════════════════════╝
  `);

  // Initialize scheduled jobs
  initScheduler();
});

export default app;

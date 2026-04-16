import cron from 'node-cron';
import { runFmcsaSync } from './fmcsaSync';
import { runAggregatorSync } from './aggregatorSync';

export function startScheduler(): void {
  // FMCSA carrier data — nightly at 2 AM
  const fmcsaCron = process.env.SYNC_CRON || '0 2 * * *';
  if (process.env.SYNC_ENABLED !== 'false') {
    cron.schedule(fmcsaCron, async () => {
      console.log('[Scheduler] Starting nightly FMCSA sync...');
      try { await runFmcsaSync(); }
      catch (err) { console.error('[Scheduler] FMCSA sync failed:', err); }
    });
    console.log(`[Scheduler] FMCSA sync scheduled: ${fmcsaCron}`);
  }

  // Aggregator — 6 AM and 6 PM daily
  cron.schedule('0 6,18 * * *', async () => {
    console.log('[Scheduler] Starting aggregator sync...');
    try { await runAggregatorSync(); }
    catch (err) { console.error('[Scheduler] Aggregator sync failed:', err); }
  });
  console.log('[Scheduler] Aggregator sync scheduled: 0 6,18 * * *');
}

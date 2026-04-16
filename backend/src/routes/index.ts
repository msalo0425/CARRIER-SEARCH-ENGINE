import { Router } from 'express';
import { requireAuth, requireAdmin, requireNotViewer } from '../middleware/auth';
import * as auth from '../controllers/authController';
import * as carriers from '../controllers/carriersController';
import * as govcon from '../controllers/govconController';
import * as aggregator from '../controllers/aggregatorController';
import { runFmcsaSync } from '../services/fmcsaSync';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { pool } from '../db/pool';

const router = Router();

const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE_MB||'25')*1024*1024 } });

// ─── Auth ─────────────────────────────────────────────────────────────────────
router.post('/auth/login', auth.login);
router.post('/auth/logout', requireAuth, auth.logout);
router.get('/auth/me', requireAuth, auth.getMe);
router.get('/auth/users', requireAuth, requireAdmin, auth.listUsers);
router.post('/auth/users', requireAuth, requireAdmin, auth.createUser);
router.patch('/auth/users/:userId', requireAuth, requireAdmin, auth.updateUser);
router.patch('/auth/users/:userId/toggle', requireAuth, requireAdmin, auth.toggleUser);
router.delete('/auth/users/:userId', requireAuth, requireAdmin, auth.deleteUser);

// ─── Carriers ─────────────────────────────────────────────────────────────────
router.get('/carriers', requireAuth, carriers.searchCarriers);
router.get('/carriers/search', requireAuth, carriers.searchCarriers);
router.get('/carriers/crm', requireAuth, carriers.getCrmCarriers);
router.get('/carriers/states', requireAuth, carriers.getStates);
router.get('/carriers/pipeline', requireAuth, carriers.getPipelineCarriers);
router.get('/carriers/dashboard', requireAuth, carriers.getDashboard);
router.get('/carriers/follow-ups/today', requireAuth, carriers.getTodayFollowUps);
router.get('/carriers/:dotNumber', requireAuth, carriers.getCarrier);
router.put('/carriers/:dotNumber/crm', requireAuth, requireNotViewer, carriers.updateCrm);
router.patch('/carriers/:dotNumber/crm', requireAuth, requireNotViewer, carriers.updateCrm);
router.get('/carriers/:dotNumber/calls', requireAuth, carriers.getCallLogs);
router.post('/carriers/:dotNumber/calls', requireAuth, requireNotViewer, carriers.addCallLog);
router.get('/carriers/:dotNumber/follow-ups', requireAuth, carriers.getFollowUps);
router.post('/carriers/:dotNumber/follow-ups', requireAuth, requireNotViewer, carriers.addFollowUp);
router.patch('/follow-ups/:id/complete', requireAuth, requireNotViewer, carriers.completeFollowUp);

// ─── GovCon Dashboard ─────────────────────────────────────────────────────────
router.get('/govcon/dashboard', requireAuth, govcon.getGovConDashboard);

// Opportunities (with and without /govcon/ prefix)
router.get('/opportunities', requireAuth, govcon.listOpportunities);
router.post('/opportunities', requireAuth, requireNotViewer, govcon.createOpportunity);
router.put('/opportunities/:id', requireAuth, requireNotViewer, govcon.updateOpportunity);
router.delete('/opportunities/:id', requireAuth, requireAdmin, govcon.deleteOpportunity);
router.get('/govcon/opportunities', requireAuth, govcon.listOpportunities);
router.post('/govcon/opportunities', requireAuth, requireNotViewer, govcon.createOpportunity);
router.put('/govcon/opportunities/:id', requireAuth, requireNotViewer, govcon.updateOpportunity);
router.delete('/govcon/opportunities/:id', requireAuth, requireAdmin, govcon.deleteOpportunity);

// Sources Sought
router.get('/sources-sought', requireAuth, govcon.listSourcesSought);
router.post('/sources-sought', requireAuth, requireNotViewer, govcon.createSourcesSought);
router.put('/sources-sought/:id', requireAuth, requireNotViewer, govcon.updateSourcesSought);
router.delete('/sources-sought/:id', requireAuth, requireNotViewer, govcon.deleteSourcesSought);
router.get('/govcon/sources-sought', requireAuth, govcon.listSourcesSought);
router.post('/govcon/sources-sought', requireAuth, requireNotViewer, govcon.createSourcesSought);
router.put('/govcon/sources-sought/:id', requireAuth, requireNotViewer, govcon.updateSourcesSought);
router.delete('/govcon/sources-sought/:id', requireAuth, requireNotViewer, govcon.deleteSourcesSought);

// Proposals
router.get('/proposals/metrics', requireAuth, govcon.getProposalMetrics);
router.get('/proposals', requireAuth, govcon.listProposals);
router.get('/proposals/:id', requireAuth, govcon.getProposal);
router.post('/proposals', requireAuth, requireNotViewer, govcon.createProposal);
router.put('/proposals/:id', requireAuth, requireNotViewer, govcon.updateProposal);
router.patch('/proposals/:id', requireAuth, requireNotViewer, govcon.updateProposal);
router.delete('/proposals/:id', requireAuth, requireNotViewer, govcon.deleteProposal);
router.post('/proposals/:id/sub-quotes', requireAuth, requireNotViewer, govcon.addSubQuote);
router.put('/proposals/:id/sub-quotes/:quoteId', requireAuth, requireNotViewer, govcon.updateSubQuote);
router.delete('/proposals/:id/sub-quotes/:quoteId', requireAuth, requireNotViewer, govcon.deleteSubQuote);
router.get('/govcon/proposals/metrics', requireAuth, govcon.getProposalMetrics);
router.get('/govcon/proposals', requireAuth, govcon.listProposals);
router.get('/govcon/proposals/:id', requireAuth, govcon.getProposal);
router.post('/govcon/proposals', requireAuth, requireNotViewer, govcon.createProposal);
router.put('/govcon/proposals/:id', requireAuth, requireNotViewer, govcon.updateProposal);
router.patch('/govcon/proposals/:id', requireAuth, requireNotViewer, govcon.updateProposal);
router.delete('/govcon/proposals/:id', requireAuth, requireNotViewer, govcon.deleteProposal);
router.post('/govcon/proposals/:id/sub-quotes', requireAuth, requireNotViewer, govcon.addSubQuote);
router.put('/govcon/proposals/:id/sub-quotes/:quoteId', requireAuth, requireNotViewer, govcon.updateSubQuote);
router.delete('/govcon/proposals/:id/sub-quotes/:quoteId', requireAuth, requireNotViewer, govcon.deleteSubQuote);

// Agencies
router.get('/agencies', requireAuth, govcon.listAgencies);
router.get('/agencies/:id', requireAuth, govcon.getAgency);
router.post('/agencies', requireAuth, requireNotViewer, govcon.createAgency);
router.put('/agencies/:id', requireAuth, requireNotViewer, govcon.updateAgency);
router.post('/agencies/:id/interactions', requireAuth, requireNotViewer, govcon.addAgencyInteraction);
router.get('/govcon/agencies', requireAuth, govcon.listAgencies);
router.get('/govcon/agencies/:id', requireAuth, govcon.getAgency);
router.post('/govcon/agencies', requireAuth, requireNotViewer, govcon.createAgency);
router.put('/govcon/agencies/:id', requireAuth, requireNotViewer, govcon.updateAgency);
router.post('/govcon/agencies/:id/interactions', requireAuth, requireNotViewer, govcon.addAgencyInteraction);

// Certifications
router.get('/certifications', requireAuth, govcon.listCertifications);
router.post('/certifications', requireAuth, requireNotViewer, govcon.createCertification);
router.put('/certifications/:id', requireAuth, requireNotViewer, govcon.updateCertification);
router.delete('/certifications/:id', requireAuth, requireAdmin, govcon.deleteCertification);
router.get('/govcon/certifications', requireAuth, govcon.listCertifications);
router.post('/govcon/certifications', requireAuth, requireNotViewer, govcon.createCertification);
router.put('/govcon/certifications/:id', requireAuth, requireNotViewer, govcon.updateCertification);
router.delete('/govcon/certifications/:id', requireAuth, requireAdmin, govcon.deleteCertification);

// Calendar
router.get('/calendar', requireAuth, govcon.getCalendarEvents);
router.post('/calendar', requireAuth, requireNotViewer, govcon.createCalendarEvent);
router.delete('/calendar/:id', requireAuth, requireNotViewer, govcon.deleteCalendarEvent);
router.get('/govcon/calendar', requireAuth, govcon.getCalendarEvents);
router.post('/govcon/calendar', requireAuth, requireNotViewer, govcon.createCalendarEvent);
router.delete('/govcon/calendar/:id', requireAuth, requireNotViewer, govcon.deleteCalendarEvent);

// ─── Aggregator ───────────────────────────────────────────────────────────────
router.get('/aggregator/common-agencies', requireAuth, aggregator.getCommonAgencies);
router.get('/aggregator/dashboard', requireAuth, aggregator.getAggregatorDashboard);
router.get('/aggregator/solicitations', requireAuth, aggregator.listSolicitations);
router.get('/aggregator/solicitations/:id', requireAuth, aggregator.getSolicitation);
router.patch('/aggregator/solicitations/:id/status', requireAuth, requireNotViewer, aggregator.updateSolicitationStatus);
router.post('/aggregator/solicitations/:id/add-to-proposals', requireAuth, requireNotViewer, aggregator.addToProposals);
router.post('/aggregator/sync', requireAuth, requireAdmin, aggregator.triggerSync);
router.get('/aggregator/sync-logs', requireAuth, aggregator.getSyncLogs);
router.get('/aggregator/settings', requireAuth, aggregator.getAggregatorSettings);
router.put('/aggregator/settings', requireAuth, requireAdmin, aggregator.updateAggregatorSettings);
router.get('/aggregator/market-intelligence', requireAuth, aggregator.getMarketIntelligence);

// ─── Documents ────────────────────────────────────────────────────────────────
const docHandler = {
  list: async (_req: any, res: any) => {
    try {
      const q = _req.query.q as string;
      const cat = _req.query.category as string;
      const conds: string[] = []; const params: unknown[] = []; let i = 1;
      if (q) { conds.push(`(d.original_filename ILIKE $${i} OR d.description ILIKE $${i++})`); params.push(`%${q}%`); }
      if (cat) { conds.push(`d.category = $${i++}`); params.push(cat); }
      const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
      const rows = (await pool.query(`SELECT d.*, u.full_name as uploaded_by_name FROM documents d LEFT JOIN users u ON d.uploaded_by=u.id ${where} ORDER BY d.category, d.created_at DESC`, params)).rows;
      res.json(rows);
    } catch { res.status(500).json({ error: 'Server error' }); }
  },
  upload: async (req: any, res: any) => {
    try {
      if (!req.file) { res.status(400).json({ error: 'File required' }); return; }
      const { category, description, version } = req.body;
      const versionNum = version ? Math.max(1, parseInt(String(version)) || 1) : 1;
      const row = (await pool.query(
        `INSERT INTO documents (title,category,description,version,filename,original_filename,file_path,file_size,mime_type,uploaded_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [req.file.originalname,category||'Misc',description||null,versionNum,req.file.filename,req.file.originalname,req.file.path,req.file.size,req.file.mimetype,req.user!.id]
      )).rows[0];
      res.status(201).json(row);
    } catch { res.status(500).json({ error: 'Upload failed' }); }
  },
  download: async (req: any, res: any) => {
    try {
      const row = (await pool.query(`SELECT * FROM documents WHERE id=$1`, [req.params.id])).rows[0];
      if (!row) { res.status(404).json({ error: 'Not found' }); return; }
      res.download(path.resolve(row.file_path), row.original_filename || row.filename);
    } catch { res.status(500).json({ error: 'Download failed' }); }
  },
  del: async (req: any, res: any) => {
    try { await pool.query(`DELETE FROM documents WHERE id=$1`, [req.params.id]); res.json({ message: 'Deleted' }); }
    catch { res.status(500).json({ error: 'Server error' }); }
  },
};

router.get('/documents', requireAuth, docHandler.list);
router.post('/documents', requireAuth, requireNotViewer, upload.single('file'), docHandler.upload);
router.get('/documents/:id/download', requireAuth, docHandler.download);
router.delete('/documents/:id', requireAuth, requireAdmin, docHandler.del);
router.get('/govcon/documents', requireAuth, docHandler.list);
router.post('/govcon/documents', requireAuth, requireNotViewer, upload.single('file'), docHandler.upload);
router.get('/govcon/documents/:id/download', requireAuth, docHandler.download);
router.delete('/govcon/documents/:id', requireAuth, requireAdmin, docHandler.del);

// ─── Settings ─────────────────────────────────────────────────────────────────
router.get('/settings/sync-status', requireAuth, async (_req, res) => {
  try {
    const [lastSync, count] = await Promise.all([
      pool.query(`SELECT * FROM sync_log ORDER BY started_at DESC LIMIT 1`),
      pool.query(`SELECT COUNT(*) count FROM carriers`),
    ]);
    res.json({ last_sync: lastSync.rows[0]||null, carrier_count: parseInt(count.rows[0].count) });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/settings/trigger-fmcsa-sync', requireAuth, requireAdmin, async (_req, res) => {
  res.json({ message: 'FMCSA sync started in background' });
  runFmcsaSync().catch(console.error);
});

// ─── Health ─────────────────────────────────────────────────────────────────
// Returns only liveness status — no business data — intentionally unauthenticated
// so load-balancers and Docker health checks can probe without credentials.
router.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch { res.status(503).json({ status: 'error' }); }
});

export default router;

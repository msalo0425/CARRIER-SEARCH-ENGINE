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

// ─── Tasks ────────────────────────────────────────────────────────────────────
router.get('/tasks', requireAuth, async (req: any, res) => {
  try {
    const rows = (await pool.query(
      `SELECT t.*, u.full_name as created_by_name FROM tasks t LEFT JOIN users u ON t.created_by=u.id ORDER BY t.is_done ASC, t.priority DESC, t.due_date ASC NULLS LAST, t.created_at DESC`
    )).rows;
    res.json(rows);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/tasks', requireAuth, async (req: any, res) => {
  try {
    const { title, notes, due_date, priority } = req.body;
    if (!title?.trim()) { res.status(400).json({ error: 'Title required' }); return; }
    const row = (await pool.query(
      `INSERT INTO tasks (title, notes, due_date, priority, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [title.trim(), notes||null, due_date||null, priority||'normal', req.user?.id||null]
    )).rows[0];
    res.status(201).json(row);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.patch('/tasks/:id/toggle', requireAuth, async (req, res) => {
  try {
    const row = (await pool.query(
      `UPDATE tasks SET is_done=NOT is_done, done_at=CASE WHEN NOT is_done THEN NOW() ELSE NULL END, updated_at=NOW() WHERE id=$1 RETURNING *`,
      [req.params.id]
    )).rows[0];
    if (!row) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(row);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.put('/tasks/:id', requireAuth, async (req, res) => {
  try {
    const { title, notes, due_date, priority } = req.body;
    if (!title?.trim()) { res.status(400).json({ error: 'Title required' }); return; }
    const row = (await pool.query(
      `UPDATE tasks SET title=$1, notes=$2, due_date=$3, priority=$4, updated_at=NOW() WHERE id=$5 RETURNING *`,
      [title.trim(), notes||null, due_date||null, priority||'normal', req.params.id]
    )).rows[0];
    if (!row) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(row);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.delete('/tasks/:id', requireAuth, async (req, res) => {
  try {
    await pool.query(`DELETE FROM tasks WHERE id=$1`, [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// ─── Game Plan ────────────────────────────────────────────────────────────────

function getWeekStart(date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

router.get('/game-plan/goals', requireAuth, async (req: any, res) => {
  try {
    const week = (req.query.week as string) || getWeekStart();
    const rows = (await pool.query(
      `SELECT g.*,
         COUNT(l.id)::int AS completed_count,
         json_agg(json_build_object('id',l.id,'note',l.note,'logged_at',l.logged_at) ORDER BY l.logged_at DESC) FILTER (WHERE l.id IS NOT NULL) AS logs
       FROM game_plan_goals g
       LEFT JOIN goal_log l ON l.goal_id = g.id AND l.week_start = $1
       WHERE g.is_active = TRUE
       GROUP BY g.id
       ORDER BY g.sort_order, g.id`,
      [week]
    )).rows;
    res.json({ goals: rows, week_start: week });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/game-plan/goals', requireAuth, async (req: any, res) => {
  try {
    const { title, category, target_per_week, notes } = req.body;
    if (!title?.trim()) { res.status(400).json({ error: 'Title required' }); return; }
    const maxOrder = (await pool.query(`SELECT COALESCE(MAX(sort_order),0) AS m FROM game_plan_goals`)).rows[0].m;
    const row = (await pool.query(
      `INSERT INTO game_plan_goals (title, category, target_per_week, notes, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [title.trim(), category||null, parseInt(target_per_week)||1, notes||null, maxOrder+1]
    )).rows[0];
    res.status(201).json(row);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.put('/game-plan/goals/:id', requireAuth, async (req, res) => {
  try {
    const { title, category, target_per_week, notes } = req.body;
    const row = (await pool.query(
      `UPDATE game_plan_goals SET title=$1, category=$2, target_per_week=$3, notes=$4 WHERE id=$5 RETURNING *`,
      [title, category||null, parseInt(target_per_week)||1, notes||null, req.params.id]
    )).rows[0];
    if (!row) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(row);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.delete('/game-plan/goals/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await pool.query(`DELETE FROM game_plan_goals WHERE id=$1`, [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/game-plan/goals/:id/log', requireAuth, async (req: any, res) => {
  try {
    const week = req.body.week_start || getWeekStart();
    const row = (await pool.query(
      `INSERT INTO goal_log (goal_id, week_start, note, logged_by) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.id, week, req.body.note||null, req.user?.id||null]
    )).rows[0];
    res.status(201).json(row);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.delete('/game-plan/log/:id', requireAuth, async (req, res) => {
  try {
    await pool.query(`DELETE FROM goal_log WHERE id=$1`, [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch { res.status(500).json({ error: 'Server error' }); }
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

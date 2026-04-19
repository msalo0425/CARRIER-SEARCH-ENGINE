import { Request, Response } from 'express';
import { query, queryOne, pool } from '../db/pool';
import { runAggregatorSync } from '../services/aggregatorSync';

// ─── Aggregated Solicitations ─────────────────────────────────────────────────

const COMMON_AGENCIES = [
  'Department of Defense (DOD)', 'Defense Logistics Agency (DLA)',
  'Department of Homeland Security (DHS)', 'Federal Emergency Management Agency (FEMA)',
  'General Services Administration (GSA)', 'Department of Transportation (DOT)',
  'Department of Veterans Affairs (VA)', 'Department of Health and Human Services (HHS)',
  'Army Corps of Engineers (USACE)', 'Department of the Navy',
  'Department of the Army', 'Department of the Air Force',
  'United States Postal Service (USPS)', 'NASA',
  'Department of Energy (DOE)', 'Department of Justice (DOJ)',
  'Department of State', 'Department of the Interior',
  'Department of Agriculture (USDA)', 'Department of Commerce',
];

export function getCommonAgencies(_req: Request, res: Response): void {
  res.json(COMMON_AGENCIES);
}

export async function listSolicitations(req: Request, res: Response): Promise<void> {
  try {
    const {
      q, agency, naics_code, set_aside_type, source, status,
      posted_after, posted_before, due_after, due_before,
      value_min, value_max, wosb_only,
      sort_by = 'response_due_date', sort_order = 'ASC',
      page = '1', limit = '25',
    } = req.query as Record<string,string>;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum-1)*limitNum;
    const conds: string[] = []; const params: unknown[] = []; let i = 1;

    if (q) {
      conds.push(`(to_tsvector('english',coalesce(title,'')||' '||coalesce(solicitation_number,'')||' '||coalesce(agency_name,'')||' '||coalesce(description,'')) @@ plainto_tsquery('english',$${i++}))`);
      params.push(q);
    }
    if (agency) { conds.push(`agency_name ILIKE $${i++}`); params.push(`%${agency}%`); }
    if (naics_code) { conds.push(`naics_code = $${i++}`); params.push(naics_code); }
    if (set_aside_type) { conds.push(`set_aside_type ILIKE $${i++}`); params.push(`%${set_aside_type}%`); }
    if (source) { conds.push(`source = $${i++}`); params.push(source); }
    if (status) { conds.push(`status = $${i++}`); params.push(status); }
    else {
      conds.push(`status != 'Expired'`);
      conds.push(`(response_due_date IS NULL OR response_due_date >= CURRENT_DATE)`);
    }
    if (posted_after) { conds.push(`posted_date >= $${i++}`); params.push(posted_after); }
    if (posted_before) { conds.push(`posted_date <= $${i++}`); params.push(posted_before); }
    if (due_after) { conds.push(`response_due_date >= $${i++}`); params.push(due_after); }
    if (due_before) { conds.push(`response_due_date <= $${i++}`); params.push(due_before); }
    if (value_min) { conds.push(`(contract_value_max >= $${i++} OR contract_value_min >= $${i-1})`); params.push(parseFloat(value_min)); }
    if (value_max) { conds.push(`(contract_value_min <= $${i++} OR contract_value_max <= $${i-1})`); params.push(parseFloat(value_max)); }
    if (wosb_only === 'true') conds.push(`(is_wosb_eligible = true OR is_edwosb_eligible = true)`);

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const validSort = ['response_due_date','posted_date','contract_value_max','agency_name','first_seen_at'];
    const sf = validSort.includes(sort_by) ? sort_by : 'response_due_date';
    const sd = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const countRow = await queryOne<{total:string}>(`SELECT COUNT(*) total FROM aggregated_solicitations ${where}`, params);
    const rows = await query(
      `SELECT id, source, solicitation_number, title, agency_name, naics_code, set_aside_type,
              posted_date, response_due_date, contract_value_min, contract_value_max,
              poc_name, poc_email, original_url, status, proposal_id,
              is_wosb_eligible, is_edwosb_eligible, first_seen_at, last_updated_at,
              (response_due_date - CURRENT_DATE) AS days_until_due,
              (CURRENT_DATE - first_seen_at::date) <= 1 AS is_new_today
       FROM aggregated_solicitations ${where}
       ORDER BY ${sf} ${sd} NULLS LAST
       LIMIT $${i++} OFFSET $${i++}`,
      [...params, limitNum, offset]
    );
    const total = parseInt(countRow?.total||'0');
    res.json({ solicitations: rows, total, page: pageNum, limit: limitNum, total_pages: Math.ceil(total/limitNum) });
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function getSolicitation(req: Request, res: Response): Promise<void> {
  try {
    const row = await queryOne(`SELECT *, (response_due_date - CURRENT_DATE) AS days_until_due FROM aggregated_solicitations WHERE id=$1`, [req.params.id]);
    if (!row) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(row);
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function updateSolicitationStatus(req: Request, res: Response): Promise<void> {
  try {
    const { status } = req.body;
    const VALID = ['New','Reviewed','Added to Pipeline','No Bid','Expired'];
    if (!VALID.includes(status)) { res.status(400).json({ error: 'Invalid status' }); return; }
    await pool.query(`UPDATE aggregated_solicitations SET status=$1 WHERE id=$2`, [status, req.params.id]);
    res.json({ id: req.params.id, status });
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function addToProposals(req: Request, res: Response): Promise<void> {
  try {
    const solId = parseInt(req.params.id);
    const sol = await queryOne<Record<string,unknown>>(`SELECT * FROM aggregated_solicitations WHERE id=$1`, [solId]);
    if (!sol) { res.status(404).json({ error: 'Solicitation not found' }); return; }
    if (sol.proposal_id) { res.status(409).json({ error: 'Already in pipeline', proposal_id: sol.proposal_id }); return; }

    const [proposal] = await query(
      `INSERT INTO proposals (contract_name,solicitation_number,agency,naics_code,set_aside_type,proposal_due_date,notes,status,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'Opportunity Identified',$8) RETURNING *`,
      [
        sol.title || 'Untitled',
        sol.solicitation_number || null,
        sol.agency_name || null,
        sol.naics_code || null,
        sol.set_aside_type || null,
        sol.response_due_date || null,
        `POC: ${sol.poc_name||''}${sol.poc_email?' <'+sol.poc_email+'> ':''}\nSource: ${sol.source}\nURL: ${sol.original_url||''}`,
        req.user!.id,
      ]
    ) as Record<string,unknown>[];

    await pool.query(`UPDATE aggregated_solicitations SET status='Added to Pipeline', proposal_id=$1 WHERE id=$2`, [proposal.id, solId]);
    res.status(201).json({ proposal, solicitation_id: solId });
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function triggerSync(req: Request, res: Response): Promise<void> {
  try {
    res.json({ message: 'Sync started in background', started_at: new Date().toISOString() });
    // Fire-and-forget
    runAggregatorSync().catch(err => console.error('Manual sync error:', err));
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function getSyncLogs(_req: Request, res: Response): Promise<void> {
  try {
    const rows = await query(`SELECT * FROM aggregator_sync_log ORDER BY started_at DESC LIMIT 20`);
    res.json(rows);
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function getAggregatorSettings(_req: Request, res: Response): Promise<void> {
  try {
    const rows = await query(`SELECT key, value FROM aggregator_settings`);
    const settings: Record<string,string> = {};
    for (const r of rows as {key:string;value:string}[]) settings[r.key] = r.value;
    res.json(settings);
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function updateAggregatorSettings(req: Request, res: Response): Promise<void> {
  try {
    const settings = req.body as Record<string,string>;
    for (const [key, value] of Object.entries(settings)) {
      await pool.query(
        `INSERT INTO aggregator_settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
        [key, value]
      );
    }
    res.json({ message: 'Settings updated' });
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function getMarketIntelligence(req: Request, res: Response): Promise<void> {
  try {
    const { agency, naics_code, page = '1', limit = '25' } = req.query as Record<string,string>;
    const pageNum = Math.max(1, parseInt(page)); const limitNum = Math.min(100, parseInt(limit));
    const offset = (pageNum-1)*limitNum;
    const conds: string[] = []; const params: unknown[] = []; let i = 1;
    if (agency) { conds.push(`agency_name ILIKE $${i++}`); params.push(`%${agency}%`); }
    if (naics_code) { conds.push(`naics_code = $${i++}`); params.push(naics_code); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const rows = await query(`SELECT * FROM usa_spending_awards ${where} ORDER BY award_amount DESC NULLS LAST LIMIT $${i++} OFFSET $${i++}`, [...params,limitNum,offset]);
    const total = await queryOne<{total:string}>(`SELECT COUNT(*) total FROM usa_spending_awards ${where}`, params);
    res.json({ awards: rows, total: parseInt(total?.total||'0'), page: pageNum });
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function getAggregatorDashboard(_req: Request, res: Response): Promise<void> {
  try {
    const [totals, newToday, wosb, expiring, lastSync] = await Promise.all([
      queryOne<Record<string,string>>(`SELECT COUNT(*) total, SUM(CASE WHEN status='New' THEN 1 ELSE 0 END) new_count, SUM(CASE WHEN (is_wosb_eligible OR is_edwosb_eligible) THEN 1 ELSE 0 END) wosb_count FROM aggregated_solicitations WHERE status NOT IN ('Expired','No Bid') AND (response_due_date IS NULL OR response_due_date >= CURRENT_DATE)`),
      queryOne<{count:string}>(`SELECT COUNT(*) count FROM aggregated_solicitations WHERE first_seen_at >= NOW() - INTERVAL '24 hours'`),
      queryOne<{count:string}>(`SELECT COUNT(*) count FROM aggregated_solicitations WHERE (is_wosb_eligible OR is_edwosb_eligible) AND status='New'`),
      queryOne<{count:string}>(`SELECT COUNT(*) count FROM aggregated_solicitations WHERE response_due_date <= CURRENT_DATE+7 AND response_due_date >= CURRENT_DATE AND status='New'`),
      queryOne(`SELECT * FROM aggregator_sync_log ORDER BY started_at DESC LIMIT 1`),
    ]);
    res.json({
      total_solicitations: parseInt(totals?.total||'0'),
      new_today: parseInt(newToday?.count||'0'),
      wosb_available: parseInt(wosb?.count||'0'),
      expiring_soon: parseInt(expiring?.count||'0'),
      last_sync: lastSync,
    });
  } catch { res.status(500).json({ error: 'Server error' }); }
}

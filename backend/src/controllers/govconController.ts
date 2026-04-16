import { Request, Response } from 'express';
import { query, queryOne, pool } from '../db/pool';

// ─── Opportunities ────────────────────────────────────────────────────────────

export async function listOpportunities(req: Request, res: Response): Promise<void> {
  try {
    const { q, status, agency, naics_code, set_aside_type, sort_by = 'response_due_date', sort_order = 'ASC', page = '1', limit = '25' } = req.query as Record<string,string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum-1)*limitNum;
    const conds: string[] = []; const params: unknown[] = []; let i = 1;
    if (q) { conds.push(`(title ILIKE $${i} OR solicitation_number ILIKE $${i++})`); params.push(`%${q}%`); }
    if (status) { conds.push(`status = $${i++}`); params.push(status); }
    if (agency) { conds.push(`agency_name ILIKE $${i++}`); params.push(`%${agency}%`); }
    if (naics_code) { conds.push(`naics_code = $${i++}`); params.push(naics_code); }
    if (set_aside_type) { conds.push(`set_aside_type ILIKE $${i++}`); params.push(`%${set_aside_type}%`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const validSort = ['response_due_date','posted_date','contract_value_estimate','agency_name','title'];
    const sf = validSort.includes(sort_by) ? sort_by : 'response_due_date';
    const sd = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const countRow = await queryOne<{total:string}>(`SELECT COUNT(*) total FROM opportunities ${where}`, params);
    const rows = await query(`SELECT * FROM opportunities ${where} ORDER BY ${sf} ${sd} NULLS LAST LIMIT $${i++} OFFSET $${i++}`, [...params,limitNum,offset]);
    res.json({ opportunities: rows, total: parseInt(countRow?.total||'0'), page: pageNum, limit: limitNum, total_pages: Math.ceil(parseInt(countRow?.total||'0')/limitNum) });
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function createOpportunity(req: Request, res: Response): Promise<void> {
  try {
    const { title, solicitation_number, agency_name, naics_code, set_aside_type, posted_date, response_due_date, contract_value_estimate, status, poc_name, poc_email, poc_phone, sam_gov_link, notes } = req.body;
    if (!title) { res.status(400).json({ error: 'title required' }); return; }
    const [row] = await query(`INSERT INTO opportunities (title,solicitation_number,agency_name,naics_code,set_aside_type,posted_date,response_due_date,contract_value_estimate,status,poc_name,poc_email,poc_phone,sam_gov_link,notes,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [title,solicitation_number||null,agency_name||null,naics_code||null,set_aside_type||null,posted_date||null,response_due_date||null,contract_value_estimate||null,status||'New',poc_name||null,poc_email||null,poc_phone||null,sam_gov_link||null,notes||null,req.user!.id]);
    res.status(201).json(row);
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function updateOpportunity(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id);
    const fields = ['title','solicitation_number','agency_name','naics_code','set_aside_type','posted_date','response_due_date','contract_value_estimate','status','poc_name','poc_email','poc_phone','sam_gov_link','notes'];
    const updates: string[] = []; const vals: unknown[] = []; let i = 1;
    for (const f of fields) { if (req.body[f] !== undefined) { updates.push(`${f}=$${i++}`); vals.push(req.body[f]); } }
    if (!updates.length) { res.status(400).json({ error: 'No fields to update' }); return; }
    updates.push(`updated_at=NOW()`); vals.push(id);
    const [row] = await query(`UPDATE opportunities SET ${updates.join(',')} WHERE id=$${i} RETURNING *`, vals);
    res.json(row);
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function deleteOpportunity(req: Request, res: Response): Promise<void> {
  try { await pool.query(`DELETE FROM opportunities WHERE id=$1`, [req.params.id]); res.json({ message: 'Deleted' }); }
  catch { res.status(500).json({ error: 'Server error' }); }
}

// ─── Sources Sought ───────────────────────────────────────────────────────────

export async function listSourcesSought(req: Request, res: Response): Promise<void> {
  try {
    const { q, outcome, agency, page = '1', limit = '25' } = req.query as Record<string,string>;
    const pageNum = Math.max(1, parseInt(page)); const limitNum = Math.min(100, parseInt(limit));
    const offset = (pageNum-1)*limitNum;
    const conds: string[] = []; const params: unknown[] = []; let i = 1;
    if (q) { conds.push(`(title ILIKE $${i} OR notice_number ILIKE $${i++})`); params.push(`%${q}%`); }
    if (outcome) { conds.push(`outcome = $${i++}`); params.push(outcome); }
    if (agency) { conds.push(`agency_name ILIKE $${i++}`); params.push(`%${agency}%`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const countRow = await queryOne<{total:string}>(`SELECT COUNT(*) total FROM sources_sought ${where}`, params);
    const rows = await query(`SELECT * FROM sources_sought ${where} ORDER BY date_posted DESC NULLS LAST LIMIT $${i++} OFFSET $${i++}`, [...params,limitNum,offset]);
    res.json({ items: rows, total: parseInt(countRow?.total||'0'), page: pageNum, limit: limitNum, total_pages: Math.ceil(parseInt(countRow?.total||'0')/limitNum) });
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function createSourcesSought(req: Request, res: Response): Promise<void> {
  try {
    const { agency_name, title, notice_number, naics_code, date_posted, response_submitted_date, co_name, co_email, co_phone, follow_up_date, outcome, notes } = req.body;
    const [row] = await query(`INSERT INTO sources_sought (agency_name,title,notice_number,naics_code,date_posted,response_submitted_date,co_name,co_email,co_phone,follow_up_date,outcome,notes,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [agency_name||null,title||null,notice_number||null,naics_code||null,date_posted||null,response_submitted_date||null,co_name||null,co_email||null,co_phone||null,follow_up_date||null,outcome||'Pending',notes||null,req.user!.id]);
    res.status(201).json(row);
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function updateSourcesSought(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id);
    const fields = ['agency_name','title','notice_number','naics_code','date_posted','response_submitted_date','co_name','co_email','co_phone','follow_up_date','outcome','notes'];
    const updates: string[] = []; const vals: unknown[] = []; let i = 1;
    for (const f of fields) { if (req.body[f] !== undefined) { updates.push(`${f}=$${i++}`); vals.push(req.body[f]); } }
    if (!updates.length) { res.status(400).json({ error: 'No fields to update' }); return; }
    updates.push(`updated_at=NOW()`); vals.push(id);
    const [row] = await query(`UPDATE sources_sought SET ${updates.join(',')} WHERE id=$${i} RETURNING *`, vals);
    res.json(row);
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function deleteSourcesSought(req: Request, res: Response): Promise<void> {
  try { await pool.query(`DELETE FROM sources_sought WHERE id=$1`, [req.params.id]); res.json({ message: 'Deleted' }); }
  catch { res.status(500).json({ error: 'Server error' }); }
}

// ─── Proposals ────────────────────────────────────────────────────────────────

const PROPOSAL_STATUSES = ['Opportunity Identified','Reviewing Solicitation','Go or No Go Decision','Proposal In Progress','Waiting on Sub Quote','Waiting on Teaming Partner','Internal Review','Final Revisions','Submitted','Under Evaluation','Awarded','Not Awarded','Debriefing Requested','No Bid','Cancelled'];

export async function listProposals(req: Request, res: Response): Promise<void> {
  try {
    const { q, status, agency, naics_code, sort_by = 'proposal_due_date', sort_order = 'ASC', page = '1', limit = '50' } = req.query as Record<string,string>;
    const pageNum = Math.max(1, parseInt(page)); const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
    const offset = (pageNum-1)*limitNum;
    const conds: string[] = []; const params: unknown[] = []; let i = 1;
    if (q) {
      conds.push(`(to_tsvector('english',coalesce(contract_name,'')||' '||coalesce(solicitation_number,'')||' '||coalesce(agency,'')||' '||coalesce(notes,'')) @@ plainto_tsquery('english',$${i++}))`);
      params.push(q);
    }
    if (status) { conds.push(`status = $${i++}`); params.push(status); }
    if (agency) { conds.push(`agency ILIKE $${i++}`); params.push(`%${agency}%`); }
    if (naics_code) { conds.push(`naics_code = $${i++}`); params.push(naics_code); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const validSort = ['proposal_due_date','contract_value','agency','contract_name','status','created_at'];
    const sf = validSort.includes(sort_by) ? sort_by : 'proposal_due_date';
    const sd = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const countRow = await queryOne<{total:string}>(`SELECT COUNT(*) total FROM proposals ${where}`, params);
    const rows = await query(`SELECT p.*, (SELECT COUNT(*) FROM sub_quotes sq WHERE sq.proposal_id=p.id AND sq.quote_received=false) pending_quotes FROM proposals p ${where} ORDER BY ${sf} ${sd} NULLS LAST LIMIT $${i++} OFFSET $${i++}`, [...params,limitNum,offset]);
    res.json({ proposals: rows, total: parseInt(countRow?.total||'0'), page: pageNum, limit: limitNum, total_pages: Math.ceil(parseInt(countRow?.total||'0')/limitNum) });
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function getProposal(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id);
    const [proposal, activity, subQuotes] = await Promise.all([
      queryOne(`SELECT p.*, (SELECT COUNT(*) FROM sub_quotes sq WHERE sq.proposal_id=p.id AND sq.quote_received=false) pending_quotes FROM proposals p WHERE p.id=$1`, [id]),
      query(`SELECT pa.*, u.full_name user_name FROM proposal_activity pa LEFT JOIN users u ON pa.user_id=u.id WHERE pa.proposal_id=$1 ORDER BY pa.created_at DESC`, [id]),
      query(`SELECT * FROM sub_quotes WHERE proposal_id=$1 ORDER BY quote_due_date ASC NULLS LAST`, [id]),
    ]);
    if (!proposal) { res.status(404).json({ error: 'Proposal not found' }); return; }
    res.json({ ...proposal, activity, sub_quotes: subQuotes });
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function createProposal(req: Request, res: Response): Promise<void> {
  try {
    const { contract_name, solicitation_number, agency, naics_code, set_aside_type, contract_value, proposal_due_date, status, team_members, notes, period_of_performance, place_of_performance } = req.body;
    if (!contract_name) { res.status(400).json({ error: 'contract_name required' }); return; }
    const [row] = await query(
      `INSERT INTO proposals (contract_name,solicitation_number,agency,naics_code,set_aside_type,contract_value,proposal_due_date,status,team_members,notes,period_of_performance,place_of_performance,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [contract_name,solicitation_number||null,agency||null,naics_code||null,set_aside_type||null,contract_value||null,proposal_due_date||null,status||'Opportunity Identified',team_members||[],notes||null,period_of_performance||null,place_of_performance||null,req.user!.id]
    );
    await pool.query(`INSERT INTO proposal_activity (proposal_id,user_id,action,description) VALUES ($1,$2,'CREATED','Proposal created')`, [row.id, req.user!.id]);
    res.status(201).json(row);
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function updateProposal(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id);
    const existing = await queryOne<{status:string}>(`SELECT status FROM proposals WHERE id=$1`, [id]);
    if (!existing) { res.status(404).json({ error: 'Proposal not found' }); return; }
    const fields = ['contract_name','solicitation_number','agency','naics_code','set_aside_type','contract_value','proposal_due_date','submitted_date','status','team_members','notes','win_loss','period_of_performance','place_of_performance','doc_technical_approach','doc_past_performance','doc_pricing','doc_capability_statement','doc_certifications','doc_teaming_agreements'];
    const updates: string[] = []; const vals: unknown[] = []; let i = 1;
    for (const f of fields) { if (req.body[f] !== undefined) { updates.push(`${f}=$${i++}`); vals.push(req.body[f]); } }
    if (!updates.length) { res.status(400).json({ error: 'No fields to update' }); return; }
    if (req.body.status && req.body.status !== existing.status) {
      updates.push(`status_updated_at=NOW()`);
      await pool.query(`INSERT INTO proposal_activity (proposal_id,user_id,action,old_status,new_status,description) VALUES ($1,$2,'STATUS_CHANGE',$3,$4,$5)`, [id,req.user!.id,existing.status,req.body.status,`Status changed from ${existing.status} to ${req.body.status}`]);
    }
    updates.push(`updated_at=NOW()`); vals.push(id);
    const [row] = await query(`UPDATE proposals SET ${updates.join(',')} WHERE id=$${i} RETURNING *`, vals);
    res.json(row);
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function deleteProposal(req: Request, res: Response): Promise<void> {
  try { await pool.query(`DELETE FROM proposals WHERE id=$1`, [req.params.id]); res.json({ message: 'Deleted' }); }
  catch { res.status(500).json({ error: 'Server error' }); }
}

export async function addSubQuote(req: Request, res: Response): Promise<void> {
  try {
    const proposalId = parseInt(req.params.id);
    const { company_name, contact_name, contact_phone, quote_requested_date, quote_due_date, quote_received, quote_amount, notes } = req.body;
    if (!company_name) { res.status(400).json({ error: 'company_name required' }); return; }
    const [row] = await query(`INSERT INTO sub_quotes (proposal_id,company_name,contact_name,contact_phone,quote_requested_date,quote_due_date,quote_received,quote_amount,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [proposalId,company_name,contact_name||null,contact_phone||null,quote_requested_date||null,quote_due_date||null,quote_received||false,quote_amount||null,notes||null]);
    res.status(201).json(row);
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function updateSubQuote(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.quoteId);
    const fields = ['company_name','contact_name','contact_phone','quote_requested_date','quote_due_date','quote_received','quote_amount','notes'];
    const updates: string[] = []; const vals: unknown[] = []; let i = 1;
    for (const f of fields) { if (req.body[f] !== undefined) { updates.push(`${f}=$${i++}`); vals.push(req.body[f]); } }
    if (!updates.length) { res.status(400).json({ error: 'No fields to update' }); return; }
    updates.push(`updated_at=NOW()`); vals.push(id);
    const [row] = await query(`UPDATE sub_quotes SET ${updates.join(',')} WHERE id=$${i} RETURNING *`, vals);
    res.json(row);
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function deleteSubQuote(req: Request, res: Response): Promise<void> {
  try { await pool.query(`DELETE FROM sub_quotes WHERE id=$1`, [req.params.quoteId]); res.json({ message: 'Deleted' }); }
  catch { res.status(500).json({ error: 'Server error' }); }
}

export async function getProposalMetrics(_req: Request, res: Response): Promise<void> {
  try {
    const [byStatus, pipeline, winRate, outstanding] = await Promise.all([
      query(`SELECT status, COUNT(*) count, SUM(contract_value) total_value FROM proposals GROUP BY status ORDER BY status`),
      queryOne<{total:string,awarded:string,submitted:string}>(`SELECT SUM(contract_value) total, SUM(CASE WHEN win_loss='win' THEN contract_value ELSE 0 END) awarded, SUM(CASE WHEN status='Submitted' THEN contract_value ELSE 0 END) submitted FROM proposals`),
      queryOne<{win_count:string,total_decided:string}>(`SELECT SUM(CASE WHEN win_loss='win' THEN 1 ELSE 0 END) win_count, SUM(CASE WHEN win_loss IN ('win','loss') THEN 1 ELSE 0 END) total_decided FROM proposals`),
      queryOne<{count:string}>(`SELECT COUNT(*) count FROM sub_quotes WHERE quote_received=false`),
    ]);
    const totalDecided = parseInt(winRate?.total_decided||'0');
    const winCount = parseInt(winRate?.win_count||'0');
    res.json({
      by_status: byStatus,
      total_pipeline_value: parseFloat(pipeline?.total||'0'),
      total_awarded_value: parseFloat(pipeline?.awarded||'0'),
      total_submitted_value: parseFloat(pipeline?.submitted||'0'),
      win_rate: totalDecided > 0 ? Math.round((winCount/totalDecided)*100) : 0,
      outstanding_sub_quotes: parseInt(outstanding?.count||'0'),
    });
  } catch { res.status(500).json({ error: 'Server error' }); }
}

// ─── Agencies ─────────────────────────────────────────────────────────────────

export async function listAgencies(req: Request, res: Response): Promise<void> {
  try {
    const { q, relationship_status, last_contact_after, last_contact_before, page = '1', limit = '25' } = req.query as Record<string,string>;
    const pageNum = Math.max(1, parseInt(page)); const limitNum = Math.min(100, parseInt(limit));
    const offset = (pageNum-1)*limitNum;
    const conds: string[] = []; const params: unknown[] = []; let i = 1;
    if (q) { conds.push(`agency_name ILIKE $${i++}`); params.push(`%${q}%`); }
    if (relationship_status) { conds.push(`relationship_status = $${i++}`); params.push(relationship_status); }
    if (last_contact_after) { conds.push(`last_contact_date >= $${i++}`); params.push(last_contact_after); }
    if (last_contact_before) { conds.push(`last_contact_date <= $${i++}`); params.push(last_contact_before); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const countRow = await queryOne<{total:string}>(`SELECT COUNT(*) total FROM agencies ${where}`, params);
    const rows = await query(`SELECT * FROM agencies ${where} ORDER BY agency_name ASC LIMIT $${i++} OFFSET $${i++}`, [...params,limitNum,offset]);
    res.json({ agencies: rows, total: parseInt(countRow?.total||'0'), page: pageNum, total_pages: Math.ceil(parseInt(countRow?.total||'0')/limitNum) });
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function getAgency(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id);
    const [agency, interactions, opportunities] = await Promise.all([
      queryOne(`SELECT * FROM agencies WHERE id=$1`, [id]),
      query(`SELECT ai.*, u.full_name user_name FROM agency_interactions ai LEFT JOIN users u ON ai.user_id=u.id WHERE ai.agency_id=$1 ORDER BY ai.interaction_date DESC`, [id]),
      query(`SELECT id, title, solicitation_number, status, response_due_date, contract_value_estimate FROM opportunities WHERE agency_name ILIKE $1 ORDER BY response_due_date ASC NULLS LAST`, [(await queryOne<{agency_name:string}>(`SELECT agency_name FROM agencies WHERE id=$1`,[id]))?.agency_name||'']),
    ]);
    if (!agency) { res.status(404).json({ error: 'Agency not found' }); return; }
    res.json({ ...agency, interactions, linked_opportunities: opportunities });
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function createAgency(req: Request, res: Response): Promise<void> {
  try {
    const fields = ['agency_name','department','acronym','sb_contact_name','sb_contact_email','sb_contact_phone','co_name','co_email','co_phone','pm_name','pm_email','pm_phone','primary_contact_title','naics_focus','set_aside_focus','last_contact_date','next_follow_up_date','relationship_status','cap_statement_sent','cap_statement_sent_date','notes'];
    if (!req.body.agency_name) { res.status(400).json({ error: 'agency_name required' }); return; }
    const vals = fields.map(f => req.body[f] ?? null);
    const [row] = await query(`INSERT INTO agencies (${fields.join(',')}) VALUES (${fields.map((_,i)=>`$${i+1}`).join(',')}) RETURNING *`, vals);
    res.status(201).json(row);
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function updateAgency(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id);
    const allowedFields = ['agency_name','department','acronym','sb_contact_name','sb_contact_email','sb_contact_phone','co_name','co_email','co_phone','pm_name','pm_email','pm_phone','primary_contact_title','naics_focus','set_aside_focus','last_contact_date','next_follow_up_date','relationship_status','cap_statement_sent','cap_statement_sent_date','notes'];
    const updates: string[] = []; const vals: unknown[] = []; let i = 1;
    for (const f of allowedFields) { if (req.body[f] !== undefined) { updates.push(`${f}=$${i++}`); vals.push(req.body[f]); } }
    if (!updates.length) { res.status(400).json({ error: 'No fields to update' }); return; }
    updates.push(`updated_at=NOW()`); vals.push(id);
    const [row] = await query(`UPDATE agencies SET ${updates.join(',')} WHERE id=$${i} RETURNING *`, vals);
    res.json(row);
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function addAgencyInteraction(req: Request, res: Response): Promise<void> {
  try {
    const agencyId = parseInt(req.params.id);
    const { interaction_type, interaction_date, notes } = req.body;
    if (!interaction_date) { res.status(400).json({ error: 'interaction_date required' }); return; }
    const [row] = await query(`INSERT INTO agency_interactions (agency_id,user_id,interaction_type,interaction_date,notes) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [agencyId,req.user!.id,interaction_type||'call',interaction_date,notes||null]);
    await pool.query(`UPDATE agencies SET last_contact_date=$1, updated_at=NOW() WHERE id=$2`, [interaction_date,agencyId]);
    res.status(201).json(row);
  } catch { res.status(500).json({ error: 'Server error' }); }
}

// ─── Certifications ───────────────────────────────────────────────────────────

export async function listCertifications(_req: Request, res: Response): Promise<void> {
  try {
    const rows = await query(`SELECT *, (expiration_date - CURRENT_DATE) as days_until_expiry FROM certifications ORDER BY expiration_date ASC NULLS LAST`);
    res.json(rows);
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function createCertification(req: Request, res: Response): Promise<void> {
  try {
    const { name, cert_type, issuing_body, certification_number, status, issued_date, expiration_date, renewal_reminder_days, notes } = req.body;
    if (!name) { res.status(400).json({ error: 'name required' }); return; }
    const [row] = await query(`INSERT INTO certifications (name,cert_type,issuing_body,certification_number,status,issued_date,expiration_date,renewal_reminder_days,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *, (expiration_date - CURRENT_DATE) as days_until_expiry`,
      [name,cert_type||null,issuing_body||null,certification_number||null,status||'Active',issued_date||null,expiration_date||null,renewal_reminder_days||60,notes||null]);
    res.status(201).json(row);
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function updateCertification(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id);
    const fields = ['name','cert_type','issuing_body','certification_number','status','issued_date','expiration_date','renewal_reminder_days','notes'];
    const updates: string[] = []; const vals: unknown[] = []; let i = 1;
    for (const f of fields) { if (req.body[f] !== undefined) { updates.push(`${f}=$${i++}`); vals.push(req.body[f]); } }
    if (!updates.length) { res.status(400).json({ error: 'No fields to update' }); return; }
    updates.push(`updated_at=NOW()`); vals.push(id);
    const [row] = await query(`UPDATE certifications SET ${updates.join(',')} WHERE id=$${i} RETURNING *, (expiration_date - CURRENT_DATE) as days_until_expiry`, vals);
    res.json(row);
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function deleteCertification(req: Request, res: Response): Promise<void> {
  try { await pool.query(`DELETE FROM certifications WHERE id=$1`, [req.params.id]); res.json({ message: 'Deleted' }); }
  catch { res.status(500).json({ error: 'Server error' }); }
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

export async function getCalendarEvents(req: Request, res: Response): Promise<void> {
  try {
    const { start, end } = req.query as Record<string,string>;
    let where = ''; const params: unknown[] = [];
    if (start && end) { where = `WHERE start_date BETWEEN $1 AND $2`; params.push(start, end); }
    const rows = await query(`SELECT * FROM calendar_events ${where} ORDER BY start_date ASC, start_time ASC NULLS LAST`, params);
    res.json(rows);
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function createCalendarEvent(req: Request, res: Response): Promise<void> {
  try {
    const { title, description, event_type, start_date, start_time, end_date, color, related_entity_type, related_entity_id } = req.body;
    if (!title || !start_date) { res.status(400).json({ error: 'title and start_date required' }); return; }
    const [row] = await query(`INSERT INTO calendar_events (title,description,event_type,start_date,start_time,end_date,color,related_entity_type,related_entity_id,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [title,description||null,event_type||null,start_date,start_time||null,end_date||null,color||'#D4AF37',related_entity_type||null,related_entity_id||null,req.user!.id]);
    res.status(201).json(row);
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function deleteCalendarEvent(req: Request, res: Response): Promise<void> {
  try { await pool.query(`DELETE FROM calendar_events WHERE id=$1`, [req.params.id]); res.json({ message: 'Deleted' }); }
  catch { res.status(500).json({ error: 'Server error' }); }
}

// ─── GovCon Dashboard ─────────────────────────────────────────────────────────

export async function getGovConDashboard(_req: Request, res: Response): Promise<void> {
  try {
    const [proposals, opportunities, sources, certs, subQuotes, upcoming] = await Promise.all([
      queryOne<Record<string,string>>(`SELECT COUNT(*) total, SUM(contract_value) pipeline_value, SUM(CASE WHEN status='Submitted' THEN 1 ELSE 0 END) submitted, SUM(CASE WHEN win_loss='win' THEN 1 ELSE 0 END) won, SUM(CASE WHEN win_loss='win' THEN contract_value ELSE 0 END) won_value, SUM(CASE WHEN win_loss IN ('win','loss') THEN 1 ELSE 0 END) decided FROM proposals`),
      queryOne<{total:string}>(`SELECT COUNT(*) total FROM opportunities WHERE status NOT IN ('Awarded','No Bid','Not Awarded')`),
      queryOne<{total:string,converted:string}>(`SELECT COUNT(*) total, SUM(CASE WHEN outcome='Converted to RFP' THEN 1 ELSE 0 END) converted FROM sources_sought`),
      query(`SELECT * FROM certifications WHERE expiration_date <= CURRENT_DATE + INTERVAL '60 days' AND status='Active' ORDER BY expiration_date ASC`),
      queryOne<{count:string}>(`SELECT COUNT(*) count FROM sub_quotes WHERE quote_received=false`),
      query(`SELECT title, proposal_due_date, agency, contract_value FROM proposals WHERE proposal_due_date BETWEEN CURRENT_DATE AND CURRENT_DATE+7 AND status NOT IN ('Submitted','Awarded','Not Awarded','No Bid','Cancelled') ORDER BY proposal_due_date ASC`),
    ]);
    const total = parseInt(proposals?.total||'0');
    const decided = parseInt(proposals?.decided||'0');
    const won = parseInt(proposals?.won||'0');
    res.json({
      total_proposals: total,
      pipeline_value: parseFloat(proposals?.pipeline_value||'0'),
      submitted_proposals: parseInt(proposals?.submitted||'0'),
      won_value: parseFloat(proposals?.won_value||'0'),
      win_rate: decided > 0 ? Math.round((won/decided)*100) : 0,
      active_opportunities: parseInt(opportunities?.total||'0'),
      sources_sought_total: parseInt(sources?.total||'0'),
      sources_sought_converted: parseInt(sources?.converted||'0'),
      expiring_certifications: certs,
      outstanding_sub_quotes: parseInt(subQuotes?.count||'0'),
      proposals_due_this_week: upcoming,
    });
  } catch { res.status(500).json({ error: 'Server error' }); }
}

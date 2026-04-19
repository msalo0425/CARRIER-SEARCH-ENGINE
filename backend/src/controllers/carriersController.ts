import { Request, Response } from 'express';
import { query, queryOne, pool, withTransaction } from '../db/pool';

const VALID_SORT = ['legal_name','dot_number','phy_state','phy_city','nbr_power_unit','drivers','added_date','safety_rating'];

const CARGO_FIELDS = [
  'cargo_general_freight','cargo_household_goods','cargo_metal_sheets','cargo_motor_vehicles',
  'cargo_drive_away','cargo_logs_poles','cargo_building_materials','cargo_mobile_homes',
  'cargo_machinery_equipment','cargo_fresh_produce','cargo_liquids_gases','cargo_intermodal',
  'cargo_passengers','cargo_oilfield_equipment','cargo_livestock','cargo_grain','cargo_coal',
  'cargo_meat','cargo_garbage_refuse','cargo_us_mail','cargo_chemicals','cargo_commodities_dry_bulk',
  'cargo_refrigerated','cargo_beverages','cargo_paper_products','cargo_utilities',
  'cargo_agriculture_products','cargo_construction','cargo_water_well','cargo_other',
];

function s(v: unknown): string | null {
  if (v === undefined || v === null || v === '') return null;
  return String(v).trim().slice(0, 1000);
}

async function logActivity(userId: number|undefined, entityType: string, entityId: string, action: string, description: string) {
  try {
    await pool.query(
      `INSERT INTO activity_log (user_id,entity_type,entity_id,dot_number,action,description) VALUES ($1,$2,$3,$4,$5,$6)`,
      [userId||null, entityType, entityId, entityType==='carrier'?entityId:null, action, description]
    );
  } catch { /* non-critical */ }
}

export async function searchCarriers(req: Request, res: Response): Promise<void> {
  try {
    const {
      q, dot_number, mc_number, state, city, zip,
      entity_type, safety_rating, operating_status, carrier_operation,
      op_carrier, op_broker, hm_flag, pc_flag, cargo_type,
      insurance_on_file, min_power_units, max_power_units,
      crm_status, in_pipeline,
      page = '1', limit = '25', sort_by = 'legal_name', sort_order = 'ASC',
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;
    const sortField = VALID_SORT.includes(sort_by) ? sort_by : 'legal_name';
    const sortDir = sort_order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const conditions: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (q) {
      conditions.push(`c.search_vector @@ plainto_tsquery('english', $${i++})`);
      params.push(q);
    }
    if (dot_number) { conditions.push(`c.dot_number ILIKE $${i++}`); params.push(`%${dot_number}%`); }
    if (mc_number) { conditions.push(`(c.mc_number ILIKE $${i} OR c.mc_mx_ff_number ILIKE $${i++})`); params.push(`%${mc_number}%`); }
    if (state) { conditions.push(`c.phy_state = $${i++}`); params.push(state.toUpperCase()); }
    if (city) { conditions.push(`c.phy_city ILIKE $${i++}`); params.push(`%${city}%`); }
    if (zip) { conditions.push(`c.phy_zip LIKE $${i++}`); params.push(`${zip}%`); }
    if (entity_type) { conditions.push(`c.entity_type ILIKE $${i++}`); params.push(entity_type); }
    if (safety_rating) { conditions.push(`c.safety_rating ILIKE $${i++}`); params.push(`%${safety_rating}%`); }
    if (operating_status) { conditions.push(`c.operating_status = $${i++}`); params.push(operating_status); }
    if (carrier_operation) { conditions.push(`c.carrier_operation = $${i++}`); params.push(carrier_operation); }
    if (op_carrier === 'true') conditions.push(`c.op_carrier_flag = true`);
    if (op_broker === 'true') conditions.push(`c.op_broker_flag = true`);
    if (hm_flag === 'true') conditions.push(`c.hm_flag = true`);
    if (pc_flag === 'true') conditions.push(`c.pc_flag = true`);
    if (cargo_type && CARGO_FIELDS.includes(cargo_type)) conditions.push(`c.${cargo_type} = true`);
    if (insurance_on_file === 'true') conditions.push(`(c.insurance_on_file = true OR c.bipd_insurance_on_file = true OR c.cargo_insurance_on_file = true)`);
    if (insurance_on_file === 'false') conditions.push(`(c.insurance_on_file = false AND c.bipd_insurance_on_file = false AND c.cargo_insurance_on_file = false)`);
    if (min_power_units) { conditions.push(`c.nbr_power_unit >= $${i++}`); params.push(parseInt(min_power_units)); }
    if (max_power_units) { conditions.push(`c.nbr_power_unit <= $${i++}`); params.push(parseInt(max_power_units)); }
    if (crm_status) { conditions.push(`crm.crm_status = $${i++}`); params.push(crm_status); }
    if (in_pipeline === 'true') conditions.push(`crm.is_in_pipeline = true`);
    if (req.query.has_phone === 'true') conditions.push(`c.telephone IS NOT NULL AND c.telephone != ''`);

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const baseFrom = `FROM carriers c LEFT JOIN carrier_crm crm ON c.dot_number = crm.dot_number ${where}`;

    const countRow = await queryOne<{total:string}>(`SELECT COUNT(*) as total ${baseFrom}`, params);
    const total = parseInt(countRow?.total || '0');

    const rows = await query(
      `SELECT c.*, crm.crm_status, crm.is_in_pipeline, crm.is_contacted, crm.do_not_call, crm.notes as crm_notes, crm.pipeline_contract
       ${baseFrom}
       ORDER BY c.${sortField} ${sortDir} NULLS LAST
       LIMIT $${i++} OFFSET $${i++}`,
      [...params, limitNum, offset]
    );

    res.json({ carriers: rows, total, page: pageNum, limit: limitNum, total_pages: Math.ceil(total/limitNum) });
  } catch (err) { console.error('Search error:', err); res.status(500).json({ error: 'Server error' }); }
}

export async function getCarrier(req: Request, res: Response): Promise<void> {
  try {
    const { dotNumber } = req.params;
    if (!/^\d+$/.test(dotNumber)) { res.status(400).json({ error: 'Invalid DOT number' }); return; }
    const carrier = await queryOne(
      `SELECT c.*, crm.crm_status, crm.is_in_pipeline, crm.is_contacted, crm.do_not_call, crm.notes as crm_notes, crm.pipeline_contract
       FROM carriers c
       LEFT JOIN carrier_crm crm ON c.dot_number = crm.dot_number
       WHERE c.dot_number = $1`, [dotNumber]
    );
    if (!carrier) { res.status(404).json({ error: 'Carrier not found' }); return; }
    res.json(carrier);
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function updateCrm(req: Request, res: Response): Promise<void> {
  try {
    const { dotNumber } = req.params;
    const { crm_status, is_in_pipeline, is_contacted, do_not_call, notes, pipeline_contract } = req.body;
    const VALID_CRM = ['New','Contacted','In Negotiation','Subcontractor Added','Do Not Call'];
    if (crm_status && !VALID_CRM.includes(crm_status)) { res.status(400).json({ error: 'Invalid CRM status' }); return; }

    await pool.query(
      `INSERT INTO carrier_crm (dot_number, crm_status, is_in_pipeline, is_contacted, do_not_call, notes, pipeline_contract)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (dot_number) DO UPDATE SET
         crm_status = COALESCE($2, carrier_crm.crm_status),
         is_in_pipeline = COALESCE($3, carrier_crm.is_in_pipeline),
         is_contacted = COALESCE($4, carrier_crm.is_contacted),
         do_not_call = COALESCE($5, carrier_crm.do_not_call),
         notes = COALESCE($6, carrier_crm.notes),
         pipeline_contract = COALESCE($7, carrier_crm.pipeline_contract),
         updated_at = NOW()`,
      [dotNumber, crm_status||'New', is_in_pipeline??false, is_contacted??false, do_not_call??false, notes||null, pipeline_contract||null]
    );
    await logActivity(req.user?.id, 'carrier', dotNumber, 'CRM_UPDATE', `Status: ${crm_status||'updated'}`);
    const updated = await queryOne(`SELECT * FROM carrier_crm WHERE dot_number = $1`, [dotNumber]);
    res.json(updated);
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function getCallLogs(req: Request, res: Response): Promise<void> {
  try {
    const rows = await query(
      `SELECT cl.*, u.full_name as user_name FROM call_logs cl
       LEFT JOIN users u ON cl.user_id = u.id
       WHERE cl.dot_number = $1 ORDER BY cl.call_date DESC, cl.call_time DESC NULLS LAST`,
      [req.params.dotNumber]
    );
    res.json(rows);
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function addCallLog(req: Request, res: Response): Promise<void> {
  try {
    const { dotNumber } = req.params;
    const { call_date = new Date().toISOString().split('T')[0], call_time, outcome, notes, duration_minutes, contact_name, contact_title, callback_date, callback_time } = req.body;
    const VALID = ['No Answer','Left Voicemail','Spoke with Decision Maker','Not Interested','Interested','Call Back Requested','Wrong Number','Disconnected'];
    if (!VALID.includes(outcome)) { res.status(400).json({ error: 'valid outcome required' }); return; }

    const [log] = await query(
      `INSERT INTO call_logs (dot_number,user_id,call_date,call_time,outcome,notes,duration_minutes,contact_name,contact_title,callback_date,callback_time)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [dotNumber, req.user!.id, call_date, call_time||null, outcome, notes||null, duration_minutes||null, contact_name||null, contact_title||null, callback_date||null, callback_time||null]
    );
    // Auto-update CRM
    await pool.query(
      `INSERT INTO carrier_crm (dot_number, crm_status, is_contacted) VALUES ($1, 'Contacted', true)
       ON CONFLICT (dot_number) DO UPDATE SET
         is_contacted = true,
         crm_status = CASE WHEN carrier_crm.crm_status = 'New' THEN 'Contacted' ELSE carrier_crm.crm_status END,
         updated_at = NOW()`,
      [dotNumber]
    );
    await logActivity(req.user?.id, 'carrier', dotNumber, 'CALL_LOGGED', `Outcome: ${outcome}`);
    res.status(201).json(log);
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function getFollowUps(req: Request, res: Response): Promise<void> {
  try {
    const rows = await query(
      `SELECT fu.*, u.full_name as user_name FROM follow_ups fu
       LEFT JOIN users u ON fu.user_id = u.id
       WHERE fu.dot_number = $1 ORDER BY fu.due_date ASC, fu.due_time ASC NULLS LAST`,
      [req.params.dotNumber]
    );
    res.json(rows);
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function addFollowUp(req: Request, res: Response): Promise<void> {
  try {
    const { dotNumber } = req.params;
    const { due_date, due_time, notes, title } = req.body;
    if (!due_date) { res.status(400).json({ error: 'due_date required' }); return; }
    const [fu] = await query(
      `INSERT INTO follow_ups (dot_number,entity_type,entity_id,user_id,due_date,due_time,notes,title) VALUES ($1,'carrier',$1,$2,$3,$4,$5,$6) RETURNING *`,
      [dotNumber, req.user!.id, due_date, due_time||null, notes||null, title||null]
    );
    await logActivity(req.user?.id, 'carrier', dotNumber, 'FOLLOW_UP_SET', `Due: ${due_date}`);
    res.status(201).json(fu);
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function completeFollowUp(req: Request, res: Response): Promise<void> {
  try {
    await pool.query(`UPDATE follow_ups SET is_completed=true, completed_at=NOW() WHERE id=$1`, [req.params.id]);
    res.json({ id: req.params.id, is_completed: true });
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function getPipelineCarriers(_req: Request, res: Response): Promise<void> {
  try {
    const rows = await query(
      `SELECT c.dot_number, c.legal_name, c.dba_name, c.phy_city, c.phy_state, c.telephone,
              c.nbr_power_unit, c.safety_rating, c.operating_status,
              crm.crm_status, crm.pipeline_contract, crm.is_contacted, crm.notes as crm_notes,
              ${CARGO_FIELDS.map(f=>`c.${f}`).join(',')}
       FROM carrier_crm crm
       JOIN carriers c ON c.dot_number = crm.dot_number
       WHERE crm.is_in_pipeline = true
       ORDER BY c.legal_name ASC`
    );
    res.json(rows);
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function getDashboard(_req: Request, res: Response): Promise<void> {
  try {
    const [totals, crmStats, followUpsToday, activity] = await Promise.all([
      queryOne<Record<string,string>>(
        `SELECT COUNT(*) total, SUM(CASE WHEN operating_status='Active' THEN 1 ELSE 0 END) active,
                COUNT(DISTINCT phy_state) states FROM carriers`
      ),
      queryOne<Record<string,string>>(
        `SELECT SUM(CASE WHEN is_contacted THEN 1 ELSE 0 END) contacted,
                SUM(CASE WHEN is_in_pipeline THEN 1 ELSE 0 END) pipeline
         FROM carrier_crm`
      ),
      queryOne<{count:string}>(`SELECT COUNT(*) count FROM follow_ups WHERE due_date=CURRENT_DATE AND is_completed=false`),
      query(
        `SELECT al.*, u.full_name user_name, c.legal_name carrier_name
         FROM activity_log al
         LEFT JOIN users u ON al.user_id = u.id
         LEFT JOIN carriers c ON al.dot_number = c.dot_number
         ORDER BY al.created_at DESC LIMIT 20`
      ),
    ]);
    res.json({
      total_carriers: parseInt(totals?.total||'0'),
      active_carriers: parseInt(totals?.active||'0'),
      states_covered: parseInt(totals?.states||'0'),
      total_contacted: parseInt(crmStats?.contacted||'0'),
      in_pipeline: parseInt(crmStats?.pipeline||'0'),
      follow_ups_today: parseInt(followUpsToday?.count||'0'),
      recent_activity: activity,
    });
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function getStates(_req: Request, res: Response): Promise<void> {
  try {
    const rows = await query(`SELECT phy_state as state, COUNT(*) as count FROM carriers WHERE phy_state IS NOT NULL GROUP BY phy_state ORDER BY phy_state`);
    res.json(rows);
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function getTodayFollowUps(_req: Request, res: Response): Promise<void> {
  try {
    const rows = await query(
      `SELECT fu.*, u.full_name user_name, c.legal_name carrier_name, c.telephone
       FROM follow_ups fu
       LEFT JOIN users u ON fu.user_id = u.id
       LEFT JOIN carriers c ON fu.dot_number = c.dot_number
       WHERE fu.due_date = CURRENT_DATE AND fu.is_completed = false
       ORDER BY fu.due_time ASC NULLS LAST`
    );
    res.json(rows);
  } catch { res.status(500).json({ error: 'Server error' }); }
}

export async function getHotSheet(req: Request, res: Response): Promise<void> {
  try {
    const {
      days = '30', state, has_phone, operating_status,
      page = '1', limit = '50',
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;
    const daysNum = Math.min(365, Math.max(1, parseInt(days) || 30));

    const conditions: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    conditions.push(`c.added_date >= CURRENT_DATE - ($${i++} * INTERVAL '1 day')`);
    params.push(daysNum);

    if (state) { conditions.push(`c.phy_state = $${i++}`); params.push(state.toUpperCase()); }
    if (has_phone === 'true') conditions.push(`c.telephone IS NOT NULL AND c.telephone != ''`);
    if (operating_status) { conditions.push(`c.operating_status = $${i++}`); params.push(operating_status); }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const baseFrom = `FROM carriers c LEFT JOIN carrier_crm crm ON c.dot_number = crm.dot_number ${where}`;

    const countRow = await queryOne<{total:string}>(`SELECT COUNT(*) as total ${baseFrom}`, params);
    const total = parseInt(countRow?.total || '0');

    const rows = await query(
      `SELECT c.dot_number, c.legal_name, c.dba_name, c.phy_state, c.phy_city,
              c.telephone, c.mc_mx_ff_number, c.mc_number, c.added_date,
              c.operating_status, c.nbr_power_unit, c.safety_rating,
              c.carrier_operation, c.op_carrier_flag,
              crm.crm_status, crm.is_in_pipeline
       ${baseFrom}
       ORDER BY c.added_date DESC NULLS LAST
       LIMIT $${i++} OFFSET $${i++}`,
      [...params, limitNum, offset]
    );

    res.json({ carriers: rows, total, page: pageNum, limit: limitNum, total_pages: Math.ceil(total / limitNum) });
  } catch (err) { console.error('Hot sheet error:', err); res.status(500).json({ error: 'Server error' }); }
}

export async function getCrmCarriers(req: Request, res: Response): Promise<void> {
  try {
    const { q, crm_status, page = '1', page_size = '50' } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(200, Math.max(1, parseInt(page_size)));
    const offset = (pageNum - 1) * limitNum;
    const conds: string[] = ['crm.dot_number IS NOT NULL'];
    const params: unknown[] = [];
    let i = 1;
    if (q) { conds.push(`(c.legal_name ILIKE $${i} OR c.dot_number ILIKE $${i++})`); params.push(`%${q}%`); }
    if (crm_status) { conds.push(`crm.crm_status = $${i++}`); params.push(crm_status); }
    const where = `WHERE ${conds.join(' AND ')}`;
    const countRow = await queryOne<{total:string}>(`SELECT COUNT(*) total FROM carrier_crm crm JOIN carriers c ON c.dot_number=crm.dot_number ${where}`, params);
    const total = parseInt(countRow?.total || '0');
    const rows = await query(
      `SELECT c.dot_number, c.legal_name, c.phy_city, c.phy_state, c.telephone,
              crm.crm_status, crm.notes as crm_notes, crm.is_in_pipeline as in_pipeline,
              (SELECT MAX(call_date) FROM call_logs cl WHERE cl.dot_number=c.dot_number) as last_contact,
              (SELECT COUNT(*) FROM follow_ups fu WHERE fu.dot_number=c.dot_number AND fu.is_completed=false AND fu.due_date >= CURRENT_DATE) as follow_up_count
       FROM carrier_crm crm
       JOIN carriers c ON c.dot_number = crm.dot_number
       ${where}
       ORDER BY c.legal_name ASC
       LIMIT $${i++} OFFSET $${i++}`,
      [...params, limitNum, offset]
    );
    res.json({ carriers: rows, total, page: pageNum, limit: limitNum, total_pages: Math.ceil(total / limitNum) });
  } catch { res.status(500).json({ error: 'Server error' }); }
}

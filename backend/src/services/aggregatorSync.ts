/**
 * Solicitation Aggregator Sync Service
 * Pulls from SAM.gov, USASpending.gov, and other sources.
 */

import { pool, queryOne } from '../db/pool';
import dotenv from 'dotenv';
dotenv.config();

async function getSetting(key: string): Promise<string> {
  const row = await queryOne<{value:string}>(`SELECT value FROM aggregator_settings WHERE key=$1`, [key]);
  return row?.value || '';
}

async function getSettings(): Promise<Record<string, string>> {
  const rows = await pool.query(`SELECT key, value FROM aggregator_settings`);
  const s: Record<string, string> = {};
  for (const r of rows.rows) s[r.key] = r.value;
  return s;
}

function isWosbEligible(setAside: string | null): boolean {
  if (!setAside) return false;
  const s = setAside.toUpperCase();
  return s.includes('WOSB') || s.includes('WOMEN') || s.includes('WO');
}

function isEdwosbEligible(setAside: string | null): boolean {
  if (!setAside) return false;
  const s = setAside.toUpperCase();
  return s.includes('EDWOSB') || s.includes('ECONOMICALLY');
}

// ─── SAM.gov API ──────────────────────────────────────────────────────────────

interface SamOpportunity {
  noticeId?: string;
  title?: string;
  solicitationNumber?: string;
  fullParentPathName?: string;
  postedDate?: string;
  responseDeadLine?: string;
  naicsCode?: string;
  typeOfSetAsideDescription?: string;
  typeOfSetAside?: string;
  pointOfContact?: Array<{email?:string; fullName?:string; phone?:string}>;
  uiLink?: string;
  description?: string;
  baseType?: string;
  archiveDate?: string;
  award?: {amount?:number};
}

async function syncSamGov(settings: Record<string,string>, logId: number): Promise<{new_count:number;updated_count:number}> {
  const apiKey = settings['sam_api_key'] || '';
  if (!apiKey) {
    console.log('[Aggregator] SAM.gov API key not configured, skipping');
    return {new_count:0, updated_count:0};
  }

  const naicsCodes = (settings['naics_codes'] || '488510,484121,484122').split(',').map(s=>s.trim()).filter(Boolean);
  let newCount = 0, updatedCount = 0;

  for (const naics of naicsCodes) {
    let page = 1;
    while (true) {
      try {
        const params = new URLSearchParams({
          api_key: apiKey,
          naicsCode: naics,
          limit: '100',
          offset: String((page-1)*100),
          postedFrom: getDateDaysAgo(30),
          postedTo: getToday(),
        });
        const url = `https://sam.gov/api/prod/opportunities/v2/search?${params}&ptype=o,p,k,r,s,g`;
        if (page === 1) console.log(`[SAM] Trying: https://sam.gov/api/prod/opportunities/v2/search?naicsCode=${naics}&postedFrom=${getDateDaysAgo(30)}&postedTo=${getToday()}`);

        const resp = await fetch(url, { headers: { 'Accept': 'application/json', 'X-Api-Key': apiKey } });
        if (!resp.ok) { const body = await resp.text(); console.error(`SAM API error ${resp.status} for NAICS ${naics}: "${body.slice(0,500)}"`); break; }

        const data = await resp.json() as { opportunitiesData?: SamOpportunity[]; totalRecords?: number };
        const opps = data.opportunitiesData || [];
        if (opps.length === 0) break;

        for (const opp of opps) {
          if (!opp.noticeId) continue;
          const poc = opp.pointOfContact?.[0];
          const setAside = opp.typeOfSetAsideDescription || opp.typeOfSetAside || null;

          const result = await pool.query(
            `INSERT INTO aggregated_solicitations
               (source, external_id, solicitation_number, title, agency_name, naics_code,
                set_aside_type, posted_date, response_due_date,
                contract_value_max, poc_name, poc_email, poc_phone,
                description, original_url, is_wosb_eligible, is_edwosb_eligible, last_updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW())
             ON CONFLICT (source, external_id) DO UPDATE SET
               title=EXCLUDED.title, response_due_date=EXCLUDED.response_due_date,
               is_wosb_eligible=EXCLUDED.is_wosb_eligible,
               is_edwosb_eligible=EXCLUDED.is_edwosb_eligible,
               last_updated_at=NOW()
             RETURNING (xmax = 0) AS inserted`,
            [
              'sam.gov', opp.noticeId,
              opp.solicitationNumber||null, opp.title||null,
              opp.fullParentPathName?.split('::')[0]||null,
              naics, setAside,
              opp.postedDate ? opp.postedDate.split('T')[0] : null,
              opp.responseDeadLine ? opp.responseDeadLine.split('T')[0] : null,
              opp.award?.amount || null,
              poc?.fullName||null, poc?.email||null, poc?.phone||null,
              opp.description?.slice(0,2000)||null,
              opp.uiLink||null,
              isWosbEligible(setAside), isEdwosbEligible(setAside),
            ]
          );
          if (result.rows[0]?.inserted) newCount++; else updatedCount++;

          // Auto-insert Sources Sought notices into sources_sought table
          const isSS = opp.baseType?.toLowerCase().includes('sources sought') ||
                       opp.title?.toLowerCase().includes('sources sought');
          if (isSS && opp.noticeId) {
            await pool.query(
              `INSERT INTO sources_sought
                 (title, agency_name, notice_number, naics_code, date_posted, response_due_date,
                  co_name, co_email, co_phone, outcome, status, source, external_id, original_url, notes)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Identified','From SAM.gov','sam.gov',$10,$11,$12)
               ON CONFLICT (external_id) DO UPDATE SET
                 title=EXCLUDED.title, response_due_date=EXCLUDED.response_due_date,
                 updated_at=NOW()`,
              [
                opp.title||null,
                opp.fullParentPathName?.split('::')[0]||null,
                opp.solicitationNumber||null,
                naics,
                opp.postedDate ? opp.postedDate.split('T')[0] : null,
                opp.responseDeadLine ? opp.responseDeadLine.split('T')[0] : null,
                poc?.fullName||null, poc?.email||null, poc?.phone||null,
                opp.noticeId,
                opp.uiLink||null,
                opp.description?.slice(0,500)||null,
              ]
            ).catch(() => {/* ignore if column doesn't exist yet */});
          }
        }

        if (opps.length < 100) break;
        page++;
      } catch (err) {
        console.error(`SAM.gov sync error for NAICS ${naics}:`, err);
        break;
      }
    }
  }

  await pool.query(`UPDATE aggregator_sync_log SET new_count=new_count+$1, updated_count=updated_count+$2 WHERE id=$3`, [newCount, updatedCount, logId]);
  return {new_count: newCount, updated_count: updatedCount};
}

// ─── USASpending.gov ──────────────────────────────────────────────────────────

async function syncUsaSpending(settings: Record<string,string>): Promise<void> {
  if (settings['usaspending_enabled'] !== 'true') return;
  const naicsCodes = (settings['naics_codes'] || '488510,484121,484122').split(',').map(s=>s.trim()).filter(Boolean);

  for (const naics of naicsCodes) {
    try {
      const body = {
        filters: {
          naics_codes: [naics],
          time_period: [{ start_date: getDateDaysAgo(365), end_date: getToday() }],
        },
        fields: ['Award ID','Recipient Name','Awarding Agency','Awarding Sub Agency','Award Amount','Start Date','End Date','Description','Place of Performance State Code','NAICS Description'],
        page: 1, limit: 100, sort: 'Award Amount', order: 'desc',
      };

      const resp = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) continue;

      const data = await resp.json() as { results?: Record<string,unknown>[] };
      for (const r of (data.results||[])) {
        await pool.query(
          `INSERT INTO usa_spending_awards (award_id,agency_name,sub_agency,recipient_name,naics_code,naics_description,award_amount,start_date,end_date,description,place_of_performance)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (award_id) DO NOTHING`,
          [r['Award ID']||null, r['Awarding Agency']||null, r['Awarding Sub Agency']||null, r['Recipient Name']||null, naics, r['NAICS Description']||null, r['Award Amount']||null, (r['Start Date'] as string)||null, (r['End Date'] as string)||null, (r['Description'] as string)||null, r['Place of Performance State Code']||null]
        ).catch(()=>{/* ignore */});
      }
    } catch (err) {
      console.error(`USASpending sync error for NAICS ${naics}:`, err);
    }
  }
}

// ─── FEMA / DHS Sync ─────────────────────────────────────────────────────────

async function syncFema(settings: Record<string,string>, logId: number): Promise<{new_count:number;updated_count:number}> {
  const apiKey = settings['sam_api_key'] || '';
  if (!apiKey) {
    console.log('[Aggregator] SAM.gov API key not configured, skipping FEMA sync');
    return {new_count:0, updated_count:0};
  }

  let newCount = 0, updatedCount = 0, page = 1;

  while (true) {
    try {
      const params = new URLSearchParams({
        api_key: apiKey,
        subtier: 'FEDERAL EMERGENCY MANAGEMENT AGENCY',
        limit: '100',
        offset: String((page-1)*100),
        postedFrom: getDateDaysAgo(60),
        postedTo: getToday(),
      });
      const url = `https://sam.gov/api/prod/opportunities/v2/search?${params}&ptype=o,p,k,r,s,g`;

      const resp = await fetch(url, { headers: { 'Accept': 'application/json', 'X-Api-Key': apiKey } });
      if (!resp.ok) { const body = await resp.text(); console.error(`FEMA sync API error ${resp.status}:`, body.slice(0,500)); break; }

      const data = await resp.json() as { opportunitiesData?: SamOpportunity[] };
      const opps = data.opportunitiesData || [];
      if (opps.length === 0) break;

      for (const opp of opps) {
        if (!opp.noticeId) continue;
        const poc = opp.pointOfContact?.[0];
        const setAside = opp.typeOfSetAsideDescription || opp.typeOfSetAside || null;

        const result = await pool.query(
          `INSERT INTO aggregated_solicitations
             (source, external_id, solicitation_number, title, agency_name, naics_code,
              set_aside_type, posted_date, response_due_date,
              contract_value_max, poc_name, poc_email, poc_phone,
              description, original_url, is_wosb_eligible, is_edwosb_eligible, last_updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW())
           ON CONFLICT (source, external_id) DO UPDATE SET
             title=EXCLUDED.title, response_due_date=EXCLUDED.response_due_date,
             is_wosb_eligible=EXCLUDED.is_wosb_eligible, is_edwosb_eligible=EXCLUDED.is_edwosb_eligible,
             last_updated_at=NOW()
           RETURNING (xmax = 0) AS inserted`,
          [
            'fema', opp.noticeId,
            opp.solicitationNumber||null, opp.title||null,
            'FEDERAL EMERGENCY MANAGEMENT AGENCY',
            opp.naicsCode||null, setAside,
            opp.postedDate ? opp.postedDate.split('T')[0] : null,
            opp.responseDeadLine ? opp.responseDeadLine.split('T')[0] : null,
            opp.award?.amount||null,
            poc?.fullName||null, poc?.email||null, poc?.phone||null,
            opp.description?.slice(0,2000)||null,
            opp.uiLink||null,
            isWosbEligible(setAside), isEdwosbEligible(setAside),
          ]
        );
        if (result.rows[0]?.inserted) newCount++; else updatedCount++;

          const isSS = opp.baseType?.toLowerCase().includes('sources sought') ||
                       opp.title?.toLowerCase().includes('sources sought');
          if (isSS && opp.noticeId) {
            await pool.query(
              `INSERT INTO sources_sought
                 (title, agency_name, notice_number, naics_code, date_posted, response_due_date,
                  co_name, co_email, co_phone, outcome, status, source, external_id, original_url, notes)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Identified','From FEMA','fema',$10,$11,$12)
               ON CONFLICT (external_id) DO UPDATE SET
                 title=EXCLUDED.title, response_due_date=EXCLUDED.response_due_date, updated_at=NOW()`,
              [
                opp.title||null, 'FEDERAL EMERGENCY MANAGEMENT AGENCY',
                opp.solicitationNumber||null, opp.naicsCode||null,
                opp.postedDate ? opp.postedDate.split('T')[0] : null,
                opp.responseDeadLine ? opp.responseDeadLine.split('T')[0] : null,
                poc?.fullName||null, poc?.email||null, poc?.phone||null,
                opp.noticeId, opp.uiLink||null,
                opp.description?.slice(0,500)||null,
              ]
            ).catch(() => {});
          }
      }

      if (opps.length < 100) break;
      page++;
    } catch (err) {
      console.error('[Aggregator] FEMA sync error:', err);
      break;
    }
  }

  await pool.query(`UPDATE aggregator_sync_log SET new_count=new_count+$1, updated_count=updated_count+$2 WHERE id=$3`, [newCount, updatedCount, logId]);
  return {new_count: newCount, updated_count: updatedCount};
}

// ─── Expire old solicitations ─────────────────────────────────────────────────

async function markExpired(): Promise<void> {
  await pool.query(
    `UPDATE aggregated_solicitations SET status='Expired' WHERE response_due_date < CURRENT_DATE AND status='New'`
  );
}

// ─── Generic SAM.gov Agency Sync ─────────────────────────────────────────────

interface AgencySyncOptions {
  source: string;
  label: string;
  agencyParam: Record<string, string>;
  daysBack: number;
  naicsFilter?: boolean;
  naicsCodes?: string[];
}

async function syncSamGovAgency(
  settings: Record<string,string>,
  logId: number,
  opts: AgencySyncOptions
): Promise<{new_count:number;updated_count:number}> {
  const apiKey = settings['sam_api_key'] || '';
  if (!apiKey) return {new_count:0, updated_count:0};

  let newCount = 0, updatedCount = 0, page = 1;
  const naicsList = opts.naicsFilter
    ? (settings['naics_codes'] || '488510,484121,484122').split(',').map(s=>s.trim()).filter(Boolean)
    : [''];

  for (const naics of naicsList) {
    page = 1;
    while (true) {
      try {
        const paramObj: Record<string,string> = {
          api_key: apiKey,
          limit: '100',
          offset: String((page-1)*100),
          postedFrom: getDateDaysAgo(opts.daysBack),
          postedTo: getToday(),
          ...opts.agencyParam,
        };
        if (naics) paramObj.naicsCode = naics;
        const params = new URLSearchParams(paramObj);
        const url = `https://sam.gov/api/prod/opportunities/v2/search?${params}&ptype=o,p,k,r,s,g`;

        const resp = await fetch(url, { headers: { 'Accept': 'application/json', 'X-Api-Key': apiKey } });
        if (!resp.ok) { const b = await resp.text(); console.error(`[${opts.label}] API error ${resp.status}: ${b.slice(0,200)}`); break; }

        const data = await resp.json() as { opportunitiesData?: SamOpportunity[] };
        const opps = data.opportunitiesData || [];
        if (opps.length === 0) break;

        for (const opp of opps) {
          if (!opp.noticeId) continue;
          const poc = opp.pointOfContact?.[0];
          const setAside = opp.typeOfSetAsideDescription || opp.typeOfSetAside || null;

          const result = await pool.query(
            `INSERT INTO aggregated_solicitations
               (source, external_id, solicitation_number, title, agency_name, naics_code,
                set_aside_type, posted_date, response_due_date, contract_value_max,
                poc_name, poc_email, poc_phone, description, original_url,
                is_wosb_eligible, is_edwosb_eligible, last_updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW())
             ON CONFLICT (source, external_id) DO UPDATE SET
               title=EXCLUDED.title, response_due_date=EXCLUDED.response_due_date,
               is_wosb_eligible=EXCLUDED.is_wosb_eligible, is_edwosb_eligible=EXCLUDED.is_edwosb_eligible,
               last_updated_at=NOW()
             RETURNING (xmax = 0) AS inserted`,
            [
              opts.source, opp.noticeId,
              opp.solicitationNumber||null, opp.title||null,
              opp.fullParentPathName?.split('::')[0]||null,
              opp.naicsCode||naics||null, setAside,
              opp.postedDate ? opp.postedDate.split('T')[0] : null,
              opp.responseDeadLine ? opp.responseDeadLine.split('T')[0] : null,
              opp.award?.amount||null,
              poc?.fullName||null, poc?.email||null, poc?.phone||null,
              opp.description?.slice(0,2000)||null, opp.uiLink||null,
              isWosbEligible(setAside), isEdwosbEligible(setAside),
            ]
          );
          if (result.rows[0]?.inserted) newCount++; else updatedCount++;

          // Auto-track Sources Sought
          const isSS = opp.baseType?.toLowerCase().includes('sources sought') || opp.title?.toLowerCase().includes('sources sought');
          if (isSS) {
            await pool.query(
              `INSERT INTO sources_sought (title,agency_name,notice_number,naics_code,date_posted,response_due_date,co_name,co_email,co_phone,outcome,status,source,external_id,original_url,notes)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Identified',$10,$11,$12,$13,$14)
               ON CONFLICT (external_id) DO UPDATE SET title=EXCLUDED.title, response_due_date=EXCLUDED.response_due_date, updated_at=NOW()`,
              [opp.title||null, opp.fullParentPathName?.split('::')[0]||null, opp.solicitationNumber||null,
               opp.naicsCode||naics||null, opp.postedDate?.split('T')[0]||null, opp.responseDeadLine?.split('T')[0]||null,
               poc?.fullName||null, poc?.email||null, poc?.phone||null,
               `From ${opts.label}`, opts.source, opp.noticeId, opp.uiLink||null, opp.description?.slice(0,500)||null]
            ).catch(()=>{});
          }
        }

        if (opps.length < 100) break;
        page++;
      } catch (err) {
        console.error(`[${opts.label}] sync error:`, err);
        break;
      }
    }
  }

  await pool.query(`UPDATE aggregator_sync_log SET new_count=new_count+$1, updated_count=updated_count+$2 WHERE id=$3`, [newCount, updatedCount, logId]);
  return {new_count: newCount, updated_count: updatedCount};
}

// ─── Grants.gov ───────────────────────────────────────────────────────────────

async function syncGrantsGov(settings: Record<string,string>, logId: number): Promise<{new_count:number;updated_count:number}> {
  const keywords = ['freight transportation', 'logistics', 'trucking', 'motor carrier', 'transportation services'];
  let newCount = 0, updatedCount = 0;

  for (const keyword of keywords) {
    try {
      const resp = await fetch('https://api.grants.gov/v1/api/search2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, rows: 25, startRecordNum: 0, oppStatuses: 'forecasted|posted' }),
      });
      if (!resp.ok) continue;

      const data = await resp.json() as { oppHits?: Array<Record<string,unknown>> };
      for (const g of (data.oppHits || [])) {
        const extId = String(g['id'] || g['number'] || '');
        if (!extId) continue;
        const result = await pool.query(
          `INSERT INTO aggregated_solicitations
             (source, external_id, solicitation_number, title, agency_name,
              posted_date, response_due_date, original_url, description, last_updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
           ON CONFLICT (source, external_id) DO UPDATE SET title=EXCLUDED.title, last_updated_at=NOW()
           RETURNING (xmax = 0) AS inserted`,
          [
            'grants.gov', extId,
            String(g['number']||''), String(g['title']||''),
            String(g['agencyName']||''),
            g['openDate'] ? String(g['openDate']).split('T')[0] : null,
            g['closeDate'] ? String(g['closeDate']).split('T')[0] : null,
            `https://www.grants.gov/search-results-detail/${extId}`,
            String(g['synopsis']||'').slice(0,2000),
          ]
        ).catch(()=>null);
        if (result?.rows[0]?.inserted) newCount++; else updatedCount++;
      }
    } catch (err) { console.error('[Grants.gov] error:', err); }
  }

  await pool.query(`UPDATE aggregator_sync_log SET new_count=new_count+$1, updated_count=updated_count+$2 WHERE id=$3`, [newCount, updatedCount, logId]);
  return {new_count: newCount, updated_count: updatedCount};
}

// ─── Main Sync ────────────────────────────────────────────────────────────────

export async function runAggregatorSync(): Promise<void> {
  const settings = await getSettings();
  const logResult = await pool.query(`INSERT INTO aggregator_sync_log (started_at) VALUES (NOW()) RETURNING id`);
  const logId: number = logResult.rows[0].id;

  console.log('[Aggregator] Starting sync...');
  let totalNew = 0, totalUpdated = 0;

  const log = (label: string, r: {new_count:number;updated_count:number}) => {
    totalNew += r.new_count; totalUpdated += r.updated_count;
    console.log(`[Aggregator] ${label}: ${r.new_count} new, ${r.updated_count} updated`);
  };

  try {
    if (settings['sam_enabled'] === 'true') {
      log('SAM.gov', await syncSamGov(settings, logId));
    }
    if (settings['fema_enabled'] !== 'false') {
      log('FEMA', await syncFema(settings, logId));
    }
    if (settings['dot_enabled'] !== 'false') {
      log('DOT', await syncSamGovAgency(settings, logId, {
        source: 'dot', label: 'DOT',
        agencyParam: { subtier: 'FEDERAL HIGHWAY ADMINISTRATION' },
        daysBack: 45, naicsFilter: false,
      }));
    }
    if (settings['ustranscom_enabled'] !== 'false') {
      log('USTRANSCOM', await syncSamGovAgency(settings, logId, {
        source: 'ustranscom', label: 'USTRANSCOM',
        agencyParam: { subtier: 'UNITED STATES TRANSPORTATION COMMAND' },
        daysBack: 45, naicsFilter: false,
      }));
    }
    if (settings['dla_enabled'] !== 'false') {
      log('DLA', await syncSamGovAgency(settings, logId, {
        source: 'dla', label: 'DLA',
        agencyParam: { subtier: 'DEFENSE LOGISTICS AGENCY' },
        daysBack: 45, naicsFilter: true,
      }));
    }
    if (settings['gsa_enabled'] !== 'false') {
      log('GSA', await syncSamGovAgency(settings, logId, {
        source: 'gsa', label: 'GSA',
        agencyParam: { subtier: 'GENERAL SERVICES ADMINISTRATION' },
        daysBack: 45, naicsFilter: true,
      }));
    }
    if (settings['usps_enabled'] !== 'false') {
      log('USPS', await syncSamGovAgency(settings, logId, {
        source: 'usps', label: 'USPS',
        agencyParam: { subtier: 'POSTAL SERVICE' },
        daysBack: 45, naicsFilter: false,
      }));
    }
    if (settings['grants_enabled'] !== 'false') {
      log('Grants.gov', await syncGrantsGov(settings, logId));
    }
    if (settings['usaspending_enabled'] === 'true') {
      await syncUsaSpending(settings);
      console.log('[Aggregator] USASpending: market intelligence updated');
    }

    await markExpired();

    await pool.query(
      `UPDATE aggregator_sync_log SET completed_at=NOW(), new_count=$1, updated_count=$2, status='completed' WHERE id=$3`,
      [totalNew, totalUpdated, logId]
    );
    console.log(`[Aggregator] Sync complete. New: ${totalNew} | Updated: ${totalUpdated}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await pool.query(`UPDATE aggregator_sync_log SET completed_at=NOW(), status='failed', error_message=$1 WHERE id=$2`, [msg, logId]);
    console.error('[Aggregator] Sync failed:', msg);
  }
}

function getToday(): string {
  const d = new Date();
  return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`;
}

function getDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`;
}

if (require.main === module) {
  runAggregatorSync().then(() => process.exit(0)).catch(() => process.exit(1));
}

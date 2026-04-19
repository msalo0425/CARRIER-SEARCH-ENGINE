/**
 * FMCSA Live Data Sync
 * Pulls carrier data from the Motor Carrier Census dataset (kjg3-diqy)
 * which includes telephone numbers, addresses, and registration dates.
 */

import { pool } from '../db/pool';
import dotenv from 'dotenv';
dotenv.config();

const API_URL = process.env.FMCSA_API_URL || 'https://data.transportation.gov/resource/kjg3-diqy.json';
const API_TOKEN = process.env.FMCSA_API_TOKEN || '';
const PAGE_SIZE = 10000;

interface FmcsaRecord {
  dot_number?: string;
  legal_name?: string;
  dba_name?: string;
  carrier_operation?: string;
  hm_flag?: string;
  pc_flag?: string;
  phy_street?: string;
  phy_city?: string;
  phy_state?: string;
  phy_zip?: string;
  phy_country?: string;
  mailing_street?: string;
  mailing_city?: string;
  mailing_state?: string;
  mailing_zip?: string;
  mailing_country?: string;
  telephone?: string;
  email_address?: string;
  mcs150_date?: string;
  mcs150_mileage?: string;
  add_date?: string;
  oic_state?: string;
  nbr_power_unit?: string;
  driver_total?: string;
  authorized_for_hire?: string;
  exempt_for_hire?: string;
  private_property?: string;
  private_passenger_business?: string;
  private_passenger_nonbusiness?: string;
  migrant?: string;
  us_mail?: string;
  federal_government?: string;
  state_government?: string;
  local_government?: string;
  indian_tribe?: string;
  op_other?: string;
}

function flag(v: string | undefined): boolean {
  if (!v) return false;
  const u = v.toString().toUpperCase().trim();
  return u === 'X' || u === 'Y' || u === '1';
}

function parseDate(v: string | undefined): string | null {
  if (!v) return null;
  const s = String(v).trim();
  try {
    if (/^\d{8}$/.test(s)) {
      return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
    }
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  } catch { return null; }
}

async function fetchPage(offset: number): Promise<FmcsaRecord[]> {
  const headers: Record<string,string> = { 'Accept': 'application/json' };
  if (API_TOKEN) headers['X-App-Token'] = API_TOKEN;
  const url = `${API_URL}?$limit=${PAGE_SIZE}&$offset=${offset}&$order=:id`;

  for (let attempt = 0; attempt < 5; attempt++) {
    const resp = await fetch(url, { headers });
    if (resp.status === 429) {
      const wait = Math.pow(2, attempt + 2) * 1000; // 4s, 8s, 16s, 32s, 64s
      console.log(`\n[FMCSA Sync] Rate limited. Waiting ${wait/1000}s before retry ${attempt+1}/5...`);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    if (!resp.ok) throw new Error(`FMCSA API error ${resp.status}: ${await resp.text()}`);
    const data = await resp.json();
    if (!Array.isArray(data)) {
      console.error('[FMCSA Sync] Unexpected response:', JSON.stringify(data).slice(0, 300));
      throw new Error('FMCSA API returned unexpected format');
    }
    return data as FmcsaRecord[];
  }
  throw new Error('FMCSA API rate limit exceeded after 5 retries');
}

// Only updates fields present in this dataset; preserves safety/cargo data from prior syncs
const UPSERT_SQL = `
  INSERT INTO carriers (
    dot_number, legal_name, dba_name, carrier_operation,
    hm_flag, pc_flag,
    phy_street, phy_city, phy_state, phy_zip, phy_country,
    telephone, operating_status,
    nbr_power_unit, drivers,
    mcs150_date, added_date, oic_state, last_synced_at
  ) VALUES (
    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW()
  )
  ON CONFLICT (dot_number) DO UPDATE SET
    legal_name        = EXCLUDED.legal_name,
    dba_name          = COALESCE(EXCLUDED.dba_name, carriers.dba_name),
    carrier_operation = COALESCE(EXCLUDED.carrier_operation, carriers.carrier_operation),
    hm_flag           = EXCLUDED.hm_flag,
    pc_flag           = EXCLUDED.pc_flag,
    phy_street        = COALESCE(EXCLUDED.phy_street, carriers.phy_street),
    phy_city          = COALESCE(EXCLUDED.phy_city, carriers.phy_city),
    phy_state         = COALESCE(EXCLUDED.phy_state, carriers.phy_state),
    phy_zip           = COALESCE(EXCLUDED.phy_zip, carriers.phy_zip),
    telephone         = COALESCE(EXCLUDED.telephone, carriers.telephone),
    nbr_power_unit    = COALESCE(EXCLUDED.nbr_power_unit, carriers.nbr_power_unit),
    drivers           = COALESCE(EXCLUDED.drivers, carriers.drivers),
    mcs150_date       = COALESCE(EXCLUDED.mcs150_date, carriers.mcs150_date),
    added_date        = COALESCE(EXCLUDED.added_date, carriers.added_date),
    last_synced_at    = NOW(),
    updated_at        = NOW()
`;

function buildRow(rec: FmcsaRecord): unknown[] {
  const isForHire = flag(rec.authorized_for_hire) || flag(rec.exempt_for_hire);
  const opStatus = isForHire ? 'Active' : 'Active';

  return [
    rec.dot_number,
    rec.legal_name || null,
    rec.dba_name || null,
    rec.carrier_operation || null,
    flag(rec.hm_flag),
    flag(rec.pc_flag),
    rec.phy_street || null,
    rec.phy_city || null,
    rec.phy_state || null,
    rec.phy_zip || null,
    rec.phy_country || null,
    rec.telephone || null,
    opStatus,
    rec.nbr_power_unit ? parseInt(rec.nbr_power_unit) : null,
    rec.driver_total ? parseInt(rec.driver_total) : null,
    parseDate(rec.mcs150_date),
    parseDate(rec.add_date),
    rec.oic_state || null,
  ];
}

export async function runFmcsaSync(options?: { limit?: number }): Promise<void> {
  const logRow = await pool.query(`INSERT INTO sync_log (started_at) VALUES (NOW()) RETURNING id`);
  const logId: number = logRow.rows[0].id;

  let offset = 0;
  let totalFetched = 0;
  let totalUpserted = 0;

  console.log('[FMCSA Sync] Starting carrier data sync from Motor Carrier Census...');

  try {
    while (true) {
      const records = await fetchPage(offset);
      if (records.length === 0) break;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const rec of records) {
          if (!rec.dot_number) continue;
          await client.query(UPSERT_SQL, buildRow(rec));
          totalUpserted++;
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      totalFetched += records.length;
      offset += PAGE_SIZE;
      process.stdout.write(`\r[FMCSA Sync] Fetched: ${totalFetched.toLocaleString()} | Upserted: ${totalUpserted.toLocaleString()}`);

      if (options?.limit && totalFetched >= options.limit) break;
      if (records.length < PAGE_SIZE) break;
    }

    await pool.query(
      `UPDATE sync_log SET completed_at=NOW(), records_fetched=$1, records_upserted=$2, status='completed' WHERE id=$3`,
      [totalFetched, totalUpserted, logId]
    );
    console.log(`\n[FMCSA Sync] Completed. Fetched: ${totalFetched} | Upserted: ${totalUpserted}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await pool.query(`UPDATE sync_log SET completed_at=NOW(), status='failed', error_message=$1 WHERE id=$2`, [msg, logId]);
    console.error('\n[FMCSA Sync] Failed:', msg);
    throw err;
  }
}

export async function ensureSearchVector(): Promise<void> {
  try {
    await pool.query(`
      ALTER TABLE carriers ADD COLUMN IF NOT EXISTS
        search_vector tsvector GENERATED ALWAYS AS (
          to_tsvector('english',
            coalesce(legal_name,'') || ' ' ||
            coalesce(dba_name,'') || ' ' ||
            coalesce(dot_number,'') || ' ' ||
            coalesce(mc_number,'') || ' ' ||
            coalesce(phy_city,'')
          )
        ) STORED
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_carriers_sv ON carriers USING GIN(search_vector)`);
  } catch { /* already exists or not supported */ }
}

if (require.main === module) {
  runFmcsaSync().then(() => process.exit(0)).catch(() => process.exit(1));
}

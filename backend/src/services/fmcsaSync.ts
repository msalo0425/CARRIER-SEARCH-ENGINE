/**
 * FMCSA Live Data Sync
 * Pulls carrier data from data.transportation.gov (Socrata API)
 * and upserts into PostgreSQL carriers table.
 */

import { pool, query } from '../db/pool';
import dotenv from 'dotenv';
dotenv.config();

const API_URL = process.env.FMCSA_API_URL || 'https://data.transportation.gov/resource/az4n-8mr2.json';
const API_TOKEN = process.env.FMCSA_API_TOKEN || '';
const PAGE_SIZE = 10000;

interface FmcsaRecord {
  dot_number?: string;
  legal_name?: string;
  dba_name?: string;
  phy_street?: string;
  phy_city?: string;
  phy_state?: string;
  phy_zip?: string;
  phy_country?: string;
  telephone?: string;
  fax?: string;
  mailing_street?: string;
  mailing_city?: string;
  mailing_state?: string;
  mailing_zip?: string;
  mc_mx_ff_number?: string;
  entity_type?: string;
  carrier_operation?: string;
  nbr_power_unit?: string;
  driver_total?: string;
  safety_rating?: string;
  safety_rtg_date?: string;
  safety_review_date?: string;
  safety_review_type?: string;
  mcs150_date?: string;
  add_date?: string;
  oic_state?: string;
  record_status?: string;
  out_of_service_date?: string;
  // Operating authority flags
  bi_flag?: string;
  ci_flag?: string;
  cf_flag?: string;
  hm_flag?: string;
  pc_flag?: string;
  // Cargo flags
  cargo_general_freight_flag?: string;
  cargo_household_goods_flag?: string;
  cargo_metal_sheets_flag?: string;
  cargo_motor_vehicles_flag?: string;
  cargo_drive_away_flag?: string;
  cargo_logs_poles_flag?: string;
  cargo_building_materials_flag?: string;
  cargo_mobile_homes_flag?: string;
  cargo_machinery_lgpieces_flag?: string;
  cargo_fresh_produce_flag?: string;
  cargo_liquids_gases_flag?: string;
  cargo_intermodal_flag?: string;
  cargo_passengers_flag?: string;
  cargo_oilfield_equip_flag?: string;
  cargo_livestock_flag?: string;
  cargo_grain_feed_hay_flag?: string;
  cargo_coal_coke_flag?: string;
  cargo_meat_flag?: string;
  cargo_garbage_refuse_flag?: string;
  cargo_us_mail_flag?: string;
  cargo_chemicals_flag?: string;
  cargo_commodities_drybulk_flag?: string;
  cargo_refrigerated_food_flag?: string;
  cargo_beverages_flag?: string;
  cargo_paper_products_flag?: string;
  cargo_utilities_flag?: string;
  cargo_agric_prod_flag?: string;
  cargo_construction_flag?: string;
  cargo_water_well_flag?: string;
  cargo_other_flag?: string;
  // Insurance
  insurance_required?: string;
  bipd_required?: string;
  bipd_on_file?: string;
  cargo_required?: string;
  cargo_on_file?: string;
  bond_insurance_required?: string;
  bond_insurance_on_file?: string;
}

function flag(v: string | undefined): boolean {
  return v?.toUpperCase() === 'X' || v?.toUpperCase() === 'Y' || v === '1';
}

function parseDate(v: string | undefined): string | null {
  if (!v) return null;
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  } catch { return null; }
}

function deriveStatus(rec: FmcsaRecord): string {
  if (rec.out_of_service_date) return 'Out of Service';
  const s = (rec.record_status || '').toUpperCase();
  if (s === 'I' || s === 'N') return 'Inactive';
  return 'Active';
}

function deriveMcNumber(mcMxFf: string | undefined): string | null {
  if (!mcMxFf) return null;
  const m = mcMxFf.match(/MC-?(\d+)/i);
  return m ? m[1] : null;
}

async function fetchPage(offset: number): Promise<FmcsaRecord[]> {
  const headers: Record<string,string> = { 'Accept': 'application/json' };
  if (API_TOKEN) headers['X-App-Token'] = API_TOKEN;

  const url = `${API_URL}?$limit=${PAGE_SIZE}&$offset=${offset}&$order=dot_number`;
  const resp = await fetch(url, { headers });

  if (!resp.ok) throw new Error(`FMCSA API error ${resp.status}: ${await resp.text()}`);
  return resp.json() as Promise<FmcsaRecord[]>;
}

const UPSERT_SQL = `
  INSERT INTO carriers (
    dot_number, mc_mx_ff_number, mc_number, legal_name, dba_name,
    phy_street, phy_city, phy_state, phy_zip, phy_country,
    telephone, fax, entity_type, carrier_operation,
    op_carrier_flag, op_broker_flag, op_freight_forwarder_flag,
    hm_flag, pc_flag,
    record_status, out_of_service_date, operating_status,
    nbr_power_unit, drivers,
    safety_rating, safety_rating_date, safety_review_date, safety_review_type,
    insurance_on_file, bipd_insurance_on_file, cargo_insurance_on_file, bond_insurance_on_file,
    cargo_general_freight, cargo_household_goods, cargo_metal_sheets, cargo_motor_vehicles,
    cargo_drive_away, cargo_logs_poles, cargo_building_materials, cargo_mobile_homes,
    cargo_machinery_equipment, cargo_fresh_produce, cargo_liquids_gases, cargo_intermodal,
    cargo_passengers, cargo_oilfield_equipment, cargo_livestock, cargo_grain, cargo_coal,
    cargo_meat, cargo_garbage_refuse, cargo_us_mail, cargo_chemicals,
    cargo_commodities_dry_bulk, cargo_refrigerated, cargo_beverages, cargo_paper_products,
    cargo_utilities, cargo_agriculture_products, cargo_construction, cargo_water_well, cargo_other,
    mcs150_date, added_date, oic_state, last_synced_at
  ) VALUES (
    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
    $20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,
    $37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49,$50,$51,$52,$53,
    $54,$55,$56,$57,$58,$59,$60,$61,$62,$63,$64,NOW()
  )
  ON CONFLICT (dot_number) DO UPDATE SET
    mc_mx_ff_number=EXCLUDED.mc_mx_ff_number, mc_number=EXCLUDED.mc_number,
    legal_name=EXCLUDED.legal_name, dba_name=EXCLUDED.dba_name,
    phy_street=EXCLUDED.phy_street, phy_city=EXCLUDED.phy_city,
    phy_state=EXCLUDED.phy_state, phy_zip=EXCLUDED.phy_zip,
    telephone=EXCLUDED.telephone, entity_type=EXCLUDED.entity_type,
    carrier_operation=EXCLUDED.carrier_operation,
    op_carrier_flag=EXCLUDED.op_carrier_flag, op_broker_flag=EXCLUDED.op_broker_flag,
    hm_flag=EXCLUDED.hm_flag, pc_flag=EXCLUDED.pc_flag,
    record_status=EXCLUDED.record_status, out_of_service_date=EXCLUDED.out_of_service_date,
    operating_status=EXCLUDED.operating_status,
    nbr_power_unit=EXCLUDED.nbr_power_unit, drivers=EXCLUDED.drivers,
    safety_rating=EXCLUDED.safety_rating, safety_rating_date=EXCLUDED.safety_rating_date,
    insurance_on_file=EXCLUDED.insurance_on_file, bipd_insurance_on_file=EXCLUDED.bipd_insurance_on_file,
    cargo_insurance_on_file=EXCLUDED.cargo_insurance_on_file,
    cargo_general_freight=EXCLUDED.cargo_general_freight,
    cargo_refrigerated=EXCLUDED.cargo_refrigerated,
    cargo_household_goods=EXCLUDED.cargo_household_goods,
    cargo_livestock=EXCLUDED.cargo_livestock,
    cargo_chemicals=EXCLUDED.cargo_chemicals,
    last_synced_at=NOW(), updated_at=NOW()
`;

function buildRow(rec: FmcsaRecord): unknown[] {
  return [
    rec.dot_number, rec.mc_mx_ff_number||null, deriveMcNumber(rec.mc_mx_ff_number),
    rec.legal_name||null, rec.dba_name||null,
    rec.phy_street||null, rec.phy_city||null, rec.phy_state||null, rec.phy_zip||null, rec.phy_country||null,
    rec.telephone||null, rec.fax||null,
    rec.entity_type||null, rec.carrier_operation||null,
    flag(rec.bi_flag), flag(rec.bi_flag), flag(rec.cf_flag),
    flag(rec.hm_flag), flag(rec.pc_flag),
    rec.record_status||null, parseDate(rec.out_of_service_date), deriveStatus(rec),
    rec.nbr_power_unit ? parseInt(rec.nbr_power_unit) : null,
    rec.driver_total ? parseInt(rec.driver_total) : null,
    rec.safety_rating||null, parseDate(rec.safety_rtg_date), parseDate(rec.safety_review_date), rec.safety_review_type||null,
    flag(rec.insurance_required), flag(rec.bipd_on_file), flag(rec.cargo_on_file), flag(rec.bond_insurance_on_file),
    flag(rec.cargo_general_freight_flag), flag(rec.cargo_household_goods_flag), flag(rec.cargo_metal_sheets_flag),
    flag(rec.cargo_motor_vehicles_flag), flag(rec.cargo_drive_away_flag), flag(rec.cargo_logs_poles_flag),
    flag(rec.cargo_building_materials_flag), flag(rec.cargo_mobile_homes_flag), flag(rec.cargo_machinery_lgpieces_flag),
    flag(rec.cargo_fresh_produce_flag), flag(rec.cargo_liquids_gases_flag), flag(rec.cargo_intermodal_flag),
    flag(rec.cargo_passengers_flag), flag(rec.cargo_oilfield_equip_flag), flag(rec.cargo_livestock_flag),
    flag(rec.cargo_grain_feed_hay_flag), flag(rec.cargo_coal_coke_flag), flag(rec.cargo_meat_flag),
    flag(rec.cargo_garbage_refuse_flag), flag(rec.cargo_us_mail_flag), flag(rec.cargo_chemicals_flag),
    flag(rec.cargo_commodities_drybulk_flag), flag(rec.cargo_refrigerated_food_flag), flag(rec.cargo_beverages_flag),
    flag(rec.cargo_paper_products_flag), flag(rec.cargo_utilities_flag), flag(rec.cargo_agric_prod_flag),
    flag(rec.cargo_construction_flag), flag(rec.cargo_water_well_flag), flag(rec.cargo_other_flag),
    parseDate(rec.mcs150_date), parseDate(rec.add_date), rec.oic_state||null,
  ];
}

export async function runFmcsaSync(options?: { limit?: number }): Promise<void> {
  const logRow = await pool.query(`INSERT INTO sync_log (started_at) VALUES (NOW()) RETURNING id`);
  const logId: number = logRow.rows[0].id;

  let offset = 0;
  let totalFetched = 0;
  let totalUpserted = 0;

  console.log('[FMCSA Sync] Starting carrier data sync...');

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

    // Rebuild FTS search vectors
    console.log('\n[FMCSA Sync] Updating search vectors...');
    await pool.query(`
      UPDATE carriers SET search_vector =
        to_tsvector('english',
          coalesce(legal_name,'') || ' ' ||
          coalesce(dba_name,'') || ' ' ||
          coalesce(dot_number,'') || ' ' ||
          coalesce(mc_number,'') || ' ' ||
          coalesce(phy_city,'')
        )
      WHERE search_vector IS NULL OR updated_at > NOW() - INTERVAL '1 day'
    `);

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

// Add search_vector column if it doesn't exist
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
  } catch {
    // Column may already exist or generated columns not supported in this PG version
    // Fall back to regular text search
  }
}

// CLI entry point
if (require.main === module) {
  runFmcsaSync().then(() => process.exit(0)).catch(() => process.exit(1));
}

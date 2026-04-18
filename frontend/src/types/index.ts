export interface User { id: number; email: string; full_name: string | null; role: string; is_active: boolean; last_login: string | null; created_at: string; }

export interface Carrier {
  id: number; dot_number: string; mc_mx_ff_number: string | null; mc_number: string | null;
  legal_name: string | null; dba_name: string | null;
  phy_street: string | null; phy_city: string | null; phy_state: string | null; phy_zip: string | null; phy_country: string | null;
  telephone: string | null; fax: string | null; email_address: string | null;
  entity_type: string | null; carrier_operation: string | null;
  op_carrier_flag: boolean; op_broker_flag: boolean; op_freight_forwarder_flag: boolean;
  hm_flag: boolean; pc_flag: boolean;
  record_status: string | null; out_of_service_date: string | null; operating_status: string | null;
  nbr_power_unit: number | null; drivers: number | null;
  safety_rating: string | null; safety_rating_date: string | null;
  insurance_on_file: boolean; bipd_insurance_on_file: boolean; cargo_insurance_on_file: boolean;
  cargo_general_freight: boolean; cargo_household_goods: boolean; cargo_metal_sheets: boolean;
  cargo_motor_vehicles: boolean; cargo_drive_away: boolean; cargo_logs_poles: boolean;
  cargo_building_materials: boolean; cargo_mobile_homes: boolean; cargo_machinery_equipment: boolean;
  cargo_fresh_produce: boolean; cargo_liquids_gases: boolean; cargo_intermodal: boolean;
  cargo_passengers: boolean; cargo_oilfield_equipment: boolean; cargo_livestock: boolean;
  cargo_grain: boolean; cargo_coal: boolean; cargo_meat: boolean;
  cargo_garbage_refuse: boolean; cargo_us_mail: boolean; cargo_chemicals: boolean;
  cargo_commodities_dry_bulk: boolean; cargo_refrigerated: boolean; cargo_beverages: boolean;
  cargo_paper_products: boolean; cargo_utilities: boolean; cargo_agriculture_products: boolean;
  cargo_construction: boolean; cargo_water_well: boolean; cargo_other: boolean;
  mcs150_date: string | null; added_date: string | null; oic_state: string | null;
  last_synced_at: string; created_at: string; updated_at: string;
  crm_status: string | null; is_in_pipeline: boolean | null; is_contacted: boolean | null;
  do_not_call: boolean | null; crm_notes: string | null; pipeline_contract: string | null;
}

export interface CarrierSearchResult { carriers: Carrier[]; total: number; page: number; limit: number; total_pages: number; }

export interface CallLog { id: number; dot_number: string; user_id: number; user_name: string | null; call_date: string; call_time: string | null; outcome: string; notes: string | null; duration_minutes: number | null; contact_name: string | null; contact_title: string | null; callback_date: string | null; callback_time: string | null; created_at: string; }

export interface FollowUp { id: number; dot_number: string; user_id: number; user_name: string | null; due_date: string; due_time: string | null; notes: string | null; title: string | null; is_completed: boolean; completed_at: string | null; created_at: string; carrier_name?: string; telephone?: string; }

export interface Proposal { id: number; contract_name: string; solicitation_number: string | null; agency: string | null; naics_code: string | null; set_aside_type: string | null; contract_value: number | null; proposal_due_date: string | null; submitted_date: string | null; status: string; status_updated_at: string; team_members: string[]; notes: string | null; win_loss: string | null; doc_technical_approach: boolean; doc_past_performance: boolean; doc_pricing: boolean; doc_capability_statement: boolean; doc_certifications: boolean; doc_teaming_agreements: boolean; created_at: string; updated_at: string; pending_quotes?: number; period_of_performance?: string | null; place_of_performance?: string | null; created_by?: number | null; }

export interface SubQuote { id: number; proposal_id: number; company_name: string; contact_name: string | null; contact_phone: string | null; quote_requested_date: string | null; quote_due_date: string | null; quote_received: boolean; quote_amount: number | null; status?: string; naics_code?: string; notes: string | null; }

export interface Opportunity { id: number; title: string; solicitation_number: string | null; agency_name: string | null; naics_code: string | null; set_aside_type: string | null; posted_date: string | null; response_due_date: string | null; contract_value_estimate: number | null; status: string; poc_name: string | null; poc_email: string | null; poc_phone: string | null; sam_gov_link: string | null; notes: string | null; created_at: string; }

export interface Agency { id: number; agency_name: string; department: string | null; sb_contact_name: string | null; sb_contact_email: string | null; sb_contact_phone: string | null; co_name: string | null; co_email: string | null; co_phone: string | null; last_contact_date: string | null; next_follow_up_date: string | null; relationship_status: string; cap_statement_sent: boolean; notes: string | null; }

export interface Certification { id: number; name: string; cert_type: string | null; status: string; issued_date: string | null; expiration_date: string | null; renewal_reminder_days: number; days_until_expiry: number | null; notes: string | null; }

export interface AggregatedSolicitation { id: number; source: string; solicitation_number: string | null; title: string | null; agency_name: string | null; naics_code: string | null; set_aside_type: string | null; posted_date: string | null; response_due_date: string | null; contract_value_min: number | null; contract_value_max: number | null; poc_name: string | null; poc_email: string | null; original_url: string | null; status: string; proposal_id: number | null; is_wosb_eligible: boolean; is_edwosb_eligible: boolean; first_seen_at: string; days_until_due: number | null; is_new_today: boolean; }

export const PROPOSAL_STATUSES = ['Opportunity Identified','Reviewing Solicitation','Go or No Go Decision','Proposal In Progress','Waiting on Sub Quote','Waiting on Teaming Partner','Internal Review','Final Revisions','Submitted','Under Evaluation','Awarded','Not Awarded','Debriefing Requested','No Bid','Cancelled'] as const;

export const CRM_STATUSES = ['New','Contacted','In Negotiation','Subcontractor Added','Do Not Call'] as const;

export const CALL_OUTCOMES = ['No Answer','Left Voicemail','Spoke with Decision Maker','Not Interested','Interested','Call Back Requested','Wrong Number','Disconnected'] as const;

export const CARGO_TYPES: Record<string, string> = {
  cargo_general_freight: 'General Freight', cargo_household_goods: 'Household Goods',
  cargo_metal_sheets: 'Metal/Sheets', cargo_motor_vehicles: 'Motor Vehicles',
  cargo_drive_away: 'Drive Away', cargo_logs_poles: 'Logs/Poles',
  cargo_building_materials: 'Building Materials', cargo_mobile_homes: 'Mobile Homes',
  cargo_machinery_equipment: 'Machinery/Equipment', cargo_fresh_produce: 'Fresh Produce',
  cargo_liquids_gases: 'Liquids/Gases', cargo_intermodal: 'Intermodal',
  cargo_passengers: 'Passengers', cargo_oilfield_equipment: 'Oilfield Equipment',
  cargo_livestock: 'Livestock', cargo_grain: 'Grain/Feed/Hay',
  cargo_coal: 'Coal/Coke', cargo_meat: 'Meat',
  cargo_garbage_refuse: 'Garbage/Refuse', cargo_us_mail: 'U.S. Mail',
  cargo_chemicals: 'Chemicals', cargo_commodities_dry_bulk: 'Dry Bulk',
  cargo_refrigerated: 'Refrigerated (Reefer)', cargo_beverages: 'Beverages',
  cargo_paper_products: 'Paper Products', cargo_utilities: 'Utilities',
  cargo_agriculture_products: 'Agriculture/Farm', cargo_construction: 'Construction',
  cargo_water_well: 'Water Well', cargo_other: 'Other',
};

export const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

export const COMMON_AGENCIES = ['Department of Defense (DOD)','Defense Logistics Agency (DLA)','Department of Homeland Security (DHS)','Federal Emergency Management Agency (FEMA)','General Services Administration (GSA)','Department of Transportation (DOT)','Department of Veterans Affairs (VA)','Department of Health and Human Services (HHS)','Army Corps of Engineers (USACE)','Department of the Navy','Department of the Army','Department of the Air Force','United States Postal Service (USPS)','NASA','Department of Energy (DOE)','Department of Justice (DOJ)','Department of State','Department of the Interior','Department of Agriculture (USDA)','Department of Commerce'];

export const NAICS_CODES = [
  { code: '488510', label: '488510 — Freight Transportation Arrangement' },
  { code: '541614', label: '541614 — Process/Physical Distribution Consulting' },
  { code: '484121', label: '484121 — General Freight Trucking, Long-Distance TL' },
  { code: '484122', label: '484122 — General Freight Trucking, Long-Distance LTL' },
  { code: '484110', label: '484110 — General Freight Trucking, Local' },
  { code: '492110', label: '492110 — Couriers and Express Delivery' },
];

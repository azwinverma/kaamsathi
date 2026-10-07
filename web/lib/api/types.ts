/**
 * Types mirroring docs/CONTRACT.md. Money = decimal strings ("19550.00").
 * Dates = AD ISO "YYYY-MM-DD", each accompanied by `<field>_bs`.
 */

export type UUID = string;
export type Money = string;
export type ISODate = string;
export type ISODateTime = string;

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode | string;
    message: string;
    fields?: Record<string, string[]>;
  };
}

export type ApiErrorCode =
  | "validation_error"
  | "not_authenticated"
  | "permission_denied"
  | "org_forbidden"
  | "not_found"
  | "otp_invalid"
  | "otp_expired"
  | "otp_rate_limited"
  | "below_minimum_wage"
  | "invalid_state"
  | "outside_geofence"
  | "duplicate"
  | "network_error"
  | "server_error";

// ---------------------------------------------------------------- enums
export type Role = "owner" | "admin" | "hr" | "supervisor";
export type Industry =
  | "hospitality"
  | "healthcare"
  | "security"
  | "construction"
  | "manufacturing"
  | "retail"
  | "other";
export type Gender = "male" | "female" | "other";
export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";
export type PaymentMethod = "bank" | "esewa" | "khalti" | "cash";
export type NstbLevel = "none" | "elementary" | "level1" | "level2" | "level3";
export type TradeCategory =
  | "construction"
  | "hospitality"
  | "security"
  | "healthcare"
  | "manufacturing"
  | "transport"
  | "general";
export type WageType = "monthly" | "daily";
export type JobStatus = "draft" | "open" | "filled" | "closed";
export type Stage =
  | "sourced"
  | "shortlisted"
  | "interview"
  | "selected"
  | "joined"
  | "rejected"
  | "dropped";
export type EmploymentStatus = "active" | "ended";
export type EndReason = "resigned" | "terminated" | "contract_end" | "absconded" | "other";
export type AttendanceStatus =
  | "present"
  | "absent"
  | "half_day"
  | "leave"
  | "holiday"
  | "weekly_off";
export type AttendanceMethod = "qr" | "manual" | "supervisor" | "self";
export type RegisterCell = "P" | "A" | "H" | "L" | "PH" | "WO" | null;
export type LeaveType = "home" | "sick" | "maternity" | "paternity" | "mourning" | "unpaid";
export type LeaveStatus = "pending" | "approved" | "rejected";
export type PayrollStatus = "draft" | "approved" | "paid";
export type PaymentStatus = "pending" | "paid";
export type Plan = "pilot" | "standard";
export type ChargeKind = "placement" | "subscription";
export type ChargeStatus = "unpaid" | "paid" | "waived";

// ---------------------------------------------------------------- reference
export interface Province {
  code: number;
  name_en: string;
  name_ne: string;
}
export interface District {
  code: string;
  name_en: string;
  name_ne: string;
  province: number;
}
export interface DistrictRef {
  code: string;
  name_en: string;
  name_ne: string;
}
export interface Trade {
  code: string;
  name_en: string;
  name_ne: string;
  category: TradeCategory;
}
export interface TradeRef {
  code: string;
  name_en: string;
  name_ne: string;
}
export interface MinimumWage {
  effective_from: ISODate;
  effective_from_bs: string;
  monthly_basic: Money;
  monthly_da: Money;
  monthly_total: Money;
  daily: Money;
  hourly: Money;
  hourly_part_time: Money;
}
export interface CalendarDay {
  ad: ISODate;
  bs: string;
  bs_year: number;
  bs_month: number;
  bs_day: number;
  bs_month_name_en: string;
  bs_month_name_ne: string;
  formatted_en: string;
  formatted_ne: string;
  fiscal_year: string;
}
export interface CalendarMonth {
  bs_year: number;
  bs_month: number;
  name_en: string;
  name_ne: string;
  start_ad: ISODate;
  end_ad: ISODate;
  days: number;
  days_list: { ad: ISODate; bs_day: number; weekday: number }[];
}

// ---------------------------------------------------------------- auth
export interface MembershipOrg {
  id: UUID;
  name: string;
  logo: string | null;
  industry: Industry;
}
export interface Membership {
  id: UUID;
  role: Role;
  organization: MembershipOrg;
  site_ids: UUID[];
}
export interface Me {
  id: UUID;
  phone: string;
  full_name: string;
  email: string | null;
  preferred_language: "en" | "ne";
  is_staff: boolean;
  worker_id: UUID | null;
  memberships: Membership[];
}
export interface OtpRequestResponse {
  sent: boolean;
  expires_in: number;
  dev_code?: string;
}

// ---------------------------------------------------------------- org
export interface Organization {
  id: UUID;
  name: string;
  name_ne: string | null;
  pan_no: string | null;
  vat_registered: boolean;
  ssf_employer_no: string | null;
  industry: Industry;
  district: string | DistrictRef;
  municipality: string | null;
  ward: number | null;
  address: string;
  phone: string;
  email: string | null;
  logo: string | null;
  plan: Plan;
  weekly_off_day: number;
  created_at: ISODateTime;
  is_active: boolean;
}
export interface OrganizationCreate {
  name: string;
  pan_no?: string;
  industry: Industry;
  district: string;
  municipality?: string;
  ward?: number | null;
  address: string;
  phone: string;
  email?: string;
}

export interface Dashboard {
  today: ISODate;
  today_bs: string;
  active_workers: number;
  present_today: number;
  absent_today: number;
  on_leave_today: number;
  not_marked_today: number;
  open_jobs: number;
  pipeline: { sourced: number; shortlisted: number; interview: number; selected: number };
  hires_30d: number;
  attrition_30d: number;
  last_payroll: {
    id: UUID;
    bs_year: number;
    bs_month: number;
    net_total: Money;
    status: PayrollStatus;
  } | null;
  attendance_14d: { date: ISODate; date_bs: string; present: number; absent: number; leave: number }[];
  wage_bill_month_estimate: Money;
}

export interface Member {
  id: UUID;
  role: Role;
  is_active: boolean;
  created_at: ISODateTime;
  site_ids: UUID[];
  user: { id: UUID; phone: string; full_name: string };
}
export interface MemberCreate {
  phone: string;
  full_name: string;
  role: Role;
  site_ids?: UUID[];
}

export interface Site {
  id: UUID;
  name: string;
  address: string;
  district: string | DistrictRef | null;
  lat: string | number | null;
  lng: string | number | null;
  geofence_radius_m: number;
  qr_token: UUID;
  is_active: boolean;
}
export interface SiteInput {
  name: string;
  address: string;
  district?: string | null;
  lat?: number | null;
  lng?: number | null;
  geofence_radius_m?: number;
  is_active?: boolean;
}
export interface Shift {
  id: UUID;
  name: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
}
export type ShiftInput = Omit<Shift, "id">;

// ---------------------------------------------------------------- workers
export interface WorkerSkill {
  trade: TradeRef | string;
  years_experience: number;
  nstb_level: NstbLevel;
  certificate_no?: string | null;
}
export interface WorkerCard {
  id: UUID;
  full_name: string;
  phone_masked: string;
  photo: string | null;
  verification_status: VerificationStatus;
  district: DistrictRef | null;
  skills: WorkerSkill[];
  total_experience_years: number;
  rating_avg: number | null;
  placements_count: number;
}
export interface WorkHistoryItem {
  organization_name: string;
  trade: TradeRef | string | null;
  start_date: ISODate;
  start_date_bs?: string;
  end_date: ISODate | null;
  end_date_bs?: string | null;
  months: number;
  rating: number | null;
}
export interface WorkerProfile extends WorkerCard {
  phone: string;
  gender: Gender;
  date_of_birth: ISODate | null;
  address: string | null;
  history: WorkHistoryItem[];
}

/** Full worker record (ops console). */
export interface Worker {
  id: UUID;
  full_name: string;
  full_name_ne: string | null;
  phone: string;
  gender: Gender;
  date_of_birth: ISODate | null;
  permanent_district: DistrictRef | string | null;
  current_district: DistrictRef | string | null;
  address: string | null;
  citizenship_no: string | null;
  nid_no: string | null;
  id_front: string | null;
  id_back: string | null;
  photo: string | null;
  verification_status: VerificationStatus;
  verified_at: ISODateTime | null;
  verification_note: string | null;
  expected_monthly_wage: Money | null;
  is_available: boolean;
  available_from: ISODate | null;
  payment_method: PaymentMethod;
  bank_name: string | null;
  bank_account_no: string | null;
  bank_account_name: string | null;
  wallet_id: string | null;
  ssf_id: string | null;
  notes: string | null;
  skills: WorkerSkill[];
  created_at: ISODateTime;
  updated_at: ISODateTime;
}
export interface WorkerInput {
  full_name: string;
  full_name_ne?: string;
  phone: string;
  gender: Gender;
  date_of_birth?: ISODate | null;
  current_district?: string | null;
  permanent_district?: string | null;
  address?: string;
  citizenship_no?: string;
  expected_monthly_wage?: string | null;
  is_available?: boolean;
  payment_method?: PaymentMethod;
  skills?: { trade: string; years_experience: number; nstb_level: NstbLevel }[];
  notes?: string;
}

// ---------------------------------------------------------------- hiring
export type StageCounts = Record<Stage, number>;
export interface Job {
  id: UUID;
  title: string;
  description: string;
  trade: TradeRef;
  site: { id: UUID; name: string } | null;
  openings_count: number;
  wage_type: WageType;
  wage_amount: Money;
  shift: UUID | { id: UUID; name: string } | null;
  food_provided: boolean;
  accommodation_provided: boolean;
  start_date: ISODate;
  start_date_bs?: string;
  min_experience_years: number;
  status: JobStatus;
  status_label?: string;
  created_at: ISODateTime;
  published_at: ISODateTime | null;
  first_shortlist_at?: ISODateTime | null;
  counts: StageCounts;
}
export interface JobInput {
  title: string;
  description?: string;
  trade: string;
  site?: UUID | null;
  site_id?: UUID | null;
  openings_count: number;
  wage_type: WageType;
  wage_amount: string;
  shift?: UUID | null;
  food_provided: boolean;
  accommodation_provided: boolean;
  start_date: ISODate;
  min_experience_years: number;
}

export interface StageEvent {
  id?: UUID;
  from_stage: Stage | null;
  to_stage: Stage;
  by: { id: UUID; full_name: string } | string | null;
  note: string | null;
  created_at: ISODateTime;
}
export interface Application {
  id: UUID;
  job: { id: UUID; title: string };
  worker: WorkerCard;
  stage: Stage;
  stage_label?: string;
  interview_at: ISODateTime | null;
  notes: string | null;
  rejection_reason: string | null;
  created_at: ISODateTime;
  stage_changed_at: ISODateTime;
}
export interface ApplicationDetail extends Omit<Application, "worker"> {
  worker: WorkerProfile | WorkerCard;
  events: StageEvent[];
}
export interface EmploymentTermsInput {
  start_date: ISODate;
  site_id?: UUID | null;
  designation?: string;
  wage_type: WageType;
  basic_salary?: string | null;
  dearness_allowance?: string | null;
  daily_wage?: string | null;
  ssf_enrolled: boolean;
}
export interface MoveInput {
  stage: Stage;
  interview_at?: ISODateTime;
  note?: string;
  rejection_reason?: string;
  employment?: EmploymentTermsInput;
}

// ---------------------------------------------------------------- workforce
export interface Employment {
  id: UUID;
  worker: WorkerCard;
  site: { id: UUID; name: string } | null;
  trade: TradeRef | null;
  designation: string;
  employee_code: string | null;
  start_date: ISODate;
  start_date_bs: string;
  end_date: ISODate | null;
  end_date_bs: string | null;
  status: EmploymentStatus;
  end_reason?: EndReason | null;
  wage_type: WageType;
  basic_salary: Money | null;
  dearness_allowance: Money | null;
  other_allowance: Money;
  daily_wage: Money | null;
  monthly_gross: Money | null;
  ssf_enrolled: boolean;
  supervisor: { id: UUID; full_name: string } | UUID | null;
  shift?: UUID | null;
  replacement_eligible_until: ISODate | null;
}
export interface EmploymentCreate {
  worker?: {
    phone: string;
    full_name: string;
    gender?: Gender;
    citizenship_no?: string;
  };
  worker_id?: UUID;
  site_id?: UUID | null;
  designation: string;
  start_date: ISODate;
  wage_type: WageType;
  basic_salary?: string | null;
  dearness_allowance?: string | null;
  other_allowance?: string | null;
  daily_wage?: string | null;
  ssf_enrolled: boolean;
  employee_code?: string;
}
export type EmploymentUpdate = Partial<
  Pick<
    EmploymentCreate,
    | "site_id"
    | "designation"
    | "wage_type"
    | "basic_salary"
    | "dearness_allowance"
    | "other_allowance"
    | "daily_wage"
    | "ssf_enrolled"
    | "employee_code"
  >
>;
export interface ImportResult {
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
}

export interface Attendance {
  id: UUID;
  employment_id: UUID;
  date: ISODate;
  date_bs: string;
  status: AttendanceStatus;
  status_label?: string;
  check_in_at: ISODateTime | null;
  check_out_at: ISODateTime | null;
  method: AttendanceMethod;
  overtime_minutes: number;
  note: string | null;
}
export interface AttendanceDayRow {
  employment_id: UUID;
  worker: { id: UUID; full_name: string; photo: string | null };
  designation: string;
  site_id: UUID | null;
  record: Attendance | null;
}
export interface AttendanceDay {
  date: ISODate;
  date_bs: string;
  is_holiday: boolean;
  holiday_name: string | null;
  rows: AttendanceDayRow[];
  summary: { present: number; absent: number; half_day: number; leave: number; not_marked: number };
}
export interface AttendanceRegister {
  bs_year: number;
  bs_month: number;
  month_name_en: string;
  month_name_ne: string;
  days: { date: ISODate; bs_day: number; weekday: number; is_holiday: boolean; is_weekly_off: boolean }[];
  rows: {
    employment_id: UUID;
    worker_name: string;
    designation: string;
    cells: Record<ISODate, RegisterCell>;
    totals: { present: number; half_day: number; absent: number; leave: number; overtime_hours: number };
  }[];
}
export interface AttendanceRecordInput {
  client_uuid: string;
  employment_id: UUID;
  date: ISODate;
  status: AttendanceStatus;
  check_in_at?: ISODateTime;
  check_out_at?: ISODateTime;
  lat?: number;
  lng?: number;
  method: AttendanceMethod;
  overtime_minutes?: number;
  note?: string;
}
export interface BulkAttendanceResult {
  saved: string[];
  errors: { client_uuid: string; code: string; message: string }[];
}

export interface LeaveRequest {
  id: UUID;
  employment: UUID | { id: UUID; designation?: string };
  employment_id?: UUID;
  worker?: { id: UUID; full_name: string };
  worker_name?: string;
  leave_type: LeaveType;
  leave_type_label?: string;
  from_date: ISODate;
  from_date_bs: string;
  to_date: ISODate;
  to_date_bs: string;
  days: number | string;
  reason: string | null;
  status: LeaveStatus;
  status_label?: string;
  decided_by?: unknown;
  decided_at: ISODateTime | null;
}
export interface LeaveInput {
  employment: UUID;
  leave_type: LeaveType;
  from_date: ISODate;
  to_date: ISODate;
  reason?: string;
}

export interface Advance {
  id: UUID;
  employment: UUID | { id: UUID };
  employment_id?: UUID;
  worker?: { id: UUID; full_name: string };
  worker_name?: string;
  amount: Money;
  given_on: ISODate;
  given_on_bs: string;
  recover_per_month: Money;
  recovered_amount: Money;
  note: string | null;
}
export interface AdvanceInput {
  employment: UUID;
  amount: string;
  given_on: ISODate;
  recover_per_month: string;
  note?: string;
}

export interface Holiday {
  id: UUID;
  organization: UUID | null;
  date: ISODate;
  date_bs: string;
  name_en: string;
  name_ne: string;
}
export interface HolidayInput {
  date: ISODate;
  name_en: string;
  name_ne: string;
}

// ---------------------------------------------------------------- payroll
export interface PayrollRunListItem {
  id: UUID;
  bs_year: number;
  bs_month: number;
  month_name_en?: string;
  month_name_ne?: string;
  period_start: ISODate;
  period_end: ISODate;
  status: PayrollStatus;
  include_festival_allowance?: boolean;
  created_at?: ISODateTime;
  totals?: PayrollTotals;
}
export interface PayrollTotals {
  workers: number;
  gross: Money;
  ssf_employee: Money;
  ssf_employer: Money;
  tds: Money;
  advance_recovery: Money;
  other_deductions: Money;
  net: Money;
}
export interface PayrollRun extends PayrollRunListItem {
  month_name_en: string;
  month_name_ne: string;
  totals: PayrollTotals;
  employer_cost: Money;
  days_in_month?: number;
  approved_at?: ISODateTime | null;
  paid_at?: ISODateTime | null;
}
export interface Payslip {
  id: UUID;
  run: UUID;
  employment: UUID;
  worker: { id: UUID; full_name: string };
  designation: string;
  wage_type: WageType;
  days_in_month: number;
  present_days: string | number;
  paid_leave_days: string | number;
  holiday_days: string | number;
  weekly_off_days: string | number;
  absent_days: string | number;
  payable_days: string | number;
  overtime_hours: string | number;
  basic_earned: Money;
  da_earned: Money;
  allowance_earned: Money;
  overtime_pay: Money;
  festival_allowance: Money;
  gross_pay: Money;
  ssf_employee: Money;
  ssf_employer: Money;
  tds: Money;
  advance_recovery: Money;
  other_deductions: Money;
  net_pay: Money;
  note: string | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  paid_at: ISODateTime | null;
  payment_ref: string | null;
}
export interface PayslipUpdate {
  other_deductions?: string;
  note?: string;
  payment_method?: PaymentMethod;
}

// ---------------------------------------------------------------- billing
export interface BillingSummary {
  plan: Plan;
  active_workers: number;
  monthly_estimate: Money;
  unpaid_total: Money;
}
export interface Charge {
  id: UUID;
  kind: ChargeKind;
  amount: Money;
  description: string;
  bs_year: number | null;
  bs_month: number | null;
  application: UUID | null;
  status: ChargeStatus;
  created_at: ISODateTime;
}

// ---------------------------------------------------------------- ops
export interface OpsDashboard {
  organizations: number;
  workers: number;
  verified_workers: number;
  pending_verification: number;
  open_jobs: number;
  avg_hours_to_shortlist: number | null;
  hires_30d: number;
}
export interface OpsJob extends Job {
  organization: { id: UUID; name: string };
  hours_open: number;
}
export interface Match {
  worker: WorkerCard;
  score: number;
  reasons: string[];
}
export interface OpsOrganization extends Organization {
  active_workers?: number;
  open_jobs?: number;
  members_count?: number;
}

// ---------------------------------------------------------------- org settings (extras returned by the API)
/** Holiday row as returned by GET /org/holidays (`is_national` instead of `organization`). */
export interface HolidayListItem {
  id: UUID;
  date: ISODate;
  date_bs: string;
  name_en: string;
  name_ne: string;
  organization?: UUID | null;
  is_national?: boolean;
}
/** Charge row as returned by GET /org/billing/charges. */
export interface ChargeListItem {
  id: UUID;
  kind: ChargeKind;
  amount: Money;
  description: string;
  bs_year: number | null;
  bs_month: number | null;
  status: ChargeStatus;
  created_at: ISODateTime;
  application_id?: UUID | null;
  kind_label?: string;
  status_label?: string;
}
/** PATCH /org body. */
export interface OrganizationUpdate {
  name?: string;
  name_ne?: string | null;
  pan_no?: string | null;
  vat_registered?: boolean;
  ssf_employer_no?: string | null;
  industry?: Industry;
  district?: string;
  municipality?: string | null;
  ward?: number | null;
  address?: string;
  phone?: string;
  email?: string | null;
  weekly_off_day?: number;
}
/** PATCH /org/members/{id} body. */
export interface MemberUpdate {
  role?: Role;
  site_ids?: UUID[];
  is_active?: boolean;
  full_name?: string;
}

// ---------------------------------------------------------------- ops (console extras)
export interface OpsWorkerSkillInput {
  trade: string;
  years_experience: number;
  nstb_level: NstbLevel;
  certificate_no?: string | null;
}
/** Body for POST/PATCH /ops/workers (WorkerDetailSerializer writable fields). */
export interface OpsWorkerInput {
  full_name: string;
  full_name_ne?: string | null;
  phone: string;
  gender: Gender;
  date_of_birth?: ISODate | null;
  permanent_district?: string | null;
  current_district?: string | null;
  address?: string | null;
  citizenship_no?: string | null;
  nid_no?: string | null;
  expected_monthly_wage?: string | null;
  is_available?: boolean;
  available_from?: ISODate | null;
  payment_method?: PaymentMethod;
  bank_name?: string | null;
  bank_account_no?: string | null;
  bank_account_name?: string | null;
  wallet_id?: string | null;
  ssf_id?: string | null;
  notes?: string | null;
  skills?: OpsWorkerSkillInput[];
}
/** Full worker record as returned by /ops/workers (adds card-derived fields). */
export interface OpsWorker extends Worker {
  user_id?: UUID | null;
  verified_by?: { id: UUID; full_name: string } | null;
  date_of_birth_bs?: string | null;
  phone_masked?: string;
  district?: DistrictRef | null;
  total_experience_years?: number;
  rating_avg?: number | null;
  placements_count?: number;
  verification_status_label?: string;
  payment_method_label?: string;
}
export type OpsWorkerDocField = "photo" | "id_front" | "id_back";
export interface OpsShortlistResult {
  created: number;
  applications: unknown[];
}
export interface OpsOrganizationMember {
  id: UUID;
  role: Role;
  user: { id: UUID; phone: string; full_name: string };
}
export interface OpsOrganizationDetail extends OpsOrganization {
  unpaid_total?: Money;
  members?: OpsOrganizationMember[];
}

// ---------------------------------------------------------------- hiring (extras returned by the API)
/** Extra fields the backend returns on Application payloads. */
export interface ApplicationExtras {
  /** Set once the application reached `joined`. */
  employment_id?: UUID | null;
  /** Detail only: whether the full WorkerProfile was shared with this org. */
  profile_visible?: boolean;
}

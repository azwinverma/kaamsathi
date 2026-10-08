/** Types for attendance correction requests (P008; backend app: timesheets). */
import type { ISODate, ISODateTime, UUID } from "./types";

export type CorrectionStatus = "pending" | "approved" | "rejected";
export type CorrectionRequestedStatus = "present" | "absent" | "half_day" | "leave";

export const CORRECTION_STATUSES: CorrectionStatus[] = ["pending", "approved", "rejected"];

export interface AttendanceCorrection {
  id: UUID;
  employment_id: UUID;
  worker: { id: UUID; full_name: string };
  organization: { id: UUID; name: string };
  designation: string;
  site_id: UUID | null;
  date: ISODate;
  date_bs: string;
  /** Attendance status at request time (e.g. not_marked, absent). */
  current_status: string;
  current_status_label: string;
  requested_status: CorrectionRequestedStatus;
  requested_status_label: string;
  requested_check_in_at: ISODateTime | null;
  requested_check_out_at: ISODateTime | null;
  reason: string;
  status: CorrectionStatus;
  status_label: string;
  decided_by: { id: UUID; full_name: string } | null;
  decided_at: ISODateTime | null;
  decision_note: string | null;
  created_at: ISODateTime;
}

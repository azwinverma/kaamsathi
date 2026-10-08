# Nepal Workforce OS — Master Product & Development Specification

## 0. Purpose

This document is the single source of truth for designing, building, testing, launching, and operating a market-ready, production-ready digital infrastructure platform for skilled and blue-collar workers in Nepal.

The platform must begin with B2B recruitment and workforce management, then expand into verified worker identity, skill credentials, training, payroll, benefits/financial partnerships, and compliant foreign-employment enablement.

This is not a simple job board. It is a workforce operating system and trust infrastructure.

---

## 1. Product Vision

### 1.1 Vision statement
Build Nepal's trusted digital infrastructure for skilled and blue-collar workers—connecting verified workers with employers, managing the full employment lifecycle, and creating portable records of skills, work history, earnings, credentials, and reputation.

### 1.2 Long-term platform layers
1. Worker Identity & Passport
2. Employer & Organization Management
3. Recruitment & Matching
4. Placement & Employment History
5. Workforce Operations
6. Attendance, Timesheet & Payroll
7. Skills, Credentials & Training
8. Trust, Ratings & Disputes
9. Benefits & Financial Partner Services
10. Foreign Employment Skill Passport
11. Labor Market Analytics
12. Admin, Compliance & Support Infrastructure

### 1.3 Primary user groups
- Skilled worker
- Semi-skilled worker
- Employer / business owner
- HR manager / recruiter
- Site manager / supervisor
- Staffing/contractor operator
- Training institute
- Credential verification partner
- Bank / insurer / finance partner
- Recruitment agency / foreign employment partner
- Platform operations team
- Verification team
- Support team
- Finance/billing team
- Super admin

---

## 2. Market Positioning

### 2.1 Positioning
Do not position as “another jobs app.”

Primary positioning:
- Nepal's professional network for skilled workers.
- Hire verified skills. Manage your workforce.
- Portable worker identity, trusted by employers.

### 2.2 Initial market wedge
Start B2B with recurring skilled-labor demand in Kathmandu Valley, focusing on:
- Electricians
- HVAC / refrigeration technicians
- Plumbers
- Welders
- Maintenance technicians
- Solar technicians

Expand later into:
- Machine operators
- EV technicians
- Carpenters
- Masons
- Painters
- Security guards
- Drivers
- Warehouse workers
- Hospitality workers
- Caregivers
- Factory workers

### 2.3 Initial customer segments
- Construction contractors
- MEP contractors
- Hotels
- Restaurants
- Factories
- Hospitals
- Facility management companies
- Apartment / property operators
- Solar companies
- EV workshops
- Retail chains
- Warehouses
- Security companies

---

# 3. Brand System Requirements

## 3.1 Working brand architecture
Use a working master brand that can later be finalized after trademark/domain checks.

Preferred naming direction:
- SIP
- Kaam
- KaamPro
- SipID
- KaamID
- Karmi
- Dakshya

For development, use neutral internal codename `workforce_os` until brand approval.

### 3.2 Brand personality
- Trustworthy
- Dignified
- Professional
- Inclusive
- Practical
- Human
- Modern but not intimidating
- Nepal-first
- Worker-respectful

### 3.3 Brand principles
1. Never use imagery or language that demeans manual labor.
2. Show workers as professionals, not as “cheap labor.”
3. Avoid over-corporate HR language in worker-facing UX.
4. Use plain Nepali and plain English.
5. Prefer “skill,” “career,” “professional,” “verified,” “trusted,” “opportunity.”
6. Avoid predatory-finance language.
7. Make worker ownership of their profile explicit.

### 3.4 Suggested taglines
- Your skill. Your identity. Your career.
- Nepal's professional network for skilled workers.
- Hire verified skills. Manage your workforce.
- Work with trust.

### 3.5 Visual design direction
- Clean, modern, high-trust SaaS visual language.
- Strong typography and clear hierarchy.
- Mobile-first for workers.
- Dense but usable enterprise dashboards for employers/admins.
- Avoid excessive gradients, gamification, or childish icons.
- WCAG AA minimum accessibility target.

### 3.6 Typography
Use widely available, web-safe/open fonts supporting Devanagari.
Recommended shortlist:
- Inter for Latin UI
- Noto Sans Devanagari for Nepali
or
- Noto Sans for unified cross-language appearance

### 3.7 Logo requirements
Create:
- Primary horizontal logo
- Icon-only mark
- Light background version
- Dark background version
- Monochrome version
- App icon
- Favicon
- Social avatar
- Employer dashboard logo lockup
- Worker ID watermark mark

Logo must remain legible at 24px.

### 3.8 Design token system
Define tokens for:
- Primary color
- Secondary color
- Success
- Warning
- Error
- Info
- Neutral scale
- Backgrounds
- Borders
- Focus ring
- Typography sizes
- Spacing scale
- Radius scale
- Shadow scale
- Breakpoints

Do not hard-code colors directly in product components. Use semantic design tokens.

### 3.9 Tone of voice
Worker-facing copy:
- Short sentences
- Action-oriented
- Low jargon
- Friendly and respectful
- Bilingual labels where helpful during launch

Employer-facing copy:
- Professional
- Concise
- Operational
- Data-driven

Admin-facing copy:
- Precise
- Explicit risk / state language

### 3.10 Brand deliverables
- `BRAND_GUIDELINES.md`
- Logo SVG/PNG assets
- Design token JSON
- Figma design library
- UI component library
- Email template system
- PDF/document template system
- Social launch kit
- App store visual guidelines

---

# 4. Product Architecture

## 4.1 Recommended technology stack

### Worker mobile app
- Flutter
- Riverpod or Bloc
- Dio / typed API client
- Secure storage
- Local encrypted cache
- FCM push notifications
- Offline queue for critical actions

### Employer web
- Next.js
- TypeScript
- App Router
- React Query / TanStack Query
- Form schema validation
- Component library based on shared design tokens

### Admin & operations web
- Next.js
- TypeScript
- Separate app or protected admin workspace

### Backend
- Django + Django REST Framework
- PostgreSQL
- Redis
- Celery
- Celery Beat
- Object storage: S3-compatible private bucket
- OpenAPI / Swagger

### Infrastructure
- Docker
- Nginx / managed load balancer
- GitHub Actions
- Managed PostgreSQL in production where possible
- Managed Redis in production where possible
- Centralized logging
- Metrics and alerting
- Error tracking

## 4.2 Architecture strategy
Start as a modular monolith with strong domain boundaries.
Do not begin with microservices.

Backend modules:
- accounts
- organizations
- workers
- skills
- credentials
- verification
- jobs
- matching
- applications
- placements
- worksites
- shifts
- attendance
- timesheets
- payroll
- reviews
- disputes
- training
- notifications
- billing
- partners
- finance_referrals
- foreign_employment
- audit
- analytics
- support
- common

---

# 5. Core Data Model

## 5.1 Identity entities
- User
- UserSession
- OTPRequest
- RefreshToken / token family
- Device
- MFAFactor
- Role
- Permission

## 5.2 Worker entities
- WorkerProfile
- WorkerAddress
- WorkerLanguage
- WorkerAvailability
- WorkerPreference
- WorkerSkill
- WorkerSkillEvidence
- WorkerExperience
- WorkerDocument
- WorkerCredential
- WorkerReference
- WorkerVerification
- WorkerPublicProfile
- WorkerQRIdentity

## 5.3 Employer entities
- Organization
- OrganizationVerification
- OrganizationBranch
- Worksite
- OrganizationMember
- OrganizationRole
- EmployerDocument
- ContractorVendor

## 5.4 Recruitment entities
- JobRequisition
- JobSkillRequirement
- JobLocation
- JobCompensation
- JobShiftRequirement
- CandidateMatch
- JobInvitation
- JobApplication
- ApplicationStatusHistory
- Interview
- Offer
- Placement
- PlacementHistory

## 5.5 Workforce operations entities
- WorkerAssignment
- ShiftTemplate
- Shift
- Roster
- AttendanceEvent
- AttendanceCorrection
- Timesheet
- TimesheetEntry
- OvertimeEntry
- LeaveRequest
- LeaveType

## 5.6 Payroll entities
- PayGroup
- PayPeriod
- PayRule
- PayrollRun
- PayrollLine
- PayrollAdjustment
- PayrollApproval
- PayrollExport

## 5.7 Trust entities
- Review
- ReliabilityMetric
- EmployerTrustMetric
- Dispute
- DisputeEvidence
- DisputeResolution
- FraudFlag
- RiskCase

## 5.8 Training entities
- TrainingProvider
- TrainingProgram
- Course
- Enrollment
- Attendance
- Assessment
- TrainingCertificate
- TrainingOutcome

## 5.9 Billing entities
- SubscriptionPlan
- OrganizationSubscription
- BillingAccount
- Invoice
- InvoiceLine
- Payment
- CreditNote
- UsageRecord

## 5.10 Partner / financial entities
- PartnerOrganization
- PartnerProduct
- WorkerConsent
- ReferralApplication
- ReferralStatus
- InsuranceEnrollment
- FinanceOfferReference

## 5.11 Foreign employment entities
- SkillPassport
- PassportDocumentReference
- PoliceClearanceReference
- MedicalClearanceReference
- LanguageQualification
- ForeignJobOpportunity
- LicensedAgency
- AgencySubmission
- InternationalPlacementReference

## 5.12 Audit entities
- AuditEvent
- SecurityEvent
- DataAccessEvent
- DataExportRequest
- ConsentRecord
- PrivacyRequest

---

# 6. Authentication, Authorization & Account Security

## EPIC AUTH-01: Account registration
### Features
- Phone-based registration
- OTP verification
- Optional email
- Role selection at onboarding
- Terms/privacy consent

### Tasks
- Implement phone normalization for Nepal numbers.
- OTP generation with expiry.
- OTP retry cooldown.
- OTP request rate limiting by phone/IP/device.
- Brute-force protection.
- Record consent version accepted.
- Block known disposable/invalid inputs where relevant.

### Acceptance criteria
- User can register with valid phone and OTP.
- Failed OTP attempts are rate-limited.
- OTP cannot be reused.
- Every registration is auditable.

## EPIC AUTH-02: Login/session management
### Features
- JWT access token
- Refresh token rotation
- Device/session list
- Logout current device
- Logout all devices

### Tasks
- Token family tracking.
- Revocation support.
- Suspicious refresh reuse detection.
- Session metadata capture.

## EPIC AUTH-03: MFA
Required for:
- Super admins
- Verification officers
- Billing admins
- High-risk employer administrators

Support:
- TOTP
- Recovery codes

## EPIC AUTH-04: RBAC
Roles:
Platform:
- SuperAdmin
- OpsAdmin
- VerificationOfficer
- SupportAgent
- FinanceAdmin
- Analyst

Employer:
- OrgOwner
- HRAdmin
- Recruiter
- SiteManager
- PayrollManager
- Viewer

Training:
- ProviderOwner
- Trainer
- Assessor

Tasks:
- Permission matrix.
- Object-level organization scoping.
- Backend enforcement independent of UI.
- Tests for every critical role.

---

# 7. Worker App — Detailed Feature List

## EPIC WORKER-01: Worker onboarding
### Features
- Welcome / language choice
- Phone OTP registration
- Name, DOB/age, gender optional as legally appropriate
- Province/district/local level
- Current location
- Primary occupation
- Experience years
- Availability
- Expected wage
- Preferred work locations

### Subtasks
- Progressive onboarding, not one huge form.
- Save-and-resume onboarding.
- Completion meter.
- Offline draft support.
- Nepali and English labels.
- Field-level validation.
- Analytics for onboarding drop-off.

## EPIC WORKER-02: Worker Passport
### Features
- Public profile
- Private profile
- QR ID
- Unique worker ID
- Trust/verification badges
- Skills
- Credentials
- Experience
- Verified jobs
- Ratings summary
- Availability

### Subtasks
- Generate stable public slug/identifier.
- QR deep link.
- Public/private field controls.
- Share profile as link.
- Download/share profile PDF later.
- Never expose sensitive document numbers publicly.

## EPIC WORKER-03: Skills
### Features
- Primary trade
- Multiple skills
- Skill level
- Years of experience
- Evidence upload
- Verification status

### Status model
- Claimed
- Evidence Submitted
- Under Review
- Verified
- Rejected
- Expired / Needs Revalidation

## EPIC WORKER-04: Credentials & documents
Support:
- Citizenship identity evidence
- Training certificate
- CTEVT credential
- License
- Safety certificate
- Driving license
- Language qualification
- Police clearance later

### Tasks
- Secure upload.
- Virus scan.
- Image/PDF validation.
- Private storage.
- Expiry date alerts.
- Manual verification workflow.
- Re-upload after rejection.

## EPIC WORKER-05: Experience history
### Features
- Manual historical experience claim
- Employer-verifiable experience
- Platform-generated verified placement history

### Rules
- Distinguish claimed vs verified experience.
- Employer confirmation workflow.
- Admin resolution for disputes.

## EPIC WORKER-06: Job discovery
### Features
- Recommended jobs
- Browse/search
- Filters
- Saved jobs
- Job detail
- Apply
- Employer invitation
- Application status

### Filters
- Trade/skill
- Location
- Pay type
- Pay range
- Employment type
- Duration
- Shift
- Start date
- Accommodation provided
- Meals provided
- Certification required

## EPIC WORKER-07: Applications
Statuses:
- Draft
- Submitted
- Viewed
- Shortlisted
- Interview Requested
- Offer Sent
- Accepted
- Rejected
- Withdrawn
- Placed

### Tasks
- Status timeline.
- Worker notifications.
- Withdraw action.
- Offer review.
- Digital acceptance log.

## EPIC WORKER-08: Availability
- Available now
- Available from date
- Not available
- Working but open to opportunities
- Preferred shift
- Max travel distance

## EPIC WORKER-09: Assignments
- Current placement
- Site details
- Supervisor contact
- Shift schedule
- Check-in/check-out
- Timesheet summary
- Wage summary

## EPIC WORKER-10: Attendance
- GPS check-in/out
- QR check-in/out
- Offline attendance queue
- Geofence validation configurable by employer
- Manual correction request

### Anti-fraud
- Device binding signal
- Impossible travel detection later
- Duplicate event prevention
- Server-side timestamp authority
- Location confidence capture

## EPIC WORKER-11: Earnings
- Estimated earnings
- Approved payroll history
- Payment status reference
- Downloadable statement
- Monthly earnings graph

Do not call this a bank statement or credit report.

## EPIC WORKER-12: Reviews & disputes
- View employer feedback
- Request review reconsideration
- Rate employer after placement
- Payment reliability feedback
- Safety feedback
- Job-description accuracy feedback

## EPIC WORKER-13: Training
- Recommended training
- Browse programs
- Enroll
- Attendance/progress
- Assessment outcome
- Credential auto-add after verification

## EPIC WORKER-14: Notifications
- Push inbox
- Job alerts
- Interview alert
- Offer alert
- Shift reminder
- Credential expiry
- Attendance issue
- Payroll ready
- Training recommendation

## EPIC WORKER-15: Privacy
- View consent history
- Public profile visibility controls
- Data download request
- Account closure request
- Revoke partner consent

---

# 8. Employer Portal — Detailed Feature List

## EPIC EMP-01: Organization onboarding
### Features
- Register organization
- Legal/business name
- PAN/VAT or business registration references
- Address
- Industry
- Company size
- Primary contact
- Upload verification documents

### States
- Draft
- Submitted
- Under Review
- Verified
- Rejected
- Suspended

## EPIC EMP-02: Team & permissions
- Invite team member
- Role assignment
- Branch/site access restrictions
- Disable member
- Audit access changes

## EPIC EMP-03: Branch & site management
- Branches
- Worksites
- Location coordinates
- Site managers
- Operating hours
- Check-in geofence settings

## EPIC EMP-04: Job requisitions
Fields:
- Job title
- Occupation/trade
- Number of workers required
- Required skills
- Preferred skills
- Experience minimum
- Credentials required
- Job location
- Employment type
- Contract duration
- Start date
- Shift
- Salary/day/hour rate
- Overtime information
- Benefits
- Accommodation
- Meals
- Travel support
- Description

### Workflow
Draft → Approval (optional) → Published → Paused → Closed → Filled → Archived

## EPIC EMP-05: Candidate matching
- Ranked candidate list
- Match score
- Explain match reasons
- Filter by verification
- Filter by availability
- Bulk invite
- Save candidate

## EPIC EMP-06: Applicant tracking
- Application pipeline
- Kanban/list views
- Notes
- Tags
- Assign recruiter
- Interview scheduling
- Status changes
- Bulk actions

## EPIC EMP-07: Offers
- Offer template
- Wage/rate
- Start date
- Site
- Contract type
- Expiry
- Worker accept/decline
- Audit history

## EPIC EMP-08: Placement
- Create placement from accepted offer
- Worker assignment
- Site
- Supervisor
- Pay rule
- Start/end date
- Employment documents

## EPIC EMP-09: Workforce directory
- All active workers
- Filters
- Profile view
- Assignment history
- Credential expiry
- Attendance summary

## EPIC EMP-10: Shift & roster
- Shift templates
- Weekly roster
- Assign workers
- Bulk schedule
- Copy week
- Conflict detection

## EPIC EMP-11: Attendance
- Live attendance dashboard
- Missing check-in alerts
- Late/absent
- Correction approvals
- Site-specific policies
- Attendance export

## EPIC EMP-12: Timesheets
- Auto-generate from attendance
- Manual adjustment with reason
- Supervisor approval
- Worker acknowledgment optional
- Lock after payroll approval

## EPIC EMP-13: Payroll
### V1
- Daily wage
- Monthly salary
- Hourly rate
- Overtime
- Allowances
- Deductions
- Manual adjustments
- Payroll preview
- Approval workflow
- Export to CSV/XLSX

### Later
- Tax/SSF configuration after legal/accounting validation
- Bank payout integration
- Payroll journal integration

## EPIC EMP-14: Credential/compliance dashboard
- Expiring credentials
- Missing documents
- Required certification rules by role
- Compliance warnings

## EPIC EMP-15: Employer analytics
- Time-to-hire
- Applicant conversion
- Placement count
- Worker retention
- Attendance rate
- Overtime
- Fill rate
- Cost per placement

## EPIC EMP-16: Billing
- Current plan
- Usage
- Invoices
- Payment history
- Upgrade/downgrade request
- Placement fees
- Credit balance

---

# 9. Admin & Operations Console

## EPIC ADMIN-01: Operations dashboard
- New workers
- Pending KYC
- Pending organization verification
- Pending credentials
- Open disputes
- Fraud flags
- Active placements
- Failed notifications
- System health summary

## EPIC ADMIN-02: Worker management
- Search worker
- View internal profile
- Suspend/reactivate
- Verification history
- Document review
- Merge duplicate records with strict audit controls

## EPIC ADMIN-03: Employer management
- Organization verification
- Suspension
- Team view
- Job moderation if required
- Billing status

## EPIC ADMIN-04: Verification work queues
Separate queues:
- Identity
- Employer
- Credential
- Experience
- Training provider

Each queue supports:
- Assigned reviewer
- SLA timer
- Approve/reject/request-info
- Reason codes
- Notes
- Evidence view
- Audit trail

## EPIC ADMIN-05: Skill taxonomy management
- Categories
- Occupations
- Skills
- Aliases
- Levels
- Required credential mapping
- Disable/deprecate terms

## EPIC ADMIN-06: Fraud/risk
- Duplicate identity signals
- Multiple accounts per document
- Suspicious job posts
- Mass invitation abuse
- Attendance anomalies
- Review abuse
- Partner referral fraud

## EPIC ADMIN-07: Dispute management
- Worker disputes
- Employer disputes
- Review disputes
- Attendance disputes
- Payroll disputes
- Evidence
- Resolution
- Appeal state

## EPIC ADMIN-08: Content/config management
- FAQs
- Help articles
- App banners
- Feature flags
- Terms version
- Privacy policy version
- Notification templates

## EPIC ADMIN-09: Audit explorer
- Search by actor
- Entity
- Date
- IP/device
- Event type
- Export restricted to authorized roles

---

# 10. Matching Engine

## EPIC MATCH-01: Rule-based matching V1
Suggested score:
- Required skill match: 35
- Experience: 20
- Location: 15
- Availability: 10
- Credential: 10
- Past performance: 5
- Wage compatibility: 5

### Tasks
- Configurable weights.
- Required hard filters.
- Explainability string generation.
- Version matching algorithm.
- Persist match score snapshot.
- A/B capability later.

## EPIC MATCH-02: Employer search
- Exact skill search
- Fuzzy aliases
- Location filters
- Experience
- Verification level
- Availability

## EPIC MATCH-03: Recommendation engine later
Use outcome data only after sufficient volume.
Do not deploy opaque ML before baseline performance can be measured.

---

# 11. Trust, Reputation & Safety

## EPIC TRUST-01: Worker reputation
Signals:
- Identity verification
- Skill verification
- Credential verification
- Attendance
- Assignment completion
- Repeat hiring
- Employer feedback
- Dispute outcomes

Do not expose sensitive/internal fraud indicators publicly.

## EPIC TRUST-02: Employer reputation
Signals:
- Business verification
- Payment punctuality
- Worker complaints
- Job-description accuracy
- Safety reports
- Dispute outcomes

## EPIC TRUST-03: Review system
- Only verified placement participants can review.
- One review per eligible relationship.
- Review window.
- Moderation.
- Appeal/dispute.

## EPIC TRUST-04: Safety incident reporting
- Unsafe workplace report
- Harassment report
- Payment withholding report
- Emergency escalation process
- Internal case tracking

---

# 12. Training Ecosystem

## EPIC TRAIN-01: Training provider onboarding
- Provider registration
- Business verification
- Accreditation/authorization evidence
- Locations
- Contact persons

## EPIC TRAIN-02: Program catalog
- Program
- Trade
- Duration
- Price
- Seats
- Schedule
- Location
- Prerequisites
- Certificate type

## EPIC TRAIN-03: Enrollment
- Worker application
- Eligibility
- Payment reference
- Enrollment status

## EPIC TRAIN-04: Assessment
- Score
- Pass/fail
- Assessor
- Evidence
- Reassessment

## EPIC TRAIN-05: Outcome tracking
- Training completed
- Credential issued
- Placement after training
- Wage change later
- Employment outcome dashboard

---

# 13. Payroll & Earnings

## EPIC PAY-01: Pay rule engine
Support:
- Monthly salary
- Daily wage
- Hourly wage
- Overtime
- Allowances
- Deductions
- Bonus

## EPIC PAY-02: Payroll run
Workflow:
Draft → Calculated → Reviewed → Approved → Locked → Exported/Paid Reference

## EPIC PAY-03: Worker earnings history
- Approved payroll only
- Monthly summary
- Placement-linked
- Downloadable statement
- Consent-gated partner sharing

## EPIC PAY-04: Compliance layer
Do not hard-code statutory rules without legal/accounting validation.
Build configurable tax/SSF/rule tables with effective dates.

---

# 14. Financial & Benefits Partner Ecosystem

## EPIC FIN-01: Partner marketplace
Products may include:
- Accident insurance
- Health insurance
- Tool financing
- Equipment financing
- Vehicle financing
- Salary advance via licensed partner

## EPIC FIN-02: Consent
Explicit worker consent required before sharing:
- Employment history
- Earnings summary
- Contact data
- Credential information

## EPIC FIN-03: Referral workflow
- Product eligibility display
- Worker interest
- Consent capture
- Referral to partner
- Status updates
- Commission tracking

Do not build lending underwriting as a platform responsibility unless legally licensed and separately approved.

---

# 15. Foreign Employment Skill Passport

## EPIC FOREIGN-01: International skill passport
- Verified identity reference
- Passport validity reference
- Police clearance reference
- Medical reference
- Credentials
- Experience
- Languages
- Safety training

## EPIC FOREIGN-02: Agency partnership
- Licensed agency onboarding
- Compliance document verification
- Opportunity publication
- Candidate submission
- Status tracking

## EPIC FOREIGN-03: Safeguards
- No bypass of legally required government/agency processes.
- Clear fees disclosure.
- Anti-fraud reporting.
- Worker consent.
- Document expiry alerts.

---

# 16. Notifications & Communications

## EPIC NOTIF-01: Channels
- Push
- Email
- SMS fallback for critical events
- In-app inbox

## EPIC NOTIF-02: Template engine
- Bilingual templates
- Variables
- Versioning
- Delivery status
- Retry logic

## EPIC NOTIF-03: Preferences
- Transactional cannot always be disabled
- Marketing preferences separate
- Job alert frequency settings

---

# 17. Search

## EPIC SEARCH-01: Worker search
Initially PostgreSQL full-text/trigram.
Later OpenSearch/Elasticsearch if scale requires.

## EPIC SEARCH-02: Job search
- Query
- Filters
- Sort
- Saved searches
- Alert creation

---

# 18. Billing & Monetization

## EPIC BILL-01: Plans
Support configuration for:
- Starter
- Growth
- Business
- Enterprise

## EPIC BILL-02: Revenue types
- Employer subscription
- Per active worker fee
- Placement fee
- Staffing spread record
- Verification service fee
- Training referral/commission
- Partner referral fee

## EPIC BILL-03: Invoices
- Invoice numbering
- VAT/tax fields configurable
- PDF invoice
- Payment status
- Credit note
- Manual payment recording
- Payment gateway later

---

# 19. Customer Support

## EPIC SUPPORT-01: Help center
- FAQs
- Guides
- Worker help
- Employer help

## EPIC SUPPORT-02: Ticketing
- Ticket creation
- Category
- Priority
- Assignment
- SLA
- Internal notes
- User-visible replies
- Attachments

## EPIC SUPPORT-03: Contact center readiness
- Search user by phone/ID
- Secure identity verification before account-sensitive changes
- Call notes

---

# 20. Analytics & BI

## EPIC ANALYTICS-01: Product analytics
Track:
- Registrations
- Onboarding completion
- Job post creation
- Applications
- Match acceptance
- Placement
- Attendance use
- Retention

## EPIC ANALYTICS-02: Marketplace metrics
- Worker supply by trade/location
- Employer demand
- Fill rate
- Time-to-fill
- Wage distribution
- Application conversion
- Repeat employer rate

## EPIC ANALYTICS-03: Training intelligence
- Skill shortages
- Training demand
- Outcome rate

## EPIC ANALYTICS-04: Privacy-safe aggregate labor intelligence
Only aggregated/anonymized reporting for commercial/research outputs.

---

# 21. Localization & Accessibility

## EPIC I18N-01
- English
- Nepali
- Translation key system
- Never hard-code UI text in components

## EPIC I18N-02
- Nepali date display where useful
- Standard Gregorian date internally
- NPR formatting
- Nepal phone formatting

## EPIC ACCESS-01
- WCAG AA target
- Keyboard accessible web
- Screen reader labels
- Adequate contrast
- Large touch targets

---

# 22. Security Requirements

## SEC-01 Identity security
- OTP rate limiting
- JWT rotation
- MFA admins
- Device/session revocation

## SEC-02 Data security
- TLS everywhere
- Encryption at rest where available
- Private object storage
- Signed URLs
- Sensitive ID values encrypted/hashed as appropriate
- Secrets outside repository

## SEC-03 Authorization
- Deny-by-default
- Organization scoping
- Object-level tests

## SEC-04 Application security
- Dependency scanning
- SAST
- Container scanning
- CSRF protection where relevant
- XSS protection
- SQL injection protections via ORM
- File upload validation

## SEC-05 Audit
Audit sensitive actions:
- Login security changes
- Verification decisions
- Payroll changes
- Role changes
- Data exports
- Partner sharing

## SEC-06 Backups
- Automated backups
- Restore drills
- Defined RPO/RTO

## SEC-07 Incident response
Create runbooks for:
- Account takeover
- Data leak
- Service outage
- Fraud campaign
- Payment/billing incident

---

# 23. Privacy & Data Governance

## PRIV-01 Data minimization
Collect only required information.

## PRIV-02 Consent
Versioned consent records for:
- Terms
- Privacy
- Public profile
- Partner data sharing
- Marketing

## PRIV-03 Worker ownership principle
Workers can see their profile data and request corrections.

## PRIV-04 Retention policy
Define retention by data category.

## PRIV-05 Data requests
- Access/export request
- Correction request
- Account closure request
- Consent withdrawal

## PRIV-06 Sensitive location
Do not expose live worker location publicly.

---

# 24. DevOps & Infrastructure

## DEVOPS-01 Environments
- Local
- Development
- Staging
- Production

## DEVOPS-02 CI
On every PR:
- Lint
- Type-check
- Unit tests
- Security scan
- Build images

## DEVOPS-03 CD
- Staging auto-deploy on main after checks
- Production manual approval/tag
- Rollback support

## DEVOPS-04 Database
- Migration checks
- Backward-compatible deploy strategy
- Automated backup
- Monitoring

## DEVOPS-05 Observability
- Structured logs
- Request IDs
- Error tracking
- Metrics
- Uptime monitors
- Alerts

Key alerts:
- API error rate
- Latency
- Queue backlog
- Database connections
- Disk/storage
- Failed login spikes
- Failed SMS/OTP delivery

---

# 25. Testing Strategy

## QA-01 Unit tests
Critical domains:
- Permissions
- Matching
- Payroll calculations
- Verification state transitions
- Billing

## QA-02 API integration tests
- Auth
- Worker onboarding
- Employer onboarding
- Job lifecycle
- Placement lifecycle
- Attendance

## QA-03 E2E tests
Worker flow:
Register → profile → apply → accept → placement

Employer flow:
Register → verify → post job → invite → offer → placement

Admin flow:
Review worker → approve credential → verify employer

## QA-04 Security testing
- Auth abuse
- IDOR/object authorization
- Upload attacks
- Rate-limit testing
- Session revocation

## QA-05 Performance
Load test:
- login
- worker search
- job listing
- attendance burst
- payroll generation

---

# 26. API Standards

- REST API version prefix `/api/v1/`
- JSON only except uploads
- UUID public identifiers preferred
- Standard error envelope
- Pagination standardized
- Idempotency keys for critical POSTs
- Request ID
- OpenAPI generated and reviewed

Example error:
```json
{
  "error": {
    "code": "VERIFICATION_REQUIRED",
    "message": "Organization verification is required before publishing a job.",
    "details": {}
  },
  "request_id": "..."
}
```

---

# 27. UX Screens Inventory

## Worker mobile
1. Splash
2. Language selection
3. Phone login
4. OTP
5. Onboarding wizard
6. Home
7. Jobs
8. Job detail
9. Applications
10. Invitations
11. Worker Passport
12. Profile edit
13. Skills
14. Add skill
15. Credentials
16. Credential upload
17. Experience
18. Availability
19. Current assignment
20. Shift schedule
21. Attendance
22. Timesheets
23. Earnings
24. Training catalog
25. Course detail
26. Reviews
27. Disputes
28. Notifications
29. Privacy/consent
30. Settings
31. Help/support

## Employer web
1. Login
2. Dashboard
3. Organization onboarding
4. Verification
5. Team members
6. Branches
7. Sites
8. Jobs list
9. Job create/edit
10. Job detail
11. Candidate matches
12. Applications pipeline
13. Candidate profile
14. Interviews
15. Offers
16. Placements
17. Workforce directory
18. Worker detail
19. Roster
20. Attendance dashboard
21. Timesheets
22. Payroll
23. Compliance
24. Reports
25. Billing
26. Settings
27. Support

## Admin
1. Ops dashboard
2. Worker search
3. Worker detail
4. Identity verification queue
5. Credential queue
6. Employer verification queue
7. Organization detail
8. Skill taxonomy
9. Disputes
10. Fraud/risk queue
11. Support tickets
12. Billing/admin
13. Notification templates
14. Feature flags
15. Audit explorer
16. Analytics

---

# 28. Development Phases

## PHASE 0 — Product foundation
### Tasks
- Finalize product name after legal/domain check.
- Finalize brand identity.
- Finalize design tokens.
- Figma component library.
- Repo setup.
- ADRs for architecture decisions.
- Environments.
- CI/CD.
- Logging/monitoring baseline.

### Exit criteria
- Repositories build successfully.
- Staging deploy exists.
- Base UI library exists.

## PHASE 1A — Authentication & core identity
### Tasks
- User model
- OTP
- JWT
- sessions
- RBAC
- worker base profile
- organization base model
- audit log

### Exit criteria
- Worker/employer/admin can securely authenticate.

## PHASE 1B — Worker Passport & verification
### Tasks
- onboarding
- skills
- credentials
- documents
- work history
- verification queues
- QR profile

### Exit criteria
- Admin can verify worker and retrieve public passport.

## PHASE 1C — Employer & recruitment
### Tasks
- organization verification
- team roles
- jobs
- applications
- invitations
- interviews
- offers

### Exit criteria
- Verified employer can run a recruitment cycle.

## PHASE 1D — Matching & placement
### Tasks
- matching engine
- ranked candidates
- explainability
- placement
- verified work history
- reviews
- disputes basic

### Exit criteria
- First real worker placement end-to-end.

## PHASE 2 — Workforce management
- worksites
- rosters
- shifts
- attendance
- timesheets
- contractor management
- workforce dashboard

## PHASE 3 — Payroll
- pay rules
- pay periods
- payroll runs
- exports
- earnings history

## PHASE 4 — Training ecosystem
- providers
- courses
- enrollment
- assessment
- credentials
- outcomes

## PHASE 5 — Billing & SaaS monetization
- subscriptions
- usage
- invoices
- placement fee
- billing administration

## PHASE 6 — Partner services
- partner registry
- consent sharing
- insurance/finance referral workflows

## PHASE 7 — International skill passport
- foreign-employment records
- licensed agency portal/integration
- international opportunity workflow

## PHASE 8 — Advanced analytics & intelligence
- labor market dashboards
- skill shortage prediction
- outcome analytics
- matching ML experiments

---

# 29. Launch Readiness Checklist

## Product
- [ ] Worker onboarding tested
- [ ] Employer onboarding tested
- [ ] Admin verification operational
- [ ] Job lifecycle tested
- [ ] Placement lifecycle tested
- [ ] Notification templates reviewed
- [ ] Nepali translations reviewed by native reviewer

## Security
- [ ] Admin MFA enabled
- [ ] Secrets rotated
- [ ] Backup tested
- [ ] Authorization test suite passing
- [ ] Rate limits validated
- [ ] File uploads private
- [ ] Security review completed

## Legal/operations
- [ ] Terms reviewed by Nepal counsel
- [ ] Privacy policy reviewed
- [ ] Employer agreement
- [ ] Worker agreement
- [ ] Verification SOP
- [ ] Dispute SOP
- [ ] Incident SOP
- [ ] Data retention policy

## Reliability
- [ ] Monitoring configured
- [ ] On-call escalation
- [ ] Queue retry policies
- [ ] Database restore test
- [ ] Production rollback test

## Commercial
- [ ] Pricing pilot approved
- [ ] Sales deck
- [ ] Employer onboarding playbook
- [ ] Worker onboarding field playbook
- [ ] Support scripts

---

# 30. Operational SOPs Required

Create written SOPs for:
1. Worker identity verification
2. Employer verification
3. Credential verification
4. Duplicate worker handling
5. Job post moderation
6. Worker complaint
7. Employer complaint
8. Wage/payment dispute
9. Unsafe workplace report
10. Fraud investigation
11. Account recovery
12. Data correction
13. Account closure
14. Security incident
15. Partner data-sharing request
16. Foreign-employment opportunity review

---

# 31. Initial KPI Targets

Pilot targets:
- 1,000 worker profiles
- 50 employers
- 20 paying employers
- 100 successful placements
- >80% employer satisfaction
- >25% employer repeat usage
- <14 days average time-to-fill for targeted roles

Operational metrics:
- Worker onboarding completion
- Verification turnaround
- Employer verification turnaround
- Match-to-invite rate
- Invite-to-application rate
- Application-to-placement rate
- 30/90-day placement retention
- Support ticket resolution time

---

# 32. Non-Goals for Initial Release

Do not build initially:
- Direct lending
- Wallet
- Full foreign employment marketplace
- Blockchain credentials
- Microservices
- Complex AI matching
- Consumer household services marketplace
- 100+ occupations
- Full ERP/accounting suite

---

# 33. Definition of Production Ready

A module is production ready only when:
1. UX is complete and responsive.
2. Authorization is enforced server-side.
3. Validation is complete.
4. Error states are handled.
5. Empty/loading states exist.
6. Audit events are generated where needed.
7. Unit/integration tests exist.
8. Monitoring exists.
9. Documentation exists.
10. Migration is reversible or deployment-safe.
11. Security review is complete.
12. Acceptance criteria are signed off.

---

# 34. Claude Development Instructions

Claude should treat this document as product requirements, not optional suggestions.

Development rules:
- Build vertically usable slices.
- Do not invent major features without documenting the decision.
- Keep backend permissions authoritative.
- Keep business logic outside views/controllers where possible.
- Write tests with every module.
- Generate OpenAPI docs.
- Use migrations.
- Keep secrets out of source control.
- Add seed fixtures for local development.
- Maintain changelog and ADRs.
- Update task checklist after every completed feature.
- Never mark a feature complete without acceptance criteria passing.

Before coding a major epic, Claude should produce:
1. Data model changes
2. API endpoints
3. Permission rules
4. UI screens/components
5. Background jobs
6. Notifications
7. Audit events
8. Test plan
9. Migration impact
10. Acceptance criteria


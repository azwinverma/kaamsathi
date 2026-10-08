# Nepal Workforce OS — Brand & Product Design Guidelines

## Brand mission
Give skilled and blue-collar workers a professional identity that grows with their career, while giving businesses a trusted way to hire and manage people.

## Brand promise
Every verified skill, job, credential, and work experience should strengthen the worker's future opportunities.

## Brand audience
### Workers
People who may be highly skilled but lack formal digital professional identity.

### Employers
Businesses that need reliable, verified workers and operational workforce tools.

### Partners
Training providers, finance/insurance partners, agencies, and institutions.

## Personality
- Trusted
- Respectful
- Capable
- Modern
- Clear
- Practical
- Fair

## Voice
### Worker-facing
Use simple language.
Good: “Add your electrician certificate.”
Avoid: “Upload competency attestation artifacts.”

Good: “You matched this job because your skills and location fit.”
Avoid: “Algorithmically recommended opportunity.”

### Employer-facing
Use concise operational language.
Good: “12 verified electricians are available within 10 km.”

### Admin-facing
Use precise state language.
Good: “Credential rejected: issuer could not be verified.”

## Bilingual strategy
- English and Nepali from first public pilot.
- Translation keys only; never hard-code production UI text.
- Keep original legal names/credential titles where necessary.
- Use plain-language Nepali, not overly formal administrative wording.

## Visual principles
1. Dignity over pity.
2. Real work environments over generic stock-office imagery.
3. Clear hierarchy over decorative UI.
4. Trust indicators should be calm, not gamified.
5. Verification badge design must not imply government endorsement unless true.

## Image direction
Use real or documentary-style imagery showing:
- technicians
- electricians
- welders
- mechanics
- factory workers
- hospitality staff
- supervisors
- women in skilled trades where available

Avoid:
- unsafe PPE depiction
- staged poverty imagery
- stereotypes
- demeaning “laborer” portrayals

## Logo system requirements
Deliver:
- Full logo
- Symbol
- Wordmark
- Light/dark variants
- Single-color variants
- 16/24/32px icon tests
- Mobile icon
- Favicon

## Product UI principles
### Worker app
- One major action per screen where possible.
- Large tap targets.
- Minimal typing.
- Use pickers/chips for known values.
- Save drafts.
- Show progress.
- Explain why data is requested.

### Employer dashboard
- Fast scanning.
- Tables + filters.
- Bulk actions.
- Audit trail access.
- Permission-aware navigation.

### Admin console
- Dense information is acceptable.
- High-risk actions require confirmation.
- Rejection actions require reason codes.

## Accessibility
- WCAG AA target.
- Contrast-safe semantic colors.
- Keyboard support web.
- Screen-reader labels.
- Do not communicate status by color alone.

## Status language
Use consistent status labels:
- Draft
- Submitted
- Under review
- Verified
- Rejected
- Suspended
- Expired

Do not mix synonyms like “approved/validated/confirmed” randomly.

## Trust badges
Possible badges:
- Identity verified
- Skill verified
- Credential verified
- Experience verified
- Employer verified

Never expose an overall “credit score.”

## Design system components
Required base components:
- Button
- IconButton
- Input
- PhoneInput
- Select
- MultiSelect
- DatePicker
- TimePicker
- FileUpload
- Badge
- VerificationBadge
- Alert
- Toast
- Modal
- Drawer
- Tabs
- Card
- WorkerCard
- EmployerCard
- JobCard
- StatCard
- Table
- Pagination
- FilterBar
- EmptyState
- Skeleton
- Timeline
- Stepper
- QRCard
- RatingSummary
- PermissionGuard

## Document design
Create templates for:
- Worker Passport PDF
- Offer letter
- Placement confirmation
- Payroll statement
- Invoice
- Training certificate reference

All documents must include document ID and generated timestamp.

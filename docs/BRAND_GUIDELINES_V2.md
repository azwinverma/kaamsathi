# Nepal Workforce OS — Brand, Visual System & Experience Guidelines v2.0

## 1. Brand intent
The product should feel **optimistic, modern, human, energetic and trustworthy**. It must never look like a government portal, a traditional staffing agency, or a cold corporate HR system.

The emotional target is:
- joyful but not childish
- vibrant but not noisy
- professional but not stiff
- inclusive across Gen X, Gen Y and Gen Z
- easy enough for first-time digital users
- polished enough for enterprise buyers

The visual language should make workers feel **proud of their skills** and employers feel **confident in the system**.

## 2. Brand personality
Primary traits:
- Human
- Energetic
- Trustworthy
- Capable
- Friendly
- Inclusive
- Practical
- Ambitious

Avoid:
- bureaucratic
- overly formal
- luxury-only
- childish cartoon UI
- dark, industrial, “hard labor” stereotypes
- excessive gradients, neon, or gaming-style effects

## 3. Brand experience principle
Use a **70 / 20 / 10 visual balance**:
- 70% clean neutral surfaces
- 20% primary brand color and soft tinted surfaces
- 10% vibrant accent colors

This keeps the experience joyful without becoming exhausting.

---

# 4. Core color system

## Primary brand palette

### Horizon Blue — Primary
**HEX:** `#2563EB`
Use for:
- primary CTAs
- active navigation
- links
- selected controls
- key charts
- worker/employer verified highlights when not semantic-status specific

Why: modern, trustworthy, familiar across generations, strong on web and mobile.

### Electric Indigo — Brand depth
**HEX:** `#4F46E5`
Use for:
- premium/brand moments
- hero gradients
- secondary primary actions
- large decorative shapes
- data visualization series

### Joy Coral — Human accent
**HEX:** `#FF6B6B`
Use for:
- highlights
- onboarding illustrations
- campaign/marketing moments
- accent badges
- warm calls to attention

Do not use as an error color.

### Sunbeam Yellow — Optimism accent
**HEX:** `#FBBF24`
Use for:
- achievement moments
- highlights
- friendly empty states
- progress illustrations
- rating stars

Avoid large yellow text blocks.

### Fresh Teal — Growth / skill accent
**HEX:** `#14B8A6`
Use for:
- skill areas
- training
- career progress
- supportive success-adjacent moments

---

# 5. Neutral palette

### Ink 950
`#0F172A`
Primary heading text.

### Slate 700
`#334155`
Body text.

### Slate 500
`#64748B`
Secondary labels and metadata.

### Slate 300
`#CBD5E1`
Borders and disabled dividers.

### Slate 200
`#E2E8F0`
Light borders.

### Slate 100
`#F1F5F9`
Muted panels.

### Cloud 50
`#F8FAFC`
Page background.

### White
`#FFFFFF`
Cards, modals and primary surfaces.

---

# 6. Semantic colors

### Success
`#16A34A`
Tint background: `#DCFCE7`

### Warning
`#D97706`
Tint background: `#FEF3C7`

### Error
`#DC2626`
Tint background: `#FEE2E2`

### Info
`#0284C7`
Tint background: `#E0F2FE`

### Verified
`#0F766E`
Tint background: `#CCFBF1`

Important: do not rely on color alone. Pair status with icon + label.

---

# 7. Brand gradients
Use gradients sparingly, mostly in marketing surfaces, onboarding and premium/celebratory moments.

### Primary Hero Gradient
`linear-gradient(135deg, #2563EB 0%, #4F46E5 55%, #7C3AED 100%)`

### Warm Joy Gradient
`linear-gradient(135deg, #FF6B6B 0%, #F59E0B 100%)`

### Skill Growth Gradient
`linear-gradient(135deg, #14B8A6 0%, #2563EB 100%)`

Do not use gradients for long-form content backgrounds or dense tables.

---

# 8. Color placement rules

## Marketing website
- White/Cloud backgrounds dominate.
- Use Primary Hero Gradient in hero, campaign strips or CTA sections.
- Use Coral/Yellow/Teal as small visual accents.
- Use large photos with simple color blocks.
- Maximum 2 vibrant accents in one section.

## Employer web app
- More restrained.
- White / Cloud backgrounds.
- Horizon Blue as primary interaction color.
- Indigo for selected secondary navigation or analytics.
- Coral/Yellow only for highlights, not primary workflow.
- Semantic colors reserved for true states.

## Admin console
- Most restrained environment.
- Neutral surfaces dominate.
- Blue for action.
- semantic status colors only where needed.
- No decorative gradient on dense operational screens.

## Worker Flutter app
- Most expressive product surface.
- Friendly tinted cards.
- Bright but controlled accents.
- Larger visual states and progress cards.
- More illustration than employer/admin products.

---

# 9. Typography

## English UI
Primary family: **Inter**
Fallback: system sans-serif stack.

Why:
- highly readable
- contemporary
- excellent across web/mobile
- works for dense tables and friendly consumer UI

## Nepali / Devanagari UI
Primary family: **Noto Sans Devanagari**
Fallback: system Devanagari sans-serif.

Do not mix decorative Nepali fonts inside application UI.

## Marketing display typography
Use Inter with stronger weight and larger tracking contrast rather than adding a second display font.

### Weight system
- 400 Regular — body
- 500 Medium — labels and controls
- 600 Semibold — card titles, navigation
- 700 Bold — page titles, hero copy
- 800 ExtraBold — limited hero/marketing use

### Type scale
- Display XL: 56 / 64
- Display: 48 / 56
- H1: 36 / 44
- H2: 30 / 38
- H3: 24 / 32
- H4: 20 / 28
- Body L: 18 / 28
- Body: 16 / 24
- Body S: 14 / 20
- Caption: 12 / 16

Mobile:
- H1: 30 / 38
- H2: 24 / 32
- H3: 20 / 28
- Body: 16 / 24
- Caption: 12 / 16

Never use body text below 14px on the web or 14sp equivalent on mobile for primary information.

---

# 10. Shape language

The UI should feel soft and modern, not square and rigid.

### Radius scale
- XS: 6px
- S: 10px
- M: 14px
- L: 18px
- XL: 24px
- Pill: 999px

Use:
- buttons: 12–14px
- input fields: 12px
- cards: 16–20px
- bottom sheets/modals: 20–24px
- avatars/status chips: pill

Avoid excessive “bubble UI”. Large cards should still have clear hierarchy.

---

# 11. Spacing system
Use an 8pt base grid.

Tokens:
`4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96`

Default:
- control vertical padding: 12–14px
- card padding: 20–24px
- section gap: 32–48px
- mobile page side padding: 16–20px
- desktop content gutter: 24–32px

---

# 12. Elevation and shadows
Keep surfaces light and airy.

### Soft card shadow
`0 1px 2px rgba(15,23,42,.06), 0 6px 18px rgba(15,23,42,.06)`

### Floating surface
`0 12px 32px rgba(15,23,42,.12)`

Use borders more often than heavy shadows.

---

# 13. Icons
Use one consistent rounded icon family across web and mobile.
Recommended visual style:
- 1.75–2px stroke
- rounded corners
- simple silhouettes
- 20px / 24px standard sizes

Never mix filled, outlined and cartoon icons randomly.

---

# 14. Illustration style
Illustrations should feel:
- optimistic
- geometric
- modern
- culturally inclusive
- slightly playful

Use scenes around:
- skill growth
- verified identity
- teamwork
- training
- job success
- workplace safety
- earnings progress

Avoid generic corporate people in suits.

Prefer real Nepal work environments in photography and abstract illustrations in UI.

---

# 15. Photography direction
Use authentic, respectful imagery from Nepal where possible.

Subjects:
- electricians
- welders
- HVAC technicians
- plumbers
- factory teams
- maintenance teams
- hospitality workers
- women in trades
- supervisors
- training labs

Image mood:
- bright natural light
- confident people
- real tools
- clean workplaces
- teamwork

Avoid:
- poverty framing
- unsafe PPE
- dark industrial gloom
- staged “charity” compositions

---

# 16. Motion and delight
Motion should make the product feel alive, not distracting.

Use:
- 150–220ms micro-interactions
- soft ease-out transitions
- subtle card lift on hover
- progress completion animation
- tasteful checkmark on verification success
- small confetti only for meaningful milestones

Examples of milestone delight:
- profile 100% complete
- first verified credential
- first successful placement
- training completed

Avoid continuous animation in dashboards.
Respect reduced-motion settings.

---

# 17. UX emotion model by audience

## Worker app
Feel: **encouraging, proud, simple, energetic**

Use:
- progress indicators
- friendly success states
- visual skill chips
- job cards with clear wage/location
- achievement moments
- short, positive copy

## Employer app
Feel: **fast, confident, efficient, modern**

Use:
- clean dashboards
- concise tables
- strong filtering
- trustworthy profile cards
- clear status chips

## Admin app
Feel: **controlled, precise, safe**

Use:
- dense but readable layouts
- neutral palette
- strong audit/state visibility
- minimal decorative elements

---

# 18. Navigation style

## Marketing site
Desktop: top nav + strong CTA.
Mobile: clean drawer or full-screen sheet.

## Employer web app
Desktop-first sidebar.
Recommended structure:
- Dashboard
- Recruitment
- Workforce
- Sites
- Attendance
- Payroll
- Training
- Reports
- Billing
- Settings

## Worker mobile app
Bottom navigation with max 5 primary destinations:
- Home
- Jobs
- Work
- Learn
- Profile

Keep secondary features inside profile or contextual flows.

---

# 19. Components and visual behavior

## Buttons
Primary: Blue background / white text.
Secondary: White / blue border / blue text.
Tertiary: text-only blue.
Destructive: red only for destructive actions.

No more than one dominant primary CTA per visual region.

## Cards
Use white or lightly tinted background.
Cards may use thin accent strip or icon circle to add personality.
Avoid rainbow card grids.

## Inputs
Large, 44px+ touch height.
Clear label above field.
Helper text below.
Use inline validation.
Never use placeholder as the only label.

## Chips
Use for:
- skills
- availability
- categories
- filters
- status

## Worker card
Must prioritize:
1. Name/photo
2. role/skill
3. verification
4. experience
5. location
6. availability
7. rating

## Job card
Prioritize:
1. role
2. employer
3. wage
4. location
5. work type
6. start date
7. match reasons

---

# 20. Tone of voice

## Worker-facing
Friendly, short, encouraging.

Good:
- “Your profile is 80% complete.”
- “Add one more skill to improve your matches.”
- “Great! Your certificate is verified.”

Avoid:
- “You have failed verification.”
Use:
- “We couldn’t verify this document yet. Please check the details and try again.”

## Employer-facing
Direct and professional.

Good:
- “18 verified electricians match this requirement.”
- “3 workers have credentials expiring this month.”

## Admin-facing
Precise and operational.

Good:
- “Credential rejected — issuer could not be verified.”

---

# 21. Bilingual design rules
- English and Nepali from first market release.
- Never hard-code strings.
- UI layouts must allow 25–35% text expansion.
- Avoid overly formal Nepali.
- Preserve legal/certificate names in their official language where required.
- Number/date formatting should respect locale.

---

# 22. Accessibility
Target WCAG 2.2 AA.

Minimum requirements:
- 4.5:1 body-text contrast
- 3:1 large text and UI indicators
- keyboard navigation on web
- visible focus states
- 44×44 minimum touch targets
- screen-reader labels
- reduced-motion support
- status never communicated by color alone

Joyful design must never reduce readability.

---

# 23. Responsive behavior

## Marketing website
Breakpoints:
- Mobile: <640
- Tablet: 640–1023
- Desktop: 1024+

## Employer app
Optimized for desktop first, functional tablet support.

## Worker app
Phone-first. Must work well on budget Android devices and slower connections.

---

# 24. Dark mode
Do not make dark mode a launch blocker.
If implemented:
- use Slate 950/900 surfaces
- avoid pure black
- reduce saturation of accents slightly
- preserve semantic contrast
- do not simply invert colors

---

# 25. Product personality by generation

## Gen Z
Responds well to:
- speed
- visual progress
- clear personalization
- modern motion
- short copy

## Gen Y / Millennials
Responds well to:
- utility
- trust
- career growth
- transparent earnings and benefits
- polished mobile UX

## Gen X
Responds well to:
- clarity
- reliability
- readable typography
- strong support
- minimal friction

The solution is not separate themes. The shared design language should be:
**simple + energetic + trustworthy + legible**.

---

# 26. Brand misuse rules
Do not:
- use more than 3 brand accents in one screen
- use gradients in tables
- use red for non-error attention
- overuse rounded cards around every element
- place text directly over busy photos
- use low-contrast pastel text
- over-animate operational workflows
- make workers look like “gig commodities”
- use government-style seals without authorization

---

# 27. Design token requirements
All platforms must use shared semantic tokens.

Never hard-code brand colors directly in feature screens.
Use semantic tokens such as:
- `color.action.primary`
- `color.text.primary`
- `color.surface.canvas`
- `color.status.success`
- `radius.card`
- `space.4`

The token source should generate or map into:
- CSS variables / Tailwind theme for web
- Flutter ThemeData / extension tokens
- Figma variables

---

# 28. Figma system requirements
Create:
- Brand foundations page
- Color variables
- Typography styles
- Spacing/radius/elevation tokens
- Core components
- Worker app components
- Employer components
- Admin components
- Marketing sections
- Empty/loading/error states
- Mobile + desktop templates

Every component should have:
- default
- hover where applicable
- pressed
- focus
- disabled
- loading
- error where applicable

---

# 29. Marketing website visual direction
The website should communicate:
**“Skills have value. Work should open doors.”**

Homepage visual rhythm:
1. Bright hero with human photography + gradient accent
2. Trust statistics on neutral background
3. Worker journey on tinted cards
4. Employer product demo on white
5. Skill categories with lively iconography
6. Worker stories / employer proof
7. Training / growth ecosystem
8. Strong final CTA

Avoid long corporate text blocks.

---

# 30. Final visual rule
Every screen should pass this test:

**Would this feel welcoming to a 22-year-old technician, clear to a 42-year-old site supervisor, and credible to a 52-year-old business owner?**

If yes, the visual system is doing its job.

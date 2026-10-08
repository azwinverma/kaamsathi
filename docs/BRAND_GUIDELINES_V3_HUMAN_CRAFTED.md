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

---

# Human-Crafted Product Standard — Anti-Generic / Anti-“AI-Looking” Rules

This section is mandatory across the public website, employer web app, admin console, Flutter worker app, illustrations, copy, motion, and all future extensions.

## Core principle

The product must **not look like a generic AI-generated SaaS template**.

The target feeling is:

**designed by a thoughtful Nepal-based product team, shaped by real worker and employer behavior, and refined through intentional visual decisions.**

The system may use AI internally as a development aid, but the visible experience must never feel like:
- a template assembled from common AI-generated landing-page patterns
- a random collection of gradients, glassmorphism and oversized rounded cards
- generic startup copy such as “Empowering the future of work”
- repetitive 3-column feature blocks on every page
- interchangeable SaaS illustrations
- excessive sparkle/star icons
- generated-looking stock people
- fake metrics, fake testimonials or placeholder logos
- perfectly symmetrical pages with no editorial rhythm
- copy that sounds over-polished, vague, exaggerated or robotic

## Originality rule

Every major page must contain at least one **product-specific visual idea** derived from the real workforce ecosystem, such as:
- Worker Passport
- verified-skill timeline
- worker-to-employer matching strip
- job-site roster view
- earnings history snapshot
- skill ladder
- credential stack
- attendance streak
- work-history timeline
- training-to-employment pathway
- Nepal city/district workforce activity visualization

If a visual could be copied into a fintech, food-delivery, CRM or healthcare site without modification, it is probably too generic.

## Avoid generic AI SaaS composition

Do not repeatedly default to:

**Hero → logo cloud → 3 feature cards → gradient CTA → testimonials → FAQ**

Instead use editorial variation:
- asymmetric layouts
- alternating information density
- full-width product demonstrations
- human stories
- visual timelines
- documentary-style photography
- quiet whitespace between dense product sections
- intentionally different page rhythms

Pages should feel **art-directed**, not generated from one template.

## Controlled gradients

Gradients are accents, not the identity.

Use them sparingly for:
- hero atmosphere
- achievement moments
- onboarding
- campaigns

Avoid:
- gradient text everywhere
- purple/blue gradients on every card
- rainbow gradients
- glowing borders on normal components
- blur/glow everywhere
- gradients behind dense forms or tables

Most product UI should use solid surfaces.

## Shape language

Avoid making every object a giant pill or rounded floating card.

Use:
- 10–16px radius for standard product cards
- smaller radii for dense business tools
- pills only for statuses, filters, tags and compact actions
- rectangular structure in employer/admin data views
- expressive curves mainly in marketing artwork

Do not put every icon inside a colored circle.
Whitespace can replace unnecessary containers.

## Editorial hierarchy

Every screen must clearly decide:
1. what should be noticed first
2. what is secondary
3. what should recede
4. what is interactive
5. where color is deserved

A human-designed interface makes choices; everything should not have equal visual weight.

## Nepal-specific authenticity

Use real work contexts:
- Kathmandu, Lalitpur, Bhaktapur, Biratnagar, Pokhara, Butwal and other relevant places
- workshops
- factories
- construction sites
- hotels
- repair shops
- solar installations
- restaurants
- warehouses
- technicians with real tools
- realistic PPE and uniforms

Avoid using temples, mountains, prayer flags or national symbols as decorative shortcuts unless contextually relevant.

Local identity should come from **people, language, jobs and environments**, not tourism clichés.

## Photography direction

Photography should feel documentary and candid.

Prefer:
- real workers
- natural light
- actual workplaces
- meaningful interaction
- tools, hands, materials and work in progress
- natural expressions

Avoid:
- corporate handshakes
- staged office high-fives
- overly polished stock photos
- implausibly clean industrial settings
- generic “person smiling at phone” shots
- AI-generated faces unless explicitly approved for a specific campaign

When practical, commission original photography in Nepal.

## Illustration direction

If illustration is used, build a proprietary visual language:
- consistent proportions
- recognizable line/shape system
- restrained palette
- recurring workforce motifs
- realistic tools and PPE

Avoid:
- generic flat-vector people
- AI-style 3D clay characters
- random isometric offices
- inconsistent illustration styles
- one-off generated artwork that does not match the system

## Iconography

Use one icon family consistently.

Create custom domain icons only where valuable, such as:
- Worker Passport
- verified skill
- shift
- job site
- credential
- attendance
- training
- payroll
- placement
- trust

Avoid decorative icons without meaning.

## Human copywriting

Copy must be direct, specific and grounded.

Prefer:
- “12 electricians available in Lalitpur”
- “Your citizenship document is being reviewed”
- “You worked 24 days this month”
- “3 employers viewed your profile”
- “Complete this certificate to improve your match score”

Avoid:
- “Unlock your potential”
- “Empowering dreams”
- “Revolutionizing the workforce”
- “Seamless experiences”
- “Supercharge your journey”
- “Next-generation workforce transformation”
- “AI-powered innovation” unless AI itself is the feature

Do not overuse exclamation marks.
Do not make every empty state humorous.
Do not use childish language for workers.

Warmth should come from clarity and respect.

## Nepali language quality

Nepali text must be written naturally, not translated word-for-word.

Requirements:
- native-speaker review for core UI
- prefer commonly understood terms
- keep accepted English technical words where forced Nepali translation reduces clarity
- avoid bureaucratic language unless legally necessary
- test with workers of different ages and literacy levels

Both Nepali and English should feel intentionally authored.

## Design for real-world friction

Production screens must support:
- incomplete worker profiles
- weak connectivity
- older Android devices
- expired documents
- duplicate identities
- misspelled names
- uncertain addresses
- users without email
- changed phone numbers
- rejected verification
- attendance disputes
- wage/payment disputes
- workers without certificates
- employers managing hundreds of workers

A polished UI that only works with perfect demo data is unacceptable.

## Generation-aware, not generation-themed

Serve Gen Z, Millennials/Gen Y and Gen X with one coherent product.

For Gen Z:
- speed
- progress
- expressive but restrained micro-interactions
- quick actions

For Millennials:
- polished utility
- career progression
- data and earnings visibility
- productivity

For Gen X:
- clarity
- trust
- larger readable typography
- obvious navigation
- predictable workflows

Do not create a gimmicky “Gen Z theme”.

## Delight must be earned

Use delight at meaningful moments:
- first verified skill
- successful placement
- identity verified
- certification earned
- attendance milestone
- first salary record
- training completed
- repeat employer hire

Possible treatments:
- subtle motion
- small celebratory illustration
- gentle haptic feedback
- progress transformation
- short positive copy

Do not celebrate every save, login or filter action.

## Motion principles

Motion should explain state and relationship.

Recommended:
- 120–180ms for control feedback
- 180–260ms for normal transitions
- 250–400ms for larger content transitions

Avoid:
- floating background objects
- infinite gradients
- parallax everywhere
- excessive bounce
- animated blobs
- motion that delays the user

Respect reduced-motion preferences.

## Proprietary components

Build recognizable product-specific components such as:
- Worker Passport
- Verification Ladder
- Skill Stack
- Match Reason Card
- Job Readiness Meter
- Employment Timeline
- Employer Trust Summary
- Site Roster Strip
- Credential Card
- Career Progression Rail

These should become visual signatures of the product.

## Public website

Do not make the public website look like a generic SaaS landing page.

Recommended narrative:
1. real workforce problem
2. real worker/employer scenario
3. actual product demonstration
4. Worker Passport
5. workforce management
6. career progression
7. trust and verification
8. real outcomes
9. partner ecosystem
10. clear CTA

Use actual interface fragments, not fake dashboard decoration.

## Employer web app

Employer UI should feel:
- efficient
- calm
- modern
- trustworthy
- operational

Keep dense screens mostly neutral.
Use vibrant colors mainly for actions, status, matching, onboarding and selected analytics.

Do not make the employer portal look like a consumer app stretched onto desktop.

## Worker Flutter app

The worker app may be warmer and more expressive.

Use:
- strong welcome state
- visible progress
- large primary actions
- skill and credential cards
- job match clarity
- career-growth cues
- earnings clarity
- simple navigation
- meaningful celebrations

Maintain dignity. Do not gamify workers as avatars.

## Admin console

Admin UI should prioritize:
- information density
- verification speed
- auditability
- risk visibility
- clear states

Decorative branding should be minimal.

## No fake social proof

Never ship:
- invented customer logos
- fake testimonials
- fake placement counts
- generated worker reviews
- arbitrary “10,000+ users” claims

Use real pilot/customer data only.

## Anti-AI design QA checklist

Before accepting a page or screen, reviewers must ask:
- Could this belong to any random SaaS product?
- Are there too many rounded cards?
- Are gradients doing most of the design work?
- Is the copy vague or over-polished?
- Are icons decorative rather than useful?
- Does photography look stock/generated?
- Is the layout too repetitive or symmetrical?
- Is there a real product-specific visual?
- Is there an intentional focal point?
- Does it reflect a real Nepal workforce scenario?
- Would a worker understand it immediately?
- Would an employer trust it?
- Does it still work with messy real data?

If the page feels generic, it is not ready.

## Mandatory design process

No major page should go directly from prompt to production.

Required:

**Brief → wireframe → visual direction → component review → implementation → responsive QA → accessibility QA → human design review → production**

For important screens, compare at least two deliberate layout directions before implementation.

The first AI-generated composition should never be accepted merely because it is technically correct.

## Source of truth

Maintain:
- Figma design system
- design tokens
- component inventory
- UX writing guide
- photography guide
- icon library
- motion guide
- accessibility checklist

Coding agents must implement approved patterns rather than inventing visual language screen by screen.

## Mandatory rules for Claude and coding agents

1. Do not use generic SaaS templates.
2. Do not add colors outside approved semantic tokens.
3. Do not use gradients unless explicitly allowed.
4. Do not wrap every section in a card.
5. Do not fabricate testimonials or metrics.
6. Do not create a new visual style for every screen.
7. Reuse approved components.
8. Prefer domain-specific UI patterns.
9. Keep copy specific, natural and respectful.
10. Use realistic Nepal-oriented development fixtures.
11. Preserve whitespace and hierarchy.
12. State which design-system components are used for each major screen.
13. Propose a component addition before inventing a one-off pattern.
14. “Looks modern” is not an acceptance criterion.
15. UI must look intentionally art-directed and human-reviewed.

## Final acceptance criterion

A screen is not complete merely because it:
- compiles
- matches the functional requirement
- is responsive
- uses brand colors

It is complete only when it also feels:

**specific, intentional, credible, culturally grounded, visually balanced and recognizably part of this product.**

The final experience must feel **crafted, not generated**.

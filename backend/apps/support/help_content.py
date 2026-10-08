# ruff: noqa: E501 - markdown prose
"""Starter help-center articles (bilingual, markdown). Inserted by migration 0003 and the support
demo when the slug does not exist yet — ops edit them afterwards in /ops/support → Help center,
so this file is only the initial copy.

Figures match docs/CONTRACT.md (minimum wage effective 2025-07-17, SSF 11% + 20%, OT 1.5×).
"""

ARTICLES = [
    {
        "slug": "how-hajiri-works",
        "audience": "worker",
        "category": "attendance",
        "order": 10,
        "title_en": "How hajiri (attendance) works",
        "title_ne": "हाजिरी कसरी काम गर्छ",
        "body_en": """Your employer records your attendance (hajiri) every working day in KaamSathi.

**How it is marked**
- **QR check-in:** scan the QR code at your work site with the KaamSathi app when you arrive and leave. Your phone's location must be inside the site area.
- **Supervisor:** your supervisor can mark you present, absent, half day or on leave.

**What each mark means**
- *P* present · *H* half day · *A* absent · *L* approved leave · *PH* public holiday · *WO* weekly off.

**Why it matters**
Your monthly wage is calculated from these marks. Days with no mark that are not a holiday or weekly off count as **absent**.

**If something is wrong**
Open **My hajiri** in the app and check each day. If a day is wrong, ask your supervisor first. If it is not fixed, raise a dispute from the app — KaamSathi will review it.""",
        "body_ne": """तपाईंको रोजगारदाताले हरेक कामको दिन कामसाथीमा तपाईंको हाजिरी राख्छ।

**हाजिरी कसरी लाग्छ**
- **QR चेक-इन:** काममा आइपुग्दा र फर्किँदा कामसाथी एपबाट कार्यस्थलको QR कोड स्क्यान गर्नुहोस्। तपाईंको फोनको लोकेसन कार्यस्थलको क्षेत्रभित्र हुनुपर्छ।
- **सुपरभाइजर:** सुपरभाइजरले तपाईंलाई हाजिर, गैरहाजिर, आधा दिन वा बिदामा भनी चिन्ह लगाउन सक्छन्।

**चिन्हको अर्थ**
- *P* हाजिर · *H* आधा दिन · *A* गैरहाजिर · *L* स्वीकृत बिदा · *PH* सार्वजनिक बिदा · *WO* साप्ताहिक बिदा।

**किन महत्त्वपूर्ण छ**
तपाईंको मासिक तलब यिनै हाजिरीबाट हिसाब हुन्छ। बिदा वा साप्ताहिक बिदा नभएको र हाजिरी नलागेको दिन **गैरहाजिर** मानिन्छ।

**गल्ती भएमा**
एपमा **मेरो हाजिरी** खोलेर हरेक दिन जाँच्नुहोस्। गल्ती भए पहिले सुपरभाइजरलाई भन्नुहोस्। नसच्चिए एपबाट उजुरी (डिस्प्युट) दर्ता गर्नुहोस् — कामसाथीले हेर्नेछ।""",
    },
    {
        "slug": "how-payslips-are-calculated",
        "audience": "worker",
        "category": "pay",
        "order": 20,
        "title_en": "How your payslip is calculated",
        "title_ne": "तपाईंको तलबपर्ची कसरी हिसाब हुन्छ",
        "body_en": """KaamSathi calculates wages for each Nepali (BS) month.

1. **Payable days** = days present + paid leave + public holidays + weekly offs (half days count as ½).
2. **Basic and dearness allowance (DA)** are paid for payable days: *monthly amount × payable days ÷ days in the month*. Daily-wage workers are paid *daily wage × days present*.
3. **Overtime** is paid at **1.5 ×** your normal hourly rate.
4. **SSF:** if you are enrolled, **11 %** of your basic is deducted and your employer adds **20 %** — 31 % goes to your Social Security Fund account.
5. **Tax (TDS)** is deducted only if your yearly income is above the tax-free limit.
6. **Advance (peski)** you took is recovered in the agreed monthly instalment.

**Net pay** = everything earned − SSF 11 % − tax − advance recovery − other deductions.

You can see and download every payslip under **Payslips** in the app. If a number looks wrong, raise a dispute from the payslip.""",
        "body_ne": """कामसाथीले हरेक नेपाली (वि.सं.) महिनाको तलब हिसाब गर्छ।

1. **तलब पाउने दिन** = हाजिर दिन + तलबी बिदा + सार्वजनिक बिदा + साप्ताहिक बिदा (आधा दिनलाई ½ मानिन्छ)।
2. **आधारभूत तलब र महँगी भत्ता** तलब पाउने दिनअनुसार दिइन्छ: *मासिक रकम × तलब पाउने दिन ÷ महिनाका दिन*। दैनिक ज्यालादारीलाई *दैनिक ज्याला × हाजिर दिन* दिइन्छ।
3. **ओभरटाइम** सामान्य प्रतिघण्टा दरको **१.५ गुणा** दिइन्छ।
4. **SSF:** सामाजिक सुरक्षा कोषमा दर्ता हुनुहुन्छ भने आधारभूत तलबको **११%** कट्टा हुन्छ र रोजगारदाताले **२०%** थप्छ — जम्मा ३१% तपाईंको खातामा जान्छ।
5. **कर (TDS)** वार्षिक आम्दानी करमुक्त सीमाभन्दा बढी भए मात्र कट्टा हुन्छ।
6. **पेस्की** लिएको भए सहमति भएको मासिक किस्तामा असुल हुन्छ।

**खुद तलब** = जम्मा कमाइ − SSF ११% − कर − पेस्की असुली − अन्य कट्टी।

एपको **तलबपर्ची** मा हरेक तलबपर्ची हेर्न र डाउनलोड गर्न सकिन्छ। कुनै अङ्क गलत लागे तलबपर्चीबाटै उजुरी गर्नुहोस्।""",
    },
    {
        "slug": "how-verification-works",
        "audience": "worker",
        "category": "verification",
        "order": 30,
        "title_en": "How verification works",
        "title_ne": "प्रमाणीकरण कसरी हुन्छ",
        "body_en": """Verified workers are shown first to employers and earn a higher verification level.

**Identity:** a KaamSathi staff member checks your citizenship card (front and back) and photo. This is free — **workers never pay KaamSathi**.

**Work history:** every month you work with an employer that records hajiri on KaamSathi is verified automatically. You can also add earlier jobs with a reference person we can call.

**Skills:** upload your NSTB / CTEVT certificates or take a skill assessment.

Your documents are encrypted and only KaamSathi staff can see your ID. Employers see only your photo after they shortlist or employ you.""",
        "body_ne": """प्रमाणित कामदार रोजगारदातालाई पहिले देखिन्छन् र उच्च प्रमाणीकरण तह पाउँछन्।

**पहिचान:** कामसाथीका कर्मचारीले तपाईंको नागरिकता (अगाडि र पछाडि) र फोटो जाँच्छन्। यो निःशुल्क छ — **कामदारले कामसाथीलाई कहिल्यै पैसा तिर्नु पर्दैन।**

**कामको अनुभव:** कामसाथीमा हाजिरी राख्ने रोजगारदातासँग गरेको हरेक महिनाको काम आफैं प्रमाणित हुन्छ। पहिलेका कामहरू सन्दर्भ व्यक्तिको फोन नम्बरसहित थप्न सकिन्छ।

**सीप:** NSTB / CTEVT प्रमाणपत्र अपलोड गर्नुहोस् वा सीप परीक्षा दिनुहोस्।

तपाईंका कागजात इन्क्रिप्ट गरेर राखिन्छन् र नागरिकता कामसाथीका कर्मचारीले मात्र हेर्न सक्छन्। रोजगारदाताले छनोट वा नियुक्ति गरेपछि मात्र तपाईंको फोटो देख्छन्।""",
    },
    {
        "slug": "report-a-problem",
        "audience": "all",
        "category": "safety",
        "order": 40,
        "title_en": "How to report a problem or get help",
        "title_ne": "समस्या कसरी जनाउने वा सहयोग कसरी लिने",
        "body_en": """**Wrong hajiri, payslip or work dates:** open the record in the app and choose *Raise a dispute*. Your employer has 7 days to answer; KaamSathi decides within 7 days after that.

**Anything else:** open **Help & support → New case**, choose a category and describe the problem. You will get a case number like *KS-000123*. We reply within:
- urgent: 4 hours · high: 1 day · normal: 3 days · low: 7 days.

**By phone:** call the KaamSathi helpline. For your safety we will verify your identity with a one-time code before changing your phone number or bank details.""",
        "body_ne": """**हाजिरी, तलबपर्ची वा कामको मिति गलत भए:** एपमा त्यो अभिलेख खोलेर *उजुरी गर्नुहोस्* छान्नुहोस्। रोजगारदाताले ७ दिनभित्र जवाफ दिनुपर्छ; त्यसपछि ७ दिनभित्र कामसाथीले निर्णय गर्छ।

**अन्य कुनै समस्या:** **सहायता → नयाँ केस** खोलेर प्रकार छान्नुहोस् र समस्या लेख्नुहोस्। तपाईंले *KS-000123* जस्तो केस नम्बर पाउनुहुन्छ। हामी यति समयभित्र जवाफ दिन्छौं:
- अत्यावश्यक: ४ घण्टा · उच्च: १ दिन · सामान्य: ३ दिन · न्यून: ७ दिन।

**फोनबाट:** कामसाथी हेल्पलाइनमा फोन गर्नुहोस्। तपाईंको सुरक्षाका लागि फोन नम्बर वा बैंक विवरण फेर्नुअघि एक पटके कोडबाट पहिचान पुष्टि गरिन्छ।""",
    },
    {
        "slug": "safety-at-work",
        "audience": "worker",
        "category": "safety",
        "order": 50,
        "title_en": "Safety at work: unsafe sites, harassment, unpaid wages",
        "title_ne": "कामको सुरक्षा: असुरक्षित कार्यस्थल, दुर्व्यवहार, तलब नपाउनु",
        "body_en": """You can report a safety problem **confidentially**. Your employer does **not** see the report unless KaamSathi needs to share it to solve the problem — and you can ask to stay anonymous even then.

Report in **Help & support → Report a safety problem** if:
- the site is unsafe (no helmet/harness at height, exposed wiring, no first aid),
- you face harassment, abuse or threats,
- your wages are being withheld.

Tick **Emergency** if you or someone else is in danger now — our team is alerted immediately.

**If life is in danger, call 100 (Police) or 102 (Ambulance) first.** For labour complaints you can also contact the nearest Labour and Occupational Safety Office.""",
        "body_ne": """तपाईं सुरक्षासम्बन्धी समस्या **गोप्य रूपमा** जनाउन सक्नुहुन्छ। समस्या समाधान गर्न आवश्यक नभएसम्म रोजगारदाताले उजुरी **देख्दैन** — त्यसबेला पनि तपाईं आफ्नो नाम लुकाउन अनुरोध गर्न सक्नुहुन्छ।

यस्तो अवस्थामा **सहायता → सुरक्षा समस्या जनाउनुहोस्** मा जानुहोस्:
- कार्यस्थल असुरक्षित छ (उचाइमा हेल्मेट/हार्नेस छैन, खुला बिजुली तार, प्राथमिक उपचार छैन),
- दुर्व्यवहार, हिंसा वा धम्की भोग्नुभएको छ,
- तलब रोकिएको छ।

अहिले नै कोही खतरामा भए **आपत्कालीन** मा टिक लगाउनुहोस् — हाम्रो टोलीलाई तुरुन्तै खबर जान्छ।

**ज्यान खतरामा भए पहिले १०० (प्रहरी) वा १०२ (एम्बुलेन्स) मा फोन गर्नुहोस्।** श्रमसम्बन्धी उजुरीका लागि नजिकको श्रम तथा व्यवसायजन्य सुरक्षा कार्यालयमा पनि जान सकिन्छ।""",
    },
    {
        "slug": "your-privacy-rights",
        "audience": "all",
        "category": "privacy",
        "order": 60,
        "title_en": "Your privacy rights",
        "title_ne": "तपाईंको गोपनीयताको अधिकार",
        "body_en": """Under the Individual Privacy Act 2075 your data belongs to you.

- **See who viewed your profile:** every view by an employer or partner is logged and shown to you.
- **Consent:** a bank, insurer or agency can see your data only after you agree, for a stated purpose and time. You can withdraw at any time.
- **Download your data:** request an export of everything KaamSathi holds about you.
- **Correct or delete:** ask us to correct wrong details or delete your account. Payroll and attendance records your employer must keep by law are kept, but linked to an anonymous record.

Find all of this under **Privacy** in the app.""",
        "body_ne": """वैयक्तिक गोपनीयता ऐन २०७५ अनुसार तपाईंको डाटा तपाईंकै हो।

- **प्रोफाइल कसले हेर्‍यो:** रोजगारदाता वा साझेदारले हेरेको हरेक पटक अभिलेख हुन्छ र तपाईंलाई देखाइन्छ।
- **सहमति:** बैंक, बीमा कम्पनी वा एजेन्सीले तपाईंले तोकिएको उद्देश्य र अवधिका लागि सहमति दिएपछि मात्र डाटा हेर्न पाउँछन्। जुनसुकै बेला सहमति फिर्ता लिन सकिन्छ।
- **डाटा डाउनलोड:** कामसाथीसँग भएको तपाईंको सबै विवरण माग्न सक्नुहुन्छ।
- **सच्याउने वा मेटाउने:** गलत विवरण सच्याउन वा खाता मेटाउन अनुरोध गर्न सक्नुहुन्छ। कानुनले रोजगारदातालाई राख्न लगाएका तलब र हाजिरीका अभिलेख भने नाम नखुल्ने गरी राखिन्छन्।

यी सबै एपको **गोपनीयता** मा पाइन्छ।""",
    },
    {
        "slug": "posting-a-job",
        "audience": "employer",
        "category": "hiring",
        "order": 110,
        "title_en": "Posting a job and getting a shortlist",
        "title_ne": "जागिर पोस्ट गर्ने र छोटो सूची पाउने",
        "body_en": """1. Go to **Jobs → New job**. Choose the trade, site, number of openings, wage and start date.
2. **Publish** the job. KaamSathi staff match verified, available workers and send you a **shortlist** — usually within 48 hours.
3. Move candidates through *Interview → Selected → Joined*. When a worker joins, their employment record and hajiri start automatically.

**Before your first shortlist** your organisation must be a **Verified employer**: upload your company registration and PAN certificate under **Account → Employer verification**.

The wage must be at least the government minimum wage, or the job cannot be saved.""",
        "body_ne": """१. **जागिर → नयाँ जागिर** मा जानुहोस्। पेसा, कार्यस्थल, पद संख्या, तलब र सुरु मिति छान्नुहोस्।
२. जागिर **प्रकाशित** गर्नुहोस्। कामसाथीका कर्मचारीले प्रमाणित र उपलब्ध कामदार खोजेर **छोटो सूची** पठाउँछन् — प्रायः ४८ घण्टाभित्र।
३. उम्मेदवारलाई *अन्तर्वार्ता → छनोट → कामभर्ना* मा अगाडि बढाउनुहोस्। कामदार भर्ना भएपछि रोजगारी अभिलेख र हाजिरी आफैं सुरु हुन्छ।

**पहिलो छोटो सूचीअघि** तपाईंको संस्था **प्रमाणित रोजगारदाता** हुनुपर्छ: **खाता → रोजगारदाता प्रमाणीकरण** मा कम्पनी दर्ता प्रमाणपत्र र PAN प्रमाणपत्र अपलोड गर्नुहोस्।

तलब सरकारले तोकेको न्यूनतम पारिश्रमिकभन्दा कम भए जागिर सेभ हुँदैन।""",
    },
    {
        "slug": "minimum-wage",
        "audience": "employer",
        "category": "compliance",
        "order": 120,
        "title_en": "Minimum wage in Nepal",
        "title_ne": "नेपालमा न्यूनतम पारिश्रमिक",
        "body_en": """The minimum wage effective **2025-07-17 (2082 Shrawan 1)** is:

| | Amount (NPR) |
|---|---|
| Monthly basic | 12,170 |
| Dearness allowance | 7,380 |
| **Monthly total** | **19,550** |
| Daily | 754 |
| Hourly | 101 |
| Hourly (part-time) | 107 |

KaamSathi blocks jobs and employments below these amounts. Overtime must be paid at 1.5 × the hourly rate, with at most 24 hours of overtime per week.

Rates are revised by the government; KaamSathi updates them when a new notice is published.""",
        "body_ne": """**२०८२ साउन १ (2025-07-17)** देखि लागू न्यूनतम पारिश्रमिक:

| | रकम (रु.) |
|---|---|
| मासिक आधारभूत तलब | १२,१७० |
| महँगी भत्ता | ७,३८० |
| **मासिक जम्मा** | **१९,५५०** |
| दैनिक | ७५४ |
| प्रतिघण्टा | १०१ |
| प्रतिघण्टा (आंशिक समय) | १०७ |

यीभन्दा कम तलबका जागिर र रोजगारी कामसाथीले स्वीकार गर्दैन। ओभरटाइम प्रतिघण्टा दरको १.५ गुणा दिनुपर्छ र हप्तामा बढीमा २४ घण्टा मात्र।

सरकारले दर परिमार्जन गर्छ; नयाँ सूचना आएपछि कामसाथीले अद्यावधिक गर्छ।""",
    },
    {
        "slug": "ssf-for-employers",
        "audience": "employer",
        "category": "compliance",
        "order": 130,
        "title_en": "Social Security Fund (SSF) contributions",
        "title_ne": "सामाजिक सुरक्षा कोष (SSF) योगदान",
        "body_en": """For every SSF-enrolled worker the contribution is **31 % of basic salary** each month:
- **11 %** deducted from the worker's pay,
- **20 %** paid by you on top of the wage.

KaamSathi calculates both on each payslip and prepares the monthly **SSF file** (Payroll → SSF filing) with each worker's SSF ID. Upload it on the SSF portal and record the receipt number in KaamSathi.

Workers without an SSF ID are listed separately so you can register them. Enrolled workers are exempt from the 1 % social security tax slab.""",
        "body_ne": """SSF मा दर्ता भएका हरेक कामदारका लागि हरेक महिना **आधारभूत तलबको ३१%** योगदान हुन्छ:
- **११%** कामदारको तलबबाट कट्टा,
- **२०%** तपाईंले तलबमाथि थपेर तिर्ने।

कामसाथीले हरेक तलबपर्चीमा दुवै हिसाब गर्छ र मासिक **SSF फाइल** (तलब → SSF फाइलिङ) कामदारको SSF ID सहित तयार गर्छ। उक्त फाइल SSF पोर्टलमा अपलोड गरी रसिद नम्बर कामसाथीमा राख्नुहोस्।

SSF ID नभएका कामदार छुट्टै सूचीमा देखिन्छन्, ताकि तपाईं उनीहरूलाई दर्ता गर्न सक्नुहुन्छ। दर्ता भएका कामदारलाई १% सामाजिक सुरक्षा कर लाग्दैन।""",
    },
    {
        "slug": "replacement-guarantee",
        "audience": "employer",
        "category": "hiring",
        "order": 140,
        "title_en": "The 30-day replacement guarantee",
        "title_ne": "३० दिने सट्टा कामदार ग्यारेन्टी",
        "body_en": """When you hire through KaamSathi, a placement fee is charged once the worker **joins**.

If that worker leaves (resigns, is let go or stops coming) **within 30 days of starting**, end their employment in KaamSathi with the right reason. The next worker you hire for the same need through KaamSathi is placed **without a new placement fee**.

The guarantee date is shown on each employment as *Replacement eligible until*.""",
        "body_ne": """कामसाथीबाट कामदार भर्ना गर्दा कामदार **कामभर्ना** भएपछि एक पटक प्लेसमेन्ट शुल्क लाग्छ।

सो कामदारले काम सुरु गरेको **३० दिनभित्र** छोडेमा (राजीनामा, निकाला वा काममा नआउने) कामसाथीमा सही कारणसहित रोजगारी अन्त्य गर्नुहोस्। सोही आवश्यकताका लागि कामसाथीबाट भर्ना गर्ने अर्को कामदारको **नयाँ प्लेसमेन्ट शुल्क लाग्दैन**।

ग्यारेन्टीको मिति हरेक रोजगारीमा *सट्टा कामदार पाउने अन्तिम मिति* मा देखिन्छ।""",
    },
]


def install(HelpArticle) -> int:
    """Create missing articles (published); existing slugs are left as ops edited them."""
    made = 0
    for article in ARTICLES:
        _obj, created = HelpArticle.objects.get_or_create(
            slug=article["slug"], defaults={**article, "is_published": True}
        )
        made += int(created)
    return made

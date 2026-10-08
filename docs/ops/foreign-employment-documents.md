# SOP — Foreign-employment documents (mobility)

| | |
| --- | --- |
| Owner | Ops lead. `partner_manager` for agency compliance. |
| Performed by | `verifier` (documents), `partner_manager` (agencies) |
| Tools | Worker app → Foreign employment (documents, eligible agencies, share/revoke). Ops `/ops/mobility` → `GET /ops/mobility/documents?status=`, `POST /ops/mobility/documents/{id}/verify`, `GET /ops/mobility/agencies`, `POST /ops/mobility/agencies/{partner_id}/compliance`. Partner API `GET /partner/workers/{id}/mobility`. **In progress** (`apps.mobility`). **Switched off** until the phase-5 gate is met ([ROADMAP.md](../ROADMAP.md#phase-5--foreign-employment-document-passport)). |

## Purpose and boundaries

Many Nepali workers go abroad through manpower agencies. They lose documents, pay illegal fees,
and get cheated by unlicensed brokers (दलाल). KaamSathi helps in one narrow way: the worker keeps
**verified copies** of their own documents and can share them, for a limited time, with a
**DoFE-licensed** agency **they choose**.

**What we never do (strategy rule, permanent):**
- recruit, match, advertise or shortlist for jobs abroad
- recommend a specific agency, country or employer
- accept any payment from workers or agencies tied to a worker going abroad
- send document images or full document numbers to agencies (the partner API returns verified
  flags, kinds, expiry dates and masked numbers only)

## Documents

| Group | Kind | Nepali | Verify |
| --- | --- | --- | --- |
| travel | `passport` | राहदानी | Name, DOB and photo match the identity-verified profile. Number, expiry ≥ 6 months for a useful share. |
| travel | `labour_permit` | श्रम स्वीकृति (from DoFE) | Name, passport number, destination, employer, dates. Previous permits also support work history. |
| travel | `visa` | भिसा | Type (work, not visit), validity |
| clearance | `police_clearance` | प्रहरी चारित्रिक प्रमाणपत्र (Nepal Police) | Issue date. Many destinations need it to be recent: record `expires_on` as the issue date + the validity the agency states. |
| clearance | `medical_fitness` | स्वास्थ्य परीक्षण प्रतिवेदन | From a medical centre approved for foreign-employment checks; issue date, validity |
| clearance | `pre_departure_orientation` | अभिमुखीकरण तालिम प्रमाणपत्र | Orientation institute, date |
| clearance | `insurance` | बीमा | Insurer, period |
| clearance | `language_test` | e.g. EPS-TOPIK (Korea), JFT/JLPT (Japan) | Score or level, test date |

## Steps — document verification

1. Pick the oldest `pending` document. The worker must be identity-verified (KYC). A passport
   name that differs from citizenship → check the spelling only. A different person → reject and
   go to [fraud-escalation.md](fraud-escalation.md).
2. Check the document image (signed link), the dates and the issuer. The number is stored
   encrypted. Never copy it into notes.
3. If in doubt, ask the worker for a clearer image, or use the issuer's own verification portal
   where one exists (e.g. DoFE labour permit lookup). Note what you checked.
4. Decide `verified` or `rejected` with a note. Expiry reminders go out automatically at 60, 30
   and 7 days (`mobility.tasks.expiry_reminders`, 08:30).

## Steps — agency compliance (before any agency appears to workers)

1. The agency is created as a partner of kind `recruitment_agency`.
2. Check its licence on the **official DoFE website** (dofe.gov.np licensed agencies list). Check
   the name, licence number and that it isn't suspended. Record the URL and the date checked.
3. Check its physical office (visit or video call) and that the contact person is listed with DoFE.
4. Sign the data agreement:
   - purpose limited to the worker's own application
   - no onward sharing
   - deletion after the grant expires
   - no fees to workers through us
5. Set `compliance_status=verified`, `license_valid_until`, and a note. Only then is it eligible
   (licence unexpired, status verified).
6. **Re-check every 6 months** and whenever the news or DoFE reports action against agencies.
   Suspended or expired → set `suspended`. Active grants stay revocable by the worker, and ops
   tells affected workers.

## Sharing (worker-initiated only)

- The worker picks an eligible agency and a duration (≤ 90 days). This creates a `ConsentGrant`
  with purpose `recruitment` and scopes `passport.read` and `mobility.read`.
- The worker can revoke it any time. Every agency read is logged and shown to the worker.
- Staff never create a share on the worker's behalf, even if asked by phone.

## Safety guidance (shown in the app; staff repeat it on calls)

| English | नेपाली |
| --- | --- |
| Use only agencies licensed by the Department of Foreign Employment. Check the licence on the official DoFE website. | वैदेशिक रोजगार विभागबाट इजाजतप्राप्त म्यानपावर कम्पनी मात्र प्रयोग गर्नुहोस्। इजाजत विभागको आधिकारिक वेबसाइटमा जाँच्नुहोस्। |
| Get a receipt for every payment. Never pay more than the government-set fee for your destination. | हरेक भुक्तानीको रसिद लिनुहोस्। गन्तव्य देशका लागि सरकारले तोकेको शुल्कभन्दा बढी नतिर्नुहोस्। |
| Never hand over your original passport without a written receipt. | लिखित भरपाई बिना सक्कल राहदानी कसैलाई नदिनुहोस्। |
| Go only with a labour permit (श्रम स्वीकृति). Never travel on a visit visa for work. | श्रम स्वीकृति लिएर मात्र जानुहोस्। भिजिट भिसामा काम गर्न नजानुहोस्। |
| Read your contract before you go: wage, hours, employer, return ticket. | जानुअघि सम्झौता पढ्नुहोस्: तलब, कामको समय, रोजगारदाता, फर्किने टिकट। |
| If something is wrong, complain to the Department of Foreign Employment. | केही गडबड भएमा वैदेशिक रोजगार विभागमा उजुरी गर्नुहोस्। |

## Decision rules

- Any staff member who hears of a broker (दलाल) or agency taking money through a KaamSathi
  contact → [fraud-escalation.md](fraud-escalation.md), high severity. Tell the worker about
  DoFE's complaint process.
- A worker asks "which agency is good?" → don't recommend one. Show the eligible list and the
  checks they can do themselves.
- A worker asks for a job abroad → explain that we don't do that (support script 8 in
  [support-scripts.md](support-scripts.md)).

## SLA

| Case | Target |
| --- | --- |
| Document verification | 3 working days |
| Agency compliance check | 10 working days |
| Agency suspension after negative information | same working day |

## Audit trail

Document and agency decisions are audited. Every partner read appears in `PartnerAccessLog`,
the audit log and the worker's access log. Grants record when they were created, expire and
were revoked.

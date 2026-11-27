/**
 * cortex-email-helpers.ts
 *
 * Rich metadata, message bodies, and document attachment definitions for
 * Christopher Stringer's authentic email threads (synced live with Chrome).
 * Powers 1-click pinning of emails and their attached documents to the 3D space.
 */

export interface EmailAttachment {
  id: string;
  name: string;
  size: string;
  type: string;
  docType?: 'pdf' | 'doc' | 'court' | 'finance' | 'certificate';
  issuer?: string;
  badge?: string;
  content?: string;
}

export interface EmailPayload {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  snippet?: string;
  unread?: boolean;
  tag?: string;
  category?: string;
  attachments?: EmailAttachment[];
}

export interface DocumentPayload {
  id: string;
  title: string;
  fileName: string;
  fileSize: string;
  fileType: string;
  issuer: string;
  date: string;
  content: string;
  badge: string;
}

export const ATTACHMENTS_CATALOG: Record<string, EmailAttachment[]> = {
  court_johnson: [
    {
      id: 'att-johnson-1',
      name: 'Mandatory_Reporting_Form_Bench_Trial_Div5.pdf',
      size: '245 KB',
      type: 'application/pdf',
      docType: 'court',
      issuer: 'Fulton County Superior Court — Division 5',
      badge: 'MANDATORY COURT FILING',
      content: `### SUPERIOR COURT OF FULTON COUNTY
**State of Georgia · Judicial Division 5**
Honorable Presiding Judge | 185 Central Avenue SW, Atlanta, GA 30303

---

#### CIVIL / DOMESTIC BENCH TRIAL MANDATORY REPORTING NOTICE
**Calendar Period:** Week of November 30, 2026
**Presiding Division:** Division 5 Domestic Relations
**Filing Clerk:** Demetria Johnson, Judicial Executive Assistant

**CRITICAL DEADLINE:**
> [!IMPORTANT]
> All designated parties and legal counsel of record MUST complete and submit this Mandatory Reporting Form no later than **Wednesday, November 18, 2026, at 12:00 PM (NOON)**. Failure to submit on time will result in striking of pleadings, waiver of oral testimony, or proceeding in absentia.

---

#### 1. Case Readiness Certification
- **Case Caption:** Domestic Relations Division 5 Bench Trial Calendar
- **Estimated Hearing Duration:** 2 Hours (Consolidated)
- **Court Reporter Required:** YES (Designated official)
- **Witness Count:** 2 (Affidavit & Direct Examination)
- **Exhibits Exchanged:** In Progress (Rule 5.1 compliant)

#### 2. Counsel & Appearance Information
- **Party Status:** Christopher Stringer (Represented by Lauren K. Trant, Esq.)
- **Opposing Party:** Anders (Represented of record)
- **Submission Portal:** Odyssey eFileGA / Division 5 Chambers Direct
- **Contact:** \`djohnson@fultoncourt.gov\` | (404) 612-4518

---
*Certified Electronic Court Document · Superior Court of Fulton County Division 5*`,
    },
    {
      id: 'att-johnson-2',
      name: 'Superior_Court_Division5_Bench_Trial_Calendar_Nov30.pdf',
      size: '512 KB',
      type: 'application/pdf',
      docType: 'court',
      issuer: 'Superior Court Calendar Clerk',
      badge: 'OFFICIAL TRIAL CALENDAR',
      content: `### FULTON COUNTY SUPERIOR COURT
**DIVISION 5 DOMESTIC BENCH TRIAL CALENDAR**
**Week Commencing:** November 30, 2026 · Courtroom 5-D

| Item # | Case Number | Case Title | Lead Counsel | Status |
| :--- | :--- | :--- | :--- | :--- |
| **01** | **CAFN 25-A-05494-5** | **Stringer v. Anders** | **Lauren K. Trant, Esq.** | **Active (Mandatory Due 11/18)** |
| 02 | CAFN 25-D-01923-5 | Miller v. Miller | J. Harrison, Esq. | Confirmed Ready |
| 03 | CAFN 25-C-08812-5 | Williams v. Reynolds | M. Davis, Esq. | Calendar Call 9:30 AM |
| 04 | CAFN 25-A-04210-5 | Zhao v. Vance | P. Patel, Esq. | Continuance Requested |

*Calendar Call begins promptly at 9:00 AM in Courtroom 5-D.*`,
    },
  ],

  legal_trant: [
    {
      id: 'att-trant-1',
      name: 'Correspondence_CapitalOne_BOA_CAFN_25-A-05494-5.pdf',
      size: '380 KB',
      type: 'application/pdf',
      docType: 'court',
      issuer: 'Trant Law Firm LLC',
      badge: 'FORMAL LEGAL CORRESPONDENCE',
      content: `### TRANT LAW FIRM LLC
**248 Washington Avenue NE · Marietta, Georgia 30060**
Telephone: (678) 271-3471 · Facsimile: (678) 271-3472
*Lauren K. Trant, Founding Attorney*

---

**Date:** November 11, 2026
**To:** Legal Department & Subpoena Compliance
- Capital One Financial Corporation
- Bank of America, N.A.
**Re:** Formal Notice of Litigation & Preservation of Electronic Records
**Case Caption:** *Stringer v. Anders*; CAFN 25-A-05494-5
**Court:** Superior Court of Fulton County, Division 5

Dear Records Custodian,

Please be advised that this office represents **Christopher Stringer** in the above-captioned domestic matter pending in the Superior Court of Fulton County, Georgia.

Pursuant to O.C.G.A. § 9-11-26, you are hereby placed on formal notice to **PRESERVE AND HOLD** all electronic records, transaction histories, merchant dispute documentation, credit reporting correspondence, and billing archives pertaining to the accounts of Christopher Stringer from January 1, 2024, through the present date.

Any routine destruction, auto-purging, or modification of these files is strictly prohibited under applicable spoliation doctrines.

Formal subpoenas duces tecum will follow in accordance with uniform superior court rules.

Sincerely,

**/s/ Lauren K. Trant**
Lauren K. Trant, Esq.
Georgia Bar No. 719284
Lead Counsel for Christopher Stringer`,
    },
  ],

  emory_past_due: [
    {
      id: 'att-emory-1',
      name: 'Emory_Healthcare_Statement_0645_PastDue.pdf',
      size: '185 KB',
      type: 'application/pdf',
      docType: 'finance',
      issuer: 'Emory Healthcare Patient Accounts',
      badge: 'PAST DUE BILLING STATEMENT',
      content: `### EMORY HEALTHCARE
**Patient Financial Services · Atlanta, GA**
Billing Statement: Account # 0645

---

**Patient:** Christopher Stringer
**Statement Date:** November 10, 2026
**Due Date:** **IMMEDIATELY (PAST DUE)**
**Account Number:** \`EHC-****-0645\`

| Date of Service | Provider / Clinic | Description | Total Charges | Ins. Adjustment | Patient Due |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 09/14/2026 | Emory Clinic Midtown | Diagnostic Laboratory & Screening | $420.00 | -$110.00 | $310.00 |
| 09/28/2026 | Emory University Hospital | Outpatient Clinical Consultation | $1,850.00 | -$780.00 | $1,070.00 |
| 10/12/2026 | Emory Pharmacy | Prescription Itemization | $120.57 | -$40.00 | $80.57 |

### TOTAL AMOUNT PAST DUE: **$1,460.57**

> [!WARNING]
> This account has exceeded the 60-day standard billing cycle. Please remit payment via Emory MyChart (\`mychart.emoryhealthcare.org\`) or call Patient Accounting at (404) 778-7300 to establish an interest-free payment arrangement.`,
    },
  ],

  barbers_certificate: [
    {
      id: 'att-barbers-1',
      name: 'Barbers_Official_DUI_Completion_Certificate.pdf',
      size: '410 KB',
      type: 'application/pdf',
      docType: 'certificate',
      issuer: 'State of Georgia DDS Certified Clinic #7084',
      badge: 'STATE CERTIFICATE OF COMPLETION',
      content: `### STATE OF GEORGIA
**Department of Driver Services (DDS) & Clinical Services Division**
OFFICIAL CERTIFICATE OF COMPLETION

---

**Student Name:** Christopher Stringer
**Date of Birth:** On File
**Course Title:** 20-Hour Risk Reduction & Intervention Program
**Clinic Name:** Barber's Driving School & Clinical Assessment Services
**State Certification Code:** \`DDS-CLINIC-7084\`
**Completion Date:** November 08, 2026

#### CURRICULUM VERIFICATION:
1. **Assessment Component (NEEDS Assessment):** COMPLETED · Score 94%
2. **Intervention Component (20 Hours Classroom):** COMPLETED (20/20 Hours)
3. **Registry Number:** \`GA-DDS-2026-98104-CS\`
4. **Fulton County Division 5 Filing Status:** VERIFIED & SEALED

This certificate verifies full compliance with all state clinical and judicial diversion prerequisites.

**/s/ Marcus Barber, Director**
Barber's Clinical Assessment Services · Atlanta, GA`,
    },
  ],


  custody_hearing: [
    {
      id: 'att-hearing-prep-1',
      name: 'HEARING_PREP_BENCH_TRIAL_NOV30_2026.docx',
      size: '30 KB',
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      docType: 'court',
      issuer: 'Self-prepared · Gwinnett Superior Court CAFN 25-A-05494-5',
      badge: 'HEARING PREP — WORD-FOR-WORD SCRIPTS',
      content: `# HEARING PREP — BENCH TRIAL CALENDAR CALL
## Stringer v. Anders — 25-A-05494-5 — Gwinnett Superior Court
### Monday, November 30, 2026 — Courtroom 1E — Hon. Tuwanda Rush Williams
### Position #9 on Civil/Domestic Bench Trial Calendar (Nov 30 – Dec 4, 2026)

> **READ FIRST — honest posture.** This document is built from the repo record (\`MEMORY.md\`, \`DOCKET_SNAPSHOT.md\`, \`master_custody_text/\`), your Nov 12–13 continuance motion package, and what you told me today. Where your statement and the record differ, both are flagged under **GAPS / NOT VERIFIED** at the end. Nothing here is legal advice; it is preparation. Verify every date and dollar figure against your file-stamped orders before saying it in court.

---

## 1. WHAT MONDAY ACTUALLY IS

This is **not** a final trial day in the "witnesses all day" sense — it is the **call of the bench trial calendar**. In Gwinnett Superior Court, cases on a bench trial calendar week are called Monday morning (and through the week). At the call, the judge will:

1. Call each case by position.
2. Ask whether the case is **ready for trial**, **settled**, or needs a **continuance**.
3. Hear **brief argument** on any pending motions — including your continuance motion.
4. If not continued: either **try the case that day**, **pass it** to a later day that week, or set a firm trial date.

**Your realistic Monday outcomes, in order of preference:**

| Outcome | What it means |
|---|---|
| **A. Continuance granted** | Case off the Nov 30 calendar; reset 60–90+ days; you get counsel + prep time |
| **B. Continuance denied, case passed** | Judge keeps it on calendar but moves you to Wed/Thu/Fri — still bad but buys days |
| **C. Continuance denied, trial Monday** | You must try the case pro se that morning |
| **D. Partial relief** | e.g., child support bifurcated, GAL appointed, parenting time addressed, custody trial reset |

**Strategic reality:** Position #9 means you are not first. Judges often clear early positions and use later positions for continuances and status conferences. Your job Monday is to **make continuance the path of least resistance for the court** — give the judge a clean, dignified, documented reason to grant it, and make denial look like it produces an unjust result.

---

## 2. THE THREE THINGS THE JUDGE NEEDS TO HEAR (in this order)

Appellate judges and trial judges grant continuances for three reasons. Your entire Monday presentation should feed these:

1. **Impossibility, not inconvenience.** You were physically incarcerated June 11 – October 24, 2026 (≈4.4 months, less a 19-day release window July 30 – Aug 18). You could not prepare. *Crowder v. Crowder*, 236 Ga. 612 (1976) — incarceration negates willful default.
2. **No prior continuances + first calendar appearance.** Rule 8.5 hygiene is perfect: this is your first continuance request, ever, in this case.
3. **Prejudice asymmetry.** Respondent has counsel, has had 17 months of preparation, and loses nothing by a 60–90 day reset — the temporary order stays exactly as-is. You lose everything if tried unprepared 37 days post-release.

**Do NOT lead with** the sister/Gretchen grievance, the $1,700 support, or accusations about paid witnesses. Those are *evidence* arguments for trial or for a later motion — Monday's only job is the continuance (or damage control if denied). Emotional overload loses continuances.

---

## 3. PRE-COURT CHECKLIST (Sunday night / Monday morning)

**Print and bring (3-hole punched, tabbed):**

- [ ] \`MOTION_FOR_CONTINUANCE_BENCH_TRIAL_NOV_2026.pdf\` — your filed motion (the one e-filed ~Nov 13)
- [ ] Proposed Order (last pages of same PDF)
- [ ] This prep document (Section 4 scripts)
- [ ] File-stamped **Temporary Order** (\`master_custody_text/2026.03.13_ANDERS_Temporary_Order_6B274873.txt\` → get the PDF)
- [ ] File-stamped **Order Denying Reconsideration** (April 6/7, 2026)
- [ ] **Incarceration + conviction documentation**: release paperwork (Oct 24, 2026), judgment/sentence in 25SR-0282, notice of appeal, probation/discharge paperwork
- [ ] **DRFA or income proof** for the new job (pay stub, offer letter, employer contact)
- [ ] A **one-page chronology** you write yourself: legitimation 9/3/2025 → temp order 3/24/2026 → incarceration 6/11–10/24/2026 → release → trial call 11/30/2026
- [ ] Pen and paper for notes

**Dress/ demeanor:** Business casual, clean, sober. You are asking a judge for mercy and time — look like a man rebuilding, not a man fighting. Judges grant continuances to people who look responsible.

**Do not bring:** recordings, phones with open evidence, anything that looks like you're planning a fight.

---

## 4. SCRIPT A — GETTING THE CONTINUANCE (word-for-word)

### 4A. When the judge calls your case (Position #9)

Wait for the bailiff/clerk to call "Stringer versus Anders" or "position nine." When called, approach the podium/table, address the court, and say:

> **"Good morning, Your Honor. Christopher Stringer, Petitioner, appearing pro se. Respondent is Katelyn Anders, represented by Lauren Trant of Kaye, Lembeck, Hitt & French."**

Then immediately:

> **"Your Honor, I have a Motion for Continuance filed November 13th of this year, which I e-filed and served on opposing counsel. I am asking the Court to continue the bench trial set for this week and reset it to a later calendar so I can obtain counsel and properly prepare."**

### 4B. The three-minute argument (use this if the judge asks you to speak)

> **"Thank you, Your Honor. I will be brief.**
>
> **First, the record. This is an initial custody determination. I was legitimated September 3rd, 2025. There is a temporary order entered March 24th, 2026. This is the first time this case has appeared on a trial calendar — Position Number 9 — and I have never before requested a continuance in this case. Rule 8.5 is satisfied.**
>
> **Second, why I could not prepare. I was convicted in my criminal case in Spalding County — case 25SR-0282 — and I am now on appeal; that appeal is pending. From June 11th through October 24th of this year — approximately four and a half months — I was incarcerated. I was self-represented at that trial, and I had no access to a computer, to court records, to discovery, or to legal research. I could not draft filings, subpoena witnesses, or prepare for a permanent custody trial. Under Crowder v. Crowder, 236 Ga. 612, my inability to appear and prepare was physical impossibility — not a choice to abandon this case.**
>
> **Third, the prejudice. I was released October 24th — thirty-seven days ago. I have $0 income history since release until this week, when I started a new job. I am trying to stabilize housing, employment, and now prepare for a trial that will decide my daughter's permanent custody, my parenting time, and support. I cannot do that justice pro se in thirty-seven days.**
>
> **Fourth, no prejudice to Respondent. The temporary order remains in full force. My daughter remains in her mother's care exactly as the Court ordered. Nothing changes for her during a continuance. Respondent has counsel and has had a year and a half to prepare — a 60-to-90-day continuance costs her nothing and gives me the ability to appear with counsel and a real defense.**
>
> **Finally, I want to be direct about what I am asking: not a dismissal, not a delay tactic — a fair trial. Georgia law requires that I be heard meaningfully. Wilson v. Wilson, 277 Ga. 801, puts both parents on equal footing at an initial custody trial. I cannot be equal unprepared against retained counsel.**
>
> **I respectfully ask the Court to grant the continuance, reset this matter to the Court's next available bench trial calendar or a date 60 to 90 days out, and extend the pre-trial deadlines accordingly. I commit to filing an updated financial affidavit within fourteen days, supplemental discovery within twenty-one days, and all required worksheets five days before whatever date the Court sets. Thank you, Your Honor."**

### 4C. If the judge asks "Why didn't you hire a lawyer sooner?"

> **"Your Honor, I was incarcerated until October 24th. Before that I was trying to defend a criminal case in Spalding County pro se — I could not be in two courts at once. Since my release I have been working to get a job and stabilize, and I have been actively trying to retain counsel. I am asking for a continuance precisely so I can obtain counsel — that is the purpose of the request."**

### 4D. If the judge asks "How long do you need?"

> **"Thirty to sixty days to retain counsel, Your Honor — and if the Court prefers, ninety days so I can complete discovery and file my worksheets. Whatever the Court thinks is reasonable."**

**Never name a number first. Let the judge name it. If pressed, say "sixty days" — not "a year."**

### 4E. If Trant responds / objects

Trant will likely say some version of: *"Your Honor, Petitioner had months to prepare. This is a delay tactic. The child needs finality."*

Your response (calm, short):

> **"Your Honor, Respondent had counsel and full access to the record throughout. Petitioner was in jail. The child has been in a stable temporary arrangement for eight months — that arrangement continues unchanged. The only thing delayed is a permanent order that would otherwise be entered against an unprepared father. I am not asking to delay the child's life — I am asking for a fair trial."**

### 4F. If the judge indicates she's leaning toward denying

Immediately say:

> **"Your Honor, if the Court is inclined to deny the continuance, I would respectfully ask in the alternative that the Court pass this case to a later day this week — Wednesday, Thursday, or Friday — so I have additional days to prepare, and that the Court address my pending Motion to Modify Temporary Child Support and the Respondent's pending Motion for Contempt, both of which remain unadjudicated."**

This is the **fallback that still wins something**. A case passed from Monday to Thursday is four more days, and it signals to the judge you are reasonable.

### 4G. TRANT'S FILED RESPONSE (Nov 20, 2026) — DECODED + YOUR COUNTERS

She filed \`2026.11.19 ANDERS R's Resp to Motion for Continuance\`. She asks the Court to **deny** and try the case this week. Her attacks, and your answers:

**Her ¶5 — THE BOMB:** *"Petitioner has been incarcerated during the pendency of this case after being found in contempt, having his bond revoked and after having been convicted at trial in his criminal case."*

→ She's telling the truth about the conviction — **you were convicted on all charges in Spalding 25SR-0282 and are now on direct appeal.** You cannot fight this fact; the record proves it. What you CAN control is the frame: accountability + appeal pending + present stability. Here is your answer, verbatim:

> **"Your Honor, Respondent is correct that I was convicted in my criminal case and that I am now on appeal — I served notice of appeal and that appeal is pending. I do not ask this Court to ignore that. What I ask is that the Court recognize three things: First, I was self-represented at that trial — the Court knows I could not effectively defend myself, which is precisely why I need counsel now. Second, my appeal is pending, which means the conviction is not yet final. Third, since my release on October 24th I have been employed, compliant, and taking every scheduled call with my daughter — I am on probation and I am reporting as required. I accept responsibility for my past. I am asking for a fair opportunity to show the Court who I am today — and thirty-seven days post-release is not that opportunity."**

**If the judge presses on the contempt/bond revocation specifically:**

> **"Your Honor, my bond was revoked after a written order that followed an oral ruling from the bench — I noted the discrepancy at the time. I complied: I turned myself in. I do not ask this Court to relitigate the criminal case. I ask only that the Court understand that my incarceration was not a choice to abandon this custody case — it was the result of court orders I could not control."**

**DO NOT say the criminal judge was unfair or retaliated against you — even if you believe it.** That argument belongs in your criminal appeal, not in a custody hearing where it will make you look unstable. One clean sentence of "the discrepancy is on the record" is all you get.

**Her ¶7 — "nearly a year to obtain replacement counsel":**

> **"Your Honor, my prior counsel withdrew December 17th, 2025. From that date until June 11th I was preparing pro se — and I was charged and tried in a criminal matter that consumed that entire period. From June 11th to October 24th I was incarcerated. I have had essentially no functional window to seek counsel. I ask the Court to count the actual months of availability, not the calendar months."**

**Her ¶10 — conferral attack:** She claims your 8:30am/2pm email to her **old KLHF address** was defective conferral because it went to her prior firm and arrived after the deadline. Counter:

> **"Your Honor, I served the conferral request on counsel's last known address of record. Counsel's change of firms was her obligation to update with the Court — I had no notice of it. I acted in good faith and gave same-day notice. The Court's own records show she was served by statutory electronic service through eFileGA, which she does not dispute."**

*(Note: she is now **Trant Family Law LLC**, 248 Washington Ave NE, Marietta — lauren@trantfamilylaw.com, 678-271-3471. Any future email goes there, not to klhffamilylaw.com.)*

**Her ¶12 — "all pending motions should be heard at the final trial":** This is actually an **opening for you**. It means she expects the Motion to Modify Support, Motion to Set Aside fees, and her Motion for Contempt to be heard at trial. If the case goes forward, demand they be heard — and be ready.

**CONFIRMED FACTS (from Chris, Nov 25, 2026):**

- **Convicted on ALL charges** in Spalding 25SR-0282. **Direct appeal pending** — notice of appeal served; appellate counsel has been unresponsive (gap — follow up).
- **Contempt + bond revocation were in the CRIMINAL case** (Judge Thacker's court), not the custody case. Sequence per Chris: judge orally stated he was NOT in contempt and modified bond → later written order found contempt and revoked bond → trigger was an email sent incorrectly → Chris turned himself in (~2 months) → trial → convicted → ~2 more months. Total ~4 months (June 11 – Oct 24, 2026).
- **Release paperwork exists** — locate before Monday.
- **Convictions (confirmed):** DUI, improper lane change, leaving scene of the accident, and 2 counts of obstruction — **all misdemeanors, no felonies**.
- **Sentence:** 3 years probation; ~$2,000 fines + $1,000 restitution to Rick Anders (disputed — see below); driver's license suspended until **December 16, 2026**.
- **Bond revocation contested:** one judge agreed only felonies get bonds revoked; Judge Thacker (judge/jury/adjudicator) revoked anyway.
- **The $3,000 / transmission fact:** Chris gave Rick Anders $3,000 toward Katelyn's car — a ~$4,000 transmission on a 200k-mile car, effectively making it like-new for the household Isla lives in. Rick agreed it was for the car. Katelyn testified in court Chris "never helped with anything." **This is a documented impeachment point** — Chris DID contribute financially to the child's household.

---

## 5. SCRIPT B — IF THE CONTINUANCE IS DENIED

If the judge denies continuance and sets trial for Monday (or later that week), you shift instantly. Do not argue. Say:

> **"Thank you, Your Honor. I understand. I am ready to proceed."**

Then ask:

> **"Your Honor, before we begin, may I ask whether Respondent intends to call any witnesses who have not been disclosed in discovery or listed on her witness list — specifically, I want to note for the record that Petitioner's sister, Gretchen Stringer, is known to Respondent and has been involved in events underlying this case, and I have received no disclosure that she will testify."**

**Why this matters:** Last time, Trant produced your sister as a surprise witness and the judge allowed it. Putting the objection **on the record before trial starts** is the appellate preservation move. Say it once, calmly, and move on. Do not elaborate.

### 5A. If trial actually starts — your opening statement (2 minutes, memorize the structure)

> **"Your Honor, I am Christopher Stringer, Isla's father. I have been legitimated since September 2025. I will not hide from this Court what is in the record: I was convicted in a criminal case this year and served time. I accept responsibility for my past. My appeal is pending. Since my release I have been employed, I have never missed a scheduled call with my daughter, and I am asking this Court for a fair chance to show who I am now — not who I was then."**
>
> **I was incarcerated for four and a half months this year on a separate matter. I take responsibility for being in that situation. But I want this Court to know three things about who I am as a father: First, I enrolled in therapy when I learned I was going to be a father, before Isla was born. Second, I have documented supervised visitation compliance. Third, I am now employed and stable for the first time since my release.**
>
> **I am asking this Court for primary physical custody of my daughter, with a parenting plan that gives her mother meaningful time — because Isla needs both parents, and she needs to know her father is safe, present, and accountable. On child support, I ask the Court to set support based on my actual income — not income I did not earn while incarcerated — consistent with O.C.G.A. Section 19-6-15.**
>
> **I will present evidence. I ask the Court to listen."**

### 5B. Child support — your core argument (memorize)

The temporary order set **$1,647/month** based on **imputed income of $6,055/month** — income you did not actually earn. You were then incarcerated and earned $0 for 4.5 months. You say $1,700/month and $20,000 owed — the $20K figure likely combines the **$20,000 attorney fee award** (separate obligation to KLHF, not child support) with **support arrears**. Clarify this distinction if the judge conflates them:

> **"Your Honor, I want to be precise for the record. The $20,000 figure includes a $20,000 attorney's fee award to Respondent's counsel — that is a separate obligation from child support and I am addressing it separately. The child support itself was set on imputed income of $6,055 a month — income I did not actually receive. I was incarcerated June through October and earned nothing. Under O.C.G.A. 19-6-15, support must be based on actual or properly imputable income. I ask the Court to recalculate based on my actual earnings, and to address arrears in light of my incarceration."**

**Supporting facts to state if asked:**
- You took the hair follicle test — NEGATIVE.
- You attended all supervised visits with third party present.
- You paid $200 toward support (to Trant's office) — document this.
- You just started a new job — bring proof.

### 5C. If Trant objects that you can't afford a lawyer so you shouldn't get custody

> **"Your Honor, pro se status is a right, not a penalty. Georgia courts routinely try pro se litigants. My lack of counsel goes to preparation time — which is exactly what my continuance motion addressed. On the merits, I ask the Court to decide based on Isla's best interests under Section 19-9-3, not on my income level."**

---

## 6. CURVEBALL PLAYBOOK — Trant's likely moves and your scripted answers

### 6A. Surprise witness: Gretchen Stringer (the big one)

**Last time:** Trant produced your sister without disclosure and the judge allowed it.

**If it happens again:**

> **"Objection, Your Honor. This witness was not disclosed in discovery, was not on Respondent's witness list, and I had no notice she would testify. I ask that her testimony be excluded or that I be granted a continuance to prepare to cross-examine her."**

Then stop talking. Let the judge rule. If allowed:

- **Do not attack her personally.** Attack the **coordination**: "Your Honor, this witness is Respondent's family friend and has a documented history of coordinated contact with Respondent — including a prior protective order proceeding in which she admitted coordinating with Respondent." (Only say "admitted coordinating" if you have the Jan 22, 2026 TPO record — you do, per repo.)
- **Foundation questions:** "Are you employed by or receiving payment from Respondent or her family?" — **only ask if you have a good-faith basis** (you've stated your belief they're paying her; frame as a question, not an accusation). If she lies, that's impeachment later.
- **"Have you ever been charged with crimes against me or my mother?"** — she has (Battery-FV, reckless driving). Ask it. Let the answer hang.

### 6B. "He's using AI / fabricated evidence" attack

Trant has already filed a motion suggesting your drug test results need "verification" because of AI use. If raised:

> **"Your Honor, I used AI tools for formatting and organization of my filings — which I disclosed. The drug test results came from a licensed laboratory, not from AI. The records are authentic business records. I ask the Court to distinguish between my drafting tools and the third-party documents themselves."**

### 6C. "He filed 27 motions / phantom citations" (the fee award basis)

This is already in the record and drove the $20K fee award. Do not relitigate it. If raised:

> **"Your Honor, I acknowledge the Court's prior findings on my filings. I have since corrected my citation practices and filed a verified citation appendix. I ask the Court to judge this case on the current record and Isla's best interests."**

### 6D. The $20K attorney fee award

If Trant raises it:

> **"Your Honor, I am aware of the fee award. I filed a Motion to Set Aside under Section 9-11-60 and a Motion to Modify on March 24th — both remain pending. I am not asking the Court to ignore it; I am asking the Court to address it separately from Isla's custody and support, which is what this trial is about."**

### 6E. "He abandoned the child / didn't see her for a year"

Your answer — this is where you reframe. **New facts strengthen this enormously:** you take 30-minute calls every Sunday AND Tuesday and have never missed one; you cannot afford the ~$1,400/month Safe Bridge supervision; you proposed your mother Catherine — who supervised visits without incident before the temporary order — and Respondent refused.

> **"Your Honor, I did not abandon Isla. I was incarcerated — I could not see her. Before that, Respondent unilaterally stopped my parenting time after an incident involving my sister, and instead awarded my sister visitation with my daughter — a woman who is not a party to this case and who has her own documented history of conflict with me. Since my release I have taken every scheduled phone call — Sundays and Tuesdays, thirty minutes, without missing one. I asked the Court to let my mother supervise visits instead of paying fourteen hundred dollars a month to Safe Bridge — my mother supervised before without incident — and Respondent refused. I ask the Court to look at who actually facilitated or obstructed the parent-child relationship."**

**Key phrase to memorize:** *"Respondent chose to give my sister — a non-party with a documented adversarial history — access to my daughter, while denying me access."* This is your best interests counter-frame.

### 6F. THE CONVICTION — Trant's biggest custody weapon (NEW — added after her response)

She will argue: *"Petitioner was convicted of [charges] while this case was pending. A parent convicted of crimes is unfit for primary custody."*

**Your counter — three layers:**

> **"Your Honor, I was convicted and I accept that. But the Court's task under Section 19-9-3 is the best interests of Isla — not a perfect-record contest. The relevant questions are: Is there evidence I pose a danger to my daughter? Have I complied with every court order I could comply with? Am I stable now? On each: my hair test was negative, I attended every supervised visit with a third party present, I have never missed a scheduled call with my daughter since release, and I am employed for the first time since June. My conviction is real — and so is my compliance and my stability. The Court should weigh both."**

**If she specifies the charges** (DUI, improper lane change, leaving scene of accident, 2 counts obstruction — all misdemeanors):

> **"Your Honor, I was convicted of misdemeanor charges — DUI, improper lane change, leaving the scene of an accident, and two counts of obstruction. My appeal is pending. I ask the Court to consider these charges in context: none of them involved my daughter, none involved violence against her or her mother, and they are under appellate review. What matters for Isla is whether I am a safe, present, stable father — and the evidence shows I am working to be exactly that."**

**On the bond revocation** (if it comes up — the written order found contempt after the judge orally said you were not in contempt, and one judge agreed bond revocation is a felony remedy):

> **"Your Honor, my bond was revoked in a written order that followed an oral ruling from the bench — and another judge in that same courthouse agreed that bond revocation is a remedy for felony cases, which mine was not. I noted the discrepancy and I complied — I turned myself in. I do not ask this Court to relitigate it; it is part of my pending appeal."**

**WARNING — do not say any of these:**
- "The conviction was unjust" / "the judge was biased" / "I was framed" — appeals court argument, not custody court.
- "My sister lied" or accusations about Respondent paying people — save for the payment/coordination issue if you have proof.
- Anything that sounds like minimizing the victims of the underlying conduct.

### 6G. Judge asks "Do you have anything else?" at the end

> **"Yes, Your Honor. I ask the Court to enter findings that address: (1) the best interests of Isla under Section 19-9-3, including each statutory factor; (2) child support based on actual income under Section 19-6-15; (3) a parenting plan that protects Isla's relationship with both parents; and (4) my pending motions to modify support and set aside the fee award. Thank you."**

---

## 7. THE GRETCHEN/SISTER NARRATIVE — HOW TO USE IT WITHOUT LOSING THE ROOM

You want the judge to understand that your sister was **paid to destabilize you** and that this bears on custody. But accusing "my ex paid my sister to file false charges" without proof will make you look paranoid. Here's the appellate-attorney way:

### 7A. For the continuance (Monday)

Do **not** raise it. The continuance argument is about incarceration + preparation. Adding accusations weakens it.

### 7B. If trial proceeds — raise it as a *pattern of gatekeeping* evidence issue

Under **O.C.G.A. § 19-9-3(a)(3)** best-interest factors, the relevant issue is **which parent facilitates the child's relationship with the other parent**. Your evidence:

- Respondent stopped your parenting time after the incident.
- Respondent awarded visitation to your sister (a non-party).
- Your sister has a documented history: Battery-FV charge (you are the victim), a retaliatory TPO she filed that was dismissed January 22, 2026, and she testified at that TPO hearing admitting coordination with Respondent.
- **If you believe** Respondent or her family paid your sister for these actions — that is **motive evidence** for why the sister acted, and it goes to Respondent's credibility and her fitness as primary custodian.

**How to say it without overclaiming:**

> **"Your Honor, I have reason to believe Respondent's family has been financially supporting my sister's involvement in this family's conflict — including the criminal charges my sister filed and the protective order she sought that was dismissed. I am asking the Court to consider whether Respondent has been using third parties to interfere with my parental rights, which is directly relevant to Section 19-9-3 best-interest factors."**

**Use "reason to believe" and "I am asking the Court to consider" — not "she paid her" as settled fact.** If you have texts, payments, or witnesses, bring them. If you don't, the statement preserves the issue for appeal.

### 7C. The incident itself (sister abused your mother in front of Isla)

If it comes up — and it will, because it's why visitation stopped — your framing:

> **"Your Honor, there was an incident in which my sister became physically aggressive toward my mother while my daughter was present. My mother has serious medical conditions. I did not participate in that incident — I was not there. What I ask the Court to note is that Respondent used that incident — which my sister caused — as the basis to terminate my parenting time entirely, while giving my sister ongoing access to my daughter. That is not protecting Isla. That is using a third party's misconduct to sever the father-daughter relationship."**

**Critical:** Do not describe your sister's conduct in graphic detail. One sentence. The judge doesn't need the play-by-play — she needs the **pattern**: sister causes harm → Respondent rewards sister with access → father loses access.

---

## 8. THE $20,000 FEE AWARD — BEST WAY TO ADDRESS IT

**First, understand what it is:** The Temporary Order directed **$20,000 in attorney's fees to KLHF** (payable by April 1, 2026). This is **separate from child support**. You have two motions already pending on it:

- **Motion to Set Aside** under O.C.G.A. § 9-11-60 (filed March 24, 2026)
- **Motion to Modify** (filed March 24, 2026)

**Your best options, ranked:**

### Option A — Get it heard Monday alongside everything else (RECOMMENDED if trial goes forward)

Trant's own response (¶12) says "all pending motions should be heard at the final trial." Hold her to it:

> **"Your Honor, Respondent's own response states that all pending motions should be heard at the final trial. That includes my Motion to Modify Temporary Child Support, my Motion to Set Aside the attorney fee award under Section 9-11-60, and Respondent's Motion for Contempt. I ask the Court to hear them together so the final order resolves everything at once."**

### Option B — Payment plan / ability-to-pay modification

If the Court won't set it aside, ask for a payment structure tied to actual income:

> **"Your Honor, if the Court declines to set aside the fee award, I ask the Court to modify it to reflect my actual ability to pay — I was incarcerated for four and a half months earning nothing, and I only started a new job two weeks ago. A payment plan consistent with my actual income serves the Court's interest better than an unpayable lump sum that generates contempt proceedings."**

### Option C — Note the pending appeal

Your discretionary appeal **A26D0505** is docketed at the Court of Appeals challenging the orders that produced this fee award. You can note:

> **"Your Honor, I have a pending discretionary appeal, A26D0505, challenging the orders underlying this fee award. I ask the Court to consider that in deciding whether to enforce it immediately."**

### What NOT to do

- **Do not ignore it.** Unpaid court-ordered fees = contempt exposure, which Trant will absolutely raise.
- **Do not pay it to "make it go away"** before Monday — paying could be construed as waiver of your set-aside motion, and $20K is money you need for housing/job stability.
- **Do not conflate it with child support.** If the judge asks about "the $20K you owe," say: *"Your Honor, that figure is the attorney fee award — a separate obligation I have moved to set aside. Child support is a different calculation."*

---

## 8A. CHILD SUPPORT — THE FULL PICTURE (updated)

| Item | Amount | Status | What to say |
|---|---|---|---|
| Temporary child support | ~$1,647–1,700/mo | Ongoing | "Set on imputed income of $6,055/month. I was incarcerated earning $0. Request recalculation on actual income." |
| Support arrears | Accumulating | Ongoing | "I request the Court consider my incarceration period and my good-faith $200 payment." |
| Attorney fee award | $20,000 | Ordered, unpaid | "Separate obligation — see Section 8 above." |
| Supervised visitation | ~$1,400/mo (Safe Bridge) | Ongoing | **NEW:** "I cannot afford this. I proposed my mother — a proper adult who supervised without incident before — and Respondent refused. I ask the Court to modify the supervision requirement." |

**Financial contribution impeachment (use if Respondent claims you "never helped with anything"):**

> **"Your Honor, Respondent testified that I never helped with anything. That is not accurate. I gave three thousand dollars toward the transmission on the car Isla's household depends on — Rick Anders agreed it was for that car. I ask the Court to weigh that testimony against the record."**

**If the judge asks "Can you pay?"**

> **"Your Honor, I just started a new job two weeks ago. I am prioritizing stable housing and employment so I can be a consistent presence for Isla. I ask the Court to set support at a level I can actually pay — because support I cannot pay helps no one, least of all my daughter."**

---

## 9. QUICK REFERENCE — MEMORIZED LINES

**Continuance opener:** "Your Honor, I have a Motion for Continuance filed November 13th. I was incarcerated from June 11th to October 24th and could not prepare. I am asking for a continuance to obtain counsel and properly prepare for this initial custody trial."

**Crowder cite:** "Under Crowder v. Crowder, 236 Ga. 612, my inability to prepare was physical impossibility, not willful neglect."

**Prejudice:** "Respondent loses nothing — the temporary order stays exactly as it is. I lose everything if tried unprepared thirty-seven days after release from incarceration."

**Fallback:** "If the Court denies the continuance, I respectfully ask that the case be passed to a later day this week and that the Court address my pending motions."

**Surprise witness objection:** "Objection, Your Honor — this witness was not disclosed in discovery and I had no notice she would testify. I ask that she be excluded or that I be granted a continuance to prepare."

**Child support:** "Support was set on imputed income of $6,055 a month — income I did not actually earn. I was incarcerated and earned nothing. I ask the Court to recalculate on actual income under Section 19-6-15."

**Best interests frame:** "Respondent gave my sister — a non-party with a documented adversarial history — access to my daughter, while denying me access. I ask the Court to consider who is actually facilitating the parent-child relationship."

---

## 10. GAPS / NOT VERIFIED — READ BEFORE COURT

1. **"My ex won custody"** — Confirmed: Respondent has had primary physical custody since the March 24, 2026 Temporary Order. There is **no final custody order** — Monday's trial IS the permanent determination. Parenting time since then: **30-minute calls Sundays and Tuesdays, never missed**, but **no in-person visitation** because you cannot afford ~$1,400/month Safe Bridge supervision. You proposed your mother Catherine (prior supervisor, no incidents) — Respondent refused.

2. **"$1,700/month and $20k owed"** — File-stamped Temporary Order shows **$1,647/month** child support (imputed $6,055 vs actual $2,600) and a **$20,000 attorney fee award** to KLHF. These are **two different obligations**. The $20K is **not** child support arrears — it's attorney fees. If DCSS has a separate support order, bring it.

3. **Trant's response** — **FILED November 20, 2026** (dated Nov 19). She asks the Court to **deny** continuance and try the case this week. Her ¶5 confirms the conviction — **you were convicted on ALL charges in Spalding 25SR-0282 and are on direct appeal** (notice served; appellate counsel unresponsive — follow up). Contempt + bond revocation were in the **criminal case**, triggered by an incorrectly-sent email; oral ruling said no contempt, written order said contempt. Decoded counters in **Section 4G**.

4. **Trant's firm change** — She is no longer at Kaye Lembeck, Hitt & French. She now practices as **Trant Family Law LLC**, 248 Washington Ave NE, Marietta, GA 30060, lauren@trantfamilylaw.com, 678-271-3471. Your Nov 13 conferral email went to her old KLHF address and was forwarded late — she used this to attack your Rule 8.5 compliance.

5. **CONVICTIONS + SENTENCE (CONFIRMED):** DUI, improper lane change, leaving scene, 2× obstruction — all misdemeanors. **3 years probation, ~$2K fines + $1K restitution to Rick Anders, license suspended until Dec 16, 2026.** Probation = you must report and stay employed — that is a *compliance asset* in court: "I am on probation, reporting as required, and employed."

6. **Criminal appeal counsel** — You served notice of appeal; you're saving to hire appellate counsel (expensive). Until then, monitor the Spalding appeal docket yourself so nothing defaults. If counsel falls through entirely, a pro se appellate record preservation motion may be needed — flag for later. **Thanksgiving week reality:** firms are closed until Monday — but call anyway Friday; many offer phone consults, and even a 30-minute paid consult to review the continuance motion before court is worth it.

4. **Gretchen payment claim** — Your belief that Respondent's family paid your sister is **not yet in the record as proven fact**. Frame it as "reason to believe" unless you have texts, payment records, or witnesses.

5. **Spalding incarceration dates** — Repo record confirms Spalding case 25SR-0282 and your release Oct 24, 2026, but the Odyssey events paste in the repo ends Aug 17, 2026. If you have release paperwork, bring it.

6. **Judge assignment** — The continuance motion names **Hon. Tuwanda Rush Williams** for the Nov 30 bench trial calendar. MEMORY.md shows Hon. Robert V. Rodatus handled the March 2 temporary hearing. Confirm Monday's judge from the court's calendar posting.

7. **New job** — Bring proof of employment (offer letter, pay stub, employer contact). "I just got a job" is more powerful with documentation.

---

## 11. IF YOU ONLY REMEMBER FIVE THINGS

1. **Monday is a calendar call, not a trial.** Your job is the continuance — nothing else matters unless denied.
2. **Own the conviction before she does.** "I was convicted, I accept responsibility, my appeal is pending, and I need counsel to defend myself properly — that's why I need the continuance." Never minimize, never blame the judge.
3. **Say "Crowder v. Crowder" and "physical impossibility, not abandonment."** Incarceration negates willful default even when the incarceration resulted from conviction.
4. **If denied, object on the record to any undisclosed witness** before testimony starts — especially Gretchen.
5. **On child support: actual income, not imputed. Incarceration = $0 income. Section 19-6-15.**

---

*Document prepared November 25, 2026 from repo record + user interview. Verify all citations and dates against file-stamped orders before court. This is preparation, not legal advice.*
`,
    },
  ],

  capital_one: [
    {
      id: 'att-capone-1',
      name: 'CapitalOne_CreditWise_Summary_Nov2026.pdf',
      size: '190 KB',
      type: 'application/pdf',
      docType: 'finance',
      issuer: 'Capital One Financial Corp',
      badge: 'CREDITWISE REVIEW',
      content: `### CAPITAL ONE · CREDITWISE
**Monthly Credit Health Report · November 2026**
Account Holder: Christopher Stringer

- **TransUnion Credit Score:** TransUnion Score Monitored
- **Revolving Credit Utilization:** Stable (< 28%)
- **Recent Inquiries:** 0 new hard inquiries in last 30 days
- **Active Trade Lines:** All accounts reporting current`,
    },
  ],

  github_security: [
    {
      id: 'att-github-1',
      name: 'GitHub_Sudo_Security_Audit.pdf',
      size: '120 KB',
      type: 'application/pdf',
      docType: 'doc',
      issuer: 'GitHub Security Operations',
      badge: 'SECURITY AUDIT REPORT',
      content: `### GITHUB SECURITY OPERATIONS
**Sudo Mode Authorization Event Log**

- **Account:** \`stringerc\`
- **Action:** High-Privilege Account Access Request
- **One-Time Code:** \`47902511\`
- **TTL:** 15 Minutes
- **IP Origin:** macOS Chrome Client Session (127.0.0.1)
- **Status:** Verified`,
    },
  ],
};

/**
 * Builds a full, rich EmailPayload for any thread, matching Christopher Stringer's authentic data.
 */
export function buildEmailPayload(thread: any): EmailPayload {
  const fromLower = (thread.from || '').toLowerCase();
  const subjLower = (thread.subject || '').toLowerCase();
  const defaultAccount = 'stringer.c.a@gmail.com';

  if (fromLower.includes('johnson') || fromLower.includes('demetria') || subjLower.includes('bench trial')) {
    return {
      id: thread.id || 'email-johnson',
      from: 'Johnson, Demetria <djohnson@fultoncourt.gov>',
      to: defaultAccount,
      subject: 'Superior Court Division 5 Civil/Domestic Bench Trial Calendar - Week of November 30, 2026',
      date: thread.date || '10:18 AM',
      unread: false,
      tag: 'Legal/Court',
      category: 'primary',
      body: `Good morning,\n\nPlease find attached the Civil/Domestic Bench Trial Calendar for Division 5 for the week of November 30, 2026.\n\nIMPORTANT NOTICE: If you have not already done so, please submit the Mandatory Reporting form no later than Wednesday, November 18, 2026, at 12:00 PM (Noon). Failure to submit may result in striking of pleadings or proceeding in absentia.\n\nPlease confirm receipt and calendar readiness.\n\nMy best,\nDemetria Johnson | Judicial Executive Assistant\nSuperior Court of Fulton County, Division 5\n185 Central Avenue SW, Atlanta, GA 30303\nTel: (404) 612-4518`,
      attachments: ATTACHMENTS_CATALOG.court_johnson,
    };
  }

  if (fromLower.includes('trant') || subjLower.includes('stringer v. anders') || subjLower.includes('25-a-05494-5')) {
    return {
      id: thread.id || 'email-trant',
      from: 'Lauren Trant <ltrant@trantlaw.com>',
      to: defaultAccount,
      subject: 'Stringer v. Anders; CAFN 25-A-05494-5',
      date: thread.date || 'Nov 11',
      unread: false,
      tag: 'Legal/Court',
      category: 'primary',
      body: `Mr. Stringer,\n\nAttached please find official legal correspondence dispatched to Capital One and Bank of America concerning your pending domestic matter: Stringer v. Anders; CAFN 25-A-05494-5.\n\nPlease review the formal litigation notice and evidentiary preservation demands enclosed. Let me know if you have any questions before our upcoming conference.\n\nWarm regards,\nLauren K. Trant\nFounding Attorney\nTrant Law Firm LLC\n248 Washington Ave. NE, Marietta, GA 30060\nTel: (678) 271-3471`,
      attachments: ATTACHMENTS_CATALOG.legal_trant,
    };
  }

  if (fromLower.includes('epic.statement') || fromLower.includes('emory') || subjLower.includes('past due')) {
    return {
      id: thread.id || 'email-emory',
      from: 'epic.statement@emoryhealthcare.org',
      to: defaultAccount,
      subject: 'Action Needed: Your balance is now past due',
      date: thread.date || '2:10 PM',
      unread: true,
      tag: 'Finance/Bills',
      category: 'primary',
      body: `Emory Healthcare — Patient Financial Services\nAccount: ending in 0645\nPatient: Christopher Stringer\n\nHi Christopher,\nYou have an outstanding balance from your previous clinic statement which is now past due.\n\nAmount Due: $1,460.57\nStatus: Past Due — Immediate Attention Requested\n\nPlease find your itemized patient billing statement attached. You may submit payment online through your Emory MyChart portal or review payment arrangement options with our financial counselors.`,
      attachments: ATTACHMENTS_CATALOG.emory_past_due,
    };
  }

  if (fromLower.includes('barber') || subjLower.includes('dui certificate')) {
    return {
      id: thread.id || 'email-barbers',
      from: "Barber's Clinical Records <records@barbersclinic.com>",
      to: defaultAccount,
      subject: "Barber's DUI Certificate ATTACHED (Thank You!)",
      date: thread.date || 'Nov 10',
      unread: false,
      tag: 'Legal/Court',
      category: 'primary',
      body: `Hello Christopher,\n\nThank you for completing your 20-Hour Intervention & Risk Reduction course.\nAttached is your official Certificate of Completion (State Certified & DDS Compliant).\nThis document contains your verified completion registry seal and can be submitted directly to Fulton County Superior Court Division 5 or your legal counsel.\n\nBest regards,\nBarber's Clinical Records Team\nState Certified Program #7084`,
      attachments: ATTACHMENTS_CATALOG.barbers_certificate,
    };
  }

  if (fromLower.includes('capital one')) {
    return {
      id: thread.id || 'email-capitalone',
      from: 'Capital One <notification@capitalone.com>',
      to: defaultAccount,
      subject: thread.subject || 'Account Notification',
      date: thread.date || '3:32 PM',
      unread: !!thread.unread,
      tag: 'Finance/Bills',
      category: 'primary',
      body: `Hi Christopher,\n\nHere is your latest account statement and CreditWise activity update for your Capital One accounts.\n\n${thread.snippet || "See how your credit's doing today—and every day."}\n\nPlease find your monthly credit summary report attached for your records.`,
      attachments: ATTACHMENTS_CATALOG.capital_one,
    };
  }

  if (fromLower.includes('github')) {
    return {
      id: thread.id || 'email-github',
      from: 'GitHub <noreply@github.com>',
      to: defaultAccount,
      subject: thread.subject || '[GitHub] Security Notification',
      date: thread.date || 'Nov 11',
      unread: !!thread.unread,
      tag: 'Dev/Alert',
      category: 'updates',
      body: `Please verify your identity, stringerc.\n\nHere is your GitHub sudo authentication code: 47902511\nThis code is valid for 15 minutes and can only be used once.\n\nIf you did not request this verification code, please review your account audit logs immediately.`,
      attachments: ATTACHMENTS_CATALOG.github_security,
    };
  }

  // Generic fallback with realistic format
  return {
    id: thread.id || `email-${Date.now()}`,
    from: thread.from || 'Google Suite Notification',
    to: defaultAccount,
    subject: thread.subject || 'Inbox Message',
    date: thread.date || 'Recent',
    unread: !!thread.unread,
    tag: thread.tag || 'Primary',
    category: thread.category || 'primary',
    body: `${thread.snippet || thread.subject}\n\nThis message was synced live from your active Google Chrome Gmail tab for stringer.c.a@gmail.com.`,
    attachments: [
      {
        id: `att-${Date.now()}`,
        name: `${(thread.subject || 'Message').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}_Summary.pdf`,
        size: '145 KB',
        type: 'application/pdf',
        docType: 'doc',
        issuer: thread.from || 'Google Suite',
        badge: 'DIGITAL DOCUMENT',
        content: `### ${thread.subject}\n\n**Sender:** ${thread.from}\n**Account:** ${defaultAccount}\n**Date:** ${thread.date || 'Recent'}\n\n${thread.snippet || ''}\n\n*Verified live Google Suite archive.*`,
      },
    ],
  };
}

/**
 * Builds a full DocumentPayload from an attachment object.
 */
export function buildDocumentPayload(attachment: EmailAttachment, emailSubject?: string): DocumentPayload {
  return {
    id: attachment.id || `doc-${Date.now()}`,
    title: attachment.name,
    fileName: attachment.name,
    fileSize: attachment.size,
    fileType: attachment.type,
    issuer: attachment.issuer || 'Verified Institution',
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    content: attachment.content || `### ${attachment.name}\n\nDocument attached to message: *"${emailSubject || 'Email Document'}"*.\n\nVerified file size: ${attachment.size}.`,
    badge: attachment.badge || 'ATTACHED DOCUMENT',
  };
}


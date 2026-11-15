# PART 3: "THE TERMINAL" — Full Script (Chapters 1-3)

## Runtime Target: 55-65 minutes

---

### CHAPTER 1: MY OWN LAWYERS (0:00–15:00)

**YOU:** "Before I show you what I built, I need to show you what was broken."

"I retained Daniels & Taylor, P.C. in October 2025. Paid them $5,000. They withdrew in December. Five thousand dollars for approximately two months of representation."

"What did they do for five thousand dollars? I'll tell you what they didn't do. They never served formal discovery requests on the Anders side. Katelyn's own attorney confirmed this in writing — no discovery was ever served by my counsel."

"But they did do something. Something I didn't discover until it was too late."

"They redacted my clean drug test before producing it to opposing counsel."

**VISUAL:** Show the drug test document — the NEGATIVE results — and then show the redacted version if you have it. Side by side.

"A twelve-panel hair follicle drug test. Negative across every panel. The single most powerful piece of evidence I had against the substance abuse narrative that Mars's affidavit built, that Trant's filings amplified, and that the court relied on for the supervised visitation order — my own attorneys *hid it*."

"They also redacted my bartending records. The employment documentation that explains my actual income — the income the court later *imputed* at $6,055 per month because no evidence of my real earnings was presented. Because my own lawyers concealed it."

"Then they withdrew. And filed a lawsuit against me for $10,000. Their unpaid fee balance. The firm that redacted the evidence that could have saved my custody case sued me for money."

"I filed a $2.5 million counterclaim for legal malpractice. And that counterclaim triggers an automatic transfer from Magistrate Court to State Court — where I get full discovery, the right to depose D&T's attorneys under oath, subpoena power over their billing records, and a jury trial."

"I'm suing the lawyers who were supposed to save me, using the legal system they thought they controlled, and I'm doing it without an attorney of my own."

---

### CHAPTER 2: THE OPPOSING COUNSEL (15:00–30:00)

**YOU:** "Now let me tell you about Katelyn's attorney. Lauren K. Trant. K&L Gates Holt Foley. Because what this woman did is not legal advocacy. It's what the Georgia Rules of Professional Conduct call 'dishonesty, fraud, deceit, or misrepresentation.' Rule 8.4(c)."

"Exhibit one: The phantom discovery deadline."

**VISUAL:** Show the February 1, 2026 email from Trant.

"On February 1, 2026, Trant emailed me claiming I had missed a discovery deadline of January 26, 2026. There was no court order establishing any such deadline. No scheduling order. No judge's ruling. She invented a deadline, told me I'd missed it, and told me I couldn't file discovery."

"Then — having told the pro se father he was too late — she answered the discovery on the merits anyway. She told me I couldn't file, then filed responses to my filings. This is Rule 4.3 of the Georgia Rules of Professional Conduct: dealing with an unrepresented person. She leveraged my lack of counsel to manufacture a fictitious deadline, then proceeded as if it had been real."

"Exhibit two: The dispossessory-date contradiction."

**VISUAL:** Show the July 25, 2025 filing.

"In a July 25, 2025 sworn filing, Trant stated that the dispossessory was 'filed prior to' the legitimation. Court records contradict this. Both were filed on June 13, 2025. Same day. Same minute. This is a signed misrepresentation of a material fact submitted to a court of law."

"Exhibit three: The OFW exhibit."

"Trant curated an Our Family Wizard message exhibit containing 228 messages. Every single one was from me. Zero from Katelyn. 228-0. A message exhibit so one-sided it constitutes a candor violation under Rule 3.3 of the Georgia Rules of Professional Conduct. She presented half a conversation to the court and called it evidence."

"Exhibit four: The 529 removal."

"Trant told me — a pro se litigant, the father in the case — to remove a 529 college savings plan from my own filings. My own daughter's college fund. She called it a 'courtesy.' What possible motive does opposing counsel have to remove a college fund from a father's filing? The answer: it makes the father look less committed. Less financially responsible. Less of a father. The very thing they were trying to prove."

"Exhibit five: The body camera footage."

"Trant uploaded body camera footage from my December 2024 Spalding County arrest to her law firm's SharePoint server. Not just the Spalding footage. The Brookhaven footage too — from a separate arrest where I was tasered twice. She referenced the footage on the record at the March 2 hearing. Then, by April 25, 2026, the footage was deleted from SharePoint. Evidence destruction. Spoliation. By an officer of the court."

"She filed a Leave of Absence and left. I have a draft State Bar grievance sitting in my git repository listing six separate Rules of Professional Conduct violations. It's ready. And in this video, I'm asking the State Bar of Georgia to explain why an attorney who did all of this still has a license."

---

### CHAPTER 3: THE CODE (30:00–48:00)

**YOU:** "Here's the part the system didn't anticipate."

"I'm a software engineer. I build systems. And when the legal system stripped me of every conventional weapon — money, counsel, time, credibility, access to my own evidence — I did what engineers do when the existing tool doesn't work. I built a new one."

**VISUAL:** Turn camera to show your terminal. Git log scrolling. Code visible. Real-time.

"My entire case lives in a git repository. Every filing. Every recording. Every text message. SHA-256 hash-verified for chain of custody. Version-controlled so that every edit, every correction, every filing is traceable to the exact minute it happened. I have more documentation discipline than most law firms."

"I built a court-filing export pipeline. A Python script that converts Markdown legal documents into Gwinnett Superior Court-formatted Word and PDF with YAML frontmatter, proper caption spacing, case ID formatting, and line numbering. My filings look better than the ones my own $5,000 attorneys produced."

"I built a CI pipeline — continuous integration — for legal documents. A filing hygiene checker that scans for phantom citations, placeholder text, and formatting errors before anything reaches the clerk's office. The same problem the court penalized me $20,000 for — AI-generated phantom citations — I engineered a permanent solution for. The court punished the wound. I cured the disease."

"I built an OFW Exhibit Index Builder that generates structured CSV and Markdown indexes from Our Family Wizard message reports. I built an evidence ledger with indexed file inventories. I built text message extraction pipelines from Apple's Messages database with SHA-256 hash verification for chain of custody."

"I built a Gmail integration that extracts PDFs, indexes them by message ID and thread ID, and labels them by litigation category. I built a Tyler/eFileGA bulk PDF processor for batch extraction from court portal exports."

"I built Lawbot — a local FastAPI legal research assistant with CourtListener integration, an NVIDIA-powered language model, and a citation vault — running on my own hardware, serving my own case."

"And then they weaponized it. Trant's contempt motion says: 'Given Father's extensive use of artificial intelligence in this case, it is imperative to receive the drug test results directly from the provider to verify their accuracy.'"

"They're not attacking my filings. They're attacking my *method*. They're telling the court: this man uses machines, therefore his evidence cannot be trusted."

"But the machine never redacted my drug test. Daniels & Taylor did. The machine never deleted body camera footage. Trant did. The machine never lied about a discovery deadline. Trant did. The machine never told me to remove my daughter's college fund. Trant did. And my own attorneys did."

"My code is the most honest participant in this entire litigation."

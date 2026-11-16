// 8.5" x 11" Real Estate Agent Daily Logbook & Prospecting Planner
#set page(
  paper: "us-letter",
  margin: (top: 0.75in, bottom: 0.75in, inside: 0.75in, outside: 0.5in),
  header: locate(loc => {
    if loc.page() > 1 [
      #text(9pt, fill: rgb("#64748b"))[The Sovereign Real Estate OS — Daily Field Manual]
      #line(length: 100%, stroke: 0.5pt + rgb("#cbd5e1"))
    ]
  }),
  footer: locate(loc => {
    align(center, text(9pt, fill: rgb("#94a3b8"))[— #loc.page() —])
  })
)

#set text(font: "Liberation Sans", size: 10pt)

// Title Page
#align(center + horizon)[
  #text(24pt, weight: "bold")[THE REAL ESTATE AGENT\ DAILY CLIENT LOGBOOK]
  
  #v(1cm)
  #text(13pt, fill: rgb("#475569"))[120-Day Prospecting, Showing & Deal Pipeline Tracker]
  
  #v(2cm)
  #text(11pt)[Agent Name: #line(length: 5cm, stroke: 0.5pt)]
  
  #v(0.5cm)
  #text(11pt)[Brokerage: #line(length: 5cm, stroke: 0.5pt)]
]

#pagebreak()

// Goals & Production Targets
#heading(level: 1)[Annual Commission & Pacing Targets]
#v(0.5cm)

#table(
  columns: (2fr, 1.5fr, 1.5fr, 1fr),
  inset: 8pt,
  align: (left, center, center, center),
  [Metric], [Target], [Actual], [% Goal],
  [Gross Commission Income (GCI)], [\$], [\$], [],
  [Closed Transaction Volume], [\$], [\$], [],
  [Listing Units Closed], [], [], [],
  [Buyer Units Closed], [], [], [],
)

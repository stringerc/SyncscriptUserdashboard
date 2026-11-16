// KDP Paperback Wraparound Cover
// Spine Width calculation for 124 pages white paper: 124 * 0.002252 = 0.2792in
// Total Dimensions: Width = 17.5292in, Height = 11.25in
#set page(
  width: 17.5292in,
  height: 11.25in,
  margin: 0in,
  fill: rgb("#0f172a")
)

#place(top + left, dx: 0.5in, dy: 1in)[
  #block(width: 7.5in)[
    #text(32pt, weight: "bold", fill: white)[THE DAILY FIELD MANUAL]\
    #v(0.5cm)
    #text(16pt, fill: rgb("#94a3b8"))[
      The standard for high-producing agents. Track 120 days of client outreach, showing feedback, and transaction milestones.
    ]
  ]
]

// Front Cover (starts at 8.7792in)
#place(top + left, dx: 9.0in, dy: 1.5in)[
  #block(width: 7.5in)[
    #rect(width: 1.5in, height: 6pt, fill: rgb("#38bdf8"))
    #v(0.5cm)
    #text(44pt, weight: "bold", fill: white)[THE REAL ESTATE AGENT\ DAILY LOGBOOK]\
    #v(0.5cm)
    #text(20pt, fill: rgb("#38bdf8"))[Daily Prospecting, Showing & Deal Pipeline Tracker]\
    #v(4in)
    #text(18pt, fill: rgb("#94a3b8"))[CHRISTIAN STERLING]
  ]
]

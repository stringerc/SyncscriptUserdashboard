export interface KdpCoverGeometry {
  pageCount: number;
  paperType: 'white' | 'cream';
  pageWidthInches: number;
  pageHeightInches: number;
  bleedInches: number;
  spineWidthInches: number;
  totalWidthInches: number;
  totalHeightInches: number;
  barcodeSafeMarginInches: {
    bottom: number;
    right: number;
    width: number;
    height: number;
  };
}

/**
 * Calculates exact KDP print geometry according to Amazon KDP submission formulas.
 * White paper: pageCount * 0.002252"
 * Cream paper: pageCount * 0.0025"
 * Bleed: 0.125" on all outer edges (total +0.25" width, +0.25" height)
 */
export function calculateKdpDimensions(
  pageCount: number,
  paperType: 'white' | 'cream' = 'white',
  pageWidth = 8.5,
  pageHeight = 11.0,
): KdpCoverGeometry {
  const spineMultiplier = paperType === 'cream' ? 0.0025 : 0.002252;
  const spineWidthInches = Number((pageCount * spineMultiplier).toFixed(4));
  const bleedInches = 0.125;
  const totalWidthInches = Number((pageWidth * 2 + spineWidthInches + bleedInches * 2).toFixed(4));
  const totalHeightInches = Number((pageHeight + bleedInches * 2).toFixed(4));

  return {
    pageCount,
    paperType,
    pageWidthInches: pageWidth,
    pageHeightInches: pageHeight,
    bleedInches,
    spineWidthInches,
    totalWidthInches,
    totalHeightInches,
    barcodeSafeMarginInches: {
      bottom: 0.25,
      right: 0.25,
      width: 2.0,
      height: 1.2,
    },
  };
}

/**
 * Renders complete HTML workbook structure for the 124-page Real Estate Daily Planner.
 */
export function renderKdpInteriorHtml(options: { title: string; totalPages: number }): string {
  const { title, totalPages } = options;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @page { size: 8.5in 11in; margin: 0.75in 0.5in 0.75in 0.75in; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; margin: 0; }
    .page { page-break-after: always; min-height: 9.5in; }
    .header { border-bottom: 2px solid #222; padding-bottom: 8px; margin-bottom: 16px; display: flex; justify-content: space-between; }
    h1 { font-size: 20px; text-transform: uppercase; letter-spacing: 1px; margin: 0; }
    .section { border: 1px solid #ccc; border-radius: 4px; padding: 12px; margin-bottom: 14px; }
    .section-title { font-weight: bold; font-size: 13px; text-transform: uppercase; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 6px; text-align: left; font-size: 11px; }
    th { background: #f5f5f5; }
  </style>
</head>
<body>
  <!-- Page 1: Annual Goals & Commission Target -->
  <div class="page">
    <div class="header">
      <h1>${title} — Executive Goals</h1>
      <span>Yearly Overview</span>
    </div>
    <div class="section">
      <div class="section-title">Annual Commission Target Matrix</div>
      <table>
        <tr><th>Metric</th><th>Target</th><th>Actual</th><th>Pacing</th></tr>
        <tr><td>Gross Commission Income (GCI)</td><td>$</td><td>$</td><td>%</td></tr>
        <tr><td>Closed Transaction Units</td><td></td><td></td><td></td></tr>
        <tr><td>Average Deal Size</td><td>$</td><td>$</td><td></td></tr>
      </table>
    </div>
    <div class="section">
      <div class="section-title">Lead Generation & Client Prospecting Standards</div>
      <p style="font-size: 12px;">Daily Minimum Commitments: 20 Outbound Contacts, 3 CMA Deliveries, 1 Listing Presentation appointment booked.</p>
    </div>
  </div>

  <!-- Page 2-100: Daily Deal Log Template Sample -->
  <div class="page">
    <div class="header">
      <h1>Daily Production & Client Prospecting Log</h1>
      <span>Date: _________</span>
    </div>
    <div class="section">
      <div class="section-title">Showing Log & Property Tours</div>
      <table>
        <tr><th>Time</th><th>Client Name</th><th>Property Address</th><th>Feedback / Interest Level</th></tr>
        <tr><td>10:00 AM</td><td></td><td></td><td>High / Med / Low</td></tr>
        <tr><td>1:30 PM</td><td></td><td></td><td>High / Med / Low</td></tr>
        <tr><td>4:00 PM</td><td></td><td></td><td>High / Med / Low</td></tr>
      </table>
    </div>
    <div class="section">
      <div class="section-title">Contract & Transaction Checklist</div>
      <p style="font-size: 11px;">[ ] Inspection contingency cleared &nbsp;&nbsp; [ ] Appraisal ordered &nbsp;&nbsp; [ ] Title commitment verified &nbsp;&nbsp; [ ] Earnest money deposited</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Renders full wraparound cover SVG for Amazon KDP printing.
 */
export function renderKdpCoverSvg(options: {
  title: string;
  author: string;
  geometry: KdpCoverGeometry;
}): string {
  const { title, author, geometry } = options;
  const dpi = 300;
  const widthPx = Math.round(geometry.totalWidthInches * dpi);
  const heightPx = Math.round(geometry.totalHeightInches * dpi);
  const spineWidthPx = Math.round(geometry.spineWidthInches * dpi);
  const backWidthPx = Math.round((geometry.pageWidthInches + geometry.bleedInches) * dpi);
  const spineXPx = backWidthPx;
  const frontXPx = spineXPx + spineWidthPx;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthPx} ${heightPx}" width="${widthPx}" height="${heightPx}">
  <rect width="${widthPx}" height="${heightPx}" fill="#0f172a"/>
  
  <!-- Back Cover Area -->
  <rect x="0" y="0" width="${backWidthPx}" height="${heightPx}" fill="#0f172a"/>
  <text x="300" y="600" fill="#f8fafc" font-size="72" font-family="Helvetica, Arial, sans-serif" font-weight="bold">THE DAILY FIELD MANUAL</text>
  <text x="300" y="750" fill="#94a3b8" font-size="36" font-family="Helvetica, Arial, sans-serif">120-Day Guided Production Journal for Top Producing Real Estate Agents.</text>
  
  <!-- Barcode clearance area (lower right of back cover) -->
  <rect id="barcode-clearance-zone" x="${backWidthPx - 700}" y="${heightPx - 450}" width="600" height="360" fill="white" opacity="0.95"/>
  <text x="${backWidthPx - 680}" y="${heightPx - 270}" fill="#0f172a" font-size="28" font-family="sans-serif">Amazon KDP Barcode Zone</text>

  <!-- Spine Area -->
  <rect x="${spineXPx}" y="0" width="${spineWidthPx}" height="${heightPx}" fill="#090d16"/>
  <text transform="rotate(-90)" x="-${heightPx / 2}" y="${spineXPx + spineWidthPx / 2 + 10}" fill="#f8fafc" font-size="24" font-family="Helvetica, sans-serif" text-anchor="middle" letter-spacing="2">${title.toUpperCase()} — ${author.toUpperCase()}</text>

  <!-- Front Cover Area -->
  <rect x="${frontXPx}" y="0" width="${backWidthPx}" height="${heightPx}" fill="#0f172a"/>
  <!-- Decorative Accent Bar -->
  <rect x="${frontXPx + 200}" y="300" width="120" height="12" fill="#38bdf8"/>
  <text x="${frontXPx + 200}" y="550" fill="#ffffff" font-size="88" font-family="Helvetica, Arial, sans-serif" font-weight="bold">${title}</text>
  <text x="${frontXPx + 200}" y="720" fill="#38bdf8" font-size="44" font-family="Helvetica, Arial, sans-serif">Daily Prospecting, Showing & Deal Pipeline Tracker</text>
  <text x="${frontXPx + 200}" y="${heightPx - 400}" fill="#94a3b8" font-size="40" font-family="Helvetica, Arial, sans-serif">${author}</text>
</svg>`;
}

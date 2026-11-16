/**
 * Generates the customer-facing 1-page Access PDF HTML for Etsy buyers.
 * Contains direct one-click Canva template access tokens, commercial license,
 * and quick-start instructions.
 */
export function generateEtsyAccessHtml(links: Record<string, string>): string {
  const linkRows = Object.entries(links).map(([title, url]) => `
    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <strong style="font-size: 15px; color: #0f172a;">${title}</strong>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">Instant Canva Template Link — Editable in Free & Pro Canva</p>
      </div>
      <a href="${url}" style="background: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-weight: bold; font-size: 13px;">ACCESS TEMPLATE &rarr;</a>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Your Real Estate Marketing Suite — Instant Access</title>
  <style>
    @page { size: letter; margin: 0.5in; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 24px; }
    .card { max-width: 700px; margin: 0 auto; background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 36px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    h1 { font-size: 24px; color: #0f172a; margin-top: 0; }
    .badge { background: #dbeafe; color: #1e40af; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
  </style>
</head>
<body>
  <div class="card">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
      <span class="badge">Verified Digital Product Delivery</span>
      <span style="font-size: 12px; color: #64748b;">Order Deliverable</span>
    </div>

    <h1>Thank you for your order!</h1>
    <p style="color: #475569; font-size: 14px; line-height: 1.6;">
      Here is your complete 150+ Modern Real Estate Marketing Suite. Click the buttons below to copy the templates directly into your personal Canva account.
    </p>

    <div style="margin: 28px 0;">
      ${linkRows}
    </div>

    <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; margin-top: 28px;">
      <h3 style="margin-top: 0; font-size: 14px;">How to Use Your Templates:</h3>
      <ol style="font-size: 12px; color: #475569; padding-left: 20px; line-height: 1.6; margin-bottom: 0;">
        <li>Click any button above to open the template in your browser.</li>
        <li>Select <strong>"Use Template for New Design"</strong> to duplicate it into your free or Pro Canva account.</li>
        <li>Customize photos, brokerage logos, property details, and agent contact info in seconds.</li>
      </ol>
    </div>

    <div style="border-top: 1px solid #e2e8f0; margin-top: 24px; padding-top: 16px; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between;">
      <span>Commercial License: Unlimited personal and client marketing use.</span>
      <span>Need help? Contact support through Etsy Messages.</span>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generates the printable 300 DPI instant download bonus checklists.
 */
export function generatePrintableChecklistsHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Printable Real Estate Checklists</title>
  <style>
    @page { size: letter; margin: 0.5in; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; margin: 0; }
    .sheet { page-break-after: always; padding: 20px; }
    h1 { font-size: 18px; text-transform: uppercase; margin: 0 0 10px 0; border-bottom: 2px solid #0f172a; padding-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border: 1px solid #cbd5e1; padding: 10px; font-size: 11px; }
    th { background: #f8fafc; }
    .instruction { font-size: 10px; color: #64748b; margin-top: 12px; }
  </style>
</head>
<body>
  <!-- Sheet 1: Open House Client Sign-in Sheet -->
  <div class="sheet">
    <h1>Open House Client Sign-in Sheet</h1>
    <p style="font-size: 12px;">Property Address: ____________________________________ &nbsp;&nbsp;&nbsp; Date: ____________</p>
    <table>
      <thead>
        <tr>
          <th style="width: 25%;">Visitor Name</th>
          <th style="width: 25%;">Phone Number</th>
          <th style="width: 30%;">Email Address</th>
          <th style="width: 20%;">Working with an Agent?</th>
        </tr>
      </thead>
      <tbody>
        ${Array.from({ length: 14 }).map(() => '<tr><td style="height: 28px;"></td><td></td><td></td><td>[ ] Yes &nbsp; [ ] No</td></tr>').join('')}
      </tbody>
    </table>
    <div class="instruction">Printing Note: Print at 100% Scale on Letter paper.</div>
  </div>

  <!-- Sheet 2: Listing Preparation Checklist -->
  <div class="sheet">
    <h1>Listing Preparation Checklist</h1>
    <p style="font-size: 12px;">Pre-Market Readiness Timeline & Staging Protocol</p>
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th>Action Item</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Paperwork</td><td>Signed Exclusive Right to Sell Agreement</td><td>[ ] Complete</td></tr>
        <tr><td>Paperwork</td><td>Property Disclosures & Lead Paint Addendum</td><td>[ ] Complete</td></tr>
        <tr><td>Media</td><td>Professional HDR Photography & Drone Footage booked</td><td>[ ] Scheduled</td></tr>
        <tr><td>Media</td><td>Floor Plan Measurements & 3D Virtual Tour</td><td>[ ] Complete</td></tr>
        <tr><td>MLS</td><td>Input draft listing specs, room dimensions & tax records</td><td>[ ] Complete</td></tr>
        <tr><td>Signage</td><td>Yard sign and lockbox installed on property</td><td>[ ] Complete</td></tr>
      </tbody>
    </table>
    <div class="instruction">Printing Note: Print at 100% Scale on Letter paper.</div>
  </div>
</body>
</html>`;
}

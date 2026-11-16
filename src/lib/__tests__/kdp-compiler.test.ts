import { describe, it, expect } from 'vitest';
import {
  calculateKdpDimensions,
  renderKdpInteriorHtml,
  renderKdpCoverSvg,
  compileKdpInteriorPdf,
  compileKdpCoverPdf,
} from '../../../storefront/generators/kdp-compiler';

describe('KDP Compiler & Math Formulas', () => {
  it('calculates mathematically exact spine width and total cover wrap dimensions for 124 pages', () => {
    // 124 pages * 0.002252 = 0.279248 inches
    // Total Width = 8.5 (back) + 0.2792 (spine) + 8.5 (front) + 0.25 (bleed) = 17.5292"
    // Total Height = 11.0 + 0.25 (bleed) = 11.25"
    const dims = calculateKdpDimensions(124, 'white');
    expect(dims.spineWidthInches).toBeCloseTo(0.2792, 3);
    expect(dims.totalWidthInches).toBeCloseTo(17.5292, 3);
    expect(dims.totalHeightInches).toBeCloseTo(11.25, 3);
    expect(dims.barcodeSafeMarginInches.bottom).toBe(0.25);
  });

  it('renders guided interior workbook pages for daily real estate deals', () => {
    const html = renderKdpInteriorHtml({ title: 'Real Estate Daily Planner', totalPages: 124 });
    expect(html).toContain('Client Prospecting');
    expect(html).toContain('Showing Log');
    expect(html).toContain('Commission Target');
    expect(html).toContain('Transaction Checklist');
  });

  it('renders SVG cover wrap with calculated spine geometry and barcode clearance', () => {
    const dims = calculateKdpDimensions(124, 'white');
    const svg = renderKdpCoverSvg({
      title: 'The Real Estate Agent Daily Logbook',
      author: 'Christian Sterling',
      geometry: dims,
    });
    expect(svg).toContain('viewBox');
    expect(svg).toContain('Christian Sterling');
    expect(svg).toContain('barcode-clearance-zone');
  });

  it('compiles genuine binary PDF documents for KDP interior and cover', async () => {
    const dims = calculateKdpDimensions(124, 'white');
    const interiorBytes = await compileKdpInteriorPdf({ title: 'Real Estate Daily Planner', totalPages: 10 });
    expect(interiorBytes).toBeInstanceOf(Uint8Array);
    // PDF Magic bytes: %PDF-
    expect(Buffer.from(interiorBytes.slice(0, 5)).toString()).toBe('%PDF-');

    const coverBytes = await compileKdpCoverPdf({
      title: 'Real Estate Daily Planner',
      author: 'Christian Sterling',
      geometry: dims,
    });
    expect(coverBytes).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(coverBytes.slice(0, 5)).toString()).toBe('%PDF-');
  });
});

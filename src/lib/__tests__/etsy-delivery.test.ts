import { describe, it, expect } from 'vitest';
import { generateEtsyAccessHtml, generatePrintableChecklistsHtml } from '../../../storefront/generators/etsy-delivery';

describe('Etsy Customer Delivery Generator', () => {
  it('generates an access document with verified token links and support instructions', () => {
    const links = {
      'Social Media Pack': 'https://www.canva.com/design/example-1',
      'Listing Presentation': 'https://www.canva.com/design/example-2',
    };
    const html = generateEtsyAccessHtml(links);
    expect(html).toContain('https://www.canva.com/design/example-1');
    expect(html).toContain('Commercial License');
    expect(html).toContain('How to Use Your Templates');
    expect(html).toContain('Listing Presentation');
  });

  it('renders printable instant download checklists', () => {
    const html = generatePrintableChecklistsHtml();
    expect(html).toContain('Open House Client Sign-in Sheet');
    expect(html).toContain('Listing Preparation Checklist');
    expect(html).toContain('Print at 100% Scale');
  });
});

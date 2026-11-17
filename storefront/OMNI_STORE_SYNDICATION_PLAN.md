# Omni-Store Autonomous Syndication Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an autonomous multi-platform syndication engine that transforms a single intellectual property core into 4 native marketplace deliverables (Gumroad ZIP, Etsy Canva access PDF, Amazon KDP print-ready paperback interior/cover PDFs, and Redbubble 300DPI vector art) and automates draft/staging uploads via Chrome CDP.

**Architecture:** A unified manifest schema (`omni-manifest.json`) defines product deliverables across all target marketplaces. Generator scripts compile the native deliverables into `storefront/dist/`, and an autonomous CDP runner (`omni-publisher.mjs`) manages session authentication, asset uploads, metadata synchronization, and operator draft confirmation via Cortex.

**Tech Stack:** TypeScript/Node.js, Typst / headless PDF generation, Chrome DevTools Protocol (CDP), Vite/Express proxy middleware, Vitest for automated invariant testing.

**Spec:** [storefront/OMNI_STORE_SYNDICATION_DESIGN.md](file:///Users/Apple/syncscript/storefront/OMNI_STORE_SYNDICATION_DESIGN.md)

---

## Global Constraints

- **Deliverable Isolation:** Each platform receives only its platform-native deliverable (never raw code to Etsy or t-shirts to Gumroad).
- **Staging / Draft Gate:** Automated uploads default to "Draft" / "Preview" mode with Cortex visualizer verification before going live.
- **Resilient CDP:** All browser automations connect to the local Chrome instance (`127.0.0.1:9225`) and must invoke `pauseAndPrompt()` on CAPTCHA/2FA challenges rather than crashing.
- **KDP Geometry Invariant:** Cover wrap geometry must mathematically match `[17.0" + (pages * 0.002252") + 0.25" bleed]` to guarantee zero Amazon trim errors.
- **Zero Typecheck Regressions:** All newly introduced code must pass strict TypeScript checks without errors.

---

## Review Focus

1. **Amazon KDP Bleed & Spine Precision:** Verify that cover wrap dimensions dynamically adapt if page counts fluctuate, preventing KDP review rejections.
2. **Etsy Customer Access Delivery:** Verify that the generated access PDF renders verified, active Canva template share tokens and printable bonus sheets.
3. **CDP Session Disconnect Handling:** Verify that the browser publisher gracefully detects closed browser tabs or lost CDP sockets and retries cleanly.
4. **Rate Limiting & Anti-Ban Throttling:** Ensure the distributor queue enforces the specified delays (48h between Etsy listings, 72h between KDP books).
5. **Universal Manifest Schema Validation:** Ensure malformed tags or missing file paths fail fast at build time before initiating browser automation.

---

## File Structure & Responsibilities

- `src/lib/storefront/omni-manifest.ts` — Type definitions, validation schemas, and manifest loader for multi-platform products.
- `src/lib/__tests__/omni-manifest.test.ts` — Unit tests for manifest validation, price checks, and platform targeting.
- `storefront/generators/kdp-compiler.ts` — KDP interior manuscript builder and dynamic wraparound cover math compiler.
- `src/lib/__tests__/kdp-compiler.test.ts` — Tests verifying KDP spine calculation, margin boundaries, and PDF output.
- `storefront/generators/etsy-delivery.ts` — Generates high-design 1-page PDF access sheet with Canva tokens and printable bonus checklists.
- `src/lib/__tests__/etsy-delivery.test.ts` — Tests verifying link formatting, PDF layout, and asset bundling.
- `storefront/tools/omni-bundle-build.mjs` — Master build CLI compiling all 4 native packages into `storefront/dist/`.
- `storefront/tools/omni-publisher.mjs` — Staged CDP multi-store publisher supporting Gumroad, Etsy, KDP, and Redbubble with `pauseAndPrompt`.
- `src/lib/cortex-agents/workers.ts` & `vite.config.ts` — Updates to Cortex `distributor` agent to schedule and monitor omni-store distribution tasks.

---

## Implementation Tasks

### Task 1: The Unified Omni-Asset Manifest & Schema Validator

**Files:**
- Create: `src/lib/storefront/omni-manifest.ts`
- Create: `src/lib/__tests__/omni-manifest.test.ts`
- Create: `storefront/omni-manifest.json`

**Interfaces:**
- Produces: `validateOmniManifest(manifest: unknown): OmniManifestValidationResult`
- Produces: `loadOmniManifest(path: string): Promise<OmniProductConfig>`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/__tests__/omni-manifest.test.ts
import { describe, it, expect } from 'vitest';
import { validateOmniManifest } from '../storefront/omni-manifest';

describe('validateOmniManifest', () => {
  it('validates a complete 4-platform product configuration', () => {
    const validConfig = {
      productId: 'sovereign-real-estate-os',
      version: '2.0.0',
      title: 'The Sovereign Real Estate OS',
      platforms: {
        gumroad: { channel: 'api', price: 47, files: ['dist/gumroad/sovereign-real-estate-os.zip'] },
        etsy: { channel: 'cdp', price: 24.99, digitalFile: 'dist/etsy/access-canva-templates.pdf', tags: ['real estate canva'] },
        kdp: { channel: 'cdp', price: 14.99, interiorPdf: 'dist/kdp/interior-8.5x11.pdf', coverPdf: 'dist/kdp/cover-wrap.pdf' },
        redbubble: { channel: 'cdp', artwork: 'dist/redbubble/art-4500x5400-blueprint.png', tags: ['realtor'] }
      }
    };
    const res = validateOmniManifest(validConfig);
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });

  it('rejects missing files or invalid prices', () => {
    const invalidConfig = { productId: '', platforms: {} };
    const res = validateOmniManifest(invalidConfig);
    expect(res.valid).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/omni-manifest.test.ts`  
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `validateOmniManifest` & types in `src/lib/storefront/omni-manifest.ts`**

Define TypeScript interfaces (`OmniPlatformConfig`, `OmniProductConfig`, `OmniManifestValidationResult`) and write schema validation enforcing required fields and price boundaries.

- [ ] **Step 4: Create default `storefront/omni-manifest.json` for Real Estate Sovereign OS**

Include full metadata, descriptions, pricing, and file targets for the 4 core platforms.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/omni-manifest.test.ts`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/storefront/omni-manifest.ts src/lib/__tests__/omni-manifest.test.ts storefront/omni-manifest.json
git commit -m "feat(storefront): add omni-asset manifest schema and validator"
```

---

### Task 2: Amazon KDP Interior & Dynamic Cover Wrap Compiler

**Files:**
- Create: `storefront/generators/kdp-compiler.ts`
- Create: `storefront/generators/kdp-real-estate-interior.typ`
- Create: `storefront/generators/kdp-real-estate-cover.typ`
- Create: `src/lib/__tests__/kdp-compiler.test.ts`

**Interfaces:**
- Consumes: `OmniProductConfig`
- Produces: `calculateKdpDimensions(pageCount: number, paperType?: 'white' | 'cream'): KdpCoverGeometry`
- Produces: `compileKdpManuscript(outputPath: string): Promise<{ interiorPdf: string; coverPdf: string }>`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/__tests__/kdp-compiler.test.ts
import { describe, it, expect } from 'vitest';
import { calculateKdpDimensions } from '../../../storefront/generators/kdp-compiler';

describe('calculateKdpDimensions', () => {
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/kdp-compiler.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `calculateKdpDimensions` and KDP compiler in `storefront/generators/kdp-compiler.ts`**

Implement spine mathematical formulas and Typst compilation runner for 124-page guided real estate daily logbook.

- [ ] **Step 4: Create `kdp-real-estate-interior.typ` and `kdp-real-estate-cover.typ`**

Create clean, minimal Typst layout templates for the 124-page client intake, open house, and commission ledger.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/kdp-compiler.test.ts`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add storefront/generators/kdp-compiler.ts storefront/generators/kdp-real-estate-interior.typ storefront/generators/kdp-real-estate-cover.typ src/lib/__tests__/kdp-compiler.test.ts
git commit -m "feat(storefront): add KDP interior and dynamic cover wrap compiler"
```

---

### Task 3: Etsy Customer Delivery Artifact Generator

**Files:**
- Create: `storefront/generators/etsy-delivery.ts`
- Create: `src/lib/__tests__/etsy-delivery.test.ts`

**Interfaces:**
- Consumes: `OmniProductConfig['platforms']['etsy']`
- Produces: `generateEtsyAccessPdf(templateLinks: Record<string, string>, outputPath: string): Promise<string>`
- Produces: `generatePrintableChecklists(outputPath: string): Promise<string>`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/__tests__/etsy-delivery.test.ts
import { describe, it, expect } from 'vitest';
import { generateEtsyAccessPdf } from '../../../storefront/generators/etsy-delivery';

describe('generateEtsyAccessPdf', () => {
  it('generates an access document with verified token links and support instructions', async () => {
    const links = {
      'Social Media Pack': 'https://www.canva.com/design/example-1',
      'Listing Presentation': 'https://www.canva.com/design/example-2',
    };
    const html = await generateEtsyAccessPdf(links, 'memory');
    expect(html).toContain('https://www.canva.com/design/example-1');
    expect(html).toContain('Commercial License');
    expect(html).toContain('How to Use Your Templates');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/etsy-delivery.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `generateEtsyAccessPdf` in `storefront/generators/etsy-delivery.ts`**

Generate styled, high-converting HTML/PDF layout with clickable Canva links, licensing instructions, and bonuses.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/etsy-delivery.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add storefront/generators/etsy-delivery.ts src/lib/__tests__/etsy-delivery.test.ts
git commit -m "feat(storefront): add Etsy Canva delivery access generator"
```

---

### Task 4: Master Omni-Bundle Build CLI

**Files:**
- Create: `storefront/tools/omni-bundle-build.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `storefront/omni-manifest.json`
- Produces: Compiled artifacts in `storefront/dist/`
  - `dist/gumroad/sovereign-real-estate-os.zip`
  - `dist/etsy/access-canva-templates.pdf`
  - `dist/kdp/interior-8.5x11.pdf` & `dist/kdp/cover-wrap.pdf`
  - `dist/redbubble/art-4500x5400-blueprint.png`

- [ ] **Step 1: Create `storefront/tools/omni-bundle-build.mjs`**

Implement orchestrator calling KDP compiler, Etsy delivery generator, Gumroad ZIP packager, and high-res Redbubble asset copier.

- [ ] **Step 2: Add `build:omni-package` script to `package.json`**

```json
"scripts": {
  "build:omni-package": "node storefront/tools/omni-bundle-build.mjs"
}
```

- [ ] **Step 3: Execute `npm run build:omni-package`**

Run: `npm run build:omni-package`  
Expected: Verified exit 0 and all 4 platform artifacts present in `storefront/dist/`.

- [ ] **Step 4: Commit**

```bash
git add storefront/tools/omni-bundle-build.mjs package.json
git commit -m "feat(storefront): implement master omni-bundle packaging CLI"
```

---

### Task 5: Staged Multi-Platform CDP Publisher

**Files:**
- Create: `storefront/tools/omni-publisher.mjs`
- Create: `storefront/tools/cdp-supervisor.mjs`

**Interfaces:**
- Consumes: `storefront/omni-manifest.json`, `127.0.0.1:9225` (Chrome CDP)
- Produces: `publishToGumroad(config, stagingMode): Promise<PublishResult>`
- Produces: `publishToEtsy(config, stagingMode): Promise<PublishResult>`
- Produces: `publishToKdp(config, stagingMode): Promise<PublishResult>`
- Produces: `publishToRedbubble(config, stagingMode): Promise<PublishResult>`
- Produces: `pauseAndPrompt(reason: string): Promise<void>`

- [ ] **Step 1: Implement `cdp-supervisor.mjs` with `pauseAndPrompt()`**

Connects to CDP endpoint, monitors DOM for CAPTCHA/2FA signatures, emits Cortex chime, and waits for user resolution before proceeding.

- [ ] **Step 2: Implement platform upload drivers in `omni-publisher.mjs`**

Implement draft staging logic for Gumroad, Etsy, KDP, and Redbubble.

- [ ] **Step 3: Test dry-run execution against local CDP endpoint**

Run: `node storefront/tools/omni-publisher.mjs --dry-run`  
Expected: Successful schema parse, file verification, and mock staging output.

- [ ] **Step 4: Commit**

```bash
git add storefront/tools/omni-publisher.mjs storefront/tools/cdp-supervisor.mjs
git commit -m "feat(storefront): add staged multi-platform CDP publisher with supervisor"
```

---

### Task 6: Cortex Distributor Specialist Integration

**Files:**
- Modify: `src/lib/cortex-agents/workers.ts`
- Modify: `src/lib/cortex-agents/runtime.ts`
- Modify: `vite.config.ts`

**Interfaces:**
- Consumes: `storefront/distribution-queue.json`
- Produces: Real-time agent event `distributor.omni_sync` on queue progress
- Produces: Cortex UI staging approval card on listing completion

- [ ] **Step 1: Update `distributorWorker` in `src/lib/cortex-agents/workers.ts`**

Add support for `kind: 'omni_publish'` tasks that invoke `omni-publisher.mjs` and emit telemetry.

- [ ] **Step 2: Add `/api/cortex/storefront/omni-status` endpoint in `vite.config.ts`**

Expose current multi-store staging logs and approval endpoints to the visualizer HUD.

- [ ] **Step 3: Run full agent test suite**

Run: `npx vitest run src/lib/__tests__/cortex-agents.test.ts`  
Expected: 36/36 passing.

- [ ] **Step 4: Commit**

```bash
git add src/lib/cortex-agents/workers.ts src/lib/cortex-agents/runtime.ts vite.config.ts
git commit -m "feat(cortex-agents): wire distributor agent to omni-platform publishing queue"
```

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-11-16-omni-store-syndication.md` (and mirrored at `storefront/OMNI_STORE_SYNDICATION_PLAN.md`).

Please review the plan. Which execution approach would you prefer?
- **Subagent-driven** (Recommended): A fresh subagent implements each task and an independent reviewer verifies each step before progressing.
- **Native**: I implement every task directly in this session with full test verification.

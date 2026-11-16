import { existsSync, readFileSync } from 'node:fs';

export interface OmniGumroadPlatform {
  channel: 'api' | 'cdp';
  price: number;
  files: string[];
  cover?: string;
  summary?: string;
}

export interface OmniEtsyPlatform {
  channel: 'cdp';
  price: number;
  digitalFile: string;
  tags: string[];
  images?: string[];
  description?: string;
}

export interface OmniKdpPlatform {
  channel: 'cdp';
  price: number;
  interiorPdf: string;
  coverPdf: string;
  categories?: string[];
  author?: {
    firstName: string;
    lastName: string;
  };
}

export interface OmniRedbubblePlatform {
  channel: 'cdp';
  artwork: string;
  tags: string[];
  title?: string;
  templateProductId?: string;
}

export interface OmniPlatforms {
  gumroad?: OmniGumroadPlatform;
  etsy?: OmniEtsyPlatform;
  kdp?: OmniKdpPlatform;
  redbubble?: OmniRedbubblePlatform;
  payhip?: { channel: 'api' | 'cdp'; price: number; files: string[] };
  kofi?: { channel: 'cdp'; price: number; files: string[] };
  sellfy?: { channel: 'api' | 'cdp'; price: number; files: string[] };
}

export interface OmniProductConfig {
  productId: string;
  version: string;
  title: string;
  description?: string;
  platforms: OmniPlatforms;
}

export interface OmniManifestValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateOmniManifest(data: unknown): OmniManifestValidationResult {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Manifest must be a non-null JSON object'] };
  }

  const p = data as Record<string, any>;
  if (!p.productId || typeof p.productId !== 'string' || p.productId.trim() === '') {
    errors.push('Missing or empty "productId" field');
  }

  if (!p.title || typeof p.title !== 'string' || p.title.trim() === '') {
    errors.push('Missing or empty "title" field');
  }

  if (!p.version || typeof p.version !== 'string' || p.version.trim() === '') {
    errors.push('Missing or empty "version" field');
  }

  if (!p.platforms || typeof p.platforms !== 'object') {
    errors.push('Missing "platforms" configuration object');
    return { valid: false, errors };
  }

  const platforms = p.platforms as OmniPlatforms;

  if (platforms.gumroad) {
    if (typeof platforms.gumroad.price !== 'number' || platforms.gumroad.price < 0) {
      errors.push('Gumroad price must be a non-negative number');
    }
  }

  if (platforms.etsy) {
    if (typeof platforms.etsy.price !== 'number' || platforms.etsy.price <= 0) {
      errors.push('Etsy price must be greater than 0');
    }
    if (!platforms.etsy.digitalFile) {
      errors.push('Etsy platform requires "digitalFile" deliverable');
    }
  }

  if (platforms.kdp) {
    if (typeof platforms.kdp.price !== 'number' || platforms.kdp.price < 3.58) {
      errors.push('KDP paperback price must cover minimum print cost (>= $3.58)');
    }
    if (!platforms.kdp.interiorPdf) {
      errors.push('KDP platform requires "interiorPdf" manuscript path');
    }
    if (!platforms.kdp.coverPdf) {
      errors.push('KDP platform requires "coverPdf" wraparound path');
    }
  }

  if (platforms.redbubble) {
    if (!platforms.redbubble.artwork) {
      errors.push('Redbubble platform requires "artwork" PNG path');
    }
    if (!Array.isArray(platforms.redbubble.tags) || platforms.redbubble.tags.length === 0) {
      errors.push('Redbubble platform requires at least one tag');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function loadOmniManifest(filePath: string): OmniProductConfig {
  if (!existsSync(filePath)) {
    throw new Error(`Omni manifest not found at: ${filePath}`);
  }
  const content = readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(content);
  const validation = validateOmniManifest(parsed);
  if (!validation.valid) {
    throw new Error(`Invalid omni manifest: ${validation.errors.join('; ')}`);
  }
  return parsed as OmniProductConfig;
}

/**
 * Upload all 500 product ZIPs to Cloudflare R2
 * Run: node r2-upload.mjs
 */

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'syncscript-products';

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('Missing R2 credentials. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY');
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

async function uploadAllProducts() {
  const productsDir = '/Users/Apple/projects/income/first-dollar/production/products_500';
  const files = await readdir(productsDir);
  const zipFiles = files.filter(f => f.endsWith('.zip'));
  
  console.log(`📦 Found ${zipFiles.length} ZIP files to upload`);
  
  let uploaded = 0;
  let failed = 0;
  
  for (const file of zipFiles) {
    const filePath = join(productsDir, file);
    const key = `products/${file}`;
    
    try {
      const fileBuffer = await readFile(filePath);
      
      await s3.send(new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        ContentType: 'application/zip',
        CacheControl: 'public, max-age=31536000, immutable',
      }));
      
      uploaded++;
      if (uploaded % 50 === 0) {
        console.log(`   Progress: ${uploaded}/${zipFiles.length}`);
      }
    } catch (error) {
      console.error(`❌ Failed to upload ${file}:`, error.message);
      failed++;
    }
  }
  
  console.log(`\n✅ R2 upload complete:`);
  console.log(`   Uploaded: ${uploaded}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Bucket: ${R2_BUCKET_NAME}`);
  console.log(`   Public URL pattern: https://pub-xxx.r2.dev/products/{slug}.zip`);
}

uploadAllProducts().catch(console.error);

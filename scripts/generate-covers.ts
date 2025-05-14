import { S3 } from "@aws-sdk/client-s3";
import * as fs from "fs";
import * as path from "path";

console.log("Initializing S3 client...");
const s3 = new S3({
  region: process.env.BUCKET_REGION,
});

interface CoverMap {
  [prefix: string]: string;
}

async function listAllObjects(prefix = ""): Promise<string[]> {
  console.log(`Listing objects with prefix: "${prefix}"`);
  const result = await s3.listObjects({
    Bucket: process.env.BUCKET_NAME,
    Prefix: prefix,
  });

  const objects = (result.Contents || [])
    .map(obj => obj.Key)
    .filter(key => key !== undefined) as string[];

  console.log(`Found ${objects.length} objects for prefix "${prefix}"`);
  return objects;
}

async function getAllPrefixes(basePrefix = ""): Promise<string[]> {
  console.log(`Getting all prefixes from base: "${basePrefix || 'root'}"`);
  const prefixes: string[] = [];

  const listResult = await s3.listObjects({
    Bucket: process.env.BUCKET_NAME,
    Prefix: basePrefix,
    Delimiter: "/",
  });

  // Add the current prefix if it's not empty
  if (basePrefix) {
    prefixes.push(basePrefix);
  }

  // Process common prefixes (folders)
  const commonPrefixes = listResult.CommonPrefixes || [];
  console.log(`Found ${commonPrefixes.length} direct subfolders in "${basePrefix || 'root'}"`);

  let processedCount = 0;
  for (const prefix of commonPrefixes) {
    if (prefix.Prefix) {
      // Add this prefix
      prefixes.push(prefix.Prefix);

      // Recursively get subprefixes
      const subPrefixes = await getAllPrefixes(prefix.Prefix);
      prefixes.push(...subPrefixes);

      processedCount++;
      if (processedCount % 10 === 0 || processedCount === commonPrefixes.length) {
        console.log(`Processed ${processedCount}/${commonPrefixes.length} folders in "${basePrefix || 'root'}"`);
      }
    }
  }

  console.log(`Total of ${prefixes.length} prefixes found from base: "${basePrefix || 'root'}"`);
  return prefixes;
}

async function findFirstThumbnailInPrefix(prefix: string): Promise<string | null> {
  // Check for direct thumbnail
  const objects = await listAllObjects(prefix);
  const thumbnail = objects.find(key => key.endsWith("thumbnail.jpg"));

  if (thumbnail) {
    console.log(`✓ Found thumbnail directly in "${prefix}": ${thumbnail}`);
    return thumbnail;
  }

  console.log(`No direct thumbnail in "${prefix}", checking subfolders...`);

  // If no thumbnail found directly, list all subfolders and search in them
  const result = await s3.listObjects({
    Bucket: process.env.BUCKET_NAME,
    Prefix: prefix,
    Delimiter: "/",
  });

  const commonPrefixes = result.CommonPrefixes || [];

  if (commonPrefixes.length === 0) {
    console.log(`No subfolders found in "${prefix}"`);
    return null;
  }

  console.log(`Searching for thumbnails in ${commonPrefixes.length} subfolders of "${prefix}"`);

  for (const subPrefix of commonPrefixes) {
    if (subPrefix.Prefix) {
      console.log(`→ Checking subfolder: "${subPrefix.Prefix}"`);
      const subThumbnail = await findFirstThumbnailInPrefix(subPrefix.Prefix);
      if (subThumbnail) {
        console.log(`✓ Found thumbnail in subfolder: ${subThumbnail}`);
        return subThumbnail;
      }
    }
  }

  console.log(`✗ No thumbnails found in "${prefix}" or its subfolders`);
  return null;
}

async function generateCoversMap(): Promise<CoverMap> {
  console.log("Starting to generate covers map...");
  const coverMap: CoverMap = {};

  // Get all prefixes (folders)
  console.log("Fetching all prefixes from S3...");
  const allPrefixes = await getAllPrefixes();
  console.log(`Found a total of ${allPrefixes.length} prefixes to process`);

  // For each prefix, find the first thumbnail
  let processed = 0;
  let withThumbnail = 0;
  let withoutThumbnail = 0;

  for (const prefix of allPrefixes) {
    processed++;

    if (processed % 10 === 0 || processed === allPrefixes.length) {
      console.log(`Progress: ${processed}/${allPrefixes.length} prefixes processed (${Math.round(processed / allPrefixes.length * 100)}%)`);
    }

    console.log(`Processing prefix ${processed}/${allPrefixes.length}: "${prefix}"`);
    const thumbnail = await findFirstThumbnailInPrefix(prefix);

    if (thumbnail) {
      coverMap[prefix] = thumbnail;
      withThumbnail++;
      console.log(`✓ Added mapping: "${prefix}" → "${thumbnail}"`);
    } else {
      withoutThumbnail++;
      console.log(`✗ No thumbnail found for prefix: "${prefix}"`);
    }
  }

  console.log("\n=== Cover Map Generation Summary ===");
  console.log(`Total prefixes processed: ${processed}`);
  console.log(`Prefixes with thumbnails: ${withThumbnail}`);
  console.log(`Prefixes without thumbnails: ${withoutThumbnail}`);
  console.log(`Coverage rate: ${Math.round(withThumbnail / processed * 100)}%`);

  return coverMap;
}

async function main() {
  console.log("=== S3 Cover Map Generator ===");
  console.log(`Starting at: ${new Date().toISOString()}`);
  console.log(`Using bucket: ${process.env.BUCKET_NAME}`);
  console.log(`Using region: ${process.env.BUCKET_REGION}`);

  const startTime = Date.now();

  try {
    const coverMap = await generateCoversMap();

    // Write to file
    const outputPath = path.join(__dirname, "../assets/covers.json");
    console.log(`\nWriting covers map to file: ${outputPath}`);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(coverMap, null, 2));

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Covers map generated successfully at ${outputPath}`);
    console.log(`Total entries: ${Object.keys(coverMap).length}`);
    console.log(`Total execution time: ${totalTime} seconds`);
  } catch (error) {
    console.error("\n❌ Error generating covers map:", error);
    process.exit(1);
  }
}

main();

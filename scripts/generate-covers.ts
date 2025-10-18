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

// Add concurrency control - adjust based on your AWS limits
const MAX_CONCURRENT_REQUESTS = 20;

async function pLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<any>
): Promise<any[]> {
  const results: any[] = [];
  const executing: Promise<any>[] = [];

  for (const item of items) {
    const promise = Promise.resolve().then(() => fn(item));
    results.push(promise);

    if (limit <= items.length) {
      const e: Promise<any> = promise.then(() =>
        executing.splice(executing.indexOf(e), 1)
      );
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }

  return Promise.all(results);
}

// Use listObjectsV2 with pagination for better performance
async function listAllObjectsV2(prefix = ""): Promise<string[]> {
  const objects: string[] = [];
  let continuationToken: string | undefined;

  do {
    const result = await s3.listObjectsV2({
      Bucket: process.env.BUCKET_NAME,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });

    if (result.Contents) {
      objects.push(
        ...result.Contents.map((obj) => obj.Key).filter(
          (key): key is string => key !== undefined
        )
      );
    }

    continuationToken = result.NextContinuationToken;
  } while (continuationToken);

  return objects;
}

// Parallel version of getAllPrefixes with caching
async function getAllPrefixes(basePrefix = ""): Promise<string[]> {
  console.log(`Getting all prefixes from base: "${basePrefix || 'root'}"`);
  const cache = new Map<string, string[]>();

  async function getPrefixesRecursive(prefix: string): Promise<string[]> {
    if (cache.has(prefix)) {
      return cache.get(prefix)!;
    }

    const result: string[] = [];
    const listResult = await s3.listObjectsV2({
      Bucket: process.env.BUCKET_NAME,
      Prefix: prefix,
      Delimiter: "/",
    });

    if (prefix) {
      result.push(prefix);
    }

    const commonPrefixes = listResult.CommonPrefixes || [];
    const subPrefixes = commonPrefixes
      .map((p) => p.Prefix)
      .filter((p): p is string => p !== undefined);

    // Add direct subprefixes first
    result.push(...subPrefixes);

    // Then process subfolders in parallel with concurrency limit
    if (subPrefixes.length > 0) {
      const subResults = await pLimit(
        subPrefixes,
        MAX_CONCURRENT_REQUESTS,
        getPrefixesRecursive
      );
      result.push(...subResults.flat());
    }

    cache.set(prefix, result);
    return result;
  }

  const allPrefixes = await getPrefixesRecursive(basePrefix);
  console.log(`Total of ${allPrefixes.length} prefixes found`);
  return allPrefixes;
}

// Optimized thumbnail search with caching
async function findFirstThumbnailInPrefix(
  prefix: string,
  objectCache: Map<string, string[]>
): Promise<string | null> {
  // Check cache first
  let objects: string[];
  if (objectCache.has(prefix)) {
    objects = objectCache.get(prefix)!;
  } else {
    objects = await listAllObjectsV2(prefix);
    objectCache.set(prefix, objects);
  }

  // First, look for thumbnail.jpg
  const thumbnail = objects.find((key) => key.endsWith("thumbnail.jpg"));
  if (thumbnail) {
    return thumbnail;
  }

  // If no thumbnail, look for the first file in this folder
  // Filter for files directly in this prefix (not in subfolders)
  const directFiles = objects.filter((key) => {
    // Get just the filename part after the prefix
    const relativePath = key.substring(prefix.length);
    // Check if it's directly in this folder (no additional slashes)
    return !relativePath.includes("/") && relativePath.length > 0;
  });

  // Sort to get the first file (alphabetically, which usually means page-001.jpg, etc.)
  if (directFiles.length > 0) {
    directFiles.sort();
    return directFiles[0];
  }

  // Check subfolders
  const result = await s3.listObjectsV2({
    Bucket: process.env.BUCKET_NAME,
    Prefix: prefix,
    Delimiter: "/",
  });

  const subPrefixes = (result.CommonPrefixes || [])
    .map((p) => p.Prefix)
    .filter((p): p is string => p !== undefined);

  if (subPrefixes.length === 0) {
    return null;
  }

  // Search subfolders sequentially (stop at first found)
  for (const subPrefix of subPrefixes) {
    const subThumbnail = await findFirstThumbnailInPrefix(
      subPrefix,
      objectCache
    );
    if (subThumbnail) {
      return subThumbnail;
    }
  }

  return null;
}

async function generateCoversMap(basePrefix = ""): Promise<CoverMap> {
  console.log("Starting to generate covers map...");
  const coverMap: CoverMap = {};
  const objectCache = new Map<string, string[]>();

  console.log("Fetching all prefixes from S3...");
  const allPrefixes = await getAllPrefixes(basePrefix);
  console.log(`Found a total of ${allPrefixes.length} prefixes to process`);

  let processed = 0;
  let withThumbnail = 0;
  let withoutThumbnail = 0;

  // Process prefixes in parallel with concurrency limit
  await pLimit(allPrefixes, MAX_CONCURRENT_REQUESTS, async (prefix) => {
    processed++;

    if (processed % 50 === 0 || processed === allPrefixes.length) {
      console.log(
        `Progress: ${processed}/${allPrefixes.length} prefixes processed (${Math.round(
          (processed / allPrefixes.length) * 100
        )}%)`
      );
    }

    const thumbnail = await findFirstThumbnailInPrefix(prefix, objectCache);

    if (thumbnail) {
      coverMap[prefix] = thumbnail;
      withThumbnail++;
    } else {
      coverMap[prefix] = "thumbnail.jpg";
      withoutThumbnail++;
    }
  });

  console.log("\n=== Cover Map Generation Summary ===");
  console.log(`Total prefixes processed: ${processed}`);
  console.log(`Prefixes with thumbnails: ${withThumbnail}`);
  console.log(`Prefixes using default thumbnail: ${withoutThumbnail}`);
  console.log(`Coverage rate: ${Math.round((withThumbnail / processed) * 100)}%`);

  return coverMap;
}

async function main() {
  console.log("=== S3 Cover Map Generator ===");
  console.log(`Starting at: ${new Date().toISOString()}`);
  console.log(`Using bucket: ${process.env.BUCKET_NAME}`);
  console.log(`Using region: ${process.env.BUCKET_REGION}`);

  // Get base prefix from command line arguments
  const basePrefix = process.argv[2] || "";
  console.log(`Using base prefix: "${basePrefix || 'root'}"`);

  const startTime = Date.now();

  try {
    // Read existing covers map if it exists
    const outputPath = path.join(__dirname, "../assets/covers-new.json");
    let existingCoverMap: CoverMap = {};

    if (fs.existsSync(outputPath)) {
      console.log(`Reading existing covers map from: ${outputPath}`);
      const existingData = fs.readFileSync(outputPath, 'utf-8');
      existingCoverMap = JSON.parse(existingData);
      console.log(`Found ${Object.keys(existingCoverMap).length} existing entries`);
    }

    // Generate new covers map with the specified base prefix
    const newCoverMap = await generateCoversMap(basePrefix);

    // Merge the maps, with new entries taking precedence
    const mergedCoverMap = { ...existingCoverMap, ...newCoverMap };

    // Sort keys alphabetically
    const sortedCoverMap: CoverMap = {};
    Object.keys(mergedCoverMap)
      .sort()
      .forEach(key => {
        sortedCoverMap[key] = mergedCoverMap[key];
      });

    // Write to file
    console.log(`\nWriting merged covers map to file: ${outputPath}`);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(sortedCoverMap, null, 2));

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Covers map generated successfully at ${outputPath}`);
    console.log(`Existing entries: ${Object.keys(existingCoverMap).length}`);
    console.log(`New entries: ${Object.keys(newCoverMap).length}`);
    console.log(`Total entries after merge: ${Object.keys(sortedCoverMap).length}`);
    console.log(`Total execution time: ${totalTime} seconds`);
  } catch (error) {
    console.error("\n❌ Error generating covers map:", error);
    process.exit(1);
  }
}

main();

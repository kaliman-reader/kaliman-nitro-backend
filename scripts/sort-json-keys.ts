import * as fs from "fs";
import * as path from "path";

/**
 * Sorts all keys in a JSON object alphabetically (recursively for nested objects)
 */
function sortObjectKeys(obj: any): any {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return obj;
  }

  const sorted: any = {};
  Object.keys(obj)
    .sort()
    .forEach((key) => {
      sorted[key] = sortObjectKeys(obj[key]);
    });

  return sorted;
}

async function main() {
  console.log("=== JSON Key Sorter ===");

  // Get input file from command line arguments
  const inputFile = process.argv[2];
  const outputFile = process.argv[3];

  if (!inputFile) {
    console.error("\n❌ Error: Please provide an input JSON file path");
    console.log("\nUsage:");
    console.log("  tsx scripts/sort-json-keys.ts <input-file> [output-file]");
    console.log("\nExamples:");
    console.log("  tsx scripts/sort-json-keys.ts assets/covers.json");
    console.log("  tsx scripts/sort-json-keys.ts assets/covers.json assets/covers-sorted.json");
    console.log("\nIf no output file is specified, the input file will be overwritten.");
    process.exit(1);
  }

  const inputPath = path.resolve(inputFile);
  const outputPath = outputFile ? path.resolve(outputFile) : inputPath;

  try {
    // Check if input file exists
    if (!fs.existsSync(inputPath)) {
      console.error(`\n❌ Error: Input file not found: ${inputPath}`);
      process.exit(1);
    }

    console.log(`Reading JSON from: ${inputPath}`);
    const fileContent = fs.readFileSync(inputPath, "utf-8");

    console.log("Parsing JSON...");
    const jsonData = JSON.parse(fileContent);

    console.log("Sorting keys...");
    const sortedData = sortObjectKeys(jsonData);

    console.log(`Writing sorted JSON to: ${outputPath}`);
    fs.writeFileSync(outputPath, JSON.stringify(sortedData, null, 2));

    const totalKeys = Object.keys(jsonData).length;
    console.log(`\n✅ Success! Sorted ${totalKeys} top-level keys`);

    if (inputPath === outputPath) {
      console.log(`File updated: ${outputPath}`);
    } else {
      console.log(`Original: ${inputPath}`);
      console.log(`Sorted:   ${outputPath}`);
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error("\n❌ Error: Invalid JSON file");
      console.error(error.message);
    } else {
      console.error("\n❌ Error processing file:", error);
    }
    process.exit(1);
  }
}

main();


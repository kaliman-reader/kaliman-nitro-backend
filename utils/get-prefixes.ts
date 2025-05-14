import { _Object, CommonPrefix, S3 } from "@aws-sdk/client-s3";

function sortByNumericKey(a: { lastKey: string }, b: { lastKey: string }) {
  const regex = /(\d+)/;
  const aMatch = a.lastKey.match(regex);
  const bMatch = b.lastKey.match(regex);
  const aInt = aMatch ? parseInt(aMatch[0], 10) : 0;
  const bInt = bMatch ? parseInt(bMatch[0], 10) : 0;
  return aInt - bInt;
}

export default async function getPrefixes(
  s3: S3,
  prefix?: string
): Promise<_Object[] | CommonPrefix[]> {
  const result = await s3.listObjects({
    Bucket: process.env.BUCKET_NAME,
    Prefix: prefix,
    Delimiter: "/",
  });
  if (result.CommonPrefixes && result.CommonPrefixes?.length > 0) {
    return result.CommonPrefixes.map((prefix) => ({
      lastKey: prefix.Prefix.split("/").at(-2),
      ...prefix,
    })).sort(sortByNumericKey);
  }
  return result.Contents.map((prefix) => ({
    lastKey: prefix.Key.split("/").at(-1),
    ...prefix,
  })).sort(sortByNumericKey);
}

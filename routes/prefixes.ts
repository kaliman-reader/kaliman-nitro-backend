import { S3 } from "@aws-sdk/client-s3";

export default eventHandler(async (event) => {
  const s3 = new S3({});
  const query = getQuery(event);
  const prefix = query.prefix as string;
  const prefixes = await getFolders(s3, prefix);
  return prefixes;
});

async function getFolders(s3: S3, prefix?: string) {
  const result = await s3.listObjects({
    Bucket: process.env.BUCKET_NAME,
    Prefix: prefix,
    Delimiter: "/",
  });
  if (result.CommonPrefixes && result.CommonPrefixes?.length > 0) {
    return result.CommonPrefixes;
  }
  return result.Contents;
}

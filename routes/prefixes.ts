import { S3 } from "@aws-sdk/client-s3";

export default eventHandler(async (event) => {
  const s3 = new S3({});
  const query = getQuery(event);
  const prefix = query.prefix as string;
  const prefixes = await getPrefixes(s3, prefix);
  return prefixes;
});

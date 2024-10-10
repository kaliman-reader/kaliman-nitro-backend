import { S3 } from "@aws-sdk/client-s3";

export default async function getObject(
  s3: S3,
  bucket: string,
  key: string
): Promise<Uint8Array> {
  const result = await s3.getObject({
    Bucket: bucket,
    Key: key,
  });
  return result.Body.transformToByteArray();
}

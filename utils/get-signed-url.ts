import { GetObjectCommand, S3 } from "@aws-sdk/client-s3";
import { getSignedUrl as s3GetSignedUrl } from "@aws-sdk/s3-request-presigner";

const SIGNED_URL_EXPIRATION = 3600;

export default async function getSignedUrl(bucket: string, key: string) {
  const s3 = new S3({
    region: process.env.BUCKET_REGION,
  });
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  const signedUrl = await s3GetSignedUrl(s3, command, {
    expiresIn: SIGNED_URL_EXPIRATION,
  });
  return {
    url: signedUrl,
  };
}

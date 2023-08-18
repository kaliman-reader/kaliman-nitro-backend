import { GetObjectCommand, S3 } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const SIGNED_URL_EXPIRATION = 3600;

export default eventHandler((event) => {
  const s3 = new S3({});
  const query = getQuery(event);
  const key = query.key as string;
  const command = new GetObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: key,
  });
  const signedUrl = getSignedUrl(s3, command, {
    expiresIn: SIGNED_URL_EXPIRATION,
  });
  return {
    url: signedUrl,
  };
});

import { getSignedUrl } from "@aws-sdk/cloudfront-signer";
import { addMinutes } from "date-fns";
import { ofetch } from "ofetch";

export default eventHandler(async (event) => {
  const query = getQuery(event);
  const config = useRuntimeConfig(event);
  const key = query.key as string;

  const cloudfrontDistributionDomain = config.awsCfBaseUrl;
  const url = `${cloudfrontDistributionDomain}/${key}`;
  const privateKey = process.env.AWS_CF_PRIVATE_KEY;
  const keyPairId = config.awsCfKeyPairId;
  const dateLessThan = addMinutes(new Date(), 10).toISOString();

  const signedUrl = getSignedUrl({
    url,
    keyPairId,
    dateLessThan,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  });

  return ofetch(signedUrl);
});

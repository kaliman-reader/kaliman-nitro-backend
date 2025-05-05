import { getSignedUrl } from "@aws-sdk/cloudfront-signer";
import { addMinutes } from "date-fns";
import { ofetch } from "ofetch";

export default eventHandler(async (event) => {
  const query = getQuery(event);
  const config = useRuntimeConfig(event);
  const prefix = query.prefix as string;

  const storage = useStorage('assets:server');
  console.log(await storage.getKeys())
  const coversMap = await storage.getItem<Record<string, string>>('covers.json');

  const key = coversMap[prefix] || coversMap[`${prefix}/`];

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
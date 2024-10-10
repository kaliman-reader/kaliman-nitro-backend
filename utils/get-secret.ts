import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

export default async function getSecret(name: string): Promise<string> {
  const client = new SecretsManagerClient({
    region: process.env.BUCKET_REGION,
  });

  const response = await client.send(
    new GetSecretValueCommand({
      SecretId: name,
      VersionStage: "AWSCURRENT",
    })
  );

  return response.SecretString;
}

import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

export default async function getSecret(name: string): Promise<string> {
  const client = new SecretsManagerClient({
    region: "us-east-1",
  });

  const response = await client.send(
    new GetSecretValueCommand({
      SecretId: name,
      VersionStage: "AWSCURRENT",
    })
  );

  return response.SecretString;
}

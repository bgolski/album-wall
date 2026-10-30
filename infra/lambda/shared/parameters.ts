import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

const ssmClient = new SSMClient({});
// Kept while the function stays warm, so each value is read from SSM once per instance.
const cachedParameters = new Map<string, string>();

/**
 * Reads and decrypts a SecureString parameter.
 *
 * @param parameterName Parameter path.
 * @returns The value, trimmed.
 * @throws When the parameter is missing or empty.
 */
export async function getSecureParameter(parameterName: string): Promise<string> {
  const cachedValue = cachedParameters.get(parameterName);
  if (cachedValue) return cachedValue;

  const response = await ssmClient.send(
    new GetParameterCommand({ Name: parameterName, WithDecryption: true })
  );
  const value = response.Parameter?.Value?.trim();
  if (!value) throw new Error(`Missing secure parameter: ${parameterName}`);

  cachedParameters.set(parameterName, value);
  return value;
}

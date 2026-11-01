/** The part of a Lambda Function URL request that carries its body. */
export interface RequestBody {
  body?: string | null;
  isBase64Encoded?: boolean;
}

/** The request body as text: decoded when the Function URL sent it as base64, "" when there is none. */
export function readBody(event: RequestBody): string {
  if (event.isBase64Encoded && event.body) {
    return Buffer.from(event.body, "base64").toString("utf-8");
  }
  return event.body ?? "";
}

/** The parts of a Lambda Function URL request the functions read. */
export interface FunctionUrlEvent extends RequestBody {
  rawPath?: string;
  rawQueryString?: string;
  headers?: Record<string, string | undefined> | null;
  queryStringParameters?: Record<string, string | undefined> | null;
  requestContext?: { http?: { method?: string } };
}

/**
 * A JSON response for a Function URL.
 *
 * @param cacheControl Cache-Control for CloudFront and browsers.
 */
export function jsonResponse(statusCode: number, body: unknown, cacheControl = "no-store") {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      // Nothing is cached unless a response says so: errors and signed-in answers never are.
      "cache-control": cacheControl,
    },
    body: JSON.stringify(body),
  };
}

/**
 * Reads a JSON request body.
 *
 * @param maxLength Longest body accepted, in characters.
 * @returns The parsed body, or null when it is missing or not a JSON object.
 */
export function readJsonBody(event: RequestBody, maxLength = 4000): Record<string, unknown> | null {
  const text = readBody(event);
  if (text.length > maxLength) return null;
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

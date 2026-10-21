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

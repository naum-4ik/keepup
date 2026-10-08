export type AuthErrorReason = "expired" | "denied" | "unknown";

type AuthErrorParams = URLSearchParams | Record<string, string | undefined>;

const EXPIRED_CODES = new Set(["otp_expired", "flow_state_expired"]);

function getParam(params: AuthErrorParams, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  return params[key];
}

export function authErrorReason(params: AuthErrorParams): AuthErrorReason | null {
  const error = getParam(params, "error");
  const errorCode = getParam(params, "error_code");

  if (!error && !errorCode) return null;
  if (errorCode && EXPIRED_CODES.has(errorCode)) return "expired";
  if (error === "access_denied" && !errorCode) return "denied";
  return "unknown";
}

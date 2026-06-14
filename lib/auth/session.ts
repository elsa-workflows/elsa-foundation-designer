import { decodeJwt } from "jose";

export type JwtClaims = {
  exp?: number;
  iat?: number;
  sub?: string;
  name?: string;
  email?: string;
  unique_name?: string;
  preferred_username?: string;
  [key: string]: unknown;
};

export type Session = {
  accessToken: string;
  claims: JwtClaims;
  /** Epoch millis; absent if `exp` claim missing. */
  expiresAt?: number;
};

export function decodeAccessToken(token: string): Session {
  const claims = decodeJwt(token) as JwtClaims;
  return {
    accessToken: token,
    claims,
    expiresAt: claims.exp ? claims.exp * 1000 : undefined,
  };
}

export function isExpired(claims: JwtClaims, skewMs = 60_000): boolean {
  if (!claims.exp) return false;
  return claims.exp * 1000 - skewMs <= Date.now();
}

export function displayName(claims: JwtClaims): string {
  return (
    (claims.name as string | undefined) ??
    (claims.preferred_username as string | undefined) ??
    (claims.unique_name as string | undefined) ??
    (claims.email as string | undefined) ??
    (claims.sub as string | undefined) ??
    "User"
  );
}

import { cookies } from "next/headers";

export async function getAccessToken(): Promise<string | null> {
  const jar = await cookies();

  return (
    jar.get("__Secure-authjs.session-token")?.value ??
    jar.get("authjs.session-token")?.value ??
    null
  );
}
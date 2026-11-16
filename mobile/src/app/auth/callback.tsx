import { Redirect } from "expo-router";

/**
 * iOS hands the AuthKit redirect straight to the auth session, so this route is never shown there.
 * If the OS opens `countmypush://auth/callback` as a deep link anyway, land on «Sammen» instead of a missing route.
 */
export default function AuthCallback() {
  return <Redirect href="/social" />;
}

import { resolveSystemDeepLinkPath } from '@/services/sync/deep-link';

/**
 * Intercepts incoming Android/OS deep links before Expo Router attempts to match routes.
 * Ensures KuroSync action links (`kurosync://connect`, `kurosync://pair`, `kurotv://sync`, etc.)
 * do not trigger `Unmatched Route`, while preserving standard in-app navigation deep links
 * such as `kurotv://anime/<id>` or `kurotv://downloads`.
 */
export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}): string | null {
  return resolveSystemDeepLinkPath({ path, initial });
}

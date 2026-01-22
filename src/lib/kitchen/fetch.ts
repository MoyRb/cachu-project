import { buildKitchenHeaders, isKitchenDev, KitchenRole } from "@/lib/kitchen/auth";

export async function kitchenFetch(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  options: { role: KitchenRole; userId: number },
) {
  const headers = new Headers(init?.headers ?? undefined);
  if (isKitchenDev()) {
    const kitchenHeaders = buildKitchenHeaders(options.role, options.userId);
    Object.entries(kitchenHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });
  }

  return fetch(input, {
    ...init,
    headers,
  });
}

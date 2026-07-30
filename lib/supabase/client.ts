import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Lazy singleton — defers createClient() until first property access,
// so module evaluation during SSR prerendering doesn't crash.
let _instance: ReturnType<typeof createClient> | null = null;

function getInstance() {
  if (!_instance) _instance = createClient();
  return _instance;
}

export const supabase: ReturnType<typeof createClient> = new Proxy(
  {} as ReturnType<typeof createClient>,
  {
    get(_, prop) {
      const target = getInstance();
      const val = (target as any)[prop];
      return typeof val === "function" ? val.bind(target) : val;
    },
  }
);

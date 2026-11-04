// Checks the Supabase settings in .env.local without printing any key.
// Usage: npm run check:supabase
const env = (...names) => names.map((n) => process.env[n]).find(Boolean);
const url = env("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
const publishable = env("SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY");
const secret = env("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");

if (!url || !publishable) {
  console.error("✗ SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY is missing in .env.local");
  process.exit(1);
}

// A normal table query: 200 (table exists) or 404 "table not found" both mean the key was accepted; 401/403 mean it wasn't.
async function check(label, key) {
  const res = await fetch(`${url}/rest/v1/countries?select=slug&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const accepted = res.status === 200 || res.status === 404;
  console.log(`${accepted ? "✓" : "✗"} ${label}: HTTP ${res.status}${res.status === 404 ? " (tables not created yet — phase 2.2)" : ""}`);
  return accepted;
}

const health = await fetch(`${url}/auth/v1/health`, { headers: { apikey: publishable } });
console.log(`${health.ok ? "✓" : "✗"} Supabase project reachable (${new URL(url).host}): HTTP ${health.status}`);
const ok = [health.ok];
ok.push(await check("publishable key accepted", publishable));
if (secret) ok.push(await check("secret key accepted", secret));
else console.log("• secret key not set yet (needed from phase 2.4 for saving form submissions)");
process.exit(ok.every(Boolean) ? 0 : 1);

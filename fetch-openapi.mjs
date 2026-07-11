import fs from 'fs';

// Read .env.local manually
const envContent = fs.readFileSync('.env.local', 'utf8');
let supabaseUrl = '';
let supabaseAnonKey = '';
for (const line of envContent.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    if (key === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = value;
    if (key === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') supabaseAnonKey = value;
  }
}

async function run() {
  const url = `${supabaseUrl}/rest/v1/?apikey=${supabaseAnonKey}`;
  console.log("Fetching OpenAPI spec from:", url);
  try {
    const res = await fetch(url);
    const text = await res.text();
    console.log("Response status:", res.status);
    console.log("Response text:", text.substring(0, 500));
  } catch (e) {
    console.error("Failed to fetch OpenAPI spec:", e.message);
  }
}

run();

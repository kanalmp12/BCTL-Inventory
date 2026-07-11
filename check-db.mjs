import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../../../Desktop/BCTL-Inventory/BCTL-Inventory/.env.local');

let supabaseUrl = '';
let supabaseAnonKey = '';

try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      // Remove surrounding quotes if any
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      if (key === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = value;
      if (key === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') supabaseAnonKey = value;
    }
  }
} catch (e) {
  console.error("Failed to read .env.local", e);
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing environment variables.", { supabaseUrl, supabaseAnonKey });
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data, error } = await supabase.from('inventory_items').select('*').limit(1);
  if (error) {
    console.error("Error querying inventory_items:", error.message);
    console.log("MIGRATION_REQUIRED");
  } else {
    console.log("MIGRATION_OK");
    console.log("Success! inventory_items table is accessible. Data:", data);
  }
}

check();

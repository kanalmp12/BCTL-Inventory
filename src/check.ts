import { supabase } from "./lib/supabase";

async function main() {
  const { data, error } = await supabase.from("inventory_items").select("*");
  console.log("ITEMS COUNT:", data?.length);
  console.log("ITEMS ERROR:", error);
  console.log("ITEMS:", data);
}
main();

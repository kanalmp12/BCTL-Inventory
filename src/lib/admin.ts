import { supabase } from "./supabase";
import { InventoryItem } from "./transactions";

export interface AdminTransaction {
  id: string;
  borrow_date: string;
  expected_return_date: string;
  actual_return_date: string | null;
  status: "borrowed" | "returned" | "overdue";
  quantity: number;
  reason: string;
  checkout_photo_url: string | null;
  return_photo_url: string | null;
  return_condition: string | null;
  return_notes: string | null;
  student: {
    id: string;
    full_name: string;
    student_code: string;
    email: string;
    nickname: string | null;
    current_department: string;
  };
  item: {
    id: string;
    name_th: string;
    name_en: string;
    category: string;
  };
}

export interface AdminUser {
  id: string;
  full_name: string;
  nickname: string | null;
  student_code: string;
  email: string;
  current_department: string;
  created_at: string;
}

/**
 * Checks if a user is an authorized staff or admin
 */
export async function checkIsAdmin(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (error || !data) return false;
    return data.role === "admin" || data.role === "staff";
  } catch {
    return false;
  }
}

/**
 * Fetch all tools (including inactive ones) for admin management
 */
export async function getAdminTools(): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    console.error("Admin fetch tools error:", error);
    return [];
  }
  return data || [];
}

/**
 * Fetch all transactions with joined student and item details
 */
export async function getAdminTransactions(): Promise<AdminTransaction[]> {
  const { data, error } = await supabase
    .from("inventory_transactions")
    .select(`
      *,
      student:students (
        id,
        full_name,
        student_code,
        email,
        nickname,
        current_department
      ),
      item:inventory_items (
        id,
        name_th,
        name_en,
        category
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Admin fetch transactions error:", error);
    return [];
  }
  return (data as any) || [];
}

/**
 * Fetch all registered student profiles
 */
export async function getAdminUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Admin fetch users error:", error);
    return [];
  }
  return data || [];
}

/**
 * Adds a new item to inventory
 */
export async function addInventoryItem(itemData: Omit<InventoryItem, "created_at" | "updated_at">): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("inventory_items")
    .insert({
      ...itemData,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error("Add inventory item error:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Updates an existing item in inventory
 */
export async function updateInventoryItem(itemId: string, itemData: Partial<Omit<InventoryItem, "id" | "created_at" | "updated_at">>): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("inventory_items")
    .update({
      ...itemData,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId);

  if (error) {
    console.error("Update inventory item error:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Deactivates (soft deletes) an item in inventory
 */
export async function deleteInventoryItem(itemId: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("inventory_items")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId);

  if (error) {
    console.error("Delete inventory item error:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Helper to upload a tool's product image
 */
export async function uploadToolImage(itemId: string, imageFile: File): Promise<string> {
  const fileExt = imageFile.name.split(".").pop();
  const filePath = `tools/${itemId}_${Date.now()}.${fileExt}`;

  const { error } = await supabase.storage
    .from("inventory_photos")
    .upload(filePath, imageFile, {
      cacheControl: "3600",
      upsert: true,
    });

  if (error) throw error;

  const { data } = supabase.storage.from("inventory_photos").getPublicUrl(filePath);
  return data.publicUrl;
}

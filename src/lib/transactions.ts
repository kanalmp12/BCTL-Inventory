import { supabase } from "./supabase";
import { uploadTransactionPhoto } from "./storage";

export interface InventoryItem {
  id: string;
  name_th: string;
  name_en: string;
  category: string;
  location: string;
  total_qty: number;
  available_qty: number;
  is_many: boolean;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  myBorrowedQty?: number; // mapped dynamically
}

export interface ActiveBorrow {
  id: string;
  student_id: string;
  item_id: string;
  quantity: number;
  borrow_date: string;
  expected_return_date: string;
  status: "borrowed" | "returned" | "overdue";
  reason: string;
  checkout_photo_url: string | null;
}

/**
 * Fetch all active inventory items
 */
export async function getInventoryItems(): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("is_active", true)
    .order("id", { ascending: true });

  if (error) {
    console.error("Error fetching inventory items:", error);
    return [];
  }
  return data || [];
}

/**
 * Fetch active borrows for a student
 */
export async function getStudentActiveBorrows(studentId: string): Promise<ActiveBorrow[]> {
  const { data, error } = await supabase
    .from("inventory_transactions")
    .select("*")
    .eq("student_id", studentId)
    .eq("status", "borrowed")
    .order("borrow_date", { ascending: true });

  if (error) {
    console.error("Error fetching active borrows:", error);
    return [];
  }
  return data || [];
}

/**
 * Processes a batch checkout (borrowing tools)
 */
export async function borrowToolsBatch(
  studentId: string,
  reason: string,
  expectedReturnDate: string,
  items: { item: InventoryItem; quantity: number; photoFile: File }[]
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Process each item checkout
    for (const lineItem of items) {
      const transactionId = crypto.randomUUID();

      // Upload photo
      const checkoutPhotoUrl = await uploadTransactionPhoto(
        transactionId,
        "checkout",
        lineItem.photoFile
      );

      // Insert transaction record
      const { error: insertError } = await supabase
        .from("inventory_transactions")
        .insert({
          id: transactionId,
          student_id: studentId,
          item_id: lineItem.item.id,
          quantity: lineItem.quantity,
          expected_return_date: expectedReturnDate,
          status: "borrowed",
          reason: reason,
          checkout_photo_url: checkoutPhotoUrl,
        });

      if (insertError) throw insertError;

      // Update inventory item quantity if not is_many
      if (!lineItem.item.is_many) {
        const newQty = Math.max(0, lineItem.item.available_qty - lineItem.quantity);
        const { error: updateError } = await supabase
          .from("inventory_items")
          .update({ available_qty: newQty, updated_at: new Date().toISOString() })
          .eq("id", lineItem.item.id);

        if (updateError) throw updateError;
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error("Borrow batch transaction failed:", error);
    return { success: false, error: error.message || "Failed to process borrow" };
  }
}

/**
 * Processes a batch return (returning tools)
 */
export async function returnToolsBatch(
  studentId: string,
  items: {
    transactionId: string;
    itemId: string;
    condition: "สภาพดี" | "ได้รับความเสียหาย" | "ใช้แล้วหมดไป";
    notes: string;
    photoFile: File;
  }[]
): Promise<{ success: boolean; error?: string }> {
  try {
    for (const returnItem of items) {
      // 1. Upload return photo
      const returnPhotoUrl = await uploadTransactionPhoto(
        returnItem.transactionId,
        "return",
        returnItem.photoFile
      );

      // 2. Fetch original transaction to get quantity
      const { data: tx, error: txError } = await supabase
        .from("inventory_transactions")
        .select("quantity")
        .eq("id", returnItem.transactionId)
        .single();

      if (txError) throw txError;

      // 3. Update transaction record
      const { error: updateTxError } = await supabase
        .from("inventory_transactions")
        .update({
          status: "returned",
          actual_return_date: new Date().toISOString(),
          return_condition: returnItem.condition,
          return_notes: returnItem.notes,
          return_photo_url: returnPhotoUrl,
        })
        .eq("id", returnItem.transactionId);

      if (updateTxError) throw updateTxError;

      // 4. Update inventory item quantity if not is_many and not lost/consumed
      if (returnItem.condition !== "ใช้แล้วหมดไป") {
        const { data: item, error: itemError } = await supabase
          .from("inventory_items")
          .select("available_qty, is_many")
          .eq("id", returnItem.itemId)
          .single();

        if (itemError) throw itemError;

        if (!item.is_many) {
          const newQty = item.available_qty + tx.quantity;
          const { error: updateItemError } = await supabase
            .from("inventory_items")
            .update({ available_qty: newQty, updated_at: new Date().toISOString() })
            .eq("id", returnItem.itemId);

          if (updateItemError) throw updateItemError;
        }
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error("Return batch transaction failed:", error);
    return { success: false, error: error.message || "Failed to process return" };
  }
}

import { supabase } from "./supabase";

/**
 * Compresses an image file client-side using HTML5 Canvas.
 * Returns a Blob containing the compressed JPEG.
 */
export function compressImage(file: File, maxWidth = 1024, quality = 0.6): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context could not be created"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Image compression failed"));
            }
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

/**
 * Uploads a compressed image blob to Supabase Storage
 */
export async function uploadTransactionPhoto(
  transactionId: string,
  photoType: "checkout" | "return",
  imageFile: File
): Promise<string> {
  try {
    const compressedBlob = await compressImage(imageFile);
    
    // File path: /checkout/uuid.jpg or /return/uuid.jpg
    const filePath = `${photoType}/${transactionId}.jpg`;
    
    // Convert Blob to File to allow uploading
    const fileToUpload = new File([compressedBlob], `${transactionId}.jpg`, {
      type: "image/jpeg",
    });

    const { error } = await supabase.storage
      .from("inventory_photos")
      .upload(filePath, fileToUpload, {
        cacheControl: "3600",
        upsert: true,
      });

    if (error) {
      // If bucket does not exist, let's log details
      console.error("Storage upload error:", error);
      throw error;
    }

    const { data } = supabase.storage.from("inventory_photos").getPublicUrl(filePath);
    return data.publicUrl;
  } catch (err) {
    console.error("Failed to upload transaction photo:", err);
    throw err;
  }
}

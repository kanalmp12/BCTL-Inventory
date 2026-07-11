import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const { email, studentCode, lineUserId, lineDisplayName, linePictureUrl } = await request.json();

    if (!email || !studentCode) {
      return NextResponse.json({ error: "Email and Student Code are required." }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = studentCode.trim();

    // 1. Query the student roster bypassing RLS
    const { data: student, error: fetchError } = await supabaseServer
      .from("students")
      .select("*")
      .eq("email", cleanEmail)
      .eq("student_code", cleanCode)
      .maybeSingle();

    if (fetchError || !student) {
      return NextResponse.json({ error: "Student not found in roster or credentials incorrect." }, { status: 400 });
    }

    let targetProfileId = student.profile_id;

    // 2. Manage Supabase Auth user
    if (targetProfileId) {
      // User exists in auth (e.g. from Google login in iFIT)
      // Force set/update their password to student code so they can log in via credentials
      const { error: passwordError } = await supabaseServer.auth.admin.updateUserById(
        targetProfileId,
        { password: cleanCode }
      );
      if (passwordError) {
        console.error("Failed to update password for existing user:", passwordError);
        return NextResponse.json({ error: "Failed to verify credentials." }, { status: 500 });
      }
    } else {
      // User does not exist in auth yet
      // Create new Supabase Auth user
      const { data: authUser, error: createError } = await supabaseServer.auth.admin.createUser({
        email: cleanEmail,
        password: cleanCode,
        email_confirm: true,
      });

      if (createError) {
        console.error("Failed to create auth user:", createError);
        return NextResponse.json({ error: createError.message || "Failed to create user account." }, { status: 500 });
      }

      targetProfileId = authUser.user.id;

      // Update student table with new profile_id
      const { error: updateError } = await supabaseServer
        .from("students")
        .update({
          profile_id: targetProfileId,
          is_onboarded: true,
          is_active: true,
        })
        .eq("id", student.id);

      if (updateError) {
        console.error("Failed to update student profile_id:", updateError);
        return NextResponse.json({ error: "Failed to link student profile." }, { status: 500 });
      }
    }

    // 3. Link LINE ID if provided
    if (lineUserId && targetProfileId) {
      // Deactivate any existing active link for this LINE user
      await supabaseServer
        .from("line_account_links")
        .update({ unlinked_at: new Date().toISOString() })
        .eq("line_user_id", lineUserId)
        .is("unlinked_at", null);

      // Insert new link
      const { error: linkError } = await supabaseServer
        .from("line_account_links")
        .insert({
          profile_id: targetProfileId,
          line_user_id: lineUserId,
          line_display_name: lineDisplayName || null,
          line_picture_url: linePictureUrl || null,
        });

      if (linkError) {
        console.error("Failed to link LINE account:", linkError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Verify student route error:", err);
    return NextResponse.json({ error: err.message || "An error occurred during verification." }, { status: 500 });
  }
}

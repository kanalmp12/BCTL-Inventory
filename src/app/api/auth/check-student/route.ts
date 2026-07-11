import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Server-side client with service role — bypasses RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Normalize phone: keep digits only */
const normalizePhone = (p: string) => p.replace(/\D/g, "");

export async function POST(req: NextRequest) {
  try {
    const { email, phone } = await req.json();

    if (!email || !phone) {
      return NextResponse.json({ error: "email and phone required" }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(phone);

    // Fetch all students matching the email (should be 1 at most)
    const { data: students, error } = await supabaseAdmin
      .from("students")
      .select("id, email, phone, student_code, is_onboarded, is_active")
      .eq("email", email.toLowerCase().trim());

    if (error) {
      console.error("check-student error:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    const emailExists = (students ?? []).length > 0;

    // Find one where phone normalizes to match
    const match = (students ?? []).find(
      (s) => normalizePhone(s.phone ?? "") === normalizedPhone
    );

    if (!match) {
      if (emailExists) {
        return NextResponse.json({ status: "email_exists_phone_mismatch" });
      }
      return NextResponse.json({ status: "not_found" });
    }

    if (!match.is_onboarded) {
      return NextResponse.json({ status: "not_onboarded" });
    }

    return NextResponse.json({
      status: "found",
      student_code: match.student_code,
      email: match.email,
    });
  } catch (err) {
    console.error("check-student exception:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

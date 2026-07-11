import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { idToken } = await req.json();
    if (!idToken) {
      return NextResponse.json({ error: "Missing LINE ID token" }, { status: 400 });
    }

    const liffId = process.env.NEXT_PUBLIC_LIFF_ID || "";
    const clientId = liffId.split("-")[0];

    // 1. Verify LINE ID token
    const lineRes = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        id_token: idToken,
        client_id: clientId,
      }),
    });

    if (!lineRes.ok) {
      const errText = await lineRes.text();
      console.error("LINE Token Verification failed:", errText);
      return NextResponse.json({ error: "Invalid LINE token" }, { status: 401 });
    }

    const lineData = await lineRes.json();
    const lineUserId = lineData.sub;

    if (!lineUserId) {
      return NextResponse.json({ error: "Could not extract LINE User ID" }, { status: 401 });
    }

    // 2. Query DB for link using Admin client (service role) to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: link, error: linkErr } = await supabaseAdmin
      .from("line_account_links")
      .select("profile_id")
      .eq("line_user_id", lineUserId)
      .is("unlinked_at", null)
      .maybeSingle();

    if (linkErr) {
      throw linkErr;
    }

    if (!link?.profile_id) {
      return NextResponse.json({ status: "not_linked" });
    }

    // 3. Fetch linked student email and code
    const { data: student, error: studentErr } = await supabaseAdmin
      .from("students")
      .select("email, student_code")
      .eq("profile_id", link.profile_id)
      .maybeSingle();

    if (studentErr) {
      throw studentErr;
    }

    if (!student) {
      return NextResponse.json({ status: "not_linked" });
    }

    // 4. Authenticate student and get Supabase session
    const { data: authData, error: authErr } = await supabaseAdmin.auth.signInWithPassword({
      email: student.email,
      password: student.student_code,
    });

    if (authErr) {
      throw authErr;
    }

    return NextResponse.json({
      status: "linked",
      session: authData.session,
    });
  } catch (error: any) {
    console.error("check-line-link error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

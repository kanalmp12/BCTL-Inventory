import { supabase } from "./supabase";
import { getLineProfile } from "./liff";
import { Session } from "@supabase/supabase-js";


export interface StudentProfile {
  id: string;
  profile_id: string | null;
  full_name: string;
  nickname: string | null;
  student_code: string;
  email: string;
  phone: string | null;
  year_level: number | null;
  current_department: string;
  cohort_id: string;
  is_onboarded: boolean;
  is_active: boolean;
  avatar_url: string | null;
}

export async function fetchCurrentStudent(existingSession?: Session | null): Promise<StudentProfile | null> {
  try {
    // Use provided session or fetch from Supabase (avoids double round-trip)
    let session = existingSession;
    if (session === undefined) {
      const { data } = await supabase.auth.getSession();
      session = data.session;
    }

    if (session?.user) {
      const { data: student, error } = await supabase
        .from("students")
        .select("id, profile_id, full_name, nickname, student_code, email, phone, year_level, current_department, cohort_id, is_onboarded, is_active, avatar_url")
        .eq("profile_id", session.user.id)
        .maybeSingle();

      if (student && !error) return student;
    }
  } catch (error) {
    console.error("Error fetching current student profile:", error);
  }
  return null;
}

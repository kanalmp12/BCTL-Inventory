"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "./supabase";
import { initLiff, loginWithLine as lineLogin, logoutFromLine as lineLogout, getLineProfile, getLineIdToken } from "./liff";
import { fetchCurrentStudent, StudentProfile } from "./auth";
import { Session } from "@supabase/supabase-js";
import { checkIsAdmin } from "./admin";

interface AuthContextType {
  student: StudentProfile | null;
  session: Session | null;
  lineProfile: any | null;
  loading: boolean;
  isAdmin: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithLine: () => void;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  unlinkLine: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [lineProfile, setLineProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const refreshProfile = async () => {
    setLoading(true);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);

      const profile = await fetchCurrentStudent();
      console.log("AuthContext: student set", profile); setStudent(profile);

      const line = await getLineProfile();
      setLineProfile(line);

      if (currentSession?.user?.id) {
        const verified = await checkIsAdmin(currentSession.user.id);
        setIsAdmin(verified);
      } else {
        setIsAdmin(false);
      }
    } catch (error) {
      console.error("Error refreshing profile:", error);
    } finally {
      console.log("AuthContext: setting loading to false"); setLoading(false);
    }
  };

  const unlinkLine = async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("line_account_links")
        .update({ unlinked_at: new Date().toISOString() })
        .eq("profile_id", session.user.id)
        .is("unlinked_at", null);

      if (error) throw error;

      // Clear LINE locally and reload
      lineLogout();
      setLineProfile(null);
    } catch (error) {
      console.error("Failed to unlink LINE account:", error);
    } finally {
      console.log("AuthContext: setting loading to false"); setLoading(false);
    }
  };

  const loginWithCredentials = async (email: string, studentCode: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          studentCode,
          lineUserId: lineProfile?.userId || null,
          lineDisplayName: lineProfile?.displayName || null,
          linePictureUrl: lineProfile?.pictureUrl || null,
        }),
      });

      const result = await res.json();
      if (!res.ok || result.error) {
        throw new Error(result.error || "Failed to verify student record.");
      }

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: studentCode,
      });

      if (authError) throw authError;
      
      setSession(data.session);
      await refreshProfile();
    } catch (err) {
      console.error("Login with credentials failed:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const registerStudent = async (studentData: any) => {
    setLoading(true);
    try {
      // ── Pre-registration duplicate checks ──────────────────────────────

      // 1a. Check if email already registered in students table
      const { data: existingByEmail } = await supabase
        .from("students")
        .select("id")
        .eq("email", studentData.email.toLowerCase())
        .maybeSingle();
      if (existingByEmail) {
        throw new Error("อีเมลนี้ลงทะเบียนไปแล้ว กรุณาใช้ฟังก์ชัน 'เชื่อมต่อข้อมูล' แทน");
      }

      // 1b. Check if student_code already registered
      const { data: existingByCode } = await supabase
        .from("students")
        .select("id")
        .eq("student_code", studentData.student_code)
        .maybeSingle();
      if (existingByCode) {
        throw new Error("รหัสนักศึกษานี้ลงทะเบียนไปแล้ว กรุณาใช้ฟังก์ชัน 'เชื่อมต่อข้อมูล' แทน");
      }

      // 1c. Check if LINE account already linked to an existing user
      if (lineProfile?.userId) {
        const { data: existingLineLink } = await supabase
          .from("line_account_links")
          .select("id")
          .eq("line_user_id", lineProfile.userId)
          .is("unlinked_at", null)
          .maybeSingle();
        if (existingLineLink) {
          throw new Error("บัญชี LINE นี้เชื่อมโยงกับผู้ใช้อื่นอยู่แล้ว กรุณาใช้ฟังก์ชัน 'เชื่อมต่อข้อมูล' แทน");
        }
      }

      // ── Create Auth account ────────────────────────────────────────────
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: studentData.email,
        password: studentData.student_code,
      });

      if (signUpError) {
        // Supabase returns "User already registered" if the email exists in auth.users
        if (signUpError.message?.toLowerCase().includes("already registered")) {
          throw new Error("อีเมลนี้มีบัญชีอยู่แล้ว กรุณาใช้ฟังก์ชัน 'เชื่อมต่อข้อมูล' แทน");
        }
        throw signUpError;
      }

      const authUserId = signUpData.user?.id;
      if (!authUserId) throw new Error("Could not create user auth account.");

      // 1.5 Resolve or create cohort in talent_cohorts
      let cohortId = null;
      if (studentData.cohort_number) {
        const cohortNum = parseInt(studentData.cohort_number, 10);
        if (!isNaN(cohortNum)) {
          let { data: existingCohort } = await supabase
            .from("talent_cohorts")
            .select("id")
            .eq("cohort_number", cohortNum)
            .maybeSingle();

          if (existingCohort) {
            cohortId = existingCohort.id;
          } else {
            const { data: newCohort, error: newCohortError } = await supabase
              .from("talent_cohorts")
              .insert({
                cohort_number: cohortNum,
                display_name: `BUCA Talent รุ่นที่ ${cohortNum}`,
                is_active: true
              })
              .select("id")
              .maybeSingle();
            
            if (!newCohortError && newCohort) {
              cohortId = newCohort.id;
            }
          }
        }
      }

      // 2. Insert into students table
      const { error: insertError } = await supabase
        .from("students")
        .insert({
          profile_id: authUserId,
          cohort_id: cohortId || studentData.cohort_id || null,
          prefix: studentData.prefix || null,
          full_name: studentData.full_name,
          nickname: studentData.nickname || null,
          student_code: studentData.student_code,
          email: studentData.email,
          phone: studentData.phone || null,
          year_level: studentData.year_level || null,
          faculty: studentData.faculty || null,
          major: studentData.major || null,
          minor: studentData.minor || null,
          student_type: studentData.student_type || 'activity',
          current_department: studentData.current_department || 'unknown',
          is_onboarded: true,
          is_active: true,
          avatar_url: studentData.avatar_url || null,
        });


      if (insertError) throw insertError;

      // 3. Link LINE if active
      if (lineProfile?.userId) {
        await supabase.from("line_account_links").insert({
          profile_id: authUserId,
          line_user_id: lineProfile.userId,
          line_display_name: lineProfile.displayName || null,
          line_picture_url: lineProfile.pictureUrl || null,
        });
      }

      setSession(signUpData.session);
      await refreshProfile();
    } catch (err) {
      console.error("Registration failed:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        const liffTimeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5000));
        const liffPromise = initLiff().catch(() => false);

        const [isLoggedInLine, { data: { session: initialSession } }] = await Promise.all([
          Promise.race([liffPromise, liffTimeout]),
          supabase.auth.getSession(),
        ]);

        let currentSession = initialSession;
        let activeLineProfile = null;
        if (isLoggedInLine) {
          activeLineProfile = await getLineProfile();
          setLineProfile(activeLineProfile);
        } else {
          // Detect if mobile (iOS/Android) outside LINE and not logged in to LINE -> auto-login
          if (typeof window !== "undefined") {
            const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
            const isInLine = /Line\//i.test(navigator.userAgent);
            if (isMobile && !isInLine) {
              lineLogin();
              return;
            }
          }
        }

        // Fetch student profile based on session first
        let profile = await fetchCurrentStudent(currentSession);

        // If no session but LINE logged in, try to auto-login using secure check-line-link API (bypassing RLS)
        const lineIdToken = isLoggedInLine ? getLineIdToken() : null;
        if (!currentSession && lineIdToken) {
          try {
            const res = await fetch("/api/auth/check-line-link", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ idToken: lineIdToken }),
            });
            const result = await res.json();
            if (res.ok && result.status === "linked" && result.session) {
              const { data: setSessionData, error: setSessionErr } = await supabase.auth.setSession({
                access_token: result.session.access_token,
                refresh_token: result.session.refresh_token,
              });
              if (!setSessionErr && setSessionData.session) {
                currentSession = setSessionData.session;
                setSession(currentSession);
                profile = await fetchCurrentStudent(currentSession);
              }
            }
          } catch (err) {
            console.error("Auto-login via check-line-link failed:", err);
          }
        }

        setSession(currentSession);
        setStudent(profile);

        if (currentSession?.user?.id) {
          const verified = await checkIsAdmin(currentSession.user.id);
          setIsAdmin(verified);
        } else {
          setIsAdmin(false);
        }

        // Automatic account linking if session exists but LINE not linked yet
        if (currentSession?.user?.id && activeLineProfile?.userId) {
          const { data: existingLink } = await supabase
            .from("line_account_links")
            .select("id")
            .eq("profile_id", currentSession.user.id)
            .is("unlinked_at", null)
            .maybeSingle();

          if (!existingLink) {
            await supabase.from("line_account_links").insert({
              profile_id: currentSession.user.id,
              line_user_id: activeLineProfile.userId,
              line_display_name: activeLineProfile.displayName || null,
              line_picture_url: activeLineProfile.pictureUrl || null,
            });
            console.log("LINE account automatically linked to student profile.");
          }
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
      } finally {
        setLoading(false);
      }
    };

    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      setSession(currentSession);
      const profile = await fetchCurrentStudent(currentSession);
      setStudent(profile);

      if (currentSession?.user?.id) {
        const verified = await checkIsAdmin(currentSession.user.id);
        setIsAdmin(verified);
      } else {
        setIsAdmin(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [lineProfile?.userId]);

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          hd: "bumail.net",
          prompt: "select_account",
        },
      },
    });
    if (error) throw error;
  };

  const loginWithLine = () => {
    lineLogin();
  };

  const logout = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      lineLogout(); // Also clears localStorage and reloads
      setStudent(null);
      setSession(null);
      setLineProfile(null);
      setIsAdmin(false);
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      console.log("AuthContext: setting loading to false"); setLoading(false);
    }
  };

  const mockLineLogin = (mockProfile?: any) => {
    const defaultMock = {
      userId: "U" + Math.random().toString(16).substring(2, 18).padEnd(32, "0"),
      displayName: "นักศึกษาจำลอง (Mock)",
      pictureUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150",
    };
    setLineProfile(mockProfile || defaultMock);
  };

  return (
    <AuthContext.Provider
      value={{
        student,
        session,
        lineProfile,
        loading,
        isAdmin,
        loginWithGoogle,
        loginWithLine,
        logout,
        refreshProfile,
        unlinkLine,
        // Extend context type with the new credential methods
        ...({
          loginWithCredentials,
          registerStudent,
          mockLineLogin
        } as any)
      }}
    >
      {children}
    </AuthContext.Provider>
  );

};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/lib/LanguageContext";
import { TranslationKey } from "@/lib/translations";
import {
  getInventoryItems,
  getStudentActiveBorrows,
  borrowToolsBatch,
  returnToolsBatch,
  InventoryItem,
  ActiveBorrow,
} from "@/lib/transactions";
import { supabase } from "@/lib/supabase";
import {
  ShoppingCart,
  ChevronDown,
  LogIn,
  LogOut,
  Search,
  X,
  CheckSquare,
  Plus,
  Minus,
  MapPin,
  Ban,
  Award,
  Camera,
  Trash2,
  Check,
  Loader2,
  HelpCircle,
  Menu,
  UserPlus,
  User,
  UploadCloud,
  Tag,
} from "lucide-react";
import Image from "next/image";

interface CartItem {
  item: InventoryItem;
  quantity: number;
  photoFile: File | null;
  photoPreviewUrl: string | null;
}

interface ReturnCartItem {
  transaction: ActiveBorrow;
  item: InventoryItem;
  condition: "สภาพดี" | "ได้รับความเสียหาย" | "ใช้แล้วหมดไป";
  notes: string;
  photoFile: File | null;
  photoPreviewUrl: string | null;
}

export default function InventoryDashboard() {
  const { 
    student, 
    session, 
    lineProfile, 
    loading: authLoading, 
    loginWithGoogle, 
    loginWithLine, 
    logout, 
    unlinkLine, 
    isAdmin,
    loginWithCredentials,
    registerStudent,
    mockLineLogin
  } = useAuth() as any;
  const { language, setLanguage, t } = useLanguage();

  // LINE account link states
  const [isLineLinked, setIsLineLinked] = useState(false);
  const [linkedLineName, setLinkedLineName] = useState<string | null>(null);

  const [loadingGoogle, setLoadingGoogle] = useState(false);

  // Inventory items and user active borrows
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [activeBorrows, setActiveBorrows] = useState<ActiveBorrow[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  // Check active LINE account connection status
  useEffect(() => {
    const checkLineLink = async () => {
      if (session?.user?.id) {
        const { data, error } = await supabase
          .from("line_account_links")
          .select("line_display_name")
          .eq("profile_id", session.user.id)
          .is("unlinked_at", null)
          .maybeSingle();
        if (data && !error) {
          setIsLineLinked(true);
          setLinkedLineName(data.line_display_name);
        } else {
          setIsLineLinked(false);
          setLinkedLineName(null);
        }
      } else {
        setIsLineLinked(false);
        setLinkedLineName(null);
      }
    };
    checkLineLink();
  }, [session, lineProfile]);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "available" | "borrowed" | "overdue" | "my-borrows">("all");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [locations, setLocations] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [categories, setCategories] = useState<string[]>([]);
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);

  // Cart & Return State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [returnCart, setReturnCart] = useState<ReturnCartItem[]>([]);
  const [cartModalOpen, setCartModalOpen] = useState(false);
  const [cartModalType, setCartModalType] = useState<"borrow" | "return">("borrow");

  // Borrow Details Form
  const [borrowReason, setBorrowReason] = useState("");
  const [expectedReturnDate, setExpectedReturnDate] = useState("");

  // UI States
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [confettiParticles, setConfettiParticles] = useState<any[]>([]);

  // Onboarding Wizard States
  const [wizardMode, setWizardMode] = useState<"check" | "register">("check");
  const [wizardStep, setWizardStep] = useState(1); // step within register mode: 1=personal, 2=edu, 3=photo
  // Step 1 — check
  const [checkEmail, setCheckEmail] = useState("");
  const [checkPhone, setCheckPhone] = useState("");
  // Step 2+ — register (email/phone pre-filled from check)
  const [regCode, setRegCode] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPrefix, setRegPrefix] = useState("นาย");
  const [regFullName, setRegFullName] = useState("");
  const [regNickname, setRegNickname] = useState("");
  const [regYear, setRegYear] = useState(1);
  const [regType, setRegType] = useState("activity");
  const [regDept, setRegDept] = useState("organize_operation");
  const [regFaculty, setRegFaculty] = useState("");
  const [regMajor, setRegMajor] = useState("");
  const [regMinor, setRegMinor] = useState("");
  const [regCohort, setRegCohort] = useState("13");
  const [regAvatarSource, setRegAvatarSource] = useState<"line" | "file">("line");
  const [regAvatarFile, setRegAvatarFile] = useState<File | null>(null);
  const [regAvatarPreview, setRegAvatarPreview] = useState<string | null>(null);
  const [isWizardSubmitting, setIsWizardSubmitting] = useState(false);

  // DOM Refs
  const locationMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const triggerConfetti = () => {
    const colors = ["#1a5fb4", "#3d8757", "#d87a1c", "#c03d3d", "#ecc81a", "#ec1a8a", "#1aecc8"];
    const particles = [];
    for (let i = 0; i < 40; i++) {
      particles.push({
        id: Math.random(),
        x: 45 + Math.random() * 10,
        y: 40 + Math.random() * 20,
        color: colors[Math.floor(Math.random() * colors.length)],
        angle: Math.random() * 360,
        size: 6 + Math.random() * 8,
        delay: Math.random() * 0.2,
      });
    }
    setConfettiParticles(particles);
    setTimeout(() => {
      setConfettiParticles([]);
    }, 2500);
  };

  // Show toast notification
  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    if (type === "success") {
      triggerConfetti();
    }
    setTimeout(() => setToast(null), 3000);
  };

  // Load inventory items once on mount — public data, no auth required
  useEffect(() => {
    const loadInventory = async () => {
      setLoadingItems(true);
      try {
        const inventory = await getInventoryItems();
        setItems(inventory);
        const uniqueLocs = Array.from(new Set(inventory.map((item) => item.location))).filter(Boolean);
        setLocations(uniqueLocs);
        const uniqueCats = Array.from(new Set(inventory.map((item) => item.category))).filter(Boolean);
        setCategories(uniqueCats);
      } catch (err) {
        console.error("Error loading inventory:", err);
      } finally {
        setLoadingItems(false);
      }
    };
    loadInventory();
  }, []); // ← only on mount, NOT on every student change

  // Load active borrows separately, only once student is known
  useEffect(() => {
    if (!student?.id) return;
    const loadBorrows = async () => {
      try {
        const borrows = await getStudentActiveBorrows(student.id);
        setActiveBorrows(borrows);
      } catch (err) {
        console.error("Error loading borrows:", err);
      }
    };
    loadBorrows();
  }, [student?.id]); // ← only re-runs when student ID actually changes

  // Auto-redirect to iFIT if Google logged in but student profile missing/not onboarded/inactive
  useEffect(() => {
    if (!authLoading && session?.user) {
      if (!student || !student.is_onboarded || !student.is_active) {
        const baseUrl = process.env.NEXT_PUBLIC_IFIT_URL || "https://buca-talent-ifit.vercel.app";
        const hash = `#access_token=${session.access_token}&refresh_token=${session.refresh_token}&expires_in=3600&token_type=bearer&type=magiclink`;
        
        if (student && !student.is_active) {
          // If inactive, send to dashboard to show the inactive error screen
          window.location.href = `${baseUrl}/login?redirect=/dashboard${hash}`;
        } else {
          // If not onboarded (or no student profile yet), send to onboarding with double-redirect
          const returnUrl = encodeURIComponent(window.location.origin);
          window.location.href = `${baseUrl}/login?redirect=${encodeURIComponent(`/onboarding?redirect=${returnUrl}`)}${hash}`;
        }
      } else {
        setShowLoginModal(false);
      }
    }
  }, [authLoading, session, student]);

  const hasAutoOpened = useRef(false);
  useEffect(() => {
    // Auto-open modal only after LINE login returns profile but user has no session yet
    if (!authLoading && lineProfile && !session && !hasAutoOpened.current) {
      setShowLoginModal(true);
      hasAutoOpened.current = true;
    }
  }, [authLoading, lineProfile, session]);

  // Close menus on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (locationMenuRef.current && !locationMenuRef.current.contains(event.target as Node)) {
        setLocationDropdownOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter and Search logic
  const filteredItems = React.useMemo(() => {
    return items
      .map((item) => {
        // Map active borrow count for the logged-in student
        const userBorrowCount = activeBorrows
          .filter((b) => b.item_id === item.id)
          .reduce((sum, b) => sum + b.quantity, 0);

        return {
          ...item,
          myBorrowedQty: userBorrowCount,
        };
      })
      .filter((item) => {
        // 1. Search Query Filter
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          const matchesName =
            item.name_th.toLowerCase().includes(query) || item.name_en.toLowerCase().includes(query);
          const matchesId = item.id.toLowerCase().includes(query);
          if (!matchesName && !matchesId) return false;
        }

        // 2. Location Filter
        if (selectedLocation !== "all" && item.location !== selectedLocation) {
          return false;
        }

        // 2.5 Category Filter
        if (selectedCategory !== "all" && item.category !== selectedCategory) {
          return false;
        }

        // 3. Tab Filter
        if (filter === "available") {
          return item.available_qty > 0 || item.is_many;
        } else if (filter === "borrowed") {
          return item.available_qty === 0 && !item.is_many;
        } else if (filter === "overdue") {
          // Find if this item has overdue transactions
          const hasOverdueTx = activeBorrows.some(
            (b) => b.item_id === item.id && new Date(b.expected_return_date) < new Date()
          );
          return hasOverdueTx;
        } else if (filter === "my-borrows") {
          return (item.myBorrowedQty || 0) > 0;
        }

        return true;
      });
  }, [items, activeBorrows, searchQuery, filter, selectedLocation, selectedCategory]);

  // Sort items: Items student currently borrows come first
  const sortedItems = React.useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      if ((a.myBorrowedQty || 0) > 0 && (b.myBorrowedQty || 0) <= 0) return -1;
      if ((a.myBorrowedQty || 0) <= 0 && (b.myBorrowedQty || 0) > 0) return 1;
      return a.id.localeCompare(b.id);
    });
  }, [filteredItems]);

  // Check if current user has any active borrows to toggle the return selection button
  const hasAnyActiveBorrows = activeBorrows.length > 0;

  // Cart operations
  const addToCart = (item: InventoryItem) => {
    if (!student) {
      // Proactively open login options if unregistered or guest
      setShowLoginModal(true);
      showToast(language === "th" ? "กรุณาเข้าสู่ระบบก่อน" : "Please login first", "error");
      return;
    }
    const existing = cart.find((i) => i.item.id === item.id);
    if (existing) {
      updateCartQty(item.id, 1);
    } else {
      setCart((prev) => [...prev, { item, quantity: 1, photoFile: null, photoPreviewUrl: null }]);
      showToast(`${language === "th" ? "เพิ่มลงตะกร้าแล้ว" : "Added to cart"}`);
    }
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => {
      const item = prev.find((i) => i.item.id === itemId);
      if (item?.photoPreviewUrl) URL.revokeObjectURL(item.photoPreviewUrl);
      return prev.filter((i) => i.item.id !== itemId);
    });
  };

  const updateCartQty = (itemId: string, change: number) => {
    setCart((prev) =>
      prev.map((i) => {
        if (i.item.id === itemId) {
          const max = i.item.is_many ? 99 : i.item.available_qty;
          const newQty = Math.max(1, Math.min(max, i.quantity + change));
          return { ...i, quantity: newQty };
        }
        return i;
      })
    );
  };

  const handleCartPhotoUpload = (itemId: string, file: File | null) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setCart((prev) =>
      prev.map((i) => {
        if (i.item.id === itemId) {
          if (i.photoPreviewUrl) URL.revokeObjectURL(i.photoPreviewUrl);
          return { ...i, photoFile: file, photoPreviewUrl: previewUrl };
        }
        return i;
      })
    );
  };

  // Return selection cart operations
  const addToReturnCart = (item: InventoryItem) => {
    // Find active transactions for this item
    const studentTxs = activeBorrows.filter((b) => b.item_id === item.id);
    if (studentTxs.length === 0) return;

    // Add all active transactions for this item to return list
    setReturnCart((prev) => {
      const alreadyAdded = prev.map((ri) => ri.transaction.id);
      const newReturnItems = studentTxs
        .filter((tx) => !alreadyAdded.includes(tx.id))
        .map((tx) => ({
          transaction: tx,
          item,
          condition: "สภาพดี" as const,
          notes: "",
          photoFile: null,
          photoPreviewUrl: null,
        }));
      return [...prev, ...newReturnItems];
    });
    showToast(language === "th" ? "เพิ่มรายการคืนแล้ว" : "Added return item");
  };

  const removeFromReturnCart = (transactionId: string) => {
    setReturnCart((prev) => {
      const item = prev.find((ri) => ri.transaction.id === transactionId);
      if (item?.photoPreviewUrl) URL.revokeObjectURL(item.photoPreviewUrl);
      return prev.filter((ri) => ri.transaction.id !== transactionId);
    });
  };

  const handleReturnPhotoUpload = (transactionId: string, file: File | null) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setReturnCart((prev) =>
      prev.map((ri) => {
        if (ri.transaction.id === transactionId) {
          if (ri.photoPreviewUrl) URL.revokeObjectURL(ri.photoPreviewUrl);
          return { ...ri, photoFile: file, photoPreviewUrl: previewUrl };
        }
        return ri;
      })
    );
  };

  // Submit borrow transaction
  const handleBorrowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;

    if (!borrowReason.trim() || !expectedReturnDate) {
      showToast(t("msg_fill_all"), "error");
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    if (expectedReturnDate < todayStr) {
      showToast(
        language === "th" ? "วันที่กำหนดคืนต้องไม่เป็นอดีต" : "Return date cannot be in the past",
        "error"
      );
      return;
    }

    // Photo check
    const missingPhoto = cart.some((i) => !i.photoFile);
    if (missingPhoto) {
      showToast(t("msg_photo_required"), "error");
      return;
    }

    setSubmittingAction(true);
    try {
      const result = await borrowToolsBatch(
        student.id,
        borrowReason,
        expectedReturnDate,
        cart.map((c) => ({
          item: c.item,
          quantity: c.quantity,
          photoFile: c.photoFile!,
        }))
      );

      if (result.success) {
        showToast(t("msg_borrow_success"), "success");
        // Clear cart
        cart.forEach((c) => c.photoPreviewUrl && URL.revokeObjectURL(c.photoPreviewUrl));
        setCart([]);
        setBorrowReason("");
        setExpectedReturnDate("");
        setCartModalOpen(false);
        // Refresh inventory availability and active borrows
        const [newInventory, newBorrows] = await Promise.all([
          getInventoryItems(),
          getStudentActiveBorrows(student.id),
        ]);
        setItems(newInventory);
        setActiveBorrows(newBorrows);
      } else {
        showToast(result.error || "Borrow failed", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Borrow failed", "error");
    } finally {
      setSubmittingAction(false);
    }
  };

  // Submit return transaction
  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;

    // Photo check
    const missingPhoto = returnCart.some((ri) => !ri.photoFile);
    if (missingPhoto) {
      showToast(t("msg_photo_required"), "error");
      return;
    }

    setSubmittingAction(true);
    try {
      const result = await returnToolsBatch(
        student.id,
        returnCart.map((ri) => ({
          transactionId: ri.transaction.id,
          itemId: ri.item.id,
          condition: ri.condition,
          notes: ri.notes,
          photoFile: ri.photoFile!,
        }))
      );

      if (result.success) {
        showToast(t("msg_return_success"), "success");
        // Clear return cart
        returnCart.forEach((ri) => ri.photoPreviewUrl && URL.revokeObjectURL(ri.photoPreviewUrl));
        setReturnCart([]);
        setCartModalOpen(false);
        // Refresh inventory availability and active borrows
        const [newInventory, newBorrows] = await Promise.all([
          getInventoryItems(),
          getStudentActiveBorrows(student.id),
        ]);
        setItems(newInventory);
        setActiveBorrows(newBorrows);
      } else {
        showToast(result.error || "Return failed", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Return failed", "error");
    } finally {
      setSubmittingAction(false);
    }
  };


  // Step 1 — Check email+phone → auto-login if onboarded, else open register form
  const handleCheckAndLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = checkEmail.trim().toLowerCase();
    const phone = checkPhone.trim().replace(/\D/g, "");

    if (!email || !phone) {
      showToast(t("msg_fill_all"), "error");
      return;
    }
    if (!email.endsWith("@bumail.net")) {
      showToast(language === "th" ? "กรุณาใช้อีเมลมหาวิทยาลัย (@bumail.net)" : "Please use @bumail.net email", "error");
      return;
    }
    if (phone.length < 9) {
      showToast(language === "th" ? "กรุณากรอกเบอร์โทรให้ครบ" : "Please enter a valid phone number", "error");
      return;
    }

    setIsWizardSubmitting(true);
    try {
      // Call server-side API (uses service role → bypasses RLS, normalizes phone)
      const res = await fetch("/api/auth/check-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone }),
      });
      const result = await res.json();

      if (result.status === "found") {
        // ✅ Already onboarded — log in seamlessly
        await loginWithCredentials(email, result.student_code);
        showToast(language === "th" ? "เข้าสู่ระบบสำเร็จ!" : "Logged in successfully!", "success");
        setShowLoginModal(false);
        setCheckEmail("");
        setCheckPhone("");
        setWizardMode("check");
      } else if (result.status === "not_onboarded") {
        // Found but not yet onboarded in iFIT
        showToast(language === "th" ? "บัญชีนี้ยังไม่ได้ Onboard ใน iFIT" : "This account hasn't completed iFIT onboarding", "error");
      } else if (result.status === "email_exists_phone_mismatch") {
        // Email exists but phone number does not match
        showToast(
          language === "th"
            ? "อีเมลนี้ลงทะเบียนในระบบแล้ว แต่เบอร์โทรศัพท์ไม่ถูกต้อง"
            : "This email is already registered, but the phone number does not match.",
          "error"
        );
      } else {
        // ❌ Not found (Email not registered at all) — pre-fill email & phone, go to register
        setRegEmail(email);
        setRegPhone(phone);
        setWizardMode("register");
        setWizardStep(1);
      }
    } catch (err: any) {
      showToast(err.message || (language === "th" ? "เกิดข้อผิดพลาด" : "An error occurred"), "error");
    } finally {
      setIsWizardSubmitting(false);
    }
  };

  // Submit New Registration (Onboarding)
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regEmail.trim() || !regCode.trim() || !regFullName.trim() || !regNickname.trim() || !regPhone.trim() || !regFaculty.trim() || !regMajor.trim()) {
      showToast(t("msg_fill_all"), "error");
      return;
    }
    if (regCode.trim().length !== 10) {
      showToast(language === "th" ? "รหัสนักศึกษาต้องมี 10 หลัก" : "Student code must be 10 digits", "error");
      return;
    }

    setIsWizardSubmitting(true);
    try {
      let avatarUrl = lineProfile?.pictureUrl || null;

      // Handle avatar file upload if custom file is selected
      if (regAvatarSource === "file" && regAvatarFile) {
        const fileExt = regAvatarFile.name.split(".").pop();
        const fileName = `${regCode.trim()}_avatar_${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("inventory_photos")
          .upload(`avatars/${fileName}`, regAvatarFile, {
            cacheControl: "3600",
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("inventory_photos")
          .getPublicUrl(`avatars/${fileName}`);
        
        avatarUrl = publicUrlData.publicUrl;
      }

      await registerStudent({
        prefix: regPrefix,
        full_name: regFullName.trim(),
        nickname: regNickname.trim(),
        student_code: regCode.trim(),
        email: regEmail.trim().toLowerCase(),
        phone: regPhone.trim(),
        year_level: regYear,
        student_type: regType,
        current_department: regDept,
        faculty: regFaculty.trim(),
        major: regMajor.trim(),
        minor: regMinor.trim() || null,
        cohort_number: regCohort,
        avatar_url: avatarUrl
      });

      showToast(language === "th" ? "ลงทะเบียนสำเร็จ!" : "Registration successful!", "success");
      setShowLoginModal(false);
      
      // Reset states
      setCheckEmail("");
      setCheckPhone("");
      setRegEmail("");
      setRegCode("");
      setRegFullName("");
      setRegNickname("");
      setRegPhone("");
      setRegFaculty("");
      setRegMajor("");
      setRegMinor("");
      setRegAvatarFile(null);
      setRegAvatarPreview(null);
      setWizardMode("check");
      setWizardStep(1);
    } catch (err: any) {
      showToast(err.message || "Registration failed", "error");
    } finally {
      setIsWizardSubmitting(false);
    }
  };




  return (
    <div className="flex flex-col flex-1 min-h-screen relative font-sans">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[9999] px-4 py-3 rounded-lg shadow-lg border text-sm font-bold flex items-center gap-2 animate-fade-in-up ${
            toast.type === "success"
              ? "bg-success/10 text-success border-success/20 backdrop-blur-md"
              : "bg-destructive/10 text-destructive border-destructive/20 backdrop-blur-md"
          }`}
        >
          {toast.type === "success" ? <Check size={18} /> : <Ban size={18} />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <header className="app-header sticky top-0 z-40 bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="logo-section flex items-center gap-3">
            <Image
              src="/img/BUCA Talent LOGO.png"
              alt="BUCA Talent LOGO"
              width={160}
              height={40}
              className="h-10 w-auto object-contain"
              priority
            />
            <h1 className="text-xl font-bold text-foreground hidden sm:block">
              {t("app_title")}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Cart Button */}
            <button
              onClick={() => {
                if (cart.length > 0) {
                  setCartModalType("borrow");
                  setCartModalOpen(true);
                } else if (returnCart.length > 0) {
                  setCartModalType("return");
                  setCartModalOpen(true);
                } else {
                  showToast(t("msg_cart_empty"), "error");
                }
              }}
              aria-label="View shopping cart"
              className="relative w-11 h-11 rounded-full hover:bg-muted text-primary focus-ring transition-colors border border-border flex items-center justify-center"
            >
              <ShoppingCart size={20} />
              {(cart.length > 0 || returnCart.length > 0) && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center border border-card">
                  {cart.length > 0 ? cart.length : returnCart.length}
                </span>
              )}
            </button>
 
            {/* Help Info Button */}
            <button
              onClick={() => setShowHelpModal(true)}
              aria-label="View guidelines"
              className="w-11 h-11 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground focus-ring transition-colors border border-border flex items-center justify-center shrink-0"
            >
              <HelpCircle size={20} />
            </button>

            {/* Auth Dropdowns */}
            {authLoading ? (
              <div className="h-9 w-24 bg-muted animate-pulse rounded-full" />
            ) : student ? (
              // Logged in & Registered Student
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  aria-label="User menu"
                  className="flex items-center gap-2 pl-2 pr-3 min-h-[44px] rounded-full border border-border hover:bg-muted focus-ring transition-colors text-sm font-medium"
                >
                  <div className="relative w-7 h-7">
                    <div className="w-full h-full rounded-full overflow-hidden border border-border">
                      {(student.avatar_url || lineProfile?.pictureUrl) ? (
                        <img 
                          src={student.avatar_url || lineProfile?.pictureUrl || undefined} 
                          alt={`${student.nickname || student.full_name}'s avatar`} 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <div className="w-full h-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                          {student.nickname?.[0]?.toUpperCase() || student.full_name[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    {student.profile_id && (
                      <div className="absolute -top-0.5 -right-0.5 bg-yellow-400 text-white rounded-full p-[1px] border border-white z-10">
                        <Award size={8} />
                      </div>
                    )}
                  </div>
                  <span className="max-w-[100px] truncate text-foreground font-bold">
                    {student.nickname || student.full_name}
                  </span>
                  <ChevronDown size={14} className={`text-muted-foreground transition-transform ${userDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-xl shadow-xl py-1 z-50 animate-fade-in-up">
                    <div className="px-4 py-3 border-b border-border mb-1">
                      <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Language</p>
                      <div className="flex items-center gap-2 text-sm font-bold">
                        <button
                          onClick={() => { setLanguage("th"); setUserDropdownOpen(false); }}
                          aria-label="Switch language to Thai"
                          aria-pressed={language === "th"}
                          className={`px-3 py-2 rounded-lg hover:text-primary focus-ring transition-colors ${language === "th" ? "text-primary" : "text-muted-foreground"}`}
                        >
                          TH
                        </button>
                        <span className="text-border">|</span>
                        <button
                          onClick={() => { setLanguage("en"); setUserDropdownOpen(false); }}
                          aria-label="Switch language to English"
                          aria-pressed={language === "en"}
                          className={`px-3 py-2 rounded-lg hover:text-primary focus-ring transition-colors ${language === "en" ? "text-primary" : "text-muted-foreground"}`}
                        >
                          EN
                        </button>
                      </div>
                    </div>
                    {/* Admin Portal Button */}
                    {(isAdmin || student.current_department.toLowerCase() === "staff" || student.current_department.toLowerCase() === "admin") ? (
                      <a
                        href="/admin"
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted focus-ring font-bold"
                      >
                        <Award size={16} className="text-primary" />
                        {t("menu_admin")}
                      </a>
                    ) : null}




                    <button
                      onClick={logout}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 dark:text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20 focus-ring font-bold text-left border-t border-border"
                    >
                      <LogOut size={16} />
                      {t("btn_logout")}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              // Guest Controls: Language Selector + Login Action
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-xs font-bold border border-border rounded-full p-1 bg-card">
                  <button
                    onClick={() => setLanguage("th")}
                    aria-label="Switch language to Thai"
                    aria-pressed={language === "th"}
                    className={`px-2 py-1 rounded-full transition-colors focus-ring text-[10px] font-bold ${
                      language === "th" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    TH
                  </button>
                  <button
                    onClick={() => setLanguage("en")}
                    aria-label="Switch language to English"
                    aria-pressed={language === "en"}
                    className={`px-2 py-1 rounded-full transition-colors focus-ring text-[10px] font-bold ${
                      language === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    EN
                  </button>
                </div>

                <button
                  onClick={() => setShowLoginModal(true)}
                  aria-label="Open Login Wizard"
                  className="bg-primary text-primary-foreground font-bold px-4 py-2 min-h-[44px] rounded-full text-sm shadow-md hover:brightness-105 focus-ring transition-all flex items-center justify-center gap-1.5"
                >
                  <LogIn size={15} />
                  {t("btn_login")}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-7xl mx-auto w-full px-4 py-6 flex-1 flex flex-col gap-6">
        {/* Search and Navigation Bar */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Search bar */}
          <div className="relative w-full md:max-w-md">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Search size={18} />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("search_placeholder")}
              className="w-full h-12 pl-11 pr-10 bg-card border border-border rounded-full focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none font-medium text-sm text-foreground"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                aria-label="Clear search query"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-ring rounded"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Filter tabs */}
          <div className="flex flex-nowrap overflow-x-auto no-scrollbar items-center gap-2 w-full md:w-auto pb-0.5 md:pb-0">
            <button
              onClick={() => setFilter("all")}
              className={`h-11 px-4 rounded-full text-xs font-bold border focus-ring shrink-0 admin-btn-press ${
                filter === "all"
                  ? "bg-primary border-primary text-primary-foreground shadow-sm"
                  : "bg-card border-border hover:bg-muted text-muted-foreground"
              }`}
            >
              {t("filter_all")}
            </button>
            <button
              onClick={() => setFilter("available")}
              className={`h-11 px-4 rounded-full text-xs font-bold border focus-ring shrink-0 admin-btn-press ${
                filter === "available"
                  ? "bg-primary border-primary text-primary-foreground shadow-sm"
                  : "bg-card border-border hover:bg-muted text-muted-foreground"
              }`}
            >
              {t("filter_available")}
            </button>
            <button
              onClick={() => setFilter("borrowed")}
              className={`h-11 px-4 rounded-full text-xs font-bold border focus-ring shrink-0 admin-btn-press ${
                filter === "borrowed"
                  ? "bg-primary border-primary text-primary-foreground shadow-sm"
                  : "bg-card border-border hover:bg-muted text-muted-foreground"
              }`}
            >
              {t("filter_borrowed")}
            </button>
            <button
              onClick={() => setFilter("overdue")}
              className={`h-11 px-4 rounded-full text-xs font-bold border focus-ring shrink-0 admin-btn-press ${
                filter === "overdue"
                  ? "bg-primary border-primary text-primary-foreground shadow-sm"
                  : "bg-card border-border hover:bg-muted text-muted-foreground"
              }`}
            >
              {t("filter_overdue")}
            </button>

            {hasAnyActiveBorrows && (
              <button
                onClick={() => {
                  setFilter("my-borrows");
                }}
                className={`h-11 px-4 rounded-full text-xs font-bold border flex items-center gap-1 focus-ring shrink-0 admin-btn-press ${
                  filter === "my-borrows"
                    ? "bg-primary border-primary text-primary-foreground shadow-sm"
                    : "bg-card border-border hover:bg-muted text-muted-foreground"
                }`}
              >
                <CheckSquare size={14} />
                {language === "th" ? "คืนอุปกรณ์" : "Return Selection"}
              </button>
            )}

            {/* Category filter (Native Select styled as a pill button) */}
            <div className="relative shrink-0">
              <span className={`absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                selectedCategory !== "all" ? "text-primary" : "text-muted-foreground"
              }`}>
                <Tag size={13} />
              </span>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className={`h-11 pl-9 pr-8 rounded-full text-xs font-bold transition-all border appearance-none focus-ring cursor-pointer ${
                  selectedCategory !== "all"
                    ? "bg-primary/10 border-primary/20 text-primary"
                    : "bg-card border-border hover:bg-muted text-muted-foreground"
                }`}
              >
                <option value="all">{t("filter_category_all")}</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <span className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${
                selectedCategory !== "all" ? "text-primary" : "text-muted-foreground"
              }`}>
                <ChevronDown size={12} />
              </span>
            </div>

            {/* Location filter (Native Select styled as a pill button) */}
            <div className="relative shrink-0">
              <span className={`absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                selectedLocation !== "all" ? "text-primary" : "text-muted-foreground"
              }`}>
                <MapPin size={13} />
              </span>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className={`h-11 pl-9 pr-8 rounded-full text-xs font-bold transition-all border appearance-none focus-ring cursor-pointer ${
                  selectedLocation !== "all"
                    ? "bg-primary/10 border-primary/20 text-primary"
                    : "bg-card border-border hover:bg-muted text-muted-foreground"
                }`}
              >
                <option value="all">{t("filter_location_all")}</option>
                {locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
              <span className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${
                selectedLocation !== "all" ? "text-primary" : "text-muted-foreground"
              }`}>
                <ChevronDown size={12} />
              </span>
            </div>
          </div>
        </div>

        {/* Tools Display */}
        {loadingItems ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-4 shadow-sm animate-pulse flex flex-col gap-4">
                <div className="flex gap-4">
                  <div className="w-20 h-20 bg-muted rounded-xl" />
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="h-5 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                    <div className="h-6 bg-muted rounded-full w-1/3" />
                  </div>
                </div>
                <div className="h-10 bg-muted rounded-xl mt-auto" />
              </div>
            ))}
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border border-border border-dashed rounded-3xl bg-card">
            <Ban size={48} className="mb-2" />
            <p className="font-bold text-lg">
              {language === "th" ? "ไม่พบอุปกรณ์ที่ค้นหา" : "No items found"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedItems.map((item) => {
              const inCart = cart.find((i) => i.item.id === item.id);
              const inReturnCart = returnCart.some((ri) => ri.item.id === item.id);

              let badgeColor = "text-success bg-success/10 border-success/20";
              let availText = "";

              if (item.available_qty === 0 && !item.is_many) {
                badgeColor = "text-destructive bg-destructive/10 border-destructive/20";
                availText = t("status_out_of_stock");
              } else {
                availText = item.is_many
                  ? t("unit_many")
                  : `${t("status_available")}: ${item.available_qty} ${language === "th" ? "ชิ้น" : "Units"}`;
              }

              // Set badge if user borrowed it
              if ((item.myBorrowedQty || 0) > 0) {
                badgeColor = "text-warning bg-warning/10 border-warning/20";
                availText = language === "th" ? `ยืมอยู่ ${item.myBorrowedQty} ชิ้น` : `Borrowed ${item.myBorrowedQty} qty`;
              }

              return (
                <article
                  key={item.id}
                  className={`bg-card border rounded-2xl p-4 flex flex-col justify-between hover:shadow-md hover:border-muted-foreground/30 transition-all relative overflow-hidden ${
                    (item.myBorrowedQty || 0) > 0
                      ? "border-warning/50 ring-2 ring-warning/10"
                      : inCart
                      ? "border-success/50 ring-2 ring-success/10"
                      : "border-border"
                  }`}
                >
                  <div className="flex gap-4">
                    {/* Thumbnail Image */}
                    <div className="w-20 h-20 bg-muted rounded-xl shrink-0 overflow-hidden border border-border flex items-center justify-center relative">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={language === "th" ? item.name_th : item.name_en}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="text-[10px] text-muted-foreground text-center font-bold px-1">
                          No Photo
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-foreground text-base truncate leading-snug">
                        {language === "th" ? item.name_th : item.name_en}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">ID: {item.id}</p>

                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${badgeColor}`}>
                          {availText}
                        </span>
                        <span className="px-2 py-0.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-[10px] font-bold flex items-center gap-0.5">
                          <MapPin size={10} />
                          {item.location}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Area */}
                  <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                    {/* Return Action */}
                    {(item.myBorrowedQty || 0) > 0 ? (
                      inReturnCart ? (
                        <button
                          onClick={() => {
                            // Remove all transactions of this item from return cart
                            const txs = activeBorrows.filter((b) => b.item_id === item.id);
                            txs.forEach((tx) => removeFromReturnCart(tx.id));
                          }}
                          className="w-full py-2 bg-destructive/10 hover:bg-destructive/15 text-destructive border border-destructive/20 text-xs font-bold rounded-xl flex items-center justify-center gap-1 focus-ring admin-btn-press"
                        >
                          <X size={14} />
                          {language === "th" ? "ยกเลิกการคืน" : "Cancel Return"}
                        </button>
                      ) : (
                        <button
                          onClick={() => addToReturnCart(item)}
                          className="w-full py-2 bg-warning/10 hover:bg-warning/15 text-warning border border-warning/20 text-xs font-bold rounded-xl flex items-center justify-center gap-1 focus-ring admin-btn-press"
                        >
                          <CheckSquare size={14} />
                          {t("btn_card_return")}
                        </button>
                      )
                    ) : inCart ? (
                      // Cart Quantity Selector
                      <div className="flex items-center justify-between w-full bg-success/5 border border-success/20 rounded-xl overflow-hidden h-11">
                        <button
                          onClick={() => updateCartQty(item.id, -1)}
                          aria-label="Decrease quantity"
                          className="px-3.5 h-full flex items-center justify-center text-success hover:bg-success/10 transition-colors focus-ring"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="font-bold text-success text-sm">
                          {inCart.quantity}
                        </span>
                        <button
                          onClick={() => updateCartQty(item.id, 1)}
                          aria-label="Increase quantity"
                          className="px-3.5 h-full flex items-center justify-center text-success hover:bg-success/10 transition-colors focus-ring"
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          aria-label="Remove from cart"
                          className="px-3.5 h-full flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors border-l border-success/20 focus-ring"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ) : item.available_qty > 0 || item.is_many ? (
                      // Available: Borrow Action
                      <button
                        onClick={() => addToCart(item)}
                        className="w-full py-2 bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm focus-ring admin-btn-press"
                      >
                        <ShoppingCart size={14} />
                        {t("btn_card_borrow")}
                      </button>
                    ) : (
                      // Out of stock
                      <button
                        disabled
                        className="w-full py-2 bg-muted text-muted-foreground text-xs font-bold rounded-xl border border-border flex items-center justify-center gap-1.5 cursor-not-allowed"
                      >
                        <Ban size={14} />
                        {t("btn_card_out_of_stock")}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Cart & Return Modal Drawer */}
      {cartModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[999] p-4 backdrop-blur-sm">
          <div className="bg-card w-full max-w-xl rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col h-[85vh] animate-scale-pop">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/20">
              <h2 className="text-lg font-bold text-foreground">
                {cartModalType === "borrow" ? t("borrow_title") : t("return_title")}
              </h2>
              <button
                onClick={() => setCartModalOpen(false)}
                className="p-1 rounded-full hover:bg-muted text-muted-foreground transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4 custom-scrollbar">
              {cartModalType === "borrow" ? (
                // BORROW FORM
                <form onSubmit={handleBorrowSubmit} className="flex flex-col gap-4 h-full">
                  {/* Inline Helper Note */}
                  <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 text-xs text-primary leading-relaxed flex items-start gap-2 animate-fade-in">
                    <HelpCircle size={16} className="shrink-0 mt-0.5 text-primary" />
                    <span>
                      {language === "th"
                        ? "กรุณาแนบรูปถ่ายสภาพอุปกรณ์ล่าสุด (สำหรับรายการหลายชิ้น สามารถถ่ายรูปอุปกรณ์ทั้งหมดรวมกันรูปเดียวแล้วใช้ภาพเดิมอัปโหลดซ้ำทุกตัวได้เพื่อความรวดเร็ว)"
                        : "Please upload a photo of the gear to verify condition. For multiple items, you may upload a single group photo to all fields to speed up checkout."}
                    </span>
                  </div>
                    {cart.map((cartItem) => (
                      <div
                        key={cartItem.item.id}
                        className="flex flex-col gap-3 py-4 border-b border-border last:border-b-0"
                      >
                        <div className="flex items-start gap-4">
                          <div className={`w-14 h-14 bg-muted rounded-lg overflow-hidden border ${
                            !cartItem.photoFile ? "border-amber-500 ring-2 ring-amber-500/10" : "border-border"
                          }`}>
                            {cartItem.item.image_url && (
                              <img
                                src={cartItem.item.image_url}
                                alt={cartItem.item.name_th}
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-foreground text-sm truncate">
                              {language === "th" ? cartItem.item.name_th : cartItem.item.name_en}
                            </h4>
                            <p className="text-xs text-muted-foreground">ID: {cartItem.item.id}</p>
                            <p className="text-xs text-primary font-bold mt-1">
                              {language === "th" ? `จำนวน: ${cartItem.quantity} ชิ้น` : `Qty: ${cartItem.quantity}`}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFromCart(cartItem.item.id)}
                            className="text-muted-foreground hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        {/* Image upload per item */}
                        <div className="mt-1 flex flex-col gap-2">
                          <label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                            <Camera size={14} />
                            {t("borrow_label_photo")}
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="file"
                              accept="image/*"
                              id={`photo-${cartItem.item.id}`}
                              className="hidden"
                              onChange={(e) =>
                                handleCartPhotoUpload(cartItem.item.id, e.target.files?.[0] || null)
                              }
                            />
                            <label
                              htmlFor={`photo-${cartItem.item.id}`}
                              className={`cursor-pointer px-4 py-2 border rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 focus-ring ${
                                cartItem.photoFile
                                  ? "bg-success/10 border-success/20 text-success"
                                  : "bg-primary/5 border-primary/20 text-primary hover:bg-primary/10"
                              }`}
                            >
                              {cartItem.photoFile ? <Check size={14} /> : <Camera size={14} />}
                              {cartItem.photoFile
                                ? language === "th"
                                  ? "เปลี่ยนรูปถ่าย"
                                  : "Change Photo"
                                : t("borrow_label_upload")}
                            </label>

                            {cartItem.photoPreviewUrl && (
                              <div className="w-10 h-10 rounded-lg overflow-hidden border border-border shadow-sm">
                                <img
                                  src={cartItem.photoPreviewUrl}
                                  alt="Preview"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                  <div className="border-t border-border pt-4 flex flex-col gap-4 mt-auto">
                    {/* Reason input */}
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="borrowReason" className="text-xs font-bold text-foreground">
                        {t("borrow_label_reason")}
                      </label>
                      <textarea
                        required
                        id="borrowReason"
                        value={borrowReason}
                        onChange={(e) => setBorrowReason(e.target.value)}
                        placeholder={t("borrow_placeholder_reason")}
                        className="w-full px-3 py-2 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-card min-h-[70px] resize-y focus-ring"
                      />
                    </div>

                    {/* Return date picker */}
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="expectedReturnDate" className="text-xs font-bold text-foreground">
                        {t("borrow_label_date_return")}
                      </label>
                      <input
                        type="date"
                        required
                        id="expectedReturnDate"
                        value={expectedReturnDate}
                        onChange={(e) => setExpectedReturnDate(e.target.value)}
                        className="w-full px-3 py-2 border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-card focus-ring"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submittingAction}
                      className="w-full py-3 mt-2 bg-primary hover:bg-primary/95 text-primary-foreground font-bold rounded-xl shadow-md flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed admin-btn-press"
                    >
                      {submittingAction && <Loader2 size={16} className="animate-spin" />}
                      {t("btn_confirm_borrow")}
                    </button>
                  </div>
                </form>
              ) : (
                // RETURN FORM
                <form onSubmit={handleReturnSubmit} className="flex flex-col gap-4 h-full">
                  {/* Inline Helper Note */}
                  <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 text-xs text-primary leading-relaxed flex items-start gap-2 animate-fade-in">
                    <HelpCircle size={16} className="shrink-0 mt-0.5 text-primary" />
                    <span>
                      {language === "th"
                        ? "เลือกสภาพความเป็นจริงของอุปกรณ์ และถ่ายรูปยืนยันสภาพเพื่อการประมวลผลการคืนที่รวดเร็ว"
                        : "Select real equipment condition and upload a photo verification for faster return processing."}
                    </span>
                  </div>
                  <div className="flex flex-col gap-4">
                    {returnCart.map((ri, index) => (
                      <div
                        key={ri.transaction.id}
                        className="flex flex-col gap-3 py-4 border-b border-border last:border-b-0"
                      >
                        <div className="flex items-start gap-4">
                          <div className={`w-14 h-14 bg-muted rounded-lg overflow-hidden border ${
                            !ri.photoFile ? "border-amber-500 ring-2 ring-amber-500/10" : "border-border"
                          }`}>
                            {ri.item.image_url && (
                              <img
                                src={ri.item.image_url}
                                alt={ri.item.name_th}
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-foreground text-sm truncate">
                              {language === "th" ? ri.item.name_th : ri.item.name_en}
                            </h4>
                            <p className="text-xs text-muted-foreground">ID: {ri.item.id}</p>
                            <p className="text-xs text-primary font-bold mt-1">
                              {language === "th" ? `คืน: ${ri.transaction.quantity} ชิ้น` : `Return Qty: ${ri.transaction.quantity}`}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFromReturnCart(ri.transaction.id)}
                            className="text-muted-foreground hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        {/* Input condition & note */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                          <div className="flex flex-col gap-1">
                            <label htmlFor={`return-condition-${ri.transaction.id}`} className="text-[10px] font-bold text-muted-foreground uppercase">
                              {t("return_label_condition")}
                            </label>
                            <select
                              id={`return-condition-${ri.transaction.id}`}
                              value={ri.condition}
                              onChange={(e) => {
                                const val = e.target.value as any;
                                setReturnCart((prev) =>
                                  prev.map((c) =>
                                    c.transaction.id === ri.transaction.id
                                      ? { ...c, condition: val }
                                      : c
                                  )
                                );
                              }}
                              className="h-10 px-3 rounded-lg border border-border text-xs font-bold bg-card focus-ring"
                            >
                              <option value="สภาพดี">{t("return_cond_good")}</option>
                              <option value="ได้รับความเสียหาย">{t("return_cond_damaged")}</option>
                              <option value="ใช้แล้วหมดไป">{t("return_cond_lost")}</option>
                            </select>
                          </div>

                          <div className="flex flex-col gap-1">
                            <label htmlFor={`return-notes-${ri.transaction.id}`} className="text-[10px] font-bold text-muted-foreground uppercase">
                              {language === "th" ? "หมายเหตุ" : "Notes"}
                            </label>
                            <input
                              type="text"
                              id={`return-notes-${ri.transaction.id}`}
                              value={ri.notes}
                              placeholder={t("return_placeholder_notes")}
                              onChange={(e) => {
                                const val = e.target.value;
                                setReturnCart((prev) =>
                                  prev.map((c) =>
                                    c.transaction.id === ri.transaction.id
                                      ? { ...c, notes: val }
                                      : c
                                  )
                                );
                              }}
                              className="h-10 px-3 border border-border rounded-lg text-xs font-bold bg-card focus-ring"
                            />
                          </div>
                        </div>

                        {/* Image upload per item */}
                        <div className="mt-1 flex flex-col gap-2">
                          <label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                            <Camera size={14} />
                            {t("return_label_photo")}
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="file"
                              accept="image/*"
                              id={`return-photo-${ri.transaction.id}`}
                              className="hidden"
                              onChange={(e) =>
                                handleReturnPhotoUpload(ri.transaction.id, e.target.files?.[0] || null)
                              }
                            />
                            <label
                              htmlFor={`return-photo-${ri.transaction.id}`}
                              className={`cursor-pointer px-4 py-2 border rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 focus-ring ${
                                ri.photoFile
                                  ? "bg-success/10 border-success/20 text-success"
                                  : "bg-primary/5 border-primary/20 text-primary hover:bg-primary/10"
                              }`}
                            >
                              {ri.photoFile ? <Check size={14} /> : <Camera size={14} />}
                              {ri.photoFile
                                ? language === "th"
                                  ? "เปลี่ยนรูปถ่าย"
                                  : "Change Photo"
                                : t("return_label_upload")}
                            </label>

                            {ri.photoPreviewUrl && (
                              <div className="w-10 h-10 rounded-lg overflow-hidden border border-border shadow-sm">
                                <img
                                  src={ri.photoPreviewUrl}
                                  alt="Preview"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="submit"
                    disabled={submittingAction}
                    className="w-full py-3 mt-4 bg-primary hover:bg-primary/95 text-primary-foreground font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed admin-btn-press"
                  >
                    {submittingAction && <Loader2 size={16} className="animate-spin" />}
                    {t("btn_confirm_return")}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Onboarding & Login Wizard Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4 backdrop-blur-sm">
          <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col animate-scale-pop max-h-[90vh]">

            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/10">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <LogIn size={18} className="text-primary" />
                {!lineProfile && (language === "th" ? "เข้าสู่ระบบด้วย LINE" : "Log In with LINE")}
                {lineProfile && wizardMode === "check" && (language === "th" ? "ยืนยันตัวตน" : "Identity Check")}
                {lineProfile && wizardMode === "register" && (language === "th" ? `ลงทะเบียนผู้ใช้ใหม่ (${wizardStep}/3)` : `New Registration (${wizardStep}/3)`)}
              </h3>
              <button
                onClick={() => {
                  setShowLoginModal(false);
                  setWizardMode("check");
                  setWizardStep(1);
                }}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition-colors hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">

              {/* ── NOT LOGGED INTO LINE ── */}
              {!lineProfile ? (
                <div className="flex flex-col gap-5 text-center py-4 animate-fade-in">
                  <div className="mx-auto bg-green-50 w-16 h-16 rounded-full flex items-center justify-center mb-1">
                    <img src="/img/line.png" alt="" className="w-10 h-10 object-contain" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-foreground">
                      {language === "th" ? "เข้าสู่ระบบด้วย LINE" : "Log In with LINE"}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                      {language === "th"
                        ? "กรุณาล็อกอินด้วยบัญชี LINE ของคุณก่อนยืนยันตัวตนเข้าสู่ระบบ"
                        : "Please log in with your LINE account to continue."}
                    </p>
                  </div>
                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => loginWithLine()}
                      className="w-full py-3 bg-[#06C755] hover:bg-[#05B34C] text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm admin-btn-press"
                    >
                      {language === "th" ? "เข้าสู่ระบบด้วย LINE" : "Log In with LINE"}
                    </button>
                    <button
                      type="button"
                      onClick={() => mockLineLogin()}
                      className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-xs border border-amber-600/20 admin-btn-press"
                    >
                      {language === "th" ? "⚡ เข้าสู่ระบบ LINE (จำลองสำหรับทดสอบ)" : "⚡ Mock LINE Login (Dev Test)"}
                    </button>
                  </div>
                </div>

              ) : (
                <>
                  {/* ── STEP 1: CHECK email + phone ── */}
                  {wizardMode === "check" && (
                    <form onSubmit={handleCheckAndLogin} className="flex flex-col gap-5 py-2 animate-fade-in">
                      {/* LINE greeting */}
                      <div className="flex items-center gap-3 bg-primary/5 border border-primary/10 rounded-xl p-3">
                        {lineProfile?.pictureUrl ? (
                          <img src={lineProfile.pictureUrl} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                            <User size={20} className="text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-bold text-foreground">{lineProfile?.displayName || "LINE User"}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {language === "th"
                              ? "กรอกอีเมลและเบอร์โทรที่ใช้ลงทะเบียน iFIT เพื่อยืนยันตัวตน"
                              : "Enter the email & phone used to register in iFIT to verify your identity."}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-muted-foreground uppercase">
                            {language === "th" ? "อีเมลมหาวิทยาลัย (@bumail.net)" : "University Email (@bumail.net)"}
                          </label>
                          <input
                            type="email"
                            value={checkEmail}
                            onChange={(e) => setCheckEmail(e.target.value)}
                            placeholder="username@bumail.net"
                            className="w-full h-11 px-4 border border-border bg-background rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                            required
                            autoComplete="email"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-muted-foreground uppercase">
                            {language === "th" ? "เบอร์โทรศัพท์" : "Phone Number"}
                          </label>
                          <input
                            type="tel"
                            maxLength={10}
                            value={checkPhone}
                            onChange={(e) => setCheckPhone(e.target.value.replace(/[^\d]/g, ""))}
                            placeholder="e.g. 0812345678"
                            className="w-full h-11 px-4 border border-border bg-background rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                            required
                            autoComplete="tel"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isWizardSubmitting}
                        className="w-full py-3 bg-primary hover:bg-primary/95 text-primary-foreground font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 admin-btn-press"
                      >
                        {isWizardSubmitting && <Loader2 size={16} className="animate-spin" />}
                        {language === "th" ? "ตรวจสอบและเข้าใช้งาน" : "Check & Sign In"}
                      </button>
                    </form>
                  )}

                  {/* ── STEP 2+: REGISTER (new user) ── */}
                  {wizardMode === "register" && (
                    <form onSubmit={wizardStep === 3 ? handleRegisterSubmit : (e) => e.preventDefault()} className="flex flex-col gap-4 py-1">

                      {/* Progress dots */}
                      <div className="flex items-center justify-center gap-2 mb-1">
                        {[1, 2, 3].map((s) => (
                          <div key={s} className={`h-1.5 rounded-full transition-all ${s === wizardStep ? "w-8 bg-primary" : s < wizardStep ? "w-4 bg-primary/50" : "w-4 bg-muted"}`} />
                        ))}
                      </div>

                      {/* Step 1: Credentials + personal */}
                      {wizardStep === 1 && (
                        <div className="flex flex-col gap-4 animate-fade-in">
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300">
                            {language === "th"
                              ? "ไม่พบข้อมูลในระบบ กรุณากรอกข้อมูลเพื่อลงทะเบียนใหม่"
                              : "No existing account found. Please fill in your details to register."}
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase">{language === "th" ? "รหัสนักศึกษา" : "Student Code"}</label>
                            <input
                              type="text"
                              maxLength={10}
                              value={regCode}
                              onChange={(e) => setRegCode(e.target.value.replace(/[^\d]/g, ""))}
                              placeholder="e.g. 1640901234"
                              className="w-full h-11 px-4 border border-border bg-background rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                            />
                          </div>

                          {/* Email (pre-filled, read-only) */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase">{language === "th" ? "อีเมลมหาวิทยาลัย" : "University Email"}</label>
                            <input
                              type="email"
                              value={regEmail}
                              onChange={(e) => setRegEmail(e.target.value)}
                              placeholder="username@bumail.net"
                              className="w-full h-11 px-4 border border-border bg-background rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                            />
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-muted-foreground uppercase">{language === "th" ? "คำนำหน้า" : "Prefix"}</label>
                              <select value={regPrefix} onChange={(e) => setRegPrefix(e.target.value)} className="h-11 px-3 border border-border bg-background rounded-xl text-sm focus-ring">
                                <option value="นาย">นาย</option>
                                <option value="นางสาว">นางสาว</option>
                                <option value="นาง">นาง</option>
                                <option value="คุณ">คุณ</option>
                              </select>
                            </div>
                            <div className="col-span-2 flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-muted-foreground uppercase">{language === "th" ? "ชื่อ-นามสกุล" : "Full Name"}</label>
                              <input type="text" value={regFullName} onChange={(e) => setRegFullName(e.target.value)} placeholder="e.g. สมศักดิ์ รักดี" className="w-full h-11 px-4 border border-border bg-background rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all" />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-muted-foreground uppercase">{language === "th" ? "ชื่อเล่น" : "Nickname"}</label>
                              <input type="text" value={regNickname} onChange={(e) => setRegNickname(e.target.value)} placeholder="e.g. ต้น" className="w-full h-11 px-4 border border-border bg-background rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-muted-foreground uppercase">{language === "th" ? "เบอร์โทรศัพท์" : "Phone"}</label>
                              <input type="tel" maxLength={10} value={regPhone} onChange={(e) => setRegPhone(e.target.value.replace(/[^\d]/g, ""))} placeholder="e.g. 0812345678" className="w-full h-11 px-4 border border-border bg-background rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all" />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Step 2: Education & Roles */}
                      {wizardStep === 2 && (
                        <div className="flex flex-col gap-3 animate-fade-in">
                          <div className="grid grid-cols-3 gap-3">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-muted-foreground uppercase">{language === "th" ? "ชั้นปี" : "Year"}</label>
                              <select value={regYear} onChange={(e) => setRegYear(parseInt(e.target.value))} className="h-11 px-3 border border-border bg-background rounded-xl text-sm focus-ring">
                                <option value={1}>ปี 1</option><option value={2}>ปี 2</option><option value={3}>ปี 3</option><option value={4}>ปี 4</option>
                              </select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-muted-foreground uppercase">{language === "th" ? "รุ่น" : "Cohort"}</label>
                              <select value={regCohort} onChange={(e) => setRegCohort(e.target.value)} className="h-11 px-3 border border-border bg-background rounded-xl text-sm focus-ring">
                                <option value="11">รุ่น 11</option><option value="12">รุ่น 12</option><option value="13">รุ่น 13</option><option value="14">รุ่น 14</option><option value="15">รุ่น 15</option>
                              </select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-muted-foreground uppercase">{language === "th" ? "ประเภท" : "Type"}</label>
                              <select value={regType} onChange={(e) => setRegType(e.target.value)} className="h-11 px-3 border border-border bg-background rounded-xl text-sm focus-ring">
                                <option value="activity">กิจกรรม</option><option value="scholarship_50">ทุน 50%</option><option value="scholarship_100">ทุน 100%</option>
                              </select>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase">{language === "th" ? "ฝ่ายประจำ (iFIT/BCTL)" : "Department"}</label>
                            <select value={regDept} onChange={(e) => setRegDept(e.target.value)} className="h-11 px-3 border border-border bg-background rounded-xl text-sm focus-ring">
                              <option value="organize_operation">Organize & Operation</option>
                              <option value="public_relations_digital_marketing">PR & Digital Marketing</option>
                              <option value="visual_arts_special_technique">Visual Arts & Special Technique</option>
                              <option value="media_production">Media Production</option>
                            </select>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-muted-foreground uppercase">{language === "th" ? "คณะ" : "Faculty"}</label>
                              <input type="text" value={regFaculty} onChange={(e) => setRegFaculty(e.target.value)} placeholder="e.g. นิเทศศาสตร์" className="w-full h-11 px-4 border border-border bg-background rounded-xl text-sm focus-ring" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-muted-foreground uppercase">{language === "th" ? "สาขาเอก" : "Major"}</label>
                              <input type="text" value={regMajor} onChange={(e) => setRegMajor(e.target.value)} placeholder="e.g. การผลิตสื่อ" className="w-full h-11 px-4 border border-border bg-background rounded-xl text-sm focus-ring" />
                            </div>
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase">{language === "th" ? "วิชาโท (ถ้ามี)" : "Minor (Optional)"}</label>
                            <input type="text" value={regMinor} onChange={(e) => setRegMinor(e.target.value)} placeholder="e.g. โฆษณา" className="w-full h-11 px-4 border border-border bg-background rounded-xl text-sm focus-ring" />
                          </div>
                        </div>
                      )}

                      {/* Step 3: Profile Photo */}
                      {wizardStep === 3 && (
                        <div className="flex flex-col gap-4 py-2 animate-fade-in">
                          <p className="text-sm text-center text-muted-foreground">{language === "th" ? "เลือกรูปโปรไฟล์" : "Choose a profile photo"}</p>
                          <div className="flex items-center justify-center gap-6">
                            <label className="flex flex-col items-center gap-2 cursor-pointer p-4 border border-border rounded-2xl bg-card hover:bg-muted/30 transition-all flex-1 text-center">
                              <input type="radio" name="avatarSource" checked={regAvatarSource === "line"} onChange={() => setRegAvatarSource("line")} className="sr-only" />
                              <div className={`w-14 h-14 rounded-full border flex items-center justify-center overflow-hidden bg-muted ${regAvatarSource === "line" ? "border-primary ring-2 ring-primary/20" : "border-border"}`}>
                                {lineProfile?.pictureUrl ? <img src={lineProfile.pictureUrl} alt="" className="w-full h-full object-cover" /> : <User size={24} className="text-muted-foreground" />}
                              </div>
                              <span className="text-xs font-bold text-foreground">{language === "th" ? "ใช้โปรไฟล์ LINE" : "Use LINE Avatar"}</span>
                            </label>

                            <label className="flex flex-col items-center gap-2 cursor-pointer p-4 border border-border rounded-2xl bg-card hover:bg-muted/30 transition-all flex-1 text-center">
                              <input type="radio" name="avatarSource" checked={regAvatarSource === "file"} onChange={() => setRegAvatarSource("file")} className="sr-only" />
                              <div className={`w-14 h-14 rounded-full border flex items-center justify-center overflow-hidden bg-muted relative ${regAvatarSource === "file" ? "border-primary ring-2 ring-primary/20" : "border-border"}`}>
                                {regAvatarPreview ? <img src={regAvatarPreview} alt="" className="w-full h-full object-cover" /> : <UploadCloud size={22} className="text-muted-foreground" />}
                                <input type="file" accept="image/*" className="hidden" disabled={regAvatarSource !== "file"} onChange={(e) => { const file = e.target.files?.[0] || null; setRegAvatarFile(file); if (file) setRegAvatarPreview(URL.createObjectURL(file)); }} />
                              </div>
                              <span className="text-xs font-bold text-foreground">{language === "th" ? "อัปโหลดรูปภาพ" : "Upload Photo"}</span>
                            </label>
                          </div>
                        </div>
                      )}

                      {/* Navigation buttons */}
                      <div className="flex gap-3 mt-4">
                        <button
                          type="button"
                          onClick={() => {
                            if (wizardStep > 1) setWizardStep(s => s - 1);
                            else { setWizardMode("check"); setWizardStep(1); }
                          }}
                          className="flex-1 py-3 bg-muted hover:bg-muted/80 text-foreground font-bold rounded-xl text-sm transition-colors border border-border"
                        >
                          {language === "th" ? "ย้อนกลับ" : "Back"}
                        </button>

                        {wizardStep < 3 ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (wizardStep === 1) {
                                if (!regCode.trim() || !regEmail.trim() || !regFullName.trim() || !regNickname.trim() || !regPhone.trim()) {
                                  showToast(t("msg_fill_all"), "error"); return;
                                }
                                if (regCode.trim().length !== 10) {
                                  showToast(language === "th" ? "รหัสนักศึกษาต้องมี 10 หลัก" : "Code must be 10 digits", "error"); return;
                                }
                              } else if (wizardStep === 2) {
                                if (!regFaculty.trim() || !regMajor.trim()) {
                                  showToast(t("msg_fill_all"), "error"); return;
                                }
                              }
                              setWizardStep(s => s + 1);
                            }}
                            className="flex-1 py-3 bg-primary hover:bg-primary/95 text-primary-foreground font-bold rounded-xl text-sm shadow-md transition-colors"
                          >
                            {language === "th" ? "ดำเนินการต่อ" : "Continue"}
                          </button>
                        ) : (
                          <button
                            type="submit"
                            disabled={isWizardSubmitting}
                            onClick={handleRegisterSubmit}
                            className="flex-1 py-3 bg-primary hover:bg-primary/95 text-primary-foreground font-bold rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 admin-btn-press"
                          >
                            {isWizardSubmitting && <Loader2 size={14} className="animate-spin" />}
                            {language === "th" ? "ลงทะเบียนและยืนยัน" : "Register & Link"}
                          </button>
                        )}
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Confetti Container Overlay */}
      {confettiParticles.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
          {confettiParticles.map((p) => (
            <div
              key={p.id}
              className="absolute rounded-sm animate-confetti-fall"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                backgroundColor: p.color,
                animationDelay: `${p.delay}s`,
                opacity: 0.85,
                transform: `rotate(${p.angle}deg)`,
                "--drift-x": `${-250 + Math.random() * 500}px`,
                "--drift-y": `${50 + Math.random() * 150}px`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}
      {/* Help Modal Guide */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4 backdrop-blur-sm">
          <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col animate-scale-pop max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/10">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <HelpCircle size={18} className="text-primary" />
                {language === "th" ? "คู่มือการยืม-คืนอุปกรณ์ BCTL" : "BCTL Gear Checkout Guide"}
              </h3>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition-colors hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-5 text-sm leading-relaxed">
              <div className="flex flex-col gap-2">
                <h4 className="font-bold text-foreground text-sm flex items-center gap-1.5 border-b border-border pb-1">
                  <span className="w-1.5 h-4 bg-primary rounded-full" />
                  {language === "th" ? "การยืมอุปกรณ์ (Borrowing)" : "Borrowing Equipment"}
                </h4>
                <ol className="list-decimal pl-5 text-xs text-muted-foreground flex flex-col gap-1">
                  <li>{language === "th" ? "เลือกอุปกรณ์ที่ต้องการจากหน้ารายการ แล้วกดเพิ่มลงในตะกร้า" : "Browse catalog and add your items to the borrow cart."}</li>
                  <li>{language === "th" ? "เปิดหน้าตะกร้าสินค้า ระบุเหตุผลการยืม และเลือกวันที่ที่ต้องการคืนให้เรียบร้อย" : "Open cart, describe your borrowing reason, and choose return date."}</li>
                  <li>
                    <strong className="text-foreground font-bold">
                      {language === "th" ? "อัปโหลดภาพถ่ายอุปกรณ์สภาพล่าสุด:" : "Upload latest gear photo:"}
                    </strong>{" "}
                    {language === "th"
                      ? "กดปุ่มเพื่อถ่ายภาพหรือแนบภาพถ่ายสภาพอุปกรณ์ (กรณีทำรายการหลายรายการพร้อมกัน สามารถถ่ายรูปวางกองรวมกันเพียงรูปเดียว แล้วนำภาพนั้นอัปโหลดซ้ำในทุกไอเท็มได้เลย)"
                      : "Snap or attach photos of the item's condition. For multiple items, you may upload a single group photo to all fields."}
                  </li>
                  <li>{language === "th" ? "กดปุ่มยืนยันรายการ และรอผู้ดูแลระบบอนุมัติคำขอ" : "Submit checkout request and wait for admin approval."}</li>
                </ol>
              </div>

              <div className="flex flex-col gap-2">
                <h4 className="font-bold text-foreground text-sm flex items-center gap-1.5 border-b border-border pb-1">
                  <span className="w-1.5 h-4 bg-secondary rounded-full" />
                  {language === "th" ? "การคืนอุปกรณ์ (Returning)" : "Returning Equipment"}
                </h4>
                <ol className="list-decimal pl-5 text-xs text-muted-foreground flex flex-col gap-1">
                  <li>{language === "th" ? "เลือกอุปกรณ์ที่ยืมอยู่ในบัญชีของคุณ จากหน้ารายการประวัติการยืม" : "Go to active borrows under your profile and select items to return."}</li>
                  <li>{language === "th" ? "ระบุสภาพของอุปกรณ์ ณ ปัจจุบัน (สภาพดี / เสียหาย / ใช้หมดไป)" : "Set the item's current condition (Good, Damaged, or Lost/Consumed)."}</li>
                  <li>{language === "th" ? "แนบรูปถ่ายอุปกรณ์ ณ วันที่คืนเพื่อประกอบการตรวจสอบ" : "Attach a physical state verification photo."}</li>
                  <li>{language === "th" ? "กดยืนยันรายการเพื่อให้เจ้าหน้าที่เช็กและรับคืนอุปกรณ์" : "Submit the return list for staff verification."}</li>
                </ol>
              </div>

              <div className="bg-primary/5 border border-primary/10 rounded-xl p-3.5 text-xs text-foreground flex flex-col gap-1.5">
                <h5 className="font-bold text-primary">{language === "th" ? "📞 ติดต่อสอบถาม / พบบั๊กและปัญหา" : "📞 Contact Staff / Report Issues"}</h5>
                <p className="text-muted-foreground">
                  {language === "th"
                    ? "หากพบปัญหาเกี่ยวกับการยืนยันตัวตน LINE, เบอร์โทรศัพท์ไม่ตรงกับระบบ หรือต้องการประสานงานอุปกรณ์เป็นกรณีพิเศษ สามารถติดต่อเจ้าหน้าที่ได้โดยตรง ณ ห้องปฏิบัติการสื่อและเครื่องมือ BCTL"
                    : "If you encounter LINE identity mismatch issues or need immediate hardware coordination, visit the BCTL Media Lab or contact our operators directly."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

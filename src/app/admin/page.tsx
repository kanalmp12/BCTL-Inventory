"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/lib/LanguageContext";
import {
  checkIsAdmin,
  getAdminTools,
  getAdminTransactions,
  getAdminUsers,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  uploadToolImage,
  updateStudentProfile,
  updateStudentActiveStatus,
  updateProfileRole,
  AdminTransaction,
  AdminUser,
} from "@/lib/admin";
import { InventoryItem } from "@/lib/transactions";
import {
  LayoutDashboard,
  Package,
  History,
  AlertTriangle,
  Users,
  ArrowLeft,
  Search,
  Plus,
  Edit2,
  Trash2,
  Download,
  Camera,
  Check,
  X,
  Loader2,
  Calendar,
  Layers,
  MapPin,
  CheckCircle,
  HelpCircle,
  Eye,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminPortal() {
  const { student, session, loading: authLoading, isAdmin: globalIsAdmin } = useAuth();
  const { language, t } = useLanguage();
  const router = useRouter();

  // Admin access validation
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<"dashboard" | "tools" | "transactions" | "overdue" | "users">("dashboard");

  // Admin Data lists
  const [tools, setTools] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Search queries per tab
  const [toolsSearch, setToolsSearch] = useState("");
  const [transSearch, setTransSearch] = useState("");
  const [usersSearch, setUsersSearch] = useState("");
  const [toolsCategoryFilter, setToolsCategoryFilter] = useState("all");

  // User selection / inspection state
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [userEditForm, setUserEditForm] = useState({
    full_name: "",
    nickname: "",
    current_department: "",
  });
  const [savingUser, setSavingUser] = useState(false);

  // System Toast Notification State
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [confettiParticles, setConfettiParticles] = useState<any[]>([]);

  // Rotating loading messages for admin data
  const loadingMessages = React.useMemo(() => [
    language === "th" ? "กำลังตรวจสอบข้อมูลอุปกรณ์ในตู้..." : "Scanning shelf inventories...",
    language === "th" ? "กำลังดึงรายการเช่าอุปกรณ์ล่าสุด..." : "Retrieving active equipment rentals...",
    language === "th" ? "กำลังจัดระเบียบตารางประวัติ..." : "Organizing database logs...",
    language === "th" ? "กำลังอัปเดตข้อมูลผู้ใช้งานระบบ..." : "Loading student rosters...",
  ], [language]);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);

  const selectedUser = React.useMemo(() => {
    return users.find((u) => u.id === selectedUserId) || null;
  }, [users, selectedUserId]);

  useEffect(() => {
    if (selectedUser) {
      setUserEditForm({
        full_name: selectedUser.full_name,
        nickname: selectedUser.nickname || "",
        current_department: selectedUser.current_department,
      });
    } else {
      setIsEditingUser(false);
    }
  }, [selectedUser]);

  useEffect(() => {
    if (!loadingData) return;
    const interval = setInterval(() => {
      setLoadingMsgIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [loadingData, loadingMessages]);

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

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    if (type === "success") {
      triggerConfetti();
    }
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Add/Edit Tool Modal State
  const [toolModalOpen, setToolModalOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<InventoryItem | null>(null);
  const [toolForm, setToolForm] = useState({
    id: "",
    name_th: "",
    name_en: "",
    category: "",
    location: "",
    total_qty: 1,
    available_qty: 1,
    is_many: false,
    image_url: "",
    is_active: true,
  });
  // Deactivate Tool confirmation states
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [toolToDelete, setToolToDelete] = useState<string | null>(null);

  const [toolImageFile, setToolImageFile] = useState<File | null>(null);
  const [toolImagePreview, setToolImagePreview] = useState<string | null>(null);

  // Transaction Image Modal State
  const [proofImageModalUrl, setProofImageModalUrl] = useState<string | null>(null);

  // Loading/submitting state
  const [submitting, setSubmitting] = useState(false);

  // Verify Admin Access
  useEffect(() => {
    const verifyAccess = async () => {
      if (authLoading) return;
      if (globalIsAdmin) {
        setIsAdmin(true);
        return;
      }
      if (!session?.user) {
        setIsAdmin(false);
        return;
      }
      const verified = await checkIsAdmin(session.user.id);
      setIsAdmin(verified);
    };
    verifyAccess();
  }, [session, authLoading, globalIsAdmin]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "d") {
        e.preventDefault();
        setActiveTab("dashboard");
      } else if (key === "t") {
        e.preventDefault();
        setActiveTab("tools");
      } else if (key === "r" || key === "h") {
        e.preventDefault();
        setActiveTab("transactions");
      } else if (key === "o") {
        e.preventDefault();
        setActiveTab("overdue");
      } else if (key === "u") {
        e.preventDefault();
        setActiveTab("users");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Load Admin Data
  async function loadAdminData() {
    setLoadingData(true);
    try {
      const adminTools = await getAdminTools();
      const adminTransactions = await getAdminTransactions();
      const adminUsers = await getAdminUsers();

      setTools(adminTools);
      setTransactions(adminTransactions);
      setUsers(adminUsers);
    } catch (err) {
      console.error("Error loading admin data:", err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (isAdmin === true) {
      loadAdminData();
    }
  }, [isAdmin]);

  // Redirect unauthorized users
  useEffect(() => {
    if (isAdmin === false) {
      router.push("/");
    }
  }, [isAdmin, router]);

  // Handle Edit button click
  const handleEditClick = (tool: InventoryItem) => {
    setEditingTool(tool);
    setToolForm({
      id: tool.id,
      name_th: tool.name_th,
      name_en: tool.name_en,
      category: tool.category,
      location: tool.location,
      total_qty: tool.total_qty,
      available_qty: tool.available_qty,
      is_many: tool.is_many,
      image_url: tool.image_url || "",
      is_active: tool.is_active,
    });
    setToolImageFile(null);
    setToolImagePreview(tool.image_url || null);
    setToolModalOpen(true);
  };

  // Handle Add Tool button click
  const handleAddClick = () => {
    setEditingTool(null);
    setToolForm({
      id: "",
      name_th: "",
      name_en: "",
      category: "Decoration & Props",
      location: "",
      total_qty: 1,
      available_qty: 1,
      is_many: false,
      image_url: "",
      is_active: true,
    });
    setToolImageFile(null);
    setToolImagePreview(null);
    setToolModalOpen(true);
  };

  // Tool Form image file handler
  const handleToolImageChange = (file: File | null) => {
    if (!file) return;
    setToolImageFile(file);
    const url = URL.createObjectURL(file);
    setToolImagePreview(url);
  };

  // Submit Add/Edit Tool Form
  const handleToolSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toolForm.id || !toolForm.name_th || !toolForm.name_en || !toolForm.location) {
      showToast("Please fill in all required fields.", "error");
      return;
    }
    if (!toolForm.is_many && Number(toolForm.available_qty) > Number(toolForm.total_qty)) {
      showToast("Available quantity cannot exceed total stock quantity.", "error");
      return;
    }

    setSubmitting(true);
    try {
      let finalImageUrl = toolForm.image_url;

      // Upload image first if a new one is selected
      if (toolImageFile) {
        finalImageUrl = await uploadToolImage(toolForm.id, toolImageFile);
      }

      const itemPayload = {
        id: toolForm.id,
        name_th: toolForm.name_th,
        name_en: toolForm.name_en,
        category: toolForm.category,
        location: toolForm.location,
        total_qty: Number(toolForm.total_qty),
        available_qty: Number(toolForm.available_qty),
        is_many: toolForm.is_many,
        image_url: finalImageUrl || null,
        is_active: toolForm.is_active,
      };

      let result;
      if (editingTool) {
        // Update
        result = await updateInventoryItem(editingTool.id, itemPayload);
      } else {
        // Add
        result = await addInventoryItem(itemPayload);
      }

      if (result.success) {
        setToolModalOpen(false);
        if (toolImagePreview && toolImageFile) URL.revokeObjectURL(toolImagePreview);
        await loadAdminData();
        showToast(editingTool ? "Item updated successfully!" : "Item created successfully!", "success");
      } else {
        showToast("Operation failed: " + result.error, "error");
      }
    } catch (err: any) {
      showToast("Failed to submit tool: " + err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Soft Delete Tool
  const handleDeleteClick = (itemId: string) => {
    setToolToDelete(itemId);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteClick = async () => {
    if (!toolToDelete) return;
    try {
      const result = await deleteInventoryItem(toolToDelete);
      if (result.success) {
        await loadAdminData();
        showToast("Item deactivated successfully!", "success");
      } else {
        showToast("Failed to deactivate item: " + result.error, "error");
      }
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setDeleteConfirmOpen(false);
      setToolToDelete(null);
    }
  };

  // CSV Export utility
  const exportToCSV = () => {
    if (transactions.length === 0) return;

    const headers = [
      "Transaction ID",
      "Student Name",
      "Student Code",
      "Email",
      "Department",
      "Item ID",
      "Item Name (TH)",
      "Item Name (EN)",
      "Quantity",
      "Status",
      "Borrow Date",
      "Expected Return Date",
      "Actual Return Date",
      "Reason",
      "Return Condition",
      "Return Notes",
    ];

    const rows = transactions.map((t) => [
      t.id,
      t.student?.full_name || "",
      t.student?.student_code || "",
      t.student?.email || "",
      t.student?.current_department || "",
      t.item?.id || "",
      t.item?.name_th || "",
      t.item?.name_en || "",
      t.quantity,
      t.status,
      t.borrow_date,
      t.expected_return_date,
      t.actual_return_date || "",
      t.reason || "",
      t.return_condition || "",
      t.return_notes || "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((r) => r.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `BCTL_Inventory_Transactions_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Transactions log exported successfully!", "success");
  };

  const exportUsersToCSV = () => {
    if (users.length === 0) return;

    const headers = [
      "Student Code",
      "Full Name",
      "Nickname",
      "Email",
      "Department",
      "Join Date"
    ];

    const rows = users.map((u) => [
      u.student_code,
      u.full_name,
      u.nickname || "",
      u.email,
      u.current_department || "",
      new Date(u.created_at).toLocaleDateString()
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((r) => r.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `BCTL_Inventory_Users_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Users list exported successfully!", "success");
  };

  const handleToggleActive = async (studentId: string, currentStatus: boolean) => {
    try {
      const { success, error } = await updateStudentActiveStatus(studentId, !currentStatus);
      if (success) {
        showToast(
          language === "th"
            ? `สลับสถานะผู้ใช้สำเร็จ: ${!currentStatus ? "เปิดใช้งาน" : "ระงับสิทธิ์"}`
            : `User status updated to ${!currentStatus ? "Active" : "Blocked"}.`,
          "success"
        );
        loadAdminData();
      } else {
        showToast(error || "Failed to update user status.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error updating user status.", "error");
    }
  };

  const handleToggleAdmin = async (profileId: string | null | undefined, currentRole: string | undefined) => {
    if (!profileId) {
      showToast(
        language === "th" ? "ไม่พบข้อมูลโปรไฟล์ระบบ" : "System profile not found.",
        "error"
      );
      return;
    }
    // Prevent self-lockout
    if (profileId === session?.user?.id) {
      showToast(
        language === "th" ? "คุณไม่สามารถเปลี่ยนบทบาทของตัวเองได้" : "You cannot change your own role.",
        "error"
      );
      return;
    }
    const newRole = currentRole === "admin" ? "student" : "admin";
    try {
      const { success, error } = await updateProfileRole(profileId, newRole);
      if (success) {
        showToast(
          language === "th"
            ? `อัปเดตบทบาทสำเร็จเป็น: ${newRole === "admin" ? "ผู้ดูแลระบบ" : "นักศึกษา"}`
            : `Role updated to ${newRole === "admin" ? "Administrator" : "Student"}.`,
          "success"
        );
        loadAdminData();
      } else {
        showToast(error || "Failed to update user role.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error updating user role.", "error");
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    setSavingUser(true);
    try {
      const { success, error } = await updateStudentProfile(selectedUserId, {
        full_name: userEditForm.full_name,
        nickname: userEditForm.nickname || null,
        current_department: userEditForm.current_department,
      });
      if (success) {
        showToast(
          language === "th" ? "อัปเดตข้อมูลผู้ใช้สำเร็จ!" : "User profile updated successfully!",
          "success"
        );
        setIsEditingUser(false);
        loadAdminData();
      } else {
        showToast(error || "Failed to update profile.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error updating profile.", "error");
    } finally {
      setSavingUser(false);
    }
  };

  // Filter lists based on search queries
  const filteredTools = React.useMemo(() => {
    return tools.filter((t) => {
      const query = toolsSearch.toLowerCase();
      const matchesSearch = (
        t.id.toLowerCase().includes(query) ||
        t.name_th.toLowerCase().includes(query) ||
        t.name_en.toLowerCase().includes(query) ||
        t.location.toLowerCase().includes(query)
      );
      const matchesCategory = toolsCategoryFilter === "all" || t.category === toolsCategoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [tools, toolsSearch, toolsCategoryFilter]);

  const filteredTrans = React.useMemo(() => {
    return transactions.filter((t) => {
      const query = transSearch.toLowerCase();
      return (
        t.id.toLowerCase().includes(query) ||
        t.student?.full_name?.toLowerCase().includes(query) ||
        t.student?.student_code?.includes(query) ||
        t.item?.name_en?.toLowerCase().includes(query) ||
        t.item?.name_th?.toLowerCase().includes(query)
      );
    });
  }, [transactions, transSearch]);

  const filteredUsers = React.useMemo(() => {
    return users.filter((u) => {
      const query = usersSearch.toLowerCase();
      return (
        u.full_name.toLowerCase().includes(query) ||
        u.student_code.includes(query) ||
        u.email.toLowerCase().includes(query) ||
        u.nickname?.toLowerCase().includes(query)
      );
    });
  }, [users, usersSearch]);

  const overdueTrans = React.useMemo(() => {
    return transactions.filter((t) => t.status === "borrowed" && new Date(t.expected_return_date) < new Date());
  }, [transactions]);

  // Dashboard Stats Calculations
  const stats = React.useMemo(() => {
    return {
      totalTools: tools.length,
      borrowedCount: transactions.filter((t) => t.status === "borrowed").reduce((sum, t) => sum + t.quantity, 0),
      overdueCount: overdueTrans.reduce((sum, t) => sum + t.quantity, 0),
      lowStockCount: tools.filter((t) => !t.is_many && t.available_qty <= 1 && t.is_active).length,
    };
  }, [tools, transactions, overdueTrans]);

  if (isAdmin === null || authLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-background">
        <Loader2 size={36} className="text-primary animate-spin" />
        <p className="text-sm font-bold text-muted-foreground mt-2">Checking admin credentials...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col md:flex-row overflow-hidden bg-background text-foreground z-0">
      {/* Sidebar — desktop only */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col justify-between bg-card border-r border-border z-30 overflow-hidden">
        <div>
          <div className="p-6 border-b border-border flex items-center gap-2">
            <span className="bg-primary text-primary-foreground p-1.5 rounded-lg">
              <Settings size={18} />
            </span>
            <span className="font-bold text-base tracking-tight">System Manager</span>
          </div>

          <nav className="p-4 flex flex-col gap-1.5">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`flex items-center gap-2 px-3.5 py-2 text-sm font-bold rounded-lg transition-colors text-left focus-ring ${
                activeTab === "dashboard" ? "bg-primary/10 text-primary" : "hover:bg-muted/80 text-muted-foreground"
              }`}
            >
              <LayoutDashboard size={18} />
              {language === "th" ? "หน้าแรก" : "Dashboard"}
            </button>
            <button
              onClick={() => setActiveTab("tools")}
              className={`flex items-center gap-2 px-3.5 py-2 text-sm font-bold rounded-lg transition-colors text-left focus-ring ${
                activeTab === "tools" ? "bg-primary/10 text-primary" : "hover:bg-muted/80 text-muted-foreground"
              }`}
            >
              <Package size={18} />
              {language === "th" ? "จัดการอุปกรณ์" : "Tools Management"}
            </button>
            <button
              onClick={() => setActiveTab("transactions")}
              className={`flex items-center gap-2 px-3.5 py-2 text-sm font-bold rounded-lg transition-colors text-left focus-ring ${
                activeTab === "transactions" ? "bg-primary/10 text-primary" : "hover:bg-muted/80 text-muted-foreground"
              }`}
            >
              <History size={18} />
              {language === "th" ? "ประวัติการยืม-คืน" : "Transactions"}
            </button>
            <button
              onClick={() => setActiveTab("overdue")}
              className={`flex items-center gap-2 px-3.5 py-2 text-sm font-bold rounded-lg transition-colors text-left focus-ring ${
                activeTab === "overdue" ? "bg-primary/10 text-primary" : "hover:bg-muted/80 text-muted-foreground"
              }`}
            >
              <AlertTriangle size={18} />
              {language === "th" ? "รายการเกินกำหนด" : "Overdue Items"}
              {overdueTrans.length > 0 && (
                <span className="bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full text-[9px] font-black leading-none ml-1">
                  {overdueTrans.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`flex items-center gap-2 px-3.5 py-2 text-sm font-bold rounded-lg transition-colors text-left focus-ring ${
                activeTab === "users" ? "bg-primary/10 text-primary" : "hover:bg-muted/80 text-muted-foreground"
              }`}
            >
              <Users size={18} />
              {language === "th" ? "จัดการผู้ใช้งาน" : "User Management"}
            </button>
          </nav>
        </div>

        <div className="p-4 border-t border-border">
          <Link
            href="/"
            className="w-full flex items-center gap-2 justify-center py-2.5 bg-muted hover:bg-muted/80 text-muted-foreground font-bold text-xs rounded-lg transition-colors border border-border"
          >
            <ArrowLeft size={14} />
            {t("admin_btn_back")}
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-3 sm:p-5 md:p-8 pb-24 md:pb-8 overflow-y-auto custom-scrollbar">
        {loadingData ? (
          <div className="flex flex-col items-center justify-center py-40">
            <Loader2 size={32} className="text-primary animate-spin" />
            <p className="text-xs font-bold text-muted-foreground mt-2 transition-all duration-300 animate-pulse">
              {loadingMessages[loadingMsgIndex]}
            </p>
          </div>
        ) : (
          <>
            {/* VIEW: DASHBOARD */}
            {activeTab === "dashboard" && (
              <div className="flex flex-col gap-6 admin-tab-content">
                <h2 className="text-xl font-bold text-foreground">{t("admin_title_dashboard")}</h2>

                {/* Grid stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="admin-stat-card bg-card border border-border p-5 rounded-2xl flex flex-col relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary/20 duration-300">
                    <div className="flex items-center gap-1.5 text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
                      {t("admin_stat_total")}
                    </div>
                    <span className="text-3xl font-bold mt-3 text-foreground tracking-tight">{stats.totalTools}</span>
                    <div className="absolute -right-4 -bottom-4 w-12 h-12 rounded-full bg-muted-foreground/10 blur-xl pointer-events-none" />
                  </div>
                  <div className="admin-stat-card bg-card border border-border p-5 rounded-2xl flex flex-col relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary/20 duration-300">
                    <div className="flex items-center gap-1.5 text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {t("admin_stat_borrowed")}
                    </div>
                    <span className="text-3xl font-bold mt-3 text-primary tracking-tight">{stats.borrowedCount}</span>
                    <div className="absolute -right-4 -bottom-4 w-12 h-12 rounded-full bg-primary/10 blur-xl pointer-events-none" />
                  </div>
                  <div className="admin-stat-card bg-card border border-border p-5 rounded-2xl flex flex-col relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary/20 duration-300">
                    <div className="flex items-center gap-1.5 text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                      {t("admin_stat_overdue")}
                    </div>
                    <span className="text-3xl font-bold mt-3 text-destructive tracking-tight">{stats.overdueCount}</span>
                    <div className="absolute -right-4 -bottom-4 w-12 h-12 rounded-full bg-destructive/10 blur-xl pointer-events-none" />
                  </div>
                  <div className="admin-stat-card bg-card border border-border p-5 rounded-2xl flex flex-col relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary/20 duration-300">
                    <div className="flex items-center gap-1.5 text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                      {t("admin_stat_low_stock")}
                    </div>
                    <span className="text-3xl font-bold mt-3 text-warning tracking-tight">{stats.lowStockCount}</span>
                    <div className="absolute -right-4 -bottom-4 w-12 h-12 rounded-full bg-warning/10 blur-xl pointer-events-none" />
                  </div>
                </div>

                {/* Recent Activities */}
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="font-bold text-base mb-2 flex items-center gap-2">
                    <History size={18} className="text-primary" />
                    {language === "th" ? "ประวัติการยืมล่าสุด" : "Recent Borrowing Activity"}
                  </h3>

                  {transactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No transactions logged yet.</p>
                  ) : (
                    <div className="divide-y divide-border/60">
                      {transactions.slice(0, 5).map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between py-3 hover:bg-muted/15 transition-colors first:pt-1 last:pb-1">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-muted rounded-lg shrink-0 overflow-hidden border border-border flex items-center justify-center">
                              {tx.item?.name_en ? (
                                <span className="text-xs font-black">{tx.item.id}</span>
                              ) : (
                                <Package size={16} />
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-sm truncate text-foreground">
                                {tx.student?.full_name || "Unknown User"} ({tx.student?.nickname || ""})
                              </h4>
                              <p className="text-[10px] text-muted-foreground">
                                {language === "th" ? "ยืม" : "Borrowed"}{" "}
                                <span className="font-bold text-foreground">
                                  {language === "th" ? tx.item?.name_th : tx.item?.name_en}
                                </span>{" "}
                                x {tx.quantity} | {new Date(tx.borrow_date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${
                              tx.status === "returned"
                                ? "bg-success/10 text-success border-success/20"
                                : tx.status === "overdue"
                                ? "bg-destructive/10 text-destructive border-destructive/20"
                                : "bg-warning/10 text-warning border-warning/20"
                            }`}
                          >
                            {tx.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* VIEW: TOOLS MANAGEMENT */}
            {activeTab === "tools" && (
              <div className="flex flex-col gap-6 admin-tab-content">
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <h2 className="text-xl font-bold text-foreground">{t("admin_nav_tools")}</h2>
                  <button
                    onClick={handleAddClick}
                    className="w-full sm:w-auto bg-primary hover:bg-primary/95 text-primary-foreground font-bold px-4 py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors focus-ring admin-btn-press"
                  >
                    <Plus size={16} />
                    {t("admin_btn_add_tool")}
                  </button>
                </div>

                {/* Tools Search & Filter */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <Search size={18} />
                    </span>
                    <input
                      type="text"
                      value={toolsSearch}
                      onChange={(e) => setToolsSearch(e.target.value)}
                      placeholder="Search tools by ID, name, location..."
                      className="w-full h-11 pl-11 pr-4 bg-card border border-border rounded-lg outline-none font-medium text-xs text-foreground focus-ring transition-all"
                    />
                  </div>
                  <select
                    value={toolsCategoryFilter}
                    onChange={(e) => setToolsCategoryFilter(e.target.value)}
                    className="h-11 px-4 bg-card border border-border rounded-lg text-xs font-bold text-foreground focus-ring cursor-pointer shrink-0"
                  >
                    <option value="all">{language === "th" ? "หมวดหมู่ทั้งหมด" : "All Categories"}</option>
                    <option value="Decoration & Props">Decoration &amp; Props</option>
                    <option value="Stationery & Craft">Stationery &amp; Craft</option>
                    <option value="Clothing & Fabric">Clothing &amp; Fabric</option>
                    <option value="Catering & Cleaning">Catering &amp; Cleaning</option>
                    <option value="AV & Lighting">AV &amp; Lighting</option>
                    <option value="Storage & Infrastructure">Storage &amp; Infrastructure</option>
                  </select>
                </div>

                {/* Mobile: Card list — visible only on small screens */}
                <div className="md:hidden flex flex-col gap-2">
                  {filteredTools.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border border-dashed border-border rounded-2xl">
                      <Package size={24} className="mb-2 text-muted-foreground/60 admin-empty-icon" />
                      <p className="font-bold text-sm">{language === "th" ? "ไม่พบอุปกรณ์ที่ตรงตามเงื่อนไข" : "No matching tools found."}</p>
                    </div>
                  ) : filteredTools.map((tool) => (
                    <div
                      key={tool.id}
                      onClick={() => handleEditClick(tool)}
                      className="admin-card-item bg-card border border-border rounded-xl p-3 flex items-center gap-3 cursor-pointer active:bg-muted/20 transition-all hover:border-primary/30"
                    >
                      <div className="w-12 h-12 rounded-lg bg-muted border border-border overflow-hidden flex items-center justify-center shrink-0">
                        {tool.image_url ? (
                          <img src={tool.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Package size={20} className="text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-foreground truncate">{tool.name_th}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{tool.id} · {tool.location}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                            !tool.is_active
                              ? "bg-destructive/10 text-destructive border-destructive/20"
                              : tool.available_qty > 0 || tool.is_many
                              ? "bg-success/10 text-success border-success/20"
                              : "bg-warning/10 text-warning border-warning/20"
                          }`}>
                            {!tool.is_active ? "Inactive" : tool.available_qty > 0 || tool.is_many ? "Available" : "Out of Stock"}
                          </span>
                          {!tool.is_many && (
                            <span className="text-[11px] text-muted-foreground font-bold">{tool.available_qty}/{tool.total_qty}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEditClick(tool); }}
                          aria-label="Edit"
                          className="w-10 h-10 flex items-center justify-center rounded-lg bg-muted hover:bg-primary/10 hover:text-primary border border-border transition-colors admin-btn-press"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteClick(tool.id); }}
                          aria-label="Delete"
                          className="w-10 h-10 flex items-center justify-center rounded-lg bg-muted hover:bg-destructive/10 hover:text-destructive border border-border transition-colors admin-btn-press"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: Table — hidden on small screens */}
                <div className="hidden md:block bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse text-xs font-medium">
                      <thead>
                        <tr className="bg-muted/10 border-b border-border text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                          <th className="px-4 py-3">{t("admin_table_image")}</th>
                          <th className="px-4 py-3">ID</th>
                          <th className="px-4 py-3">{t("admin_table_details")}</th>
                          <th className="px-4 py-3">{t("admin_table_stock")}</th>
                          <th className="px-4 py-3">{t("admin_table_location")}</th>
                          <th className="px-4 py-3">{t("admin_table_status")}</th>
                          <th className="px-4 py-3 text-center">{t("admin_table_actions")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTools.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="text-center py-12 text-muted-foreground font-bold">
                              <Package size={24} className="mx-auto mb-2 text-muted-foreground/60 admin-empty-icon" />
                              {language === "th" ? "ไม่พบอุปกรณ์ที่ตรงตามเงื่อนไข" : "No matching tools found."}
                            </td>
                          </tr>
                        ) : (
                          filteredTools.map((tool) => (
                            <tr
                              key={tool.id}
                              onClick={() => handleEditClick(tool)}
                              className="border-b border-border hover:bg-muted/10 transition-colors cursor-pointer admin-table-row"
                            >
                              <td className="px-4 py-3 shrink-0">
                                <div className="w-10 h-10 rounded-lg bg-muted border border-border overflow-hidden flex items-center justify-center">
                                  {tool.image_url ? (
                                    <img src={tool.image_url} alt="Image" className="w-full h-full object-cover" />
                                  ) : (
                                    <Package size={18} className="text-muted-foreground" />
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 font-bold text-foreground">{tool.id}</td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-bold text-sm text-foreground">{tool.name_th}</span>
                                  <span className="text-muted-foreground">{tool.name_en}</span>
                                  <span className="text-[10px] text-admin-document bg-admin-document/10 border border-admin-document/20 rounded px-1.5 py-0.5 w-fit mt-1 font-bold">
                                    {tool.category}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 font-bold text-foreground">
                                {tool.is_many
                                  ? "จำนวนมาก"
                                  : `${tool.available_qty} / ${tool.total_qty}`}
                              </td>
                              <td className="px-4 py-3">
                                <span className="flex items-center gap-1 text-muted-foreground font-bold">
                                  <MapPin size={12} className="text-primary" />
                                  {tool.location}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                                    !tool.is_active
                                      ? "bg-destructive/10 text-destructive border-destructive/20"
                                      : tool.available_qty > 0 || tool.is_many
                                      ? "bg-success/10 text-success border-success/20"
                                      : "bg-warning/10 text-warning border-warning/20"
                                  }`}
                                >
                                  {!tool.is_active
                                    ? "Inactive"
                                    : tool.available_qty > 0 || tool.is_many
                                    ? "Available"
                                    : "Out of Stock"}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleEditClick(tool); }}
                                    aria-label="Edit item"
                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-muted hover:bg-primary/10 hover:text-primary transition-colors border border-border focus-ring admin-btn-press"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteClick(tool.id); }}
                                    aria-label="Delete item"
                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-muted hover:bg-destructive/10 hover:text-destructive transition-colors border border-border focus-ring admin-btn-press"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW: TRANSACTIONS */}
            {activeTab === "transactions" && (
              <div className="flex flex-col gap-6 admin-tab-content">
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <h2 className="text-xl font-bold text-foreground">{t("admin_nav_transactions")}</h2>
                  <button
                    onClick={exportToCSV}
                    className="w-full sm:w-auto bg-secondary hover:bg-secondary/95 text-secondary-foreground font-bold px-4 py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors border border-secondary/20 focus-ring"
                  >
                    <Download size={16} />
                    Export CSV
                  </button>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <Search size={18} />
                  </span>
                  <input
                    type="text"
                    value={transSearch}
                    onChange={(e) => setTransSearch(e.target.value)}
                    placeholder="Search logs by student name, ID, tool..."
                    className="w-full h-11 pl-11 pr-4 bg-card border border-border rounded-lg outline-none font-medium text-xs text-foreground focus-ring transition-all"
                  />
                </div>

                {/* Mobile: Card list */}
                <div className="md:hidden flex flex-col gap-2">
                  {filteredTrans.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border border-dashed border-border rounded-2xl">
                      <History size={24} className="mb-2 text-muted-foreground/60 admin-empty-icon" />
                      <p className="font-bold text-sm">{language === "th" ? "ไม่พบประวัติการทำรายการ" : "No matching transactions found."}</p>
                    </div>
                  ) : filteredTrans.map((tx) => (
                    <div key={tx.id} className="admin-card-item bg-card border border-border rounded-xl p-3 flex flex-col gap-2 transition-all hover:border-primary/30">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-foreground truncate">{tx.student?.full_name}</p>
                          <p className="text-[11px] text-muted-foreground">{tx.student?.student_code} · {tx.student?.current_department}</p>
                        </div>
                        <span className={`shrink-0 px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${
                          tx.status === "returned"
                            ? "bg-success/10 text-success border-success/20"
                            : tx.status === "overdue"
                            ? "bg-destructive/10 text-destructive border-destructive/20"
                            : "bg-warning/10 text-warning border-warning/20"
                        }`}>{tx.status}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <Package size={12} />
                        <span className="font-bold text-foreground">{language === "th" ? tx.item?.name_th : tx.item?.name_en}</span>
                        <span>· Qty {tx.quantity}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">{new Date(tx.borrow_date).toLocaleDateString()}</span>
                        <div className="flex gap-2">
                          {tx.checkout_photo_url && (
                            <button onClick={() => setProofImageModalUrl(tx.checkout_photo_url)} className="w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-muted" aria-label="Checkout photo">
                              <Camera size={14} className="text-primary" />
                            </button>
                          )}
                          {tx.return_photo_url && (
                            <button onClick={() => setProofImageModalUrl(tx.return_photo_url)} className="w-9 h-9 flex items-center justify-center rounded-lg border border-border bg-muted" aria-label="Return photo">
                              <Camera size={14} className="text-success" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: Table */}
                <div className="hidden md:block bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse text-xs font-medium">
                      <thead>
                        <tr className="bg-muted/10 border-b border-border text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                          <th className="px-4 py-3">Time</th>
                          <th className="px-4 py-3">User</th>
                          <th className="px-4 py-3">Tool</th>
                          <th className="px-4 py-3">Qty</th>
                          <th className="px-4 py-3">Reason</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">{t("admin_table_proof_borrow")}</th>
                          <th className="px-4 py-3">{t("admin_table_proof_return")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTrans.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="text-center py-12 text-muted-foreground font-bold">
                              <History size={24} className="mx-auto mb-2 text-muted-foreground/60 admin-empty-icon" />
                              {language === "th" ? "ไม่พบประวัติการทำรายการ" : "No matching transactions found."}
                            </td>
                          </tr>
                        ) : (
                          filteredTrans.map((tx) => (
                            <tr key={tx.id} className="border-b border-border hover:bg-muted/10 transition-colors">
                              <td className="px-4 py-3">
                                <span className="text-muted-foreground whitespace-nowrap">
                                  {new Date(tx.borrow_date).toLocaleString()}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-bold text-sm text-foreground">{tx.student?.full_name}</span>
                                  <span className="text-muted-foreground">ID: {tx.student?.student_code}</span>
                                  <span className="text-[10px] text-muted-foreground uppercase font-bold">{tx.student?.current_department}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 font-bold text-foreground">
                                <div className="flex flex-col">
                                  <span>{tx.item?.name_en}</span>
                                  <span className="text-[10px] text-muted-foreground">ID: {tx.item?.id}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 font-bold text-foreground">{tx.quantity}</td>
                              <td className="px-4 py-3 text-muted-foreground max-w-[150px] truncate" title={tx.reason}>
                                {tx.reason}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${
                                    tx.status === "returned"
                                      ? "bg-success/10 text-success border-success/20"
                                      : tx.status === "overdue"
                                      ? "bg-destructive/10 text-destructive border-destructive/20"
                                      : "bg-warning/10 text-warning border-warning/20"
                                  }`}
                                >
                                  {tx.status}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {tx.checkout_photo_url ? (
                                  <button
                                    onClick={() => setProofImageModalUrl(tx.checkout_photo_url)}
                                    aria-label="View checkout photo proof"
                                    className="w-8 h-8 flex items-center justify-center border border-border rounded-lg bg-muted hover:bg-muted/50 transition-colors focus-ring"
                                  >
                                    <Camera size={14} className="text-primary" />
                                  </button>
                                ) : (
                                  <span className="text-muted-foreground text-[10px]">-</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {tx.return_photo_url ? (
                                  <button
                                    onClick={() => setProofImageModalUrl(tx.return_photo_url)}
                                    aria-label="View return photo proof"
                                    className="w-8 h-8 flex items-center justify-center border border-border rounded-lg bg-muted hover:bg-muted/50 transition-colors focus-ring"
                                  >
                                    <Camera size={14} className="text-success" />
                                  </button>
                                ) : (
                                  <span className="text-muted-foreground text-[10px]">-</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW: OVERDUE ITEMS */}
            {activeTab === "overdue" && (
              <div className="flex flex-col gap-6 admin-tab-content">
                <h2 className="text-xl font-bold text-foreground">{t("admin_nav_overdue")}</h2>

                {overdueTrans.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border border-border border-dashed rounded-3xl bg-card">
                    <CheckCircle size={48} className="text-success mb-2 admin-empty-icon" />
                    <p className="font-bold text-lg">No overdue items currently!</p>
                  </div>
                ) : (
                  <>
                    {/* Mobile: Cards */}
                    <div className="md:hidden flex flex-col gap-2">
                      {overdueTrans.map((tx) => {
                        const delayDays = Math.ceil(
                          (new Date().getTime() - new Date(tx.expected_return_date).getTime()) / (1000 * 3600 * 24)
                        );
                        return (
                          <div key={tx.id} className="admin-card-item bg-card border border-destructive/30 rounded-xl p-3 flex flex-col gap-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-bold text-sm text-foreground truncate">{tx.student?.full_name}</p>
                                <p className="text-[11px] text-muted-foreground">{tx.student?.student_code}</p>
                              </div>
                              <span className="shrink-0 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 text-[10px] font-bold">
                                {delayDays}d overdue
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px]">
                              <Package size={12} className="text-muted-foreground" />
                              <span className="font-bold text-foreground">{tx.item?.name_en}</span>
                              <span className="text-muted-foreground">· Qty {tx.quantity}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-destructive font-bold">
                                Due: {new Date(tx.expected_return_date).toLocaleDateString()}
                              </span>
                              <a href={`mailto:${tx.student?.email}`} className="text-[11px] text-primary underline underline-offset-2">{tx.student?.email}</a>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop: Table */}
                    <div className="hidden md:block bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left border-collapse text-xs font-medium">
                        <thead>
                          <tr className="bg-muted/10 border-b border-border text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                            <th className="px-4 py-3">Expected Return</th>
                            <th className="px-4 py-3">User</th>
                            <th className="px-4 py-3">Tool</th>
                            <th className="px-4 py-3">Qty</th>
                            <th className="px-4 py-3">Days Overdue</th>
                            <th className="px-4 py-3">Contact</th>
                          </tr>
                        </thead>
                        <tbody>
                          {overdueTrans.map((tx) => {
                            const delayDays = Math.ceil(
                              (new Date().getTime() - new Date(tx.expected_return_date).getTime()) / (1000 * 3600 * 24)
                            );
                            return (
                              <tr key={tx.id} className="border-b border-border hover:bg-muted/10 transition-colors">
                                <td className="px-4 py-3 font-bold text-destructive">
                                  {new Date(tx.expected_return_date).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="font-bold text-sm text-foreground">{tx.student?.full_name}</span>
                                    <span className="text-muted-foreground">ID: {tx.student?.student_code}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 font-bold text-foreground">{tx.item?.name_en}</td>
                                <td className="px-4 py-3 font-bold text-foreground">{tx.quantity}</td>
                                <td className="px-4 py-3 text-destructive font-bold">{delayDays} days</td>
                                <td className="px-4 py-3 text-muted-foreground underline">{tx.student?.email}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* VIEW: USER MANAGEMENT */}
            {activeTab === "users" && (
              <div className="flex flex-col gap-6 admin-tab-content">
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <h2 className="text-xl font-bold text-foreground">{t("admin_nav_users")}</h2>
                  <button
                    onClick={exportUsersToCSV}
                    className="w-full sm:w-auto bg-secondary hover:bg-secondary/95 text-secondary-foreground font-bold px-4 py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors border border-secondary/20 focus-ring"
                  >
                    <Download size={16} />
                    Export CSV
                  </button>
                </div>

                <div className="flex flex-col lg:flex-row gap-6 items-start">
                  {/* Left directory: 58% on desktop */}
                  <div className={`lg:w-[58%] w-full flex flex-col gap-4 ${selectedUserId !== null ? "hidden lg:flex" : "flex"}`}>
                    {/* User Search */}
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                        <Search size={18} />
                      </span>
                      <input
                        type="text"
                        value={usersSearch}
                        onChange={(e) => setUsersSearch(e.target.value)}
                        placeholder="Search users by name, student code, email..."
                        className="w-full h-11 pl-11 pr-4 bg-card border border-border rounded-lg outline-none font-medium text-xs text-foreground focus-ring transition-all"
                      />
                    </div>

                    {/* Table */}
                    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse text-xs font-medium">
                          <thead>
                            <tr className="bg-muted/10 border-b border-border text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                              <th className="px-4 py-3">{language === "th" ? "ชื่อ / รหัส" : "User Details"}</th>
                              <th className="px-4 py-3">{language === "th" ? "ฝ่าย" : "Department"}</th>
                              <th className="px-4 py-3">{language === "th" ? "การเช่า" : "Rentals"}</th>
                              <th className="px-4 py-3">{language === "th" ? "สถานะ" : "Status"}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredUsers.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="text-center py-12 text-muted-foreground font-bold">
                                  <Users size={24} className="mx-auto mb-2 text-muted-foreground/60" />
                                  {language === "th" ? "ไม่พบรายชื่อผู้ใช้งาน" : "No matching users found."}
                                </td>
                              </tr>
                            ) : (
                              filteredUsers.map((user) => {
                                const activeRentals = transactions.filter(
                                  (t) => t.student?.id === user.id && (t.status === "borrowed" || t.status === "overdue")
                                );
                                const overdueRentals = activeRentals.filter((t) => t.status === "overdue");
                                const isSelected = selectedUserId === user.id;

                                return (
                                  <tr
                                    key={user.id}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`${user.full_name} ${user.nickname ? `(${user.nickname})` : ""}· ID: ${user.student_code}`}
                                    onClick={() => {
                                      setSelectedUserId(user.id);
                                      setIsEditingUser(false);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        setSelectedUserId(user.id);
                                        setIsEditingUser(false);
                                      }
                                    }}
                                    className={`border-b border-border hover:bg-muted/10 transition-colors cursor-pointer ${
                                      isSelected ? "bg-primary/5 border-r-2 border-primary" : ""
                                    } focus-ring`}
                                  >
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-3">
                                        {user.avatar_url ? (
                                          <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-border flex-shrink-0" />
                                        ) : (
                                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-foreground text-xs uppercase flex-shrink-0">
                                            {user.nickname ? user.nickname.substring(0, 2) : user.full_name.substring(0, 2)}
                                          </div>
                                        )}
                                        <div className="flex flex-col gap-0.5">
                                          <span className="font-bold text-foreground text-sm flex items-center gap-1.5">
                                            {user.full_name}
                                            {user.nickname && <span className="text-xs text-muted-foreground font-medium">({user.nickname})</span>}
                                          </span>
                                          <span className="text-muted-foreground font-mono text-[10px]">ID: {user.student_code}</span>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 shrink-0">
                                      <span className="text-[9px] text-admin-document bg-admin-document/10 border border-admin-document/20 rounded px-1.5 py-0.5 w-fit font-bold uppercase tracking-wider">
                                        {user.current_department === "organize_operation"
                                          ? "Organize"
                                          : user.current_department === "public_relations_digital_marketing"
                                          ? "PR & Marketing"
                                          : user.current_department === "visual_arts_special_technique"
                                          ? "Visual Arts"
                                          : user.current_department === "media_production"
                                          ? "Media Prod"
                                          : user.current_department}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex flex-col gap-0.5">
                                        {overdueRentals.length > 0 ? (
                                          <span className="text-destructive font-bold text-[10px] uppercase flex items-center gap-1">
                                            <AlertTriangle size={10} />
                                            {overdueRentals.length} {language === "th" ? "คืนช้า" : "overdue"}
                                          </span>
                                        ) : activeRentals.length > 0 ? (
                                          <span className="text-success font-bold text-[10px] uppercase">
                                            {activeRentals.length} {language === "th" ? "รายการ" : "active"}
                                          </span>
                                        ) : (
                                          <span className="text-muted-foreground text-[10px]">—</span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                        user.is_active
                                          ? "text-success bg-success/10 border border-success/20"
                                          : "text-destructive bg-destructive/10 border border-destructive/20"
                                      }`}>
                                        {user.is_active 
                                          ? (language === "th" ? "ใช้งานอยู่" : "Active") 
                                          : (language === "th" ? "ระงับสิทธิ์" : "Blocked")}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Right inspector detail panel: 42% on desktop */}
                  <div className={`lg:w-[42%] w-full ${selectedUserId === null ? "hidden lg:block" : "block"}`}>
                    {!selectedUser ? (
                      <div className="bg-card border border-dashed border-border rounded-2xl p-8 flex flex-col items-center justify-center text-center h-[350px] shadow-sm">
                        <Users size={32} className="text-muted-foreground/40 mb-3 admin-empty-icon" />
                        <p className="font-bold text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                          {language === "th" 
                            ? "เลือกรายชื่อนักศึกษาจากด้านซ้าย\nเพื่อดูรายละเอียดการเช่าและตั้งค่าสิทธิ์" 
                            : "Select a student from the directory\nto view active rentals and manage account status."}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-6 shadow-sm animate-fade-in">
                        {/* Back button for mobile navigation */}
                        <div className="lg:hidden">
                          <button
                            onClick={() => {
                              setSelectedUserId(null);
                              setIsEditingUser(false);
                            }}
                            className="text-xs font-bold px-3 py-2 rounded-xl border border-border hover:bg-muted bg-background/50 text-foreground flex items-center gap-1.5 transition-all focus-ring admin-btn-press"
                          >
                            <ArrowLeft size={14} />
                            {language === "th" ? "กลับไปหน้ารายชื่อ" : "Back to List"}
                          </button>
                        </div>
                        {/* Profile header */}
                        <div className="flex items-start justify-between border-b border-border/80 pb-4">
                          <div className="flex items-center gap-3.5">
                            {selectedUser.avatar_url ? (
                              <img src={selectedUser.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover border border-border flex-shrink-0" />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-base uppercase flex-shrink-0">
                                {selectedUser.nickname ? selectedUser.nickname.substring(0, 2) : selectedUser.full_name.substring(0, 2)}
                              </div>
                            )}
                            <div className="flex flex-col">
                              <h3 className="font-black text-sm text-foreground flex items-center gap-1.5 leading-snug">
                                {selectedUser.full_name}
                                {selectedUser.nickname && <span className="text-xs text-muted-foreground font-medium">({selectedUser.nickname})</span>}
                              </h3>
                              <span className="text-[10px] text-muted-foreground font-mono mt-0.5">Code: {selectedUser.student_code}</span>
                              <span className="text-[10px] text-muted-foreground font-medium mt-0.5">{selectedUser.email}</span>
                            </div>
                          </div>

                          <button
                            onClick={() => setIsEditingUser(!isEditingUser)}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg border border-border hover:bg-muted/30 transition-all flex items-center gap-1 focus-ring"
                          >
                            <Edit2 size={12} />
                            {isEditingUser ? (language === "th" ? "ยกเลิก" : "Cancel") : (language === "th" ? "แก้ไข" : "Edit")}
                          </button>
                        </div>

                        {/* Edit mode vs Display mode */}
                        {isEditingUser ? (
                          <form onSubmit={handleSaveProfile} className="flex flex-col gap-4 border-b border-border/80 pb-6">
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                                {language === "th" ? "ชื่อ-นามสกุล *" : "Full Name *"}
                              </label>
                              <input
                                type="text"
                                required
                                value={userEditForm.full_name}
                                onChange={(e) => setUserEditForm((prev) => ({ ...prev, full_name: e.target.value }))}
                                className="w-full h-10 px-3 border border-border bg-background rounded-lg text-xs font-medium focus-ring"
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                                {language === "th" ? "ชื่อเล่น" : "Nickname"}
                              </label>
                              <input
                                type="text"
                                value={userEditForm.nickname}
                                onChange={(e) => setUserEditForm((prev) => ({ ...prev, nickname: e.target.value }))}
                                className="w-full h-10 px-3 border border-border bg-background rounded-lg text-xs font-medium focus-ring"
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                                {language === "th" ? "ฝ่ายประจำ iFIT/BCTL *" : "Department *"}
                              </label>
                              <select
                                value={userEditForm.current_department}
                                onChange={(e) => setUserEditForm((prev) => ({ ...prev, current_department: e.target.value }))}
                                className="w-full h-10 px-3 border border-border bg-background rounded-lg text-xs font-bold focus-ring cursor-pointer"
                              >
                                <option value="organize_operation">Organize &amp; Operation</option>
                                <option value="public_relations_digital_marketing">PR &amp; Digital Marketing</option>
                                <option value="visual_arts_special_technique">Visual Arts &amp; Special Technique</option>
                                <option value="media_production">Media Production</option>
                              </select>
                            </div>

                            <button
                              type="submit"
                              disabled={savingUser}
                              className="w-full h-10 bg-primary hover:bg-primary/95 text-primary-foreground font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors focus-ring"
                            >
                              {savingUser ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                              {language === "th" ? "บันทึกการแก้ไข" : "Save Changes"}
                            </button>
                          </form>
                        ) : (
                          <div className="grid grid-cols-2 gap-4 text-[11px] border-b border-border/80 pb-5">
                            <div>
                              <span className="block text-[9px] font-black text-muted-foreground uppercase tracking-wider">
                                {language === "th" ? "ฝ่ายงาน" : "Department"}
                              </span>
                              <span className="font-bold text-foreground mt-0.5 block">
                                {selectedUser.current_department === "organize_operation"
                                  ? "Organize & Operation"
                                  : selectedUser.current_department === "public_relations_digital_marketing"
                                  ? "PR & Digital Marketing"
                                  : selectedUser.current_department === "visual_arts_special_technique"
                                  ? "Visual Arts & Special Technique"
                                  : selectedUser.current_department === "media_production"
                                  ? "Media Production"
                                  : selectedUser.current_department}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[9px] font-black text-muted-foreground uppercase tracking-wider">
                                {language === "th" ? "เบอร์โทรศัพท์" : "Phone Number"}
                              </span>
                              <span className="font-bold text-foreground mt-0.5 block">{selectedUser.phone || "—"}</span>
                            </div>
                            <div>
                              <span className="block text-[9px] font-black text-muted-foreground uppercase tracking-wider">
                                {language === "th" ? "บัญชี LINE" : "LINE Account"}
                              </span>
                              {selectedUser.profile?.line_links && selectedUser.profile.line_links.filter(l => !l.unlinked_at).length > 0 ? (
                                <span className="font-bold text-success mt-0.5 block flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                                  {selectedUser.profile.line_links.find(l => !l.unlinked_at)?.line_display_name}
                                </span>
                              ) : (
                                <span className="font-bold text-muted-foreground mt-0.5 block">Not Linked</span>
                              )}
                            </div>
                            <div>
                              <span className="block text-[9px] font-black text-muted-foreground uppercase tracking-wider">
                                {language === "th" ? "วันที่ร่วมระบบ" : "Join Date"}
                              </span>
                              <span className="font-bold text-foreground mt-0.5 block">
                                {new Date(selectedUser.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Account Access Controls Toggles */}
                        <div className="flex flex-col gap-3.5 border-b border-border/80 pb-5">
                          <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                            {language === "th" ? "สิทธิ์การเข้าถึงและความปลอดภัย" : "Access & Security Controls"}
                          </h4>

                          <div className="flex items-center justify-between">
                            <div className="flex flex-col text-left">
                              <span className="text-xs font-bold text-foreground">{language === "th" ? "สิทธิ์การยืมอุปกรณ์" : "Loan Privileges"}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {selectedUser.is_active 
                                  ? (language === "th" ? "อนุญาตให้ยืม-คืนอุปกรณ์ได้" : "Allowed to check out equipment.") 
                                  : (language === "th" ? "ระงับสิทธิ์การยืมอุปกรณ์ชั่วคราว" : "Temporary checkout ban active.")}
                              </span>
                            </div>
                            <button
                              onClick={() => handleToggleActive(selectedUser.id, selectedUser.is_active)}
                              aria-pressed={selectedUser.is_active}
                              aria-label={
                                language === "th"
                                  ? `สลับสิทธิ์การยืมของ ${selectedUser.full_name}`
                                  : `Toggle loan privileges for ${selectedUser.full_name}`
                              }
                              className={`w-12 h-6 rounded-full p-1 transition-all focus-ring ${
                                selectedUser.is_active ? "bg-success" : "bg-muted border border-border"
                              }`}
                            >
                              <div className={`w-4 h-4 rounded-full bg-white shadow transition-all ${
                                selectedUser.is_active ? "translate-x-6" : "translate-x-0 bg-muted-foreground/60"
                              }`} />
                            </button>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex flex-col text-left">
                              <span className="text-xs font-bold text-foreground">{language === "th" ? "สิทธิ์ผู้ดูแลระบบ (Admin)" : "Administrator Access"}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {selectedUser.profile?.role === "admin"
                                  ? (language === "th" ? "สิทธิ์การเข้าถึงหน้าแอดมินหลังบ้าน" : "Granted full portal management rights.")
                                  : (language === "th" ? "สิทธิ์เข้าถึงเฉพาะแดชบอร์ดนักศึกษา" : "Regular student portal access only.")}
                              </span>
                            </div>
                            <button
                              disabled={selectedUser.profile_id === session?.user?.id}
                              onClick={() => handleToggleAdmin(selectedUser.profile_id, selectedUser.profile?.role)}
                              aria-pressed={selectedUser.profile?.role === "admin"}
                              aria-label={
                                language === "th"
                                  ? `สลับสิทธิ์ผู้ดูแลระบบของ ${selectedUser.full_name}`
                                  : `Toggle admin privilege for ${selectedUser.full_name}`
                              }
                              className={`w-12 h-6 rounded-full p-1 transition-all focus-ring ${
                                selectedUser.profile?.role === "admin" ? "bg-primary" : "bg-muted border border-border"
                              } ${selectedUser.profile_id === session?.user?.id ? "opacity-50 cursor-not-allowed" : ""}`}
                              title={selectedUser.profile_id === session?.user?.id ? "Self-demotion disabled" : ""}
                            >
                              <div className={`w-4 h-4 rounded-full bg-white shadow transition-all ${
                                selectedUser.profile?.role === "admin" ? "translate-x-6" : "translate-x-0 bg-muted-foreground/60"
                              }`} />
                            </button>
                          </div>
                        </div>

                        {/* Active Rentals Roster */}
                        <div className="flex flex-col gap-3">
                          <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                            <span>{language === "th" ? "รายการที่กำลังยืมอยู่" : "Active Borrowed Gear"}</span>
                            <span className="text-xs font-bold text-foreground">
                              {transactions.filter(t => t.student?.id === selectedUser.id && (t.status === "borrowed" || t.status === "overdue")).length}
                            </span>
                          </h4>

                          <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto custom-scrollbar">
                            {transactions.filter(t => t.student?.id === selectedUser.id && (t.status === "borrowed" || t.status === "overdue")).length === 0 ? (
                              <p className="text-[11px] text-muted-foreground italic py-3 text-center">
                                {language === "th" ? "ไม่มีอุปกรณ์ค้างส่ง" : "No borrowed items currently."}
                              </p>
                            ) : (
                              transactions
                                .filter(t => t.student?.id === selectedUser.id && (t.status === "borrowed" || t.status === "overdue"))
                                .map((tx) => (
                                  <div key={tx.id} className="flex items-center justify-between p-2.5 bg-muted/10 border border-border/80 rounded-xl text-xs hover:border-primary/20 transition-all text-left">
                                    <div className="flex flex-col gap-0.5">
                                      <span className="font-bold text-foreground">{language === "th" ? tx.item?.name_th : tx.item?.name_en}</span>
                                      <span className="text-[10px] text-muted-foreground">Qty: {tx.quantity} · Borrowed: {new Date(tx.borrow_date).toLocaleDateString()}</span>
                                    </div>
                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                      tx.status === "overdue"
                                        ? "text-destructive bg-destructive/10 border border-destructive/20 animate-pulse"
                                        : "text-success bg-success/10 border border-success/20"
                                    }`}>
                                      {tx.status === "overdue" ? (language === "th" ? "เกินกำหนด" : "Overdue") : (language === "th" ? "กำลังยืม" : "Borrowed")}
                                    </span>
                                  </div>
                                ))
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Mobile Bottom Tab Bar — visible only on small screens */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex items-stretch z-40 safe-area-pb" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {([
          { id: "dashboard" as const, icon: LayoutDashboard, labelTh: "หน้าแรก", labelEn: "Home" },
          { id: "tools" as const, icon: Package, labelTh: "อุปกรณ์", labelEn: "Tools" },
          { id: "transactions" as const, icon: History, labelTh: "ประวัติ", labelEn: "History" },
          { id: "overdue" as const, icon: AlertTriangle, labelTh: "เกินกำหนด", labelEn: "Overdue", badge: overdueTrans.length },
          { id: "users" as const, icon: Users, labelTh: "ผู้ใช้", labelEn: "Users" },
        ] as { id: "dashboard"|"tools"|"transactions"|"overdue"|"users"; icon: React.ElementType; labelTh: string; labelEn: string; badge?: number }[]).map(({ id, icon: Icon, labelTh, labelEn, badge }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 relative transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
              aria-label={language === "th" ? labelTh : labelEn}
            >
              {badge != null && badge > 0 && (
                <span className="absolute top-1.5 right-1/4 translate-x-1/2 bg-destructive text-destructive-foreground text-[8px] font-black px-1 py-px rounded-full leading-none">
                  {badge}
                </span>
              )}
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.75} />
              <span className={`text-[10px] font-bold leading-none transition-all ${
                isActive ? "opacity-100" : "opacity-60"
              }`}>
                {language === "th" ? labelTh : labelEn}
              </span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          );
        })}
        <Link
          href="/"
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-muted-foreground"
          aria-label="Back"
        >
          <ArrowLeft size={20} strokeWidth={1.75} />
          <span className="text-[10px] font-bold leading-none opacity-60">{language === "th" ? "ออก" : "Back"}</span>
        </Link>
      </nav>

      {/* Add / Edit Tool Modal */}
      {toolModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[999] p-4 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col animate-scale-pop">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/20">
              <h3 className="font-bold text-base text-foreground">
                {editingTool ? "Edit Inventory Item" : "Add New Item"}
              </h3>
              <button
                onClick={() => setToolModalOpen(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition-colors hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleToolSubmit} className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[80vh] custom-scrollbar">
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-col">
                  <label htmlFor="tool-id" className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Item ID (SKU) *</label>
                  <span className="text-[10px] text-muted-foreground mb-1">Unique item code (e.g., A001). Cannot be changed after creation.</span>
                </div>
                <input
                  type="text"
                  required
                  id="tool-id"
                  disabled={!!editingTool}
                  value={toolForm.id}
                  placeholder="e.g. A001"
                  onChange={(e) => setToolForm((prev) => ({ ...prev, id: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card disabled:opacity-50 focus-ring"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="tool-name_th" className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Thai Name (ชื่อภาษาไทย) *</label>
                <input
                  type="text"
                  required
                  id="tool-name_th"
                  value={toolForm.name_th}
                  onChange={(e) => setToolForm((prev) => ({ ...prev, name_th: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card focus-ring"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="tool-name_en" className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">English Name *</label>
                <input
                  type="text"
                  required
                  id="tool-name_en"
                  value={toolForm.name_en}
                  onChange={(e) => setToolForm((prev) => ({ ...prev, name_en: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card focus-ring"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="tool-category" className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Category *</label>
                <select
                  id="tool-category"
                  value={toolForm.category}
                  onChange={(e) => setToolForm((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card focus-ring cursor-pointer"
                >
                  <option value="Decoration & Props">Decoration &amp; Props</option>
                  <option value="Stationery & Craft">Stationery &amp; Craft</option>
                  <option value="Clothing & Fabric">Clothing &amp; Fabric</option>
                  <option value="Catering & Cleaning">Catering &amp; Cleaning</option>
                  <option value="AV & Lighting">AV &amp; Lighting</option>
                  <option value="Storage & Infrastructure">Storage &amp; Infrastructure</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <label htmlFor="tool-location" className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Cabinet Location *</label>
                    <div className="relative group flex items-center">
                      <HelpCircle size={12} className="text-muted-foreground hover:text-foreground cursor-help transition-colors" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-48 p-2 bg-popover text-popover-foreground border border-border text-[10px] rounded-lg shadow-md font-bold z-50 leading-normal pointer-events-none normal-case">
                        {language === "th"
                          ? "ระบุตำแหน่งที่จัดเก็บ เช่น ตู้ A ชั้น 2 หรือ Cabinet B-12"
                          : "Specify the physical shelf code, e.g., Cabinet A-12 or Shelf 3."}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground mb-1">Specify cabinet shelf location (e.g., Cabinet A-12).</span>
                </div>
                <input
                  type="text"
                  required
                  id="tool-location"
                  value={toolForm.location}
                  placeholder="e.g. Cabinet A-12"
                  onChange={(e) => setToolForm((prev) => ({ ...prev, location: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card focus-ring"
                />
              </div>

              {/* Quantities */}
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-muted-foreground flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={toolForm.is_many}
                    onChange={(e) => setToolForm((prev) => ({ ...prev, is_many: e.target.checked }))}
                    className="w-4 h-4 rounded border-border focus-ring"
                  />
                  <span>Represent as Unlimited Qty ("จำนวนมาก")</span>
                  <div className="relative group flex items-center">
                    <HelpCircle size={12} className="text-muted-foreground hover:text-foreground cursor-help transition-colors" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-52 p-2 bg-popover text-popover-foreground border border-border text-[10px] rounded-lg shadow-md font-bold z-50 leading-normal pointer-events-none normal-case">
                      {language === "th"
                        ? "สำหรับของที่มีปริมาณมากจนไม่ต้องนับชิ้น เช่น กาว กระดาษ ดินสอ"
                        : "For bulk items that don't need piece-by-piece tracking, e.g., tape or glue."}
                    </div>
                  </div>
                </label>
              </div>

              {!toolForm.is_many && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex flex-col">
                      <label htmlFor="tool-total_qty" className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Total Stock *</label>
                      <span className="text-[10px] text-muted-foreground mb-1">Total units owned.</span>
                    </div>
                    <input
                      type="number"
                      required
                      min={0}
                      id="tool-total_qty"
                      value={toolForm.total_qty}
                      onChange={(e) => setToolForm((prev) => ({ ...prev, total_qty: Number(e.target.value) }))}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card focus-ring"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex flex-col">
                      <label htmlFor="tool-available_qty" className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Available *</label>
                      <span className="text-[10px] text-muted-foreground mb-1">Units on shelf.</span>
                    </div>
                    <input
                      type="number"
                      required
                      min={0}
                      id="tool-available_qty"
                      value={toolForm.available_qty}
                      onChange={(e) => setToolForm((prev) => ({ ...prev, available_qty: Number(e.target.value) }))}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-card focus-ring"
                    />
                  </div>
                </div>
              )}

              {/* Image upload */}
              <div className="flex flex-col gap-2">
                <label htmlFor="tool-image-file" className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Product Image</label>
                <div className="flex items-center gap-4">
                  <input
                    type="file"
                    accept="image/*"
                    id="tool-image-file"
                    className="hidden"
                    onChange={(e) => handleToolImageChange(e.target.files?.[0] || null)}
                  />
                  <label
                    htmlFor="tool-image-file"
                    className="cursor-pointer px-4 py-2 border border-border hover:bg-muted font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors focus-ring"
                  >
                    <Camera size={14} />
                    Choose File
                  </label>
                  {toolImagePreview && (
                    <div className="w-12 h-12 rounded-lg border border-border overflow-hidden">
                      <img src={toolImagePreview} alt="Preview of uploaded product" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-muted-foreground flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={toolForm.is_active}
                    onChange={(e) => setToolForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                    className="w-4 h-4 rounded border-border focus-ring"
                  />
                  <span>Item is Active / Show in list</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 mt-2 bg-primary hover:bg-primary/95 text-primary-foreground font-bold rounded-lg transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Proof Image Zoom Modal */}
      {proofImageModalUrl && (
        <div
          onClick={() => setProofImageModalUrl(null)}
          className="fixed inset-0 bg-black/75 flex items-center justify-center z-[1001] p-4 cursor-zoom-out"
        >
          <div className="relative max-w-xl w-full max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl border border-white/10 animate-scale-pop">
            <button
              onClick={() => setProofImageModalUrl(null)}
              className="absolute right-4 top-4 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-10"
            >
              <X size={20} />
            </button>
            <img src={proofImageModalUrl} alt="Transaction proof preview" className="w-full h-auto object-contain" />
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-4 backdrop-blur-sm">
          <div className="bg-card w-full max-w-sm rounded-2xl shadow-2xl border border-border p-6 flex flex-col gap-4 animate-scale-pop">
            <h3 className="font-bold text-base text-foreground">
              Confirm Deactivation
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to deactivate this item? It will be hidden from students but kept in database logs.
            </p>
            <div className="flex items-center justify-end gap-3 mt-2">
              <button
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setToolToDelete(null);
                }}
                className="px-4 py-2 border border-border hover:bg-muted font-bold rounded-lg text-xs transition-colors focus-ring"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteClick}
                className="px-4 py-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold rounded-lg text-xs transition-colors focus-ring"
              >
                Deactivate
              </button>
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

      {/* System Toast Notifications */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[1002] px-4 py-3 rounded-lg shadow-lg border text-sm font-bold animate-fade-in-up flex items-center gap-2 ${
          toast.type === "success"
            ? "bg-success text-success-foreground border-success/20"
            : toast.type === "error"
            ? "bg-destructive text-destructive-foreground border-destructive/20"
            : "bg-muted text-foreground border-border"
        }`}>
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 hover:opacity-80 p-0.5 rounded transition-colors hover:bg-black/10 dark:hover:bg-white/10" aria-label="Close notification">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

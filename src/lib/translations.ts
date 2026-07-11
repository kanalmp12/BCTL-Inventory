export type TranslationKey =
  | "app_title"
  | "btn_login"
  | "btn_logout"
  | "menu_admin"
  | "search_placeholder"
  | "filter_all"
  | "filter_available"
  | "filter_borrowed"
  | "filter_overdue"
  | "filter_location"
  | "filter_location_all"
  | "filter_category"
  | "filter_category_all"
  | "status_available"
  | "status_borrowed"
  | "status_overdue"
  | "status_out_of_stock"
  | "unit_items"
  | "unit_many"
  | "btn_card_borrow"
  | "btn_card_return"
  | "btn_card_out_of_stock"
  | "reg_title"
  | "reg_subtitle"
  | "reg_login_line_text"
  | "reg_btn_line"
  | "reg_label_nickname"
  | "reg_placeholder_nickname"
  | "reg_label_dept"
  | "reg_select_dept"
  | "reg_label_cohort"
  | "reg_select_cohort"
  | "reg_btn_save"
  | "reg_help"
  | "reg_step_1"
  | "reg_step_2"
  | "borrow_title"
  | "borrow_label_qty"
  | "borrow_label_reason"
  | "borrow_placeholder_reason"
  | "borrow_label_photo"
  | "borrow_label_upload"
  | "borrow_label_date_borrow"
  | "borrow_label_date_return"
  | "btn_cancel"
  | "btn_confirm_borrow"
  | "return_title"
  | "return_label_condition"
  | "return_select_condition"
  | "return_cond_good"
  | "return_cond_damaged"
  | "return_cond_lost"
  | "return_label_photo"
  | "return_label_upload"
  | "return_label_notes"
  | "return_placeholder_notes"
  | "btn_confirm_return"
  | "loading_text"
  | "msg_fill_all"
  | "msg_reg_success"
  | "msg_reg_failed"
  | "msg_borrow_success"
  | "msg_return_success"
  | "msg_cart_empty"
  | "msg_photo_required"
  | "admin_sidebar_manager"
  | "admin_nav_dashboard"
  | "admin_nav_tools"
  | "admin_nav_transactions"
  | "admin_nav_overdue"
  | "admin_nav_users"
  | "admin_nav_settings"
  | "admin_btn_back"
  | "admin_title_dashboard"
  | "admin_stat_total"
  | "admin_stat_borrowed"
  | "admin_stat_overdue"
  | "admin_stat_low_stock"
  | "admin_chart_dist"
  | "admin_chart_activity"
  | "admin_btn_add_tool"
  | "admin_table_image"
  | "admin_table_details"
  | "admin_table_stock"
  | "admin_table_location"
  | "admin_table_status"
  | "admin_table_actions"
  | "admin_table_time"
  | "admin_table_user"
  | "admin_table_action"
  | "admin_table_proof_borrow"
  | "admin_table_proof_return";

export const translations: Record<"en" | "th", Record<TranslationKey, string>> = {
  en: {
    app_title: "BCTL Inventory (BETA)",
    btn_login: "Login",
    btn_logout: "Logout",
    menu_admin: "Admin Portal",
    search_placeholder: "Search tools by name or ID...",
    filter_all: "All Items",
    filter_available: "Available",
    filter_borrowed: "Borrowed",
    filter_overdue: "Overdue",
    filter_location: "Location",
    filter_location_all: "All Locations",
    filter_category: "Category",
    filter_category_all: "All Categories",
    status_available: "Available",
    status_borrowed: "Borrowed",
    status_overdue: "Overdue",
    status_out_of_stock: "Out of Stock",
    unit_items: "Units",
    unit_many: "Many",
    btn_card_borrow: "Borrow",
    btn_card_return: "Return",
    btn_card_out_of_stock: "Out of Stock",
    reg_title: "User Registration",
    reg_subtitle: "Create your profile to access tools and equipment.",
    reg_login_line_text: "Please login with LINE to verify your identity.",
    reg_btn_line: "Login with LINE",
    reg_label_nickname: "Nickname",
    reg_placeholder_nickname: "e.g., Ton, Nok",
    reg_label_dept: "Department",
    reg_select_dept: "Select Department...",
    reg_label_cohort: "Cohort",
    reg_select_cohort: "Select Cohort...",
    reg_btn_save: "Save and Start",
    reg_help: "Help",
    reg_step_1: "Step 1 of 2",
    reg_step_2: "Step 2 of 2",
    borrow_title: "Borrow Tool",
    borrow_label_qty: "Quantity to Borrow",
    borrow_label_reason: "Reason for Borrowing",
    borrow_placeholder_reason: "Please specify the reason for borrowing...",
    borrow_label_photo: "Borrow Photo (Required)",
    borrow_label_upload: "Upload Borrow Photo",
    borrow_label_date_borrow: "Borrow Date",
    borrow_label_date_return: "Expected Return Date",
    btn_cancel: "Cancel",
    btn_confirm_borrow: "Confirm Borrow",
    return_title: "Return Tool",
    return_label_condition: "Tool Condition",
    return_select_condition: "Select condition...",
    return_cond_good: "Good / Normal",
    return_cond_damaged: "Damaged / Broken",
    return_cond_lost: "Lost / Consumed",
    return_label_photo: "Condition Photo (Required)",
    return_label_upload: "Upload Condition Photo",
    return_label_notes: "Notes (optional)",
    return_placeholder_notes: "Report any issues, missing parts...",
    btn_confirm_return: "Confirm Return",
    loading_text: "Loading tools...",
    msg_fill_all: "Please fill in all fields",
    msg_reg_success: "Registration successful!",
    msg_reg_failed: "Registration failed. Please try again.",
    msg_borrow_success: "Tool borrowed successfully!",
    msg_return_success: "Tool returned successfully!",
    msg_cart_empty: "Empty Cart",
    msg_photo_required: "Photo is required",
    admin_sidebar_manager: "System Manager",
    admin_nav_dashboard: "Dashboard",
    admin_nav_tools: "Tools Management",
    admin_nav_transactions: "Transactions",
    admin_nav_overdue: "Overdue Items",
    admin_nav_users: "User Management",
    admin_nav_settings: "Settings",
    admin_btn_back: "Back to Inventory",
    admin_title_dashboard: "Dashboard Overview",
    admin_stat_total: "Total Tools",
    admin_stat_borrowed: "Borrowed",
    admin_stat_overdue: "Overdue",
    admin_stat_low_stock: "Low Stock",
    admin_chart_dist: "Equipment Status Distribution",
    admin_chart_activity: "Recent Borrowing Activity",
    admin_btn_add_tool: "Add New Tool",
    admin_table_image: "Image",
    admin_table_details: "Tool Details",
    admin_table_stock: "Stock",
    admin_table_location: "Location",
    admin_table_status: "Status",
    admin_table_actions: "Actions",
    admin_table_time: "Time",
    admin_table_user: "User",
    admin_table_action: "Action",
    admin_table_proof_borrow: "Borrow Proof",
    admin_table_proof_return: "Return Proof",
  },
  th: {
    app_title: "ระบบยืม-คืนอุปกรณ์ (BETA)",
    btn_login: "เข้าสู่ระบบ",
    btn_logout: "ออกจากระบบ",
    menu_admin: "ระบบจัดการ (Admin)",
    search_placeholder: "ค้นหาอุปกรณ์ ด้วยชื่อ หรือรหัส...",
    filter_all: "ทั้งหมด",
    filter_available: "ว่าง",
    filter_borrowed: "ถูกยืม",
    filter_overdue: "เกินกำหนด",
    filter_location: "สถานที่เก็บ",
    filter_location_all: "ทุกสถานที่",
    filter_category: "ประเภทอุปกรณ์",
    filter_category_all: "ทุกประเภท",
    status_available: "ว่าง",
    status_borrowed: "ถูกยืม",
    status_overdue: "เกินกำหนด",
    status_out_of_stock: "ของหมด",
    unit_items: "ชิ้น",
    unit_many: "จำนวนมาก",
    btn_card_borrow: "ยืมของ",
    btn_card_return: "คืนของ",
    btn_card_out_of_stock: "ของหมด",
    reg_title: "ลงทะเบียนผู้ใช้งาน",
    reg_subtitle: "สร้างโปรไฟล์เพื่อเริ่มใช้งานระบบยืม-คืน",
    reg_login_line_text: "กรุณาล็อกอินด้วย LINE เพื่อยืนยันตัวตน",
    reg_btn_line: "ล็อกอินด้วย LINE",
    reg_label_nickname: "ชื่อเล่น",
    reg_placeholder_nickname: "เช่น ต้น, นก",
    reg_label_dept: "ฝ่าย (Department)",
    reg_select_dept: "เลือกฝ่าย...",
    reg_label_cohort: "รุ่น (Cohort)",
    reg_select_cohort: "เลือกรุ่น...",
    reg_btn_save: "บันทึกและเริ่มใช้งาน",
    reg_help: "ช่วยเหลือ",
    reg_step_1: "ขั้นตอนที่ 1 จาก 2",
    reg_step_2: "ขั้นตอนที่ 2 จาก 2",
    borrow_title: "ยืมอุปกรณ์",
    borrow_label_qty: "จำนวนที่ต้องการยืม",
    borrow_label_reason: "เหตุผลการยืม",
    borrow_placeholder_reason: "ระบุเหตุผล หรือ งานที่นำไปใช้...",
    borrow_label_photo: "ถ่ายรูปตอนยืม (จำเป็น)",
    borrow_label_upload: "อัปโหลดรูปตอนยืม",
    borrow_label_date_borrow: "วันที่ยืม",
    borrow_label_date_return: "วันที่กำหนดคืน",
    btn_cancel: "ยกเลิก",
    btn_confirm_borrow: "ยืนยันการยืม",
    return_title: "คืนอุปกรณ์",
    return_label_condition: "สภาพอุปกรณ์",
    return_select_condition: "เลือกสภาพ...",
    return_cond_good: "สภาพดี / ปกติ",
    return_cond_damaged: "ชำรุด / เสียหาย",
    return_cond_lost: "สูญหาย / ใช้หมดไป",
    return_label_photo: "ถ่ายรูปสภาพตอนคืน (จำเป็น)",
    return_label_upload: "อัปโหลดรูปสภาพของ",
    return_label_notes: "หมายเหตุ (ไม่บังคับ)",
    return_placeholder_notes: "แจ้งปัญหา หรือ ชิ้นส่วนที่ขาดหาย...",
    btn_confirm_return: "ยืนยันการคืน",
    loading_text: "กำลังโหลดข้อมูล...",
    msg_fill_all: "กรุณากรอกข้อมูลให้ครบถ้วน",
    msg_reg_success: "ลงทะเบียนสำเร็จ!",
    msg_reg_failed: "ลงทะเบียนไม่สำเร็จ กรุณาลองใหม่",
    msg_borrow_success: "ทำรายการยืมสำเร็จ!",
    msg_return_success: "ทำรายการคืนสำเร็จ!",
    msg_cart_empty: "ตะกร้าว่างเปล่า",
    msg_photo_required: "กรุณาถ่าย/อัปโหลดรูปภาพ",
    admin_sidebar_manager: "ผู้ดูแลระบบ",
    admin_nav_dashboard: "หน้าแรก",
    admin_nav_tools: "จัดการอุปกรณ์",
    admin_nav_transactions: "ประวัติการยืม-คืน",
    admin_nav_overdue: "รายการเกินกำหนด",
    admin_nav_users: "จัดการผู้ใช้งาน",
    admin_nav_settings: "ตั้งค่าระบบ",
    admin_btn_back: "กลับหน้าหลัก",
    admin_title_dashboard: "ภาพรวมระบบ",
    admin_stat_total: "อุปกรณ์ทั้งหมด",
    admin_stat_borrowed: "ถูกยืมอยู่",
    admin_stat_overdue: "เกินกำหนดคืน",
    admin_stat_low_stock: "ของใกล้หมด",
    admin_chart_dist: "สัดส่วนสถานะอุปกรณ์",
    admin_chart_activity: "กิจกรรมการยืมล่าสุด",
    admin_btn_add_tool: "เพิ่มอุปกรณ์ใหม่",
    admin_table_image: "รูปภาพ",
    admin_table_details: "รายละเอียด",
    admin_table_stock: "คงเหลือ",
    admin_table_location: "สถานที่เก็บ",
    admin_table_status: "สถานะ",
    admin_table_actions: "จัดการ",
    admin_table_time: "วัน-เวลา",
    admin_table_user: "ผู้ใช้งาน",
    admin_table_action: "กิจกรรม",
    admin_table_proof_borrow: "หลักฐานการยืม",
    admin_table_proof_return: "หลักฐานการคืน",
  },
};

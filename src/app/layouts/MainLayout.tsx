import { Outlet, NavLink, Navigate, useNavigate, useLocation } from "react-router";
import {
  Home,
  ClipboardCheck,
  PiggyBank,
  Users,
  Menu,
  X,
  LogOut,
  GraduationCap,
  ChevronRight,
  Bell,
  User as UserIcon,
  Mail,
  Camera,
  Loader2,
  Save
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "../components/ui/utils";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { BookOpenCheck } from "lucide-react";

const NAV_ITEMS = [
  { name: "หน้าหลัก (แดชบอร์ด)", path: "/", icon: Home, activeBg: "bg-blue-50", activeText: "text-blue-600" },
  { name: "จัดการนักเรียน", path: "/students", icon: Users, activeBg: "bg-violet-50", activeText: "text-violet-600" },
  { name: "ระบบเช็คชื่อ", path: "/attendance", icon: ClipboardCheck, activeBg: "bg-emerald-50", activeText: "text-emerald-600" },
  { name: "ตรวจการบ้าน", path: "/assignments", icon: BookOpenCheck, activeBg: "bg-indigo-50", activeText: "text-indigo-600" },
];

export function MainLayout() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  
  const { user, isLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user && isEditProfileOpen) {
      setEditName(user.user_metadata?.name || "");
      setEditEmail(user.email || "");
    }
  }, [user, isEditProfileOpen]);

  if (isLoading) {
    return (
      <div className="auth-loading-bg h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="auth-loading-badge w-12 h-12 rounded-2xl flex items-center justify-center animate-pulse">
            <GraduationCap className="text-white" size={24} />
          </div>
          <p className="text-slate-500 font-medium">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = async () => {
    setIsLogoutModalOpen(false);
    try {
      await signOut();
      toast.success("ออกจากระบบสำเร็จ");
      navigate("/login");
    } catch {
      toast.error("ออกจากระบบล้มเหลว");
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editEmail.trim()) {
      toast.error("กรุณากรอกชื่อและที่อยู่อีเมลให้ครบถ้วน");
      return;
    }

    setIsSavingProfile(true);
    try {
      const updates: any = {};
      let isEmailChanged = false;

      if (editName !== user?.user_metadata?.name) {
        updates.data = { name: editName };
      }
      
      if (editEmail !== user?.email) {
        updates.email = editEmail;
        isEmailChanged = true;
      }

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.auth.updateUser(updates);
        if (error) throw error;
      }
        
      // Update teacher_profiles collection as well
      const { error: profileError } = await supabase
        .from('teacher_profiles')
        .update({
          display_name: editName,
          ...(isEmailChanged ? { email: editEmail } : {})
        })
        .eq('user_id', user?.id || "");

      if (profileError) {
        console.error("Failed to update teacher_profiles", profileError);
      }

      toast.success(
        isEmailChanged 
          ? "อัพเดทโปรไฟล์สำเร็จ (หากเปลี่ยนอีเมล กรุณายืนยันในกล่องข้อความอีเมล)"
          : "บันทึกข้อมูลเรียบร้อยแล้ว"
      );
      setIsEditProfileOpen(false);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "เกิดข้อผิดพลาดในการอัพเดทข้อมูล");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const userName = user?.user_metadata?.name || "คุณครู";
  const userInitial = userName.charAt(0);

  const currentPage = NAV_ITEMS.find(
    (item) =>
      item.path === location.pathname ||
      (item.path !== "/" && location.pathname.startsWith(item.path))
  ) || (location.pathname === "/savings" ? { name: "ระบบออมเงิน" } : null);

  return (
    <>
      <div className="flex h-screen bg-[#f8fafc] overflow-hidden font-sans">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={() => setIsMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-[272px] bg-white transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto flex flex-col border-r border-slate-200",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo Area */}
        <div className="h-[72px] px-6 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <GraduationCap size={22} />
            </div>
            <div>
              <h1 className="text-[15px] font-bold text-slate-800 leading-tight">ClassManager</h1>
              <p className="text-[11px] text-slate-400 font-medium">ระบบจัดการห้องเรียน</p>
            </div>
          </div>
          <button
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden text-slate-400 hover:text-slate-600 p-1"
            title="ปิดเมนู"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-3">
            เมนูหลัก
          </p>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                onClick={() => setIsMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative",
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div
                      className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center transition-all",
                        isActive
                          ? `${item.activeBg} ${item.activeText}`
                          : "bg-slate-50 text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-600"
                      )}
                    >
                      <Icon size={18} />
                    </div>
                    <span className={cn("text-[14px]", isActive ? "font-bold" : "font-medium")}>
                      {item.name}
                    </span>
                    {isActive && (
                      <ChevronRight size={14} className="ml-auto text-blue-400" />
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Savings & User Card at Bottom */}
        <div className="p-4 border-t border-slate-100 flex flex-col gap-2">
          {/* Savings Button */}
          <NavLink
            to="/savings"
            onClick={() => setIsMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 w-full mb-1",
                isActive
                  ? "bg-amber-50 text-amber-600 font-bold border border-amber-200/50"
                  : "bg-orange-50/50 text-orange-600 hover:bg-orange-100 hover:text-orange-700 font-medium"
              )
            }
          >
            <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
              <PiggyBank size={18} />
            </div>
            <span className="text-[14px] flex-1">ระบบออมเงิน</span>
            <ChevronRight size={14} className="text-orange-400" />
          </NavLink>

          {/* User Card */}
          <div 
            onClick={() => setIsEditProfileOpen(true)}
            className="bg-slate-50 rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
            title="แก้ไขโปรไฟล์"
          >
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-700 truncate">{userName}</p>
              <p className="text-[11px] text-slate-400 font-medium">คุณครู</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsLogoutModalOpen(true);
              }}
              className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all border border-slate-200 shadow-sm"
              title="ออกจากระบบ"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="h-[72px] flex items-center justify-between px-4 lg:px-8 bg-white/80 backdrop-blur-xl border-b border-slate-200 z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="p-2 text-slate-500 rounded-xl hover:bg-slate-100 lg:hidden"
              title="เปิดเมนู"
            >
              <Menu size={22} />
            </button>
            <div className="hidden lg:block">
              <h2 className="text-lg font-bold text-slate-800">
                {currentPage?.name || "หน้าหลัก"}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-all border border-slate-200 relative" title="การแจ้งเตือน">
              <Bell size={18} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full"></span>
            </button>
            <div 
              onClick={() => setIsEditProfileOpen(true)}
              className="hidden md:flex items-center gap-3 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer rounded-xl pl-4 pr-2 py-1.5 border border-slate-200"
              title="แก้ไขโปรไฟล์"
            >
              <div className="text-right">
                <p className="text-sm font-bold text-slate-700">{userName}</p>
                <p className="text-[11px] text-slate-400">คุณครู</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                {userInitial}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>

      {/* Animated Logout Modal */}
      <AnimatePresence>
        {isLogoutModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 transition-all"
              onClick={() => setIsLogoutModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm bg-white rounded-3xl p-6 shadow-2xl z-50 border border-slate-100 flex flex-col"
            >
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-5 mx-auto">
                <LogOut size={32} strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-bold text-center text-slate-800 mb-2">
                ออกจากระบบ
              </h3>
              <p className="text-center text-slate-500 mb-8 text-sm px-2">
                คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ? คุณจะต้องเข้าสู่ระบบใหม่ในครั้งถัดไป
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setIsLogoutModalOpen(false)}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
                >
                  <LogOut size={18} /> ยืนยัน
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {isEditProfileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 transition-all"
              onClick={() => setIsEditProfileOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md bg-white rounded-3xl p-6 shadow-2xl z-50 border border-slate-100 flex flex-col"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <UserIcon className="text-blue-500" size={24} />
                  แก้ไขโปรไฟล์
                </h3>
                <button 
                  onClick={() => setIsEditProfileOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                  title="ปิด"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-700 ml-1">ชื่อ - นามสกุล</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <UserIcon className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="e.g. นายสมชาย ใจดี"
                      className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium outline-none bg-slate-50/50 hover:bg-slate-50 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-700 ml-1">ที่อยู่อีเมล</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      required
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium outline-none bg-slate-50/50 hover:bg-slate-50 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditProfileOpen(false)}
                    className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isSavingProfile ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Save size={18} />
                    )}
                    บันทึกข้อมูล
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

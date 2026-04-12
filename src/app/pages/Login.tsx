import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { 
  Mail, 
  Lock, 
  User, 
  LogIn, 
  UserPlus, 
  Sparkles,
  ShieldCheck
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { api } from "../api";
import { toast } from "sonner";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { useAuth } from "../contexts/AuthContext";
// @ts-ignore
import schoolLogo from "../../assets/dcf802189e52a7839775329ab5bb5cdab37f75c3.png";
// @ts-ignore
import loginBg from "../../assets/bg.png";

export function Login() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [isRecovery, setIsRecovery] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");

  const showExistingAccountMessage = () => {
    setIsLogin(true);
    toast.error("อีเมลนี้สมัครไว้แล้ว", {
      description: "กรุณาเข้าสู่ระบบแทนการสมัครสมาชิก",
    });
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error("กรุณากรอกอีเมลก่อน", {
        description: "ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปยังอีเมลของคุณ",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;
      toast.success("ส่งลิงก์รีเซ็ตรหัสผ่านแล้ว", {
        description: "กรุณาตรวจสอบอีเมลของคุณเพื่อกำหนดรหัสผ่านใหม่",
      });
    } catch (error: any) {
      toast.error("ส่งลิงก์รีเซ็ตรหัสผ่านไม่สำเร็จ", {
        description: error.message || "เกิดข้อผิดพลาดบางอย่าง",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
      setIsLogin(true);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
        setIsLogin(true);
        setPassword("");
        toast.success("กรุณาตั้งรหัสผ่านใหม่");
      }
    });

    if (user && !isRecovery) {
      navigate("/");
    }

    return () => subscription.unsubscribe();
  }, [user, navigate, isRecovery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRecovery) {
      if (!recoveryPassword || recoveryPassword.length < 6) {
        toast.error("รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร");
        return;
      }

      setIsLoading(true);
      try {
        const { error } = await supabase.auth.updateUser({ password: recoveryPassword });
        if (error) throw error;
        await supabase.auth.signOut();
        setIsRecovery(false);
        setRecoveryPassword("");
        setPassword("");
        toast.success("เปลี่ยนรหัสผ่านสำเร็จ", {
          description: "กรุณาเข้าสู่ระบบอีกครั้งด้วยรหัสผ่านใหม่",
        });
      } catch (error: any) {
        toast.error("เปลี่ยนรหัสผ่านไม่สำเร็จ", {
          description: error.message || "เกิดข้อผิดพลาดบางอย่าง",
        });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!email || !password || (!isLogin && !name)) {
      toast.error("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    setIsLoading(true);
    
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("เข้าสู่ระบบสำเร็จ");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
          },
        });
        if (error) throw error;
        toast.success("สมัครสมาชิกสำเร็จ! กำลังเข้าสู่ระบบ...");
        
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }
    } catch (error: any) {
      const message = error.message || "เกิดข้อผิดพลาดบางอย่าง";
      if (!isLogin && /already been registered|already registered|อีเมลนี้ถูกใช้งานแล้ว/i.test(message)) {
        showExistingAccountMessage();
        return;
      }

       if (isLogin && /invalid login credentials/i.test(message)) {
        toast.error("อีเมลหรือรหัสผ่านไม่ถูกต้อง", {
          description: "หากจำรหัสผ่านไม่ได้ ให้กดลืมรหัสผ่าน",
        });
        return;
      }

      toast.error(isLogin ? "เข้าสู่ระบบล้มเหลว" : "สมัครสมาชิกล้มเหลว", {
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col md:flex-row font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Left side - Premium Branding */}
      <div className="hidden md:flex flex-1 relative bg-slate-900 overflow-hidden items-center justify-center">
        <div className="login-hero-overlay absolute inset-0 z-10" />
        <div className="login-hero-fade absolute inset-0 z-10 opacity-70" />

        <ImageWithFallback
          src={loginBg}
          alt="Classroom"
          className="absolute inset-0 w-full h-full object-cover"
        />

        <div className="relative z-20 p-12 flex flex-col justify-between h-full w-full max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-3"
          >
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center p-1.5 overflow-hidden">
              <img src={schoolLogo} alt="School Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-xl font-bold text-white/90">ClassManager</span>
          </motion.div>
        </div>
      </div>

      {/* Right side form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 lg:p-24 bg-[#fafbfc] relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full max-w-[400px]"
        >
          {/* Mobile logo */}
          <div className="md:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center p-1.5 overflow-hidden">
              <img src={schoolLogo} alt="School Logo" className="w-full h-full object-contain brightness-0 invert" />
            </div>
            <span className="text-lg font-bold text-slate-800">ClassManager</span>
          </div>

          <div className="text-center md:text-left mb-10">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl mb-6">
              {isRecovery ? <Lock className="w-5 h-5" /> : isLogin ? <LogIn className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-2">
              {isRecovery ? "ตั้งรหัสผ่านใหม่" : isLogin ? "เข้าสู่ระบบ" : "สร้างบัญชีใหม่"}
            </h2>
            <p className="text-slate-400 text-sm">
              {isRecovery
                ? "กรอกรหัสผ่านใหม่เพื่อกลับเข้าสู่ระบบการจัดการห้องเรียน"
                : isLogin
                ? "กรอกข้อมูลของคุณเพื่อเข้าสู่ระบบจัดการห้องเรียน"
                : "สมัครสมาชิกเพื่อเริ่มต้นใช้งานระบบการจัดการห้องเรียน"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <AnimatePresence mode="popLayout">
              {!isLogin && !isRecovery && (
                <motion.div 
                  initial={{ opacity: 0, height: 0, scale: 0.95 }}
                  animate={{ opacity: 1, height: "auto", scale: 1 }}
                  exit={{ opacity: 0, height: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-1.5 overflow-hidden"
                >
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    ชื่อ-นามสกุล
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-300">
                      <User size={18} />
                    </div>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-11 w-full py-3 bg-white border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none text-slate-800 placeholder:text-slate-300 font-medium text-sm"
                      placeholder="เช่น คุณครูใจดี นามสมมติ"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="popLayout">
              {!isRecovery && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-1.5 overflow-hidden"
              >
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  อีเมล
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-300">
                    <Mail size={18} />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-11 w-full py-3 bg-white border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none text-slate-800 placeholder:text-slate-300 font-medium text-sm"
                    placeholder="teacher@example.com"
                  />
                </div>
              </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {isRecovery ? "รหัสผ่านใหม่" : "รหัสผ่าน"}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-300">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  value={isRecovery ? recoveryPassword : password}
                  onChange={(e) => isRecovery ? setRecoveryPassword(e.target.value) : setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="pl-11 w-full py-3 bg-white border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none text-slate-800 placeholder:text-slate-300 font-medium text-sm"
                  placeholder={isRecovery ? "ตั้งรหัสผ่านใหม่อย่างน้อย 6 ตัวอักษร" : "รหัสผ่านอย่างน้อย 6 ตัวอักษร"}
                />
              </div>
            </div>

            <AnimatePresence mode="popLayout">
              {isLogin && !isRecovery && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex justify-end overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                  >
                    ลืมรหัสผ่าน?
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-70 text-white font-bold py-3 px-4 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm"
            >
              {isLoading ? (
                "กำลังดำเนินการ..."
              ) : isRecovery ? (
                "บันทึกรหัสผ่านใหม่"
              ) : isLogin ? (
                <>
                  เข้าสู่ระบบ <LogIn size={18} />
                </>
              ) : (
                <>
                  สมัครใช้งาน <UserPlus size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center flex flex-col items-center gap-4">
            {!isRecovery && (
            <div className="text-sm text-slate-400">
              {isLogin ? "ยังไม่มีบัญชีใช่ไหม?" : "มีบัญชีอยู่แล้วใช่ไหม?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setEmail("");
                  setPassword("");
                  setName("");
                }}
                className="font-bold text-blue-600 hover:text-blue-700 transition-colors underline-offset-4 hover:underline"
              >
                {isLogin ? "สมัครใช้งานที่นี่" : "เข้าสู่ระบบเลย"}
              </button>
            </div>
            )}

            <div className="flex items-center gap-2 text-[11px] text-slate-300 mt-2">
              <ShieldCheck size={12} />
              <span>ระบบรักษาความปลอดภัยข้อมูลระดับมาตรฐาน</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
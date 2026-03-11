import { useState, FormEvent } from "react";
import { motion } from "motion/react";
import { Zap, User as UserIcon, Lock, Loader2 } from "lucide-react";
import { User } from "../types";

interface LoginPageProps {
  onLogin: (user: User, token: string) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || "/api";
    const endpoint = isLogin ? `${API_BASE_URL}/auth/login` : `${API_BASE_URL}/auth/register`;
    
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (res.ok) {
        if (isLogin) {
          onLogin(data.user, data.token);
        } else {
          setIsLogin(true);
          setError("ลงทะเบียนสำเร็จ กรุณาเข้าสู่ระบบ");
        }
      } else {
        setError(data.error || "เกิดข้อผิดพลาด");
      }
    } catch (err) {
      setError("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-[32px] p-10 border border-slate-100 shadow-2xl shadow-indigo-100/50"
      >
        <div className="flex flex-col items-center gap-4 mb-10">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-200">
            <Zap className="text-white w-8 h-8" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-800">OT Tracker</h1>
            <p className="text-sm text-slate-400 font-medium">ระบบจัดการเวลาทำงานและ OT</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 space-y-3">
            <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 text-sm font-bold rounded-2xl text-center">
              {error}
            </div>
            {error.includes("Database not initialized") && (
              <button 
                onClick={async () => {
                  try {
                    const res = await fetch("/api/health");
                    const data = await res.json();
                    alert(`Status: ${data.message}\nEmail: ${data.config.email}\nSheet ID: ${data.config.sheetId}\nHas Key: ${data.config.hasKey}\nLast Error: ${data.lastError || "None"}`);
                  } catch (e) {
                    alert("Failed to check health");
                  }
                }}
                className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors underline"
              >
                ตรวจสอบสถานะการเชื่อมต่อ (Check Connection)
              </button>
            )}
            {error.includes("Database not initialized") && (
              <button 
                onClick={async () => {
                  setLoading(true);
                  try {
                    const res = await fetch("/api/debug/reinit", { method: "POST" });
                    const data = await res.json();
                    alert(data.message);
                    if (data.success) {
                      setError("");
                    }
                  } catch (e) {
                    alert("Failed to retry connection");
                  } finally {
                    setLoading(false);
                  }
                }}
                className="w-full py-2 text-xs font-bold text-indigo-500 hover:text-indigo-800 transition-colors underline"
              >
                ลองเชื่อมต่อใหม่อีกครั้ง (Retry Connection)
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">ชื่อผู้ใช้งาน</label>
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text" 
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Username"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">รหัสผ่าน</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="password" 
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? "เข้าสู่ระบบ" : "ลงทะเบียน")}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            {isLogin ? "ยังไม่มีบัญชี? ลงทะเบียนที่นี่" : "มีบัญชีอยู่แล้ว? เข้าสู่ระบบ"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

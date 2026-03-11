
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from "react";
import { 
  Settings as SettingsIcon, 
  LayoutDashboard, 
  Zap, 
  FileText, 
  CalendarDays,
  ShieldCheck,
  User as UserIcon,
  LogOut
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { motion, AnimatePresence } from "motion/react";

import { AttendanceRecord, Settings as SettingsType, OffsetRecord, User, AuditLog as AuditLogType, AttendanceSummary } from "./types";
import LoginPage from "./components/LoginPage";
import AttendanceTable from "./components/table";
import CalendarView from "./components/calendar";
import OffsetTool from "./components/ot";
import Dashboard from "./components/report";
import SettingsPage from "./components/setting";
import AuditLogPage from "./components/AuditLog";
import LoadingScreen from "./components/LoadingScreen";

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || "/api";

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [activeTab, setActiveTab] = useState<"attendance" | "offset" | "dashboard" | "settings" | "audit">("attendance");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [settings, setSettings] = useState<SettingsType>({
    sick_leave_total: "30",
    vacation_leave_total: "10",
    default_shift_start: "08:00",
    default_shift_end: "17:00"
  });
  const [offsets, setOffsets] = useState<OffsetRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogType[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();
      
      const headers = { "Authorization": `Bearer ${token}` };
      
      const [attRes, setRes, offRes, summaryRes] = await Promise.all([
        fetch(`${API_BASE_URL}/attendance?month=${month}&year=${year}`, { headers, cache: 'no-store' }),
        fetch(`${API_BASE_URL}/settings?month=${month}&year=${year}`, { headers, cache: 'no-store' }),
        fetch(`${API_BASE_URL}/offsets`, { headers, cache: 'no-store' }),
        fetch(`${API_BASE_URL}/attendance/summary?month=${month}&year=${year}`, { headers, cache: 'no-store' })
      ]);

      if (attRes.status === 401 || setRes.status === 401 || offRes.status === 401 || summaryRes.status === 401) {
        handleLogout();
        return;
      }

      const attData = attRes.ok ? await attRes.json() : [];
      const setData = setRes.ok ? await setRes.json() : {};
      const offData = offRes.ok ? await offRes.json() : [];
      const summaryData = summaryRes.ok ? await summaryRes.json() : null;

      setRecords(Array.isArray(attData) ? attData : []);
      setSettings(setData);
      setOffsets(Array.isArray(offData) ? offData : []);
      setSummary(summaryData);

      if (user?.role === 'admin') {
        const auditRes = await fetch(`${API_BASE_URL}/audit`, { headers });
        if (auditRes.ok) {
          setAuditLogs(await auditRes.json());
        }
      }
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      // Small delay for smooth transition
      setTimeout(() => setIsLoading(false), 800);
    }
  }, [currentDate, token, user]);

  useEffect(() => {
    if (token && !user) {
      fetch(`${API_BASE_URL}/auth/me`, {
        headers: { "Authorization": `Bearer ${token}` }
      }).then(res => {
        if (res.ok) return res.json();
        throw new Error("Invalid token");
      }).then(data => {
        setUser(data);
      }).catch(() => {
        handleLogout();
      });
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogin = (user: User, token: string) => {
    setUser(user);
    setToken(token);
    localStorage.setItem("token", token);
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
  };

  if (!token) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const tabs = [
    { id: "attendance", label: "ตาราง", icon: CalendarDays },
    { id: "offset", label: "OT", icon: Zap },
    { id: "dashboard", label: "สรุป", icon: FileText },
    { id: "settings", label: "ตั้งค่า", icon: SettingsIcon },
  ];

  if (user?.role === 'admin') {
    tabs.push({ id: "audit", label: "Audit", icon: ShieldCheck });
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#1e293b] font-sans pb-24 relative">
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-[9999]"
          >
            <LoadingScreen />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Zap className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 leading-none">OT System</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Work & Life Balance</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-xs font-bold text-slate-800">{user?.username}</span>
              <span className="text-[10px] font-medium text-slate-400 capitalize">{user?.role}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "attendance" && (
              viewMode === 'list' ? (
                <AttendanceTable 
                  records={records} 
                  settings={settings} 
                  currentDate={currentDate} 
                  setCurrentDate={setCurrentDate} 
                  onUpdate={fetchData} 
                  onViewChange={setViewMode}
                />
              ) : (
                <CalendarView 
                  records={records} 
                  settings={settings} 
                  currentDate={currentDate} 
                  setCurrentDate={setCurrentDate} 
                  onUpdate={fetchData} 
                  onViewChange={setViewMode}
                />
              )
            )}
            {activeTab === "offset" && (
              <OffsetTool 
                records={records} 
                offsets={offsets} 
                onUpdate={fetchData} 
                settings={settings}
                currentDate={currentDate}
                setCurrentDate={setCurrentDate}
                summary={summary}
              />
            )}
            {activeTab === "dashboard" && (
              <Dashboard 
                records={records} 
                settings={settings} 
                offsets={offsets} 
                currentDate={currentDate} 
                setCurrentDate={setCurrentDate}
                summary={summary} 
              />
            )}
            {activeTab === "settings" && (
              <SettingsPage 
                settings={settings} 
                onUpdate={fetchData} 
                currentDate={currentDate} 
                setCurrentDate={setCurrentDate} 
                token={token} 
              />
            )}
            {activeTab === "audit" && (
              <AuditLogPage logs={auditLogs} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-200 safe-area-bottom z-50">
        <div className="max-w-7xl mx-auto px-6 h-[88px] flex items-start justify-between pt-4">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className="relative flex flex-col items-center gap-1 group w-14"
              >
                {isActive && (
                  <motion.div 
                    layoutId="activeTab"
                    className="absolute -top-4 w-10 h-1 bg-indigo-600 rounded-b-full shadow-[0_0_12px_rgba(79,70,229,0.5)]"
                  />
                )}
                <div className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300",
                  isActive ? "bg-indigo-50 text-indigo-600 shadow-sm" : "text-slate-400 group-hover:text-slate-600"
                )}>
                  <tab.icon className={cn("w-6 h-6", isActive && "fill-current")} />
                </div>
                <span className={cn(
                  "text-[10px] font-bold transition-colors",
                  isActive ? "text-indigo-600" : "text-slate-400"
                )}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

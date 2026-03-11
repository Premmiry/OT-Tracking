
import { useState, useEffect, FormEvent } from "react";
import { 
  Settings as SettingsIcon, 
  Clock, 
  AlertCircle, 
  TrendingDown, 
  FileText,
  CheckCircle2
} from "lucide-react";
import { Settings as SettingsType } from "../types";

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || "/api";

export default function Settings({ settings, onUpdate, currentDate, setCurrentDate, token }: { 
  settings: SettingsType, 
  onUpdate: () => void, 
  currentDate: Date, 
  setCurrentDate: (d: Date) => void, 
  token: string 
}) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [configuredMonths, setConfiguredMonths] = useState<number[]>([]);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    const fetchConfiguredMonths = async () => {
      try {
        const year = currentDate.getFullYear();
        const res = await fetch(`${API_BASE_URL}/settings/configured-months/${year}`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setConfiguredMonths(data.months);
        }
      } catch (error) {
        console.error("Failed to fetch configured months", error);
      }
    };
    
    if (token) {
      fetchConfiguredMonths();
    }
  }, [currentDate.getFullYear(), token, settings]); // Re-fetch when year changes or settings updated

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/settings/`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          sick_leave_total: localSettings.sick_leave_total,
          vacation_leave_total: localSettings.vacation_leave_total,
          default_shift_start: localSettings.default_shift_start,
          default_shift_end: localSettings.default_shift_end,
          month: String(currentDate.getMonth() + 1),
          year: String(currentDate.getFullYear())
        })
      });

      if (!res.ok) {
        throw new Error(`Failed to save settings: ${res.status}`);
      }

      onUpdate();
      alert(`บันทึกการตั้งค่าสำหรับเดือน ${months[currentDate.getMonth()]} เรียบร้อย!`);
    } catch (error) {
      console.error(error);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง");
    }
  };

  const months = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
            <SettingsIcon className="text-indigo-600 w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">ตั้งค่าระบบ</h2>
        </div>
        <p className="text-sm text-slate-500">ตั้งค่าเวลาทำงานและวันลาต่อเดือน</p>
      </header>

      {/* Selectors */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <select 
            value={currentDate.getMonth()}
            onChange={e => setCurrentDate(new Date(currentDate.getFullYear(), parseInt(e.target.value)))}
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500 appearance-none"
          >
            {months.map((m, i) => {
              const isConfigured = configuredMonths.includes(i + 1);
              return (
                <option key={i} value={i}>
                  {m} {isConfigured ? "✓" : ""}
                </option>
              );
            })}
          </select>
          {configuredMonths.includes(currentDate.getMonth() + 1) && (
            <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-500">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          )}
        </div>
        
        <select 
          value={currentDate.getFullYear()}
          onChange={e => setCurrentDate(new Date(parseInt(e.target.value), currentDate.getMonth()))}
          className="w-32 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500 appearance-none"
        >
          {years.map(y => <option key={y} value={y}>{y + 543}</option>)}
        </select>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Work Time Section */}
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 card-shadow space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
              <Clock className="text-indigo-500 w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">เวลาทำงาน</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">เวลาเข้างาน</label>
              <div className="relative">
                <input 
                  type="time" 
                  value={localSettings.default_shift_start || ""}
                  onChange={e => setLocalSettings({...localSettings, default_shift_start: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 focus:ring-2 focus:ring-indigo-500 font-bold"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">เวลาเลิกงาน</label>
              <div className="relative">
                <input 
                  type="time" 
                  value={localSettings.default_shift_end || ""}
                  onChange={e => setLocalSettings({...localSettings, default_shift_end: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 focus:ring-2 focus:ring-indigo-500 font-bold"
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-bold text-slate-800">
              ชั่วโมงทำงานต่อวัน: {(() => {
                const parseTime = (t: string | undefined | null) => {
                  if (!t || typeof t !== 'string') return 0;
                  const parts = t.split(':');
                  if (parts.length < 2) return 0;
                  const [h, m] = parts.map(Number);
                  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
                };
                const start = parseTime(localSettings.default_shift_start);
                const end = parseTime(localSettings.default_shift_end);
                const diff = end - start;
                return `${Math.floor(diff / 60)} ชม. ${diff % 60} นาที`;
              })()}
            </p>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              หลักการตัดเวลา: &lt; 30 น. → 0 น. | 30-59 น. → 30 น. | ≥ 60 น. → 60 น.
            </p>
          </div>
        </div>

        {/* Sick Leave Section */}
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 card-shadow space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
              <AlertCircle className="text-orange-500 w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">วันลาป่วย</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">จำนวนวันลาป่วยทั้งหมด</label>
              <input 
                type="number" 
                value={localSettings.sick_leave_total || ""}
                onChange={e => setLocalSettings({...localSettings, sick_leave_total: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 focus:ring-2 focus:ring-indigo-500 font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">ใช้ไปแล้ว</label>
              <input 
                type="number" 
                readOnly
                value={0}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 font-bold text-slate-400 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="bg-orange-50/50 border border-orange-100 rounded-2xl p-4">
            <p className="text-xs font-bold text-orange-600">คงเหลือ: {localSettings.sick_leave_total} วัน</p>
          </div>
        </div>

        {/* Vacation Leave Section */}
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 card-shadow space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
              <TrendingDown className="text-emerald-500 w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">วันลาพักร้อน</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">จำนวนวันลาพักร้อนทั้งหมด</label>
              <input 
                type="number" 
                value={localSettings.vacation_leave_total || ""}
                onChange={e => setLocalSettings({...localSettings, vacation_leave_total: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 focus:ring-2 focus:ring-indigo-500 font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">ใช้ไปแล้ว</label>
              <input 
                type="number" 
                readOnly
                value={0}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 font-bold text-slate-400 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4">
            <p className="text-xs font-bold text-emerald-600">คงเหลือ: {localSettings.vacation_leave_total} วัน</p>
          </div>
        </div>

        <button 
          type="submit"
          className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
        >
          <FileText className="w-5 h-5" />
          บันทึกการตั้งค่า
        </button>
      </form>
    </div>
  );
}

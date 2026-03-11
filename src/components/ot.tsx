
import { useState, FormEvent } from "react";
import { format } from "date-fns";
import { 
  Zap, 
  ArrowRight, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  History, 
  ChevronRight, 
  Plus, 
  X, 
  Clock, 
  AlertCircle 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { AttendanceRecord, OffsetRecord, Settings as SettingsType, AttendanceSummary } from "../types";

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || "/api";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function OffsetTool({ records, offsets, onUpdate, settings, currentDate, setCurrentDate, summary }: { 
  records: AttendanceRecord[], 
  offsets: OffsetRecord[], 
  onUpdate: () => void, 
  settings: SettingsType,
  currentDate: Date,
  setCurrentDate: (d: Date) => void,
  summary: AttendanceSummary | null
}) {
  const [activeSubTab, setActiveSubTab] = useState<"ot" | "offset" | "debt">("ot");
  const [isOtModalOpen, setIsOtModalOpen] = useState(false);
  const [isOffsetModalOpen, setIsOffsetModalOpen] = useState(false);
  
  const [selectedOt, setSelectedOt] = useState<number | null>(null);
  const [selectedOffset, setSelectedOffset] = useState<number | null>(null);
  const [minutes, setMinutes] = useState(0);
  
  // Selectors
  
  const months = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  // For OT Record Modal
  const [otDate, setOtDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [otType, setOtType] = useState("ทำเกินเวลา");
  const [otActualStart, setOtActualStart] = useState(settings.default_shift_start);
  const [otActualEnd, setOtActualEnd] = useState("18:00");
  const [otNotes, setOtNotes] = useState("");

  // Calculate total OT with recalculated values
  const recalculatedRecords = records.map(r => {
      const parseTime = (t: string | undefined | null) => {
        if (!t || typeof t !== 'string') return 0;
        const parts = t.split(':');
        if (parts.length < 2) return 0;
        const [h, m] = parts.map(Number);
        return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
      };
      
      const sStart = parseTime(r.shift_start);
      const sEnd = parseTime(r.shift_end);
      const aStart = parseTime(r.actual_start);
      const aEnd = parseTime(r.actual_end);
      
      const arrivedEarly = aStart < sStart ? (sStart - aStart) : 0;
      const lateLeave = aEnd > sEnd ? (aEnd - sEnd) : 0;
      
      const calculatedOt = arrivedEarly + lateLeave;
      
      const roundOT = (mins: number) => {
        if (mins < 30) return 0;
        return Math.floor(mins / 30) * 30;
      };
      
      return { ...r, ot_minutes: roundOT(calculatedOt) };
  });

  const otRecords = recalculatedRecords
    .filter(r => r.ot_minutes > 0)
    .filter(r => {
      // Filter by Month/Year
      const [y, m] = r.date.split('-').map(Number);
      if ((m - 1) !== currentDate.getMonth() || y !== currentDate.getFullYear()) {
        return false;
      }
      
      // Filter out fully used OTs
      const used = offsets.filter(o => o.ot_attendance_id === r.id).reduce((acc, curr) => acc + curr.minutes_used, 0);
      return (r.ot_minutes - used) > 0;
    });

  const lateRecords = records
    .filter(r => {
      const [y, m] = r.date.split('-').map(Number);
      if ((m - 1) !== currentDate.getMonth() || y !== currentDate.getFullYear()) {
        return false;
      }
      return r.late_minutes > 0 || r.early_minutes > 0;
    })
    .filter(r => {
      const totalDebt = r.late_minutes + r.early_minutes;
      const used = offsets.filter(o => o.offset_attendance_id === r.id).reduce((acc, curr) => acc + curr.minutes_used, 0);
      return (totalDebt - used) > 0;
    });

  const filteredOffsets = offsets.filter(off => {
    if (!off.offset_date) return false;
    const [y, m] = off.offset_date.split('-').map(Number);
    return (m - 1) === currentDate.getMonth() && y === currentDate.getFullYear();
  });

  const totalOtEarned = summary ? summary.total_ot_earned : recalculatedRecords.reduce((acc, curr) => acc + curr.ot_minutes, 0);
  const totalOtUsed = summary ? summary.total_ot_used : offsets.reduce((acc, curr) => acc + curr.minutes_used, 0);
  const otBalance = summary ? summary.balance : totalOtEarned - totalOtUsed;

  const getAvailableOt = (id: number) => {
    const record = recalculatedRecords.find(r => r.id === id);
    if (!record) return 0;
    const used = offsets.filter(o => o.ot_attendance_id === id).reduce((acc, curr) => acc + curr.minutes_used, 0);
    return record.ot_minutes - used;
  };

  const getRemainingDebt = (id: number) => {
    const record = records.find(r => r.id === id);
    if (!record) return 0;
    const totalDebt = record.late_minutes + record.early_minutes;
    const offset = offsets.filter(o => o.offset_attendance_id === id).reduce((acc, curr) => acc + curr.minutes_used, 0);
    return totalDebt - offset;
  };

  const formatDateThai = (dateStr: string | undefined) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear() + 543;
    return `${day}/${month}/${year}`;
  };

  const handleSaveOt = async (e: FormEvent) => {
    e.preventDefault();
    
    const parseTime = (t: string | undefined | null) => {
      if (!t || typeof t !== 'string') return 0;
      const parts = t.split(':');
      if (parts.length < 2) return 0;
      const [h, m] = parts.map(Number);
      return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
    };

    const sStart = parseTime(settings.default_shift_start);
    const sEnd = parseTime(settings.default_shift_end);
    const aStart = parseTime(otActualStart);
    const aEnd = parseTime(otActualEnd);
    let ot = Math.max(0, aEnd - sEnd) + Math.max(0, sStart - aStart);

    const roundOT = (mins: number) => {
      if (mins < 30) return 0;
      return Math.floor(mins / 30) * 30;
    };

    const finalRecord = {
      date: otDate,
      type: 'WORK',
      shift_start: settings.default_shift_start,
      shift_end: settings.default_shift_end,
      actual_start: otActualStart,
      actual_end: otActualEnd,
      late_minutes: 0,
      early_minutes: 0,
      ot_minutes: roundOT(ot),
      notes: otNotes
    };

    await fetch(`${API_BASE_URL}/attendance`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}`
      },
      body: JSON.stringify(finalRecord)
    });

    setIsOtModalOpen(false);
    onUpdate();
  };

  const handleOffset = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedOt || !selectedOffset || minutes <= 0) return;

    const res = await fetch(`${API_BASE_URL}/offsets`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}`
      },
      body: JSON.stringify({
        ot_attendance_id: selectedOt,
        offset_attendance_id: selectedOffset,
        minutes_used: minutes
      })
    });

    if (res.ok) {
      setSelectedOt(null);
      setSelectedOffset(null);
      setMinutes(0);
      setIsOffsetModalOpen(false);
      onUpdate();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to create offset");
    }
  };

  const handleDeleteOffset = async (id: number) => {
    await fetch(`${API_BASE_URL}/offsets/${id}`, { 
      method: "DELETE",
      headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
    });
    onUpdate();
  };

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                <Zap className="text-indigo-600 w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">OT Manager</h2>
            </div>
            <p className="text-sm text-slate-500 mt-1">บันทึกและนำ OT ไปทดเวลา</p>
          </div>
          
          <div className="flex gap-2">
            <select 
              value={currentDate.getMonth()}
              onChange={e => setCurrentDate(new Date(currentDate.getFullYear(), parseInt(e.target.value)))}
              className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 appearance-none"
            >
              {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select 
              value={currentDate.getFullYear()}
              onChange={e => setCurrentDate(new Date(parseInt(e.target.value), currentDate.getMonth()))}
              className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 appearance-none"
            >
              {years.map(y => <option key={y} value={y}>{y + 543}</option>)}
            </select>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 card-shadow relative overflow-hidden">
          <div className="absolute -top-2 -right-2 w-12 h-12 bg-indigo-50 rounded-full opacity-50" />
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center mb-3">
            <TrendingUp className="text-white w-4 h-4" />
          </div>
          <p className="text-lg font-bold text-slate-800">{(totalOtEarned / 60).toFixed(1)} ชม.</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase">OT สะสม</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 card-shadow relative overflow-hidden">
          <div className="absolute -top-2 -right-2 w-12 h-12 bg-rose-50 rounded-full opacity-50" />
          <div className="w-8 h-8 bg-rose-500 rounded-lg flex items-center justify-center mb-3">
            <TrendingDown className="text-white w-4 h-4" />
          </div>
          <p className="text-lg font-bold text-slate-800">{(totalOtUsed / 60).toFixed(1)} ชม.</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase">ใช้ทดไปแล้ว</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 card-shadow relative overflow-hidden">
          <div className="absolute -top-2 -right-2 w-12 h-12 bg-emerald-50 rounded-full opacity-50" />
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center mb-3">
            <Wallet className="text-white w-4 h-4" />
          </div>
          <p className="text-lg font-bold text-slate-800">{(otBalance / 60).toFixed(1)} ชม.</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase">OT คงเหลือ</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <button 
          onClick={() => setIsOtModalOpen(true)}
          className="flex items-center justify-center gap-2 py-4 rounded-xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
        >
          <Zap className="w-5 h-5" />
          บันทึก OT
        </button>
        <button 
          onClick={() => setIsOffsetModalOpen(true)}
          className="flex items-center justify-center gap-2 py-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 font-bold hover:bg-amber-100 transition-all"
        >
          <ArrowRight className="w-5 h-5" />
          นำ OT ไปทด
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="bg-slate-100 p-1 rounded-xl flex">
        <button 
          onClick={() => setActiveSubTab("ot")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all",
            activeSubTab === "ot" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400"
          )}
        >
          <Zap className="w-4 h-4" />
          OT ที่ทำ ({otRecords.length})
        </button>
        <button 
          onClick={() => setActiveSubTab("debt")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all",
            activeSubTab === "debt" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400"
          )}
        >
          <AlertCircle className="w-4 h-4" />
          สาย/กลับก่อน ({lateRecords.length})
        </button>
        <button 
          onClick={() => setActiveSubTab("offset")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all",
            activeSubTab === "offset" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400"
          )}
        >
          <ArrowRight className="w-4 h-4" />
          การทด ({filteredOffsets.length})
        </button>
      </div>

      {/* List Content */}
      <div className="space-y-4">
        {activeSubTab === "ot" ? (
          otRecords.length > 0 ? (
            otRecords.map((r, i) => {
              const remaining = getAvailableOt(r.id!);
              return (
                <div key={i} className="bg-white p-5 rounded-3xl border border-slate-100 card-shadow flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-xs font-bold text-indigo-600">
                      {format(new Date(r.date), "d")}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{formatDateThai(r.date)}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">ทำเกินเวลา</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-indigo-600">เหลือ {remaining} น.</p>
                    <p className="text-[10px] text-slate-400 font-medium">จาก {r.ot_minutes} นาที</p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-20 space-y-4">
              <Zap className="w-12 h-12 text-slate-100 mx-auto" />
              <p className="text-sm text-slate-400 font-bold">ยังไม่มีบันทึก OT</p>
            </div>
          )
        ) : activeSubTab === "debt" ? (
          lateRecords.length > 0 ? (
            lateRecords.map((r, i) => {
              const remaining = getRemainingDebt(r.id!);
              const isLate = r.late_minutes > 0;
              const isEarly = r.early_minutes > 0;
              const typeLabel = isLate && isEarly ? "สาย + กลับก่อน" : isLate ? "มาสาย" : "กลับก่อน";
              const totalMins = r.late_minutes + r.early_minutes;

              return (
                <div key={i} className="bg-white p-5 rounded-3xl border border-slate-100 card-shadow flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-rose-50 rounded-full flex items-center justify-center text-xs font-bold text-rose-600">
                      {format(new Date(r.date), "d")}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{formatDateThai(r.date)}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{typeLabel}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-rose-600">ค้าง {remaining} น.</p>
                    <p className="text-[10px] text-slate-400 font-medium">จาก {totalMins} นาที</p>
                    {remaining > 0 && (
                      <button 
                        onClick={() => {
                          setSelectedOffset(r.id!);
                          setIsOffsetModalOpen(true);
                        }}
                        className="mt-1 text-[10px] text-indigo-500 hover:text-indigo-700 font-bold underline decoration-indigo-200"
                      >
                        ใช้ OT ชดเชย
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-20 space-y-4">
              <AlertCircle className="w-12 h-12 text-slate-100 mx-auto" />
              <p className="text-sm text-slate-400 font-bold">ไม่มีรายการสาย/กลับก่อน</p>
            </div>
          )
        ) : (
          filteredOffsets.length > 0 ? (
            filteredOffsets.map((off, i) => {
              const ot = off.ot_record;
              const target = off.offset_record;
              
              // Calculate offset time range (Late/Early)
              let timeRange = "-";
              if (target) {
                 if (target.late_minutes > 0) {
                   timeRange = `${target.shift_start} - ${target.actual_start}`;
                 } else if (target.early_minutes > 0) {
                   timeRange = `${target.actual_end} - ${target.shift_end}`;
                 }
              }

              return (
                <div key={i} className="bg-white p-5 rounded-3xl border border-slate-100 card-shadow flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center text-xs font-bold text-amber-600">
                      {off.offset_date ? format(new Date(off.offset_date), "d") : "?"}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">
                        {off.offset_date ? formatDateThai(off.offset_date) : "-"}
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        {timeRange !== "-" ? `เวลา ${timeRange}` : "ทดเวลา"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-rose-500">-{off.minutes_used}น.</p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      ใช้ OT {off.ot_date ? formatDateThai(off.ot_date) : "-"}
                    </p>
                    <button 
                      onClick={() => handleDeleteOffset(off.id!)}
                      className="mt-1 text-[10px] text-rose-400 hover:text-rose-600 font-bold underline decoration-rose-200"
                    >
                      ลบรายการ
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-20 space-y-4">
              <History className="w-12 h-12 text-slate-100 mx-auto" />
              <p className="text-sm text-slate-400 font-bold">ยังไม่มีประวัติการทดเวลา</p>
            </div>
          )
        )}
      </div>

      {/* Record OT Modal */}
      <AnimatePresence>
        {isOtModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[32px] p-8 shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Zap className="text-indigo-600 w-6 h-6" />
                  <h2 className="text-xl font-bold text-slate-800">บันทึก OT</h2>
                </div>
                <button onClick={() => setIsOtModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSaveOt} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">วันที่</label>
                    <input 
                      type="date"
                      value={otDate || ""}
                      onChange={e => setOtDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">ประเภท</label>
                    <select 
                      value={otType || "ทำเกินเวลา"}
                      onChange={e => setOtType(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 font-bold appearance-none"
                    >
                      <option>ทำเกินเวลา</option>
                      <option>ทำงานวันหยุด</option>
                    </select>
                  </div>
                </div>

                <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 space-y-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">เวลาตาม Schedule</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">{settings.default_shift_start}</span>
                      <Clock className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">{settings.default_shift_end}</span>
                      <Clock className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </div>

                <div className="bg-indigo-50/30 rounded-2xl p-4 border border-indigo-100/50 space-y-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">เวลาจริง</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <input 
                        type="time"
                        value={otActualStart || ""}
                        onChange={e => setOtActualStart(e.target.value)}
                        className="w-full bg-white border border-indigo-100 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="relative">
                      <input 
                        type="time"
                        value={otActualEnd || ""}
                        onChange={e => setOtActualEnd(e.target.value)}
                        className="w-full bg-white border border-indigo-100 rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="text-emerald-500 w-5 h-5" />
                    <p className="text-xs font-bold text-emerald-600">OT ที่ได้</p>
                  </div>
                  <p className="text-xl font-bold text-emerald-600">
                    {(() => {
                      const parseTime = (t: string | undefined | null) => {
                        if (!t || typeof t !== 'string') return 0;
                        const parts = t.split(':');
                        if (parts.length < 2) return 0;
                        const [h, m] = parts.map(Number);
                        return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
                      };
                      const sStart = parseTime(settings.default_shift_start);
                      const sEnd = parseTime(settings.default_shift_end);
                      const aStart = parseTime(otActualStart);
                      const aEnd = parseTime(otActualEnd);
                      const ot = Math.max(0, aEnd - sEnd) + Math.max(0, sStart - aStart);
                      if (ot < 30) return 0;
                      return Math.floor(ot / 30) * 30;
                    })()} นาที
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">หมายเหตุ</label>
                  <textarea 
                    value={otNotes || ""}
                    onChange={e => setOtNotes(e.target.value)}
                    placeholder="หมายเหตุเพิ่มเติม..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 min-h-[80px] text-sm font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsOtModalOpen(false)}
                    className="py-4 rounded-2xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    type="submit"
                    className="py-4 rounded-2xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                  >
                    บันทึก OT
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Apply Offset Modal */}
      <AnimatePresence>
        {isOffsetModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[32px] p-8 shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ArrowRight className="text-amber-500 w-6 h-6" />
                  <h2 className="text-xl font-bold text-slate-800">นำ OT ไปทด</h2>
                </div>
                <button onClick={() => setIsOffsetModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleOffset} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">ประเภทการทด</label>
                    <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 font-bold appearance-none">
                      <option>ทดเวลาสาย</option>
                      <option>ทดเวลากลับก่อน</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">วันที่ต้องการทด</label>
                    <select 
                      value={selectedOffset || ""}
                      onChange={e => setSelectedOffset(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 font-bold appearance-none"
                    >
                      <option value="">-- เลือกวันที่ --</option>
                      {lateRecords.map(r => (
                        <option key={r.id} value={r.id} disabled={getRemainingDebt(r.id!) <= 0}>
                          {r.date} (สาย {getRemainingDebt(r.id!)}น.)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {!selectedOffset ? (
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center gap-3">
                    <AlertCircle className="text-blue-500 w-5 h-5 shrink-0" />
                    <p className="text-xs font-medium text-blue-600">กรุณาเลือกวันที่ต้องการทดเวลา</p>
                  </div>
                ) : getRemainingDebt(selectedOffset) <= 0 ? (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-3">
                    <Zap className="text-emerald-500 w-5 h-5 shrink-0" />
                    <p className="text-xs font-medium text-emerald-600">วันที่เลือกได้รับการทดเวลาครบแล้ว</p>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">เลือก OT ที่จะนำมาทด</label>
                  <select 
                    value={selectedOt || ""}
                    onChange={e => setSelectedOt(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 font-bold appearance-none"
                  >
                    <option value="">-- เลือก OT --</option>
                    {otRecords.map(r => (
                      <option key={r.id} value={r.id} disabled={getAvailableOt(r.id!) <= 0}>
                        {r.date} (เหลือ {getAvailableOt(r.id!)}น.)
                      </option>
                    ))}
                  </select>
                  {selectedOt && getAvailableOt(selectedOt) <= 0 && (
                    <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-center gap-3 mt-2">
                      <AlertCircle className="text-rose-500 w-5 h-5 shrink-0" />
                      <p className="text-xs font-medium text-rose-600">ไม่มี OT ที่ใช้ได้ (OT ต้องเกิดก่อนวันที่ทด)</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">จำนวนนาทีที่ใช้</label>
                  <input 
                    type="number"
                    value={minutes}
                    onChange={e => setMinutes(Number(e.target.value))}
                    max={selectedOt ? getAvailableOt(selectedOt) : 0}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsOffsetModalOpen(false)}
                    className="py-4 rounded-2xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    type="submit"
                    disabled={!selectedOt || !selectedOffset || minutes <= 0}
                    className="py-4 rounded-2xl bg-amber-500 text-white font-bold shadow-lg shadow-amber-100 hover:bg-amber-600 transition-all disabled:opacity-50 disabled:shadow-none"
                  >
                    ยืนยันทด OT
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

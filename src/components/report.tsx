
import { 
  LayoutDashboard, 
  Zap, 
  Clock, 
  AlertCircle, 
  TrendingDown, 
  TrendingUp 
} from "lucide-react";
import { format } from "date-fns";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { AttendanceRecord, OffsetRecord, Settings as SettingsType, AttendanceSummary } from "../types";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Dashboard({ records, settings, offsets, currentDate, setCurrentDate, summary }: { 
  records: AttendanceRecord[], 
  settings: SettingsType, 
  offsets: OffsetRecord[], 
  currentDate: Date, 
  setCurrentDate: (d: Date) => void,
  summary: AttendanceSummary | null
}) {
  // Filter for current month view
  const currentMonthStr = format(currentDate, "yyyy-MM");
  const currentYearStr = format(currentDate, "yyyy");
  
  // Apply the same OT recalculation logic as ot.tsx
  const recalculateRecord = (r: AttendanceRecord) => {
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
  };

  const recalculatedRecords = records.map(recalculateRecord);
  
  const monthRecords = recalculatedRecords.filter(r => r.date.startsWith(currentMonthStr));
  const yearRecords = recalculatedRecords.filter(r => r.date.startsWith(currentYearStr));
  
  // Calculate leave based on YEAR
  const sickUsed = yearRecords.filter(r => r.type === 'SICK').length;
  const vacationUsed = yearRecords.filter(r => r.type === 'VACATION').length;
  
  // Other stats based on MONTH (as they are usually tracked monthly)
  const workDays = monthRecords.filter(r => r.type === 'WORK' || r.type === 'WFH').length;
  const dayOffs = monthRecords.filter(r => r.type === 'DAY_OFF').length;
  
  const filteredOffsets = offsets.filter(off => {
    if (!off.offset_date) return false;
    // Check if the offset date (when the leave was taken) is in the current month
    return off.offset_date.startsWith(currentMonthStr);
  });

  // Use summary from backend if available, otherwise fallback to frontend calculation (which might be partial)
  const monthlyOtEarned = summary ? summary.monthly_ot_earned : monthRecords.reduce((acc, curr) => acc + curr.ot_minutes, 0);
  const monthlyOtUsed = summary ? summary.monthly_ot_used : filteredOffsets.reduce((acc, curr) => acc + curr.minutes_used, 0);
  const totalOtEarned = summary ? summary.total_ot_earned : recalculatedRecords.reduce((acc, curr) => acc + curr.ot_minutes, 0);
  // Total OT Used should be cumulative. If fetching by month, 'offsets' might be partial or full depending on implementation.
  // But we trust 'summary' more.
  const otBalance = summary ? summary.balance : (totalOtEarned - (offsets.reduce((acc, curr) => acc + curr.minutes_used, 0)));

  const months = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  const stats = [
    { label: "วันทำงาน", value: `${workDays} วัน`, icon: Zap, color: "text-blue-500", bg: "bg-blue-50" },
    { label: "Day Off", value: `${dayOffs} วัน`, icon: Clock, color: "text-slate-400", bg: "bg-slate-50" },
    { label: "ลาป่วย", value: `${sickUsed} วัน`, icon: AlertCircle, color: "text-orange-500", bg: "bg-orange-50" },
    { label: "ลาพักร้อน", value: `${vacationUsed} วัน`, icon: TrendingDown, color: "text-emerald-500", bg: "bg-emerald-50" },
  ];

  const formatDateThai = (dateStr: string | undefined) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear() + 543;
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
            <LayoutDashboard className="text-indigo-600 w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">สรุปการคำนวณ</h2>
        </div>
        <p className="text-sm text-slate-500">ภาพรวมและรายละเอียดการ OT/ทด</p>
      </header>

      {/* Selectors */}
      <div className="flex gap-3">
        <select 
          value={currentDate.getMonth()}
          onChange={e => setCurrentDate(new Date(currentDate.getFullYear(), parseInt(e.target.value)))}
          className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500 appearance-none"
        >
          {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <select 
          value={currentDate.getFullYear()}
          onChange={e => setCurrentDate(new Date(parseInt(e.target.value), currentDate.getMonth()))}
          className="w-32 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500 appearance-none"
        >
          {years.map(y => <option key={y} value={y}>{y + 543}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-[24px] border border-slate-100 card-shadow space-y-3">
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", stat.bg)}>
              <stat.icon className={cn("w-5 h-5", stat.color)} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white p-6 rounded-[32px] border border-slate-100 card-shadow space-y-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="text-indigo-500 w-5 h-5" />
          <h3 className="text-lg font-bold text-slate-800">สรุป OT / เวลาสาย</h3>
        </div>
        
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm font-medium text-slate-600">OT ที่ทำในเดือนนี้</p>
            <p className="font-bold text-indigo-600">{monthlyOtEarned} นาที ({Math.floor(monthlyOtEarned / 60)}.{monthlyOtEarned % 60} ชม.)</p>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-sm font-medium text-slate-600">OT ที่ใช้ทดในเดือนนี้</p>
            <p className="font-bold text-rose-500">{monthlyOtUsed} นาที</p>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-sm font-medium text-slate-600">OT สะสมทั้งหมด (รวมเดือนอื่น)</p>
            <p className="font-bold text-indigo-600">{totalOtEarned} นาที</p>
          </div>
          <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
            <p className="text-sm font-bold text-slate-800">OT คงเหลือ (ใช้ได้)</p>
            <p className="text-lg font-bold text-emerald-500">{otBalance} นาที ({Math.floor(otBalance / 60)}.{otBalance % 60} ชม.)</p>
          </div>
        </div>
      </div>

      {/* Summary Table */}
      <div className="bg-white rounded-[32px] border border-slate-100 card-shadow overflow-hidden">
        <div className="p-6 border-b border-slate-50">
          <div className="flex items-center gap-2">
            <TrendingDown className="text-rose-500 w-5 h-5" />
            <h3 className="text-lg font-bold text-slate-800">รายละเอียดการทดเวลา</h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  วัน/เดือน/ปี<br />ที่มี OT สะสม
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  เวลาทำงาน<br />ตามตารางเวร
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">เวลาทำงานจริง</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  ลาหยุดโดยใช้ OT<br />ทดแทนในวันที่
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">ช่วงเวลาที่ทด</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap text-right">จำนวน</th>
                
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredOffsets.length > 0 ? (
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
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-xs font-bold text-slate-800 whitespace-nowrap">
                        {formatDateThai(off.ot_date)}
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-600 whitespace-nowrap">
                        {ot ? `${ot.shift_start}-${ot.shift_end}` : "-"}
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-600 whitespace-nowrap">
                        {ot ? `${ot.actual_start}-${ot.actual_end}` : "-"}
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-indigo-600 whitespace-nowrap">
                        {formatDateThai(off.offset_date)}
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-600 whitespace-nowrap">
                        {timeRange}
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-800 text-right whitespace-nowrap">
                        {(off.minutes_used / 60).toFixed(1)} ({off.minutes_used} นาที)
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm font-bold">
                    ยังไม่มีข้อมูลการทดเวลา
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

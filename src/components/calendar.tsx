
import { useState, FormEvent } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, startOfWeek, endOfWeek, isSameMonth } from "date-fns";
import { 
  CalendarDays, 
  ChevronLeft, 
  ChevronRight, 
  Edit2, 
  Plus,
  X,
  List
} from "lucide-react";
import { motion } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import Swal from 'sweetalert2';
import { AttendanceRecord, AttendanceType, Settings as SettingsType } from "../types";

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || "/api";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function CalendarView({ records, settings, currentDate, setCurrentDate, onUpdate, onViewChange }: { 
  records: AttendanceRecord[], 
  settings: SettingsType, 
  currentDate: Date, 
  setCurrentDate: (d: Date) => void,
  onUpdate: () => void,
  onViewChange: (view: 'list' | 'calendar') => void
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<Partial<AttendanceRecord> | null>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

  const handleDayClick = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const existing = records.find((r: any) => r.date === dateStr);
    const shiftStart = settings.default_shift_start || "08:00";
    const shiftEnd = settings.default_shift_end || "17:00";

    setSelectedRecord(existing || {
      date: format(date, "yyyy-MM-dd"),
      type: 'WORK',
      shift_start: shiftStart,
      shift_end: shiftEnd,
      actual_start: shiftStart,
      actual_end: shiftEnd,
      late_minutes: 0,
      early_minutes: 0,
      ot_minutes: 0,
      notes: ""
    });
    setIsModalOpen(true);
  };

  const calculateMinutes = (record: Partial<AttendanceRecord>) => {
    if (record.type !== 'WORK' && record.type !== 'WFH') return { late: 0, early: 0, ot: 0 };

    const parseTime = (t: string | undefined | null) => {
      if (!t || typeof t !== 'string') return 0;
      const parts = t.split(':');
      if (parts.length < 2) return 0;
      const [h, m] = parts.map(Number);
      return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
    };

    const sStart = parseTime(record.shift_start!);
    const sEnd = parseTime(record.shift_end!);
    const aStart = parseTime(record.actual_start!);
    const aEnd = parseTime(record.actual_end!);

    let late = Math.max(0, aStart - sStart);
    let early = Math.max(0, sEnd - aEnd);
    let ot = Math.max(0, aEnd - sEnd);
    
    // Add logic for arrived early
    let arrivedEarly = Math.max(0, sStart - aStart);

    if (aStart < sStart) late = 0;
    if (aEnd > sEnd) early = 0;

    const roundOT = (mins: number) => {
      if (mins < 30) return 0;
      return Math.floor(mins / 30) * 30;
    };

    return { late, early, ot: roundOT(ot) };
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    
    const { late, early, ot } = calculateMinutes(selectedRecord!);
    
    // We don't save 'arrivedEarly' to DB as per current schema, but it's calculated for display
    // Ideally, we should save it if needed. For now, assuming backend calculates or we just display based on times.
    
    const finalRecord = { ...selectedRecord, late_minutes: late, early_minutes: early, ot_minutes: ot };

    if (finalRecord.type === 'SHIFT_CHANGE' && !finalRecord.shift_change_date) {
        Swal.fire({
          icon: 'warning',
          title: 'กรุณาเลือกวันที่',
          text: 'ต้องระบุวันที่ที่ต้องการเปลี่ยนไปทำแทน',
        });
        return;
    }

    try {
      await fetch(`${API_BASE_URL}/attendance`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify(finalRecord)
      });

      setIsModalOpen(false);
      onUpdate();
      
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
          toast.addEventListener('mouseenter', Swal.stopTimer)
          toast.addEventListener('mouseleave', Swal.resumeTimer)
        }
      });

      Toast.fire({
        icon: 'success',
        title: 'บันทึกข้อมูลเรียบร้อยแล้ว'
      });
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง',
      });
    }
  };

  const summary = {
    work: records.filter((r: any) => r.type === 'WORK').length,
    dayOff: records.filter((r: any) => r.type === 'DAY_OFF').length,
    wfh: records.filter((r: any) => r.type === 'WFH').length,
    sick: records.filter((r: any) => r.type === 'SICK').length,
    vacation: records.filter((r: any) => r.type === 'VACATION').length,
    shiftChange: records.filter((r: any) => r.type === 'SHIFT_CHANGE').length,
  };

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto">
      <header className="space-y-1 flex justify-between items-end">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
              <CalendarDays className="text-indigo-600 w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">ตารางงาน</h2>
          </div>
          <p className="text-sm text-slate-500 mt-1">กดที่วันเพื่อตั้งค่าประเภทวันและเวลา</p>
        </div>
        <button 
          onClick={() => onViewChange('list')}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
        >
          <List className="w-4 h-4" />
          มุมมองรายการ
        </button>
      </header>

      {/* Month Selector */}
      <div className="bg-white rounded-2xl p-4 card-shadow flex items-center justify-between border border-slate-100">
        <button 
          onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
          className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="font-bold text-slate-800">{format(currentDate, "MMMM yyyy")}</p>
          <p className="text-[10px] text-slate-400 font-medium">{records.length} วันที่ตั้งค่า</p>
        </div>
        <button 
          onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
          className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-400"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Summary Pills */}
      <div className="flex flex-wrap gap-2">
        <div className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold border border-blue-100">ทำงาน {summary.work} วัน</div>
        <div className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold border border-slate-200">Day Off {summary.dayOff} วัน</div>
        <div className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold border border-indigo-100">WFH {summary.wfh} วัน</div>
        <div className="px-3 py-1.5 bg-orange-50 text-orange-600 rounded-full text-[10px] font-bold border border-orange-100">ลาป่วย {summary.sick} วัน</div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-3xl card-shadow border border-slate-100 overflow-hidden p-4">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 mb-2">
          {weekDays.map((day, index) => (
            <div key={index} className="text-center text-xs font-bold text-slate-400 py-2">
              {day}
            </div>
          ))}
        </div>
        
        {/* Days */}
        <div className="grid grid-cols-7 gap-1 md:gap-2">
          {days.map(day => {
            const dateStr = format(day, "yyyy-MM-dd");
            const record = records.find((r: any) => r.date === dateStr);
            const isToday = isSameDay(day, new Date());
            const isCurrentMonth = isSameMonth(day, currentDate);
            
            return (
              <div
                key={day.toString()}
                onClick={() => handleDayClick(day)}
                className={cn(
                  "min-h-[100px] md:min-h-[120px] rounded-xl p-2 flex flex-col cursor-pointer transition-all border",
                  !isCurrentMonth ? "bg-slate-50/50 text-slate-300 border-transparent hover:bg-slate-50" : 
                  isToday ? "bg-indigo-50 border-indigo-100 ring-2 ring-indigo-100 ring-offset-2" : 
                  "bg-white border-slate-100 hover:border-indigo-200 hover:shadow-md"
                )}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={cn(
                    "text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full",
                    isToday ? "bg-indigo-600 text-white" : 
                    !isCurrentMonth ? "text-slate-300" : "text-slate-700"
                  )}>
                    {format(day, "d")}
                  </span>
                  {record && (
                    <button className="text-[10px] text-indigo-400 bg-indigo-50 px-2 py-0.5 rounded-full font-bold hover:bg-indigo-100 transition-colors">
                      แก้ไข
                    </button>
                  )}
                </div>
                
                {record && isCurrentMonth && (
                  <div className="flex flex-col gap-1 text-[10px] leading-tight">
                     <div className={cn(
                        "font-bold px-2 py-1 rounded-md w-fit",
                        record.type === 'WORK' ? "bg-blue-100 text-blue-600" :
                        record.type === 'WFH' ? "bg-indigo-100 text-indigo-600" :
                        record.type === 'DAY_OFF' ? "bg-slate-100 text-slate-500" :
                        record.type === 'SICK' ? "bg-orange-100 text-orange-600" :
                        record.type === 'VACATION' ? "bg-green-100 text-green-600" :
                        record.type === 'SHIFT_CHANGE' ? "bg-purple-100 text-purple-600" :
                        "bg-slate-100 text-slate-500"
                      )}>
                        {record.type === 'WORK' ? 'ทำงาน' : 
                         record.type === 'WFH' ? 'WFH' :
                         record.type === 'DAY_OFF' ? 'Day Off' :
                         record.type === 'SICK' ? 'ลาป่วย' :
                         record.type === 'VACATION' ? 'ลาพักร้อน' : 
                         record.type === 'SHIFT_CHANGE' ? 'เปลี่ยนเวร' :
                         record.type}
                     </div>
                     
                     {(record.type === 'WORK' || record.type === 'WFH') && (
                       <div className="flex flex-col gap-0.5">
                         <span className="font-bold text-slate-800 text-xs">
                           {record.actual_start || record.shift_start} - {record.actual_end || record.shift_end}
                         </span>
                         <span className="text-slate-400 text-[9px]">
                           (กำหนด {record.shift_start}-{record.shift_end})
                         </span>
                       </div>
                     )}

                     <div className="flex flex-wrap gap-1 mt-1">
                       {/* Calculate Arrived Early on the fly for display */}
                       {(() => {
                          const parseTime = (t: string | undefined | null) => {
                            if (!t || typeof t !== 'string') return 0;
                            const parts = t.split(':');
                            if (parts.length < 2) return 0;
                            const [h, m] = parts.map(Number);
                            return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
                          };
                          const sStart = parseTime(record.shift_start);
                          const aStart = parseTime(record.actual_start);
                          const arrivedEarly = Math.max(0, sStart - aStart);
                          
                          if (arrivedEarly > 0) {
                            return <span className="font-bold text-blue-500">มาก่อน {arrivedEarly}น.</span>;
                          }
                          return null;
                       })()}

                       {record.late_minutes > 0 && (
                         <span className="font-bold text-orange-500">สาย {record.late_minutes}น.</span>
                       )}
                       {record.early_minutes > 0 && (
                         <span className="font-bold text-rose-500">กลับเร็ว {record.early_minutes}น.</span>
                       )}
                       {record.ot_minutes > 0 && (
                         <span className="font-bold text-emerald-500">OT {record.ot_minutes}น.</span>
                       )}
                     </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal - Same as Table View */}
      {isModalOpen && selectedRecord && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-0 md:p-4">
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            className="bg-white w-full max-w-md rounded-t-[32px] md:rounded-[32px] p-8 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                  <CalendarDays className="text-indigo-600 w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">ตั้งค่าวันที่ {format(new Date(selectedRecord.date!), "d/M/yyyy")}</h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                <Plus className="w-5 h-5 text-slate-400 rotate-45" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">ประเภทวัน</label>
                <select 
                  value={selectedRecord.type || "WORK"}
                  onChange={e => setSelectedRecord({...selectedRecord, type: e.target.value as AttendanceType})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none font-medium"
                >
                  <option value="WORK">ทำงาน</option>
                  <option value="WFH">WFH</option>
                  <option value="DAY_OFF">Day Off</option>
                  <option value="SICK">ลาป่วย</option>
                  <option value="VACATION">ลาพักร้อน</option>
                  <option value="SHIFT_CHANGE">เปลี่ยนเวร</option>
                </select>
              </div>

              {selectedRecord.type === 'SHIFT_CHANGE' && (
                <div className="bg-purple-50/50 rounded-2xl p-4 border border-purple-100 space-y-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400">เปลี่ยนไปใช้วันที่</p>
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-purple-500">เลือกวันที่ต้องการไปทำแทน</label>
                    <input 
                      type="date" 
                      value={selectedRecord.shift_change_date || ""}
                      onChange={e => setSelectedRecord({...selectedRecord, shift_change_date: e.target.value})}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full bg-white border border-purple-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-purple-500"
                    />
                    <p className="text-[10px] text-purple-400 mt-1">
                      * ต้องมาทำงานก่อนถึงจะเปลี่ยนไปใช้วันอื่นได้ (เลือกวันที่ในอนาคต)
                    </p>
                  </div>
                </div>
              )}

              {(selectedRecord.type === 'WORK' || selectedRecord.type === 'WFH') && (
                <>
                  <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 space-y-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">เวลาตาม Schedule</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-slate-500">เริ่ม</label>
                        <input 
                          type="time" 
                          value={selectedRecord.shift_start || ""}
                          onChange={e => setSelectedRecord({...selectedRecord, shift_start: e.target.value})}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-slate-500">สิ้นสุด</label>
                        <input 
                          type="time" 
                          value={selectedRecord.shift_end || ""}
                          onChange={e => setSelectedRecord({...selectedRecord, shift_end: e.target.value})}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-indigo-50/30 rounded-2xl p-4 border border-indigo-100/50 space-y-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">เวลาจริง (ถ้ามี)</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-indigo-500">เข้า</label>
                        <input 
                          type="time" 
                          value={selectedRecord.actual_start ?? ""}
                          onChange={e => setSelectedRecord({...selectedRecord, actual_start: e.target.value})}
                          className="w-full bg-white border border-indigo-100 rounded-xl px-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-indigo-500">ออก</label>
                        <input 
                          type="time" 
                          value={selectedRecord.actual_end || ""}
                          onChange={e => setSelectedRecord({...selectedRecord, actual_end: e.target.value})}
                          className="w-full bg-white border border-indigo-100 rounded-xl px-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">หมายเหตุ</label>
                <textarea 
                  value={selectedRecord.notes || ""}
                  onChange={e => setSelectedRecord({...selectedRecord, notes: e.target.value})}
                  placeholder="เช่น ทำ OT หลังเลิก"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 focus:ring-2 focus:ring-indigo-500 min-h-[100px] text-sm font-medium"
                />
              </div>

              <div className="flex gap-4 pt-2">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-4 rounded-2xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-4 rounded-2xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors"
                >
                  บันทึก
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

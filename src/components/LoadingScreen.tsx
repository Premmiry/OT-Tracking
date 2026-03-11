import { motion } from "motion/react";
import { Zap, Clock, CalendarDays } from "lucide-react";

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-white z-[9999] flex flex-col items-center justify-center overflow-hidden">
      <div className="relative">
        {/* Main Logo */}
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, type: "spring" }}
          className="w-24 h-24 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-200 relative z-10"
        >
          <Zap className="text-white w-12 h-12" />
        </motion.div>
        
        {/* Orbiting Ring */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border border-dashed border-indigo-200 rounded-full"
        />

        {/* Orbiting Icons */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/2 left-1/2 w-0 h-0"
        >
           {/* Top Icon */}
           <div className="absolute -top-20 -left-5">
             <motion.div 
                animate={{ rotate: -360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="w-10 h-10 bg-white rounded-full shadow-lg border border-indigo-50 flex items-center justify-center text-indigo-500"
             >
               <Clock className="w-5 h-5" />
             </motion.div>
           </div>
           
           {/* Bottom Icon */}
           <div className="absolute -bottom-20 -left-5">
             <motion.div 
                animate={{ rotate: -360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="w-10 h-10 bg-white rounded-full shadow-lg border border-indigo-50 flex items-center justify-center text-indigo-500"
             >
               <CalendarDays className="w-5 h-5" />
             </motion.div>
           </div>
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-16 text-center z-10"
      >
        <h2 className="text-2xl font-bold text-slate-800">OT Tracking System</h2>
        <p className="text-slate-500 mt-2 font-medium">Work & Life Balance</p>
        
        <div className="mt-8 flex flex-col items-center gap-2">
            <div className="text-xs font-semibold text-indigo-600 uppercase tracking-widest">
                กำลังโหลดข้อมูล...
            </div>
            {/* Progress Bar */}
            <div className="w-64 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <motion.div 
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ duration: 1.5, ease: "easeInOut", repeat: Infinity }}
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full w-1/2"
            />
            </div>
        </div>
      </motion.div>

      {/* Background decoration */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-50/50 rounded-full blur-3xl" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-violet-50/50 rounded-full blur-3xl" />
      </div>
    </div>
  );
}

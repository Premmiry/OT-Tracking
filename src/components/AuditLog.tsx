
import { ShieldCheck, History } from "lucide-react";
import { format } from "date-fns";
import { AuditLog as AuditLogType } from "../types";

export default function AuditLog({ logs }: { logs: AuditLogType[] }) {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
            <ShieldCheck className="text-indigo-600 w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Audit Logs</h2>
        </div>
        <p className="text-sm text-slate-500">ประวัติการทำรายการในระบบ</p>
      </header>

      <div className="bg-white rounded-3xl card-shadow border border-slate-100 overflow-hidden">
        <div className="divide-y divide-slate-50">
          {logs.length > 0 ? logs.map((log) => (
            <div key={log.id} className="px-6 py-4 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-bold text-slate-800">{log.action}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    โดย {log.username} • {format(new Date(log.timestamp), "d MMM yyyy HH:mm")}
                  </p>
                </div>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-bold">
                  {log.table_name || "N/A"}
                </span>
              </div>
              {log.new_values && (
                <pre className="text-[10px] bg-slate-50 p-3 rounded-xl overflow-x-auto text-slate-600 font-mono">
                  {JSON.stringify(log.new_values, null, 2)}
                </pre>
              )}
            </div>
          )) : (
            <div className="p-12 text-center text-slate-400">
              <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-sm font-medium">ไม่มีประวัติการทำรายการ</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

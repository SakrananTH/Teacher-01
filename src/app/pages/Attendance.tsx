import { useState, useEffect } from "react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { api } from "../api";
import { toast } from "sonner";
import {
  Calendar,
  ClipboardCheck,
  AlertTriangle,
  Save,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  FileText
} from "lucide-react";
import { motion } from "motion/react";

interface Student {
  id: string;
  number: number;
  name: string;
  classRoom?: string;
}

type Status = "present" | "late" | "absent" | "leave";

export function Attendance() {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, Status>>({});
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedClass, setSelectedClass] = useState<string>("ป.1");

  useEffect(() => {
    fetchData(selectedDate);
  }, [selectedDate]);

  const fetchData = async (date: string) => {
    setIsLoading(true);
    try {
      const [studentsData, attendanceData] = await Promise.all([
        api.getStudents(),
        api.getAttendance(date),
      ]);
      setStudents(studentsData);
      const initialRecord: Record<string, Status> = {};
      studentsData.forEach((s: Student) => {
        initialRecord[s.id] = attendanceData[s.id] || "present";
      });
      setAttendance(initialRecord);
    } catch (error: any) {
      toast.error("โหลดข้อมูลล้มเหลว", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = (studentId: string, status: Status) => {
    setAttendance((prev) => ({ ...prev, [studentId]: status }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.saveAttendance(selectedDate, attendance);
      toast.success("บันทึกข้อมูลการมาเรียนสำเร็จ!");
    } catch (error: any) {
      toast.error("บันทึกล้มเหลว", { description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredStudents = students.filter(
    (s) => selectedClass === "" || (s.classRoom || "ป.1") === selectedClass
  );

  const stats = {
    total: filteredStudents.length,
    present: filteredStudents.filter((s) => attendance[s.id] === "present").length,
    late: filteredStudents.filter((s) => attendance[s.id] === "late").length,
    absent: filteredStudents.filter((s) => attendance[s.id] === "absent").length,
    leave: filteredStudents.filter((s) => attendance[s.id] === "leave").length,
  };

  const displayDate = selectedDate
    ? format(new Date(selectedDate + "T00:00:00"), "d MMMM yyyy", { locale: th })
    : "";

  const ALL_CLASSES = ["ป.1", "ป.2", "ป.3", "ป.4", "ป.5", "ป.6"];
  const uniqueClasses = ALL_CLASSES; // เอา ทั้งหมด ออก

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
            <ClipboardCheck size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">ระบบเช็คชื่อ</h1>
            <p className="text-slate-400 text-sm">{displayDate}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 w-full sm:w-48 flex items-center focus-within:ring-4 focus-within:ring-emerald-500/10 focus-within:border-emerald-400 transition-all">
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              title="กรองตามห้องเรียน"
              className="w-full bg-transparent border-none outline-none text-slate-700 font-medium text-sm cursor-pointer"
            >
              {uniqueClasses.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 focus-within:ring-4 focus-within:ring-emerald-500/10 focus-within:border-emerald-400 transition-all w-full sm:w-auto">
            <Calendar size={16} className="text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              title="เลือกวันที่เช็คชื่อ"
              className="border-none bg-transparent outline-none text-slate-700 font-medium cursor-pointer text-sm w-full"
            />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "ทั้งหมด", value: stats.total, icon: Users, color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-100" },
          { label: "มาเรียน", value: stats.present, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
          { label: "มาสาย", value: stats.late, icon: Clock, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
          { label: "ลา", value: stats.leave, icon: FileText, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
          { label: "ขาดเรียน", value: stats.absent, icon: XCircle, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100" },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`${s.bg} border ${s.border} rounded-xl p-4 flex items-center gap-3`}
            >
              <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center ${s.color}`}>
                <Icon size={18} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
                <p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center animate-pulse">
              <ClipboardCheck className="text-emerald-500" size={20} />
            </div>
            <p className="text-slate-400 font-medium text-sm">กำลังโหลดข้อมูล...</p>
          </div>
        </div>
      ) : students.length === 0 ? (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-10 text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center mb-4">
            <AlertTriangle className="text-blue-500" size={28} />
          </div>
          <h3 className="text-lg font-bold text-blue-800 mb-1">ยังไม่มีรายชื่อนักเรียน</h3>
          <p className="text-blue-600/70 text-sm">กรุณาไปที่เมนู "จัดการนักเรียน" เพื่อเพิ่มรายชื่อก่อน</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          {/* Mobile Cards / Desktop Table */}
          <div className="hidden md:block">
            <table className="min-w-full divide-y divide-slate-100">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider w-20">
                    เลขที่
                  </th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    ชื่อ-นามสกุล
                  </th>
                  <th className="px-6 py-3.5 text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider w-72">
                    สถานะ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-blue-50/20 transition-colors group">
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-600 text-sm font-bold group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
                        {student.number}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-700 font-medium">
                      {student.name} <span className="text-slate-400 text-xs ml-2">({student.classRoom || "ทั่วไป"})</span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex bg-slate-100/80 p-1 rounded-xl max-w-[300px] mx-auto">
                        {(["present", "late", "leave", "absent"] as Status[]).map((status) => {
                          const isActive = attendance[student.id] === status;
                          const config = {
                            present: { label: "มา", activeClass: "bg-emerald-500 text-white" },
                            late: { label: "สาย", activeClass: "bg-amber-500 text-white" },
                            leave: { label: "ลา", activeClass: "bg-blue-500 text-white" },
                            absent: { label: "ขาด", activeClass: "bg-rose-500 text-white" },
                          };
                          return (
                            <button
                              key={status}
                              onClick={() => handleStatusChange(student.id, status)}
                              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                                isActive ? config[status].activeClass : "text-slate-400 hover:bg-slate-200/50"
                              }`}
                            >
                              {config[status].label}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile View */}
          <div className="md:hidden divide-y divide-slate-50">
            {filteredStudents.map((student) => (
              <div key={student.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-600 text-sm font-bold">
                      {student.number}
                    </span>
                    <span className="text-sm text-slate-700 font-medium">{student.name}</span>
                  </div>
                  <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-md">{student.classRoom || "ทั่วไป"}</span>
                </div>
                <div className="flex bg-slate-100/80 p-1 rounded-xl">
                  {(["present", "late", "leave", "absent"] as Status[]).map((status) => {
                    const isActive = attendance[student.id] === status;
                    const config = {
                      present: { label: "มาเรียน", activeClass: "bg-emerald-500 text-white" },
                      late: { label: "มาสาย", activeClass: "bg-amber-500 text-white" },
                      leave: { label: "ลา", activeClass: "bg-blue-500 text-white" },
                      absent: { label: "ขาดเรียน", activeClass: "bg-rose-500 text-white" },
                    };
                    return (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(student.id, status)}
                        className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${
                          isActive ? config[status].activeClass : "text-slate-400"
                        }`}
                      >
                        {config[status].label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="bg-slate-50/80 px-6 py-4 border-t border-slate-100 flex justify-end">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2 text-sm"
            >
              <Save size={16} />
              {isSaving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

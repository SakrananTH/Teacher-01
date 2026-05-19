import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { GlassWater, Calendar, Loader2, Save, Search, CheckCircle2, XCircle, UserMinus } from "lucide-react";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

interface Student {
  id: string;
  student_no: number;
  full_name: string;
  classroom_id: string;
}

export type MilkStatus = 'drank' | 'not_drank' | 'absent' | 'none';

interface MilkRecord {
  id: string;
  student_id: string;
  status: MilkStatus;
  note: string;
}

const getStatusConfig = (status: MilkStatus) => {
  switch (status) {
    case "drank":
      return { label: "ดื่มแล้ว", bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200", icon: CheckCircle2 };
    case "not_drank":
      return { label: "ไม่ดื่ม", bg: "bg-rose-100", text: "text-rose-700", border: "border-rose-200", icon: XCircle };
    case "absent":
      return { label: "ขาดเรียน", bg: "bg-slate-200", text: "text-slate-600", border: "border-slate-300", icon: UserMinus };
    default:
      return { label: "ยังไม่ระบุ", bg: "bg-slate-50", text: "text-slate-400", border: "border-slate-200", icon: undefined };
  }
};

const formatThaiDate = (dateStr: string) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `วัน${format(d, "EEEE", { locale: th })}ที่ ${format(d, "d MMMM", { locale: th })} ${d.getFullYear() + 543}`;
};

export function MilkTracking() {
  const { user } = useAuth();
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<Record<string, MilkRecord>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchStudentsAndRecords = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select("*")
        .eq("status", "active")
        .order("student_no", { ascending: true });

      if (studentsError) throw studentsError;
      setStudents(studentsData || []);

      const { data: recordsData, error: recordsError } = await supabase
        .from("milk_records")
        .select("*")
        .eq("record_date", date);

      if (recordsError) throw recordsError;

      const recordsMap: Record<string, MilkRecord> = {};
      recordsData?.forEach((record) => {
        // Handle migration from boolean is_drunk to string status gracefully if data hasn't been migrated
        let status: MilkStatus = 'none';
        if (record.status) {
          status = record.status as MilkStatus;
        } else if (record.is_drunk !== undefined) {
          status = record.is_drunk ? 'drank' : 'none';
        }

        recordsMap[record.student_id] = {
          id: record.id,
          student_id: record.student_id,
          status,
          note: record.note || "",
        };
      });
      setRecords(recordsMap);
    } catch (error: any) {
      console.error(error);
      toast.error("ดึงข้อมูลล้มเหลว: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentsAndRecords();
  }, [user, date]);

  const handleStatusChange = (studentId: string, status: MilkStatus) => {
    setRecords((prev) => {
      const existing = prev[studentId] || { id: "", student_id: studentId, status: "none", note: "" };
      return {
        ...prev,
        [studentId]: { ...existing, status },
      };
    });
  };

  const handleNoteChange = (studentId: string, note: string) => {
    setRecords((prev) => {
      const existing = prev[studentId] || { id: "", student_id: studentId, status: "none", note: "" };
      return {
        ...prev,
        [studentId]: { ...existing, note },
      };
    });
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const validRecords = Object.values(records).filter(
        (record) => record.status !== 'none' || record.note !== ''
      );

      const toUpdate = validRecords.filter(r => r.id).map(record => ({
        id: record.id,
        owner_user_id: user.id,
        student_id: record.student_id,
        record_date: date,
        is_drunk: record.status === 'drank',
        status: record.status,
        note: record.note,
      }));

      const toInsert = validRecords.filter(r => !r.id).map(record => ({
        owner_user_id: user.id,
        student_id: record.student_id,
        record_date: date,
        is_drunk: record.status === 'drank',
        status: record.status,
        note: record.note,
      }));

      if (toUpdate.length > 0) {
        const { error } = await supabase
          .from("milk_records")
          .upsert(toUpdate, { onConflict: "id" });

        if (error) throw error;
      }

      if (toInsert.length > 0) {
        const { error } = await supabase
          .from("milk_records")
          .insert(toInsert);

        if (error) throw error;
      }

      if (toUpdate.length > 0 || toInsert.length > 0) {
        toast.success("บันทึกข้อมูลดื่มนมสำเร็จ");
        await fetchStudentsAndRecords();
      } else {
        toast.info("ไม่มีข้อมูลให้บันทึก");
      }
    } catch (error: any) {
      console.error(error);
      toast.error("บันทึกข้อมูลล้มเหลว: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.student_no.toString().includes(searchQuery)
  );

  // Calculate summaries
  const totalStudents = students.length;
  const drankCount = Object.values(records).filter(r => r.status === 'drank').length;
  const notDrankCount = Object.values(records).filter(r => r.status === 'not_drank').length;
  const absentCount = Object.values(records).filter(r => r.status === 'absent').length;
  const pendingCount = totalStudents - drankCount - notDrankCount - absentCount;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <GlassWater className="text-sky-500" />
            ระบบบันทึกการดื่มนม
          </h1>
          <p className="text-slate-500 mt-1">บันทึกการดื่มนมของนักเรียนในแต่ละวัน</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm w-full sm:w-auto">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sky-50 text-sky-600">
            <Calendar size={20} />
          </div>
          <div className="flex-1 sm:pr-4">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">วันที่บันทึก</p>
            <div className="relative">
              <span className="font-bold text-slate-700 block">{formatThaiDate(date)}</span>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Summary Dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <p className="text-sm font-bold text-slate-500 mb-1">นักเรียนทั้งหมด</p>
          <p className="text-2xl font-bold text-slate-800">{totalStudents} <span className="text-sm font-medium text-slate-500">คน</span></p>
        </div>
        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 shadow-sm flex flex-col justify-center">
          <p className="text-sm font-bold text-emerald-600 mb-1 flex items-center gap-1"><CheckCircle2 size={16} /> ดื่มแล้ว</p>
          <p className="text-2xl font-bold text-emerald-700">{drankCount} <span className="text-sm font-medium text-emerald-600/70">คน</span></p>
        </div>
        <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 shadow-sm flex flex-col justify-center">
          <p className="text-sm font-bold text-rose-600 mb-1 flex items-center gap-1"><XCircle size={16} /> ไม่ดื่ม</p>
          <p className="text-2xl font-bold text-rose-700">{notDrankCount} <span className="text-sm font-medium text-rose-600/70">คน</span></p>
        </div>
        <div className="bg-slate-100 p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <p className="text-sm font-bold text-slate-600 mb-1 flex items-center gap-1"><UserMinus size={16} /> ขาดเรียน</p>
          <p className="text-2xl font-bold text-slate-700">{absentCount} <span className="text-sm font-medium text-slate-500">คน</span></p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col relative">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input
              placeholder="ค้นหาชื่อ หรือเลขที่..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white"
            />
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto bg-sky-600 hover:bg-sky-700 hidden sm:flex">
            {saving ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Save size={18} className="mr-2" />}
            บันทึกข้อมูล
          </Button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-sky-500" />
              <p>กำลังโหลดข้อมูล...</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
                  <th className="py-4 px-4 font-semibold w-16 text-center">เลขที่</th>
                  <th className="py-4 px-4 font-semibold w-64">ชื่อ-นามสกุล</th>
                  <th className="py-4 px-4 font-semibold w-[320px] text-center">สถานะการดื่มนม</th>
                  <th className="py-4 px-4 font-semibold">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((student) => {
                    const record = records[student.id];
                    const status = record?.status || 'none';

                    return (
                      <tr key={student.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 text-slate-500 font-medium text-center">{student.student_no}</td>
                        <td className="py-3 px-4 text-slate-800 font-medium whitespace-nowrap">{student.full_name}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleStatusChange(student.id, 'drank')}
                              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-all border ${
                                status === 'drank' 
                                  ? 'bg-emerald-100 text-emerald-700 border-emerald-300 shadow-sm' 
                                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <CheckCircle2 size={16} /> ดื่ม
                            </button>
                            <button
                              onClick={() => handleStatusChange(student.id, 'not_drank')}
                              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-all border ${
                                status === 'not_drank' 
                                  ? 'bg-rose-100 text-rose-700 border-rose-300 shadow-sm' 
                                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <XCircle size={16} /> ไม่ดื่ม
                            </button>
                            <button
                              onClick={() => handleStatusChange(student.id, 'absent')}
                              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-all border ${
                                status === 'absent' 
                                  ? 'bg-slate-200 text-slate-700 border-slate-400 shadow-sm' 
                                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <UserMinus size={16} /> ขาด
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Input
                            placeholder="เพิ่มหมายเหตุ..."
                            value={record?.note || ""}
                            onChange={(e) => handleNoteChange(student.id, e.target.value)}
                            className="bg-transparent border-slate-200 focus:bg-white h-10 text-sm"
                          />
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-500">
                      ไม่พบข้อมูลนักเรียน
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        
        {/* Bottom Save Button - Sticky to bottom of table container */}
        <div className="sticky bottom-0 left-0 right-0 p-4 border-t border-slate-200 bg-white/90 backdrop-blur-sm flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto bg-sky-600 hover:bg-sky-700 shadow-md h-11 px-8">
            {saving ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Save size={18} className="mr-2" />}
            <span className="font-bold">บันทึกข้อมูลทั้งหมด</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { Activity, Calendar, Loader2, Save, Search, User, Ruler } from "lucide-react";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

interface Student {
  id: string;
  student_no: number;
  full_name: string;
  classroom_id: string;
}

interface HealthRecord {
  id: string;
  student_id: string;
  height_cm: number | "";
  weight_kg: number | "";
  note: string;
}

const calculateBMI = (heightCm: number | "", weightKg: number | ""): number | null => {
  if (!heightCm || !weightKg) return null;
  const heightM = Number(heightCm) / 100;
  const weight = Number(weightKg);
  if (heightM <= 0 || weight <= 0) return null;
  return Number((weight / (heightM * heightM)).toFixed(2));
};

const getBMIStatus = (bmi: number | null): { text: string; color: string } => {
  if (bmi === null) return { text: "-", color: "text-slate-400" };
  if (bmi < 18.5) return { text: "น้ำหนักน้อย", color: "text-blue-500 font-medium" };
  if (bmi >= 18.5 && bmi <= 22.9) return { text: "ปกติ", color: "text-emerald-500 font-bold" };
  if (bmi >= 23 && bmi <= 24.9) return { text: "ท้วม", color: "text-amber-500 font-medium" };
  if (bmi >= 25 && bmi <= 29.9) return { text: "อ้วน", color: "text-orange-500 font-bold" };
  return { text: "อ้วนมาก", color: "text-rose-600 font-bold" };
};

const getCompletionStatus = (heightCm: number | "", weightKg: number | ""): { label: string; badgeClass: string } => {
  if (heightCm === "" && weightKg === "") return { label: "ยังไม่ได้กรอก", badgeClass: "bg-slate-100 text-slate-500" };
  if (heightCm !== "" && weightKg !== "") return { label: "กรอกแล้ว", badgeClass: "bg-emerald-100 text-emerald-700" };
  return { label: "ข้อมูลไม่ครบ", badgeClass: "bg-amber-100 text-amber-700" };
};

const formatThaiDate = (dateStr: string) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
};

export function HealthMeasurements() {
  const { user } = useAuth();
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<Record<string, HealthRecord>>({});
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
        .from("health_measurements")
        .select("*")
        .eq("record_date", date);

      if (recordsError) throw recordsError;

      const recordsMap: Record<string, HealthRecord> = {};
      recordsData?.forEach((record) => {
        recordsMap[record.student_id] = {
          id: record.id,
          student_id: record.student_id,
          height_cm: record.height_cm || "",
          weight_kg: record.weight_kg || "",
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

  const handleRecordChange = (studentId: string, field: keyof HealthRecord, value: any) => {
    setRecords((prev) => {
      const existing = prev[studentId] || { id: "", student_id: studentId, height_cm: "", weight_kg: "", note: "" };
      return {
        ...prev,
        [studentId]: { ...existing, [field]: value },
      };
    });
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const upsertData = Object.values(records)
        .filter(record => record.height_cm !== "" || record.weight_kg !== "" || record.note !== "")
        .map((record) => ({
          ...(record.id ? { id: record.id } : {}),
          owner_user_id: user.id,
          student_id: record.student_id,
          record_date: date,
          height_cm: record.height_cm === "" ? null : Number(record.height_cm),
          weight_kg: record.weight_kg === "" ? null : Number(record.weight_kg),
          note: record.note,
        }));

      if (upsertData.length > 0) {
        // Since we don't have a unique constraint on (owner, student, date) in health_measurements,
        // we'll update if we have ID, else insert.
        const inserts = upsertData.filter(d => !d.id);
        const updates = upsertData.filter(d => d.id);
        
        if (inserts.length > 0) {
           const { error: insertErr } = await supabase.from("health_measurements").insert(inserts);
           if (insertErr) throw insertErr;
        }

        for (const update of updates) {
           const { error: updateErr } = await supabase.from("health_measurements").update({
             height_cm: update.height_cm,
             weight_kg: update.weight_kg,
             note: update.note
           }).eq("id", update.id);
           if (updateErr) throw updateErr;
        }

        toast.success("บันทึกข้อมูลส่วนสูง-น้ำหนักสำเร็จ");
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

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Activity className="text-rose-500" />
            ระบบวัดส่วนสูง-น้ำหนัก
          </h1>
          <p className="text-slate-500 mt-1">บันทึกข้อมูลสุขภาพของนักเรียน</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm w-full sm:w-auto">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-50 text-rose-600">
            <Calendar size={20} />
          </div>
          <div className="flex-1 sm:pr-4">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">วันที่บันทึก</p>
            <div className="relative">
              <span className="font-bold text-slate-700 block">{formatThaiDate(date)}</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full"
              />
            </div>
          </div>
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
          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 hidden sm:flex">
            {saving ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Save size={18} className="mr-2" />}
            บันทึกข้อมูล
          </Button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-rose-500" />
              <p>กำลังโหลดข้อมูล...</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
                  <th className="py-4 px-4 font-semibold w-16 text-center">เลขที่</th>
                  <th className="py-4 px-4 font-semibold w-48">ชื่อ-นามสกุล</th>
                  <th className="py-4 px-4 font-semibold w-28 text-center">สถานะ</th>
                  <th className="py-4 px-4 font-semibold w-36">ส่วนสูง</th>
                  <th className="py-4 px-4 font-semibold w-36">น้ำหนัก</th>
                  <th className="py-4 px-4 font-semibold w-20 text-center">BMI</th>
                  <th className="py-4 px-4 font-semibold w-28 text-center">แปลผล</th>
                  <th className="py-4 px-4 font-semibold min-w-[120px]">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((student) => {
                    const record = records[student.id];
                    const h = record?.height_cm ?? "";
                    const w = record?.weight_kg ?? "";
                    const status = getCompletionStatus(h, w);
                    const bmi = calculateBMI(h, w);
                    const bmiStatus = getBMIStatus(bmi);

                    return (
                      <tr key={student.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 text-slate-500 font-medium text-center">{student.student_no}</td>
                        <td className="py-3 px-4 text-slate-800 font-medium whitespace-nowrap">{student.full_name}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center px-2 py-1 rounded-md text-[11px] font-bold ${status.badgeClass}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              step="0.1"
                              placeholder="เช่น 120"
                              value={h}
                              onChange={(e) => handleRecordChange(student.id, "height_cm", e.target.value)}
                              className="w-20 text-center bg-transparent border-slate-200 focus:bg-white h-9 font-medium"
                            />
                            <span className="text-sm text-slate-500 font-medium">ซม.</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              step="0.1"
                              placeholder="เช่น 25.5"
                              value={w}
                              onChange={(e) => handleRecordChange(student.id, "weight_kg", e.target.value)}
                              className="w-20 text-center bg-transparent border-slate-200 focus:bg-white h-9 font-medium"
                            />
                            <span className="text-sm text-slate-500 font-medium">กก.</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="font-bold text-slate-700 text-sm">{bmi !== null ? bmi : "-"}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`text-[13px] ${bmiStatus.color}`}>{bmiStatus.text}</span>
                        </td>
                        <td className="py-3 px-4">
                          <Input
                            placeholder="เพิ่มหมายเหตุ..."
                            value={record?.note || ""}
                            onChange={(e) => handleRecordChange(student.id, "note", e.target.value)}
                            className="bg-transparent border-slate-200 focus:bg-white h-9 text-sm w-full min-w-[120px]"
                          />
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
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
          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 shadow-md h-11 px-8">
            {saving ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Save size={18} className="mr-2" />}
            <span className="font-bold">บันทึกข้อมูลทั้งหมด</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

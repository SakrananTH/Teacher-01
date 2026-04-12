import { useState, useEffect } from "react";
import { api } from "../api";
import { toast } from "sonner";
import { Trash2, Plus, Users, X, Search, UserRound, Hash, Edit2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Student {
  id: string;
  number: number;
  name: string;
  classRoom?: string;
}

export function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<{ id: string; name: string } | null>(null);
  const [studentForm, setStudentForm] = useState<{ id?: string; number: string; prefix: string; name: string; classRoom: string }>({ number: "", prefix: "ด.ช.", name: "", classRoom: "" });
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState<string>("ป.1");

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const data = await api.getStudents();
      setStudents(data);
    } catch (error: any) {
      toast.error("ดึงข้อมูลนักเรียนล้มเหลว", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.name || !studentForm.number) return;

    try {
      const trimmedName = studentForm.name.trim();
      const fullName = studentForm.prefix ? `${studentForm.prefix}${trimmedName}` : trimmedName;

      const student = await api.addStudent({
        id: studentForm.id,
        name: fullName,
        number: parseInt(studentForm.number, 10),
        classRoom: studentForm.classRoom || "ป.1"
      });

      if (studentForm.id) {
        setStudents(students.map(s => s.id === student.id ? student : s).sort((a, b) => a.number - b.number));
        toast.success("แก้ไขนักเรียนสำเร็จ");
      } else {
        setStudents([...students, student].sort((a, b) => a.number - b.number));
        toast.success("เพิ่มนักเรียนสำเร็จ");
      }
      
      setStudentForm({ number: "", prefix: "ด.ช.", name: "", classRoom: selectedClass || "ป.1" });
      setIsAdding(false);
    } catch (error: any) {
      toast.error(studentForm.id ? "ไม่สามารถแก้ไขนักเรียนได้" : "ไม่สามารถเพิ่มนักเรียนได้", { description: error.message });
    }
  };

  const handleEdit = (student: Student) => {
    let prefix = "";
    let rawName = student.name;
    const prefixes = ["ด.ช.", "ด.ญ."];
    
    for (const p of prefixes) {
      if (rawName.startsWith(p)) {
        prefix = p;
        rawName = rawName.substring(p.length).trim();
        break;
      }
    }

    setStudentForm({ 
      id: student.id, 
      number: student.number.toString(), 
      prefix: prefix, 
      name: rawName, 
      classRoom: student.classRoom || "" 
    });
    setIsAdding(true);
  };

  const handleDelete = (id: string, name: string) => {
    setStudentToDelete({ id, name });
  };

  const executeDelete = async () => {
    if (!studentToDelete) return;
    
    try {
      await api.deleteStudent(studentToDelete.id);
      setStudents(students.filter((s) => s.id !== studentToDelete.id));
      toast.success("ลบนักเรียนสำเร็จ");
      setStudentToDelete(null);
    } catch (error: any) {
      toast.error("ไม่สามารถลบนักเรียนได้", { description: error.message });
      setStudentToDelete(null);
    }
  };

  const ALL_CLASSES = ["ป.1", "ป.2", "ป.3", "ป.4", "ป.5", "ป.6"];
  const uniqueClasses = ALL_CLASSES; // ลบ "ทั้งหมด" ออกตามที่คุณต้องการ

  const filtered = students.filter(
    (s) => {
      const matchSearch = s.name.includes(search) || s.number.toString() === search;
      const matchClass = selectedClass === "" || (s.classRoom || "ป.1") === selectedClass;
      return matchSearch && matchClass;
    }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center animate-pulse">
            <Users className="text-violet-500" size={20} />
          </div>
          <p className="text-slate-400 font-medium text-sm">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600">
            <Users size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">จัดการนักเรียน</h1>
            <p className="text-slate-400 text-sm">ทั้งหมด {students.length} คน</p>
          </div>
        </div>
        <button
          onClick={() => {
            setIsAdding(!isAdding);
            if (isAdding) setStudentForm({ ...studentForm, classRoom: selectedClass || "ป.1" });
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
            isAdding
              ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {isAdding ? (
            <>
              <X size={16} /> ยกเลิก
            </>
          ) : (
            <>
              <Plus size={16} /> เพิ่มนักเรียน
            </>
          )}
        </button>
      </div>

      {/* Add Form */}
      <AnimatePresence>
        {isAdding && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAddStudent}
            className="overflow-hidden"
          >
            <div className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                  เลขที่
                </label>
                <div className="relative">
                  <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input
                    type="number"
                    min="1"
                    required
                    value={studentForm.number}
                    onChange={(e) => setStudentForm({ ...studentForm, number: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl h-11 pl-9 pr-3 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-slate-700 font-medium bg-slate-50 focus:bg-white"
                    placeholder="เช่น 1"
                  />
                </div>
              </div>
              <div className="flex-1 w-full">
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                  ชั้น/ห้องเรียน
                </label>
                <div className="relative">
                  <Users size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                  <select
                    required
                    title="เลือกระดับชั้น"
                    aria-label="เลือกระดับชั้น"
                    value={studentForm.classRoom || "ป.1"}
                    onChange={(e) => setStudentForm({ ...studentForm, classRoom: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl h-11 pl-9 pr-3 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-slate-700 font-medium bg-slate-50 focus:bg-white cursor-pointer"
                  >
                    <option value="" disabled hidden>เลือกระดับชั้น</option>
                    <option value="ป.1">ป.1</option>
                    <option value="ป.2">ป.2</option>
                    <option value="ป.3">ป.3</option>
                    <option value="ป.4">ป.4</option>
                    <option value="ป.5">ป.5</option>
                    <option value="ป.6">ป.6</option>
                  </select>
                </div>
              </div>
              <div className="flex-[2] w-full">
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                  ชื่อ - นามสกุล
                </label>
                <div className="flex gap-2">
                  <select
                    title="คำนำหน้า"
                    value={studentForm.prefix}
                    onChange={(e) => setStudentForm({ ...studentForm, prefix: e.target.value })}
                    className="w-24 border border-slate-200 rounded-xl h-11 px-2 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-slate-700 font-medium bg-slate-50 focus:bg-white cursor-pointer"
                  >
                    <option value="">(ไม่มี)</option>
                    <option value="ด.ช.">ด.ช.</option>
                    <option value="ด.ญ.">ด.ญ.</option>
                  </select>
                  <div className="relative flex-1">
                    <UserRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input
                      type="text"
                      required
                      value={studentForm.name}
                      onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl h-11 pl-9 pr-3 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-slate-700 font-medium bg-slate-50 focus:bg-white"
                      placeholder="ชื่อ-นามสกุล ของนักเรียน"
                    />
                  </div>
                </div>
              </div>
              <button
                type="submit"
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 h-11 rounded-xl font-semibold transition-all w-full md:w-auto whitespace-nowrap"
              >
                {studentForm.id ? "บันทึกการแก้ไข" : "บันทึก"}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 flex-1 focus-within:ring-4 focus-within:ring-blue-500/10 focus-within:border-blue-400 transition-all">
          <Search size={18} className="text-slate-300" />
          <input
            type="text"
            placeholder="ค้นหาชื่อ หรือเลขที่..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-none bg-transparent outline-none text-slate-700 font-medium flex-1 w-full placeholder:text-slate-300 text-sm"
          />
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 w-full sm:w-48 flex items-center focus-within:ring-4 focus-within:ring-blue-500/10 focus-within:border-blue-400 transition-all">
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
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-100">
          <thead>
            <tr className="bg-slate-50/80">
              <th className="px-6 py-3.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider w-24">
                เลขที่
              </th>
              <th className="px-6 py-3.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider w-32">
                ชั้น/ห้อง
              </th>
              <th className="px-6 py-3.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                ชื่อ-นามสกุล
              </th>
              <th className="px-6 py-3.5 text-right text-[11px] font-bold text-slate-400 uppercase tracking-wider w-24">
                จัดการ
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center">
                      <Users className="text-slate-300" size={28} />
                    </div>
                    <p className="text-slate-400 text-sm font-medium">
                      {search ? "ไม่พบนักเรียนที่ค้นหา" : "ยังไม่มีข้อมูลนักเรียน กรุณาเพิ่มนักเรียน"}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((student, i) => (
                <motion.tr
                  key={student.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="hover:bg-blue-50/30 transition-colors group"
                >
                  <td className="px-6 py-3.5 whitespace-nowrap">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-600 text-sm font-bold group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                      {student.number}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 whitespace-nowrap text-sm text-slate-600 font-medium">
                    {student.classRoom || "ทั่วไป"}
                  </td>
                  <td className="px-6 py-3.5 whitespace-nowrap text-sm text-slate-700 font-medium">
                    {student.name}
                  </td>
                  <td className="px-6 py-3.5 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(student)}
                        className="text-blue-500 hover:text-blue-600 bg-blue-50 hover:bg-blue-100 p-2 rounded-lg transition-all"
                        title="แก้ไขข้อมูลนักเรียน"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(student.id, student.name)}
                        className="text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition-all"
                        title="ลบนักเรียน"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {studentToDelete && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 transition-all"
              onClick={() => setStudentToDelete(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm bg-white rounded-3xl p-6 shadow-2xl z-50 border border-slate-100 flex flex-col"
            >
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-5 mx-auto">
                <Trash2 size={32} strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-bold text-center text-slate-800 mb-2">
                ลบรายชื่อนักเรียน
              </h3>
              <p className="text-center text-slate-500 mb-8 text-sm px-2">
                คุณแน่ใจหรือไม่ว่าต้องการลบ <span className="font-bold text-slate-700">{studentToDelete.name}</span> ? ข้อมูลนักเรียนคนนี้จะถูกลบออกจากระบบและไม่สามารถกู้คืนได้
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setStudentToDelete(null)}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={executeDelete}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-red-500 hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
                >
                  <Trash2 size={18} /> ยืนยันลบ
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { api } from "../api";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  FileText,
  Filter,
  Info,
  MessageSquare,
  Printer,
  RotateCcw,
  Save,
  Search,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { motion } from "motion/react";

interface Student {
  id: string;
  number: number;
  name: string;
  classRoom?: string;
}

interface AttendanceSummaryItem {
  present: number;
  late: number;
  leave: number;
  absent: number;
  total: number;
  lastRecordedDate?: string;
}

type PersistedStatus = "present" | "late" | "leave" | "absent";
type AttendanceStatus = PersistedStatus | "unchecked";
type StatusFilter = AttendanceStatus | "all";
type LeaveType = "none" | "sick" | "personal" | "other";

interface AttendanceRecordResponse {
  status: PersistedStatus;
  note?: string | null;
}

interface AttendanceDraft {
  status: AttendanceStatus;
  note: string;
  leaveType: LeaveType;
}

interface ClassOption {
  value: string;
  label: string;
  count: number;
}

const EMPTY_SUMMARY: AttendanceSummaryItem = {
  present: 0,
  late: 0,
  leave: 0,
  absent: 0,
  total: 0,
};

const ALL_CLASSES = ["ป.1", "ป.2", "ป.3", "ป.4", "ป.5", "ป.6"];
const STATUS_ORDER: AttendanceStatus[] = ["unchecked", "present", "late", "leave", "absent"];
const NOTE_TEMPLATES = ["ผู้ปกครองแจ้งแล้ว", "ไม่มีใบลา", "กลับก่อนเวลา", "รถติด", "แจ้งเหตุผลแล้ว"];
const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  none: "ยังไม่ระบุ",
  sick: "ลาป่วย",
  personal: "ลากิจ",
  other: "ลาอื่น ๆ",
};
const STATUS_META: Record<AttendanceStatus, { label: string; buttonLabel: string; badgeClass: string; activeClass: string; inactiveClass: string }> = {
  unchecked: {
    label: "ยังไม่ได้เช็ค",
    buttonLabel: "ยังไม่ได้เช็ค",
    badgeClass: "border-slate-200 bg-slate-100 text-slate-600",
    activeClass: "border-slate-500 bg-slate-600 text-white shadow-sm",
    inactiveClass: "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50",
  },
  present: {
    label: "มา",
    buttonLabel: "มา",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    activeClass: "border-emerald-500 bg-emerald-500 text-white shadow-sm",
    inactiveClass: "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50",
  },
  late: {
    label: "สาย",
    buttonLabel: "สาย",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
    activeClass: "border-amber-500 bg-amber-500 text-white shadow-sm",
    inactiveClass: "border-amber-200 bg-white text-amber-700 hover:bg-amber-50",
  },
  leave: {
    label: "ลา",
    buttonLabel: "ลา",
    badgeClass: "border-sky-200 bg-sky-50 text-sky-700",
    activeClass: "border-sky-500 bg-sky-500 text-white shadow-sm",
    inactiveClass: "border-sky-200 bg-white text-sky-700 hover:bg-sky-50",
  },
  absent: {
    label: "ขาด",
    buttonLabel: "ขาด",
    badgeClass: "border-rose-200 bg-rose-50 text-rose-700",
    activeClass: "border-rose-500 bg-rose-500 text-white shadow-sm",
    inactiveClass: "border-rose-200 bg-white text-rose-700 hover:bg-rose-50",
  },
};

function createEmptyDraft(): AttendanceDraft {
  return { status: "unchecked", note: "", leaveType: "none" };
}

function normalizePersistedStatus(status: string | undefined): PersistedStatus | null {
  if (status === "present" || status === "late" || status === "leave" || status === "absent") {
    return status;
  }

  return null;
}

function parseStoredNote(note?: string | null) {
  const trimmed = (note || "").trim();
  const matched = trimmed.match(/^\[leave:(sick|personal|other)\]\s*/);

  if (!matched) {
    return { leaveType: "none" as LeaveType, note: trimmed };
  }

  return {
    leaveType: matched[1] as LeaveType,
    note: trimmed.replace(matched[0], "").trim(),
  };
}

function serializeNote(draft: AttendanceDraft) {
  const trimmedNote = draft.note.trim();

  if (draft.status !== "leave") {
    return trimmedNote;
  }

  if (draft.leaveType === "none") {
    return trimmedNote;
  }

  const prefix = `[leave:${draft.leaveType}]`;
  return trimmedNote ? `${prefix} ${trimmedNote}` : prefix;
}

function createDraftFromRecord(record?: AttendanceRecordResponse | PersistedStatus | null): AttendanceDraft {
  if (!record) {
    return createEmptyDraft();
  }

  if (typeof record === "string") {
    return { status: record, note: "", leaveType: "none" };
  }

  const status = normalizePersistedStatus(record.status) || "unchecked";
  const parsedNote = parseStoredNote(record.note);

  return {
    status,
    note: parsedNote.note,
    leaveType: status === "leave" ? parsedNote.leaveType : "none",
  };
}

function formatThaiFullDate(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`);
  return `วัน${format(date, "EEEE", { locale: th })}ที่ ${format(date, "d MMMM", { locale: th })} ${date.getFullYear() + 543}`;
}

function formatThaiShortDate(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`);
  return `${format(date, "dd/MM", { locale: th })}/${date.getFullYear() + 543}`;
}

function formatThaiCompactDate(dateString?: string) {
  if (!dateString) {
    return "-";
  }

  const date = new Date(`${dateString}T00:00:00`);
  return `${format(date, "d MMM", { locale: th })} ${date.getFullYear() + 543}`;
}

function serializeDraft(draft: AttendanceDraft) {
  return JSON.stringify({
    status: draft.status,
    note: draft.note.trim(),
    leaveType: draft.status === "leave" ? draft.leaveType : "none",
  });
}

function buildGuardianMessage(dateLabel: string, students: Student[], records: Record<string, AttendanceDraft>) {
  const targetStudents = students.filter((student) => {
    const status = records[student.id]?.status || "unchecked";
    return status === "late" || status === "absent";
  });

  if (targetStudents.length === 0) {
    return "";
  }

  const lines = targetStudents.map((student) => {
    const draft = records[student.id] || createEmptyDraft();
    const suffix = draft.note.trim() ? ` (${draft.note.trim()})` : "";
    return `${student.number}. ${student.name} - ${STATUS_META[draft.status].label}${suffix}`;
  });

  return [
    `แจ้งผู้ปกครองประจำวันที่ ${dateLabel}`,
    "นักเรียนที่มาสายหรือขาดเรียนวันนี้",
    ...lines,
    "กรุณาติดต่อครูประจำชั้นเพื่อแจ้งเหตุผลเพิ่มเติม ขอบคุณครับ/ค่ะ",
  ].join("\n");
}

export function Attendance() {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceDraft>>({});
  const [savedAttendance, setSavedAttendance] = useState<Record<string, AttendanceDraft>>({});
  const [attendanceSummary, setAttendanceSummary] = useState<Record<string, AttendanceSummaryItem>>({});
  const [isSummaryAvailable, setIsSummaryAvailable] = useState(true);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedClass, setSelectedClass] = useState<string>("ป.1");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [noteStudent, setNoteStudent] = useState<Student | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [lastChange, setLastChange] = useState<{ studentId: string; previous: AttendanceDraft } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void fetchData(selectedDate);
  }, [selectedDate]);

  const fetchData = async (date: string) => {
    setIsLoading(true);
    try {
      const [studentsData, attendanceData] = await Promise.all([
        api.getStudents(),
        api.getAttendance(date),
      ]);

      const nextAttendance: Record<string, AttendanceDraft> = {};
      studentsData.forEach((student: Student) => {
        nextAttendance[student.id] = createDraftFromRecord(attendanceData[student.id]);
      });

      setStudents(studentsData);
      setAttendance(nextAttendance);
      setSavedAttendance(nextAttendance);
      setLastChange(null);

      try {
        const summaryData = await api.getAttendanceSummary();
        setAttendanceSummary(summaryData || {});
        setIsSummaryAvailable(true);
      } catch {
        setAttendanceSummary({});
        setIsSummaryAvailable(false);
      }
    } catch (error: any) {
      toast.error("โหลดข้อมูลล้มเหลว", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const classOptions = useMemo<ClassOption[]>(() => {
    const counts = students.reduce<Record<string, number>>((acc, student) => {
      const className = student.classRoom || "ทั่วไป";
      acc[className] = (acc[className] || 0) + 1;
      return acc;
    }, {});

    const orderedClasses = [
      ...ALL_CLASSES.filter((className) => counts[className]),
      ...Object.keys(counts).filter((className) => !ALL_CLASSES.includes(className)).sort(),
    ];

    return orderedClasses.map((className) => ({
      value: className,
      count: counts[className],
      label: `${className} - ${counts[className]} คน`,
    }));
  }, [students]);

  useEffect(() => {
    if (!classOptions.length) {
      return;
    }

    if (!classOptions.some((option) => option.value === selectedClass)) {
      setSelectedClass(classOptions[0].value);
    }
  }, [classOptions, selectedClass]);

  const classStudents = useMemo(
    () => students.filter((student) => (student.classRoom || "ทั่วไป") === selectedClass),
    [selectedClass, students],
  );

  const dailyStats = useMemo(() => {
    const counts = {
      total: classStudents.length,
      unchecked: 0,
      present: 0,
      late: 0,
      leave: 0,
      absent: 0,
    };

    classStudents.forEach((student) => {
      const status = attendance[student.id]?.status || "unchecked";
      counts[status] += 1;
    });

    return counts;
  }, [attendance, classStudents]);

  const filteredStudents = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return classStudents.filter((student) => {
      const draft = attendance[student.id] || createEmptyDraft();
      const matchesStatus = statusFilter === "all" ? true : draft.status === statusFilter;
      const matchesKeyword =
        keyword.length === 0 ||
        student.name.toLowerCase().includes(keyword) ||
        String(student.number).includes(keyword) ||
        student.id.toLowerCase().includes(keyword);

      return matchesStatus && matchesKeyword;
    });
  }, [attendance, classStudents, searchTerm, statusFilter]);

  const hasUnsavedChanges = useMemo(
    () => students.some((student) => serializeDraft(attendance[student.id] || createEmptyDraft()) !== serializeDraft(savedAttendance[student.id] || createEmptyDraft())),
    [attendance, savedAttendance, students],
  );

  const displayDate = selectedDate ? formatThaiFullDate(selectedDate) : "";
  const compactDate = selectedDate ? formatThaiShortDate(selectedDate) : "";
  const checkedCount = dailyStats.total - dailyStats.unchecked;
  const currentClassLabel = classOptions.find((option) => option.value === selectedClass)?.label || selectedClass;

  const summaryRows = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return classStudents
      .map((student) => {
        const summary = attendanceSummary[student.id] || EMPTY_SUMMARY;
        const attendanceRate = summary.total > 0 ? Math.round((summary.present / summary.total) * 100) : 0;

        return {
          student,
          summary,
          attendanceRate,
        };
      })
      .filter(({ student }) => {
        if (!keyword) {
          return true;
        }

        return (
          student.name.toLowerCase().includes(keyword) ||
          String(student.number).includes(keyword) ||
          student.id.toLowerCase().includes(keyword)
        );
      })
      .sort((a, b) => a.student.number - b.student.number);
  }, [attendanceSummary, classStudents, searchTerm]);

  const summaryOverview = useMemo(() => {
    const rowsWithData = summaryRows.filter((row) => row.summary.total > 0);
    const averageRate = rowsWithData.length
      ? Math.round(rowsWithData.reduce((total, row) => total + row.attendanceRate, 0) / rowsWithData.length)
      : 0;

    const frequentAbsentees = [...rowsWithData]
      .filter((row) => row.summary.absent > 0)
      .sort((a, b) => b.summary.absent - a.summary.absent || a.student.number - b.student.number)
      .slice(0, 5);

    const frequentLate = [...rowsWithData]
      .filter((row) => row.summary.late > 0)
      .sort((a, b) => b.summary.late - a.summary.late || a.student.number - b.student.number)
      .slice(0, 5);

    return {
      recordedStudents: rowsWithData.length,
      averageRate,
      frequentAbsentees,
      frequentLate,
    };
  }, [summaryRows]);

  const updateStudentDraft = (studentId: string, updater: (draft: AttendanceDraft) => AttendanceDraft) => {
    setAttendance((prev) => {
      const currentDraft = prev[studentId] || createEmptyDraft();
      const nextDraft = updater(currentDraft);
      return { ...prev, [studentId]: nextDraft };
    });
  };

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    const currentDraft = attendance[studentId] || createEmptyDraft();
    setLastChange({ studentId, previous: currentDraft });

    updateStudentDraft(studentId, (draft) => {
      if (status === "unchecked") {
        return createEmptyDraft();
      }

      return {
        ...draft,
        status,
        leaveType: status === "leave" ? draft.leaveType : "none",
      };
    });
  };

  const handleMarkAllPresent = () => {
    setLastChange(null);
    setAttendance((prev) => {
      const next = { ...prev };
      classStudents.forEach((student) => {
        const currentDraft = next[student.id] || createEmptyDraft();
        next[student.id] = {
          ...currentDraft,
          status: "present",
          leaveType: "none",
        };
      });
      return next;
    });
  };

  const handleResetToUnchecked = () => {
    setLastChange(null);
    setAttendance((prev) => {
      const next = { ...prev };
      classStudents.forEach((student) => {
        next[student.id] = createEmptyDraft();
      });
      return next;
    });
  };

  const handleUndoLastChange = () => {
    if (!lastChange) {
      return;
    }

    const { studentId, previous } = lastChange;
    setAttendance((prev) => ({ ...prev, [studentId]: previous }));
    setLastChange(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = students.reduce<Record<string, { status: AttendanceStatus; note?: string | null }>>((acc, student) => {
        const draft = attendance[student.id] || createEmptyDraft();
        acc[student.id] = {
          status: draft.status,
          note: serializeNote(draft) || null,
        };
        return acc;
      }, {});

      await api.saveAttendance(selectedDate, payload);

      try {
        const summaryData = await api.getAttendanceSummary();
        setAttendanceSummary(summaryData || {});
        setIsSummaryAvailable(true);
      } catch {
        setAttendanceSummary({});
        setIsSummaryAvailable(false);
      }

      setSavedAttendance({ ...attendance });
      setLastSavedAt(new Date());
      setLastChange(null);
      toast.success("บันทึกข้อมูลการมาเรียนเรียบร้อยแล้ว");
    } catch (error: any) {
      toast.error("บันทึกล้มเหลว", { description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyGuardianList = async () => {
    const message = buildGuardianMessage(compactDate, classStudents, attendance);
    if (!message) {
      toast.info("ยังไม่มีนักเรียนสายหรือขาดในห้องนี้");
      return;
    }

    try {
      await navigator.clipboard.writeText(message);
      toast.success("คัดลอกข้อความแจ้งผู้ปกครองแล้ว");
    } catch {
      toast.error("คัดลอกข้อความไม่สำเร็จ");
    }
  };

  const handleExportSummary = () => {
    const header = ["เลขที่", "ชื่อ-นามสกุล", "มา", "สาย", "ลา", "ขาด", "บันทึกทั้งหมด", "อัตรามาเรียน (%)", "ล่าสุด"];
    const rows = summaryRows.map(({ student, summary, attendanceRate }) => [
      student.number,
      student.name,
      summary.present,
      summary.late,
      summary.leave,
      summary.absent,
      summary.total,
      attendanceRate,
      summary.lastRecordedDate ? formatThaiCompactDate(summary.lastRecordedDate) : "-",
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-summary-${selectedClass}-${selectedDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("ส่งออกไฟล์ CSV สำหรับเปิดใน Excel แล้ว");
  };

  const handlePrintSummary = () => {
    window.print();
  };

  const activeNoteDraft = noteStudent ? attendance[noteStudent.id] || createEmptyDraft() : createEmptyDraft();

  const renderStatusButtons = (student: Student) => {
    const activeStatus = attendance[student.id]?.status || "unchecked";

    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {STATUS_ORDER.map((status) => {
          const isActive = activeStatus === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => handleStatusChange(student.id, status)}
              className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-bold transition-all ${isActive ? STATUS_META[status].activeClass : STATUS_META[status].inactiveClass}`}
            >
              {STATUS_META[status].buttonLabel}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <ClipboardCheck size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">ระบบเช็คชื่อ</h1>
            <p className="text-sm font-medium text-slate-600">{displayDate}</p>
            <p className="text-xs text-slate-400">รูปแบบวันที่ในหน้านี้ใช้ {compactDate}</p>
          </div>
        </div>

        <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:grid-cols-[220px_220px]">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 transition-all focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-500/10">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">ห้องเรียน</label>
            <select
              value={selectedClass}
              onChange={(event) => setSelectedClass(event.target.value)}
              title="กรองตามห้องเรียน"
              className="w-full cursor-pointer border-none bg-transparent text-sm font-medium text-slate-700 outline-none"
            >
              {classOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 transition-all focus-within:border-emerald-400 focus-within:ring-4 focus-within:ring-emerald-500/10">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-400">วันที่เช็คชื่อ</label>
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-slate-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                title="เลือกวันที่เช็คชื่อ"
                className="w-full cursor-pointer border-none bg-transparent text-sm font-medium text-slate-700 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          { key: "all" as StatusFilter, label: "ทั้งหมด", value: dailyStats.total, icon: Users, tone: "bg-slate-50 border-slate-200 text-slate-700" },
          { key: "unchecked" as StatusFilter, label: "ยังไม่ได้เช็ค", value: dailyStats.unchecked, icon: Info, tone: "bg-slate-50 border-slate-200 text-slate-700" },
          { key: "present" as StatusFilter, label: "มา", value: dailyStats.present, icon: CheckCircle2, tone: "bg-emerald-50 border-emerald-200 text-emerald-700" },
          { key: "late" as StatusFilter, label: "สาย", value: dailyStats.late, icon: Clock, tone: "bg-amber-50 border-amber-200 text-amber-700" },
          { key: "leave" as StatusFilter, label: "ลารวม", value: dailyStats.leave, icon: FileText, tone: "bg-sky-50 border-sky-200 text-sky-700" },
          { key: "absent" as StatusFilter, label: "ขาด", value: dailyStats.absent, icon: XCircle, tone: "bg-rose-50 border-rose-200 text-rose-700" },
        ].map((item, index) => {
          const Icon = item.icon;
          const active = statusFilter === item.key;

          return (
            <motion.button
              key={item.key}
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              onClick={() => setStatusFilter(item.key)}
              className={`rounded-2xl border p-4 text-left transition-all ${item.tone} ${active ? "ring-2 ring-offset-2 ring-slate-300" : "hover:-translate-y-0.5 hover:shadow-sm"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">{item.label}</p>
                  <p className="mt-1 text-2xl font-extrabold">{item.value}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70">
                  <Icon size={18} />
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 animate-pulse">
              <ClipboardCheck className="text-emerald-500" size={20} />
            </div>
            <p className="text-sm font-medium text-slate-400">กำลังโหลดข้อมูล...</p>
          </div>
        </div>
      ) : students.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-blue-100 bg-blue-50 p-10 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100">
            <AlertTriangle className="text-blue-500" size={28} />
          </div>
          <h3 className="mb-1 text-lg font-bold text-blue-800">ยังไม่มีรายชื่อนักเรียน</h3>
          <p className="text-sm text-blue-600/70">กรุณาไปที่เมนู "จัดการนักเรียน" เพื่อเพิ่มรายชื่อก่อน</p>
        </div>
      ) : (
        <Tabs defaultValue="daily" className="w-full">
          <TabsList className="mb-4 grid w-full max-w-[420px] grid-cols-2 rounded-2xl bg-slate-100 p-1">
            <TabsTrigger value="daily" className="rounded-2xl font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">
              ตรวจรายวัน
            </TabsTrigger>
            <TabsTrigger value="summary" className="rounded-2xl font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">
              สรุปภาพรวม
            </TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">รายชื่อนักเรียนประจำวันที่ {displayDate}</h2>
                  <p className="text-sm text-slate-500">{currentClassLabel} • เช็คแล้ว {checkedCount}/{dailyStats.total} คน</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={handleMarkAllPresent} className="rounded-xl">
                    <UserCheck size={16} />
                    มาทั้งหมด
                  </Button>
                  <Button type="button" variant="outline" onClick={handleResetToUnchecked} className="rounded-xl">
                    <RotateCcw size={16} />
                    รีเซ็ตเป็นยังไม่ได้เช็ค
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCopyGuardianList} className="rounded-xl">
                    <MessageSquare size={16} />
                    แจ้งผู้ปกครอง
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="ค้นหาชื่อ / เลขที่ / รหัสนักเรียน"
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <Filter size={16} />
                  {statusFilter === "all" ? "กำลังแสดงทุกสถานะ" : `กำลังกรอง: ${STATUS_META[statusFilter].label}`}
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="hidden overflow-x-auto lg:block">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead>
                    <tr className="bg-slate-50/80">
                      <th className="w-20 px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">เลขที่</th>
                      <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">ชื่อ-นามสกุล</th>
                      <th className="w-[430px] px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">สถานะ</th>
                      <th className="w-[260px] px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredStudents.map((student) => {
                      const draft = attendance[student.id] || createEmptyDraft();
                      return (
                        <tr key={student.id} className="align-top transition-colors hover:bg-slate-50/70">
                          <td className="px-6 py-4">
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-600">
                              {student.number}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-medium text-slate-800">{student.name}</p>
                            <p className="mt-1 text-xs text-slate-400">{student.classRoom || "ทั่วไป"}</p>
                          </td>
                          <td className="px-6 py-4">{renderStatusButtons(student)}</td>
                          <td className="px-6 py-4">
                            <div className="space-y-2">
                              <Badge variant="outline" className={STATUS_META[draft.status].badgeClass}>{STATUS_META[draft.status].label}</Badge>
                              {draft.status === "leave" && draft.leaveType !== "none" && (
                                <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">{LEAVE_TYPE_LABELS[draft.leaveType]}</Badge>
                              )}
                              <p className="min-h-10 line-clamp-2 text-sm text-slate-500">{draft.note.trim() || "ยังไม่มีหมายเหตุ"}</p>
                              <Button type="button" variant="outline" size="sm" onClick={() => setNoteStudent(student)} className="rounded-lg">
                                <MessageSquare size={14} />
                                หมายเหตุ
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-slate-50 lg:hidden">
                {filteredStudents.map((student) => {
                  const draft = attendance[student.id] || createEmptyDraft();
                  return (
                    <div key={student.id} className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-slate-600">
                              {student.number}
                            </span>
                            <p className="truncate text-sm font-medium text-slate-800">{student.name}</p>
                          </div>
                          <p className="mt-1 text-xs text-slate-400">{student.classRoom || "ทั่วไป"}</p>
                        </div>
                        <Badge variant="outline" className={STATUS_META[draft.status].badgeClass}>{STATUS_META[draft.status].label}</Badge>
                      </div>

                      {renderStatusButtons(student)}

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        {draft.status === "leave" && draft.leaveType !== "none" && (
                          <Badge variant="outline" className="mb-2 border-sky-200 bg-sky-50 text-sky-700">{LEAVE_TYPE_LABELS[draft.leaveType]}</Badge>
                        )}
                        <p className="text-sm text-slate-500">{draft.note.trim() || "ยังไม่มีหมายเหตุ"}</p>
                        <Button type="button" variant="outline" size="sm" onClick={() => setNoteStudent(student)} className="mt-3 rounded-lg">
                          <MessageSquare size={14} />
                          เพิ่มหมายเหตุ
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredStudents.length === 0 && (
                <div className="px-6 py-12 text-center text-sm text-slate-500">ไม่พบนักเรียนตามตัวกรองที่เลือก</div>
              )}

              <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${hasUnsavedChanges ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>
                  <Info size={16} />
                  {hasUnsavedChanges
                    ? "ยังไม่ได้บันทึกการเปลี่ยนแปลง"
                    : lastSavedAt
                      ? `บันทึกล่าสุดเมื่อ ${format(lastSavedAt, "HH:mm น.")}`
                      : "ยังไม่มีการเปลี่ยนแปลงในหน้านี้"}
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="outline" onClick={handleUndoLastChange} disabled={!lastChange} className="rounded-xl">
                    <RotateCcw size={16} />
                    Undo ล่าสุด
                  </Button>
                  <Button type="button" onClick={() => void handleSave()} disabled={isSaving || !hasUnsavedChanges} className="rounded-xl bg-emerald-500 hover:bg-emerald-600">
                    <Save size={16} />
                    {isSaving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="summary" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">สรุปการมาเรียนสะสม</h2>
                    <p className="text-sm text-slate-500">ดูสถิติรวมของ {currentClassLabel} จากข้อมูลที่บันทึกไว้ทั้งหมด</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={handleExportSummary} className="rounded-xl">
                      <Download size={16} />
                      ส่งออก CSV
                    </Button>
                    <Button type="button" variant="outline" onClick={handlePrintSummary} className="rounded-xl">
                      <Printer size={16} />
                      พิมพ์ / PDF
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm font-semibold text-emerald-700">มีข้อมูลสะสม</p>
                    <p className="mt-1 text-3xl font-extrabold text-emerald-700">{summaryOverview.recordedStudents}</p>
                  </div>
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                    <p className="text-sm font-semibold text-blue-700">อัตรามาเรียนเฉลี่ย</p>
                    <p className="mt-1 text-3xl font-extrabold text-blue-700">{summaryOverview.averageRate}%</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-700">ห้องที่กำลังดู</p>
                    <p className="mt-1 text-lg font-bold text-slate-800">{selectedClass}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
                  <h3 className="text-sm font-bold text-rose-700">นักเรียนที่ขาดบ่อย</h3>
                  <div className="mt-3 space-y-2">
                    {summaryOverview.frequentAbsentees.length === 0 ? (
                      <p className="text-sm text-rose-700/80">ยังไม่มีข้อมูลขาดเรียนสะสม</p>
                    ) : (
                      summaryOverview.frequentAbsentees.map(({ student, summary }) => (
                        <div key={student.id} className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-2 text-sm">
                          <span className="font-medium text-slate-700">{student.number}. {student.name}</span>
                          <span className="font-bold text-rose-700">{summary.absent} ครั้ง</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                  <h3 className="text-sm font-bold text-amber-700">นักเรียนที่มาสายบ่อย</h3>
                  <div className="mt-3 space-y-2">
                    {summaryOverview.frequentLate.length === 0 ? (
                      <p className="text-sm text-amber-700/80">ยังไม่มีข้อมูลมาสายสะสม</p>
                    ) : (
                      summaryOverview.frequentLate.map(({ student, summary }) => (
                        <div key={student.id} className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-2 text-sm">
                          <span className="font-medium text-slate-700">{student.number}. {student.name}</span>
                          <span className="font-bold text-amber-700">{summary.late} ครั้ง</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {!isSummaryAvailable ? (
                <div className="px-6 py-12 text-center text-sm text-slate-500">
                  ระบบสรุปสะสมยังไม่พร้อมใช้งานในเซิร์ฟเวอร์ตอนนี้ แต่ยังเช็คชื่อและบันทึกข้อมูลรายวันได้ตามปกติ
                </div>
              ) : summaryRows.every((row) => row.summary.total === 0) ? (
                <div className="px-6 py-12 text-center text-sm text-slate-500">
                  ยังไม่มีข้อมูลสรุปสะสมสำหรับห้องนี้ ลองบันทึกการเช็คชื่ออย่างน้อย 1 วันก่อน
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead>
                      <tr className="bg-slate-50/80">
                        <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">เลขที่</th>
                        <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">ชื่อ-นามสกุล</th>
                        <th className="px-4 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider text-slate-400">มา</th>
                        <th className="px-4 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider text-slate-400">สาย</th>
                        <th className="px-4 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider text-slate-400">ลารวม</th>
                        <th className="px-4 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider text-slate-400">ขาด</th>
                        <th className="px-4 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider text-slate-400">บันทึกทั้งหมด</th>
                        <th className="px-6 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider text-slate-400">อัตรามาเรียน</th>
                        <th className="px-6 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider text-slate-400">ล่าสุด</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {summaryRows.map(({ student, summary, attendanceRate }) => (
                        <tr key={student.id} className="transition-colors hover:bg-slate-50/70">
                          <td className="px-6 py-3 text-sm font-bold text-slate-600">{student.number}</td>
                          <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-slate-700">{student.name}</td>
                          <td className="px-4 py-3 text-center"><span className="inline-flex min-w-10 justify-center rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">{summary.present}</span></td>
                          <td className="px-4 py-3 text-center"><span className="inline-flex min-w-10 justify-center rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700">{summary.late}</span></td>
                          <td className="px-4 py-3 text-center"><span className="inline-flex min-w-10 justify-center rounded-full bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-700">{summary.leave}</span></td>
                          <td className="px-4 py-3 text-center"><span className="inline-flex min-w-10 justify-center rounded-full bg-rose-50 px-3 py-1 text-sm font-semibold text-rose-700">{summary.absent}</span></td>
                          <td className="px-4 py-3 text-center text-sm font-semibold text-slate-700">{summary.total}</td>
                          <td className="px-6 py-3 text-center"><span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{attendanceRate}%</span></td>
                          <td className="px-6 py-3 text-center whitespace-nowrap text-sm text-slate-500">{summary.lastRecordedDate ? formatThaiCompactDate(summary.lastRecordedDate) : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={Boolean(noteStudent)} onOpenChange={(open) => { if (!open) setNoteStudent(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>หมายเหตุนักเรียน</DialogTitle>
            <DialogDescription>
              {noteStudent ? `บันทึกเหตุผลหรือข้อมูลเพิ่มเติมของ ${noteStudent.name}` : "เพิ่มหมายเหตุ"}
            </DialogDescription>
          </DialogHeader>

          {noteStudent && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={STATUS_META[activeNoteDraft.status].badgeClass}>{STATUS_META[activeNoteDraft.status].label}</Badge>
                {activeNoteDraft.status === "leave" && activeNoteDraft.leaveType !== "none" && (
                  <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">{LEAVE_TYPE_LABELS[activeNoteDraft.leaveType]}</Badge>
                )}
              </div>

              {activeNoteDraft.status === "leave" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">ประเภทการลา</label>
                  <Select
                    value={activeNoteDraft.leaveType}
                    onValueChange={(value) => updateStudentDraft(noteStudent.id, (draft) => ({ ...draft, leaveType: value as LeaveType }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกประเภทการลา" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">ยังไม่ระบุ</SelectItem>
                      <SelectItem value="sick">ลาป่วย</SelectItem>
                      <SelectItem value="personal">ลากิจ</SelectItem>
                      <SelectItem value="other">ลาอื่น ๆ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">หมายเหตุ</label>
                <Textarea
                  value={activeNoteDraft.note}
                  onChange={(event) => updateStudentDraft(noteStudent.id, (draft) => ({ ...draft, note: event.target.value }))}
                  placeholder="เช่น ผู้ปกครองแจ้งแล้ว, รถติด, กลับก่อนเวลา"
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">เติมข้อความด่วน</p>
                <div className="flex flex-wrap gap-2">
                  {NOTE_TEMPLATES.map((template) => (
                    <Button
                      key={template}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => updateStudentDraft(noteStudent.id, (draft) => ({
                        ...draft,
                        note: draft.note.trim() ? `${draft.note.trim()} ${template}` : template,
                      }))}
                    >
                      {template}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (noteStudent) {
                  updateStudentDraft(noteStudent.id, (draft) => ({
                    ...draft,
                    note: "",
                    leaveType: draft.status === "leave" ? draft.leaveType : "none",
                  }));
                }
              }}
            >
              ล้างหมายเหตุ
            </Button>
            <Button type="button" onClick={() => setNoteStudent(null)}>ปิด</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

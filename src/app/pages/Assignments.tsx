import React, { ChangeEvent, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import {
  CheckCircle2,
  ClipboardCheck,
  Copy,
  FileText,
  History,
  Link2,
  Loader2,
  Pencil,
  RotateCcw,
  Save,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { api } from "../api";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";

interface Student {
  id: string;
  number: number;
  name: string;
  classRoom?: string;
}

interface Classroom {
  id: string;
  name: string;
}

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  attachment_url: string | null;
  max_score: number | null;
  classroom_id: string;
  created_at: string;
}

type SubmissionStatus = "pending" | "submitted" | "missing" | "late" | "needs_revision" | "reviewed" | "excused";

interface AssignmentSubmissionRow {
  id?: string;
  assignment_id: string;
  student_id: string;
  status: SubmissionStatus;
  teacher_note?: string | null;
  score?: number | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
}

interface SubmissionDraft {
  status: SubmissionStatus;
  teacher_note: string;
  score: string;
  submitted_at: string | null;
  reviewed_at: string | null;
}

interface AssignmentFormState {
  title: string;
  description: string;
  dueDate: string;
  attachmentUrl: string;
  maxScore: string;
}

const ASSIGNMENT_DEFAULT_FORM: AssignmentFormState = {
  title: "",
  description: "",
  dueDate: format(new Date(), "yyyy-MM-dd"),
  attachmentUrl: "",
  maxScore: "",
};

const SUBMISSION_STATUS_OPTIONS: Array<{ value: SubmissionStatus; label: string; shortLabel: string; badgeClass: string }> = [
  { value: "pending", label: "ยังไม่ส่ง", shortLabel: "ยังไม่ส่ง", badgeClass: "border-slate-200 bg-slate-100 text-slate-700" },
  { value: "submitted", label: "ส่งแล้ว", shortLabel: "ส่งแล้ว", badgeClass: "border-emerald-200 bg-emerald-100 text-emerald-700" },
  { value: "late", label: "ส่งช้า", shortLabel: "ส่งช้า", badgeClass: "border-amber-200 bg-amber-100 text-amber-700" },
  { value: "needs_revision", label: "ต้องแก้ไข", shortLabel: "ต้องแก้", badgeClass: "border-orange-200 bg-orange-100 text-orange-700" },
  { value: "reviewed", label: "ตรวจแล้ว", shortLabel: "ตรวจแล้ว", badgeClass: "border-blue-200 bg-blue-100 text-blue-700" },
  { value: "missing", label: "ไม่ส่งงาน", shortLabel: "ไม่ส่ง", badgeClass: "border-rose-200 bg-rose-100 text-rose-700" },
  { value: "excused", label: "ขาดเรียน / ไม่ได้รับงาน", shortLabel: "ขาด/งด", badgeClass: "border-violet-200 bg-violet-100 text-violet-700" },
];

const SUBMISSION_STATUS_MAP = Object.fromEntries(
  SUBMISSION_STATUS_OPTIONS.map((option) => [option.value, option]),
) as Record<SubmissionStatus, (typeof SUBMISSION_STATUS_OPTIONS)[number]>;

const FAST_TOGGLE_SEQUENCE: SubmissionStatus[] = ["pending", "submitted", "missing"];

function createAssignmentForm(assignment?: Assignment | null): AssignmentFormState {
  if (!assignment) {
    return { ...ASSIGNMENT_DEFAULT_FORM };
  }

  return {
    title: assignment.title,
    description: assignment.description ?? "",
    dueDate: assignment.due_date ?? format(new Date(), "yyyy-MM-dd"),
    attachmentUrl: assignment.attachment_url ?? "",
    maxScore: assignment.max_score != null ? String(assignment.max_score) : "",
  };
}

function createEmptyDraft(): SubmissionDraft {
  return {
    status: "pending",
    teacher_note: "",
    score: "",
    submitted_at: null,
    reviewed_at: null,
  };
}

function normalizeSubmissionStatus(status?: string | null): SubmissionStatus {
  if (!status) {
    return "pending";
  }

  return (SUBMISSION_STATUS_MAP[status as SubmissionStatus] ? status : "pending") as SubmissionStatus;
}

function createDraftFromRow(row?: Partial<AssignmentSubmissionRow>): SubmissionDraft {
  return {
    status: normalizeSubmissionStatus(row?.status),
    teacher_note: row?.teacher_note ?? "",
    score: row?.score != null ? String(row.score) : "",
    submitted_at: row?.submitted_at ?? null,
    reviewed_at: row?.reviewed_at ?? null,
  };
}

function cloneDrafts(drafts: Record<string, SubmissionDraft>) {
  return Object.fromEntries(
    Object.entries(drafts).map(([studentId, draft]) => [studentId, { ...draft }]),
  ) as Record<string, SubmissionDraft>;
}

export function Assignments() {
  const { user } = useAuth();
  
  const [students, setStudents] = useState<Student[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  
  const [newAssignmentForm, setNewAssignmentForm] = useState<AssignmentFormState>({ ...ASSIGNMENT_DEFAULT_FORM });
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>("");
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [editingAssignmentForm, setEditingAssignmentForm] = useState<AssignmentFormState>({ ...ASSIGNMENT_DEFAULT_FORM });
  const [assignmentToDelete, setAssignmentToDelete] = useState<Assignment | null>(null);
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);
  const [isDeletingAssignment, setIsDeletingAssignment] = useState(false);
  const [isSavingChanges, setIsSavingChanges] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortMode, setSortMode] = useState<string>("number");
  const [isQuickMode, setIsQuickMode] = useState(false);
  const [selectedStudentHistory, setSelectedStudentHistory] = useState<Student | null>(null);

  const [submissionDrafts, setSubmissionDrafts] = useState<Record<string, SubmissionDraft>>({});
  const [savedSubmissionDrafts, setSavedSubmissionDrafts] = useState<Record<string, SubmissionDraft>>({});
  const [allSubmissions, setAllSubmissions] = useState<Record<string, Record<string, SubmissionStatus>>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchInitialData();
    }
  }, [user]);

  useEffect(() => {
    if (selectedClassId) {
      fetchAssignments(selectedClassId);
    }
  }, [selectedClassId]);

  useEffect(() => {
    if (selectedAssignmentId) {
      fetchSubmissions(selectedAssignmentId);
    } else {
      setSubmissionDrafts({});
      setSavedSubmissionDrafts({});
    }
  }, [selectedAssignmentId]);

  const selectedClassObj = classrooms.find(c => c.id === selectedClassId);
  const studentsInClass = students.filter((s) => s.classRoom === selectedClassObj?.name);
  const selectedAssignment = assignments.find((assignment) => assignment.id === selectedAssignmentId) ?? null;

  const fetchOverview = async () => {
    if (assignments.length === 0) {
      setAllSubmissions({});
      return;
    }
    try {
      const assignmentIds = assignments.map(a => a.id);
      const { data, error } = await supabase
        .from('assignment_submissions')
        .select('*')
        .in('assignment_id', assignmentIds);

      if (error) throw error;

      const newAllSubmissions: Record<string, Record<string, SubmissionStatus>> = {};
      
      studentsInClass.forEach(s => {
        newAllSubmissions[s.id] = {};
      });

      data?.forEach(sub => {
        if (!newAllSubmissions[sub.student_id]) {
          newAllSubmissions[sub.student_id] = {};
        }
        newAllSubmissions[sub.student_id][sub.assignment_id] = normalizeSubmissionStatus(sub.status);
      });
      setAllSubmissions(newAllSubmissions);
    } catch (error: any) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (assignments.length > 0 && studentsInClass.length > 0) {
      fetchOverview();
    } else {
      setAllSubmissions({});
    }
  }, [assignments, studentsInClass.length]);

  const fetchInitialData = async () => {
    try {
      setIsLoading(true);
      const studentsData = await api.getStudents();
      setStudents(studentsData);

      const { data: classroomsData, error } = await supabase
        .from('classrooms')
        .select('id, name')
        .eq('owner_user_id', user!.id)
        .order('name');
        
      if (error) throw error;

      if (classroomsData && classroomsData.length > 0) {
        setClassrooms(classroomsData);
        setSelectedClassId(classroomsData[0].id);
      }
    } catch (error: any) {
      toast.error("ดึงข้อมูลนักเรียนและห้องเรียนล้มเหลว", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAssignments = async (classroomId: string) => {
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('classroom_id', classroomId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAssignments(data || []);
      if (data && data.length > 0) {
        setSelectedAssignmentId(data[0].id);
      } else {
        setSelectedAssignmentId("");
      }
    } catch (error: any) {
      toast.error("ดึงข้อมูลการบ้านล้มเหลว", { description: error.message });
    }
  };

  const fetchSubmissions = async (assignmentId: string) => {
    try {
      const { data, error } = await supabase
        .from('assignment_submissions')
        .select('assignment_id, student_id, status, teacher_note, score, submitted_at, reviewed_at')
        .eq('assignment_id', assignmentId);

      if (error) throw error;

      const rowsByStudent = new Map((data || []).map((row) => [row.student_id, row]));
      const drafts = Object.fromEntries(
        studentsInClass.map((student) => [student.id, createDraftFromRow(rowsByStudent.get(student.id))]),
      ) as Record<string, SubmissionDraft>;

      setSubmissionDrafts(drafts);
      setSavedSubmissionDrafts(cloneDrafts(drafts));
    } catch (error: any) {
      toast.error("ดึงข้อมูลการส่งงานล้มเหลว", { description: error.message });
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssignmentForm.title.trim() || !selectedClassId) return;

    try {
      const { data, error } = await supabase
        .from('assignments')
        .insert({
          owner_user_id: user!.id,
          classroom_id: selectedClassId,
          title: newAssignmentForm.title.trim(),
          description: newAssignmentForm.description.trim() || null,
          due_date: newAssignmentForm.dueDate,
          attachment_url: newAssignmentForm.attachmentUrl.trim() || null,
          max_score: newAssignmentForm.maxScore.trim() ? Number(newAssignmentForm.maxScore) : null,
        })
        .select()
        .single();

      if (error) throw error;

      setAssignments([data, ...assignments]);
      setNewAssignmentForm({ ...ASSIGNMENT_DEFAULT_FORM });
      setSelectedAssignmentId(data.id);
      toast.success("สร้างการบ้านสำเร็จ");
    } catch (error: any) {
      toast.error("สร้างการบ้านล้มเหลว", { description: error.message });
    }
  };

  const handleOpenEditAssignment = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setEditingAssignmentForm(createAssignmentForm(assignment));
  };

  const handleCloseEditAssignment = () => {
    setEditingAssignment(null);
    setEditingAssignmentForm({ ...ASSIGNMENT_DEFAULT_FORM });
  };

  const handleUpdateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingAssignment) return;

    const trimmedTitle = editingAssignmentForm.title.trim();
    if (!trimmedTitle) return;

    try {
      setIsSavingAssignment(true);
      const { data, error } = await supabase
        .from('assignments')
        .update({
          title: trimmedTitle,
          description: editingAssignmentForm.description.trim() || null,
          due_date: editingAssignmentForm.dueDate,
          attachment_url: editingAssignmentForm.attachmentUrl.trim() || null,
          max_score: editingAssignmentForm.maxScore.trim() ? Number(editingAssignmentForm.maxScore) : null,
        })
        .eq('id', editingAssignment.id)
        .select('*')
        .single();

      if (error) throw error;

      setAssignments((prev) =>
        prev.map((assignment) =>
          assignment.id === editingAssignment.id
            ? { ...assignment, title: data.title }
            : assignment,
        ),
      );
      handleCloseEditAssignment();
      toast.success("แก้ไขหัวข้อการบ้านสำเร็จ");
    } catch (error: any) {
      toast.error("แก้ไขหัวข้อการบ้านล้มเหลว", { description: error.message });
    } finally {
      setIsSavingAssignment(false);
    }
  };

  const handleSubmissionFieldChange = (studentId: string, updates: Partial<SubmissionDraft>) => {
    setSubmissionDrafts((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || createEmptyDraft()),
        ...updates,
      },
    }));
  };

  const handleStatusChange = (studentId: string, status: SubmissionStatus) => {
    const currentDraft = submissionDrafts[studentId] || createEmptyDraft();
    const submittedAt = status === "submitted" || status === "late" || status === "needs_revision" || status === "reviewed"
      ? currentDraft.submitted_at || new Date().toISOString()
      : null;
    const reviewedAt = status === "reviewed" ? currentDraft.reviewed_at || new Date().toISOString() : null;

    handleSubmissionFieldChange(studentId, {
      status,
      submitted_at: submittedAt,
      reviewed_at: reviewedAt,
    });
  };

  const handleQuickToggle = (studentId: string) => {
    if (!isQuickMode) return;

    const currentStatus = submissionDrafts[studentId]?.status || "pending";
    const currentIndex = FAST_TOGGLE_SEQUENCE.indexOf(currentStatus);
    const nextStatus = FAST_TOGGLE_SEQUENCE[(currentIndex + 1 + FAST_TOGGLE_SEQUENCE.length) % FAST_TOGGLE_SEQUENCE.length];
    handleStatusChange(studentId, nextStatus);
  };

  const handleMarkAllSubmitted = () => {
    const now = new Date().toISOString();
    const nextDrafts = cloneDrafts(submissionDrafts);

    studentsInClass.forEach((student) => {
      nextDrafts[student.id] = {
        ...(nextDrafts[student.id] || createEmptyDraft()),
        status: "submitted",
        submitted_at: nextDrafts[student.id]?.submitted_at || now,
      };
    });

    setSubmissionDrafts(nextDrafts);
  };

  const handleClearAllStatuses = () => {
    const nextDrafts = cloneDrafts(submissionDrafts);

    studentsInClass.forEach((student) => {
      nextDrafts[student.id] = {
        ...(nextDrafts[student.id] || createEmptyDraft()),
        status: "pending",
        submitted_at: null,
        reviewed_at: null,
      };
    });

    setSubmissionDrafts(nextDrafts);
  };

  const handleResetChanges = () => {
    setSubmissionDrafts(cloneDrafts(savedSubmissionDrafts));
    toast.success("ย้อนกลับเป็นข้อมูลล่าสุดแล้ว");
  };

  const handleSaveSubmissionChanges = async () => {
    if (!selectedAssignmentId) return;

    try {
      setIsSavingChanges(true);
      const rows = studentsInClass.map((student) => {
        const draft = submissionDrafts[student.id] || createEmptyDraft();
        const parsedScore = draft.score.trim() === "" ? null : Number(draft.score);

        return {
          assignment_id: selectedAssignmentId,
          student_id: student.id,
          status: draft.status,
          teacher_note: draft.teacher_note.trim() || null,
          score: Number.isFinite(parsedScore) ? parsedScore : null,
          submitted_at: draft.submitted_at,
          reviewed_at: draft.reviewed_at,
        };
      });

      const { error } = await supabase
        .from('assignment_submissions')
        .upsert(rows, { onConflict: 'assignment_id,student_id' });

      if (error) throw error;

      setSavedSubmissionDrafts(cloneDrafts(submissionDrafts));
      setLastSavedAt(new Date().toISOString());
      await fetchOverview();
      toast.success("บันทึกการเปลี่ยนแปลงเรียบร้อยแล้ว");
    } catch (error: any) {
      toast.error("บันทึกสถานะการบ้านล้มเหลว", { description: error.message });
    } finally {
      setIsSavingChanges(false);
    }
  };

  const handleCopyPendingList = async () => {
    if (!selectedAssignment) return;

    const pendingStudents = studentsInClass.filter((student) => {
      const status = submissionDrafts[student.id]?.status || "pending";
      return status === "pending" || status === "missing";
    });

    if (pendingStudents.length === 0) {
      toast.success("ไม่มีนักเรียนค้างส่งสำหรับงานนี้");
      return;
    }

    const lines = pendingStudents.map((student) => `${student.number}. ${student.name}`);
    const message = `แจ้งผู้ปกครอง นักเรียนต่อไปนี้ยังไม่ได้ส่งการบ้าน ${selectedAssignment.title} กรุณาตรวจสอบและให้นักเรียนนำมาส่งภายในวันพรุ่งนี้ค่ะ/ครับ\n${lines.join("\n")}`;

    try {
      await navigator.clipboard.writeText(message);
      toast.success("คัดลอกรายชื่อผู้ที่ยังไม่ส่งแล้ว");
    } catch {
      toast.error("ไม่สามารถคัดลอกข้อความได้");
    }
  };

  const handleDeleteAssignment = async () => {
    if (!assignmentToDelete) return;

    try {
      setIsDeletingAssignment(true);

      const { error: submissionError } = await supabase
        .from('assignment_submissions')
        .delete()
        .eq('assignment_id', assignmentToDelete.id);

      if (submissionError) throw submissionError;

      const { error: assignmentError } = await supabase
        .from('assignments')
        .delete()
        .eq('id', assignmentToDelete.id);

      if (assignmentError) throw assignmentError;

      const remainingAssignments = assignments.filter((assignment) => assignment.id !== assignmentToDelete.id);
      setAssignments(remainingAssignments);

      if (selectedAssignmentId === assignmentToDelete.id) {
        setSelectedAssignmentId(remainingAssignments[0]?.id ?? "");
      }

      setAssignmentToDelete(null);
      toast.success("ลบการบ้านสำเร็จ");
    } catch (error: any) {
      toast.error("ลบการบ้านล้มเหลว", { description: error.message });
    } finally {
      setIsDeletingAssignment(false);
    }
  };

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(submissionDrafts) !== JSON.stringify(savedSubmissionDrafts),
    [savedSubmissionDrafts, submissionDrafts],
  );

  const assignmentSummaryStats = useMemo(() => {
    const rows = studentsInClass.map((student) => submissionDrafts[student.id] || createEmptyDraft());
    const turnedIn = rows.filter((draft) => ["submitted", "late", "needs_revision", "reviewed"].includes(draft.status)).length;
    const pending = rows.filter((draft) => ["pending", "missing"].includes(draft.status)).length;
    const late = rows.filter((draft) => draft.status === "late").length;
    const needsRevision = rows.filter((draft) => draft.status === "needs_revision").length;
    const reviewed = rows.filter((draft) => draft.status === "reviewed").length;
    const completionRate = rows.length > 0 ? Math.round((turnedIn / rows.length) * 100) : 0;

    return {
      total: rows.length,
      turnedIn,
      pending,
      late,
      needsRevision,
      reviewed,
      completionRate,
    };
  }, [studentsInClass, submissionDrafts]);

  const filteredStudentsForAssignment = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const statusOrder = Object.fromEntries(SUBMISSION_STATUS_OPTIONS.map((option, index) => [option.value, index])) as Record<SubmissionStatus, number>;

    return [...studentsInClass]
      .filter((student) => {
        const draft = submissionDrafts[student.id] || createEmptyDraft();
        const matchesQuery =
          normalizedQuery === "" ||
          student.name.toLowerCase().includes(normalizedQuery) ||
          String(student.number).includes(normalizedQuery);
        const matchesStatus = statusFilter === "all" || draft.status === statusFilter;

        return matchesQuery && matchesStatus;
      })
      .sort((left, right) => {
        const leftDraft = submissionDrafts[left.id] || createEmptyDraft();
        const rightDraft = submissionDrafts[right.id] || createEmptyDraft();

        if (sortMode === "name") {
          return left.name.localeCompare(right.name, "th");
        }

        if (sortMode === "status") {
          const statusDiff = statusOrder[leftDraft.status] - statusOrder[rightDraft.status];
          return statusDiff !== 0 ? statusDiff : left.number - right.number;
        }

        return left.number - right.number;
      });
  }, [searchQuery, statusFilter, studentsInClass, submissionDrafts, sortMode]);

  const historyRows = useMemo(() => {
    if (!selectedStudentHistory) return [];

    return assignments.map((assignment) => ({
      assignment,
      status: allSubmissions[selectedStudentHistory.id]?.[assignment.id] || "pending",
    }));
  }, [allSubmissions, assignments, selectedStudentHistory]);

  const historyStats = useMemo(() => {
    return historyRows.reduce(
      (acc, row) => {
        acc[row.status] += 1;
        return acc;
      },
      {
        pending: 0,
        submitted: 0,
        missing: 0,
        late: 0,
        needs_revision: 0,
        reviewed: 0,
        excused: 0,
      } as Record<SubmissionStatus, number>,
    );
  }, [historyRows]);

  const overviewRows = useMemo(() => {
    return studentsInClass.map((student) => {
      const statuses = assignments.map((assignment) =>
        normalizeSubmissionStatus(allSubmissions[student.id]?.[assignment.id] || "pending"),
      );

      return {
        student,
        statuses,
        handledCount: statuses.filter((status) => ["submitted", "late", "needs_revision", "reviewed"].includes(status)).length,
        attentionCount: statuses.filter((status) => ["pending", "missing", "needs_revision"].includes(status)).length,
      };
    });
  }, [allSubmissions, assignments, studentsInClass]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6 mt-20">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin flex-shrink-0" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md-flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-gray-900">ตรวจการบ้าน</h1>
        
        {/* Class Selector */}
        <div className="w-[200px]">
          <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={classrooms.length === 0}>
            <SelectTrigger>
              <SelectValue placeholder="เลือกห้องเรียน" />
            </SelectTrigger>
            <SelectContent>
              {classrooms.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
              {classrooms.length === 0 && (
                <SelectItem value="__no-classrooms__" disabled>ไม่มีข้อมูลห้องเรียน</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="check" className="w-full">
        <TabsList className="mb-6 grid w-full max-w-[400px] grid-cols-2">
          <TabsTrigger value="check">ตรวจรายชิ้น</TabsTrigger>
          <TabsTrigger value="overview">สรุปภาพรวม</TabsTrigger>
        </TabsList>

        <TabsContent value="check">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Create Homework & List */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>สร้างการบ้านใหม่</CardTitle>
                  <CardDescription>{selectedClassObj ? `เลือกสำหรับ: ${selectedClassObj.name}` : "กรุณาเลือกห้องเรียน"}</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateAssignment} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="topic">หัวข้อการบ้าน</Label>
                      <Input 
                        id="topic" 
                        placeholder="เช่น แบบฝึกหัดภาษาไทย หน้า 20" 
                        value={newAssignmentForm.title}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setNewAssignmentForm((prev) => ({ ...prev, title: e.target.value }))}
                        disabled={!selectedClassId}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">รายละเอียด</Label>
                      <Textarea
                        id="description"
                        placeholder="เช่น อ่านเรื่องสั้นแล้วตอบคำถาม 5 ข้อ"
                        value={newAssignmentForm.description}
                        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNewAssignmentForm((prev) => ({ ...prev, description: e.target.value }))}
                        disabled={!selectedClassId}
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="due-date">กำหนดส่ง</Label>
                        <Input
                          id="due-date"
                          type="date"
                          value={newAssignmentForm.dueDate}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => setNewAssignmentForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                          disabled={!selectedClassId}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="max-score">คะแนนเต็ม</Label>
                        <Input
                          id="max-score"
                          type="number"
                          min="0"
                          placeholder="10"
                          value={newAssignmentForm.maxScore}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => setNewAssignmentForm((prev) => ({ ...prev, maxScore: e.target.value }))}
                          disabled={!selectedClassId}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="attachment-url">ลิงก์ใบงาน / รูปภาพ</Label>
                      <Input
                        id="attachment-url"
                        placeholder="https://..."
                        value={newAssignmentForm.attachmentUrl}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setNewAssignmentForm((prev) => ({ ...prev, attachmentUrl: e.target.value }))}
                        disabled={!selectedClassId}
                      />
                    </div>
                    <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={!selectedClassId || !newAssignmentForm.title.trim()}>
                      บันทึกการบ้าน
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>รายการการบ้าน {selectedClassObj && `(${selectedClassObj.name})`}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                    {assignments.length === 0 ? (
                       <p className="text-gray-500 text-sm text-center py-4">ยังไม่มีการบ้านสำหรับห้องนี้</p>
                    ) : (
                      assignments.map((assignment) => (
                        <div 
                          key={assignment.id} 
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedAssignmentId === assignment.id 
                              ? "border-indigo-500 bg-indigo-50" 
                              : "hover:bg-gray-50"
                          }`}
                          onClick={() => setSelectedAssignmentId(assignment.id)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm break-words">{assignment.title}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                ส่ง {assignment.due_date ? format(new Date(`${assignment.due_date}T00:00:00`), "d MMM yyyy", { locale: th }) : new Date(assignment.created_at).toLocaleDateString('th-TH')}
                              </p>
                              {assignment.description && (
                                <p className="mt-2 line-clamp-2 text-xs text-slate-500">{assignment.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500 hover:text-slate-900"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleOpenEditAssignment(assignment);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                                <span className="sr-only">แก้ไขหัวข้อการบ้าน</span>
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500 hover:text-red-600"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setAssignmentToDelete(assignment);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">ลบการบ้าน</span>
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Check Submissions */}
            <div className="lg:col-span-2">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>
                    ตรวจการบ้าน: {" "}
                    {selectedAssignment 
                      ? `${selectedAssignment.title}${selectedAssignment.description ? ` — ${selectedAssignment.description}` : ""}`
                      : "กรุณาเลือกการบ้าน"}
                  </CardTitle>
                  {selectedAssignment && (
                    <CardDescription className="space-y-2 pt-2">
                      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> รายละเอียด: {selectedAssignment.description || "ยังไม่ได้ระบุ"}</span>
                        <span className="inline-flex items-center gap-1"><ClipboardCheck className="h-3.5 w-3.5" /> กำหนดส่ง: {selectedAssignment.due_date ? format(new Date(`${selectedAssignment.due_date}T00:00:00`), "d MMMM yyyy", { locale: th }) : "-"}</span>
                        <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> คะแนนเต็ม: {selectedAssignment.max_score ?? "-"}</span>
                        {selectedAssignment.attachment_url && (
                          <a href={selectedAssignment.attachment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:underline">
                            <Link2 className="h-3.5 w-3.5" /> เปิดไฟล์แนบ
                          </a>
                        )}
                      </div>
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  {!selectedAssignmentId ? (
                    <div className="text-center py-10 text-gray-500">
                      โปรดเลือกการบ้านเพื่อตรวจสอบการส่งงาน
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid gap-3 md:grid-cols-5">
                        {[
                          { label: "นักเรียนทั้งหมด", value: assignmentSummaryStats.total, className: "bg-slate-50 text-slate-700 border-slate-200" },
                          { label: "ส่งแล้ว", value: assignmentSummaryStats.turnedIn, className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                          { label: "ยังไม่ส่ง", value: assignmentSummaryStats.pending, className: "bg-rose-50 text-rose-700 border-rose-200" },
                          { label: "ส่งช้า", value: assignmentSummaryStats.late, className: "bg-amber-50 text-amber-700 border-amber-200" },
                          { label: "ต้องแก้ไข", value: assignmentSummaryStats.needsRevision, className: "bg-orange-50 text-orange-700 border-orange-200" },
                        ].map((item) => (
                          <div key={item.label} className={`rounded-2xl border p-4 ${item.className}`}>
                            <p className="text-xs font-semibold">{item.label}</p>
                            <p className="mt-2 text-2xl font-bold">{item.value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">สถานะการส่งการบ้าน</p>
                            <p className="text-xs text-slate-500">ส่งครบแล้ว {assignmentSummaryStats.completionRate}% ของห้อง และคุณสามารถคัดลอกรายชื่อที่ยังไม่ส่งเพื่อแจ้งผู้ปกครองได้ทันที</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button type="button" variant="outline" onClick={handleCopyPendingList}>
                              <Copy className="h-4 w-4" /> คัดลอกรายชื่อคนยังไม่ส่ง
                            </Button>
                            <Button type="button" variant={isQuickMode ? "default" : "outline"} onClick={() => setIsQuickMode((prev) => !prev)}>
                              <ClipboardCheck className="h-4 w-4" /> {isQuickMode ? "ปิดโหมดบันทึกเร็ว" : "เปิดโหมดบันทึกเร็ว"}
                            </Button>
                            <Button type="button" variant="outline" onClick={handleMarkAllSubmitted}>
                              <CheckCircle2 className="h-4 w-4" /> ทำเครื่องหมายว่าส่งทั้งหมด
                            </Button>
                            <Button type="button" variant="outline" onClick={handleClearAllStatuses}>
                              <XCircle className="h-4 w-4" /> ล้างสถานะทั้งหมด
                            </Button>
                            <Button type="button" variant="outline" onClick={handleResetChanges} disabled={!hasUnsavedChanges}>
                              <RotateCcw className="h-4 w-4" /> ย้อนกลับ
                            </Button>
                            <Button type="button" onClick={handleSaveSubmissionChanges} disabled={isSavingChanges || !hasUnsavedChanges}>
                              {isSavingChanges ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} บันทึกการเปลี่ยนแปลง
                            </Button>
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input
                              className="pl-9"
                              placeholder="ค้นหาชื่อนักเรียนหรือเลขที่"
                              value={searchQuery}
                              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                            />
                          </div>
                          <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger>
                              <SelectValue placeholder="กรองตามสถานะ" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">ทั้งหมด</SelectItem>
                              {SUBMISSION_STATUS_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={sortMode} onValueChange={setSortMode}>
                            <SelectTrigger>
                              <SelectValue placeholder="เรียงลำดับ" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="number">เรียงตามเลขที่</SelectItem>
                              <SelectItem value="status">เรียงตามสถานะ</SelectItem>
                              <SelectItem value="name">เรียงตามชื่อ</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="rounded-full bg-white px-3 py-1 shadow-sm">โหมดบันทึกเร็ว: {isQuickMode ? "คลิกแถวเพื่อวนสถานะ ส่งแล้ว / ไม่ส่ง / ยังไม่ส่ง" : "ปิดอยู่"}</span>
                          {lastSavedAt && (
                            <span className="rounded-full bg-white px-3 py-1 shadow-sm">บันทึกล่าสุดเมื่อ {format(new Date(lastSavedAt), "HH:mm", { locale: th })} น.</span>
                          )}
                        </div>
                      </div>

                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[80px]">เลขที่</TableHead>
                            <TableHead>ชื่อ - นามสกุล</TableHead>
                            <TableHead className="min-w-[180px]">สถานะ</TableHead>
                            <TableHead className="min-w-[220px]">หมายเหตุจากครู</TableHead>
                            <TableHead className="w-[120px] text-center">คะแนน</TableHead>
                            <TableHead className="w-[110px] text-right">ประวัติ</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredStudentsForAssignment.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="py-8 text-center text-slate-500">ไม่พบนักเรียนตามเงื่อนไขที่ค้นหา</TableCell>
                            </TableRow>
                          ) : (
                            filteredStudentsForAssignment.map((student) => {
                              const draft = submissionDrafts[student.id] || createEmptyDraft();
                              const statusMeta = SUBMISSION_STATUS_MAP[draft.status];

                              return (
                                <TableRow
                                  key={student.id}
                                  className={isQuickMode ? "cursor-pointer" : ""}
                                  onClick={() => handleQuickToggle(student.id)}
                                >
                                  <TableCell className="font-semibold">{student.number}</TableCell>
                                  <TableCell>
                                    <div>
                                      <p className="font-medium text-slate-800">{student.name}</p>
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        <Badge variant="outline" className={statusMeta.badgeClass}>{statusMeta.shortLabel}</Badge>
                                        {draft.reviewed_at && <Badge variant="outline" className="border-blue-100 bg-blue-50 text-blue-600">ตรวจแล้ว</Badge>}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell onClick={(event) => event.stopPropagation()}>
                                    <Select value={draft.status} onValueChange={(value) => handleStatusChange(student.id, value as SubmissionStatus)}>
                                      <SelectTrigger>
                                        <SelectValue placeholder="เลือกสถานะ" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {SUBMISSION_STATUS_OPTIONS.map((option) => (
                                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell onClick={(event) => event.stopPropagation()}>
                                    <Input
                                      placeholder="เช่น ลืมสมุด / ขอส่งพรุ่งนี้"
                                      value={draft.teacher_note}
                                      onChange={(e: ChangeEvent<HTMLInputElement>) => handleSubmissionFieldChange(student.id, { teacher_note: e.target.value })}
                                    />
                                  </TableCell>
                                  <TableCell onClick={(event) => event.stopPropagation()}>
                                    <Input
                                      type="number"
                                      min="0"
                                      max={selectedAssignment?.max_score ?? undefined}
                                      placeholder={selectedAssignment?.max_score != null ? `/ ${selectedAssignment.max_score}` : "-"}
                                      value={draft.score}
                                      onChange={(e: ChangeEvent<HTMLInputElement>) => handleSubmissionFieldChange(student.id, { score: e.target.value })}
                                    />
                                  </TableCell>
                                  <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedStudentHistory(student)}>
                                      <History className="h-4 w-4" /> ดู
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                )
              }
            </CardContent>
          </Card>
        </div>
      </div>
    </TabsContent>

    <TabsContent value="overview">
      <Card>
        <CardHeader>
          <CardTitle>สรุปการส่งการบ้าน: {selectedClassObj?.name || "ยังไม่ได้เลือกห้อง"}</CardTitle>
          <CardDescription>
            แสดงภาพรวมการส๋งการบ้านทั้งหมดของนักเรียนแต่ละคน
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              ยังไม่มีการบ้านสำหรับห้องนี้
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px] whitespace-nowrap min-w-[100px]">เลขที่</TableHead>
                    <TableHead className="whitespace-nowrap min-w-[200px]">รหัส/ชื่อ - นามสกุล</TableHead>
                    <TableHead className="whitespace-nowrap min-w-[120px] text-center">สถิติ</TableHead>
                    {assignments.map(a => (
                      <TableHead key={a.id} className="whitespace-nowrap min-w-[150px] text-center" title={a.title}>
                        <div className="max-w-[150px] truncate mx-auto">{a.title}</div>
                        <div className="text-xs text-gray-400 font-normal mt-1">
                          {new Date(`${a.due_date ?? a.created_at}T00:00:00`).toLocaleDateString('th-TH')}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentsInClass.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={assignments.length + 3} className="text-center py-8 text-gray-500">
                        ยังไม่มีนักเรียนในห้องนี้
                      </TableCell>
                    </TableRow>
                  ) : (
                    overviewRows.map(({ student, statuses, handledCount, attentionCount }) => {
                      return (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium whitespace-nowrap">{student.number}</TableCell>
                          <TableCell className="whitespace-nowrap">{student.name}</TableCell>
                          <TableCell className="text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full">
                                ส่งแล้ว/ตรวจ: {handledCount}
                              </span>
                              <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                                 ต้องติดตาม: {attentionCount}
                              </span>
                            </div>
                          </TableCell>
                          {assignments.map((a, index) => {
                            const statusMeta = SUBMISSION_STATUS_MAP[statuses[index]];
                            return (
                              <TableCell key={a.id} className="text-center whitespace-nowrap">
                                <div className="flex justify-center">
                                  <Badge variant="outline" className={statusMeta.badgeClass}>{statusMeta.shortLabel}</Badge>
                                </div>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })

                    
                  )
                }
              </TableBody>
            </Table>
        </div>
      )
    }
    </CardContent>
  </Card>
</TabsContent>
      </Tabs>

      <Dialog
        open={Boolean(editingAssignment)}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseEditAssignment();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แก้ไขข้อมูลการบ้าน</DialogTitle>
            <DialogDescription>ปรับชื่อ รายละเอียด กำหนดส่ง และข้อมูลประกอบของการบ้าน</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateAssignment} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-assignment-title">หัวข้อการบ้าน</Label>
              <Input
                id="edit-assignment-title"
                value={editingAssignmentForm.title}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setEditingAssignmentForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="เช่น แบบฝึกหัดภาษาไทย หน้า 20"
                disabled={isSavingAssignment}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-assignment-description">รายละเอียด</Label>
              <Textarea
                id="edit-assignment-description"
                value={editingAssignmentForm.description}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setEditingAssignmentForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="เช่น อ่านเรื่องสั้นแล้วตอบคำถาม 5 ข้อ"
                disabled={isSavingAssignment}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-assignment-due-date">กำหนดส่ง</Label>
                <Input
                  id="edit-assignment-due-date"
                  type="date"
                  value={editingAssignmentForm.dueDate}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setEditingAssignmentForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                  disabled={isSavingAssignment}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-assignment-max-score">คะแนนเต็ม</Label>
                <Input
                  id="edit-assignment-max-score"
                  type="number"
                  min="0"
                  value={editingAssignmentForm.maxScore}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setEditingAssignmentForm((prev) => ({ ...prev, maxScore: event.target.value }))}
                  disabled={isSavingAssignment}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-assignment-attachment">ลิงก์ใบงาน / รูปภาพ</Label>
              <Input
                id="edit-assignment-attachment"
                value={editingAssignmentForm.attachmentUrl}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setEditingAssignmentForm((prev) => ({ ...prev, attachmentUrl: e.target.value }))}
                placeholder="https://..."
                disabled={isSavingAssignment}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseEditAssignment} disabled={isSavingAssignment}>
                ยกเลิก
              </Button>
              <Button type="submit" disabled={isSavingAssignment || !editingAssignmentForm.title.trim()}>
                {isSavingAssignment && <Loader2 className="h-4 w-4 animate-spin" />}
                บันทึกการแก้ไข
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(assignmentToDelete)}
        onOpenChange={(open) => {
          if (!open && !isDeletingAssignment) {
            setAssignmentToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบการบ้าน</AlertDialogTitle>
            <AlertDialogDescription>
              {assignmentToDelete
                ? `รายการ "${assignmentToDelete.title}" และสถานะการส่งงานของรายการนี้จะถูกลบถาวร`
                : "รายการนี้จะถูกลบถาวร"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingAssignment}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={isDeletingAssignment}
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteAssignment();
              }}
            >
              {isDeletingAssignment && <Loader2 className="h-4 w-4 animate-spin" />}
              ลบการบ้าน
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(selectedStudentHistory)} onOpenChange={(open) => { if (!open) setSelectedStudentHistory(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>ประวัติการส่งงานของ {selectedStudentHistory?.name}</DialogTitle>
            <DialogDescription>ดูแนวโน้มการส่งการบ้านย้อนหลังของนักเรียนคนนี้ในห้องปัจจุบัน</DialogDescription>
          </DialogHeader>
          {selectedStudentHistory && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                {[
                  { label: "ส่งแล้ว", value: historyStats.submitted + historyStats.reviewed, className: "bg-emerald-50 text-emerald-700" },
                  { label: "ส่งช้า", value: historyStats.late, className: "bg-amber-50 text-amber-700" },
                  { label: "ต้องแก้ไข", value: historyStats.needs_revision, className: "bg-orange-50 text-orange-700" },
                  { label: "ยังไม่ส่ง", value: historyStats.pending + historyStats.missing, className: "bg-rose-50 text-rose-700" },
                ].map((item) => (
                  <div key={item.label} className={`rounded-2xl p-4 ${item.className}`}>
                    <p className="text-xs font-semibold">{item.label}</p>
                    <p className="mt-1 text-2xl font-bold">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="max-h-[320px] overflow-y-auto rounded-2xl border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>การบ้าน</TableHead>
                      <TableHead>กำหนดส่ง</TableHead>
                      <TableHead className="text-right">สถานะ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyRows.map(({ assignment, status }) => {
                      const statusMeta = SUBMISSION_STATUS_MAP[normalizeSubmissionStatus(status)];
                      return (
                        <TableRow key={`${selectedStudentHistory.id}_${assignment.id}`}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-slate-800">{assignment.title}</p>
                              {assignment.description && <p className="text-xs text-slate-500">{assignment.description}</p>}
                            </div>
                          </TableCell>
                          <TableCell>{assignment.due_date ? format(new Date(`${assignment.due_date}T00:00:00`), "d MMM yyyy", { locale: th }) : "-"}</TableCell>
                          <TableCell className="text-right"><Badge variant="outline" className={statusMeta.badgeClass}>{statusMeta.label}</Badge></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

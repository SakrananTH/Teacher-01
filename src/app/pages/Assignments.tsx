import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
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
import { CheckCircle2, Loader2, Pencil, Trash2, XCircle } from "lucide-react";
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
  classroom_id: string;
  created_at: string;
}

export function Assignments() {
  const { user } = useAuth();
  
  const [students, setStudents] = useState<Student[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  
  const [newAssignmentTopic, setNewAssignmentTopic] = useState("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>("");
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [editingAssignmentTitle, setEditingAssignmentTitle] = useState("");
  const [assignmentToDelete, setAssignmentToDelete] = useState<Assignment | null>(null);
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);
  const [isDeletingAssignment, setIsDeletingAssignment] = useState(false);

  const [submissions, setSubmissions] = useState<Record<string, "submitted" | "missing" | "pending">>({});
  const [allSubmissions, setAllSubmissions] = useState<Record<string, Record<string, string>>>({});
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
      setSubmissions({});
    }
  }, [selectedAssignmentId]);

  const selectedClassObj = classrooms.find(c => c.id === selectedClassId);
  const studentsInClass = students.filter((s) => s.classRoom === selectedClassObj?.name);

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

      const newAllSubmissions: Record<string, Record<string, string>> = {};
      
      studentsInClass.forEach(s => {
        newAllSubmissions[s.id] = {};
      });

      data?.forEach(sub => {
        if (!newAllSubmissions[sub.student_id]) {
          newAllSubmissions[sub.student_id] = {};
        }
        newAllSubmissions[sub.student_id][sub.assignment_id] = sub.status;
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
      toast.error("ดึงข้อมูลนักเรียนและห้องเรียนล้มเหล໗", { description: error.message });
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
      toast.error("ดึงข้อมูลการบ้านล้มแหลว", { description: error.message });
    }
  };

  const fetchSubmissions = async (assignmentId: string) => {
    try {
      const { data, error } = await supabase
        .from('assignment_submissions')
        .select('*')
        .eq('assignment_id', assignmentId);

      if (error) throw error;
      
      const newSubmissions: Record<string, "submitted" | "missing" | "pending"> = {};
      data?.forEach(sub => {
        newSubmissions[`${assignmentId}_${sub.student_id}`] = sub.status as any;
      });
      setSubmissions(newSubmissions);
    } catch (error: any) {
      toast.error("ดึงข้อมูลการส๋งงานล้มแหลว", { description: error.message });
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssignmentTopic.trim() || !selectedClassId) return;

    try {
      const { data, error } = await supabase
        .from('assignments')
        .insert({
          owner_user_id: user!.id,
          classroom_id: selectedClassId,
          title: newAssignmentTopic,
        })
        .select()
        .single();

      if (error) throw error;

      setAssignments([data, ...assignments]);
      setNewAssignmentTopic("");
      setSelectedAssignmentId(data.id);
      toast.success("สร้างการบ้านสำเร็ฌ");
    } catch (error: any) {
      toast.error("สร้างการบ้านล้มแหลว", { description: error.message });
    }
  };

  const handleOpenEditAssignment = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setEditingAssignmentTitle(assignment.title);
  };

  const handleCloseEditAssignment = () => {
    setEditingAssignment(null);
    setEditingAssignmentTitle("");
  };

  const handleUpdateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingAssignment) return;

    const trimmedTitle = editingAssignmentTitle.trim();
    if (!trimmedTitle) return;

    try {
      setIsSavingAssignment(true);
      const { data, error } = await supabase
        .from('assignments')
        .update({ title: trimmedTitle })
        .eq('id', editingAssignment.id)
        .select('id, title')
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

  const handleToggleSubmission = async (studentId: string, status: "submitted" | "missing") => {
    if (!selectedAssignmentId) return;
    
    const key = `${selectedAssignmentId}_${studentId}`;
    const currentStatus = submissions[key] || "pending";
    const newStatus = currentStatus === status ? "pending" : status;

    setSubmissions((prev) => ({
      ...prev,
      [key]: newStatus,
    }));

    try {
      const { error } = await supabase
        .from('assignment_submissions')
        .upsert({
          assignment_id: selectedAssignmentId,
          student_id: studentId,
          status: newStatus,
          submitted_at: newStatus === "submitted" ? new Date().toISOString() : null,
        }, {
          onConflict: 'assignment_id,student_id'
        });

      if (error) throw error;
    } catch (error: any) {
      setSubmissions((prev) => ({
        ...prev,
        [key]: currentStatus,
      }));
      toast.error("อัปเดตสถานะล้มเหลว", { description: error.message });
    }
  };

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
          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
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
                <SelectItem value="" disabled>ไม่มีข้อมูลห้องเรียน</SelectItem>
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
                        value={newAssignmentTopic}
                        onChange={(e) => setNewAssignmentTopic(e.target.value)}
                        disabled={!selectedClassId}
                      />
                    </div>
                    <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={!selectedClassId || !newAssignmentTopic.trim()}>
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
                              <p className="text-xs text-gray-500 mt-1">{new Date(assignment.created_at).toLocaleDateString('th-TH')}</p>
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
                    เช็คชื่อส่งงาน : {" "}
                    {selectedAssignmentId 
                      ? assignments.find(a => a.id === selectedAssignmentId)?.title 
                      : "กรุณาเลือกการบ้าน"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!selectedAssignmentId ? (
                    <div className="text-center py-10 text-gray-500">
                      โปรดเลือกการบ้านเพื่อตรวจสอบการส่งงาน
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[100px]">เลขที่</TableHead>
                          <TableHead>รหัส/ชื่อ - นามสกุล</TableHead>
                          <TableHead className="text-center">สถานะ</TableHead>
                          <TableHead className="text-right">จัดการ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentsInClass.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-gray-500">ยังไม่มีนักเรียนในห้องนี้</TableCell>
                          </TableRow>
                        ) : (
                          studentsInClass.map((student) => {
                            const status = submissions[`${selectedAssignmentId}_${student.id}`] || "pending";
                            
                            return (
                              <TableRow key={student.id}>
                                <TableCell className="font-medium">{student.number}</TableCell>
                                <TableCell>{student.name}</TableCell>
                                <TableCell className="text-center">
                                  {status === "submitted" && <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600">ส่งแล้ว</Badge>}
                                  {status === "missing" && <Badge variant="destructive">ไม่ส่งงาน</Badge>}
                                  {status === "pending" && <Badge variant="outline" className="text-gray-500">รอดำเนินการ</Badge>}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button 
                                      size="sm" 
                                      variant={status === "submitted" ? "default" : "outline"}
                                      className={status === "submitted" ? "bg-emerald-500 hover:bg-emerald-600 focus:bg-emerald-600 text-white border-emerald-500" : "flex items-center gap-1"}
                                      onClick={() => handleToggleSubmission(student.id, "submitted")}
                                    >
                                      <CheckCircle2 className="w-4 h-4" /> ส่ง
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant={status === "missing" ? "destructive" : "outline"}
                                      className={status === "missing" ? "" : "flex items-center gap-1 text-red-500 hover:text-red-600"}
                                      onClick={() => handleToggleSubmission(student.id, "missing")}
                                    >
                                      <XCircle className="w-4 h-4" /> ไม่ส่ง
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                      )}
                    </TableBody>
                  </Table>
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
                          {new Date(a.created_at).toLocaleDateString('th-TH')}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentsInClass.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={assignments.length + 3} className="text-center py-8 text-gray-500">
                        ยังไม่มีนักเรียนแนห้องนี้
                      </TableCell>
                    </TableRow>
                  ) : (
                    studentsInClass.map(student => {
                      const studentSubmissions = allSubmissions[student.id] || {};
                      let submittedCount = 0;
                      let missingCount = 0;

                      assignments.forEach(a => {
                        const status = studentSubmissions[a.id];
                        if (status === "submitted") submittedCount++;
                        if (status === "missing") missingCount++;
                      });

                      return (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium whitespace-nowrap">{student.number}</TableCell>
                          <TableCell className="whitespace-nowrap">{student.name}</TableCell>
                          <TableCell className="text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full">
                                ส๋ง: {submittedCount}
                              </span>
                              <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-1 rounded-full">
                                 ขาด/ยัง: {assignments.length - submittedCount}
                              </span>
                            </div>
                          </TableCell>
                          {assignments.map(a => {
                            const status = studentSubmissions[a.id] || "pending";
                            return (
                              <TableCell key={a.id} className="text-center whitespace-nowrap">
                                <div className="flex justify-center">
                                  {status === "submitted" && <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600">ส๋งแล้ว</Badge>}
                                  {status === "missing" && <Badge variant="destructive">ไม่ส๋งงาน</Badge>}
                                  {status === "pending" && <Badge variant="outline" className="text-gray-500">รอดำเนินการ</Badge>}
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
            <DialogTitle>แก้ไขหัวข้อการบ้าน</DialogTitle>
            <DialogDescription>ปรับชื่อหัวข้อการบ้านให้ตรงกับงานที่ต้องการตรวจ</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateAssignment} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-assignment-title">หัวข้อการบ้าน</Label>
              <Input
                id="edit-assignment-title"
                value={editingAssignmentTitle}
                onChange={(event) => setEditingAssignmentTitle(event.target.value)}
                placeholder="เช่น แบบฝึกหัดภาษาไทย หน้า 20"
                disabled={isSavingAssignment}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseEditAssignment} disabled={isSavingAssignment}>
                ยกเลิก
              </Button>
              <Button type="submit" disabled={isSavingAssignment || !editingAssignmentTitle.trim()}>
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
    </div>
  );
}

import { format } from "date-fns";
import { th } from "date-fns/locale";
import { supabase } from "../lib/supabase";
import { exportToExcel } from "../../utils/exportExcel";
import { api } from "../api";
import { toast } from "sonner";

export const handleGlobalExport = async () => {
  try {
    // ดึงข้อมูลรายชื่อนักเรียนและยอดเงินออม
    const [rawStudents, rawBalances] = await Promise.all([
      api.getStudents(),
      api.getBalances(),
    ]);

    // ดึงข้อมูลรายเดือนของเดือนปัจจุบันสำหรับระบบอื่นๆ
    const currentDate = new Date();
    const startDateStr = format(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1), "yyyy-MM-dd");
    const endDateStr = format(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0), "yyyy-MM-dd");

    const [attendanceRes, milkRes, toothRes] = await Promise.all([
      supabase.from("attendance_records").select("student_id, status").gte("attendance_date", startDateStr).lte("attendance_date", endDateStr),
      supabase.from("milk_records").select("student_id, status").gte("record_date", startDateStr).lte("record_date", endDateStr),
      supabase.from("toothbrush_records").select("student_id, status").gte("record_date", startDateStr).lte("record_date", endDateStr),
    ]);

    const excelData = rawStudents.map(student => {
      const savings = Number(rawBalances[student.id]) || 0;
      
      const studentAttendance = attendanceRes.data?.filter(a => a.student_id === student.id) || [];
      const presentCount = studentAttendance.filter(a => a.status === 'present').length;
      
      const studentMilk = milkRes.data?.filter(m => m.student_id === student.id) || [];
      const drankCount = studentMilk.filter(m => m.status === 'drank').length;

      const studentTooth = toothRes.data?.filter(t => t.student_id === student.id) || [];
      const brushedCount = studentTooth.filter(t => t.status === 'brushed').length;

      return {
        'ห้องเรียน': student.classRoom || "ทั่วไป",
        'เลขที่': student.number,
        'ชื่อ-นามสกุล': student.name,
        'มาเรียน (ครั้ง/เดือน)': presentCount,
        'ดื่มนม (ครั้ง/เดือน)': drankCount,
        'แปรงฟัน (ครั้ง/เดือน)': brushedCount,
        'ยอดเงินออม (บาท)': savings,
      };
    });

    // เรียงลำดับตามห้องและเลขที่
    excelData.sort((a, b) => {
      if (a['ห้องเรียน'] !== b['ห้องเรียน']) {
        return a['ห้องเรียน'].localeCompare(b['ห้องเรียน']);
      }
      return (a['เลขที่'] || 0) - (b['เลขที่'] || 0);
    });

    const monthName = format(currentDate, "MMMM_yyyy", { locale: th });
    
    exportToExcel(excelData, `รายงานสรุปรวมระบบทั้งหมด_${monthName}`);
    toast.success("ดาวน์โหลดรายงานสรุปรวมสำเร็จ");
  } catch (error: any) {
    console.error(error);
    toast.error("ส่งออกรายงานล้มเหลว", { description: error.message });
  }
};
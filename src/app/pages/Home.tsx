import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { api } from "../api";
import { Users, PiggyBank, ClipboardCheck, AlertCircle, Filter, PieChart as PieChartIcon } from "lucide-react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface Student {
  id: string;
  name: string;
  number: number;
  classRoom?: string;
}

const ALL_CLASSES = ["ป.1", "ป.2", "ป.3", "ป.4", "ป.5", "ป.6"];
const CLASS_COLORS: Record<string, string> = {
  "ป.1": "#ef4444",
  "ป.2": "#f97316",
  "ป.3": "#eab308",
  "ป.4": "#22c55e",
  "ป.5": "#3b82f6",
  "ป.6": "#8b5cf6",
};
const STUDENT_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#f43f5e", "#8b5cf6", "#ec4899", "#14b8a6", "#64748b"];

export function Home() {
  const [rawStudents, setRawStudents] = useState<Student[]>([]);
  const [rawBalances, setRawBalances] = useState<Record<string, number>>({});
  const [rawAttendance, setRawAttendance] = useState<Record<string, string>>({});
  const [selectedClass, setSelectedClass] = useState<string>("ทั้งหมด");
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const today = new Date();
        const dateString = format(today, "yyyy-MM-dd");
        
        const [students, balances, attendance] = await Promise.all([
          api.getStudents(),
          api.getBalances(),
          api.getAttendance(dateString),
        ]);

        setRawStudents(students);
        setRawBalances(balances as Record<string, number>);
        setRawAttendance(attendance as Record<string, string>);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const uniqueClasses = useMemo(() => {
    const otherClasses = Array.from(new Set(rawStudents.map((s) => s.classRoom || "ทั่วไป")))
      .filter((className) => className && !ALL_CLASSES.includes(className))
      .sort();

    return ["ทั้งหมด", ...ALL_CLASSES.filter((className) => rawStudents.some((s) => (s.classRoom || "ทั่วไป") === className)), ...otherClasses];
  }, [rawStudents]);

  const dashboardData = useMemo(() => {
    const filteredStudents = rawStudents.filter(
      (s) => selectedClass === "ทั้งหมด" || (s.classRoom || "ทั่วไป") === selectedClass
    );

    const studentIds = new Set(filteredStudents.map(s => s.id));

    const totalStudents = filteredStudents.length;
    
    let totalSavings = 0;
    filteredStudents.forEach(s => {
      totalSavings += Number(rawBalances[s.id]) || 0;
    });
    
    let present = 0, absent = 0, late = 0, leave = 0;
    filteredStudents.forEach(s => {
      const actualStatus = rawAttendance[s.id] || "present";
      if (actualStatus === "present") present++;
      if (actualStatus === "absent") absent++;
      if (actualStatus === "late") late++;
      if (actualStatus === "leave") leave++;
    });

    const chartData = [
      { name: "มาเรียน", value: present, color: "#10b981" },
      { name: "สาย", value: late, color: "#f59e0b" },
      { name: "ลา", value: leave, color: "#3b82f6" },
      { name: "ขาด", value: absent, color: "#f43f5e" },
    ].filter(d => d.value > 0);

    let savingsChartData: { name: string; value: number; color: string }[] = [];
    if (selectedClass === "ทั้งหมด") {
      const classSavings: Record<string, number> = {};
      filteredStudents.forEach(s => {
        const c = s.classRoom || "ทั่วไป";
        classSavings[c] = (classSavings[c] || 0) + (Number(rawBalances[s.id]) || 0);
      });

      const orderedClassSavings = ALL_CLASSES
        .map((className) => ({
          name: className,
          value: classSavings[className] || 0,
          color: CLASS_COLORS[className],
        }))
        .filter((item) => item.value > 0);

      const extraClassSavings = Object.entries(classSavings)
        .filter(([name, value]) => !ALL_CLASSES.includes(name) && value > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value], index) => ({
          name,
          value,
          color: STUDENT_COLORS[index % STUDENT_COLORS.length],
        }));

      savingsChartData = [...orderedClassSavings, ...extraClassSavings];
    } else {
      const studentSavings = filteredStudents
        .map(s => ({
          name: s.name,
          value: Number(rawBalances[s.id]) || 0
        }))
        .filter(s => s.value > 0)
        .sort((a, b) => b.value - a.value);

      const top5 = studentSavings.slice(0, 5);
      const others = studentSavings.slice(5).reduce((sum, s) => sum + s.value, 0);
      
      savingsChartData = top5.map((s, i) => ({
        name: s.name.split(" ")[0] || s.name,
        value: s.value,
              color: STUDENT_COLORS[i % STUDENT_COLORS.length]
      }));

      if (others > 0) {
        savingsChartData.push({
          name: "อื่นๆ",
          value: others,
                color: STUDENT_COLORS[top5.length % STUDENT_COLORS.length]
        });
      }
    }

    return {
      totalStudents,
      totalSavings,
      attendanceStats: { present, absent, late, leave },
      chartData,
      savingsChartData
    };
  }, [rawStudents, rawBalances, rawAttendance, selectedClass]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center animate-pulse">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-slate-400 font-medium text-sm">กำลังโหลดแดชบอร์ด...</p>
        </div>
      </div>
    );
  }

  const currentDate = format(new Date(), "d MMMM yyyy", { locale: th });

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header Overview */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">ภาพรวมระบบ</h1>
          <p className="text-slate-500 mt-1">ข้อมูลสรุปประจำวันที่ {currentDate}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 w-full sm:w-48 flex items-center focus-within:ring-4 focus-within:ring-blue-500/10 focus-within:border-blue-400 transition-all">
          <Filter size={16} className="text-slate-400 mr-2" />
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            title="กรองตามห้องเรียน"
            className="w-full bg-transparent border-none outline-none text-slate-700 font-medium text-sm cursor-pointer"
          >
            {uniqueClasses.map(c => (
              <option key={c} value={c}>{c === "ทั้งหมด" ? "ทุกห้องเรียน" : c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          onClick={() => navigate("/students")}
          className="bg-white border-2 border-violet-100 hover:border-violet-300 rounded-3xl p-6 cursor-pointer transition-all group"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-violet-600 font-bold text-sm mb-2">จำนวนนักเรียนทั้งหมด</p>
              <h3 className="text-4xl font-extrabold text-slate-800 group-hover:text-violet-700 transition-colors">
                {dashboardData.totalStudents}
                <span className="text-lg text-slate-400 font-medium ml-2">คน</span>
              </h3>
            </div>
            <div className="w-14 h-14 bg-violet-50 text-violet-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users size={28} />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          onClick={() => navigate("/attendance")}
          className="bg-white border-2 border-emerald-100 hover:border-emerald-300 rounded-3xl p-6 cursor-pointer transition-all group"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-emerald-600 font-bold text-sm mb-2">เข้าเรียนวันนี้</p>
              <h3 className="text-4xl font-extrabold text-slate-800 group-hover:text-emerald-700 transition-colors">
                {dashboardData.attendanceStats.present}
                <span className="text-lg text-slate-400 font-medium ml-2">คน</span>
              </h3>
              <div className="flex flex-wrap gap-2 mt-3">
                <p className="text-xs font-bold text-rose-500 bg-rose-50 px-2 py-1 rounded-md">ขาด {dashboardData.attendanceStats.absent}</p>
                <p className="text-xs font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded-md">สาย {dashboardData.attendanceStats.late}</p>
                <p className="text-xs font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-md">ลา {dashboardData.attendanceStats.leave}</p>
              </div>
            </div>
            <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <ClipboardCheck size={28} />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          onClick={() => navigate("/savings")}
          className="bg-white border-2 border-orange-100 hover:border-orange-300 rounded-3xl p-6 cursor-pointer transition-all group"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-orange-600 font-bold text-sm mb-2">ยอดเงินออมรวม</p>
              <h3 className="text-4xl font-extrabold text-slate-800 group-hover:text-orange-700 transition-colors">
                {dashboardData.totalSavings.toLocaleString()}
                <span className="text-lg text-slate-400 font-medium ml-2">บาท</span>
              </h3>
            </div>
            <div className="w-14 h-14 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <PiggyBank size={28} />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {dashboardData.chartData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="bg-white border-2 border-slate-100 rounded-3xl p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500">
                <PieChartIcon size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">สัดส่วนการเข้าเรียน</h3>
                <p className="text-sm text-slate-400">ข้อมูลสรุปสถานะการมาเรียนของนักเรียนในวันนี้</p>
              </div>
            </div>
            
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dashboardData.chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {dashboardData.chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ fontWeight: 'bold' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '14px', fontWeight: '500' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {dashboardData.savingsChartData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
            className="bg-white border-2 border-slate-100 rounded-3xl p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500">
                <PiggyBank size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">สัดส่วนเงินออมรวม</h3>
                <p className="text-sm text-slate-400">ข้อมูลการออมเงินจำแนกตาม{selectedClass === "ทั้งหมด" ? "ระดับชั้น ป.1-ป.6" : "รายบุคคล"}</p>
              </div>
            </div>
            
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dashboardData.savingsChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {dashboardData.savingsChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ fontWeight: 'bold' }}
                    formatter={(value: number) => [`${value} บาท`, 'ยอดเงินออม']}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '14px', fontWeight: '500' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}
      </div>

      {/* Alert Section if something needs attention */}
      {dashboardData.totalStudents === 0 && (
        <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl flex items-start gap-4">
          <AlertCircle className="text-blue-500 shrink-0 mt-0.5" size={24} />
          <div>
            <h4 className="font-bold text-blue-800 mb-1">เริ่มต้นใช้งานระบบ</h4>
            <p className="text-blue-600/80 text-sm mb-3">ดูเหมือนว่าคุณยังไม่ได้เพิ่มข้อมูลนักเรียนในระบบ หรือในห้องเรียนที่เลือก กรุณาตรวจสอบอีกครั้ง</p>
            <button onClick={() => navigate("/students")} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all">
              ไปที่หน้าจัดการนักเรียน
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { api } from "../api";
import { toast } from "sonner";
import {
  PiggyBank,
  ArrowUpCircle,
  ArrowDownCircle,
  History,
  AlertCircle,
  X,
  Search,
  Wallet,
  TrendingUp,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion } from "motion/react";

interface Student {
  id: string;
  number: number;
  name: string;
  classRoom?: string;
}

interface Transaction {
  id: string;
  amount: number;
  type: "deposit" | "withdraw";
  date: string;
}

export function Savings() {
  const [students, setStudents] = useState<Student[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState<string>("ทั้งหมด");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [studentsData, balancesData] = await Promise.all([
        api.getStudents(),
        api.getBalances(),
      ]);
      setStudents(studentsData);
      setBalances(balancesData);
    } catch (error: any) {
      toast.error("โหลดข้อมูลล้มเหลว", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const openStudentModal = async (student: Student) => {
    setSelectedStudent(student);
    setIsModalOpen(true);
    setAmount("");
    try {
      const txs = await api.getTransactions(student.id);
      setTransactions(txs);
    } catch (error: any) {
      toast.error("ดึงประวัติไม่ได้", { description: error.message });
    }
  };

  const handleTransaction = async (type: "deposit" | "withdraw") => {
    if (!selectedStudent || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("กรุณาระบุจำนวนเงินที่ถูกต้อง");
      return;
    }
    try {
      const res = await api.addTransaction({
        studentId: selectedStudent.id,
        amount: Number(amount),
        type,
        date: new Date().toISOString(),
      });
      setBalances((prev) => ({ ...prev, [selectedStudent.id]: res.balance }));
      setTransactions([res.transaction, ...transactions]);
      setAmount("");
      toast.success(type === "deposit" ? "ฝากเงินสำเร็จ" : "ถอนเงินสำเร็จ");
    } catch (error: any) {
      toast.error("ทำรายการไม่สำเร็จ", { description: error.message });
    }
  };

  const uniqueClasses = ["ทั้งหมด", ...Array.from(new Set(students.map(s => s.classRoom || "ทั่วไป"))).filter(Boolean)].sort();

  const filteredStudents = students.filter(
    (s) => {
      const matchSearch = s.name.includes(search) || s.number.toString() === search;
      const matchClass = selectedClass === "ทั้งหมด" || (s.classRoom || "ทั่วไป") === selectedClass;
      return matchSearch && matchClass;
    }
  );
  const totalSavings = Object.values(balances).reduce((sum, b) => sum + (Number(b) || 0), 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
            <PiggyBank size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">ระบบออมเงิน</h1>
            <p className="text-slate-400 text-sm">จัดการบัญชีเงินฝากของนักเรียน</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-5 py-3 flex items-center gap-3">
            <Wallet className="text-amber-500" size={20} />
            <div>
              <p className="text-[11px] font-bold text-amber-500/80 uppercase tracking-wider">ยอดรวมทั้งห้อง</p>
              <p className="text-xl font-extrabold text-amber-600">{totalSavings.toLocaleString()} บาท</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 flex-1 focus-within:ring-4 focus-within:ring-amber-500/10 focus-within:border-amber-400 transition-all">
          <Search size={18} className="text-slate-300" />
          <input
            type="text"
            placeholder="ค้นหาชื่อ หรือเลขที่นักเรียน..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-none bg-transparent outline-none text-slate-700 font-medium flex-1 w-full placeholder:text-slate-300 text-sm"
          />
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 w-full sm:w-48 flex items-center focus-within:ring-4 focus-within:ring-amber-500/10 focus-within:border-amber-400 transition-all">
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

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center animate-pulse">
              <PiggyBank className="text-amber-500" size={20} />
            </div>
            <p className="text-slate-400 font-medium text-sm">กำลังโหลดข้อมูล...</p>
          </div>
        </div>
      ) : students.length === 0 ? (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-10 text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mb-4">
            <AlertCircle className="text-amber-500" size={28} />
          </div>
          <h3 className="text-lg font-bold text-amber-800 mb-1">ยังไม่มีรายชื่อนักเรียน</h3>
          <p className="text-amber-600/70 text-sm">กรุณาไปที่เมนู "จัดการนักเรียน" เพื่อเพิ่มรายชื่อก่อน</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStudents.map((student, i) => {
            const bal = balances[student.id] || 0;
            return (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                onClick={() => openStudentModal(student)}
                className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-amber-300 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm group-hover:bg-amber-100 group-hover:text-amber-700 transition-all">
                    {student.number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h3 className="font-bold text-slate-700 truncate text-sm group-hover:text-amber-700 transition-colors">
                        {student.name}
                      </h3>
                      <span className="text-[10px] bg-slate-50 text-slate-400 px-1.5 py-0.5 rounded-md">{student.classRoom || "ทั่วไป"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {bal > 0 && <TrendingUp size={12} className="text-emerald-500" />}
                      <span className={`text-sm font-extrabold ${bal > 0 ? "text-emerald-600" : "text-slate-400"}`}>
                        {bal.toLocaleString()} บาท
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <Dialog.Root open={isModalOpen} onOpenChange={setIsModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] bg-white rounded-3xl overflow-hidden border border-slate-200">
            {selectedStudent && (
              <>
                {/* Header */}
                <div className="bg-amber-500 px-6 pt-6 pb-8 text-white relative">
                  <Dialog.Close className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/10 flex items-center justify-center hover:bg-black/20 transition-colors">
                    <X size={16} />
                  </Dialog.Close>
                  <Dialog.Title className="text-lg font-bold">
                    เลขที่ {selectedStudent.number} - {selectedStudent.name}
                  </Dialog.Title>
                  <Dialog.Description className="text-amber-100 text-sm mt-0.5">
                    ทำรายการฝาก-ถอน และดูประวัติ
                  </Dialog.Description>
                </div>

                {/* Balance Card */}
                <div className="-mt-4 mx-6 bg-white rounded-2xl p-5 border border-slate-200 text-center mb-4">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">ยอดเงินคงเหลือ</p>
                  <p className="text-3xl font-extrabold text-slate-800">
                    {(balances[selectedStudent.id] || 0).toLocaleString()}
                    <span className="text-lg text-slate-400 ml-1">บาท</span>
                  </p>
                </div>

                {/* Transaction */}
                <div className="px-6 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex-1 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 font-bold text-sm">฿</span>
                      <input
                        type="number"
                        min="1"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="จำนวนเงิน"
                        className="w-full pl-8 pr-3 py-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none font-semibold text-slate-800 bg-slate-50 focus:bg-white transition-all text-sm"
                      />
                    </div>
                    <button
                      onClick={() => handleTransaction("deposit")}
                      className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white py-3 px-4 rounded-xl font-bold transition-all text-sm"
                    >
                      <ArrowUpCircle size={16} /> ฝาก
                    </button>
                    <button
                      onClick={() => handleTransaction("withdraw")}
                      className="flex items-center gap-1.5 bg-rose-500 hover:bg-rose-600 text-white py-3 px-4 rounded-xl font-bold transition-all text-sm"
                    >
                      <ArrowDownCircle size={16} /> ถอน
                    </button>
                  </div>
                </div>

                {/* History */}
                <div className="px-6 pb-6">
                  <h4 className="font-bold text-slate-600 flex items-center gap-2 mb-3 text-sm">
                    <History size={16} className="text-slate-400" />
                    ประวัติล่าสุด
                  </h4>
                  <div className="dialog-scrollbar space-y-2 max-h-48 overflow-y-auto pr-1">
                    {transactions.length === 0 ? (
                      <div className="text-center text-slate-300 text-sm py-6">ยังไม่มีประวัติการทำรายการ</div>
                    ) : (
                      transactions.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100/60">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tx.type === "deposit" ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"}`}>
                              {tx.type === "deposit" ? <ArrowUpCircle size={14} /> : <ArrowDownCircle size={14} />}
                            </div>
                            <div>
                              <p className="font-bold text-slate-700 text-sm">
                                {tx.type === "deposit" ? "ฝากเงิน" : "ถอนเงิน"}
                              </p>
                              <p className="text-[11px] text-slate-400">
                                {format(new Date(tx.date), "d MMM yyyy, HH:mm", { locale: th })}
                              </p>
                            </div>
                          </div>
                          <span className={`font-extrabold text-sm ${tx.type === "deposit" ? "text-emerald-600" : "text-rose-600"}`}>
                            {tx.type === "deposit" ? "+" : "-"}{tx.amount.toLocaleString()} บาท
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

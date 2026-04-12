// @ts-nocheck
import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js";
const app = new Hono().basePath("/make-server-80ad9986");
const createAdminClient = ()=>createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
const createUserClient = (token)=>createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });
function getBearerToken(c) {
  const authorization = c.req.header("Authorization") || "";
  return authorization.replace(/^Bearer\s+/i, "").trim();
}
async function requireUser(c) {
  const token = getBearerToken(c);
  if (!token) {
    return {
      error: c.json({
        error: "Unauthorized"
      }, 401)
    };
  }
  const supabaseUser = createUserClient(token);
  const { data, error } = await supabaseUser.auth.getUser();
  if (error || !data.user) {
    return {
      error: c.json({
        error: "Unauthorized"
      }, 401)
    };
  }
  const supabaseAdmin = createAdminClient();
  return {
    user: data.user,
    supabaseAdmin
  };
}
async function ensureTeacherProfile(supabaseAdmin, user, fallbackName) {
  const displayName = fallbackName || user.user_metadata?.name || user.email?.split("@")[0] || "คุณครู";
  const { error } = await supabaseAdmin.from("teacher_profiles").upsert({
    user_id: user.id,
    email: user.email,
    display_name: displayName,
    role: "teacher"
  });
  if (error) {
    throw new Error(error.message);
  }
}
async function getOrCreateClassroomId(supabaseAdmin, ownerUserId, classRoom) {
  const normalizedClassRoom = classRoom?.trim() || "ทั่วไป";
  const { data: existingClassrooms, error: existingClassroomsError } = await supabaseAdmin.from("classrooms").select("id").eq("owner_user_id", ownerUserId).eq("name", normalizedClassRoom).order("created_at", {
    ascending: true
  }).limit(1);
  if (existingClassroomsError) {
    throw new Error(existingClassroomsError.message);
  }
  if (existingClassrooms && existingClassrooms.length > 0) {
    return existingClassrooms[0].id;
  }
  const { data: insertedClassroom, error: insertedClassroomError } = await supabaseAdmin.from("classrooms").insert({
    owner_user_id: ownerUserId,
    name: normalizedClassRoom
  }).select("id").single();
  if (insertedClassroomError) {
    throw new Error(insertedClassroomError.message);
  }
  return insertedClassroom.id;
}
async function listStudentsFromDatabase(supabaseAdmin, ownerUserId) {
  const [{ data: students, error: studentsError }, { data: classrooms, error: classroomsError }] = await Promise.all([
    supabaseAdmin.from("students").select("id, student_no, full_name, classroom_id").eq("owner_user_id", ownerUserId).order("student_no", {
      ascending: true
    }),
    supabaseAdmin.from("classrooms").select("id, name").eq("owner_user_id", ownerUserId)
  ]);
  if (studentsError) {
    throw new Error(studentsError.message);
  }
  if (classroomsError) {
    throw new Error(classroomsError.message);
  }
  const classroomMap = new Map((classrooms || []).map((classroom)=>[
      classroom.id,
      classroom.name
    ]));
  return (students || []).map((student)=>({
      id: student.id,
      number: student.student_no,
      name: student.full_name,
      classRoom: student.classroom_id ? classroomMap.get(student.classroom_id) || "ทั่วไป" : "ทั่วไป"
    }));
}
async function getOrCreateSavingsAccount(supabaseAdmin, ownerUserId, studentId) {
  const { data: existingAccount, error: existingAccountError } = await supabaseAdmin.from("savings_accounts").select("id, student_id, current_balance").eq("owner_user_id", ownerUserId).eq("student_id", studentId).maybeSingle();
  if (existingAccountError) {
    throw new Error(existingAccountError.message);
  }
  if (existingAccount) {
    return existingAccount;
  }
  const { data: insertedAccount, error: insertedAccountError } = await supabaseAdmin.from("savings_accounts").insert({
    owner_user_id: ownerUserId,
    student_id: studentId,
    current_balance: 0
  }).select("id, student_id, current_balance").single();
  if (insertedAccountError) {
    throw new Error(insertedAccountError.message);
  }
  return insertedAccount;
}
app.use("*", logger(console.log));
app.use("*", cors());
app.get("/api/ping", (c)=>c.json({
    message: "pong"
  }));
app.post("/api/signup", async (c)=>{
  const { email, password, name } = await c.req.json();
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    user_metadata: {
      name: name || "คุณครู"
    },
    email_confirm: true
  });
  if (error) {
    const normalizedMessage = error.message.toLowerCase();
    if (normalizedMessage.includes("already been registered") || normalizedMessage.includes("already registered")) {
      return c.json({
        error: "อีเมลนี้ถูกใช้งานแล้ว",
        code: "EMAIL_ALREADY_REGISTERED"
      }, 409);
    }
    return c.json({
      error: error.message,
      code: "SIGNUP_FAILED"
    }, 400);
  }
  await ensureTeacherProfile(supabaseAdmin, data.user, name || "คุณครู");
  return c.json({
    success: true,
    user: data.user
  });
});
app.post("/api/init", async (c)=>{
  const auth = await requireUser(c);
  if (auth.error) {
    return auth.error;
  }
  const { user, supabaseAdmin } = auth;
  await ensureTeacherProfile(supabaseAdmin, user);
  const { count, error } = await supabaseAdmin.from("students").select("id", {
    count: "exact",
    head: true
  }).eq("owner_user_id", user.id);
  if (error) {
    return c.json({
      error: error.message
    }, 500);
  }
  if ((count || 0) === 0) {
    const mockStudents = [
      {
        id: crypto.randomUUID(),
        number: 1,
        name: "ด.ช. สมชาย รักเรียน",
        classRoom: "ม.1/1"
      },
      {
        id: crypto.randomUUID(),
        number: 2,
        name: "ด.ญ. สมหญิง ใจดี",
        classRoom: "ม.1/1"
      },
      {
        id: crypto.randomUUID(),
        number: 3,
        name: "ด.ช. ปิติ มานะ",
        classRoom: "ม.1/2"
      },
      {
        id: crypto.randomUUID(),
        number: 4,
        name: "ด.ญ. ชูใจ ขยัน",
        classRoom: "ม.1/2"
      }
    ];
    for (const s of mockStudents){
      const classroomId = await getOrCreateClassroomId(supabaseAdmin, user.id, s.classRoom);
      const { error: insertStudentError } = await supabaseAdmin.from("students").insert({
        id: s.id,
        owner_user_id: user.id,
        student_no: s.number,
        full_name: s.name,
        classroom_id: classroomId
      });
      if (insertStudentError) {
        return c.json({
          error: insertStudentError.message
        }, 500);
      }
      const { error: insertSavingsAccountError } = await supabaseAdmin.from("savings_accounts").upsert({
        owner_user_id: user.id,
        student_id: s.id,
        current_balance: 0
      }, {
        onConflict: "student_id"
      });
      if (insertSavingsAccountError) {
        return c.json({
          error: insertSavingsAccountError.message
        }, 500);
      }
    }
    return c.json({
      success: true,
      mockStudents
    });
  }
  return c.json({
    success: true,
    message: "Already initialized"
  });
});
app.get("/api/students", async (c)=>{
  try {
    const auth = await requireUser(c);
    if (auth.error) {
      return auth.error;
    }
    const { user, supabaseAdmin } = auth;
    const students = await listStudentsFromDatabase(supabaseAdmin, user.id);
    return c.json(students);
  } catch (error) {
    return c.json({
      error: error instanceof Error ? error.message : "Failed to fetch students"
    }, 500);
  }
});
app.post("/api/students", async (c)=>{
  const { id, name, number, classRoom } = await c.req.json();
  try {
    const auth = await requireUser(c);
    if (auth.error) {
      return auth.error;
    }
    const { user, supabaseAdmin } = auth;
    await ensureTeacherProfile(supabaseAdmin, user);
    const studentId = id || crypto.randomUUID();
    const normalizedClassRoom = classRoom?.trim() || "ทั่วไป";
    const classroomId = await getOrCreateClassroomId(supabaseAdmin, user.id, normalizedClassRoom);
    const studentQuery = id ? supabaseAdmin.from("students").update({
      student_no: number,
      full_name: name,
      classroom_id: classroomId,
      status: "active"
    }).eq("id", studentId).eq("owner_user_id", user.id).select("id, student_no, full_name").single() : supabaseAdmin.from("students").insert({
      id: studentId,
      owner_user_id: user.id,
      student_no: number,
      full_name: name,
      classroom_id: classroomId,
      status: "active"
    }).select("id, student_no, full_name").single();
    const { data: student, error: studentError } = await studentQuery;
    if (studentError) {
      return c.json({
        error: studentError.message
      }, 400);
    }
    if (!id) {
      const { error: savingsAccountError } = await supabaseAdmin.from("savings_accounts").upsert({
        owner_user_id: user.id,
        student_id: studentId,
        current_balance: 0
      }, {
        onConflict: "student_id"
      });
      if (savingsAccountError) {
        return c.json({
          error: savingsAccountError.message
        }, 400);
      }
    }
    return c.json({
      id: student.id,
      number: student.student_no,
      name: student.full_name,
      classRoom: normalizedClassRoom
    });
  } catch (error) {
    return c.json({
      error: error instanceof Error ? error.message : "Failed to save student"
    }, 500);
  }
});
app.delete("/api/students/:id", async (c)=>{
  const id = c.req.param("id");
  const auth = await requireUser(c);
  if (auth.error) {
    return auth.error;
  }
  const { user, supabaseAdmin } = auth;
  const { error } = await supabaseAdmin.from("students").delete().eq("id", id).eq("owner_user_id", user.id);
  if (error) {
    return c.json({
      error: error.message
    }, 400);
  }
  return c.json({
    success: true
  });
});
app.get("/api/attendance", async (c)=>{
  const date = c.req.query("date");
  try {
    const auth = await requireUser(c);
    if (auth.error) {
      return auth.error;
    }
    const { user, supabaseAdmin } = auth;
    const { data, error } = await supabaseAdmin.from("attendance_records").select("student_id, status").eq("owner_user_id", user.id).eq("attendance_date", date);
    if (error) {
      return c.json({
        error: error.message
      }, 500);
    }
    const mapped = (data || []).reduce((acc, row)=>{
      acc[row.student_id] = row.status;
      return acc;
    }, {});
    return c.json(mapped);
  } catch (error) {
    return c.json({
      error: error instanceof Error ? error.message : "Failed to fetch attendance"
    }, 500);
  }
});
app.post("/api/attendance", async (c)=>{
  const { date, records } = await c.req.json();
  try {
    const auth = await requireUser(c);
    if (auth.error) {
      return auth.error;
    }
    const { user, supabaseAdmin } = auth;
    const rows = Object.entries(records || {}).map(([studentId, status])=>({
        owner_user_id: user.id,
        student_id: studentId,
        attendance_date: date,
        status
      }));
    if (rows.length > 0) {
      const { error } = await supabaseAdmin.from("attendance_records").upsert(rows, {
        onConflict: "owner_user_id,student_id,attendance_date"
      });
      if (error) {
        return c.json({
          error: error.message
        }, 400);
      }
    }
    return c.json({
      success: true
    });
  } catch (error) {
    return c.json({
      error: error instanceof Error ? error.message : "Failed to save attendance"
    }, 500);
  }
});
app.get("/api/savings", async (c)=>{
  try {
    const auth = await requireUser(c);
    if (auth.error) {
      return auth.error;
    }
    const { user, supabaseAdmin } = auth;
    const { data, error } = await supabaseAdmin.from("savings_accounts").select("student_id, current_balance").eq("owner_user_id", user.id);
    if (error) {
      return c.json({
        error: error.message
      }, 500);
    }
    const mapped = (data || []).reduce((acc, item)=>{
      acc[item.student_id] = Number(item.current_balance) || 0;
      return acc;
    }, {});
    return c.json(mapped);
  } catch (error) {
    return c.json({
      error: error instanceof Error ? error.message : "Failed to fetch balances"
    }, 500);
  }
});
app.post("/api/savings/transaction", async (c)=>{
  const { studentId, amount, type, date } = await c.req.json();
  try {
    const auth = await requireUser(c);
    if (auth.error) {
      return auth.error;
    }
    const { user, supabaseAdmin } = auth;
    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return c.json({
        error: "จำนวนเงินไม่ถูกต้อง"
      }, 400);
    }
    const account = await getOrCreateSavingsAccount(supabaseAdmin, user.id, studentId);
    const txId = crypto.randomUUID();
    const { data: transaction, error: transactionError } = await supabaseAdmin.from("savings_transactions").insert({
      id: txId,
      owner_user_id: user.id,
      account_id: account.id,
      student_id: studentId,
      transaction_type: type,
      amount: parsedAmount,
      transaction_at: date
    }).select("id, student_id, transaction_type, amount, transaction_at").single();
    if (transactionError) {
      const message = transactionError.message || "Failed to save transaction";
      if (message.toLowerCase().includes("insufficient balance")) {
        return c.json({
          error: "Insufficient balance / ยอดเงินไม่เพียงพอ"
        }, 400);
      }
      return c.json({
        error: message
      }, 400);
    }
    const { data: refreshedAccount, error: refreshedAccountError } = await supabaseAdmin.from("savings_accounts").select("current_balance").eq("id", account.id).single();
    if (refreshedAccountError) {
      return c.json({
        error: refreshedAccountError.message
      }, 500);
    }
    return c.json({
      success: true,
      balance: Number(refreshedAccount.current_balance) || 0,
      transaction: {
        id: transaction.id,
        studentId: transaction.student_id,
        amount: Number(transaction.amount),
        type: transaction.transaction_type,
        date: transaction.transaction_at
      }
    });
  } catch (error) {
    return c.json({
      error: error instanceof Error ? error.message : "Failed to save transaction"
    }, 500);
  }
});
app.get("/api/savings/transactions/:studentId", async (c)=>{
  const studentId = c.req.param("studentId");
  try {
    const auth = await requireUser(c);
    if (auth.error) {
      return auth.error;
    }
    const { user, supabaseAdmin } = auth;
    const { data, error } = await supabaseAdmin.from("savings_transactions").select("id, student_id, transaction_type, amount, transaction_at").eq("owner_user_id", user.id).eq("student_id", studentId).order("transaction_at", {
      ascending: false
    });
    if (error) {
      return c.json({
        error: error.message
      }, 500);
    }
    return c.json((data || []).map((item)=>({
        id: item.id,
        studentId: item.student_id,
        amount: Number(item.amount),
        type: item.transaction_type,
        date: item.transaction_at
      })));
  } catch (error) {
    return c.json({
      error: error instanceof Error ? error.message : "Failed to fetch transactions"
    }, 500);
  }
});
export default {
  fetch: app.fetch
};

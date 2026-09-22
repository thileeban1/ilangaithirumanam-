import React, { useEffect, useState } from "react";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  getDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { db, auth, firebaseConfigured } from "./firebase.js";

// ---------- constants & helpers ----------

const AUTH_ERROR_MESSAGES = {
  "auth/invalid-credential": "மின்னஞ்சல் அல்லது கடவுச்சொல் தவறு.",
  "auth/wrong-password": "மின்னஞ்சல் அல்லது கடவுச்சொல் தவறு.",
  "auth/user-not-found": "மின்னஞ்சல் அல்லது கடவுச்சொல் தவறு.",
  "auth/invalid-email": "மின்னஞ்சல் முறையற்றது.",
  "auth/email-already-in-use": "இந்த மின்னஞ்சல் ஏற்கனவே பதிவு செய்யப்பட்டுள்ளது.",
  "auth/weak-password": "கடவுச்சொல் மிகவும் எளிமையானது (குறைந்தது 6 எழுத்துகள்).",
  "auth/too-many-requests": "பல தவறான முயற்சிகள். சிறிது நேரம் கழித்து முயற்சிக்கவும்.",
  "auth/user-disabled": "இந்த கணக்கு முடக்கப்பட்டுள்ளது.",
};
const authErrorMessage = (e) =>
  AUTH_ERROR_MESSAGES[e?.code] || "செயல் தோல்வியடைந்தது. மீண்டும் முயற்சிக்கவும்.";

const enrollmentId = (studentId, courseId) => `${studentId}_${courseId}`;

const ROLE_LABEL = {
  admin: "நிர்வாகி",
  teacher: "ஆசிரியர்",
  student: "மாணவர்",
};

// ---------- styles ----------

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f4f6fb",
    color: "#1c2333",
    fontFamily: "'Inter','Noto Sans Tamil',sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 20px",
    background: "#1e2a52",
    color: "#fff",
    flexWrap: "wrap",
    gap: 10,
  },
  brand: { fontSize: 18, fontWeight: 700, letterSpacing: 0.2 },
  badge: {
    fontSize: 12,
    background: "rgba(255,255,255,0.15)",
    padding: "4px 10px",
    borderRadius: 999,
  },
  headerRight: { display: "flex", alignItems: "center", gap: 10 },
  container: { maxWidth: 960, margin: "0 auto", padding: "24px 16px 60px" },
  authWrap: { maxWidth: 420, margin: "60px auto", padding: "0 16px" },
  card: {
    background: "#fff",
    borderRadius: 14,
    padding: 22,
    boxShadow: "0 1px 3px rgba(20,25,50,0.08)",
    border: "1px solid #e6e9f2",
    marginBottom: 18,
  },
  h1: { fontSize: 24, fontWeight: 700, margin: "0 0 6px" },
  h2: { fontSize: 18, fontWeight: 700, margin: "0 0 14px" },
  muted: { color: "#6b7284", fontSize: 14 },
  label: { display: "block", fontSize: 13, fontWeight: 600, margin: "12px 0 6px", color: "#404860" },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #d7dbe8",
    fontSize: 15,
    fontFamily: "inherit",
    background: "#fbfcfe",
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #d7dbe8",
    fontSize: 15,
    fontFamily: "inherit",
    minHeight: 100,
    resize: "vertical",
    background: "#fbfcfe",
  },
  select: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #d7dbe8",
    fontSize: 15,
    fontFamily: "inherit",
    background: "#fbfcfe",
  },
  button: {
    padding: "10px 18px",
    borderRadius: 8,
    border: "none",
    background: "#2f4bd8",
    color: "#fff",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  },
  buttonGhost: {
    padding: "9px 16px",
    borderRadius: 8,
    border: "1px solid #d7dbe8",
    background: "#fff",
    color: "#2f3752",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  },
  buttonDanger: {
    padding: "9px 16px",
    borderRadius: 8,
    border: "1px solid #f3b9c0",
    background: "#fff5f6",
    color: "#c22740",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  },
  buttonSmall: {
    padding: "7px 12px",
    borderRadius: 7,
    border: "none",
    background: "#2f4bd8",
    color: "#fff",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  },
  error: {
    background: "#fdeef0",
    color: "#c22740",
    padding: "10px 12px",
    borderRadius: 8,
    fontSize: 13.5,
    margin: "12px 0",
  },
  notice: {
    background: "#eaf4ff",
    color: "#1c4d8f",
    padding: "10px 12px",
    borderRadius: 8,
    fontSize: 13.5,
    margin: "12px 0",
  },
  tabBar: { display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" },
  tabButton: (active) => ({
    padding: "9px 16px",
    borderRadius: 999,
    border: active ? "1px solid #2f4bd8" : "1px solid #d7dbe8",
    background: active ? "#2f4bd8" : "#fff",
    color: active ? "#fff" : "#2f3752",
    fontWeight: 600,
    fontSize: 13.5,
    cursor: "pointer",
  }),
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" },
  listItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "12px 0",
    borderBottom: "1px solid #eef0f6",
    flexWrap: "wrap",
  },
  pill: {
    fontSize: 12,
    padding: "3px 9px",
    borderRadius: 999,
    background: "#eef1fb",
    color: "#2f4bd8",
    fontWeight: 600,
  },
  pillWarn: {
    fontSize: 12,
    padding: "3px 9px",
    borderRadius: 999,
    background: "#fff3e0",
    color: "#a15c00",
    fontWeight: 600,
  },
  linkBtn: {
    background: "none",
    border: "none",
    color: "#2f4bd8",
    fontWeight: 600,
    fontSize: 13.5,
    cursor: "pointer",
    padding: 0,
  },
  lesson: {
    padding: "14px 0",
    borderBottom: "1px solid #eef0f6",
  },
};

// ---------- small shared bits ----------

function Header({ profile, amAdmin, onLogout }) {
  const roleText = amAdmin ? ROLE_LABEL.admin : profile ? ROLE_LABEL[profile.role] : "";
  return (
    <div style={styles.header}>
      <div style={styles.brand}>கல்வி கற்றல் மேலாண்மை</div>
      {(amAdmin || profile) && (
        <div style={styles.headerRight}>
          {roleText && <span style={styles.badge}>{roleText}</span>}
          {profile?.name && <span style={styles.badge}>{profile.name}</span>}
          <button style={styles.buttonGhost} onClick={onLogout}>
            வெளியேறு
          </button>
        </div>
      )}
    </div>
  );
}

function ErrorBox({ msg }) {
  if (!msg) return null;
  return <div style={styles.error}>{msg}</div>;
}

// ---------- auth screen ----------

function AuthScreen() {
  const [mode, setMode] = useState("login"); // login | signup | reset
  const [role, setRole] = useState("student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [resetSent, setResetSent] = useState(false);

  const resetFormMsgs = () => {
    setErr("");
    setResetSent(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    resetFormMsgs();
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e2) {
      setErr(authErrorMessage(e2));
    } finally {
      setBusy(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    resetFormMsgs();
    if (!name.trim()) return setErr("பெயரை உள்ளிடவும்.");
    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await setDoc(doc(db, "users", cred.user.uid), {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        role,
        approved: role === "student",
        createdAt: serverTimestamp(),
      });
    } catch (e2) {
      setErr(authErrorMessage(e2));
      setBusy(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    resetFormMsgs();
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResetSent(true);
    } catch (e2) {
      setErr(authErrorMessage(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.authWrap}>
      <div style={styles.card}>
        <h1 style={styles.h1}>கல்வி கற்றல் மேலாண்மை</h1>
        <p style={styles.muted}>
          {mode === "login" && "உங்கள் கணக்கில் நுழையவும்."}
          {mode === "signup" && "புதிய கணக்கு உருவாக்கவும்."}
          {mode === "reset" && "கடவுச்சொல்லை மீட்டமைக்கவும்."}
        </p>

        {mode === "signup" && (
          <form onSubmit={handleSignup}>
            <label style={styles.label}>நான் ஒரு...</label>
            <select style={styles.select} value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="student">மாணவர் (Student)</option>
              <option value="teacher">ஆசிரியர் (Teacher)</option>
            </select>

            <label style={styles.label}>முழு பெயர்</label>
            <input style={styles.input} value={name} onChange={(e) => setName(e.target.value)} required />

            <label style={styles.label}>தொடர்பு எண்</label>
            <input style={styles.input} value={phone} onChange={(e) => setPhone(e.target.value)} />

            <label style={styles.label}>மின்னஞ்சல்</label>
            <input
              style={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label style={styles.label}>கடவுச்சொல்</label>
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />

            {role === "teacher" && (
              <div style={styles.notice}>
                ஆசிரியர் கணக்குகள் நிர்வாகி ஏற்றுக்கொண்ட பின்னரே பாடம் சேர்க்க முடியும்.
              </div>
            )}

            <ErrorBox msg={err} />
            <div style={{ marginTop: 16 }}>
              <button style={styles.button} disabled={busy} type="submit">
                {busy ? "..." : "கணக்கு உருவாக்கு"}
              </button>
            </div>
          </form>
        )}

        {mode === "login" && (
          <form onSubmit={handleLogin}>
            <label style={styles.label}>மின்னஞ்சல்</label>
            <input
              style={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <label style={styles.label}>கடவுச்சொல்</label>
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <ErrorBox msg={err} />
            <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
              <button style={styles.button} disabled={busy} type="submit">
                {busy ? "..." : "உள்நுழை"}
              </button>
            </div>
          </form>
        )}

        {mode === "reset" && (
          <form onSubmit={handleReset}>
            <label style={styles.label}>மின்னஞ்சல்</label>
            <input
              style={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <ErrorBox msg={err} />
            {resetSent && <div style={styles.notice}>Reset link உங்கள் மின்னஞ்சலுக்கு அனுப்பப்பட்டது.</div>}
            <div style={{ marginTop: 16 }}>
              <button style={styles.button} disabled={busy} type="submit">
                {busy ? "..." : "Reset Link அனுப்பு"}
              </button>
            </div>
          </form>
        )}

        <div style={{ marginTop: 18, display: "flex", gap: 14, flexWrap: "wrap" }}>
          {mode !== "login" && (
            <button style={styles.linkBtn} onClick={() => { setMode("login"); resetFormMsgs(); }}>
              உள்நுழைவுக்கு திரும்பு
            </button>
          )}
          {mode !== "signup" && (
            <button style={styles.linkBtn} onClick={() => { setMode("signup"); resetFormMsgs(); }}>
              புதிய கணக்கு
            </button>
          )}
          {mode !== "reset" && (
            <button style={styles.linkBtn} onClick={() => { setMode("reset"); resetFormMsgs(); }}>
              கடவுச்சொல் மறந்துவிட்டதா?
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- data hooks ----------

function useCollectionState(buildQuery, deps) {
  const [data, setData] = useState([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const q = buildQuery();
    if (!q) {
      setData([]);
      setReady(true);
      return;
    }
    setReady(false);
    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setReady(true);
      },
      () => setReady(true)
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return [data, ready];
}

// ---------- Admin dashboard ----------

function AdminDashboard() {
  const [tab, setTab] = useState("courses");
  const [users] = useCollectionState(() => collection(db, "users"), []);
  const [courses] = useCollectionState(() => collection(db, "courses"), []);
  const [enrollments] = useCollectionState(() => collection(db, "enrollments"), []);

  const teachers = users.filter((u) => u.role === "teacher");
  const approvedTeachers = teachers.filter((t) => t.approved);
  const pendingTeachers = teachers.filter((t) => !t.approved);
  const students = users.filter((u) => u.role === "student");

  const enrollCountFor = (courseId) => enrollments.filter((e) => e.courseId === courseId).length;
  const studentCourseCount = (studentId) => enrollments.filter((e) => e.studentId === studentId).length;

  const approveTeacher = async (uid) => {
    await updateDoc(doc(db, "users", uid), { approved: true });
  };
  const revokeTeacher = async (uid) => {
    await updateDoc(doc(db, "users", uid), { approved: false });
  };
  const removeUser = async (uid) => {
    if (!confirm("இந்த கணக்கை நீக்கவா?")) return;
    await deleteDoc(doc(db, "users", uid));
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.h1}>நிர்வாகி பலகை</h1>
      <div style={styles.tabBar}>
        <button style={styles.tabButton(tab === "courses")} onClick={() => setTab("courses")}>
          பாடங்கள் ({courses.length})
        </button>
        <button style={styles.tabButton(tab === "teachers")} onClick={() => setTab("teachers")}>
          ஆசிரியர்கள் {pendingTeachers.length > 0 && `(${pendingTeachers.length} புதிது)`}
        </button>
        <button style={styles.tabButton(tab === "students")} onClick={() => setTab("students")}>
          மாணவர்கள் ({students.length})
        </button>
      </div>

      {tab === "courses" && (
        <AdminCoursesTab
          courses={courses}
          approvedTeachers={approvedTeachers}
          enrollCountFor={enrollCountFor}
        />
      )}

      {tab === "teachers" && (
        <div style={styles.card}>
          <h2 style={styles.h2}>ஏற்றுக்கொள்ள வேண்டியவை</h2>
          {pendingTeachers.length === 0 && <p style={styles.muted}>புதிய கோரிக்கைகள் இல்லை.</p>}
          {pendingTeachers.map((t) => (
            <div key={t.id} style={styles.listItem}>
              <div>
                <div style={{ fontWeight: 600 }}>{t.name}</div>
                <div style={styles.muted}>{t.email} {t.phone ? `· ${t.phone}` : ""}</div>
              </div>
              <button style={styles.buttonSmall} onClick={() => approveTeacher(t.id)}>
                ஏற்றுக்கொள்
              </button>
            </div>
          ))}

          <h2 style={{ ...styles.h2, marginTop: 26 }}>ஏற்றுக்கொள்ளப்பட்ட ஆசிரியர்கள்</h2>
          {approvedTeachers.length === 0 && <p style={styles.muted}>யாரும் இல்லை.</p>}
          {approvedTeachers.map((t) => {
            const theirCourses = courses.filter((c) => c.teacherId === t.id);
            return (
              <div key={t.id} style={styles.listItem}>
                <div>
                  <div style={{ fontWeight: 600 }}>{t.name}</div>
                  <div style={styles.muted}>
                    {t.email} · {theirCourses.length > 0 ? theirCourses.map((c) => c.title).join(", ") : "பாடம் இல்லை"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={styles.buttonGhost} onClick={() => revokeTeacher(t.id)}>
                    அணுகல் நிறுத்து
                  </button>
                  <button style={styles.buttonDanger} onClick={() => removeUser(t.id)}>
                    நீக்கு
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "students" && (
        <div style={styles.card}>
          <h2 style={styles.h2}>மாணவர்கள்</h2>
          {students.length === 0 && <p style={styles.muted}>யாரும் பதிவு செய்யவில்லை.</p>}
          {students.map((s) => (
            <div key={s.id} style={styles.listItem}>
              <div>
                <div style={{ fontWeight: 600 }}>{s.name}</div>
                <div style={styles.muted}>
                  {s.email} {s.phone ? `· ${s.phone}` : ""} · {studentCourseCount(s.id)} பாடங்களில் சேர்ந்துள்ளார்
                </div>
              </div>
              <button style={styles.buttonDanger} onClick={() => removeUser(s.id)}>
                நீக்கு
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminCoursesTab({ courses, approvedTeachers, enrollCountFor }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const createCourse = async (e) => {
    e.preventDefault();
    setErr("");
    if (!title.trim()) return setErr("பாட தலைப்பை உள்ளிடவும்.");
    if (!teacherId) return setErr("ஒரு ஆசிரியரை தேர்ந்தெடுக்கவும்.");
    setBusy(true);
    const teacher = approvedTeachers.find((t) => t.id === teacherId);
    try {
      await addDoc(collection(db, "courses"), {
        title: title.trim(),
        description: description.trim(),
        teacherId,
        teacherName: teacher?.name || "",
        active: true,
        createdAt: serverTimestamp(),
      });
      setTitle("");
      setDescription("");
      setTeacherId("");
    } catch (e2) {
      setErr(authErrorMessage(e2));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (course) => {
    await updateDoc(doc(db, "courses", course.id), { active: !course.active });
  };

  const removeCourse = async (courseId) => {
    if (!confirm("இந்த பாடத்தை நீக்கவா? இதனுடன் தொடர்புடைய பாடங்கள்/சேர்க்கைகள் தனியாக நீக்கப்பட வேண்டும்.")) return;
    await deleteDoc(doc(db, "courses", courseId));
  };

  return (
    <>
      <div style={styles.card}>
        <h2 style={styles.h2}>புதிய பாடம் உருவாக்கு</h2>
        {approvedTeachers.length === 0 && (
          <div style={styles.notice}>
            முதலில் "ஆசிரியர்கள்" tab-ல் குறைந்தது ஒரு ஆசிரியரை ஏற்றுக்கொள்ளவும்.
          </div>
        )}
        <form onSubmit={createCourse}>
          <label style={styles.label}>பாட தலைப்பு</label>
          <input style={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} />

          <label style={styles.label}>விளக்கம் (விருப்பம்)</label>
          <textarea style={styles.textarea} value={description} onChange={(e) => setDescription(e.target.value)} />

          <label style={styles.label}>ஆசிரியர்</label>
          <select style={styles.select} value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            <option value="">-- தேர்ந்தெடுக்கவும் --</option>
            {approvedTeachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <ErrorBox msg={err} />
          <div style={{ marginTop: 14 }}>
            <button style={styles.button} disabled={busy} type="submit">
              பாடம் உருவாக்கு
            </button>
          </div>
        </form>
      </div>

      <div style={styles.card}>
        <h2 style={styles.h2}>எல்லா பாடங்களும்</h2>
        {courses.length === 0 && <p style={styles.muted}>இன்னும் பாடங்கள் இல்லை.</p>}
        {courses.map((c) => (
          <div key={c.id} style={styles.listItem}>
            <div>
              <div style={{ fontWeight: 600 }}>
                {c.title} {!c.active && <span style={styles.pillWarn}>மறைக்கப்பட்டது</span>}
              </div>
              <div style={styles.muted}>
                ஆசிரியர்: {c.teacherName || "—"} · {enrollCountFor(c.id)} மாணவர்கள்
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={styles.buttonGhost} onClick={() => toggleActive(c)}>
                {c.active ? "மறை" : "காண்பி"}
              </button>
              <button style={styles.buttonDanger} onClick={() => removeCourse(c.id)}>
                நீக்கு
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ---------- Teacher dashboard ----------

function TeacherDashboard({ profile, uid }) {
  const [courses] = useCollectionState(
    () => query(collection(db, "courses"), where("teacherId", "==", uid)),
    [uid]
  );
  const [selectedCourseId, setSelectedCourseId] = useState("");

  useEffect(() => {
    if (!selectedCourseId && courses.length > 0) setSelectedCourseId(courses[0].id);
  }, [courses, selectedCourseId]);

  if (!profile.approved) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.h1}>வரவேற்கிறோம், {profile.name}</h1>
          <div style={styles.notice}>
            உங்கள் ஆசிரியர் கணக்கு நிர்வாகியின் ஏற்புக்காக காத்திருக்கிறது. ஏற்றுக்கொள்ளப்பட்ட பின்
            உங்களுக்கு பாடம் ஒதுக்கப்பட்டதும் இங்கே பாடம் சேர்க்க முடியும்.
          </div>
        </div>
      </div>
    );
  }

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  return (
    <div style={styles.container}>
      <h1 style={styles.h1}>ஆசிரியர் பலகை</h1>
      {courses.length === 0 ? (
        <div style={styles.card}>
          <p style={styles.muted}>உங்களுக்கு இன்னும் பாடம் எதுவும் ஒதுக்கப்படவில்லை. நிர்வாகியை தொடர்பு கொள்ளவும்.</p>
        </div>
      ) : (
        <>
          {courses.length > 1 && (
            <div style={styles.tabBar}>
              {courses.map((c) => (
                <button
                  key={c.id}
                  style={styles.tabButton(c.id === selectedCourseId)}
                  onClick={() => setSelectedCourseId(c.id)}
                >
                  {c.title}
                </button>
              ))}
            </div>
          )}
          {selectedCourse && <TeacherCoursePanel course={selectedCourse} />}
        </>
      )}
    </div>
  );
}

function TeacherCoursePanel({ course }) {
  const [lessons] = useCollectionState(
    () => query(collection(db, "courses", course.id, "lessons"), orderBy("order", "asc")),
    [course.id]
  );
  const [students] = useCollectionState(
    () => query(collection(db, "enrollments"), where("courseId", "==", course.id)),
    [course.id]
  );
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [editingId, setEditingId] = useState(null);

  const resetForm = () => {
    setTitle("");
    setContent("");
    setLink("");
    setEditingId(null);
  };

  const startEdit = (lesson) => {
    setEditingId(lesson.id);
    setTitle(lesson.title);
    setContent(lesson.content || "");
    setLink(lesson.link || "");
  };

  const submitLesson = async (e) => {
    e.preventDefault();
    setErr("");
    if (!title.trim()) return setErr("பாடத் தலைப்பை உள்ளிடவும்.");
    setBusy(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, "courses", course.id, "lessons", editingId), {
          title: title.trim(),
          content: content.trim(),
          link: link.trim(),
        });
      } else {
        await addDoc(collection(db, "courses", course.id, "lessons"), {
          title: title.trim(),
          content: content.trim(),
          link: link.trim(),
          order: lessons.length,
          createdAt: serverTimestamp(),
        });
      }
      resetForm();
    } catch (e2) {
      setErr(authErrorMessage(e2));
    } finally {
      setBusy(false);
    }
  };

  const removeLesson = async (lessonId) => {
    if (!confirm("இந்த பாடப் பகுதியை நீக்கவா?")) return;
    await deleteDoc(doc(db, "courses", course.id, "lessons", lessonId));
  };

  return (
    <>
      <div style={styles.card}>
        <h2 style={styles.h2}>{course.title}</h2>
        {course.description && <p style={styles.muted}>{course.description}</p>}
        <p style={styles.muted}>{students.length} மாணவர்கள் சேர்ந்துள்ளனர்.</p>
      </div>

      <div style={styles.card}>
        <h2 style={styles.h2}>{editingId ? "பாடப் பகுதியை திருத்து" : "புதிய பாடப் பகுதி / பொருள் சேர்"}</h2>
        <form onSubmit={submitLesson}>
          <label style={styles.label}>தலைப்பு</label>
          <input style={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} />

          <label style={styles.label}>உள்ளடக்கம் / குறிப்புகள்</label>
          <textarea style={styles.textarea} value={content} onChange={(e) => setContent(e.target.value)} />

          <label style={styles.label}>இணைப்பு (Video / PDF / Drive link — விருப்பம்)</label>
          <input style={styles.input} value={link} onChange={(e) => setLink(e.target.value)} />

          <ErrorBox msg={err} />
          <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
            <button style={styles.button} disabled={busy} type="submit">
              {editingId ? "புதுப்பி" : "சேர்"}
            </button>
            {editingId && (
              <button type="button" style={styles.buttonGhost} onClick={resetForm}>
                ரத்து செய்
              </button>
            )}
          </div>
        </form>
      </div>

      <div style={styles.card}>
        <h2 style={styles.h2}>பாடப் பகுதிகள்</h2>
        {lessons.length === 0 && <p style={styles.muted}>இன்னும் எதுவும் சேர்க்கப்படவில்லை.</p>}
        {lessons.map((l) => (
          <div key={l.id} style={styles.lesson}>
            <div style={styles.row}>
              <div style={{ fontWeight: 600 }}>{l.title}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={styles.linkBtn} onClick={() => startEdit(l)}>
                  திருத்து
                </button>
                <button style={{ ...styles.linkBtn, color: "#c22740" }} onClick={() => removeLesson(l.id)}>
                  நீக்கு
                </button>
              </div>
            </div>
            {l.content && <p style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{l.content}</p>}
            {l.link && (
              <a href={l.link} target="_blank" rel="noreferrer" style={{ fontSize: 13.5 }}>
                {l.link}
              </a>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

// ---------- Student dashboard ----------

function StudentDashboard({ profile, uid }) {
  const [tab, setTab] = useState("mine");
  const [courses] = useCollectionState(() => collection(db, "courses"), []);
  const [myEnrollments] = useCollectionState(
    () => query(collection(db, "enrollments"), where("studentId", "==", uid)),
    [uid]
  );
  const [openCourseId, setOpenCourseId] = useState(null);

  const myCourseIds = new Set(myEnrollments.map((e) => e.courseId));
  const myCourses = courses.filter((c) => myCourseIds.has(c.id));
  const browsable = courses.filter((c) => c.active && !myCourseIds.has(c.id));

  const enroll = async (courseId) => {
    await setDoc(doc(db, "enrollments", enrollmentId(uid, courseId)), {
      studentId: uid,
      courseId,
      enrolledAt: serverTimestamp(),
    });
  };

  const unenroll = async (courseId) => {
    if (!confirm("இந்த பாடத்திலிருந்து விலகவா?")) return;
    await deleteDoc(doc(db, "enrollments", enrollmentId(uid, courseId)));
    if (openCourseId === courseId) setOpenCourseId(null);
  };

  const openCourse = myCourses.find((c) => c.id === openCourseId);

  return (
    <div style={styles.container}>
      <h1 style={styles.h1}>வரவேற்கிறோம், {profile.name}</h1>
      <div style={styles.tabBar}>
        <button style={styles.tabButton(tab === "mine")} onClick={() => setTab("mine")}>
          என் பாடங்கள் ({myCourses.length})
        </button>
        <button style={styles.tabButton(tab === "browse")} onClick={() => setTab("browse")}>
          பாடங்களை காணுங்கள்
        </button>
      </div>

      {tab === "mine" && (
        <>
          {openCourse ? (
            <>
              <button style={{ ...styles.linkBtn, marginBottom: 12 }} onClick={() => setOpenCourseId(null)}>
                ← பட்டியலுக்கு திரும்பு
              </button>
              <StudentCourseView course={openCourse} onUnenroll={() => unenroll(openCourse.id)} />
            </>
          ) : (
            <div style={styles.card}>
              {myCourses.length === 0 && (
                <p style={styles.muted}>நீங்கள் இன்னும் எந்த பாடத்திலும் சேரவில்லை. "பாடங்களை காணுங்கள்" tab-ஐ பாருங்கள்.</p>
              )}
              {myCourses.map((c) => (
                <div key={c.id} style={styles.listItem}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{c.title}</div>
                    <div style={styles.muted}>ஆசிரியர்: {c.teacherName || "—"}</div>
                  </div>
                  <button style={styles.buttonSmall} onClick={() => setOpenCourseId(c.id)}>
                    காண்
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "browse" && (
        <div style={styles.card}>
          {browsable.length === 0 && <p style={styles.muted}>தற்போது புதிதாக சேரக்கூடிய பாடங்கள் இல்லை.</p>}
          {browsable.map((c) => (
            <div key={c.id} style={styles.listItem}>
              <div>
                <div style={{ fontWeight: 600 }}>{c.title}</div>
                {c.description && <div style={styles.muted}>{c.description}</div>}
                <div style={styles.muted}>ஆசிரியர்: {c.teacherName || "—"}</div>
              </div>
              <button style={styles.buttonSmall} onClick={() => enroll(c.id)}>
                சேர்
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StudentCourseView({ course, onUnenroll }) {
  const [lessons] = useCollectionState(
    () => query(collection(db, "courses", course.id, "lessons"), orderBy("order", "asc")),
    [course.id]
  );
  return (
    <>
      <div style={styles.card}>
        <div style={styles.row}>
          <h2 style={styles.h2}>{course.title}</h2>
          <button style={styles.buttonDanger} onClick={onUnenroll}>
            விலகு
          </button>
        </div>
        {course.description && <p style={styles.muted}>{course.description}</p>}
        <p style={styles.muted}>ஆசிரியர்: {course.teacherName || "—"}</p>
      </div>

      <div style={styles.card}>
        <h2 style={styles.h2}>பாடப் பகுதிகள்</h2>
        {lessons.length === 0 && <p style={styles.muted}>ஆசிரியர் இன்னும் பொருள் சேர்க்கவில்லை.</p>}
        {lessons.map((l) => (
          <div key={l.id} style={styles.lesson}>
            <div style={{ fontWeight: 600 }}>{l.title}</div>
            {l.content && <p style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{l.content}</p>}
            {l.link && (
              <a href={l.link} target="_blank" rel="noreferrer" style={{ fontSize: 13.5 }}>
                {l.link}
              </a>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

// ---------- root app ----------

export default function App() {
  const [authUser, setAuthUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [amAdmin, setAmAdmin] = useState(false);
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    if (!firebaseConfigured || !auth) {
      setAuthReady(true);
      return;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthUser(u);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!authUser) {
      setProfile(null);
      setAmAdmin(false);
      setProfileReady(true);
      return;
    }
    setProfileReady(false);
    let cancelled = false;
    (async () => {
      const [adminSnap, userSnap] = await Promise.all([
        getDoc(doc(db, "admins", authUser.uid)),
        getDoc(doc(db, "users", authUser.uid)),
      ]);
      if (cancelled) return;
      setAmAdmin(adminSnap.exists());
      setProfile(userSnap.exists() ? { id: userSnap.id, ...userSnap.data() } : null);
      setProfileReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [authUser]);

  const handleLogout = () => signOut(auth);

  if (!firebaseConfigured) {
    return (
      <div style={styles.page}>
        <Header profile={null} amAdmin={false} onLogout={() => {}} />
        <div style={styles.container}>
          <div style={styles.card}>
            <h1 style={styles.h1}>Firebase இணைக்கப்படவில்லை</h1>
            <p style={styles.muted}>
              <code>lms/.env</code> கோப்பில் <code>VITE_FIREBASE_*</code> மதிப்புகளை நிரப்பி மீண்டும் இயக்கவும். (
              <code>lms/.env.example</code>-ஐ பாருங்கள்.)
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!authReady || (authUser && !profileReady)) {
    return (
      <div style={styles.page}>
        <Header profile={null} amAdmin={false} onLogout={() => {}} />
        <div style={styles.container}>
          <p style={styles.muted}>ஏற்றுகிறது...</p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div style={styles.page}>
        <Header profile={null} amAdmin={false} onLogout={() => {}} />
        <AuthScreen />
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <Header profile={profile} amAdmin={amAdmin} onLogout={handleLogout} />
      {amAdmin ? (
        <AdminDashboard />
      ) : profile?.role === "teacher" ? (
        <TeacherDashboard profile={profile} uid={authUser.uid} />
      ) : profile?.role === "student" ? (
        <StudentDashboard profile={profile} uid={authUser.uid} />
      ) : (
        <div style={styles.container}>
          <div style={styles.card}>
            <p style={styles.muted}>உங்கள் கணக்கு விவரம் கிடைக்கவில்லை. நிர்வாகியை தொடர்பு கொள்ளவும்.</p>
          </div>
        </div>
      )}
    </div>
  );
}

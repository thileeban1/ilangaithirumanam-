import React, { useEffect, useState } from "react";
import {
  collection,
  doc,
  documentId,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  getDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  runTransaction,
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

const WHATSAPP_NUMBER = "94752495266"; // 0752495266, Sri Lanka country code added
const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}`;

const AUTH_ERROR_MESSAGES = {
  "auth/invalid-credential": "Code அல்லது கடவுச்சொல் தவறு.",
  "auth/wrong-password": "மின்னஞ்சல் அல்லது கடவுச்சொல் தவறு.",
  "auth/user-not-found": "மின்னஞ்சல் அல்லது கடவுச்சொல் தவறு.",
  "auth/invalid-email": "மின்னஞ்சல் முறையற்றது.",
  "auth/email-already-in-use": "இந்த Code ஏற்கனவே பயன்பாட்டில் உள்ளது.",
  "auth/weak-password": "Code மிகவும் குட்டியாக உள்ளது.",
  "auth/too-many-requests": "பல தவறான முயற்சிகள். சிறிது நேரம் கழித்து முயற்சிக்கவும்.",
  "auth/user-disabled": "இந்த கணக்கு முடக்கப்பட்டுள்ளது.",
};
const authErrorMessage = (e) =>
  AUTH_ERROR_MESSAGES[e?.code] || e?.message || "செயல் தோல்வியடைந்தது. மீண்டும் முயற்சிக்கவும்.";

const ROLE_LABEL = { admin: "நிர்வாகி", teacher: "ஆசிரியர்", student: "மாணவர்" };

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I, avoids confusion
const genCode = (len = 8) => {
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
};
const syntheticEmail = (code) => `${code.toLowerCase()}@kadhiravan-lms.local`;

// ---------- styles (warm "கதிரவன்" / sun theme) ----------

const styles = {
  page: {
    minHeight: "100vh",
    background: "#fbf6ee",
    color: "#2a2013",
    fontFamily: "'Inter','Noto Sans Tamil',sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 20px",
    background: "linear-gradient(120deg,#7a2e0e,#c1440e 55%,#e2792c)",
    color: "#fff",
    flexWrap: "wrap",
    gap: 10,
  },
  brand: { fontSize: 19, fontWeight: 800, letterSpacing: 0.2, display: "flex", alignItems: "center", gap: 8 },
  badge: {
    fontSize: 12,
    background: "rgba(255,255,255,0.18)",
    padding: "4px 10px",
    borderRadius: 999,
  },
  headerRight: { display: "flex", alignItems: "center", gap: 10 },
  container: { maxWidth: 960, margin: "0 auto", padding: "24px 16px 60px" },
  hero: {
    background: "radial-gradient(120% 140% at 20% -10%, #ffd699 0%, #e2792c 45%, #c1440e 85%)",
    color: "#fff",
    padding: "56px 16px 70px",
    textAlign: "center",
  },
  heroSun: {
    width: 72,
    height: 72,
    borderRadius: "50%",
    margin: "0 auto 16px",
    background: "radial-gradient(circle at 35% 30%, #fff6df, #ffcf6e 55%, #ff9d3d 100%)",
    boxShadow: "0 0 0 10px rgba(255,255,255,0.12), 0 0 40px rgba(255,190,90,0.55)",
  },
  heroTitle: { fontSize: 34, fontWeight: 800, margin: "0 0 8px", letterSpacing: 0.3 },
  heroTag: { fontSize: 15.5, opacity: 0.92, maxWidth: 420, margin: "0 auto" },
  authWrap: { maxWidth: 420, margin: "-40px auto 0", padding: "0 16px 40px", position: "relative" },
  card: {
    background: "#fff",
    borderRadius: 16,
    padding: 22,
    boxShadow: "0 10px 30px rgba(120,50,10,0.15)",
    border: "1px solid #f1e3cf",
    marginBottom: 18,
  },
  h1: { fontSize: 24, fontWeight: 800, margin: "0 0 6px" },
  h2: { fontSize: 18, fontWeight: 700, margin: "0 0 14px" },
  muted: { color: "#7a6a52", fontSize: 14 },
  label: { display: "block", fontSize: 13, fontWeight: 600, margin: "12px 0 6px", color: "#5a4a32" },
  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid #e8dcc4",
    fontSize: 16,
    fontFamily: "inherit",
    background: "#fffdf8",
  },
  codeInput: {
    width: "100%",
    padding: "16px 14px",
    borderRadius: 10,
    border: "2px solid #e2792c",
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: 3,
    textAlign: "center",
    textTransform: "uppercase",
    fontFamily: "inherit",
    background: "#fffdf8",
    color: "#7a2e0e",
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #e8dcc4",
    fontSize: 15,
    fontFamily: "inherit",
    minHeight: 100,
    resize: "vertical",
    background: "#fffdf8",
  },
  select: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #e8dcc4",
    fontSize: 15,
    fontFamily: "inherit",
    background: "#fffdf8",
  },
  button: {
    padding: "12px 18px",
    borderRadius: 10,
    border: "none",
    background: "linear-gradient(120deg,#c1440e,#e2792c)",
    color: "#fff",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
  },
  buttonGhost: {
    padding: "9px 16px",
    borderRadius: 8,
    border: "1px solid #e8dcc4",
    background: "#fff",
    color: "#5a4a32",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  },
  buttonDanger: {
    padding: "9px 16px",
    borderRadius: 8,
    border: "1px solid #f3c2ad",
    background: "#fff3ee",
    color: "#a3320f",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  },
  buttonSmall: {
    padding: "7px 12px",
    borderRadius: 7,
    border: "none",
    background: "#c1440e",
    color: "#fff",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  },
  error: {
    background: "#fdeae0",
    color: "#a3320f",
    padding: "10px 12px",
    borderRadius: 8,
    fontSize: 13.5,
    margin: "12px 0",
  },
  notice: {
    background: "#fff4e2",
    color: "#8a5a00",
    padding: "10px 12px",
    borderRadius: 8,
    fontSize: 13.5,
    margin: "12px 0",
  },
  codeResult: {
    background: "#fff7e8",
    border: "2px dashed #e2792c",
    borderRadius: 12,
    padding: "16px",
    textAlign: "center",
    margin: "14px 0",
  },
  codeResultValue: {
    fontSize: 26,
    fontWeight: 800,
    letterSpacing: 4,
    color: "#7a2e0e",
    margin: "6px 0",
  },
  tabBar: { display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" },
  tabButton: (active) => ({
    padding: "9px 16px",
    borderRadius: 999,
    border: active ? "1px solid #c1440e" : "1px solid #e8dcc4",
    background: active ? "#c1440e" : "#fff",
    color: active ? "#fff" : "#5a4a32",
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
    borderBottom: "1px solid #f1e3cf",
    flexWrap: "wrap",
  },
  pill: {
    fontSize: 12,
    padding: "3px 9px",
    borderRadius: 999,
    background: "#fdeee0",
    color: "#c1440e",
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
    color: "#c1440e",
    fontWeight: 600,
    fontSize: 13.5,
    cursor: "pointer",
    padding: 0,
  },
  lesson: {
    padding: "14px 0",
    borderBottom: "1px solid #f1e3cf",
  },
  checkboxRow: { display: "flex", alignItems: "center", gap: 8, padding: "6px 0", fontSize: 14.5 },
  announceCard: {
    background: "linear-gradient(120deg,#fff4e2,#ffe9cf)",
    border: "1px solid #f0d6ab",
    borderRadius: 14,
    padding: 18,
    marginBottom: 18,
  },
  whatsappFab: {
    position: "fixed",
    right: 18,
    bottom: 18,
    background: "#25d366",
    color: "#fff",
    width: 56,
    height: 56,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
    fontSize: 26,
    textDecoration: "none",
    zIndex: 50,
  },
};

// ---------- small shared bits ----------

function Header({ profile, amAdmin, onLogout }) {
  const roleText = amAdmin ? ROLE_LABEL.admin : profile ? ROLE_LABEL[profile.role] : "";
  return (
    <div style={styles.header}>
      <div style={styles.brand}>
        <span>🌞</span> கதிரவன்
      </div>
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

function WhatsAppFab() {
  return (
    <a
      href={WHATSAPP_LINK}
      target="_blank"
      rel="noreferrer"
      style={styles.whatsappFab}
      title="WhatsApp-ல் நிர்வாகியை தொடர்பு கொள்ள"
    >
      💬
    </a>
  );
}

function AnnouncementsBoard() {
  const [items, ready] = useCollectionState(
    () => query(collection(db, "announcements"), orderBy("createdAt", "desc")),
    []
  );
  if (!ready || items.length === 0) return null;
  return (
    <div style={styles.announceCard}>
      <h2 style={{ ...styles.h2, marginBottom: 10 }}>📣 அறிவிப்புகள் / நேர அட்டவணை</h2>
      {items.slice(0, 8).map((a) => (
        <div key={a.id} style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 700 }}>{a.title}</div>
          {a.message && <div style={{ whiteSpace: "pre-wrap", fontSize: 14.5 }}>{a.message}</div>}
          {a.link && (
            <a href={a.link} target="_blank" rel="noreferrer" style={{ fontSize: 13.5 }}>
              {a.link}
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------- auth screen ----------

function AuthScreen() {
  const [mode, setMode] = useState("code"); // code | admin | reset
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [resetSent, setResetSent] = useState(false);

  const resetMsgs = () => {
    setErr("");
    setResetSent(false);
  };

  const handleCodeLogin = async (e) => {
    e.preventDefault();
    resetMsgs();
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return setErr("Access Code-ஐ உள்ளிடவும்.");
    setBusy(true);
    try {
      const codeRef = doc(db, "accessCodes", cleanCode);
      const codeSnap = await getDoc(codeRef);
      if (!codeSnap.exists()) {
        setErr("தவறான Code. சரிபார்த்து மீண்டும் முயற்சிக்கவும்.");
        setBusy(false);
        return;
      }
      const data = codeSnap.data();
      const email2 = syntheticEmail(cleanCode);
      if (data.claimed) {
        await signInWithEmailAndPassword(auth, email2, cleanCode);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email2, cleanCode);
        await setDoc(doc(db, "users", cred.user.uid), {
          role: data.role,
          name: data.label || (data.role === "teacher" ? "ஆசிரியர்" : "மாணவர்"),
          courseIds: data.courseIds || [],
          code: cleanCode,
          createdAt: serverTimestamp(),
        });
        await updateDoc(codeRef, { claimed: true, claimedByUid: cred.user.uid });
      }
    } catch (e2) {
      setErr(authErrorMessage(e2));
      setBusy(false);
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    resetMsgs();
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e2) {
      setErr(authErrorMessage(e2));
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    resetMsgs();
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
    <>
      <div style={styles.hero}>
        <div style={styles.heroSun} />
        <h1 style={styles.heroTitle}>கதிரவன்</h1>
        <p style={styles.heroTag}>உங்கள் Access Code ஒன்றே போதும் — பாடங்களை உடனே பாருங்கள்.</p>
      </div>
      <div style={styles.authWrap}>
        <div style={styles.card}>
          {mode === "code" && (
            <form onSubmit={handleCodeLogin}>
              <label style={styles.label}>உங்கள் Access Code</label>
              <input
                style={styles.codeInput}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="XXXXXXXX"
                autoCapitalize="characters"
                required
              />
              <ErrorBox msg={err} />
              <div style={{ marginTop: 16 }}>
                <button style={{ ...styles.button, width: "100%" }} disabled={busy} type="submit">
                  {busy ? "..." : "நுழை"}
                </button>
              </div>
              <p style={{ ...styles.muted, marginTop: 14, textAlign: "center" }}>
                Code இல்லையா? உங்கள் ஆசிரியர் / நிர்வாகியிடம் கேளுங்கள்.
              </p>
            </form>
          )}

          {mode === "admin" && (
            <form onSubmit={handleAdminLogin}>
              <h2 style={styles.h2}>நிர்வாகி உள்நுழைவு</h2>
              <label style={styles.label}>மின்னஞ்சல்</label>
              <input style={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <label style={styles.label}>கடவுச்சொல்</label>
              <input
                style={styles.input}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <ErrorBox msg={err} />
              <div style={{ marginTop: 16 }}>
                <button style={styles.button} disabled={busy} type="submit">
                  {busy ? "..." : "உள்நுழை"}
                </button>
              </div>
            </form>
          )}

          {mode === "reset" && (
            <form onSubmit={handleReset}>
              <h2 style={styles.h2}>நிர்வாகி கடவுச்சொல் மீட்டமை</h2>
              <label style={styles.label}>மின்னஞ்சல்</label>
              <input style={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <ErrorBox msg={err} />
              {resetSent && <div style={styles.notice}>Reset link உங்கள் மின்னஞ்சலுக்கு அனுப்பப்பட்டது.</div>}
              <div style={{ marginTop: 16 }}>
                <button style={styles.button} disabled={busy} type="submit">
                  {busy ? "..." : "Reset Link அனுப்பு"}
                </button>
              </div>
            </form>
          )}

          <div style={{ marginTop: 18, display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
            {mode !== "code" && (
              <button style={styles.linkBtn} onClick={() => { setMode("code"); resetMsgs(); }}>
                Access Code-ஐ பயன்படுத்த
              </button>
            )}
            {mode !== "admin" && (
              <button style={styles.linkBtn} onClick={() => { setMode("admin"); resetMsgs(); }}>
                நிர்வாகி உள்நுழைவு
              </button>
            )}
            {mode === "admin" && (
              <button style={styles.linkBtn} onClick={() => { setMode("reset"); resetMsgs(); }}>
                கடவுச்சொல் மறந்துவிட்டதா?
              </button>
            )}
          </div>
        </div>
      </div>
      <WhatsAppFab />
    </>
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
  const [codes] = useCollectionState(() => collection(db, "accessCodes"), []);
  const [announcements] = useCollectionState(
    () => query(collection(db, "announcements"), orderBy("createdAt", "desc")),
    []
  );

  const teachers = users.filter((u) => u.role === "teacher");
  const students = users.filter((u) => u.role === "student");
  const teacherCodes = codes.filter((c) => c.role === "teacher");
  const studentCodes = codes.filter((c) => c.role === "student");

  const courseName = (id) => courses.find((c) => c.id === id)?.title || "—";

  return (
    <div style={styles.container}>
      <h1 style={styles.h1}>நிர்வாகி பலகை</h1>
      <div style={styles.tabBar}>
        <button style={styles.tabButton(tab === "courses")} onClick={() => setTab("courses")}>
          பாடங்கள் ({courses.length})
        </button>
        <button style={styles.tabButton(tab === "teachers")} onClick={() => setTab("teachers")}>
          ஆசிரியர்கள் ({teachers.length})
        </button>
        <button style={styles.tabButton(tab === "students")} onClick={() => setTab("students")}>
          மாணவர்கள் ({students.length})
        </button>
        <button style={styles.tabButton(tab === "announcements")} onClick={() => setTab("announcements")}>
          அறிவிப்புகள்
        </button>
      </div>

      {tab === "courses" && <AdminCoursesTab courses={courses} />}

      {tab === "teachers" && (
        <AdminPeopleTab
          role="teacher"
          courses={courses}
          people={teachers}
          codes={teacherCodes}
          courseName={courseName}
        />
      )}

      {tab === "students" && (
        <AdminPeopleTab
          role="student"
          courses={courses}
          people={students}
          codes={studentCodes}
          courseName={courseName}
        />
      )}

      {tab === "announcements" && <AdminAnnouncementsTab announcements={announcements} />}
    </div>
  );
}

function AdminCoursesTab({ courses }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const createCourse = async (e) => {
    e.preventDefault();
    setErr("");
    if (!title.trim()) return setErr("பாட தலைப்பை உள்ளிடவும்.");
    setBusy(true);
    try {
      await addDoc(collection(db, "courses"), {
        title: title.trim(),
        description: description.trim(),
        active: true,
        createdAt: serverTimestamp(),
      });
      setTitle("");
      setDescription("");
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
    if (!confirm("இந்த பாடத்தை நீக்கவா?")) return;
    await deleteDoc(doc(db, "courses", courseId));
  };

  return (
    <>
      <div style={styles.card}>
        <h2 style={styles.h2}>புதிய பாடம் உருவாக்கு</h2>
        <form onSubmit={createCourse}>
          <label style={styles.label}>பாட தலைப்பு</label>
          <input style={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} />
          <label style={styles.label}>விளக்கம் (விருப்பம்)</label>
          <textarea style={styles.textarea} value={description} onChange={(e) => setDescription(e.target.value)} />
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
              {c.description && <div style={styles.muted}>{c.description}</div>}
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

function AdminPeopleTab({ role, courses, people, codes, courseName }) {
  const [label, setLabel] = useState("");
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [generated, setGenerated] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const toggleCourse = (id) => {
    setSelectedCourses((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const roleLabel = role === "teacher" ? "ஆசிரியர்" : "மாணவர்";

  const generateCode = async (e) => {
    e.preventDefault();
    setErr("");
    if (!label.trim()) return setErr("பெயரை உள்ளிடவும்.");
    setBusy(true);
    try {
      let code;
      for (let i = 0; i < 5; i++) {
        code = genCode();
        // eslint-disable-next-line no-await-in-loop
        const existing = await getDoc(doc(db, "accessCodes", code));
        if (!existing.exists()) break;
      }
      await setDoc(doc(db, "accessCodes", code), {
        role,
        label: label.trim(),
        courseIds: selectedCourses,
        claimed: false,
        claimedByUid: null,
        createdAt: serverTimestamp(),
      });
      setGenerated({ code, label: label.trim() });
      setLabel("");
      setSelectedCourses([]);
    } catch (e2) {
      setErr(authErrorMessage(e2));
    } finally {
      setBusy(false);
    }
  };

  const removeCode = async (codeId) => {
    if (!confirm("இந்த Code-ஐ நீக்கவா?")) return;
    await deleteDoc(doc(db, "accessCodes", codeId));
  };

  const removePerson = async (uid) => {
    if (!confirm("இந்த கணக்கை நீக்கவா?")) return;
    await deleteDoc(doc(db, "users", uid));
  };

  const updatePersonCourses = async (uid, courseIds) => {
    await updateDoc(doc(db, "users", uid), { courseIds });
  };

  const unclaimedCodes = codes.filter((c) => !c.claimed);

  return (
    <>
      <div style={styles.card}>
        <h2 style={styles.h2}>புதிய {roleLabel} Access Code உருவாக்கு</h2>
        <form onSubmit={generateCode}>
          <label style={styles.label}>பெயர் (Code யாருக்கு என அறிய)</label>
          <input style={styles.input} value={label} onChange={(e) => setLabel(e.target.value)} />

          <label style={styles.label}>பாடங்கள்</label>
          {courses.length === 0 && <p style={styles.muted}>முதலில் ஒரு பாடத்தை உருவாக்கவும்.</p>}
          {courses.map((c) => (
            <label key={c.id} style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={selectedCourses.includes(c.id)}
                onChange={() => toggleCourse(c.id)}
              />
              {c.title}
            </label>
          ))}

          <ErrorBox msg={err} />
          <div style={{ marginTop: 14 }}>
            <button style={styles.button} disabled={busy} type="submit">
              Code உருவாக்கு
            </button>
          </div>
        </form>

        {generated && (
          <div style={styles.codeResult}>
            <div style={styles.muted}>{generated.label}-க்கான Code</div>
            <div style={styles.codeResultValue}>{generated.code}</div>
            <div style={styles.muted}>இதை {roleLabel}-க்கு கொடுங்கள் — இதுவே அவரின் உள்நுழைவு.</div>
          </div>
        )}
      </div>

      {unclaimedCodes.length > 0 && (
        <div style={styles.card}>
          <h2 style={styles.h2}>இன்னும் பயன்படுத்தப்படாத Codes</h2>
          {unclaimedCodes.map((c) => (
            <div key={c.id} style={styles.listItem}>
              <div>
                <div style={{ fontWeight: 700, letterSpacing: 2 }}>{c.id}</div>
                <div style={styles.muted}>
                  {c.label} · {(c.courseIds || []).map(courseName).join(", ") || "பாடம் இல்லை"}
                </div>
              </div>
              <button style={styles.buttonDanger} onClick={() => removeCode(c.id)}>
                நீக்கு
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={styles.card}>
        <h2 style={styles.h2}>{roleLabel}கள்</h2>
        {people.length === 0 && <p style={styles.muted}>யாரும் இன்னும் Code பயன்படுத்தவில்லை.</p>}
        {people.map((p) => (
          <div key={p.id} style={{ ...styles.listItem, alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontWeight: 600 }}>{p.name}</div>
              <div style={styles.muted}>Code: {p.code}</div>
              <div style={{ marginTop: 6 }}>
                {courses.map((c) => (
                  <label key={c.id} style={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={(p.courseIds || []).includes(c.id)}
                      onChange={() => {
                        const has = (p.courseIds || []).includes(c.id);
                        const next = has
                          ? p.courseIds.filter((x) => x !== c.id)
                          : [...(p.courseIds || []), c.id];
                        updatePersonCourses(p.id, next);
                      }}
                    />
                    {c.title}
                  </label>
                ))}
              </div>
            </div>
            <button style={styles.buttonDanger} onClick={() => removePerson(p.id)}>
              நீக்கு
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function AdminAnnouncementsTab({ announcements }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const post = async (e) => {
    e.preventDefault();
    setErr("");
    if (!title.trim()) return setErr("தலைப்பை உள்ளிடவும்.");
    setBusy(true);
    try {
      await addDoc(collection(db, "announcements"), {
        title: title.trim(),
        message: message.trim(),
        link: link.trim(),
        createdAt: serverTimestamp(),
      });
      setTitle("");
      setMessage("");
      setLink("");
    } catch (e2) {
      setErr(authErrorMessage(e2));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!confirm("இந்த அறிவிப்பை நீக்கவா?")) return;
    await deleteDoc(doc(db, "announcements", id));
  };

  return (
    <>
      <div style={styles.card}>
        <h2 style={styles.h2}>புதிய அறிவிப்பு / நேர அட்டவணை</h2>
        <form onSubmit={post}>
          <label style={styles.label}>தலைப்பு</label>
          <input style={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} />
          <label style={styles.label}>விவரம்</label>
          <textarea style={styles.textarea} value={message} onChange={(e) => setMessage(e.target.value)} />
          <label style={styles.label}>இணைப்பு (நேர அட்டவணை படம்/PDF link — விருப்பம்)</label>
          <input style={styles.input} value={link} onChange={(e) => setLink(e.target.value)} />
          <ErrorBox msg={err} />
          <div style={{ marginTop: 14 }}>
            <button style={styles.button} disabled={busy} type="submit">
              வெளியிடு
            </button>
          </div>
        </form>
      </div>

      <div style={styles.card}>
        <h2 style={styles.h2}>வெளியிடப்பட்ட அறிவிப்புகள்</h2>
        {announcements.length === 0 && <p style={styles.muted}>இன்னும் ஏதும் இல்லை.</p>}
        {announcements.map((a) => (
          <div key={a.id} style={styles.lesson}>
            <div style={styles.row}>
              <div style={{ fontWeight: 700 }}>{a.title}</div>
              <button style={{ ...styles.linkBtn, color: "#a3320f" }} onClick={() => remove(a.id)}>
                நீக்கு
              </button>
            </div>
            {a.message && <p style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{a.message}</p>}
            {a.link && (
              <a href={a.link} target="_blank" rel="noreferrer" style={{ fontSize: 13.5 }}>
                {a.link}
              </a>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

// ---------- Teacher dashboard ----------

function TeacherDashboard({ profile }) {
  const [courses] = useCollectionState(
    () =>
      (profile.courseIds || []).length > 0
        ? query(collection(db, "courses"), where(documentId(), "in", profile.courseIds.slice(0, 10)))
        : null,
    [JSON.stringify(profile.courseIds)]
  );
  const [selectedCourseId, setSelectedCourseId] = useState("");

  useEffect(() => {
    if (!selectedCourseId && courses.length > 0) setSelectedCourseId(courses[0].id);
  }, [courses, selectedCourseId]);

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  return (
    <div style={styles.container}>
      <h1 style={styles.h1}>வரவேற்கிறோம், {profile.name}</h1>
      <AnnouncementsBoard />
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
      <WhatsAppFab />
    </div>
  );
}

function TeacherCoursePanel({ course }) {
  const [lessons] = useCollectionState(
    () => query(collection(db, "courses", course.id, "lessons"), orderBy("order", "asc")),
    [course.id]
  );
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pdfLink, setPdfLink] = useState("");
  const [recordingLink, setRecordingLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [editingId, setEditingId] = useState(null);

  const resetForm = () => {
    setTitle("");
    setContent("");
    setPdfLink("");
    setRecordingLink("");
    setEditingId(null);
  };

  const startEdit = (lesson) => {
    setEditingId(lesson.id);
    setTitle(lesson.title);
    setContent(lesson.content || "");
    setPdfLink(lesson.pdfLink || "");
    setRecordingLink(lesson.recordingLink || "");
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
          pdfLink: pdfLink.trim(),
          recordingLink: recordingLink.trim(),
        });
      } else {
        await addDoc(collection(db, "courses", course.id, "lessons"), {
          title: title.trim(),
          content: content.trim(),
          pdfLink: pdfLink.trim(),
          recordingLink: recordingLink.trim(),
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
      </div>

      <div style={styles.card}>
        <h2 style={styles.h2}>{editingId ? "பாடப் பகுதியை திருத்து" : "புதிய பாடப் பகுதி சேர்"}</h2>
        <form onSubmit={submitLesson}>
          <label style={styles.label}>தலைப்பு</label>
          <input style={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} />

          <label style={styles.label}>உள்ளடக்கம் / குறிப்புகள்</label>
          <textarea style={styles.textarea} value={content} onChange={(e) => setContent(e.target.value)} />

          <label style={styles.label}>PDF இணைப்பு (Google Drive share link — விருப்பம்)</label>
          <input style={styles.input} value={pdfLink} onChange={(e) => setPdfLink(e.target.value)} />

          <label style={styles.label}>Recording இணைப்பு (Video link — மாணவர் 3 முறை மட்டும் பார்க்க முடியும்)</label>
          <input style={styles.input} value={recordingLink} onChange={(e) => setRecordingLink(e.target.value)} />

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
                <button style={{ ...styles.linkBtn, color: "#a3320f" }} onClick={() => removeLesson(l.id)}>
                  நீக்கு
                </button>
              </div>
            </div>
            {l.content && <p style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{l.content}</p>}
            <div style={{ display: "flex", gap: 14, marginTop: 6, flexWrap: "wrap" }}>
              {l.pdfLink && (
                <a href={l.pdfLink} target="_blank" rel="noreferrer" style={{ fontSize: 13.5 }}>
                  📄 PDF
                </a>
              )}
              {l.recordingLink && (
                <a href={l.recordingLink} target="_blank" rel="noreferrer" style={{ fontSize: 13.5 }}>
                  🎥 Recording
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ---------- Student dashboard ----------

function StudentDashboard({ profile, uid }) {
  const [courses] = useCollectionState(
    () =>
      (profile.courseIds || []).length > 0
        ? query(collection(db, "courses"), where(documentId(), "in", profile.courseIds.slice(0, 10)))
        : null,
    [JSON.stringify(profile.courseIds)]
  );
  const [openCourseId, setOpenCourseId] = useState(null);
  const openCourse = courses.find((c) => c.id === openCourseId);

  return (
    <div style={styles.container}>
      <h1 style={styles.h1}>வரவேற்கிறோம், {profile.name}</h1>
      <AnnouncementsBoard />

      {openCourse ? (
        <>
          <button style={{ ...styles.linkBtn, marginBottom: 12 }} onClick={() => setOpenCourseId(null)}>
            ← பாடங்களுக்கு திரும்பு
          </button>
          <StudentCourseView course={openCourse} uid={uid} />
        </>
      ) : (
        <div style={styles.card}>
          <h2 style={styles.h2}>என் பாடங்கள்</h2>
          {courses.length === 0 && <p style={styles.muted}>உங்களுக்கு இன்னும் பாடம் எதுவும் ஒதுக்கப்படவில்லை.</p>}
          {courses.map((c) => (
            <div key={c.id} style={styles.listItem}>
              <div>
                <div style={{ fontWeight: 600 }}>{c.title}</div>
                {c.description && <div style={styles.muted}>{c.description}</div>}
              </div>
              <button style={styles.buttonSmall} onClick={() => setOpenCourseId(c.id)}>
                காண்
              </button>
            </div>
          ))}
        </div>
      )}
      <WhatsAppFab />
    </div>
  );
}

function StudentCourseView({ course, uid }) {
  const [lessons] = useCollectionState(
    () => query(collection(db, "courses", course.id, "lessons"), orderBy("order", "asc")),
    [course.id]
  );
  return (
    <>
      <div style={styles.card}>
        <h2 style={styles.h2}>{course.title}</h2>
        {course.description && <p style={styles.muted}>{course.description}</p>}
      </div>

      <div style={styles.card}>
        <h2 style={styles.h2}>பாடப் பகுதிகள்</h2>
        {lessons.length === 0 && <p style={styles.muted}>ஆசிரியர் இன்னும் பொருள் சேர்க்கவில்லை.</p>}
        {lessons.map((l) => (
          <StudentLessonItem key={l.id} courseId={course.id} lesson={l} uid={uid} />
        ))}
      </div>
    </>
  );
}

function StudentLessonItem({ courseId, lesson, uid }) {
  const [viewCount, setViewCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const ref = doc(db, "courses", courseId, "lessons", lesson.id, "recordingViews", uid);
    const unsub = onSnapshot(ref, (snap) => setViewCount(snap.exists() ? snap.data().count || 0 : 0));
    return unsub;
  }, [courseId, lesson.id, uid]);

  const viewsLeft = Math.max(0, 3 - viewCount);

  const openRecording = async () => {
    setMsg("");
    setBusy(true);
    try {
      const ref = doc(db, "courses", courseId, "lessons", lesson.id, "recordingViews", uid);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const current = snap.exists() ? snap.data().count || 0 : 0;
        if (current >= 3) throw new Error("LIMIT");
        if (!snap.exists()) {
          tx.set(ref, { count: 1, lastViewedAt: serverTimestamp() });
        } else {
          tx.update(ref, { count: current + 1, lastViewedAt: serverTimestamp() });
        }
      });
      window.open(lesson.recordingLink, "_blank", "noopener");
    } catch (e) {
      if (e.message === "LIMIT") {
        setMsg("இந்த recording-ஐ 3 முறை பார்த்தாச்சு — மேலும் பார்க்க முடியாது.");
      } else {
        setMsg("பிழை: மீண்டும் முயற்சிக்கவும்.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.lesson}>
      <div style={{ fontWeight: 600 }}>{lesson.title}</div>
      {lesson.content && <p style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{lesson.content}</p>}
      <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
        {lesson.pdfLink && (
          <a href={lesson.pdfLink} target="_blank" rel="noreferrer" style={{ fontSize: 13.5 }}>
            📄 PDF பார்க்க
          </a>
        )}
        {lesson.recordingLink && (
          <>
            <button style={styles.buttonSmall} onClick={openRecording} disabled={busy || viewsLeft === 0}>
              🎥 Recording ({viewsLeft} முறை மீதம்)
            </button>
          </>
        )}
      </div>
      {msg && <div style={{ ...styles.notice, marginTop: 8 }}>{msg}</div>}
    </div>
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
              <code>lms/.env</code> கோப்பில் <code>VITE_FIREBASE_*</code> மதிப்புகளை நிரப்பி மீண்டும் இயக்கவும்.
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
        <TeacherDashboard profile={profile} />
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

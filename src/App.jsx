import React, { useState, useEffect, useRef } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { db, auth, firebaseConfigured } from "./firebase.js";

const AUTH_ERROR_MESSAGES = {
  "auth/invalid-credential": "மின்னஞ்சல் அல்லது கடவுச்சொல் தவறு.",
  "auth/wrong-password": "மின்னஞ்சல் அல்லது கடவுச்சொல் தவறு.",
  "auth/user-not-found": "மின்னஞ்சல் அல்லது கடவுச்சொல் தவறு.",
  "auth/invalid-email": "மின்னஞ்சல் முறையற்றது.",
  "auth/too-many-requests": "பல தவறான முயற்சிகள். சிறிது நேரம் கழித்து முயற்சிக்கவும்.",
  "auth/user-disabled": "இந்த கணக்கு முடக்கப்பட்டுள்ளது.",
};
const authErrorMessage = (e) => AUTH_ERROR_MESSAGES[e?.code] || "உள்நுழைய முடியவில்லை. மீண்டும் முயற்சிக்கவும்.";

// ---------- helpers ----------
const genCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
};
const genId = () => Math.random().toString(36).slice(2, 10);
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => {
  if (!d) return "";
  try {
    const dt = new Date(d + "T00:00:00");
    return dt.toLocaleDateString("ta-LK", { day: "2-digit", month: "short", year: "numeric" });
  } catch (e) {
    return d;
  }
};

const DEFAULT_SETTINGS = {
  schoolName: "கதிரவன் கல்வி நிறுவனம்",
  tagline: "உங்கள் நம்பகமான கற்றல் பங்காளி",
};

const APP_COLLECTION = "app";

export default function LMS() {
  const [screen, setScreen] = useState("home"); // home | teacherLogin | teacher | studentLogin | student
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savedFlash, setSavedFlash] = useState("");

  const [grades, setGrades] = useState([]); // [{id, name}]
  const [subjects, setSubjects] = useState([]); // [{id, gradeId, name, zoomLink, recordings:[{id,date,title,url}], pdfs:[{id,title,url}]}]
  const [students, setStudents] = useState([]); // [{id,name,code,subjectIds:[]}]
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const [passInput, setPassInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [activeStudent, setActiveStudent] = useState(null);

  // teacher: auth
  const [teacherUser, setTeacherUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [teacherEmail, setTeacherEmail] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // teacher: brand
  const [nameDraft, setNameDraft] = useState("");
  const [taglineDraft, setTaglineDraft] = useState("");

  // teacher: grade/subject nav
  const [expandedGradeId, setExpandedGradeId] = useState(null);
  const [expandedSubjectId, setExpandedSubjectId] = useState(null);
  const [newGradeName, setNewGradeName] = useState("");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectZoom, setNewSubjectZoom] = useState("");
  const [zoomEditDraft, setZoomEditDraft] = useState({}); // subjectId -> draft value
  const [recDate, setRecDate] = useState(todayStr());
  const [recTitle, setRecTitle] = useState("");
  const [recUrl, setRecUrl] = useState("");
  const [subPdfTitle, setSubPdfTitle] = useState("");
  const [subPdfUrl, setSubPdfUrl] = useState("");

  // teacher: students
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentCode, setNewStudentCode] = useState(genCode());
  const [expandedStudentId, setExpandedStudentId] = useState(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [showCodeList, setShowCodeList] = useState(false);

  const settingsInitRef = useRef(false);

  useEffect(() => {
    if (!firebaseConfigured || !auth) {
      setAuthReady(true);
      return;
    }
    const unsub = onAuthStateChanged(auth, (user) => {
      setTeacherUser(user);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!firebaseConfigured || !db) {
      setLoading(false);
      return;
    }

    const watchList = (id, setter) =>
      onSnapshot(
        doc(db, APP_COLLECTION, id),
        (snap) => {
          const data = snap.exists() ? snap.data() : null;
          setter(data && Array.isArray(data.list) ? data.list : []);
        },
        () => setError("தரவு ஏற்றுவதில் சிக்கல் ஏற்பட்டது.")
      );

    const unsubGrades = watchList("grades", setGrades);
    const unsubSubjects = watchList("subjects", setSubjects);
    const unsubStudents = watchList("students", setStudents);

    const unsubSettings = onSnapshot(
      doc(db, APP_COLLECTION, "settings"),
      (snap) => {
        const merged = { ...DEFAULT_SETTINGS, ...(snap.exists() ? snap.data() : {}) };
        setSettings(merged);
        if (!settingsInitRef.current) {
          settingsInitRef.current = true;
          setNameDraft(merged.schoolName || "");
          setTaglineDraft(merged.tagline || "");
        }
        setLoading(false);
      },
      () => {
        setError("தரவு ஏற்றுவதில் சிக்கல் ஏற்பட்டது.");
        setLoading(false);
      }
    );

    return () => {
      unsubGrades();
      unsubSubjects();
      unsubStudents();
      unsubSettings();
    };
  }, []);

  const flash = (msg) => {
    setSavedFlash(msg);
    setTimeout(() => setSavedFlash(""), 1600);
  };

  const persist = async (key, value, setter) => {
    setter(value);
    if (!db) return;
    try {
      const body = Array.isArray(value) ? { list: value } : value;
      await setDoc(doc(db, APP_COLLECTION, key), body);
    } catch (e) {
      setError("சேமிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.");
    }
  };
  const saveGrades = (v) => persist("grades", v, setGrades);
  const saveSubjects = (v) => persist("subjects", v, setSubjects);
  const saveStudents = (v) => persist("students", v, setStudents);
  const saveSettings = (v) => persist("settings", v, setSettings);

  // ---------- teacher: auth ----------
  const goTeacher = () => {
    setError("");
    setScreen(teacherUser ? "teacher" : "teacherLogin");
  };

  const handleTeacherSignIn = async () => {
    if (!teacherEmail.trim() || !passInput.trim()) return setError("மின்னஞ்சல் மற்றும் கடவுச்சொல்லை உள்ளிடவும்.");
    setAuthBusy(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, teacherEmail.trim(), passInput);
      setPassInput("");
      setScreen("teacher");
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!teacherEmail.trim()) return setError("முதலில் மின்னஞ்சலை உள்ளிடவும்.");
    setAuthBusy(true);
    setError("");
    try {
      await sendPasswordResetEmail(auth, teacherEmail.trim());
      setResetSent(true);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleTeacherLogout = () => {
    signOut(auth).catch(() => {});
  };

  const saveBrand = () => {
    saveSettings({ ...settings, schoolName: nameDraft.trim() || DEFAULT_SETTINGS.schoolName, tagline: taglineDraft.trim() });
    flash("பள்ளி விவரம் சேமிக்கப்பட்டது");
  };

  // ---------- teacher: grades ----------
  const addGrade = () => {
    if (!newGradeName.trim()) return setError("தர பெயரை உள்ளிடவும்.");
    saveGrades([...grades, { id: genId(), name: newGradeName.trim() }]);
    setNewGradeName("");
    setError("");
    flash("தரம் சேர்க்கப்பட்டது");
  };

  const removeGrade = (gradeId) => {
    const subIds = subjects.filter((s) => s.gradeId === gradeId).map((s) => s.id);
    saveSubjects(subjects.filter((s) => s.gradeId !== gradeId));
    saveStudents(students.map((st) => ({ ...st, subjectIds: st.subjectIds.filter((id) => !subIds.includes(id)) })));
    saveGrades(grades.filter((g) => g.id !== gradeId));
    if (expandedGradeId === gradeId) setExpandedGradeId(null);
  };

  // ---------- teacher: subjects ----------
  const addSubject = (gradeId) => {
    if (!newSubjectName.trim()) return setError("பாட பெயரை உள்ளிடவும்.");
    const sub = {
      id: genId(),
      gradeId,
      name: newSubjectName.trim(),
      zoomLink: newSubjectZoom.trim(),
      recordings: [],
      pdfs: [],
    };
    saveSubjects([...subjects, sub]);
    setNewSubjectName("");
    setNewSubjectZoom("");
    setError("");
    flash("பாடம் சேர்க்கப்பட்டது");
  };

  const removeSubject = (subjectId) => {
    saveSubjects(subjects.filter((s) => s.id !== subjectId));
    saveStudents(students.map((st) => ({ ...st, subjectIds: st.subjectIds.filter((id) => id !== subjectId) })));
    if (expandedSubjectId === subjectId) setExpandedSubjectId(null);
  };

  const updateSubjectZoom = (subjectId) => {
    const val = (zoomEditDraft[subjectId] ?? "").trim();
    saveSubjects(subjects.map((s) => (s.id === subjectId ? { ...s, zoomLink: val } : s)));
    flash("Zoom Link சேமிக்கப்பட்டது");
  };

  const addRecording = (subjectId) => {
    if (!recTitle.trim() || !recUrl.trim()) return setError("Recording தலைப்பும் Link-உம் தேவை.");
    saveSubjects(
      subjects.map((s) =>
        s.id === subjectId
          ? { ...s, recordings: [...s.recordings, { id: genId(), date: recDate, title: recTitle.trim(), url: recUrl.trim() }] }
          : s
      )
    );
    setRecTitle("");
    setRecUrl("");
    setError("");
    flash("Recording சேர்க்கப்பட்டது");
  };

  const removeRecording = (subjectId, recId) => {
    saveSubjects(
      subjects.map((s) => (s.id === subjectId ? { ...s, recordings: s.recordings.filter((r) => r.id !== recId) } : s))
    );
  };

  const addSubjectPdf = (subjectId) => {
    if (!subPdfTitle.trim() || !subPdfUrl.trim()) return setError("PDF தலைப்பும் Link-உம் தேவை.");
    saveSubjects(
      subjects.map((s) =>
        s.id === subjectId ? { ...s, pdfs: [...s.pdfs, { id: genId(), title: subPdfTitle.trim(), url: subPdfUrl.trim() }] } : s
      )
    );
    setSubPdfTitle("");
    setSubPdfUrl("");
    setError("");
    flash("PDF சேர்க்கப்பட்டது");
  };

  const removeSubjectPdf = (subjectId, pdfId) => {
    saveSubjects(subjects.map((s) => (s.id === subjectId ? { ...s, pdfs: s.pdfs.filter((p) => p.id !== pdfId) } : s)));
  };

  // ---------- teacher: students ----------
  const addStudent = () => {
    if (!newStudentName.trim()) return setError("மாணவர் பெயரை உள்ளிடவும்.");
    const code = newStudentCode.trim().toUpperCase() || genCode();
    if (students.some((s) => s.code === code)) return setError("இந்த Access Code ஏற்கனவே உள்ளது.");
    saveStudents([...students, { id: genId(), name: newStudentName.trim(), code, subjectIds: [] }]);
    setNewStudentName("");
    setNewStudentCode(genCode());
    setError("");
    flash("மாணவர் சேர்க்கப்பட்டார்");
  };

  const removeStudent = (id) => saveStudents(students.filter((s) => s.id !== id));

  const copyCodeList = async () => {
    const text = students.map((s) => `${s.name} — ${s.code}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      flash("பட்டியல் Copy ஆனது");
    } catch (e) {
      flash("Copy தானாக ஆகவில்லை — கீழே இருந்து manual-ஆ Select பண்ணவும்");
    }
  };

  const toggleSubjectForStudent = (studentId, subjectId) => {
    saveStudents(
      students.map((st) => {
        if (st.id !== studentId) return st;
        const has = st.subjectIds.includes(subjectId);
        return { ...st, subjectIds: has ? st.subjectIds.filter((id) => id !== subjectId) : [...st.subjectIds, subjectId] };
      })
    );
  };

  // ---------- student login ----------
  const handleStudentLogin = () => {
    const found = students.find((s) => s.code === codeInput.trim().toUpperCase());
    if (!found) return setError("Access Code தவறு. மீண்டும் சரிபார்க்கவும்.");
    setActiveStudent(found);
    setScreen("student");
    setError("");
  };

  useEffect(() => {
    if (activeStudent) {
      const fresh = students.find((s) => s.id === activeStudent.id);
      if (fresh) setActiveStudent(fresh);
    }
    // eslint-disable-next-line
  }, [students]);

  const mySubjects = activeStudent
    ? subjects.filter((s) => activeStudent.subjectIds.includes(s.id))
    : [];
  const myGradeIds = [...new Set(mySubjects.map((s) => s.gradeId))];

  // ---------- styles ----------
  const styles = {
    page: { minHeight: "100vh", background: "#0B0F16", fontFamily: "'Inter','Noto Sans Tamil',sans-serif", color: "#EAF0FA", paddingBottom: 50, boxSizing: "border-box" },
    header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid #1B2436", position: "sticky", top: 0, background: "#0B0F16", zIndex: 5 },
    brandBox: { background: "#F4F1EA", color: "#0B0F16", borderRadius: 8, padding: "8px 14px", fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 14, maxWidth: 190, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    pill: { border: "1.5px solid #3A4A6B", color: "#AEBEDD", borderRadius: 999, padding: "7px 16px", fontSize: 12.5, fontFamily: "'IBM Plex Mono',monospace" },
    bell: { width: 36, height: 36, borderRadius: "50%", background: "#161F30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 },
    banner: { margin: "18px 18px 0", borderRadius: 16, padding: "26px 22px", background: "linear-gradient(135deg,#123064 0%,#0B1E42 60%,#091530 100%)", border: "1px solid #1E3B72" },
    eyebrow: { fontFamily: "'IBM Plex Mono',monospace", fontSize: 11.5, letterSpacing: "0.16em", color: "#F2A93B", textTransform: "uppercase", marginBottom: 8 },
    h1: { fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 25, lineHeight: 1.25, margin: "0 0 8px", color: "#F6F8FC", textWrap: "balance" },
    h2: { fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 18, margin: "0 0 4px", color: "#F6F8FC" },
    sub: { color: "#9FB0CE", fontSize: 14, lineHeight: 1.55, margin: 0 },
    section: { padding: "22px 18px 0" },
    sectionTitle: { fontFamily: "'Fraunces',serif", fontSize: 19, fontWeight: 600, margin: "0 0 14px", color: "#F6F8FC" },
    grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
    tile: { borderRadius: 16, overflow: "hidden", border: "1px solid #1E3B72", background: "linear-gradient(160deg,#16305E 0%,#0B1B3B 100%)", display: "flex", flexDirection: "column", minHeight: 100 },
    tileTop: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 12px", textAlign: "center" },
    tileTitle: { fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 16, lineHeight: 1.2, color: "#F6F8FC", wordBreak: "break-word" },
    tileBtn: { background: "#123064", color: "#EAF0FA", textAlign: "center", padding: "11px 12px", fontSize: 13, fontWeight: 700, border: "none", borderTop: "1px solid #1E3B72", cursor: "pointer", fontFamily: "inherit", textDecoration: "none", display: "block" },
    card: { background: "#111A2C", border: "1px solid #1E2A44", borderRadius: 16, padding: "20px", margin: "0 18px 16px" },
    subCard: { background: "#0B1220", border: "1px solid #1E2A44", borderRadius: 12, padding: "16px", marginBottom: 12 },
    label: { fontSize: 13, color: "#8FA0C2", display: "block", marginBottom: 8, fontWeight: 600 },
    input: { width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #263354", background: "#0B1220", color: "#EAF0FA", fontSize: 14.5, marginBottom: 12, fontFamily: "inherit" },
    btnPrimary: { width: "100%", padding: "13px 16px", borderRadius: 999, border: "none", background: "#2E6CF3", color: "#fff", fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
    btnGhost: { width: "100%", padding: "12px 16px", borderRadius: 999, border: "1.5px solid #2E6CF3", background: "transparent", color: "#8FB0FF", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
    roleCard: { display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", padding: "18px", borderRadius: 16, border: "1px solid #1E3B72", background: "linear-gradient(160deg,#16305E 0%,#0B1B3B 100%)", color: "#F6F8FC", marginBottom: 14, cursor: "pointer", fontSize: 16.5, fontFamily: "'Fraunces',serif" },
    ticket: { display: "inline-flex", fontFamily: "'IBM Plex Mono',monospace", fontSize: 13.5, letterSpacing: "0.08em", background: "#0B1220", color: "#F2A93B", padding: "5px 11px", borderRadius: 6, border: "1.5px dashed #F2A93B77", marginTop: 4 },
    row: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #1E2A44" },
    linkBtn: { color: "#8FB0FF", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: 0, fontFamily: "inherit" },
    dangerBtn: { color: "#E4677E", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: 0, fontFamily: "inherit" },
    errBox: { background: "#3A1620", border: "1px solid #C0435A", color: "#FFC9D2", padding: "11px 14px", borderRadius: 10, fontSize: 13.5, margin: "0 18px 16px" },
    flash: { background: "#1A2E17", border: "1px solid #4E8A3E", color: "#C9F2BC", padding: "9px 14px", borderRadius: 10, fontSize: 13, margin: "0 18px 16px" },
    noticeBox: { background: "#241B0D", border: "1px solid #4A3A17", color: "#F2CE9B", padding: "9px 14px", borderRadius: 10, fontSize: 12.5, margin: "0 18px 16px" },
    listRow: { background: "#0B1220", border: "1px solid #1E2A44", borderRadius: 10, padding: "11px 13px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" },
    backBar: { background: "none", border: "none", color: "#7C8CAE", fontSize: 13, cursor: "pointer", padding: "14px 18px 0", fontFamily: "'IBM Plex Mono',monospace", display: "block" },
    checkboxRow: { display: "flex", alignItems: "center", gap: 10, padding: "9px 0" },
    badge: { fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", color: "#F2A93B", background: "#241B0D", border: "1px solid #4A3A17", padding: "3px 8px", borderRadius: 6 },
  };

  const Back = ({ to, label, logout }) => (
    <button
      style={styles.backBar}
      onClick={() => {
        setError("");
        setPassInput("");
        setCodeInput("");
        setResetSent(false);
        if (logout) handleTeacherLogout();
        setScreen(to);
      }}
    >
      ← {label}
    </button>
  );

  const Header = () => (
    <div style={styles.header}>
      <div style={styles.brandBox}>{settings.schoolName}</div>
      <div style={styles.pill}>Class Portal</div>
      <div style={styles.bell}>🔔</div>
    </div>
  );

  if (!firebaseConfigured) {
    return (
      <div style={styles.page}>
        <Header />
        <div style={styles.section}>
          <div style={styles.eyebrow}>Setup தேவை</div>
          <h1 style={styles.h1}>Firebase இணைக்கப்படவில்லை</h1>
        </div>
        <div style={styles.card}>
          <p style={{ color: "#9FB0CE", fontSize: 14.5, lineHeight: 1.6 }}>
            இந்த வெப்சைட் தரவை சேமிக்க Firebase Firestore-ஐ பயன்படுத்துகிறது. <code>.env</code> கோப்பில்{" "}
            <code>VITE_FIREBASE_*</code> மதிப்புகளை நிரப்பி மீண்டும் இயக்கவும் — விவரங்களுக்கு{" "}
            <code>README.md</code>-ஐ பார்க்கவும்.
          </p>
        </div>
      </div>
    );
  }

  if (loading || !authReady) {
    return (
      <div style={styles.page}>
        <Header />
        <div style={styles.section}><div style={styles.eyebrow}>ஏற்றுகிறது…</div></div>
      </div>
    );
  }

  // ---------- HOME ----------
  if (screen === "home") {
    return (
      <div style={styles.page}>
        <Header />
        <div style={styles.banner}>
          <div style={styles.eyebrow}>வரவேற்கிறோம்</div>
          <h1 style={styles.h1}>{settings.schoolName}</h1>
          <p style={styles.sub}>{settings.tagline}</p>
        </div>
        <div style={styles.section}>
          <div style={styles.sectionTitle}>தொடர்வது எப்படி?</div>
          <button style={styles.roleCard} onClick={goTeacher}>
            <span style={{ fontSize: 26 }}>👩‍🏫</span><span>நான் ஆசிரியர்</span>
          </button>
          <button style={styles.roleCard} onClick={() => setScreen("studentLogin")}>
            <span style={{ fontSize: 26 }}>🎓</span><span>நான் மாணவர்</span>
          </button>
        </div>
      </div>
    );
  }

  // ---------- TEACHER LOGIN ----------
  if (screen === "teacherLogin") {
    return (
      <div style={styles.page}>
        <Header />
        <Back to="home" label="பின்செல்" />
        <div style={styles.section}>
          <div style={styles.eyebrow}>ஆசிரியர் நுழைவு</div>
          <h1 style={styles.h1}>உங்கள் கணக்கில் உள்நுழையவும்</h1>
        </div>
        {error && <div style={styles.errBox}>{error}</div>}
        {resetSent && <div style={styles.flash}>கடவுச்சொல் மீட்டமைக்க link மின்னஞ்சலுக்கு அனுப்பப்பட்டது.</div>}
        <div style={styles.card}>
          <label style={styles.label}>மின்னஞ்சல்</label>
          <input
            style={styles.input}
            type="email"
            autoComplete="username"
            value={teacherEmail}
            onChange={(e) => setTeacherEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleTeacherSignIn()}
            placeholder="teacher@example.com"
          />
          <label style={styles.label}>கடவுச்சொல்</label>
          <input
            style={styles.input}
            type="password"
            autoComplete="current-password"
            value={passInput}
            onChange={(e) => setPassInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleTeacherSignIn()}
            placeholder="கடவுச்சொல்"
          />
          <button style={styles.btnPrimary} onClick={handleTeacherSignIn} disabled={authBusy}>
            {authBusy ? "உள்நுழைகிறது…" : "LOGIN NOW"}
          </button>
          <div style={{ height: 12 }} />
          <button style={styles.linkBtn} onClick={handleForgotPassword} disabled={authBusy}>
            கடவுச்சொல் மறந்துவிட்டதா?
          </button>
        </div>
      </div>
    );
  }

  // ---------- STUDENT LOGIN ----------
  if (screen === "studentLogin") {
    return (
      <div style={styles.page}>
        <Header />
        <Back to="home" label="பின்செல்" />
        <div style={styles.section}>
          <div style={styles.eyebrow}>மாணவர் நுழைவு</div>
          <h1 style={styles.h1}>உங்கள் Access Code-ஐ கொடுங்கள்</h1>
        </div>
        {error && <div style={styles.errBox}>{error}</div>}
        <div style={styles.card}>
          <label style={styles.label}>Access Code</label>
          <input style={{ ...styles.input, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: "0.12em" }} value={codeInput} onChange={(e) => setCodeInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleStudentLogin()} placeholder="எ.கா. K3F7QZ" />
          <button style={styles.btnPrimary} onClick={handleStudentLogin}>LOGIN NOW</button>
        </div>
      </div>
    );
  }

  // ---------- STUDENT DASHBOARD ----------
  if (screen === "student" && activeStudent) {
    return (
      <div style={styles.page}>
        <Header />
        <Back to="home" label="வெளியேறு" />
        <div style={styles.banner}>
          <div style={styles.eyebrow}>வணக்கம்</div>
          <h1 style={styles.h1}>{activeStudent.name}</h1>
          <p style={styles.sub}>உங்களுக்கு அனுமதிக்கப்பட்ட பாடங்கள் மட்டும் கீழே தெரியும்.</p>
        </div>

        {mySubjects.length === 0 && (
          <div style={styles.card}>
            <p style={{ color: "#7C8CAE", fontSize: 14, margin: 0 }}>உங்களுக்கு இன்னும் எந்த பாடமும் ஒதுக்கப்படவில்லை. ஆசிரியரை தொடர்பு கொள்ளவும்.</p>
          </div>
        )}

        {myGradeIds.map((gradeId) => {
          const grade = grades.find((g) => g.id === gradeId);
          const subs = mySubjects.filter((s) => s.gradeId === gradeId);
          return (
            <div key={gradeId} style={styles.section}>
              <div style={styles.sectionTitle}>{grade ? grade.name : "பாடங்கள்"}</div>
              {subs.map((sub) => (
                <div key={sub.id} style={styles.card}>
                  <div style={styles.h2}>{sub.name}</div>
                  <div style={{ ...styles.grid, marginTop: 12 }}>
                    <div style={styles.tile}>
                      <div style={styles.tileTop}><span style={styles.tileTitle}>ZOOM CLASS</span></div>
                      {sub.zoomLink ? (
                        <a href={sub.zoomLink} target="_blank" rel="noopener noreferrer" style={styles.tileBtn}>Join Now</a>
                      ) : (
                        <div style={{ ...styles.tileBtn, opacity: 0.4, cursor: "default" }}>இன்னும் இல்லை</div>
                      )}
                    </div>
                    <div style={styles.tile}>
                      <div style={styles.tileTop}><span style={styles.tileTitle}>RECORDINGS</span></div>
                      <div style={{ ...styles.tileBtn, background: "#0D1730", cursor: "default" }}>{sub.recordings.length} recordings</div>
                    </div>
                  </div>

                  {sub.recordings.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <label style={styles.label}>திகதி வாரியாக Recordings</label>
                      {[...sub.recordings].sort((a, b) => (a.date < b.date ? 1 : -1)).map((r) => (
                        <div key={r.id} style={styles.listRow}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{r.title}</div>
                            <span style={styles.badge}>{fmtDate(r.date)}</span>
                          </div>
                          <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ ...styles.linkBtn, textDecoration: "none", fontWeight: 700 }}>▶ பார்க்க</a>
                        </div>
                      ))}
                    </div>
                  )}

                  {sub.pdfs.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <label style={styles.label}>PDF குறிப்புகள்</label>
                      {sub.pdfs.map((p) => (
                        <div key={p.id} style={styles.listRow}>
                          <span style={{ fontSize: 14 }}>📄 {p.title}</span>
                          <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ ...styles.linkBtn, textDecoration: "none", fontWeight: 700 }}>திற →</a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  // ---------- TEACHER DASHBOARD ----------
  if (screen === "teacher") {
    if (!teacherUser) {
      // session ended (signed out elsewhere / token expired) — back to login
      return (
        <div style={styles.page}>
          <Header />
          <Back to="teacherLogin" label="மீண்டும் உள்நுழையவும்" />
        </div>
      );
    }
    return (
      <div style={styles.page}>
        <Header />
        <Back to="home" label="வெளியேறு" logout />
        <div style={styles.section}>
          <div style={styles.eyebrow}>ஆசிரியர் பலகை</div>
          <h1 style={styles.h1}>வகுப்பை நிர்வகிக்கவும்</h1>
        </div>
        {error && <div style={styles.errBox}>{error}</div>}
        {savedFlash && <div style={styles.flash}>{savedFlash}</div>}

        {/* Brand */}
        <div style={styles.card}>
          <label style={styles.label}>பள்ளி பெயர்</label>
          <input style={styles.input} value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} placeholder="பள்ளி / வகுப்பு பெயர்" />
          <label style={styles.label}>Tagline (விருப்பம்)</label>
          <input style={styles.input} value={taglineDraft} onChange={(e) => setTaglineDraft(e.target.value)} placeholder="சிறு அறிமுக வரி" />
          <button style={styles.btnGhost} onClick={saveBrand}>பெயரை சேமிக்க</button>
        </div>

        {/* Add grade */}
        <div style={styles.card}>
          <label style={styles.label}>புதிய தரம் சேர்க்க (எ.கா. தரம் 4)</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input style={{ ...styles.input, marginBottom: 0 }} value={newGradeName} onChange={(e) => setNewGradeName(e.target.value)} placeholder="தரம் 4" />
          </div>
          <div style={{ height: 12 }} />
          <button style={styles.btnPrimary} onClick={addGrade}>தரம் சேர்க்க</button>
        </div>

        {/* Grades list */}
        {grades.map((g) => {
          const gradeSubs = subjects.filter((s) => s.gradeId === g.id);
          const isOpen = expandedGradeId === g.id;
          return (
            <div key={g.id} style={styles.card}>
              <div style={styles.row}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{g.name} <span style={{ color: "#7C8CAE", fontWeight: 400, fontSize: 13 }}>({gradeSubs.length} பாடங்கள்)</span></div>
                <div style={{ display: "flex", gap: 16 }}>
                  <button style={styles.linkBtn} onClick={() => setExpandedGradeId(isOpen ? null : g.id)}>{isOpen ? "மூடு" : "நிர்வகி"}</button>
                  <button style={styles.dangerBtn} onClick={() => removeGrade(g.id)}>நீக்கு</button>
                </div>
              </div>

              {isOpen && (
                <div style={{ paddingTop: 14 }}>
                  {/* add subject */}
                  <div style={styles.subCard}>
                    <label style={styles.label}>புதிய பாடம் சேர்க்க</label>
                    <input style={styles.input} value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} placeholder="எ.கா. கணிதம்" />
                    <input style={styles.input} value={newSubjectZoom} onChange={(e) => setNewSubjectZoom(e.target.value)} placeholder="Zoom Link (https://zoom.us/j/...)" />
                    <button style={styles.btnPrimary} onClick={() => addSubject(g.id)}>பாடம் சேர்க்க</button>
                  </div>

                  {/* subjects */}
                  {gradeSubs.map((sub) => {
                    const subOpen = expandedSubjectId === sub.id;
                    return (
                      <div key={sub.id} style={styles.subCard}>
                        <div style={styles.row}>
                          <div style={{ fontWeight: 700, fontSize: 14.5 }}>{sub.name}</div>
                          <div style={{ display: "flex", gap: 14 }}>
                            <button style={styles.linkBtn} onClick={() => setExpandedSubjectId(subOpen ? null : sub.id)}>{subOpen ? "மூடு" : "திற"}</button>
                            <button style={styles.dangerBtn} onClick={() => removeSubject(sub.id)}>நீக்கு</button>
                          </div>
                        </div>

                        {subOpen && (
                          <div style={{ paddingTop: 12 }}>
                            <label style={styles.label}>Zoom Link</label>
                            <div style={{ display: "flex", gap: 8 }}>
                              <input
                                style={{ ...styles.input, marginBottom: 0 }}
                                value={zoomEditDraft[sub.id] ?? sub.zoomLink}
                                onChange={(e) => setZoomEditDraft({ ...zoomEditDraft, [sub.id]: e.target.value })}
                                placeholder="https://zoom.us/j/..."
                              />
                            </div>
                            <div style={{ height: 10 }} />
                            <button style={styles.btnGhost} onClick={() => updateSubjectZoom(sub.id)}>Zoom Link சேமிக்க</button>

                            <div style={{ height: 18 }} />
                            <label style={styles.label}>Recordings ({sub.recordings.length})</label>
                            {[...sub.recordings].sort((a, b) => (a.date < b.date ? 1 : -1)).map((r) => (
                              <div key={r.id} style={styles.listRow}>
                                <div>
                                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{r.title}</div>
                                  <span style={styles.badge}>{fmtDate(r.date)}</span>
                                </div>
                                <button style={styles.dangerBtn} onClick={() => removeRecording(sub.id, r.id)}>நீக்கு</button>
                              </div>
                            ))}
                            <input style={{ ...styles.input, marginTop: 8 }} type="date" value={recDate} onChange={(e) => setRecDate(e.target.value)} />
                            <input style={styles.input} value={recTitle} onChange={(e) => setRecTitle(e.target.value)} placeholder="Recording தலைப்பு (எ.கா. பாடம் 5)" />
                            <input style={styles.input} value={recUrl} onChange={(e) => setRecUrl(e.target.value)} placeholder="Recording Link" />
                            <button style={styles.btnPrimary} onClick={() => addRecording(sub.id)}>Recording சேர்க்க</button>

                            <div style={{ height: 18 }} />
                            <label style={styles.label}>PDF குறிப்புகள் ({sub.pdfs.length})</label>
                            {sub.pdfs.map((p) => (
                              <div key={p.id} style={styles.listRow}>
                                <span style={{ fontSize: 13.5 }}>📄 {p.title}</span>
                                <button style={styles.dangerBtn} onClick={() => removeSubjectPdf(sub.id, p.id)}>நீக்கு</button>
                              </div>
                            ))}
                            <input style={{ ...styles.input, marginTop: 8 }} value={subPdfTitle} onChange={(e) => setSubPdfTitle(e.target.value)} placeholder="PDF தலைப்பு" />
                            <input style={styles.input} value={subPdfUrl} onChange={(e) => setSubPdfUrl(e.target.value)} placeholder="PDF Link" />
                            <button style={styles.btnPrimary} onClick={() => addSubjectPdf(sub.id)}>PDF சேர்க்க</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {gradeSubs.length === 0 && <p style={{ color: "#7C8CAE", fontSize: 13.5 }}>இன்னும் பாடம் சேர்க்கப்படவில்லை.</p>}
                </div>
              )}
            </div>
          );
        })}

        {/* Add student */}
        <div style={styles.card}>
          <label style={styles.label}>புதிய மாணவரைச் சேர்க்க</label>
          <input style={styles.input} value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)} placeholder="மாணவர் பெயர்" />
          <label style={styles.label}>Access Code</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input style={{ ...styles.input, marginBottom: 0, fontFamily: "'IBM Plex Mono',monospace" }} value={newStudentCode} onChange={(e) => setNewStudentCode(e.target.value.toUpperCase())} />
            <button style={{ ...styles.btnGhost, width: "auto", padding: "0 18px" }} onClick={() => setNewStudentCode(genCode())}>↻</button>
          </div>
          <button style={styles.btnPrimary} onClick={addStudent}>மாணவரைச் சேர்க்க</button>
        </div>

        {/* Students list with per-subject permission */}
        <div style={styles.card}>
          <div style={styles.row}>
            <label style={{ ...styles.label, marginBottom: 0 }}>மாணவர்கள் ({students.length})</label>
            {students.length > 0 && (
              <button style={styles.linkBtn} onClick={() => setShowCodeList(!showCodeList)}>
                {showCodeList ? "மூடு" : "எல்லா Codes-ஐ பார்க்க"}
              </button>
            )}
          </div>

          {showCodeList && students.length > 0 && (
            <div style={styles.subCard}>
              <textarea
                readOnly
                value={students.map((s) => `${s.name} — ${s.code}`).join("\n")}
                style={{ ...styles.input, height: 140, resize: "vertical", fontFamily: "'IBM Plex Mono',monospace", fontSize: 13 }}
              />
              <button style={styles.btnPrimary} onClick={copyCodeList}>📋 பட்டியலை Copy பண்ண</button>
            </div>
          )}

          {students.length > 6 && (
            <input
              style={styles.input}
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="மாணவர் பெயரில் தேடவும்…"
            />
          )}

          {students.length === 0 && <p style={{ color: "#7C8CAE", fontSize: 14 }}>இன்னும் மாணவர் யாரும் சேர்க்கப்படவில்லை.</p>}
          {students
            .filter((s) => s.name.toLowerCase().includes(studentSearch.trim().toLowerCase()))
            .map((s) => {
            const isOpen = expandedStudentId === s.id;
            return (
              <div key={s.id}>
                <div style={styles.row}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{s.name}</div>
                    <span style={styles.ticket}>{s.code}</span>
                  </div>
                  <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                    <button style={styles.linkBtn} onClick={() => setExpandedStudentId(isOpen ? null : s.id)}>{isOpen ? "மூடு" : `அனுமதிகள் (${s.subjectIds.length})`}</button>
                    <button style={styles.dangerBtn} onClick={() => removeStudent(s.id)}>நீக்கு</button>
                  </div>
                </div>
                {isOpen && (
                  <div style={{ padding: "10px 0 18px" }}>
                    {grades.length === 0 && <p style={{ color: "#7C8CAE", fontSize: 13.5 }}>முதலில் தரம் மற்றும் பாடங்களை சேர்க்கவும்.</p>}
                    {grades.map((g) => {
                      const gsubs = subjects.filter((s2) => s2.gradeId === g.id);
                      if (gsubs.length === 0) return null;
                      return (
                        <div key={g.id} style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#AEBEDD", marginBottom: 2 }}>{g.name}</div>
                          {gsubs.map((sub) => (
                            <label key={sub.id} style={styles.checkboxRow}>
                              <input type="checkbox" checked={s.subjectIds.includes(sub.id)} onChange={() => toggleSubjectForStudent(s.id, sub.id)} style={{ width: 17, height: 17 }} />
                              <span style={{ fontSize: 14 }}>{sub.name}</span>
                            </label>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}

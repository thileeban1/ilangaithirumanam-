import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  getDoc,
  runTransaction,
  onSnapshot,
  query,
  where,
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
const todayStr = () => new Date().toISOString().slice(0, 10);

const calcAge = (dob) => {
  if (!dob) return null;
  const b = new Date(dob + "T00:00:00");
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
};

const fmtDate = (ts) => {
  if (!ts) return "";
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("ta-LK", { day: "2-digit", month: "short", year: "numeric" });
  } catch (e) {
    return "";
  }
};

const sortByCreatedDesc = (list) =>
  [...list].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

const MAX_PHOTO_DIM = 480;
const PHOTO_JPEG_QUALITY = 0.72;

const resizeImageToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode failed"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > MAX_PHOTO_DIM) {
          height = Math.round((height * MAX_PHOTO_DIM) / width);
          width = MAX_PHOTO_DIM;
        } else if (height >= width && height > MAX_PHOTO_DIM) {
          width = Math.round((width * MAX_PHOTO_DIM) / height);
          height = MAX_PHOTO_DIM;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", PHOTO_JPEG_QUALITY));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

const GENDERS = ["ஆண்", "பெண்"];
const MARITAL_STATUSES = ["திருமணமாகாதவர்", "விவாகரத்து பெற்றவர்", "விதவை / விதவன்"];
const RELIGIONS = ["இந்து", "கிறிஸ்தவர்", "இஸ்லாம்", "பிற"];

const EMPTY_PROFILE = {
  name: "",
  gender: "",
  dob: "",
  height: "",
  religion: "",
  caste: "",
  motherTongue: "தமிழ்",
  country: "இலங்கை",
  district: "",
  maritalStatus: "",
  education: "",
  profession: "",
  about: "",
  phone: "",
  email: "",
  photoUrl: "",
};

const EMPTY_INTEREST = { requesterName: "", requesterPhone: "", message: "" };

const DEFAULT_SETTINGS = {
  siteName: "இலங்கை தமிழர் திருமண மையம்",
  tagline: "நம்பிக்கையுடன் ஒரு புதிய தொடக்கம்",
};

const PROFILES_COLLECTION = "profiles";
const INTERESTS_COLLECTION = "interests";
const ADMINS_COLLECTION = "admins";
const SETTINGS_DOC = "site";

const MEMBER_EMAIL_DOMAIN = "members.lanka-matrimony.app";
const digitsOnly = (s) => (s || "").replace(/\D/g, "");
const memberEmailFromPhone = (phone) => `m${digitsOnly(phone)}@${MEMBER_EMAIL_DOMAIN}`;

const STATUS_LABELS = { pending: "பரிசீலனையில்", approved: "ஏற்றுக்கொள்ளப்பட்டது", rejected: "நிராகரிக்கப்பட்டது" };

const assignMemberId = async () => {
  const counterRef = doc(db, "counters", "memberId");
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? snap.data().next : 10000;
    tx.set(counterRef, { next: current + 1 });
    return current;
  });
};

export default function MatrimonyApp() {
  const [screen, setScreen] = useState("home"); // home | register | browse | profile | adminLogin | admin
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savedFlash, setSavedFlash] = useState("");

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [approvedProfiles, setApprovedProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState(null);

  // register form
  const [registerForm, setRegisterForm] = useState(EMPTY_PROFILE);
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState("");
  const [registerBusy, setRegisterBusy] = useState(false);
  const [registerDone, setRegisterDone] = useState(false);
  const [registeredMemberId, setRegisteredMemberId] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  // member: auth + own data
  const [isAdminUser, setIsAdminUser] = useState(null); // null = still checking
  const [memberPhone, setMemberPhone] = useState("");
  const [memberPassword, setMemberPassword] = useState("");
  const [myProfile, setMyProfile] = useState(null);
  const [myInterestsSent, setMyInterestsSent] = useState([]);
  const [myInterestsReceived, setMyInterestsReceived] = useState([]);
  const [editingMyProfile, setEditingMyProfile] = useState(false);
  const [myEditDraft, setMyEditDraft] = useState(EMPTY_PROFILE);

  // browse filters
  const [filters, setFilters] = useState({ gender: "", district: "", maritalStatus: "", minAge: "", maxAge: "" });

  // interest form (on profile detail)
  const [interestForm, setInterestForm] = useState(EMPTY_INTEREST);
  const [interestBusy, setInterestBusy] = useState(false);
  const [interestDone, setInterestDone] = useState(false);

  // admin: auth
  const [authUser, setAuthUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [passInput, setPassInput] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // admin: data
  const [allProfiles, setAllProfiles] = useState([]);
  const [interests, setInterests] = useState([]);
  const [adminTab, setAdminTab] = useState("pending"); // pending | approved | rejected | interests | settings
  const [editingProfileId, setEditingProfileId] = useState(null);
  const [editDraft, setEditDraft] = useState(EMPTY_PROFILE);
  const [nameDraft, setNameDraft] = useState("");
  const [taglineDraft, setTaglineDraft] = useState("");

  useEffect(() => {
    if (!firebaseConfigured || !auth) {
      setAuthReady(true);
      return;
    }
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!firebaseConfigured || !db) {
      setLoading(false);
      return;
    }
    let settingsLoaded = false;
    let profilesLoaded = false;
    const maybeDone = () => settingsLoaded && profilesLoaded && setLoading(false);

    const unsubSettings = onSnapshot(
      doc(db, "settings", SETTINGS_DOC),
      (snap) => {
        const merged = { ...DEFAULT_SETTINGS, ...(snap.exists() ? snap.data() : {}) };
        setSettings(merged);
        setNameDraft((v) => v || merged.siteName || "");
        setTaglineDraft((v) => v || merged.tagline || "");
        settingsLoaded = true;
        maybeDone();
      },
      () => {
        settingsLoaded = true;
        maybeDone();
      }
    );

    const unsubProfiles = onSnapshot(
      query(collection(db, PROFILES_COLLECTION), where("status", "==", "approved")),
      (snap) => {
        setApprovedProfiles(sortByCreatedDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
        profilesLoaded = true;
        maybeDone();
      },
      () => {
        setError("தரவு ஏற்றுவதில் சிக்கல் ஏற்பட்டது.");
        profilesLoaded = true;
        maybeDone();
      }
    );

    return () => {
      unsubSettings();
      unsubProfiles();
    };
  }, []);

  useEffect(() => {
    if (!authUser || !db) {
      setIsAdminUser(false);
      return;
    }
    getDoc(doc(db, ADMINS_COLLECTION, authUser.uid))
      .then((snap) => setIsAdminUser(snap.exists()))
      .catch(() => setIsAdminUser(false));
  }, [authUser]);

  useEffect(() => {
    if (!authUser || !isAdminUser || !db) {
      setAllProfiles([]);
      setInterests([]);
      return;
    }
    const unsubAll = onSnapshot(collection(db, PROFILES_COLLECTION), (snap) => {
      setAllProfiles(sortByCreatedDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    });
    const unsubInterests = onSnapshot(collection(db, INTERESTS_COLLECTION), (snap) => {
      setInterests(sortByCreatedDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    });
    return () => {
      unsubAll();
      unsubInterests();
    };
  }, [authUser, isAdminUser]);

  useEffect(() => {
    if (!authUser || isAdminUser || !db) {
      setMyProfile(null);
      setMyInterestsSent([]);
      setMyInterestsReceived([]);
      return;
    }
    const unsubProfile = onSnapshot(
      query(collection(db, PROFILES_COLLECTION), where("ownerUid", "==", authUser.uid)),
      (snap) => {
        const d = snap.docs[0];
        setMyProfile(d ? { id: d.id, ...d.data() } : null);
      }
    );
    const unsubSent = onSnapshot(
      query(collection(db, INTERESTS_COLLECTION), where("requesterUid", "==", authUser.uid)),
      (snap) => setMyInterestsSent(sortByCreatedDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
    );
    const unsubReceived = onSnapshot(
      query(collection(db, INTERESTS_COLLECTION), where("recipientUid", "==", authUser.uid)),
      (snap) => setMyInterestsReceived(sortByCreatedDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
    );
    return () => {
      unsubProfile();
      unsubSent();
      unsubReceived();
    };
  }, [authUser, isAdminUser]);

  useEffect(() => {
    if (authUser && !isAdminUser && myProfile) {
      setInterestForm({ requesterName: myProfile.name || "", requesterPhone: myProfile.phone || "", message: "" });
    } else {
      setInterestForm(EMPTY_INTEREST);
    }
    setInterestDone(false);
  }, [selectedProfileId]);

  const flash = (msg) => {
    setSavedFlash(msg);
    setTimeout(() => setSavedFlash(""), 1800);
  };

  const goHome = () => {
    setError("");
    setScreen("home");
  };

  // ---------- shared: photo upload ----------
  const handlePhotoFile = async (file, value, onChange) => {
    if (!file) return;
    setError("");
    setPhotoUploading(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      onChange({ ...value, photoUrl: dataUrl });
    } catch (e) {
      setError("புகைப்படத்தை சேர்க்க முடியவில்லை. வேறு படத்தை முயற்சிக்கவும்.");
    } finally {
      setPhotoUploading(false);
    }
  };

  // ---------- public: register ----------
  const handleRegisterSubmit = async () => {
    const f = registerForm;
    if (!f.name.trim() || !f.gender || !f.dob || !f.phone.trim()) {
      return setError("பெயர், பாலினம், பிறந்த தேதி, தொடர்பு எண் ஆகியவற்றை நிரப்பவும்.");
    }
    if (registerPassword.length < 6) {
      return setError("கடவுச்சொல் குறைந்தது 6 எழுத்துகள் இருக்க வேண்டும்.");
    }
    if (registerPassword !== registerPasswordConfirm) {
      return setError("கடவுச்சொற்கள் பொருந்தவில்லை.");
    }
    setError("");
    setRegisterBusy(true);
    try {
      const email = memberEmailFromPhone(f.phone);
      const cred = await createUserWithEmailAndPassword(auth, email, registerPassword);
      const memberId = await assignMemberId();
      await addDoc(collection(db, PROFILES_COLLECTION), {
        ...f,
        name: f.name.trim(),
        phone: f.phone.trim(),
        status: "pending",
        ownerUid: cred.user.uid,
        memberId,
        createdAt: serverTimestamp(),
      });
      setRegisteredMemberId(memberId);
      setRegisterDone(true);
      setRegisterForm(EMPTY_PROFILE);
      setRegisterPassword("");
      setRegisterPasswordConfirm("");
    } catch (e) {
      if (e.code === "auth/email-already-in-use") {
        setError("இந்த தொடர்பு எண் ஏற்கனவே பதிவு செய்யப்பட்டுள்ளது. உள்நுழையவும்.");
      } else if (e.code === "auth/weak-password") {
        setError("கடவுச்சொல் மிகவும் எளிதானது. வேறு கடவுச்சொல் தேர்ந்தெடுக்கவும்.");
      } else {
        setError("சேமிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.");
      }
    } finally {
      setRegisterBusy(false);
    }
  };

  // ---------- public: express interest ----------
  const handleInterestSubmit = async () => {
    if (!interestForm.requesterName.trim() || !interestForm.requesterPhone.trim()) {
      return setError("உங்கள் பெயர் மற்றும் தொடர்பு எண்ணை நிரப்பவும்.");
    }
    setError("");
    setInterestBusy(true);
    try {
      await addDoc(collection(db, INTERESTS_COLLECTION), {
        profileId: selectedProfileId,
        recipientUid: selectedProfile?.ownerUid || null,
        requesterUid: authUser && !isAdminUser ? authUser.uid : null,
        requesterName: interestForm.requesterName.trim(),
        requesterPhone: interestForm.requesterPhone.trim(),
        message: interestForm.message.trim(),
        createdAt: serverTimestamp(),
      });
      setInterestDone(true);
    } catch (e) {
      setError("அனுப்ப முடியவில்லை. மீண்டும் முயற்சிக்கவும்.");
    } finally {
      setInterestBusy(false);
    }
  };

  // ---------- admin: auth ----------
  const goAdmin = () => {
    setError("");
    setScreen(authUser && isAdminUser ? "admin" : "adminLogin");
  };

  const goMemberArea = () => {
    setError("");
    setScreen(authUser && !isAdminUser ? "memberDashboard" : "memberLogin");
  };

  const handleMemberSignIn = async () => {
    if (!memberPhone.trim() || !memberPassword.trim()) return setError("தொடர்பு எண் மற்றும் கடவுச்சொல்லை உள்ளிடவும்.");
    setAuthBusy(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, memberEmailFromPhone(memberPhone), memberPassword);
      setMemberPassword("");
      setScreen("memberDashboard");
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setAuthBusy(false);
    }
  };

  const startEditMyProfile = () => {
    if (!myProfile) return;
    setMyEditDraft({ ...EMPTY_PROFILE, ...myProfile });
    setEditingMyProfile(true);
  };

  const saveMyProfile = async () => {
    if (!myEditDraft.name.trim() || !myEditDraft.gender || !myEditDraft.phone.trim()) {
      return setError("பெயர், பாலினம், தொடர்பு எண் ஆகியவற்றை நிரப்பவும்.");
    }
    try {
      const { id, status, createdAt, ownerUid, memberId, ...rest } = myEditDraft;
      await updateDoc(doc(db, PROFILES_COLLECTION, myProfile.id), rest);
      setEditingMyProfile(false);
      flash("மாற்றங்கள் சேமிக்கப்பட்டன");
    } catch (e) {
      setError("சேமிக்க முடியவில்லை.");
    }
  };

  const handleAdminSignIn = async () => {
    if (!adminEmail.trim() || !passInput.trim()) return setError("மின்னஞ்சல் மற்றும் கடவுச்சொல்லை உள்ளிடவும்.");
    setAuthBusy(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, adminEmail.trim(), passInput);
      setPassInput("");
      setScreen("admin");
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!adminEmail.trim()) return setError("முதலில் மின்னஞ்சலை உள்ளிடவும்.");
    setAuthBusy(true);
    setError("");
    try {
      await sendPasswordResetEmail(auth, adminEmail.trim());
      setResetSent(true);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = () => {
    signOut(auth).catch(() => {});
  };

  // ---------- admin: profiles ----------
  const approveProfile = async (id) => {
    try {
      await updateDoc(doc(db, PROFILES_COLLECTION, id), { status: "approved" });
      flash("சுயவிவரம் ஏற்றுக்கொள்ளப்பட்டது");
    } catch (e) {
      setError("செயல்படுத்த முடியவில்லை.");
    }
  };
  const rejectProfile = async (id) => {
    try {
      await updateDoc(doc(db, PROFILES_COLLECTION, id), { status: "rejected" });
      flash("சுயவிவரம் நிராகரிக்கப்பட்டது");
    } catch (e) {
      setError("செயல்படுத்த முடியவில்லை.");
    }
  };
  const reconsiderProfile = async (id) => {
    try {
      await updateDoc(doc(db, PROFILES_COLLECTION, id), { status: "pending" });
      flash("மீண்டும் பரிசீலனைக்கு அனுப்பப்பட்டது");
    } catch (e) {
      setError("செயல்படுத்த முடியவில்லை.");
    }
  };
  const deleteProfile = async (id) => {
    try {
      await deleteDoc(doc(db, PROFILES_COLLECTION, id));
      if (editingProfileId === id) setEditingProfileId(null);
      flash("நீக்கப்பட்டது");
    } catch (e) {
      setError("நீக்க முடியவில்லை.");
    }
  };
  const startEditProfile = (p) => {
    setEditingProfileId(p.id);
    setEditDraft({ ...EMPTY_PROFILE, ...p });
  };
  const saveEditProfile = async () => {
    if (!editDraft.name.trim() || !editDraft.gender || !editDraft.phone.trim()) {
      return setError("பெயர், பாலினம், தொடர்பு எண் ஆகியவற்றை நிரப்பவும்.");
    }
    try {
      const { id, status, createdAt, ...rest } = editDraft;
      await updateDoc(doc(db, PROFILES_COLLECTION, editingProfileId), rest);
      setEditingProfileId(null);
      flash("மாற்றங்கள் சேமிக்கப்பட்டன");
    } catch (e) {
      setError("சேமிக்க முடியவில்லை.");
    }
  };
  const deleteInterest = async (id) => {
    try {
      await deleteDoc(doc(db, INTERESTS_COLLECTION, id));
    } catch (e) {
      setError("நீக்க முடியவில்லை.");
    }
  };
  const saveSiteSettings = async () => {
    try {
      await setDoc(
        doc(db, "settings", SETTINGS_DOC),
        { siteName: nameDraft.trim() || DEFAULT_SETTINGS.siteName, tagline: taglineDraft.trim() },
        { merge: true }
      );
      flash("அமைப்புகள் சேமிக்கப்பட்டன");
    } catch (e) {
      setError("சேமிக்க முடியவில்லை.");
    }
  };

  const filteredProfiles = useMemo(() => {
    return approvedProfiles.filter((p) => {
      if (filters.gender && p.gender !== filters.gender) return false;
      if (filters.maritalStatus && p.maritalStatus !== filters.maritalStatus) return false;
      if (filters.district && !(p.district || "").toLowerCase().includes(filters.district.trim().toLowerCase())) return false;
      const age = calcAge(p.dob);
      if (filters.minAge && (age === null || age < Number(filters.minAge))) return false;
      if (filters.maxAge && (age === null || age > Number(filters.maxAge))) return false;
      return true;
    });
  }, [approvedProfiles, filters]);

  const pendingProfiles = useMemo(() => allProfiles.filter((p) => p.status === "pending"), [allProfiles]);
  const approvedAdminProfiles = useMemo(() => allProfiles.filter((p) => p.status === "approved"), [allProfiles]);
  const rejectedProfiles = useMemo(() => allProfiles.filter((p) => p.status === "rejected"), [allProfiles]);
  const selectedProfile = approvedProfiles.find((p) => p.id === selectedProfileId) || null;

  // ---------- styles ----------
  const styles = {
    page: { minHeight: "100vh", background: "#0B0F16", fontFamily: "'Inter','Noto Sans Tamil',sans-serif", color: "#EAF0FA", paddingBottom: 50, boxSizing: "border-box" },
    header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid #1B2436", position: "sticky", top: 0, background: "#0B0F16", zIndex: 5, gap: 10 },
    brandBox: { background: "#F4F1EA", color: "#0B0F16", borderRadius: 8, padding: "8px 14px", fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 14, maxWidth: 190, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    pill: { border: "1.5px solid #3A4A6B", color: "#AEBEDD", borderRadius: 999, padding: "7px 16px", fontSize: 12.5, fontFamily: "'IBM Plex Mono',monospace", whiteSpace: "nowrap" },
    banner: { margin: "18px 18px 0", borderRadius: 16, padding: "26px 22px", background: "linear-gradient(135deg,#5C1E3A 0%,#3A1030 60%,#1F0A22 100%)", border: "1px solid #6E2B4E" },
    eyebrow: { fontFamily: "'IBM Plex Mono',monospace", fontSize: 11.5, letterSpacing: "0.16em", color: "#F2A93B", textTransform: "uppercase", marginBottom: 8 },
    h1: { fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 25, lineHeight: 1.25, margin: "0 0 8px", color: "#F6F8FC", textWrap: "balance" },
    h2: { fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 18, margin: "0 0 4px", color: "#F6F8FC" },
    sub: { color: "#D9B8CC", fontSize: 14, lineHeight: 1.55, margin: 0 },
    section: { padding: "22px 18px 0" },
    sectionTitle: { fontFamily: "'Fraunces',serif", fontSize: 19, fontWeight: 600, margin: "0 0 14px", color: "#F6F8FC" },
    roleCard: { display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", padding: "18px", borderRadius: 16, border: "1px solid #6E2B4E", background: "linear-gradient(160deg,#5C1E3A 0%,#2A0E24 100%)", color: "#F6F8FC", marginBottom: 14, cursor: "pointer", fontSize: 16.5, fontFamily: "'Fraunces',serif" },
    card: { background: "#111A2C", border: "1px solid #1E2A44", borderRadius: 16, padding: "20px", margin: "0 18px 16px" },
    label: { fontSize: 13, color: "#8FA0C2", display: "block", marginBottom: 8, fontWeight: 600 },
    input: { width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #263354", background: "#0B1220", color: "#EAF0FA", fontSize: 14.5, marginBottom: 12, fontFamily: "inherit" },
    textarea: { width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #263354", background: "#0B1220", color: "#EAF0FA", fontSize: 14.5, marginBottom: 12, fontFamily: "inherit", minHeight: 90, resize: "vertical" },
    btnPrimary: { width: "100%", padding: "13px 16px", borderRadius: 999, border: "none", background: "#C23B6B", color: "#fff", fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
    btnGhost: { width: "100%", padding: "12px 16px", borderRadius: 999, border: "1.5px solid #C23B6B", background: "transparent", color: "#F0A9C4", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
    row: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #1E2A44" },
    linkBtn: { color: "#F0A9C4", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: 0, fontFamily: "inherit" },
    dangerBtn: { color: "#E4677E", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: 0, fontFamily: "inherit" },
    okBtn: { color: "#8ADB9A", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: 0, fontFamily: "inherit" },
    errBox: { background: "#3A1620", border: "1px solid #C0435A", color: "#FFC9D2", padding: "11px 14px", borderRadius: 10, fontSize: 13.5, margin: "0 18px 16px" },
    flash: { background: "#1A2E17", border: "1px solid #4E8A3E", color: "#C9F2BC", padding: "9px 14px", borderRadius: 10, fontSize: 13, margin: "0 18px 16px" },
    backBar: { background: "none", border: "none", color: "#7C8CAE", fontSize: 13, cursor: "pointer", padding: "14px 18px 0", fontFamily: "'IBM Plex Mono',monospace", display: "block" },
    profileCard: { background: "#111A2C", border: "1px solid #1E2A44", borderRadius: 14, padding: "16px", margin: "0 18px 12px", display: "flex", gap: 14, alignItems: "center", cursor: "pointer", textAlign: "left", width: "calc(100% - 36px)" },
    avatar: { width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(160deg,#5C1E3A,#2A0E24)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0, overflow: "hidden", border: "1px solid #6E2B4E" },
    tabBar: { display: "flex", gap: 8, overflowX: "auto", padding: "0 18px 14px" },
    tabBtn: (active) => ({
      padding: "9px 16px",
      borderRadius: 999,
      border: active ? "1.5px solid #C23B6B" : "1.5px solid #263354",
      background: active ? "#3A1030" : "transparent",
      color: active ? "#F0A9C4" : "#8FA0C2",
      fontSize: 13,
      fontWeight: 700,
      cursor: "pointer",
      fontFamily: "inherit",
      whiteSpace: "nowrap",
    }),
    badge: { fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", color: "#F2A93B", background: "#241B0D", border: "1px solid #4A3A17", padding: "3px 8px", borderRadius: 6 },
    infoGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 14px", margin: "12px 0" },
    infoLabel: { fontSize: 11.5, color: "#7C8CAE", textTransform: "uppercase", letterSpacing: "0.05em" },
    infoValue: { fontSize: 14, color: "#EAF0FA", marginBottom: 6 },
  };

  const Header = () => (
    <div style={styles.header}>
      <div style={styles.brandBox}>{settings.siteName}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={styles.pill} onClick={goAdmin}>நிர்வாகி</button>
      </div>
    </div>
  );

  const Back = ({ to, label, logout }) => (
    <button
      style={styles.backBar}
      onClick={() => {
        setError("");
        setPassInput("");
        setResetSent(false);
        if (logout) handleLogout();
        setScreen(to);
      }}
    >
      ← {label}
    </button>
  );

  const ProfileFormFields = ({ value, onChange }) => (
    <>
      <label style={styles.label}>பெயர் *</label>
      <input style={styles.input} value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} placeholder="முழுப் பெயர்" />

      <label style={styles.label}>பாலினம் *</label>
      <select style={styles.input} value={value.gender} onChange={(e) => onChange({ ...value, gender: e.target.value })}>
        <option value="">தேர்ந்தெடுக்கவும்</option>
        {GENDERS.map((g) => (
          <option key={g} value={g}>{g}</option>
        ))}
      </select>

      <label style={styles.label}>பிறந்த தேதி *</label>
      <input style={styles.input} type="date" max={todayStr()} value={value.dob} onChange={(e) => onChange({ ...value, dob: e.target.value })} />

      <label style={styles.label}>உயரம் (எ.கா. 5'6")</label>
      <input style={styles.input} value={value.height} onChange={(e) => onChange({ ...value, height: e.target.value })} placeholder="5'6&quot;" />

      <label style={styles.label}>மதம்</label>
      <select style={styles.input} value={value.religion} onChange={(e) => onChange({ ...value, religion: e.target.value })}>
        <option value="">தேர்ந்தெடுக்கவும்</option>
        {RELIGIONS.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>

      <label style={styles.label}>ஜாதி (விருப்பம்)</label>
      <input style={styles.input} value={value.caste} onChange={(e) => onChange({ ...value, caste: e.target.value })} />

      <label style={styles.label}>தாய்மொழி</label>
      <input style={styles.input} value={value.motherTongue} onChange={(e) => onChange({ ...value, motherTongue: e.target.value })} />

      <label style={styles.label}>நாடு</label>
      <input style={styles.input} value={value.country} onChange={(e) => onChange({ ...value, country: e.target.value })} />

      <label style={styles.label}>மாவட்டம் / வசிக்கும் இடம்</label>
      <input style={styles.input} value={value.district} onChange={(e) => onChange({ ...value, district: e.target.value })} placeholder="எ.கா. யாழ்ப்பாணம்" />

      <label style={styles.label}>திருமண நிலை</label>
      <select style={styles.input} value={value.maritalStatus} onChange={(e) => onChange({ ...value, maritalStatus: e.target.value })}>
        <option value="">தேர்ந்தெடுக்கவும்</option>
        {MARITAL_STATUSES.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>

      <label style={styles.label}>கல்வித் தகுதி</label>
      <input style={styles.input} value={value.education} onChange={(e) => onChange({ ...value, education: e.target.value })} />

      <label style={styles.label}>தொழில்</label>
      <input style={styles.input} value={value.profession} onChange={(e) => onChange({ ...value, profession: e.target.value })} />

      <label style={styles.label}>புகைப்படம் (விருப்பம்)</label>
      {value.photoUrl && (
        <div style={{ marginBottom: 10 }}>
          <img src={value.photoUrl} alt="preview" style={{ width: 84, height: 84, borderRadius: 12, objectFit: "cover", border: "1px solid #263354" }} />
        </div>
      )}
      <input
        style={styles.input}
        type="file"
        accept="image/*"
        onChange={(e) => handlePhotoFile(e.target.files?.[0], value, onChange)}
      />
      {photoUploading && <div style={{ color: "#9FB0CE", fontSize: 12.5, marginTop: -8, marginBottom: 12 }}>படத்தை சேர்க்கிறது…</div>}

      <label style={styles.label}>தன்னைப் பற்றி</label>
      <textarea style={styles.textarea} value={value.about} onChange={(e) => onChange({ ...value, about: e.target.value })} placeholder="குடும்பம், பொழுதுபோக்கு, எதிர்பார்ப்பு போன்றவை..." />

      <label style={styles.label}>தொடர்பு எண் *</label>
      <input style={styles.input} value={value.phone} onChange={(e) => onChange({ ...value, phone: e.target.value })} placeholder="+94 7X XXX XXXX" />

      <label style={styles.label}>மின்னஞ்சல் (விருப்பம்)</label>
      <input style={styles.input} type="email" value={value.email} onChange={(e) => onChange({ ...value, email: e.target.value })} />
    </>
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
          <h1 style={styles.h1}>{settings.siteName}</h1>
          <p style={styles.sub}>{settings.tagline}</p>
        </div>
        <div style={styles.section}>
          <div style={styles.sectionTitle}>தொடர்வது எப்படி?</div>
          <button style={styles.roleCard} onClick={() => { setError(""); setRegisterDone(false); setScreen("register"); }}>
            <span style={{ fontSize: 26 }}>📝</span><span>சுயவிவரம் பதிவு செய்ய</span>
          </button>
          <button style={styles.roleCard} onClick={() => { setError(""); setScreen("browse"); }}>
            <span style={{ fontSize: 26 }}>💞</span><span>சுயவிவரங்களை பார்வையிட</span>
          </button>
          <button style={styles.roleCard} onClick={goMemberArea}>
            <span style={{ fontSize: 26 }}>👤</span><span>உறுப்பினர் / எனது Dashboard</span>
          </button>
        </div>
        <div style={styles.section}>
          <div style={{ ...styles.card, margin: 0 }}>
            <p style={{ color: "#9FB0CE", fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
              தற்போது <strong style={{ color: "#F6F8FC" }}>{approvedProfiles.length}</strong> ஏற்றுக்கொள்ளப்பட்ட சுயவிவரங்கள் உள்ளன. நீங்கள் பதிவு செய்யும் சுயவிவரம் நிர்வாகியால் பரிசீலிக்கப்பட்ட பின் மட்டுமே பொதுவில் காணப்படும்.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---------- REGISTER ----------
  if (screen === "register") {
    if (registerDone) {
      return (
        <div style={styles.page}>
          <Header />
          <Back to="home" label="முகப்புக்கு" />
          <div style={styles.section}>
            <div style={styles.eyebrow}>நன்றி</div>
            <h1 style={styles.h1}>உங்கள் சுயவிவரம் பதிவு செய்யப்பட்டது</h1>
          </div>
          <div style={styles.card}>
            {registeredMemberId && (
              <>
                <div style={styles.infoLabel}>உங்கள் Profile ID</div>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 26, fontWeight: 700, color: "#F2A93B", marginBottom: 14 }}>{registeredMemberId}</div>
              </>
            )}
            <p style={{ color: "#9FB0CE", fontSize: 14.5, lineHeight: 1.6, margin: 0 }}>
              நிர்வாகி பரிசீலித்து ஏற்றுக்கொண்ட பின் உங்கள் சுயவிவரம் பொதுவில் காணப்படும். உங்கள் தொடர்பு எண் + கடவுச்சொல் வைத்து "உறுப்பினர்" பட்டன் மூலம் எப்போதும் login செய்து உங்கள் status-ஐ பார்க்கலாம்.
            </p>
          </div>
          <button style={{ ...styles.btnGhost, margin: "0 18px", width: "calc(100% - 36px)" }} onClick={() => setScreen("memberDashboard")}>எனது Dashboard-க்கு செல்ல</button>
        </div>
      );
    }
    return (
      <div style={styles.page}>
        <Header />
        <Back to="home" label="பின்செல்" />
        <div style={styles.section}>
          <div style={styles.eyebrow}>சுயவிவரம் பதிவு</div>
          <h1 style={styles.h1}>உங்கள் விவரங்களை உள்ளிடவும்</h1>
        </div>
        {error && <div style={styles.errBox}>{error}</div>}
        <div style={styles.card}>
          <ProfileFormFields value={registerForm} onChange={setRegisterForm} />
          <label style={styles.label}>கடவுச்சொல் * (login-க்கு பயன்படும்)</label>
          <input style={styles.input} type="password" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} placeholder="குறைந்தது 6 எழுத்துகள்" />
          <label style={styles.label}>கடவுச்சொல் மீண்டும் *</label>
          <input style={styles.input} type="password" value={registerPasswordConfirm} onChange={(e) => setRegisterPasswordConfirm(e.target.value)} />
          <button style={styles.btnPrimary} onClick={handleRegisterSubmit} disabled={registerBusy || photoUploading}>
            {registerBusy ? "சமர்ப்பிக்கிறது…" : "சுயவிவரத்தை சமர்ப்பிக்க"}
          </button>
        </div>
      </div>
    );
  }

  // ---------- BROWSE ----------
  if (screen === "browse") {
    return (
      <div style={styles.page}>
        <Header />
        <Back to="home" label="பின்செல்" />
        <div style={styles.section}>
          <div style={styles.eyebrow}>சுயவிவரங்கள்</div>
          <h1 style={styles.h1}>பொருத்தமான துணையைத் தேடுங்கள்</h1>
        </div>
        <div style={styles.card}>
          <label style={styles.label}>பாலினம்</label>
          <select style={styles.input} value={filters.gender} onChange={(e) => setFilters({ ...filters, gender: e.target.value })}>
            <option value="">அனைத்தும்</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <label style={styles.label}>மாவட்டம்</label>
          <input style={styles.input} value={filters.district} onChange={(e) => setFilters({ ...filters, district: e.target.value })} placeholder="எ.கா. யாழ்ப்பாணம்" />
          <label style={styles.label}>திருமண நிலை</label>
          <select style={styles.input} value={filters.maritalStatus} onChange={(e) => setFilters({ ...filters, maritalStatus: e.target.value })}>
            <option value="">அனைத்தும்</option>
            {MARITAL_STATUSES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>குறைந்த வயது</label>
              <input style={{ ...styles.input, marginBottom: 0 }} type="number" value={filters.minAge} onChange={(e) => setFilters({ ...filters, minAge: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>அதிக வயது</label>
              <input style={{ ...styles.input, marginBottom: 0 }} type="number" value={filters.maxAge} onChange={(e) => setFilters({ ...filters, maxAge: e.target.value })} />
            </div>
          </div>
        </div>

        {filteredProfiles.length === 0 && (
          <div style={styles.card}>
            <p style={{ color: "#9FB0CE", fontSize: 14, margin: 0 }}>பொருந்தும் சுயவிவரங்கள் இல்லை.</p>
          </div>
        )}

        {filteredProfiles.map((p) => {
          const age = calcAge(p.dob);
          return (
            <button key={p.id} style={styles.profileCard} onClick={() => { setSelectedProfileId(p.id); setScreen("profile"); }}>
              <div style={styles.avatar}>
                {p.photoUrl ? <img src={p.photoUrl} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (p.gender === "பெண்" ? "👰" : "🤵")}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 16, color: "#F6F8FC" }}>{p.name}</div>
                <div style={{ color: "#9FB0CE", fontSize: 13 }}>
                  {age !== null ? `${age} வயது` : ""}{p.district ? ` • ${p.district}` : ""}{p.profession ? ` • ${p.profession}` : ""}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // ---------- PROFILE DETAIL ----------
  if (screen === "profile" && selectedProfile) {
    const p = selectedProfile;
    const age = calcAge(p.dob);
    return (
      <div style={styles.page}>
        <Header />
        <Back to="browse" label="பின்செல்" />
        <div style={styles.section}>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ ...styles.avatar, width: 84, height: 84, fontSize: 34 }}>
              {p.photoUrl ? <img src={p.photoUrl} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (p.gender === "பெண்" ? "👰" : "🤵")}
            </div>
            <div>
              <h1 style={{ ...styles.h1, marginBottom: 2 }}>{p.name}</h1>
              <p style={styles.sub}>{age !== null ? `${age} வயது` : ""}{p.height ? ` • ${p.height}` : ""}</p>
            </div>
          </div>
        </div>
        {error && <div style={styles.errBox}>{error}</div>}
        <div style={styles.card}>
          <div style={styles.infoGrid}>
            <div><div style={styles.infoLabel}>மதம்</div><div style={styles.infoValue}>{p.religion || "-"}</div></div>
            <div><div style={styles.infoLabel}>ஜாதி</div><div style={styles.infoValue}>{p.caste || "-"}</div></div>
            <div><div style={styles.infoLabel}>தாய்மொழி</div><div style={styles.infoValue}>{p.motherTongue || "-"}</div></div>
            <div><div style={styles.infoLabel}>நாடு</div><div style={styles.infoValue}>{p.country || "-"}</div></div>
            <div><div style={styles.infoLabel}>மாவட்டம்</div><div style={styles.infoValue}>{p.district || "-"}</div></div>
            <div><div style={styles.infoLabel}>திருமண நிலை</div><div style={styles.infoValue}>{p.maritalStatus || "-"}</div></div>
            <div><div style={styles.infoLabel}>கல்வி</div><div style={styles.infoValue}>{p.education || "-"}</div></div>
            <div><div style={styles.infoLabel}>தொழில்</div><div style={styles.infoValue}>{p.profession || "-"}</div></div>
          </div>
          {p.about && (
            <>
              <div style={styles.infoLabel}>தன்னைப் பற்றி</div>
              <p style={{ color: "#EAF0FA", fontSize: 14, lineHeight: 1.6 }}>{p.about}</p>
            </>
          )}
        </div>

        <div style={styles.card}>
          <div style={styles.eyebrow}>தொடர்பு</div>
          <p style={{ color: "#9FB0CE", fontSize: 13.5, lineHeight: 1.6, marginTop: 0 }}>
            தனியுரிமை காரணமாக தொடர்பு விவரங்கள் நேரடியாக காட்டப்படாது. கீழே உங்கள் விவரத்தை பதிவு செய்யவும் — நிர்வாகி இரு தரப்பையும் இணைப்பார்.
          </p>
          {interestDone ? (
            <div style={styles.flash}>உங்கள் விருப்பம் பதிவு செய்யப்பட்டது. நிர்வாகி விரைவில் தொடர்பு கொள்வார்.</div>
          ) : (
            <>
              <label style={styles.label}>உங்கள் பெயர் *</label>
              <input style={styles.input} value={interestForm.requesterName} onChange={(e) => setInterestForm({ ...interestForm, requesterName: e.target.value })} />
              <label style={styles.label}>உங்கள் தொடர்பு எண் *</label>
              <input style={styles.input} value={interestForm.requesterPhone} onChange={(e) => setInterestForm({ ...interestForm, requesterPhone: e.target.value })} />
              <label style={styles.label}>செய்தி (விருப்பம்)</label>
              <textarea style={styles.textarea} value={interestForm.message} onChange={(e) => setInterestForm({ ...interestForm, message: e.target.value })} />
              <button style={styles.btnPrimary} onClick={handleInterestSubmit} disabled={interestBusy}>
                {interestBusy ? "அனுப்புகிறது…" : "விருப்பம் தெரிவிக்க"}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }
  if (screen === "profile" && !selectedProfile) {
    setScreen("browse");
    return null;
  }

  // ---------- ADMIN LOGIN ----------
  if (screen === "adminLogin") {
    return (
      <div style={styles.page}>
        <Header />
        <Back to="home" label="பின்செல்" />
        <div style={styles.section}>
          <div style={styles.eyebrow}>நிர்வாகி நுழைவு</div>
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
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdminSignIn()}
            placeholder="admin@example.com"
          />
          <label style={styles.label}>கடவுச்சொல்</label>
          <input
            style={styles.input}
            type="password"
            autoComplete="current-password"
            value={passInput}
            onChange={(e) => setPassInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdminSignIn()}
            placeholder="கடவுச்சொல்"
          />
          <button style={styles.btnPrimary} onClick={handleAdminSignIn} disabled={authBusy}>
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

  // ---------- MEMBER LOGIN ----------
  if (screen === "memberLogin") {
    return (
      <div style={styles.page}>
        <Header />
        <Back to="home" label="பின்செல்" />
        <div style={styles.section}>
          <div style={styles.eyebrow}>உறுப்பினர் நுழைவு</div>
          <h1 style={styles.h1}>உங்கள் Dashboard-க்கு உள்நுழையவும்</h1>
        </div>
        {error && <div style={styles.errBox}>{error}</div>}
        <div style={styles.card}>
          <label style={styles.label}>பதிவு செய்த தொடர்பு எண்</label>
          <input
            style={styles.input}
            value={memberPhone}
            onChange={(e) => setMemberPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleMemberSignIn()}
            placeholder="+94 7X XXX XXXX"
          />
          <label style={styles.label}>கடவுச்சொல்</label>
          <input
            style={styles.input}
            type="password"
            value={memberPassword}
            onChange={(e) => setMemberPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleMemberSignIn()}
            placeholder="கடவுச்சொல்"
          />
          <button style={styles.btnPrimary} onClick={handleMemberSignIn} disabled={authBusy}>
            {authBusy ? "உள்நுழைகிறது…" : "LOGIN NOW"}
          </button>
          <div style={{ height: 14 }} />
          <p style={{ color: "#7C8CAE", fontSize: 12.5, margin: 0, textAlign: "center" }}>
            கணக்கு இல்லையா?{" "}
            <button style={{ ...styles.linkBtn, display: "inline" }} onClick={() => { setError(""); setRegisterDone(false); setScreen("register"); }}>
              சுயவிவரம் பதிவு செய்யவும்
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ---------- MEMBER DASHBOARD ----------
  if (screen === "memberDashboard") {
    if (!authUser) {
      setScreen("memberLogin");
      return null;
    }
    if (isAdminUser === null) {
      return (
        <div style={styles.page}>
          <Header />
          <div style={styles.section}><div style={styles.eyebrow}>சரிபார்க்கிறது…</div></div>
        </div>
      );
    }
    if (isAdminUser) {
      setScreen("memberLogin");
      return null;
    }
    const age = myProfile ? calcAge(myProfile.dob) : null;
    return (
      <div style={styles.page}>
        <Header />
        <Back to="home" label="வெளியேறு" logout />
        <div style={styles.section}>
          <div style={styles.eyebrow}>எனது Dashboard</div>
          <h1 style={styles.h1}>{myProfile ? myProfile.name : "உங்கள் கணக்கு"}</h1>
        </div>
        {error && <div style={styles.errBox}>{error}</div>}
        {savedFlash && <div style={styles.flash}>{savedFlash}</div>}

        {!myProfile && (
          <div style={styles.card}>
            <p style={{ color: "#9FB0CE", fontSize: 14, margin: 0 }}>சுயவிவரம் காணப்படவில்லை.</p>
          </div>
        )}

        {myProfile && !editingMyProfile && (
          <div style={styles.card}>
            <div style={styles.infoGrid}>
              <div><div style={styles.infoLabel}>Profile ID</div><div style={styles.infoValue}>{myProfile.memberId || "-"}</div></div>
              <div><div style={styles.infoLabel}>நிலை</div><div style={styles.infoValue}>{STATUS_LABELS[myProfile.status] || myProfile.status}</div></div>
              <div><div style={styles.infoLabel}>வயது</div><div style={styles.infoValue}>{age !== null ? age : "-"}</div></div>
              <div><div style={styles.infoLabel}>மாவட்டம்</div><div style={styles.infoValue}>{myProfile.district || "-"}</div></div>
            </div>
            <button style={styles.btnGhost} onClick={startEditMyProfile}>எனது சுயவிவரத்தை திருத்த</button>
          </div>
        )}

        {myProfile && editingMyProfile && (
          <div style={styles.card}>
            <ProfileFormFields value={myEditDraft} onChange={setMyEditDraft} />
            <div style={{ display: "flex", gap: 10 }}>
              <button style={styles.btnPrimary} onClick={saveMyProfile} disabled={photoUploading}>சேமிக்க</button>
              <button style={styles.btnGhost} onClick={() => setEditingMyProfile(false)}>ரத்து</button>
            </div>
          </div>
        )}

        <div style={styles.section}>
          <div style={styles.sectionTitle}>📥 எனக்கு வந்த விருப்பங்கள் ({myInterestsReceived.length})</div>
        </div>
        <div style={styles.card}>
          {myInterestsReceived.length === 0 && <p style={{ color: "#9FB0CE", fontSize: 14, margin: 0 }}>இதுவரை யாரும் விருப்பம் தெரிவிக்கவில்லை.</p>}
          {myInterestsReceived.map((it) => (
            <div key={it.id} style={{ background: "#0B1220", border: "1px solid #1E2A44", borderRadius: 10, padding: "12px", marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{it.requesterName}</div>
              <div style={{ color: "#7C8CAE", fontSize: 12.5, marginTop: 3 }}>{it.requesterPhone} • {fmtDate(it.createdAt)}</div>
              {it.message && <div style={{ color: "#9FB0CE", fontSize: 13, marginTop: 6 }}>{it.message}</div>}
            </div>
          ))}
        </div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>📤 நான் தெரிவித்த விருப்பங்கள் ({myInterestsSent.length})</div>
        </div>
        <div style={styles.card}>
          {myInterestsSent.length === 0 && <p style={{ color: "#9FB0CE", fontSize: 14, margin: 0 }}>நீங்கள் இதுவரை யாருக்கும் விருப்பம் தெரிவிக்கவில்லை.</p>}
          {myInterestsSent.map((it) => {
            const target = approvedProfiles.find((p) => p.id === it.profileId);
            return (
              <div key={it.id} style={{ background: "#0B1220", border: "1px solid #1E2A44", borderRadius: 10, padding: "12px", marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{target ? target.name : "சுயவிவரம்"}</div>
                <div style={{ color: "#7C8CAE", fontSize: 12.5, marginTop: 3 }}>{fmtDate(it.createdAt)}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ---------- ADMIN DASHBOARD ----------
  if (screen === "admin") {
    if (!authUser) {
      setScreen("adminLogin");
      return null;
    }
    if (isAdminUser === null) {
      return (
        <div style={styles.page}>
          <Header />
          <div style={styles.section}><div style={styles.eyebrow}>சரிபார்க்கிறது…</div></div>
        </div>
      );
    }
    if (!isAdminUser) {
      setScreen("adminLogin");
      return null;
    }

    const renderProfileRow = (p, actions) => {
      const age = calcAge(p.dob);
      const isEditing = editingProfileId === p.id;
      return (
        <div key={p.id} style={{ background: "#0B1220", border: "1px solid #1E2A44", borderRadius: 12, padding: "14px", marginBottom: 10 }}>
          <div style={styles.row}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name} <span style={styles.badge}>{p.gender}</span>{p.memberId && <span style={styles.badge}> #{p.memberId}</span>}</div>
              <div style={{ color: "#7C8CAE", fontSize: 12.5, marginTop: 3 }}>
                {age !== null ? `${age} வயது` : ""}{p.district ? ` • ${p.district}` : ""}{p.phone ? ` • ${p.phone}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>{actions}</div>
          </div>
          {isEditing && (
            <div style={{ paddingTop: 12 }}>
              <ProfileFormFields value={editDraft} onChange={setEditDraft} />
              <div style={{ display: "flex", gap: 10 }}>
                <button style={styles.btnPrimary} onClick={saveEditProfile} disabled={photoUploading}>சேமிக்க</button>
                <button style={styles.btnGhost} onClick={() => setEditingProfileId(null)}>ரத்து</button>
              </div>
            </div>
          )}
        </div>
      );
    };

    return (
      <div style={styles.page}>
        <Header />
        <Back to="home" label="வெளியேறு" logout />
        <div style={styles.section}>
          <div style={styles.eyebrow}>நிர்வாகி பலகை</div>
          <h1 style={styles.h1}>சுயவிவரங்களை நிர்வகிக்கவும்</h1>
        </div>
        {error && <div style={styles.errBox}>{error}</div>}
        {savedFlash && <div style={styles.flash}>{savedFlash}</div>}

        <div style={styles.tabBar}>
          <button style={styles.tabBtn(adminTab === "pending")} onClick={() => setAdminTab("pending")}>பரிசீலனையில் ({pendingProfiles.length})</button>
          <button style={styles.tabBtn(adminTab === "approved")} onClick={() => setAdminTab("approved")}>ஏற்கப்பட்டவை ({approvedAdminProfiles.length})</button>
          <button style={styles.tabBtn(adminTab === "rejected")} onClick={() => setAdminTab("rejected")}>நிராகரிக்கப்பட்டவை ({rejectedProfiles.length})</button>
          <button style={styles.tabBtn(adminTab === "interests")} onClick={() => setAdminTab("interests")}>ஆர்வம் தெரிவித்தவர் ({interests.length})</button>
          <button style={styles.tabBtn(adminTab === "settings")} onClick={() => setAdminTab("settings")}>அமைப்புகள்</button>
        </div>

        {adminTab === "pending" && (
          <div style={styles.card}>
            {pendingProfiles.length === 0 && <p style={{ color: "#9FB0CE", fontSize: 14, margin: 0 }}>பரிசீலனையில் சுயவிவரங்கள் இல்லை.</p>}
            {pendingProfiles.map((p) =>
              renderProfileRow(p, [
                <button key="a" style={styles.okBtn} onClick={() => approveProfile(p.id)}>ஏற்றுக்கொள்</button>,
                <button key="r" style={styles.dangerBtn} onClick={() => rejectProfile(p.id)}>நிராகரி</button>,
                <button key="e" style={styles.linkBtn} onClick={() => startEditProfile(p)}>திருத்து</button>,
                <button key="d" style={styles.dangerBtn} onClick={() => deleteProfile(p.id)}>நீக்கு</button>,
              ])
            )}
          </div>
        )}

        {adminTab === "approved" && (
          <div style={styles.card}>
            {approvedAdminProfiles.length === 0 && <p style={{ color: "#9FB0CE", fontSize: 14, margin: 0 }}>ஏற்கப்பட்ட சுயவிவரங்கள் இல்லை.</p>}
            {approvedAdminProfiles.map((p) =>
              renderProfileRow(p, [
                <button key="e" style={styles.linkBtn} onClick={() => startEditProfile(p)}>திருத்து</button>,
                <button key="r" style={styles.dangerBtn} onClick={() => rejectProfile(p.id)}>நிராகரி</button>,
                <button key="d" style={styles.dangerBtn} onClick={() => deleteProfile(p.id)}>நீக்கு</button>,
              ])
            )}
          </div>
        )}

        {adminTab === "rejected" && (
          <div style={styles.card}>
            {rejectedProfiles.length === 0 && <p style={{ color: "#9FB0CE", fontSize: 14, margin: 0 }}>நிராகரிக்கப்பட்ட சுயவிவரங்கள் இல்லை.</p>}
            {rejectedProfiles.map((p) =>
              renderProfileRow(p, [
                <button key="o" style={styles.okBtn} onClick={() => reconsiderProfile(p.id)}>மீண்டும் பரிசீலி</button>,
                <button key="d" style={styles.dangerBtn} onClick={() => deleteProfile(p.id)}>நீக்கு</button>,
              ])
            )}
          </div>
        )}

        {adminTab === "interests" && (
          <div style={styles.card}>
            {interests.length === 0 && <p style={{ color: "#9FB0CE", fontSize: 14, margin: 0 }}>ஆர்வம் தெரிவித்தவர்கள் இல்லை.</p>}
            {interests.map((it) => {
              const target = allProfiles.find((p) => p.id === it.profileId);
              return (
                <div key={it.id} style={{ background: "#0B1220", border: "1px solid #1E2A44", borderRadius: 12, padding: "14px", marginBottom: 10 }}>
                  <div style={styles.row}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14.5 }}>{it.requesterName} <span style={{ color: "#7C8CAE", fontWeight: 400, fontSize: 12.5 }}>→ {target ? target.name : "(நீக்கப்பட்ட சுயவிவரம்)"}</span></div>
                      <div style={{ color: "#7C8CAE", fontSize: 12.5, marginTop: 3 }}>
                        {it.requesterPhone}{target?.phone ? ` • சுயவிவர எண்: ${target.phone}` : ""} • {fmtDate(it.createdAt)}
                      </div>
                      {it.message && <div style={{ color: "#9FB0CE", fontSize: 13, marginTop: 6 }}>{it.message}</div>}
                    </div>
                    <button style={styles.dangerBtn} onClick={() => deleteInterest(it.id)}>நீக்கு</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {adminTab === "settings" && (
          <div style={styles.card}>
            <label style={styles.label}>தளத்தின் பெயர்</label>
            <input style={styles.input} value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
            <label style={styles.label}>Tagline</label>
            <input style={styles.input} value={taglineDraft} onChange={(e) => setTaglineDraft(e.target.value)} />
            <button style={styles.btnGhost} onClick={saveSiteSettings}>அமைப்புகளை சேமிக்க</button>
          </div>
        )}
      </div>
    );
  }

  setScreen("home");
  return null;
}

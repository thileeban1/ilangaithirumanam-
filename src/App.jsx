import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  collectionGroup,
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
  arrayUnion,
  increment,
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
const MAX_PHOTOS = 3;

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
const RASIS = ["மேஷம்", "ரிஷபம்", "மிதுனம்", "கடகம்", "சிம்மம்", "கன்னி", "துலாம்", "விருச்சிகம்", "தனுசு", "மகரம்", "கும்பம்", "மீனம்"];
const NATCHATHIRAMS = [
  "அஸ்வினி", "பரணி", "கார்த்திகை", "ரோகிணி", "மிருகசீரிடம்", "திருவாதிரை", "புனர்பூசம்",
  "பூசம்", "ஆயில்யம்", "மகம்", "பூரம்", "உத்திரம்", "ஹஸ்தம்", "சித்திரை", "சுவாதி",
  "விசாகம்", "அனுஷம்", "கேட்டை", "மூலம்", "பூராடம்", "உத்திராடம்", "திருவோணம்",
  "அவிட்டம்", "சதயம்", "பூரட்டாதி", "உத்திரட்டாதி", "ரேவதி",
];

const EMPTY_PROFILE = {
  name: "",
  gender: "",
  dob: "",
  birthTime: "",
  rasi: "",
  natchathiram: "",
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
  photoUrls: [],
};

// All of a profile's photos, whether they were saved under the old
// single-photo field (photoUrl) or the current multi-photo array (photoUrls).
const allPhotosOf = (p) => (p?.photoUrls && p.photoUrls.length > 0 ? p.photoUrls : p?.photoUrl ? [p.photoUrl] : []);

const EMPTY_INTEREST = { requesterName: "", requesterPhone: "", message: "" };

const DEFAULT_SETTINGS = {
  siteName: "இலங்கை தமிழர் திருமண மையம்",
  tagline: "நம்பிக்கையுடன் ஒரு புதிய தொடக்கம்",
  adminWhatsapp: "0752495266",
};

const PROFILES_COLLECTION = "profiles";
const INTERESTS_COLLECTION = "interests";
const ADMINS_COLLECTION = "admins";
const MEMBERS_COLLECTION = "members";
const SETTINGS_DOC = "site";

// name/photos are gated behind a "photo unlock"; phone/email behind a
// "phone unlock" — kept in separate private subcollections under each
// profile so Firestore rules (not just the UI) enforce who can read them.
const IDENTITY_FIELDS = ["name", "photoUrls"];
const CONTACT_FIELDS = ["phone", "email"];
const splitProfileFields = (f) => {
  const identity = { name: f.name || "", photoUrls: f.photoUrls || [] };
  const contact = { phone: f.phone || "", email: f.email || "" };
  const publicFields = { ...f };
  IDENTITY_FIELDS.concat(CONTACT_FIELDS).forEach((k) => delete publicFields[k]);
  return { publicFields, identity, contact };
};

// Seed values only — the admin can change price/months/quotas for every
// package at any time from the settings tab; the live numbers are stored in
// the settings/packages document and loaded into the `packages` state below.
// Adding a new key here (and it will show up for the admin to configure)
// is the only code change needed to introduce another tier later.
const DEFAULT_PACKAGES = {
  start: { key: "start", label: "Start", price: 3000, months: 1, photoQuota: 5, phoneQuota: 2 },
  pro: { key: "pro", label: "Pro", price: 8000, months: 3, photoQuota: 20, phoneQuota: 5 },
  superpro: { key: "superpro", label: "Super Pro", price: 15000, months: 6, photoQuota: 50, phoneQuota: 15 },
  megapro: { key: "megapro", label: "Mega Pro", price: 25000, months: 12, photoQuota: 100, phoneQuota: 20 },
};
const PACKAGES_DOC = "packages";

const MEMBER_EMAIL_DOMAIN = "members.lanka-matrimony.app";
const digitsOnly = (s) => (s || "").replace(/\D/g, "");
const memberEmailFromPhone = (phone) => `m${digitsOnly(phone)}@${MEMBER_EMAIL_DOMAIN}`;

// Converts a local Sri Lankan number (07XXXXXXXX) or an already-international
// one to the digits-only, country-code-prefixed form WhatsApp's wa.me links
// need, e.g. "0752495266" -> "94752495266".
const waLink = (phone, text) => {
  let digits = digitsOnly(phone);
  if (digits.startsWith("0")) digits = "94" + digits.slice(1);
  else if (!digits.startsWith("94")) digits = "94" + digits;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
};

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

// ---------- styles (static, defined once) ----------
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

// ---------- shared components (top-level, so typing in their inputs never
// remounts them and loses focus — these must NEVER be defined inside
// MatrimonyApp's render body) ----------
function Header({ siteName, onAdminClick }) {
  return (
    <div style={styles.header}>
      <div style={styles.brandBox}>{siteName}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={styles.pill} onClick={onAdminClick}>நிர்வாகி</button>
      </div>
    </div>
  );
}

function Back({ to, label, logout, onGo }) {
  return (
    <button style={styles.backBar} onClick={() => onGo(to, logout)}>
      ← {label}
    </button>
  );
}

// Displays a member's photo with basic anti-copy deterrents (no drag/save
// via right-click or long-press) and a tiled, semi-transparent watermark
// naming whoever is viewing it, so a leaked screenshot can be traced back.
// None of this can actually stop a screenshot — that isn't possible from a
// web page — it only discourages casual saving/forwarding.
function ProtectedPhoto({ src, alt, watermark }) {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <img
        src={src}
        alt={alt}
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
        }}
      />
      {watermark && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            overflow: "hidden",
            display: "flex",
            flexWrap: "wrap",
            alignContent: "space-around",
            justifyContent: "space-around",
            transform: "rotate(-25deg) scale(1.5)",
          }}
        >
          {Array.from({ length: 9 }).map((_, i) => (
            <span
              key={i}
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.55)",
                fontFamily: "'IBM Plex Mono',monospace",
                whiteSpace: "nowrap",
                textShadow: "0 0 2px rgba(0,0,0,0.85)",
              }}
            >
              {watermark}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileFormFields({ value, onChange, onAddPhoto, onRemovePhoto, photoUploading }) {
  return (
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

      <label style={styles.label}>பிறந்த நேரம் (விருப்பம்)</label>
      <input style={styles.input} type="time" value={value.birthTime} onChange={(e) => onChange({ ...value, birthTime: e.target.value })} />

      <label style={styles.label}>ராசி (விருப்பம்)</label>
      <select style={styles.input} value={value.rasi} onChange={(e) => onChange({ ...value, rasi: e.target.value })}>
        <option value="">தேர்ந்தெடுக்கவும்</option>
        {RASIS.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>

      <label style={styles.label}>நட்சத்திரம் (விருப்பம்)</label>
      <select style={styles.input} value={value.natchathiram} onChange={(e) => onChange({ ...value, natchathiram: e.target.value })}>
        <option value="">தேர்ந்தெடுக்கவும்</option>
        {NATCHATHIRAMS.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>

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

      <label style={styles.label}>புகைப்படங்கள் * (குறைந்தது 1, அதிகபட்சம் {MAX_PHOTOS})</label>
      {value.photoUrls?.length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          {value.photoUrls.map((url, i) => (
            <div key={i} style={{ position: "relative" }}>
              <img src={url} alt={`preview ${i + 1}`} style={{ width: 84, height: 84, borderRadius: 12, objectFit: "cover", border: "1px solid #263354", display: "block" }} />
              <button
                type="button"
                onClick={() => onRemovePhoto(i, value, onChange)}
                aria-label="படத்தை நீக்க"
                style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: "50%", border: "none", background: "#C23B6B", color: "#fff", fontSize: 13, lineHeight: "22px", padding: 0, cursor: "pointer" }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {(value.photoUrls?.length || 0) < MAX_PHOTOS && (
        <input
          style={styles.input}
          type="file"
          accept="image/*"
          onChange={(e) => {
            onAddPhoto(e.target.files?.[0], value, onChange);
            e.target.value = "";
          }}
        />
      )}
      {photoUploading && <div style={{ color: "#9FB0CE", fontSize: 12.5, marginTop: -8, marginBottom: 12 }}>படத்தை சேர்க்கிறது…</div>}

      <label style={styles.label}>தன்னைப் பற்றி</label>
      <textarea style={styles.textarea} value={value.about} onChange={(e) => onChange({ ...value, about: e.target.value })} placeholder="குடும்பம், பொழுதுபோக்கு, எதிர்பார்ப்பு போன்றவை..." />

      <label style={styles.label}>தொடர்பு எண் *</label>
      <input style={styles.input} value={value.phone} onChange={(e) => onChange({ ...value, phone: e.target.value })} placeholder="+94 7X XXX XXXX" />

      <label style={styles.label}>மின்னஞ்சல் (விருப்பம்)</label>
      <input style={styles.input} type="email" value={value.email} onChange={(e) => onChange({ ...value, email: e.target.value })} />
    </>
  );
}

export default function MatrimonyApp() {
  const [screen, setScreen] = useState("home"); // home | register | browse | profile | adminLogin | admin
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savedFlash, setSavedFlash] = useState("");

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [packages, setPackages] = useState(DEFAULT_PACKAGES);
  const [packageDrafts, setPackageDrafts] = useState({});
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
  const [myMember, setMyMember] = useState(null);
  const [myIdentity, setMyIdentity] = useState(null);
  const [myContact, setMyContact] = useState(null);
  const [myInterestsSent, setMyInterestsSent] = useState([]);
  const [myInterestsReceived, setMyInterestsReceived] = useState([]);
  const [editingMyProfile, setEditingMyProfile] = useState(false);
  const [myEditDraft, setMyEditDraft] = useState(EMPTY_PROFILE);

  // browse filters
  const [filters, setFilters] = useState({ gender: "", district: "", maritalStatus: "", minAge: "", maxAge: "" });

  // profile detail: unlocked private data for the profile being viewed
  const [viewedIdentity, setViewedIdentity] = useState(null);
  const [viewedContact, setViewedContact] = useState(null);

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
  const [allPrivate, setAllPrivate] = useState({}); // profileId -> { identity, contact }
  const [interests, setInterests] = useState([]);
  const [adminTab, setAdminTab] = useState("pending"); // pending | approved | rejected | interests | settings
  const [editingProfileId, setEditingProfileId] = useState(null);
  const [editDraft, setEditDraft] = useState(EMPTY_PROFILE);
  const [editDraftMember, setEditDraftMember] = useState(null);
  const [nameDraft, setNameDraft] = useState("");
  const [taglineDraft, setTaglineDraft] = useState("");
  const [whatsappDraft, setWhatsappDraft] = useState("");

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
        setWhatsappDraft((v) => v || merged.adminWhatsapp || "");
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
    if (!firebaseConfigured || !db) return;
    const unsub = onSnapshot(doc(db, "settings", PACKAGES_DOC), (snap) => {
      const live = snap.exists() ? snap.data() : {};
      const merged = {};
      Object.keys(DEFAULT_PACKAGES).forEach((k) => {
        merged[k] = { ...DEFAULT_PACKAGES[k], ...(live[k] || {}) };
      });
      setPackages(merged);
    });
    return unsub;
  }, []);

  useEffect(() => {
    setPackageDrafts(packages);
  }, [packages]);

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
      setAllPrivate({});
      setInterests([]);
      return;
    }
    const unsubAll = onSnapshot(collection(db, PROFILES_COLLECTION), (snap) => {
      setAllProfiles(sortByCreatedDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    });
    const unsubPrivate = onSnapshot(collectionGroup(db, "private"), (snap) => {
      const map = {};
      snap.docs.forEach((d) => {
        const profileId = d.ref.parent.parent.id;
        if (!map[profileId]) map[profileId] = {};
        map[profileId][d.id] = d.data();
      });
      setAllPrivate(map);
    });
    const unsubInterests = onSnapshot(collection(db, INTERESTS_COLLECTION), (snap) => {
      setInterests(sortByCreatedDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    });
    return () => {
      unsubAll();
      unsubPrivate();
      unsubInterests();
    };
  }, [authUser, isAdminUser]);

  useEffect(() => {
    if (!authUser || isAdminUser || !db) {
      setMyProfile(null);
      setMyMember(null);
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
    const unsubMember = onSnapshot(doc(db, MEMBERS_COLLECTION, authUser.uid), (snap) => {
      setMyMember(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
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
      unsubMember();
      unsubSent();
      unsubReceived();
    };
  }, [authUser, isAdminUser]);

  useEffect(() => {
    if (!myProfile || isAdminUser) {
      setMyIdentity(null);
      setMyContact(null);
      return;
    }
    const unsubIdentity = onSnapshot(doc(db, PROFILES_COLLECTION, myProfile.id, "private", "identity"), (s) =>
      setMyIdentity(s.exists() ? s.data() : null)
    );
    const unsubContact = onSnapshot(doc(db, PROFILES_COLLECTION, myProfile.id, "private", "contact"), (s) =>
      setMyContact(s.exists() ? s.data() : null)
    );
    return () => {
      unsubIdentity();
      unsubContact();
    };
  }, [myProfile?.id, isAdminUser]);

  useEffect(() => {
    if (authUser && !isAdminUser && myIdentity && myContact) {
      setInterestForm({ requesterName: myIdentity.name || "", requesterPhone: myContact.phone || "", message: "" });
    } else {
      setInterestForm(EMPTY_INTEREST);
    }
    setInterestDone(false);
  }, [selectedProfileId]);

  useEffect(() => {
    setViewedIdentity(null);
    setViewedContact(null);
    if (!selectedProfileId || !db) return;
    const targetProfile = approvedProfiles.find((p) => p.id === selectedProfileId);
    const isOwn = authUser && targetProfile && targetProfile.ownerUid === authUser.uid;
    const canPhoto = isOwn || isAdminUser || (myMember?.unlockedPhotoIds || []).includes(selectedProfileId);
    const canContact = isOwn || isAdminUser || (myMember?.unlockedPhoneIds || []).includes(selectedProfileId);
    if (canPhoto) {
      getDoc(doc(db, PROFILES_COLLECTION, selectedProfileId, "private", "identity"))
        .then((s) => setViewedIdentity(s.exists() ? s.data() : null))
        .catch(() => {});
    }
    if (canContact) {
      getDoc(doc(db, PROFILES_COLLECTION, selectedProfileId, "private", "contact"))
        .then((s) => setViewedContact(s.exists() ? s.data() : null))
        .catch(() => {});
    }
  }, [selectedProfileId, myMember, isAdminUser]);

  const flash = (msg) => {
    setSavedFlash(msg);
    setTimeout(() => setSavedFlash(""), 1800);
  };

  const goHome = () => {
    setError("");
    setScreen("home");
  };

  // ---------- shared: photo upload ----------
  const handleAddPhoto = async (file, value, onChange) => {
    if (!file || (value.photoUrls?.length || 0) >= MAX_PHOTOS) return;
    setError("");
    setPhotoUploading(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      onChange({ ...value, photoUrls: [...(value.photoUrls || []), dataUrl] });
    } catch (e) {
      setError("புகைப்படத்தை சேர்க்க முடியவில்லை. வேறு படத்தை முயற்சிக்கவும்.");
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleRemovePhoto = (index, value, onChange) => {
    onChange({ ...value, photoUrls: value.photoUrls.filter((_, i) => i !== index) });
  };

  // ---------- public: register ----------
  const handleRegisterSubmit = async () => {
    const f = registerForm;
    if (!f.name.trim() || !f.gender || !f.dob || !f.phone.trim()) {
      return setError("பெயர், பாலினம், பிறந்த தேதி, தொடர்பு எண் ஆகியவற்றை நிரப்பவும்.");
    }
    if (!f.photoUrls || f.photoUrls.length === 0) {
      return setError("குறைந்தது ஒரு புகைப்படமாவது பதிவேற்ற வேண்டும்.");
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
      const { publicFields, identity, contact } = splitProfileFields({
        ...f,
        name: f.name.trim(),
        phone: f.phone.trim(),
      });
      const profileRef = await addDoc(collection(db, PROFILES_COLLECTION), {
        ...publicFields,
        status: "pending",
        ownerUid: cred.user.uid,
        memberId,
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, PROFILES_COLLECTION, profileRef.id, "private", "identity"), identity);
      await setDoc(doc(db, PROFILES_COLLECTION, profileRef.id, "private", "contact"), contact);
      await setDoc(doc(db, MEMBERS_COLLECTION, cred.user.uid), {
        profileId: profileRef.id,
        memberId,
        package: null,
        packageExpiresAt: null,
        photoQuota: 0,
        photoQuotaUsed: 0,
        phoneQuota: 0,
        phoneQuotaUsed: 0,
        unlockedPhotoIds: [],
        unlockedPhoneIds: [],
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
    setMyEditDraft({ ...EMPTY_PROFILE, ...myProfile, ...(myIdentity || {}), ...(myContact || {}) });
    setEditingMyProfile(true);
  };

  const saveMyProfile = async () => {
    if (!myEditDraft.name.trim() || !myEditDraft.gender || !myEditDraft.phone.trim()) {
      return setError("பெயர், பாலினம், தொடர்பு எண் ஆகியவற்றை நிரப்பவும்.");
    }
    try {
      const { id, status, createdAt, ownerUid, memberId, ...rest } = myEditDraft;
      const { publicFields, identity, contact } = splitProfileFields(rest);
      await updateDoc(doc(db, PROFILES_COLLECTION, myProfile.id), publicFields);
      await setDoc(doc(db, PROFILES_COLLECTION, myProfile.id, "private", "identity"), identity, { merge: true });
      await setDoc(doc(db, PROFILES_COLLECTION, myProfile.id, "private", "contact"), contact, { merge: true });
      setEditingMyProfile(false);
      flash("மாற்றங்கள் சேமிக்கப்பட்டன");
    } catch (e) {
      setError("சேமிக்க முடியவில்லை.");
    }
  };

  // ---------- member: unlock photo/phone credits ----------
  const unlockPhoto = async (targetProfileId) => {
    if (!myMember || !authUser) return;
    if ((myMember.unlockedPhotoIds || []).includes(targetProfileId)) return;
    const remaining = (myMember.photoQuota || 0) - (myMember.photoQuotaUsed || 0);
    if (remaining <= 0) return setError("Photo credits தீர்ந்துவிட்டது. Package renew செய்ய நிர்வாகியை தொடர்பு கொள்ளவும்.");
    setError("");
    try {
      await updateDoc(doc(db, MEMBERS_COLLECTION, authUser.uid), {
        unlockedPhotoIds: arrayUnion(targetProfileId),
        photoQuotaUsed: increment(1),
      });
    } catch (e) {
      setError("Unlock செய்ய முடியவில்லை.");
    }
  };

  const unlockPhone = async (targetProfileId) => {
    if (!myMember || !authUser) return;
    if ((myMember.unlockedPhoneIds || []).includes(targetProfileId)) return;
    const remaining = (myMember.phoneQuota || 0) - (myMember.phoneQuotaUsed || 0);
    if (remaining <= 0) return setError("Phone credits தீர்ந்துவிட்டது. Package renew செய்ய நிர்வாகியை தொடர்பு கொள்ளவும்.");
    setError("");
    try {
      await updateDoc(doc(db, MEMBERS_COLLECTION, authUser.uid), {
        unlockedPhoneIds: arrayUnion(targetProfileId),
        phoneQuotaUsed: increment(1),
      });
    } catch (e) {
      setError("Unlock செய்ய முடியவில்லை.");
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
    const priv = allPrivate[p.id] || {};
    setEditDraft({ ...EMPTY_PROFILE, ...p, ...(priv.identity || {}), ...(priv.contact || {}) });
    setEditDraftMember(null);
    if (p.ownerUid) {
      getDoc(doc(db, MEMBERS_COLLECTION, p.ownerUid))
        .then((s) => setEditDraftMember(s.exists() ? { id: s.id, ...s.data() } : null))
        .catch(() => setEditDraftMember(null));
    }
  };
  const saveEditProfile = async () => {
    if (!editDraft.name.trim() || !editDraft.gender || !editDraft.phone.trim()) {
      return setError("பெயர், பாலினம், தொடர்பு எண் ஆகியவற்றை நிரப்பவும்.");
    }
    try {
      const { id, status, createdAt, ownerUid, memberId, ...rest } = editDraft;
      const { publicFields, identity, contact } = splitProfileFields(rest);
      await updateDoc(doc(db, PROFILES_COLLECTION, editingProfileId), publicFields);
      await setDoc(doc(db, PROFILES_COLLECTION, editingProfileId, "private", "identity"), identity, { merge: true });
      await setDoc(doc(db, PROFILES_COLLECTION, editingProfileId, "private", "contact"), contact, { merge: true });
      setEditingProfileId(null);
      flash("மாற்றங்கள் சேமிக்கப்பட்டன");
    } catch (e) {
      setError("சேமிக்க முடியவில்லை.");
    }
  };

  // ---------- admin: package assignment ----------
  const assignPackage = async (ownerUid, packageKey) => {
    const pkg = packages[packageKey];
    if (!pkg || !ownerUid) return;
    try {
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + pkg.months);
      const data = {
        package: packageKey,
        packageExpiresAt: expiresAt,
        photoQuota: pkg.photoQuota,
        photoQuotaUsed: 0,
        phoneQuota: pkg.phoneQuota,
        phoneQuotaUsed: 0,
      };
      await setDoc(doc(db, MEMBERS_COLLECTION, ownerUid), data, { merge: true });
      setEditDraftMember((prev) => ({ ...(prev || {}), ...data }));
      flash(`${pkg.label} package assign செய்யப்பட்டது`);
    } catch (e) {
      setError("Package assign செய்ய முடியவில்லை.");
    }
  };

  // Lets the admin redefine a package's price/duration/quotas at any time
  // (e.g. raise Super Pro's phone-unlock quota from 15 to 20 later) without
  // a code change. Only affects members assigned the package after the
  // change — existing members keep the quota they were already given.
  const savePackageConfig = async (key) => {
    const draft = packageDrafts[key];
    if (!draft) return;
    try {
      const data = {
        label: draft.label.trim() || DEFAULT_PACKAGES[key]?.label || key,
        price: Number(draft.price) || 0,
        months: Number(draft.months) || 1,
        photoQuota: Number(draft.photoQuota) || 0,
        phoneQuota: Number(draft.phoneQuota) || 0,
      };
      await setDoc(doc(db, "settings", PACKAGES_DOC), { [key]: data }, { merge: true });
      flash(`${data.label} package settings சேமிக்கப்பட்டன`);
    } catch (e) {
      setError("Package settings சேமிக்க முடியவில்லை.");
    }
  };

  const clearPackage = async (ownerUid) => {
    if (!ownerUid) return;
    try {
      const data = { package: null, packageExpiresAt: null, photoQuota: 0, photoQuotaUsed: 0, phoneQuota: 0, phoneQuotaUsed: 0 };
      await setDoc(doc(db, MEMBERS_COLLECTION, ownerUid), data, { merge: true });
      setEditDraftMember((prev) => ({ ...(prev || {}), ...data }));
      flash("Package நீக்கப்பட்டது");
    } catch (e) {
      setError("செயல்படுத்த முடியவில்லை.");
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
        {
          siteName: nameDraft.trim() || DEFAULT_SETTINGS.siteName,
          tagline: taglineDraft.trim(),
          adminWhatsapp: whatsappDraft.trim(),
        },
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
  // Traces a leaked screenshot back to whoever was viewing the photo when it
  // was taken, since a web page can't actually prevent a screenshot.
  const photoWatermark = isAdminUser ? "ADMIN" : myProfile ? `ID ${myProfile.memberId}` : "GUEST";

  const goTo = (screen, logout) => {
    setError("");
    setPassInput("");
    setResetSent(false);
    if (logout) handleLogout();
    setScreen(screen);
  };

  if (!firebaseConfigured) {
    return (
      <div style={styles.page}>
        <Header siteName={settings.siteName} onAdminClick={goAdmin} />
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
        <Header siteName={settings.siteName} onAdminClick={goAdmin} />
        <div style={styles.section}><div style={styles.eyebrow}>ஏற்றுகிறது…</div></div>
      </div>
    );
  }

  // ---------- HOME ----------
  if (screen === "home") {
    return (
      <div style={styles.page}>
        <Header siteName={settings.siteName} onAdminClick={goAdmin} />
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
        {settings.adminWhatsapp && (
          <div style={{ padding: "0 18px" }}>
            <a
              href={waLink(settings.adminWhatsapp, `வணக்கம், ${settings.siteName} பற்றி விசாரிக்க விரும்புகிறேன்.`)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...styles.btnGhost, boxSizing: "border-box", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              💬 WhatsApp-ல் தொடர்பு கொள்ள
            </a>
          </div>
        )}
      </div>
    );
  }

  // ---------- REGISTER ----------
  if (screen === "register") {
    if (registerDone) {
      return (
        <div style={styles.page}>
          <Header siteName={settings.siteName} onAdminClick={goAdmin} />
          <Back to="home" label="முகப்புக்கு" onGo={goTo} />
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
        <Header siteName={settings.siteName} onAdminClick={goAdmin} />
        <Back to="home" label="பின்செல்" onGo={goTo} />
        <div style={styles.section}>
          <div style={styles.eyebrow}>சுயவிவரம் பதிவு</div>
          <h1 style={styles.h1}>உங்கள் விவரங்களை உள்ளிடவும்</h1>
        </div>
        {error && <div style={styles.errBox}>{error}</div>}
        <div style={styles.card}>
          <ProfileFormFields value={registerForm} onChange={setRegisterForm} onAddPhoto={handleAddPhoto} onRemovePhoto={handleRemovePhoto} photoUploading={photoUploading} />
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
    if (!authUser) {
      setScreen("memberLogin");
      return null;
    }
    return (
      <div style={styles.page}>
        <Header siteName={settings.siteName} onAdminClick={goAdmin} />
        <Back to="memberDashboard" label="பின்செல்" onGo={goTo} />
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
          const unlocked = (myMember?.unlockedPhotoIds || []).includes(p.id) || p.ownerUid === authUser?.uid;
          return (
            <button key={p.id} style={styles.profileCard} onClick={() => { setSelectedProfileId(p.id); setScreen("profile"); }}>
              <div style={styles.avatar}>{unlocked ? (p.gender === "பெண்" ? "👰" : "🤵") : "🔒"}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 16, color: "#F6F8FC" }}>Profile #{p.memberId ?? "-"}</div>
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
  if (screen === "profile" && !authUser) {
    setScreen("memberLogin");
    return null;
  }
  if (screen === "profile" && selectedProfile) {
    const p = selectedProfile;
    const age = calcAge(p.dob);
    const isOwnProfile = authUser && p.ownerUid === authUser.uid;
    const photoRemaining = myMember ? (myMember.photoQuota || 0) - (myMember.photoQuotaUsed || 0) : 0;
    const phoneRemaining = myMember ? (myMember.phoneQuota || 0) - (myMember.phoneQuotaUsed || 0) : 0;
    const photos = allPhotosOf(viewedIdentity);
    return (
      <div style={styles.page}>
        <Header siteName={settings.siteName} onAdminClick={goAdmin} />
        <Back to="browse" label="பின்செல்" onGo={goTo} />
        <div style={styles.section}>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ ...styles.avatar, width: 84, height: 84, fontSize: 34 }}>
              {photos[0] ? <ProtectedPhoto src={photos[0]} alt={viewedIdentity?.name || "profile"} watermark={photoWatermark} /> : "🔒"}
            </div>
            <div>
              <h1 style={{ ...styles.h1, marginBottom: 2 }}>{viewedIdentity?.name || `Profile #${p.memberId ?? "-"}`}</h1>
              <p style={styles.sub}>{age !== null ? `${age} வயது` : ""}{p.height ? ` • ${p.height}` : ""}</p>
            </div>
          </div>
          {photos.length > 1 && (
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              {photos.slice(1).map((url, i) => (
                <div key={i} style={{ width: 70, height: 70, borderRadius: 12, overflow: "hidden", border: "1px solid #263354" }}>
                  <ProtectedPhoto src={url} alt={`${viewedIdentity?.name || "profile"} ${i + 2}`} watermark={photoWatermark} />
                </div>
              ))}
            </div>
          )}
        </div>
        {error && <div style={styles.errBox}>{error}</div>}

        <div style={styles.card}>
          <div style={styles.eyebrow}>புகைப்படம் & பெயர்</div>
          {viewedIdentity ? (
            <p style={{ color: "#8ADB9A", fontSize: 13.5, margin: 0 }}>✓ Unlock செய்யப்பட்டது</p>
          ) : (
            <>
              <p style={{ color: "#9FB0CE", fontSize: 13.5, lineHeight: 1.6 }}>
                பெயர் மற்றும் புகைப்படத்தை பார்க்க 1 Photo Credit தேவை. {myMember && <>மீதம் உள்ளது: <strong style={{ color: "#F6F8FC" }}>{photoRemaining}</strong></>}
              </p>
              <button style={styles.btnPrimary} onClick={() => unlockPhoto(p.id)} disabled={!myMember || photoRemaining <= 0}>
                🔓 புகைப்படம் + பெயர் பார்க்க
              </button>
            </>
          )}
        </div>
        <div style={styles.card}>
          <div style={styles.infoGrid}>
            <div><div style={styles.infoLabel}>பிறந்த நேரம்</div><div style={styles.infoValue}>{p.birthTime || "-"}</div></div>
            <div><div style={styles.infoLabel}>ராசி</div><div style={styles.infoValue}>{p.rasi || "-"}</div></div>
            <div><div style={styles.infoLabel}>நட்சத்திரம்</div><div style={styles.infoValue}>{p.natchathiram || "-"}</div></div>
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
          <div style={styles.eyebrow}>தொடர்பு எண்</div>
          {viewedContact ? (
            <div style={styles.infoValue}>
              {viewedContact.phone}{viewedContact.email ? ` • ${viewedContact.email}` : ""}
            </div>
          ) : (
            <>
              <p style={{ color: "#9FB0CE", fontSize: 13.5, lineHeight: 1.6 }}>
                தொடர்பு எண்ணை பார்க்க 1 Phone Credit தேவை. {myMember && <>மீதம் உள்ளது: <strong style={{ color: "#F6F8FC" }}>{phoneRemaining}</strong></>}
              </p>
              <button style={styles.btnPrimary} onClick={() => unlockPhone(p.id)} disabled={!myMember || phoneRemaining <= 0}>
                🔓 தொடர்பு எண் பார்க்க
              </button>
            </>
          )}
        </div>

        <div style={styles.card}>
          <div style={styles.eyebrow}>விருப்பம் தெரிவிக்க (இலவசம்)</div>
          <p style={{ color: "#9FB0CE", fontSize: 13.5, lineHeight: 1.6, marginTop: 0 }}>
            Credits இல்லாமலேயே ஒரு விருப்ப செய்தி அனுப்பலாம் — நிர்வாகி இரு தரப்பையும் இணைப்பார்.
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
        <Header siteName={settings.siteName} onAdminClick={goAdmin} />
        <Back to="home" label="பின்செல்" onGo={goTo} />
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
        <Header siteName={settings.siteName} onAdminClick={goAdmin} />
        <Back to="home" label="பின்செல்" onGo={goTo} />
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
          <Header siteName={settings.siteName} onAdminClick={goAdmin} />
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
        <Header siteName={settings.siteName} onAdminClick={goAdmin} />
        <Back to="home" label="வெளியேறு" logout onGo={goTo} />
        <div style={styles.section}>
          <div style={styles.eyebrow}>எனது Dashboard</div>
          <h1 style={styles.h1}>{myIdentity?.name || "உங்கள் கணக்கு"}</h1>
        </div>
        {error && <div style={styles.errBox}>{error}</div>}
        {savedFlash && <div style={styles.flash}>{savedFlash}</div>}

        <div style={styles.section}>
          <button style={styles.roleCard} onClick={() => { setError(""); setScreen("browse"); }}>
            <span style={{ fontSize: 26 }}>💞</span><span>சுயவிவரங்களை பார்வையிட</span>
          </button>
        </div>

        <div style={styles.card}>
          <div style={styles.infoLabel}>தற்போதைய Package</div>
          <div style={styles.infoValue}>{myMember?.package ? (packages[myMember.package]?.label || myMember.package) : "இல்லை (Free)"}</div>
          {myMember?.package && (
            <>
              <div style={styles.infoLabel}>காலாவதி</div>
              <div style={styles.infoValue}>{fmtDate(myMember.packageExpiresAt)}</div>
              <div style={styles.infoGrid}>
                <div><div style={styles.infoLabel}>Photo Credits மீதம்</div><div style={styles.infoValue}>{(myMember.photoQuota || 0) - (myMember.photoQuotaUsed || 0)} / {myMember.photoQuota}</div></div>
                <div><div style={styles.infoLabel}>Phone Credits மீதம்</div><div style={styles.infoValue}>{(myMember.phoneQuota || 0) - (myMember.phoneQuotaUsed || 0)} / {myMember.phoneQuota}</div></div>
              </div>
            </>
          )}
          {!myMember?.package && (
            <p style={{ color: "#9FB0CE", fontSize: 12.5, margin: 0 }}>கீழே உள்ள Package-களில் ஒன்றை தேர்ந்தெடுத்து, WhatsApp மூலம் நிர்வாகியை தொடர்பு கொள்ளவும்.</p>
          )}
        </div>

        <div style={styles.card}>
          <div style={styles.eyebrow}>Package விபரங்கள்</div>
          {Object.values(packages).map((pkg) => (
            <div key={pkg.key} style={{ padding: "10px 0", borderBottom: "1px solid #1E2A44" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontWeight: 700, color: "#F6F8FC" }}>{pkg.label}</div>
                <div style={{ color: "#F2A93B", fontFamily: "'IBM Plex Mono',monospace" }}>₹{pkg.price} / {pkg.months} மாதம்</div>
              </div>
              <div style={{ color: "#9FB0CE", fontSize: 12.5, marginTop: 3 }}>
                {pkg.photoQuota} Photo Unlocks • {pkg.phoneQuota} Phone Unlocks
              </div>
            </div>
          ))}
          {settings.adminWhatsapp && (
            <a
              href={waLink(settings.adminWhatsapp, `வணக்கம், எனது Profile ID ${myProfile?.memberId ?? ""} - எனக்கு ஒரு Package வாங்க விரும்புகிறேன்.`)}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...styles.btnGhost, boxSizing: "border-box", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14 }}
            >
              💬 WhatsApp-ல் நிர்வாகியை தொடர்பு கொள்ள
            </a>
          )}
        </div>

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
            <ProfileFormFields value={myEditDraft} onChange={setMyEditDraft} onAddPhoto={handleAddPhoto} onRemovePhoto={handleRemovePhoto} photoUploading={photoUploading} />
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
                <div style={{ fontWeight: 700, fontSize: 14 }}>{target ? `Profile #${target.memberId ?? "-"}` : "சுயவிவரம்"}</div>
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
          <Header siteName={settings.siteName} onAdminClick={goAdmin} />
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
      const priv = allPrivate[p.id] || {};
      const displayName = priv.identity?.name || `Profile #${p.memberId ?? "-"}`;
      const displayPhone = priv.contact?.phone || "";
      return (
        <div key={p.id} style={{ background: "#0B1220", border: "1px solid #1E2A44", borderRadius: 12, padding: "14px", marginBottom: 10 }}>
          <div style={styles.row}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{displayName} <span style={styles.badge}>{p.gender}</span>{p.memberId && <span style={styles.badge}> #{p.memberId}</span>}</div>
              <div style={{ color: "#7C8CAE", fontSize: 12.5, marginTop: 3 }}>
                {age !== null ? `${age} வயது` : ""}{p.district ? ` • ${p.district}` : ""}{displayPhone ? ` • ${displayPhone}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>{actions}</div>
          </div>
          {isEditing && (
            <div style={{ paddingTop: 12 }}>
              <ProfileFormFields value={editDraft} onChange={setEditDraft} onAddPhoto={handleAddPhoto} onRemovePhoto={handleRemovePhoto} photoUploading={photoUploading} />
              <div style={{ display: "flex", gap: 10 }}>
                <button style={styles.btnPrimary} onClick={saveEditProfile} disabled={photoUploading}>சேமிக்க</button>
                <button style={styles.btnGhost} onClick={() => setEditingProfileId(null)}>ரத்து</button>
              </div>

              <div style={{ borderTop: "1px solid #1E2A44", paddingTop: 14 }}>
                <div style={styles.infoLabel}>Package நிலை</div>
                <div style={styles.infoValue}>
                  {editDraftMember?.package
                    ? `${packages[editDraftMember.package]?.label || editDraftMember.package} (${fmtDate(editDraftMember.packageExpiresAt)} வரை)`
                    : "இல்லை"}
                </div>
                {editDraftMember?.package && (
                  <div style={{ color: "#9FB0CE", fontSize: 12.5, marginBottom: 10 }}>
                    Photo: {(editDraftMember.photoQuota || 0) - (editDraftMember.photoQuotaUsed || 0)}/{editDraftMember.photoQuota} • Phone: {(editDraftMember.phoneQuota || 0) - (editDraftMember.phoneQuotaUsed || 0)}/{editDraftMember.phoneQuota}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {Object.values(packages).map((pkg) => (
                    <button key={pkg.key} style={{ ...styles.btnGhost, width: "auto", padding: "8px 14px" }} onClick={() => assignPackage(p.ownerUid, pkg.key)}>
                      {pkg.label} கொடு
                    </button>
                  ))}
                  {editDraftMember?.package && (
                    <button style={styles.dangerBtn} onClick={() => clearPackage(p.ownerUid)}>நீக்கு</button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    };

    return (
      <div style={styles.page}>
        <Header siteName={settings.siteName} onAdminClick={goAdmin} />
        <Back to="home" label="வெளியேறு" logout onGo={goTo} />
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
              const targetPhone = target ? allPrivate[target.id]?.contact?.phone : null;
              return (
                <div key={it.id} style={{ background: "#0B1220", border: "1px solid #1E2A44", borderRadius: 12, padding: "14px", marginBottom: 10 }}>
                  <div style={styles.row}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14.5 }}>{it.requesterName} <span style={{ color: "#7C8CAE", fontWeight: 400, fontSize: 12.5 }}>→ {target ? `Profile #${target.memberId ?? "-"}` : "(நீக்கப்பட்ட சுயவிவரம்)"}</span></div>
                      <div style={{ color: "#7C8CAE", fontSize: 12.5, marginTop: 3 }}>
                        {it.requesterPhone}{targetPhone ? ` • சுயவிவர எண்: ${targetPhone}` : ""} • {fmtDate(it.createdAt)}
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
          <>
            <div style={styles.card}>
              <label style={styles.label}>தளத்தின் பெயர்</label>
              <input style={styles.input} value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
              <label style={styles.label}>Tagline</label>
              <input style={styles.input} value={taglineDraft} onChange={(e) => setTaglineDraft(e.target.value)} />
              <label style={styles.label}>நிர்வாகி WhatsApp எண் (Package கேட்பவர்கள் இதற்கு மெசேஜ் அனுப்புவார்கள்)</label>
              <input style={styles.input} value={whatsappDraft} onChange={(e) => setWhatsappDraft(e.target.value)} placeholder="07XXXXXXXX" />
              <button style={styles.btnGhost} onClick={saveSiteSettings}>அமைப்புகளை சேமிக்க</button>
            </div>

            <div style={styles.section}>
              <div style={styles.sectionTitle}>Package அமைப்புகள்</div>
              <p style={{ color: "#9FB0CE", fontSize: 12.5, margin: "-8px 0 4px" }}>
                ஒவ்வொரு package-ன் விலை, காலம், Photo/Phone unlock எண்ணிக்கையை இங்கே எப்போது வேண்டுமானாலும் மாற்றலாம். ஏற்கனவே package வாங்கிய உறுப்பினர்களை இது பாதிக்காது — புதிதாக assign செய்யும்போது மட்டும் இந்த புது எண்ணிக்கை பயன்படும்.
              </p>
            </div>
            {Object.keys(DEFAULT_PACKAGES).map((key) => {
              const draft = packageDrafts[key] || packages[key];
              if (!draft) return null;
              return (
                <div key={key} style={styles.card}>
                  <label style={styles.label}>Package பெயர்</label>
                  <input
                    style={styles.input}
                    value={draft.label}
                    onChange={(e) => setPackageDrafts({ ...packageDrafts, [key]: { ...draft, label: e.target.value } })}
                  />
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label style={styles.label}>விலை (₹)</label>
                      <input
                        style={{ ...styles.input, marginBottom: 0 }}
                        type="number"
                        value={draft.price}
                        onChange={(e) => setPackageDrafts({ ...packageDrafts, [key]: { ...draft, price: e.target.value } })}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={styles.label}>காலம் (மாதம்)</label>
                      <input
                        style={{ ...styles.input, marginBottom: 0 }}
                        type="number"
                        value={draft.months}
                        onChange={(e) => setPackageDrafts({ ...packageDrafts, [key]: { ...draft, months: e.target.value } })}
                      />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, margin: "12px 0" }}>
                    <div style={{ flex: 1 }}>
                      <label style={styles.label}>Photo Unlocks</label>
                      <input
                        style={{ ...styles.input, marginBottom: 0 }}
                        type="number"
                        value={draft.photoQuota}
                        onChange={(e) => setPackageDrafts({ ...packageDrafts, [key]: { ...draft, photoQuota: e.target.value } })}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={styles.label}>Phone Unlocks</label>
                      <input
                        style={{ ...styles.input, marginBottom: 0 }}
                        type="number"
                        value={draft.phoneQuota}
                        onChange={(e) => setPackageDrafts({ ...packageDrafts, [key]: { ...draft, phoneQuota: e.target.value } })}
                      />
                    </div>
                  </div>
                  <button style={styles.btnGhost} onClick={() => savePackageConfig(key)}>{draft.label} - சேமிக்க</button>
                </div>
              );
            })}
          </>
        )}
      </div>
    );
  }

  setScreen("home");
  return null;
}

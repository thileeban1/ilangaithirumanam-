# கல்வி கற்றல் மேலாண்மை (Education LMS)

இந்த app இந்த repo-வில் உள்ள திருமண மையம் (matrimony) website-லிருந்து **முற்றிலும் தனியானது**:
தனி Firebase project, தனி `package.json`, தனி deploy workflow. இதை எவ்வளவு மாற்றினாலும்
matrimony website-க்கு எந்த பாதிப்பும் வராது.

- **நிர்வாகி (Admin)** — மாணவர்கள் மற்றும் ஆசிரியர்களை நிர்வகிக்கிறார், பாடங்களை (courses)
  உருவாக்கி ஒவ்வொரு பாடத்திற்கும் ஒரு ஆசிரியரை ஒதுக்குகிறார்.
- **ஆசிரியர் (Teacher)** — தமக்கு ஒதுக்கப்பட்ட பாடத்திற்கு பாடப் பகுதிகள் / பொருள்
  (content, notes, video/PDF இணைப்பு) சேர்க்கிறார், மற்றும் அந்த பாடத்தில் சேர்ந்த
  மாணவர்களை பார்க்கிறார்.
- **மாணவர் (Student)** — கிடைக்கும் பாடங்களை பார்த்து தேர்ந்தெடுத்து சேரலாம் (enroll),
  தான் சேர்ந்த பாடங்களின் பொருளை மட்டும் பார்க்க முடியும்.

## 1. தனி Firebase Project உருவாக்குதல் (அவசியம்!)

matrimony website பயன்படுத்தும் Firebase project-ஐ **இதற்கு பயன்படுத்த வேண்டாம்** —
இரண்டு app-களும் தனித்தனி project-களில் இருந்தால் மட்டுமே ஒன்றின் மாற்றம் மற்றொன்றை
பாதிக்காது என உறுதி செய்யலாம்.

1. https://console.firebase.google.com -> **Add project** -> புதிய பெயர் (எ.கா. `my-school-lms`).
2. **Build -> Firestore Database -> Create database** -> production mode.
3. **Firestore Database -> Rules** tab-ல் இந்த கோப்பில் (`lms/firestore.rules`) உள்ள
   உள்ளடக்கத்தை copy-paste செய்து **Publish** செய்யவும்.
4. **Build -> Authentication -> Get started -> Sign-in method -> Email/Password -> Enable**.
5. **Project settings -> General -> Your apps -> `</>` (Web)** -> app register பண்ணி
   கிடைக்கும் `firebaseConfig` மதிப்புகளை குறித்து வைக்கவும்.

### நிர்வாகி (Admin) கணக்கு உருவாக்குதல்

1. **Authentication -> Users -> Add user** -> உங்கள் admin மின்னஞ்சல்/கடவுச்சொல்.
2. **Firestore -> Data -> Start collection** -> Collection ID: `admins`.
3. Document ID-ஆக அந்த user-ன் **User UID**-ஐ paste பண்ணவும் (Authentication tab-ல் கிடைக்கும்).
4. ஏதேனும் ஒரு field சேர்க்கவும் (எ.கா. `role`: `admin`) -> **Save**.

இதைச் செய்யாத வரை நீங்கள் login செய்யலாம், ஆனால் "நிர்வாகி பலகை" திறக்காது.

## 2. Local Setup

```bash
cd lms
npm install
cp .env.example .env
```

`.env`-ல் Firebase Console-ல் இருந்து கிடைத்த 6 மதிப்புகளையும் நிரப்பவும். பிறகு:

```bash
npm run dev
```

http://localhost:5173 திறந்து பார்க்கவும்.

## 3. எப்படி பயன்படுத்துவது

1. Admin-ஆக login செய்யவும் (மேலே உருவாக்கியது).
2. ஒரு ஆசிரியர் website-ல் "புதிய கணக்கு -> ஆசிரியர்" மூலம் signup செய்ய வேண்டும்.
3. Admin -> "ஆசிரியர்கள்" tab-ல் அந்த ஆசிரியரை **ஏற்றுக்கொள்** செய்யவும்.
4. Admin -> "பாடங்கள்" tab-ல் புதிய பாடம் உருவாக்கி அந்த ஆசிரியரை ஒதுக்கவும்.
5. ஆசிரியர் மீண்டும் login செய்தால் தன் பாடத்தில் பாடப் பகுதிகள் சேர்க்கலாம்.
6. மாணவர்கள் "புதிய கணக்கு -> மாணவர்" மூலம் signup செய்து உடனே "பாடங்களை காணுங்கள்"
   tab-ல் பாடங்களில் சேரலாம் (enroll), மற்றும் தாங்கள் சேர்ந்த பாடங்களின் பொருளை பார்க்கலாம்.

## 4. Deploy செய்தல் (GitHub Actions -> Firebase Hosting)

`.github/workflows/deploy-lms.yml` ஏற்கனவே repo-வில் சேர்க்கப்பட்டுள்ளது. இது
`lms/` கோப்புறையில் மாற்றம் ஏற்படும்போது மட்டுமே இயங்கும் — matrimony website-ன்
workflow-களை தொடாது.

1. **Settings -> Secrets and variables -> Actions** -ல் புதிய secrets சேர்க்கவும்:
   - `LMS_FIREBASE_API_KEY`
   - `LMS_FIREBASE_AUTH_DOMAIN`
   - `LMS_FIREBASE_PROJECT_ID`
   - `LMS_FIREBASE_STORAGE_BUCKET`
   - `LMS_FIREBASE_MESSAGING_SENDER_ID`
   - `LMS_FIREBASE_APP_ID`
   - `FIREBASE_LMS_SERVICE_ACCOUNT` — Firebase Console -> Project settings ->
     Service accounts -> Generate new private key -> அந்த JSON கோப்பின்
     உள்ளடக்கத்தை முழுமையாக paste பண்ணவும்.
2. `lms/.firebaserc`-ல் `REPLACE_WITH_YOUR_LMS_FIREBASE_PROJECT_ID`-ஐ உங்கள் Firebase
   project ID-ஆக மாற்றவும்.
3. `main` branch-க்கு (`lms/` உள்ளிட்ட) push ஆனதும் தானாக build + deploy ஆகும்.

Vercel / Netlify விரும்பினால் அவையும் வேலை செய்யும் — build command `npm run build`
(working directory `lms`), output directory `lms/dist`, மேலே உள்ள 6 env vars சேர்த்தால் போதும்.

## குறிப்புகள் / வரம்புகள் (MVP)

- Admin, "மாணவர்கள்"/"ஆசிரியர்கள்" tab-ல் ஒருவரை "நீக்கு" செய்தால், அவர்களின் app தரவு
  (profile) நீக்கப்படும், ஆனால் Firebase Authentication-ல் உள்ள login கணக்கு தானாக
  நீக்கப்படாது (அதற்கு Firebase Console -> Authentication -> Users-ல் இருந்து தனியாக
  நீக்க வேண்டும்).
- ஒரு பாடத்திற்கு (course) ஒரு ஆசிரியர் மட்டுமே — பல ஆசிரியர்கள் தேவைப்பட்டால் தனித்தனி
  பாடங்களாக உருவாக்கவும்.

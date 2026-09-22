# கதிரவன் (Kadhiravan LMS)

இந்த app இந்த repo-வில் உள்ள திருமண மையம் (matrimony) website-லிருந்து **முற்றிலும் தனியானது**:
தனி Firebase project, தனி `package.json`, தனி deploy workflow. இதை எவ்வளவு மாற்றினாலும்
matrimony website-க்கு எந்த பாதிப்பும் வராது.

- **நிர்வாகி (Admin)** — பாடங்களை (courses) உருவாக்குகிறார், ஆசிரியர்கள்/மாணவர்களுக்கு
  **Access Code** உருவாக்கி பாடங்களை ஒதுக்குகிறார், அறிவிப்புகள்/நேர அட்டவணை வெளியிடுகிறார்.
- **ஆசிரியர் (Teacher)** — தன் Access Code மூலம் நுழைந்து, தனக்கு ஒதுக்கப்பட்ட பாடத்திற்கு
  பாடப் பகுதிகள் (குறிப்புகள், PDF இணைப்பு, Recording video இணைப்பு) சேர்க்கிறார்.
- **மாணவர் (Student)** — தன் Access Code மூலம் நுழைந்து, தனக்கு ஒதுக்கப்பட்ட பாடங்களின்
  பொருளை பார்க்கிறார். Recording-ஐ ஒரு மாணவர் **3 முறை மட்டுமே** பார்க்க முடியும்
  (இந்த வரம்பு Firestore rules-லேயே enforce செய்யப்படுகிறது, UI-ல் மட்டும் இல்லை).

எவருமே email/password கொடுத்து "signup" செய்ய வேண்டியதில்லை — நிர்வாகி ஒரு Access Code
உருவாக்கி கொடுத்தால் போதும், அந்த Code ஒன்றே அவர்களின் நிரந்தர உள்நுழைவு.

## 1. தனி Firebase Project உருவாக்குதல் (அவசியம்!)

matrimony website பயன்படுத்தும் Firebase project-ஐ **இதற்கு பயன்படுத்த வேண்டாம்** —
இரண்டு app-களும் தனித்தனி project-களில் இருந்தால் மட்டுமே ஒன்றின் மாற்றம் மற்றொன்றை
பாதிக்காது என உறுதி செய்யலாம்.

1. https://console.firebase.google.com -> **Add project** -> புதிய பெயர் (எ.கா. `kadhiravan`).
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

இதைச் செய்யாத வரை நீங்கள் login செய்யலாம், ஆனால் "நிர்வாகி பலகை" திறக்காது. Admin
மட்டுமே email/password வைத்து login செய்கிறார் — ஆசிரியர்/மாணவர் இருவரும் Access Code
வைத்தே நுழைவார்கள் (கீழே பார்க்கவும்).

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

1. Admin-ஆக login செய்யவும் ("நிர்வாகி உள்நுழைவு" link).
2. "பாடங்கள்" tab-ல் ஒரு பாடம் (course) உருவாக்கவும்.
3. "ஆசிரியர்கள்" tab-ல் ஆசிரியரின் பெயரை உள்ளிட்டு, பாடத்தை தேர்ந்தெடுத்து **Code உருவாக்கு**
   அழுத்தவும் — ஒரு Access Code கிடைக்கும், அதை அந்த ஆசிரியருக்கு (WhatsApp/நேரடியாக) கொடுக்கவும்.
4. ஆசிரியர் website-ஐ திறந்து அந்த Code-ஐ மட்டும் உள்ளிட்டு "நுழை" அழுத்தினால், தன்
   பாடத்திற்கு பாடப் பகுதிகள் (குறிப்பு, PDF இணைப்பு, Recording இணைப்பு) சேர்க்கலாம்.
5. அதே போல "மாணவர்கள்" tab-ல் ஒவ்வொரு மாணவருக்கும் Code உருவாக்கி, அவர்கள் சேர வேண்டிய
   பாடங்களை தேர்ந்தெடுக்கவும். மாணவர் அந்த Code-ஐ உள்ளிட்டு நுழைந்தால் உடனே தன் பாடங்களை
   பார்க்க முடியும் — தனியாக பதிவு (register) செய்ய வேண்டியதில்லை.
6. Admin, ஒரு மாணவர்/ஆசிரியரின் பாட அணுகலை (course access) எப்போது வேண்டுமானாலும்
   "மாணவர்கள்"/"ஆசிரியர்கள்" tab-ல் checkbox மூலம் மாற்றலாம்.
7. "அறிவிப்புகள்" tab-ல் நேர அட்டவணை / அறிவிப்புகளை post செய்யலாம் — அது எல்லா
   ஆசிரியர்/மாணவர் dashboard-லும் மேலே தெரியும்.

### PDF மற்றும் Recording இணைப்புகள்

செலவில்லாமல் வைத்திருக்க, PDF-ஐயும் Recording video-ஐயும் **நேரடியாக upload செய்யும்
வசதி இல்லை** — பதிலாக ஒரு **link** (எ.கா. Google Drive-ல் upload செய்து "Anyone with
the link can view" ஆக்கி அந்த share link-ஐ) பேஸ்ட் செய்யும் வசதி உள்ளது. (நேரடி
file-upload வேண்டுமெனில் Firebase-ஐ "Blaze" (pay-as-you-go) plan-க்கு மாற்ற வேண்டும்
— கேளுங்கள், அதற்கான வழிகாட்டுதலும் செய்து தரலாம்.)

### WhatsApp தொடர்பு பட்டன்

Teacher/Student dashboard-ல் வலது கீழ் மூலையில் ஒரு பச்சை WhatsApp பட்டன் இருக்கும் —
அதை tap செய்தால் நேரடியாக நிர்வாகியின் WhatsApp (0752495266) திறக்கும். இந்த எண்ணை
மாற்ற வேண்டுமெனில் `lms/src/App.jsx`-ல் `WHATSAPP_NUMBER` மதிப்பை மாற்றவும்.

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
     உள்ளடக்கத்தை முழுமையாக paste பண்ணவும் (**straight quotes-ஆகவே இருக்கணும்** —
     phone keyboard-ல் paste பண்ணும்போது "smart quotes" ஆக மாறிவிடாமல் பார்த்துக்கொள்ளவும்,
     இல்லையேல் deploy JSON parse error-ஆல் தோல்வியடையும்).
2. `lms/.firebaserc`-ல் உங்கள் Firebase project ID சரியாக இருக்கிறதா உறுதி செய்யவும்.
3. `main` branch-க்கு (`lms/` உள்ளிட்ட) push ஆனதும் தானாக build + deploy ஆகும்.

Vercel / Netlify விரும்பினால் அவையும் வேலை செய்யும் — build command `npm run build`
(working directory `lms`), output directory `lms/dist`, மேலே உள்ள 6 env vars சேர்த்தால் போதும்.

## குறிப்புகள் / வரம்புகள் (MVP)

- Admin ஒரு Code-ஐ/கணக்கை "நீக்கு" செய்தால், அவர்களின் app தரவு நீக்கப்படும், ஆனால்
  Firebase Authentication-ல் உள்ள login கணக்கு தானாக நீக்கப்படாது (அதற்கு Firebase
  Console -> Authentication -> Users-ல் இருந்து தனியாக நீக்க வேண்டும்).
- ஒரு Access Code-ஐ இழந்துவிட்டால் (மறந்துவிட்டால்), அந்த நபருக்கு புதிய Code உருவாக்கி
  பழையதை "நீக்கு" செய்யவும் — password reset என ஏதும் கிடையாது (Code-ஏ password).

# வகுப்பு போர்ட்டல் (Class Portal)

ஆசிரியர் தரம் / பாடம் / Zoom Link / Recordings / PDF குறிப்புகளை நிர்வகிக்கவும், மாணவர்கள் ஒரு **Access Code** மூலம் (Google account எதுவும் தேவையில்லாமல்) தங்களுக்கு ஒதுக்கப்பட்ட பாடங்களை மட்டும் பார்க்கவும் முடியும் — ஒரு பொது website ஆக React + Firebase (Firestore) வைத்து கட்டப்பட்டது.

## 1. Firebase Project உருவாக்குதல்

1. https://console.firebase.google.com -> **Add project** -> பெயர் கொடுத்து உருவாக்கவும் (Google Analytics தேவையில்லை, off வைக்கலாம்).
2. இடது பக்க menu-ல் **Build -> Firestore Database** -> **Create database** -> production mode -> உங்களுக்கு அருகில் உள்ள region தேர்ந்தெடுக்கவும்.
3. **Build -> Firestore Database -> Rules** tab-க்கு சென்று, இந்த repo-வில் உள்ள `firestore.rules` கோப்பின் உள்ளடக்கத்தை copy பண்ணி paste பண்ணி **Publish** செய்யவும்.
4. **Project settings** (⚙️ icon) -> **General** tab -> கீழே "Your apps" -> `</>` (Web) icon கிளிக் செய்து ஒரு app register பண்ணவும் (Firebase Hosting இப்போது தேவையில்லை, skip பண்ணலாம்).
5. கிடைக்கும் `firebaseConfig` object-ல் இருந்து மதிப்புகளை குறித்து வைத்துக் கொள்ளவும் — அடுத்த step-ல் தேவை.

### Authentication (ஆசிரியர் உள்நுழைவு)

1. **Build -> Authentication** -> **Get started**.
2. **Sign-in method** tab -> **Email/Password** -> Enable -> Save.
3. **Users** tab -> **Add user** -> ஆசிரியருக்கான மின்னஞ்சல் மற்றும் கடவுச்சொல்லை உள்ளிடவும். இதே மின்னஞ்சல்/கடவுச்சொல் வைத்துதான் website-ல் "நான் ஆசிரியர்" screen-ல் login செய்ய முடியும்.
   - இன்னொரு ஆசிரியருக்கும் அணுகல் கொடுக்க வேண்டுமெனில், இதே இடத்தில் இன்னொரு user-ஐ சேர்க்கவும்.
   - Website-ல் யாரும் self-service-ஆக ஆசிரியர் account create பண்ண முடியாது — நீங்கள் (project owner) Console வழியாக யாருக்கு account கொடுக்கிறீர்களோ அவர்கள் மட்டுமே ஆசிரியராக நுழைய முடியும்.
4. கடவுச்சொல் மறந்துவிட்டால், website-லேயே "கடவுச்சொல் மறந்துவிட்டதா?" மூலம் reset link அனுப்பிக்கொள்ளலாம் (Authentication -> Templates-ல் "Password reset" மின்னஞ்சல் Firebase-ஆல் தானாக அனுப்பப்படும்).

## 2. Local Setup

```bash
npm install
cp .env.example .env
```

`.env` கோப்பை திறந்து Firebase Console-ல் இருந்து கிடைத்த மதிப்புகளை நிரப்பவும்:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

பின்பு இயக்கவும்:

```bash
npm run dev
```

http://localhost:5173 திறந்து பார்க்கவும். "நான் ஆசிரியர்" -> Firebase Console-ல் நீங்கள் உருவாக்கிய மின்னஞ்சல்/கடவுச்சொல் வைத்து நுழையவும்.

## 3. Public Website ஆக Deploy செய்தல் (GitHub Pages — தானியங்கி)

இந்த repo-வில் `.github/workflows/deploy.yml` ஏற்கனவே சேர்க்கப்பட்டுள்ளது — `main` branch-க்கு push ஆகும் ஒவ்வொரு முறையும் தானாக build செய்து GitHub Pages-க்கு deploy செய்துவிடும். நீங்கள் செய்ய வேண்டியது 3 one-time steps மட்டும்:

1. **Settings -> Secrets and variables -> Actions -> New repository secret** -ல் மேலே உள்ள 6 `VITE_FIREBASE_*` பெயர்களையும் (values-உடன்) ஒவ்வொன்றாக சேர்க்கவும்.
2. **Settings -> Pages** -ல் "Build and deployment -> Source" -ஐ **GitHub Actions** என மாற்றவும்.
3. இந்த மாற்றங்கள் `main` branch-ல் merge ஆகியதும் (அல்லது **Actions** tab -> "Deploy to GitHub Pages" -> **Run workflow**), 1-2 நிமிடத்தில் இங்கே உங்கள் website கிடைக்கும்:

   **`https://thileeban1.github.io/kadhiravan/`**

Vercel / Netlify / Firebase Hosting விரும்பினால் அவையும் வேலை செய்யும் — build command `npm run build`, output directory `dist`, 6 env vars சேர்த்தால் போதும்.

## தரவு எங்கே சேமிக்கப்படுகிறது?

Firestore-ல் `app` collection-க்குள் 4 documents:

- `app/grades` — தரங்கள்
- `app/subjects` — பாடங்கள் (Zoom link, recordings, pdfs உள்ளடங்கலாக)
- `app/students` — மாணவர்கள் + Access Codes + அவர்களுக்கான பாட அனுமதிகள்
- `app/settings` — பள்ளி பெயர், tagline

இவை realtime-ஆக sync ஆகும் — ஆசிரியர் ஒரு மாற்றம் செய்தவுடன், அது திறந்திருக்கும் எல்லா மாணவர் tabs-லும் உடனே தெரியும்.

## பாதுகாப்பு

ஆசிரியர் screens Firebase Authentication (Email/Password) மூலம் பாதுகாக்கப்படுகிறது:

- Data படிக்க (`read`) யாருக்கும் தடையில்லை — மாணவர்கள் Access Code மூலம் login செய்ய subjects/students தரவு அவசியம் open-ஆக இருக்க வேண்டும் (இது ஆசிரியர் கணக்கு விவரங்களை வெளிப்படுத்தாது).
- Data மாற்ற (`write` — தரம்/பாடம்/மாணவர் சேர்த்தல், பள்ளி பெயர் மாற்றுதல் etc.) Firebase-ல் sign-in ஆன ஒரு உண்மையான கணக்கு தேவை (`firestore.rules`-ல் `request.auth != null` எனும் நிபந்தனை).
- ஆசிரியர் கணக்குகள் website-ல் இருந்து யாரும் தானாக உருவாக்க முடியாது — Firebase Console-ல் நீங்கள் (owner) மட்டுமே **Authentication -> Users -> Add user** மூலம் புதிய ஆசிரியர் கணக்கு கொடுக்க முடியும்.
- கடவுச்சொல் "மறந்துவிட்டதா" reset Firebase-ஆல் நேரடியாக மின்னஞ்சல் வழியாக கையாளப்படுகிறது — யாரும் code-ல் plain-text password வைத்திருக்க வேண்டியதில்லை.

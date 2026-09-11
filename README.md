# வகுப்பு போர்ட்டல் (Class Portal)

ஆசிரியர் தரம் / பாடம் / Zoom Link / Recordings / PDF குறிப்புகளை நிர்வகிக்கவும், மாணவர்கள் ஒரு **Access Code** மூலம் (Google account எதுவும் தேவையில்லாமல்) தங்களுக்கு ஒதுக்கப்பட்ட பாடங்களை மட்டும் பார்க்கவும் முடியும் — ஒரு பொது website ஆக React + Firebase (Firestore) வைத்து கட்டப்பட்டது.

## 1. Firebase Project உருவாக்குதல்

1. https://console.firebase.google.com -> **Add project** -> பெயர் கொடுத்து உருவாக்கவும் (Google Analytics தேவையில்லை, off வைக்கலாம்).
2. இடது பக்க menu-ல் **Build -> Firestore Database** -> **Create database** -> production mode -> உங்களுக்கு அருகில் உள்ள region தேர்ந்தெடுக்கவும்.
3. **Build -> Firestore Database -> Rules** tab-க்கு சென்று, இந்த repo-வில் உள்ள `firestore.rules` கோப்பின் உள்ளடக்கத்தை copy பண்ணி paste பண்ணி **Publish** செய்யவும்.
4. **Project settings** (⚙️ icon) -> **General** tab -> கீழே "Your apps" -> `</>` (Web) icon கிளிக் செய்து ஒரு app register பண்ணவும் (Firebase Hosting இப்போது தேவையில்லை, skip பண்ணலாம்).
5. கிடைக்கும் `firebaseConfig` object-ல் இருந்து மதிப்புகளை குறித்து வைத்துக் கொள்ளவும் — அடுத்த step-ல் தேவை.

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

http://localhost:5173 திறந்து பார்க்கவும். முதல் தடவை "நான் ஆசிரியர்" -> ஒரு கடவுச்சொல்லை அமைத்து நுழையவும்.

## 3. Public Website ஆக Deploy செய்தல்

எந்த static-hosting சேவையும் பயன்படுத்தலாம் (Vercel, Netlify, Firebase Hosting). எடுத்துக்காட்டாக **Vercel**:

1. இந்த repo-வை GitHub-ல் இருந்து Vercel-ல் import பண்ணவும்.
2. Build command: `npm run build`, Output directory: `dist` (Vercel தானாகவே கண்டுபிடிக்கும்).
3. Project Settings -> Environment Variables-ல் மேலே உள்ள 6 `VITE_FIREBASE_*` மதிப்புகளையும் சேர்க்கவும்.
4. Deploy செய்தவுடன் கிடைக்கும் URL-ஐ யார் வேண்டுமானாலும் (Google account இல்லாமல் கூட) திறந்து, ஆசிரியர் கொடுத்த Access Code வைத்து மாணவர்களாக நுழையலாம்.

Firebase Hosting வேண்டுமெனில்: `npm i -g firebase-tools`, `firebase login`, `firebase init hosting` (public directory: `dist`), `npm run build && firebase deploy`.

## தரவு எங்கே சேமிக்கப்படுகிறது?

Firestore-ல் `app` collection-க்குள் 4 documents:

- `app/grades` — தரங்கள்
- `app/subjects` — பாடங்கள் (Zoom link, recordings, pdfs உள்ளடங்கலாக)
- `app/students` — மாணவர்கள் + Access Codes + அவர்களுக்கான பாட அனுமதிகள்
- `app/settings` — பள்ளி பெயர், tagline, ஆசிரியர் கடவுச்சொல்

இவை realtime-ஆக sync ஆகும் — ஆசிரியர் ஒரு மாற்றம் செய்தவுடன், அது திறந்திருக்கும் எல்லா மாணவர் tabs-லும் உடனே தெரியும்.

## பாதுகாப்பு குறிப்பு

ஆசிரியர் கடவுச்சொல் இந்த app-ல் Firebase Authentication இல்லாமல், `settings` document-ல் plain text-ஆக வைக்கப்பட்டு browser-லேயே சரிபார்க்கப்படுகிறது. இது ஒரு "front door lock" மட்டுமே — உண்மையான பாதுகாப்பு அல்ல. `firestore.rules`-ல் குறிப்பிட்டுள்ளபடி, Firestore-க்கு நேரடியாக அணுகக்கூடியவர் எவரும் அந்த கடவுச்சொல்லையும் தரவையும் படிக்க/மாற்ற முடியும். பள்ளி/நிறுவன அளவில் உண்மையான பாதுகாப்பு தேவைப்பட்டால், Firebase Authentication சேர்த்து ஆசிரியர் account-ஐ sign-in மூலம் சரிபார்க்கும்படி rules-ஐ இறுக்கமாக்க வேண்டும்.

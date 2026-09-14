# இலங்கை தமிழர் திருமண மையம் (Matrimony Website)

பொதுமக்கள் தங்கள் திருமண சுயவிவரத்தை பதிவு செய்யலாம், நிர்வாகி அதை பரிசீலித்து ஏற்றுக்கொண்ட பின் அது பொதுவில் காணப்படும். பார்வையாளர்கள் சுயவிவரங்களை தேடலாம் (வயது/மாவட்டம்/பாலினம் வடிகட்டி), ஒரு சுயவிவரத்தில் ஆர்வம் இருந்தால் தங்கள் தொடர்பு விவரத்தை பதிவு செய்யலாம் — நிர்வாகி இரு தரப்பையும் நேரடியாக இணைப்பார் (தனியுரிமை காக்கும் வகையில் தொடர்பு எண்கள் பொதுவில் காட்டப்படாது). React + Firebase (Firestore) வைத்து கட்டப்பட்டது, GitHub Pages-ல் இலவசமாக host செய்யலாம்.

## 1. Firebase Project உருவாக்குதல்

1. https://console.firebase.google.com -> **Add project** -> பெயர் கொடுத்து உருவாக்கவும் (Google Analytics தேவையில்லை, off வைக்கலாம்).
2. இடது பக்க menu-ல் **Build -> Firestore Database** -> **Create database** -> production mode -> உங்களுக்கு அருகில் உள்ள region தேர்ந்தெடுக்கவும்.
3. **Build -> Firestore Database -> Rules** tab-க்கு சென்று, இந்த repo-வில் உள்ள `firestore.rules` கோப்பின் உள்ளடக்கத்தை copy பண்ணி paste பண்ணி **Publish** செய்யவும்.
4. **Project settings** (⚙️ icon) -> **General** tab -> கீழே "Your apps" -> `</>` (Web) icon கிளிக் செய்து ஒரு app register பண்ணவும் (Firebase Hosting இப்போது தேவையில்லை, skip பண்ணலாம்).
5. கிடைக்கும் `firebaseConfig` object-ல் இருந்து மதிப்புகளை குறித்து வைத்துக் கொள்ளவும் — அடுத்த step-ல் தேவை.

### Authentication (நிர்வாகி உள்நுழைவு)

1. **Build -> Authentication** -> **Get started**.
2. **Sign-in method** tab -> **Email/Password** -> Enable -> Save.
3. **Users** tab -> **Add user** -> நிர்வாகிக்கான மின்னஞ்சல் மற்றும் கடவுச்சொல்லை உள்ளிடவும். இதே மின்னஞ்சல்/கடவுச்சொல் வைத்துதான் website-ல் "நிர்வாகி" screen-ல் login செய்ய முடியும்.
   - Website-ல் யாரும் self-service-ஆக நிர்வாகி account create பண்ண முடியாது — நீங்கள் (project owner) Console வழியாக யாருக்கு account கொடுக்கிறீர்களோ அவர்கள் மட்டுமே நிர்வாகியாக நுழைய முடியும்.
4. கடவுச்சொல் மறந்துவிட்டால், website-லேயே "கடவுச்சொல் மறந்துவிட்டதா?" மூலம் reset link அனுப்பிக்கொள்ளலாம்.

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

http://localhost:5173 திறந்து பார்க்கவும். "நிர்வாகி" -> Firebase Console-ல் நீங்கள் உருவாக்கிய மின்னஞ்சல்/கடவுச்சொல் வைத்து நுழையவும்.

## 3. Public Website ஆக Deploy செய்தல் (GitHub Pages — தானியங்கி)

இந்த repo-வில் `.github/workflows/deploy.yml` ஏற்கனவே சேர்க்கப்பட்டுள்ளது — `main` branch-க்கு push ஆகும் ஒவ்வொரு முறையும் தானாக build செய்து GitHub Pages-க்கு deploy செய்துவிடும். நீங்கள் செய்ய வேண்டியது 3 one-time steps மட்டும்:

1. **Settings -> Secrets and variables -> Actions -> New repository secret** -ல் மேலே உள்ள 6 `VITE_FIREBASE_*` பெயர்களையும் (values-உடன்) ஒவ்வொன்றாக சேர்க்கவும்.
2. **Settings -> Pages** -ல் "Build and deployment -> Source" -ஐ **GitHub Actions** என மாற்றவும்.
3. இந்த மாற்றங்கள் `main` branch-ல் merge ஆகியதும் (அல்லது **Actions** tab -> "Deploy to GitHub Pages" -> **Run workflow**), 1-2 நிமிடத்தில் இங்கே உங்கள் website கிடைக்கும்:

   **`https://thileeban1.github.io/ilangaithirumanam-/`**

Vercel / Netlify / Firebase Hosting விரும்பினால் அவையும் வேலை செய்யும் — build command `npm run build`, output directory `dist`, 6 env vars சேர்த்தால் போதும்.

## தரவு எங்கே சேமிக்கப்படுகிறது?

Firestore-ல்:

- `profiles/{id}` — ஒவ்வொரு பதிவு செய்யப்பட்ட சுயவிவரமும் ஒரு document. `status` field `pending` (பரிசீலனையில்) / `approved` (பொதுவில் காணப்படும்) / `rejected` (நிராகரிக்கப்பட்டது) என்று இருக்கும். பொதுமக்கள் புதிய சுயவிவரத்தை `pending` நிலையில் மட்டுமே create செய்ய முடியும்; approve/reject/edit/delete நிர்வாகி மட்டுமே செய்ய முடியும்.
- `interests/{id}` — ஒரு சுயவிவரத்தில் ஆர்வம் தெரிவித்தவரின் பெயர்/தொடர்பு எண்/செய்தி. நிர்வாகி மட்டுமே இதை படிக்க/நிர்வகிக்க முடியும் (தனியுரிமை காரணமாக).
- `settings/site` — தளத்தின் பெயர், tagline.

இவை realtime-ஆக sync ஆகும்.

## பாதுகாப்பு

- யாரும் புதிய சுயவிவரத்தை (status: pending) பதிவு செய்யலாம், ஆனால் `approved` எனக் குறிக்கப்பட்ட சுயவிவரங்கள் மட்டுமே பொதுவில் தெரியும்.
- சுயவிவரங்களை ஏற்றுக்கொள்ளுதல் / நிராகரித்தல் / திருத்துதல் / நீக்குதல் — Firebase-ல் sign-in ஆன நிர்வாகி கணக்கு மட்டுமே செய்ய முடியும் (`firestore.rules`-ல் `request.auth != null` எனும் நிபந்தனை).
- ஆர்வம் தெரிவித்தவர்களின் தொடர்பு விவரங்கள் நிர்வாகி மட்டுமே பார்க்க முடியும் — பொதுவில் யாருடைய தொடர்பு எண்ணும் நேரடியாக காட்டப்படாது.
- நிர்வாகி கணக்குகள் website-ல் இருந்து யாரும் தானாக உருவாக்க முடியாது — Firebase Console-ல் நீங்கள் (owner) மட்டுமே **Authentication -> Users -> Add user** மூலம் புதிய நிர்வாகி கணக்கு கொடுக்க முடியும்.
- Real WordPress (PHP/MySQL) வேண்டுமெனில் அதற்கு தனி PHP hosting தேவை — இந்த setup GitHub Pages போன்ற static hosting-ல் இலவசமாக இயங்கும் வகையில் React + Firebase-ஐ பயன்படுத்துகிறது.

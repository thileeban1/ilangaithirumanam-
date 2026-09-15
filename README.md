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

### ⚠️ நிர்வாகியை "admins" allowlist-ல் சேர்க்க (அவசியம், இல்லையேல் நிர்வாகி பலகை திறக்காது)

இப்போது உறுப்பினர்களும் (பதிவு செய்பவர்கள்) Firebase Auth account பெறுவதால், "யார் நிர்வாகி" எனத் தெளிவாக குறிக்க ஒரு `admins` collection பயன்படுத்தப்படுகிறது. மேலே Authentication-ல் உருவாக்கிய ஒவ்வொரு நிர்வாகி கணக்கிற்கும் இதைச் செய்யவும்:

1. **Build -> Authentication -> Users** tab-க்குச் சென்று, நிர்வாகியின் மின்னஞ்சலைத் தட்டவும் -> அவரின் **User UID** (நீண்ட எழுத்து/எண் சேர்க்கை) copy பண்ணவும்.
2. **Build -> Firestore Database -> Data** tab-க்குச் சென்று **Start collection** -> Collection ID: `admins`.
3. Document ID-ஆக அந்த **User UID**-ஐயே paste பண்ணவும் (வேறு எதுவும் அல்ல).
4. ஏதேனும் ஒரு field சேர்க்கவும் (எ.கா. field name `role`, value `admin`) -> **Save**.

இதைச் செய்யாத வரை, அந்த நிர்வாகி login செய்யலாம் ஆனால் "நிர்வாகி பலகை" திறக்காது (பயனாளர் dashboard-க்கே திருப்பி அனுப்பப்படுவார்).

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

## உறுப்பினர் கணக்குகள் (பதிவு செய்பவர்களுக்கு)

சுயவிவரம் பதிவு செய்யும் ஒவ்வொருவருக்கும்:

- ஒரு **5-இலக்க Profile ID** (எ.கா. 10001) தானாக கொடுக்கப்படும்.
- அவர்கள் பதிவு செய்யும் தொடர்பு எண் + அவர்கள் தேர்ந்தெடுக்கும் கடவுச்சொல் வைத்து ஒரு Firebase Auth கணக்கும் தானாக உருவாக்கப்படும் (பின்னால் synthetic email address-ஆக internal-ஆக சேமிக்கப்படும், பயனாளர் அதை பார்க்க வேண்டியதில்லை).
- இந்த தொடர்பு எண் + கடவுச்சொல் வைத்து, "உறுப்பினர் / எனது Dashboard" பட்டன் மூலம் எப்போதும் மீண்டும் login செய்து: தங்கள் Profile status (பரிசீலனையில்/ஏற்கப்பட்டது/நிராகரிக்கப்பட்டது), தங்களுக்கு வந்த "விருப்பங்கள்" (interest requests), தாங்கள் அனுப்பிய "விருப்பங்கள்" ஆகியவற்றைப் பார்க்கலாம், சுயவிவரத்தையும் திருத்தலாம்.

⚠️ ஒரே தொடர்பு எண்ணை இரண்டு வெவ்வேறு format-ல் (எ.கா. ஒரு முறை `0771234567`, இன்னொரு முறை `+94771234567`) பயன்படுத்தினால் system அவற்றை வெவ்வேறு கணக்குகளாக கருதும் — பதிவு செய்யும்போதும் login செய்யும்போதும் ஒரே format-ஐ பயன்படுத்தும்படி பயனாளர்களிடம் சொல்லுங்கள்.

## Packages (Pro / Super Pro / Mega Pro)

பொது browse-ல் ஒரு சுயவிவரத்தின் "meters" (வயது, மாவட்டம், படிப்பு, ஜாதகம் etc.) மட்டும் இலவசமாக தெரியும் — **பெயர், புகைப்படம், தொடர்பு எண், மின்னஞ்சல் மறைக்கப்பட்டிருக்கும்** வரை. இவற்றைப் பார்க்க credits தேவை:

| Package | விலை | காலம் | Photo unlocks | Phone unlocks |
|---|---|---|---|---|
| Pro | ₹8,000 | 3 மாதம் | 20 | 5 |
| Super Pro | ₹15,000 | 6 மாதம் | 50 | 15 |
| Mega Pro | ₹25,000 | 1 வருடம் | 100 | 20 |

**எப்படி வேலை செய்யும்:**
- ஒரு உறுப்பினர் "Photo unlock" செய்தால் அந்த profile-ன் **பெயர் + புகைப்படம்** தெரியும் (1 photo credit செலவாகும்).
- "Phone unlock" செய்தால் அந்த profile-ன் **தொடர்பு எண் + மின்னஞ்சல்** தெரியும் (1 phone credit செலவாகும்).
- ரெண்டும் தனித்தனி credits — ஒன்று தீர்ந்தாலும் இன்னொன்று தொடரும்.
- Package வாங்குவது **தற்போது நிர்வாகி மூலமாகவே நடக்கும்** (Payment gateway இன்னும் இல்லை — Bank-க்கு பணம் அனுப்பி நிர்வாகியிடம் சொன்ன பின், நிர்வாகி Dashboard-ல் அந்த உறுப்பினரின் profile-ஐ "திருத்து" பண்ணும்போது Package assign பண்ணுவார்; quota + expiry date தானாக அமையும்).
- Credit தேவைப்படாத ஒரு **இலவச "விருப்பம் தெரிவிக்க"** option-உம் எப்போதும் இருக்கும் — அதற்கு பணம் தேவையில்லை, நிர்வாகி இரு தரப்பையும் manually இணைப்பார்.

## தரவு எங்கே சேமிக்கப்படுகிறது?

Firestore-ல்:

- `profiles/{id}` — ஒவ்வொரு பதிவு செய்யப்பட்ட சுயவிவரத்தின் பொது "meters" (`memberId`, `ownerUid`, வயது/மாவட்டம்/படிப்பு/ஜாதகம் etc.) — பெயர்/புகைப்படம்/தொடர்பு எண் இதில் இல்லை. `status` field `pending` / `approved` / `rejected`.
  - `profiles/{id}/private/identity` — `{ name, photoUrl }`, photo-unlock செய்தவர்கள் மட்டுமே படிக்க முடியும்.
  - `profiles/{id}/private/contact` — `{ phone, email }`, phone-unlock செய்தவர்கள் மட்டுமே படிக்க முடியும்.
- `members/{uid}` — ஒவ்வொரு உறுப்பினரின் package/credits: `package`, `packageExpiresAt`, `photoQuota`/`photoQuotaUsed`, `phoneQuota`/`phoneQuotaUsed`, `unlockedPhotoIds`, `unlockedPhoneIds`. `package`/quota totals நிர்வாகி மட்டுமே மாற்ற முடியும்; unlock செய்யும்போது member தன் own credits-ஐ மட்டுமே செலவழிக்க முடியும்.
- `interests/{id}` — ஒரு சுயவிவரத்தில் ஆர்வம் தெரிவித்தவரின் பெயர்/தொடர்பு எண்/செய்தி + `requesterUid`/`recipientUid`. நிர்வாகி, அனுப்பியவர், பெறுபவர் மட்டுமே இதை படிக்க முடியும்.
- `admins/{uid}` — யாருடைய Firebase Auth uid நிர்வாகி என்பதை குறிக்கும் allowlist. இதை நீங்கள் Firebase Console-லேயே manually சேர்க்க வேண்டும் (மேலே பார்க்கவும்).
- `counters/memberId` — அடுத்த Profile ID எண்ணை track செய்யும் internal counter.
- `settings/site` — தளத்தின் பெயர், tagline.

இவை realtime-ஆக sync ஆகும்.

## பாதுகாப்பு

- யாரும் புதிய சுயவிவரத்தை (status: pending) பதிவு செய்யலாம், ஆனால் `approved` எனக் குறிக்கப்பட்ட சுயவிவரங்களின் "meters" மட்டுமே மற்ற உறுப்பினர்களுக்கு தெரியும் — பெயர்/புகைப்படம்/தொடர்பு எண் அந்தந்த credit unlock செய்தவர்களுக்கு மட்டுமே, `firestore.rules`-ல் நேரடியாக enforce செய்யப்படுகிறது (UI-ல் மட்டும் hide பண்ணி இல்லை).
- ஒரு உறுப்பினர் தன்னுடைய சொந்த profile-ஐ மட்டுமே திருத்த முடியும் (status மாற்ற முடியாது, வேறொருவரின் profile-ஐ தொட முடியாது).
- Package/quota totals-ஐ ஒரு உறுப்பினரால் தானாக தன் account-க்கு கொடுக்க முடியாது — `admins` collection-ல் uid பட்டியலிடப்பட்ட கணக்குகள் மட்டுமே Package assign பண்ண முடியும். உறுப்பினர் தன் own credits-ஐ unlock பண்ணும்போது மட்டுமே தன் quota-ஐ தொட முடியும் (அதுவும் ஏற்கனவே granted அளவுக்கு மேல் போக முடியாது).
- ஆர்வம் தெரிவித்தவர்களின் தொடர்பு விவரங்கள் நிர்வாகி + அனுப்பியவர் + பெறுபவர் மட்டுமே பார்க்க முடியும்.
- நிர்வாகி கணக்குகள் website-ல் இருந்து யாரும் தானாக உருவாக்க முடியாது — Firebase Console-ல் நீங்கள் (owner) மட்டுமே **Authentication -> Users -> Add user** + **admins collection-ல் அவரது uid சேர்த்தல்** மூலம் புதிய நிர்வாகி கணக்கு கொடுக்க முடியும்.
- Real WordPress (PHP/MySQL) வேண்டுமெனில் அதற்கு தனி PHP hosting தேவை — இந்த setup GitHub Pages/Firebase Hosting போன்ற static hosting-ல் இலவசமாக இயங்கும் வகையில் React + Firebase-ஐ பயன்படுத்துகிறது.

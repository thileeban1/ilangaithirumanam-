# Class Portal LMS — WordPress Plugin

இது ஒரு WordPress **plugin** — தரம் / பாடம் / Zoom Link / Recordings / PDF குறிப்புகளை நிர்வகிக்கவும், மாணவர்கள் ஒரு **Access Code** மூலம் தங்களுக்கான பாடங்களை மட்டும் பார்க்கவும் உதவும்.

> குறிப்பு: இந்த repo-வில் ஏற்கனவே இருக்கும் React + Firebase "Class Portal" website (`../src`, `../index.html`) அப்படியே உள்ளது — மாற்றப்படவில்லை. இது ஒரு **தனி, புதிய** WordPress-based version.

## இதில் என்ன இருக்கிறது?

```
wordpress-lms/
├── docker-compose.yml              ← local-ஆக test பண்ண (WordPress + MySQL)
├── class-portal-lms.zip            ← நேரடியாக WordPress-ல் upload பண்ண தயார் zip
└── wp-content/plugins/class-portal-lms/
    ├── class-portal-lms.php        ← Plugin code (Grades, Subjects, Students, Shortcode)
    └── assets/style.css
```

### Features
- **தரங்கள் (Grades)**, **பாடங்கள் (Subjects — Zoom link + Recordings + PDF notes)**, **மாணவர்கள் (Students — Access Code + அனுமதிக்கப்பட்ட பாடங்கள்)** ஆகியவற்றை wp-admin-ல் இருந்து நிர்வகிக்கலாம் (WordPress login-ஆல் பாதுகாக்கப்பட்டது — ஆசிரியர் மட்டுமே).
- Public பக்கத்தில் `[class_portal]` shortcode வைத்தால், மாணவர்கள் Access Code உள்ளிட்டு தங்கள் பாடங்களை மட்டும் பார்க்க முடியும் (Google account எதுவும் தேவையில்லை — தற்போதைய Firebase site போலவே).
- Activate செய்தவுடன் "Class Portal" எனும் ஒரு page தானாக உருவாக்கப்பட்டு shortcode சேர்க்கப்பட்டுவிடும்.

## 1. Local-ஆக Preview பார்க்க (உங்கள் கணினியில்)

இந்த repo-வை உங்கள் கணினியில் clone செய்து, Docker இருந்தால்:

```bash
cd wordpress-lms
docker compose up -d
```

பிறகு http://localhost:8080 திறந்து WordPress-ஐ setup செய்யவும் (site name, admin username/password கொடுக்கவும்). Login ஆனதும்:

1. **Plugins -> Installed Plugins** -> "Class Portal LMS" -> **Activate**.
2. இடது menu-ல் புதிதாக "Class Portal" எனும் menu வரும் — அதில் தரங்கள் / பாடங்கள் / மாணவர்களை சேர்க்கவும்.
3. **Pages** -> "Class Portal" page-ஐ பாருங்கள் (இது தானாக உருவாக்கப்பட்டிருக்கும், `[class_portal]` shortcode-உடன்).

> **கவனிக்க:** இந்த session sandbox-ல் இருந்து Docker Hub / wordpress.org-க்கு network access தடுக்கப்பட்டிருப்பதால், இங்கே நேரடியாக run செய்து காட்ட முடியவில்லை. Plugin code-ஐ `php -l` மூலம் syntax check செய்து உறுதி செய்துள்ளேன், மேலும் WordPress-ன் standard APIகளையே (CPT, meta boxes, shortcode, nonces) பயன்படுத்தி எழுதப்பட்டுள்ளது. உங்கள் கணினியில் அல்லது hosting-ல் இயக்கும்போது வேலை செய்யும்.

## 2. இலவசமாக Publish செய்தல் (Real Website)

WordPress-க்கு PHP + MySQL server தேவை — இதை GitHub Pages போன்ற static hosting-ல் run செய்ய முடியாது. **Domain/hosting account உங்கள் பெயரிலேயே இருக்க வேண்டும்** (password reset, ownership எல்லாம் உங்கள் email-க்குத்தான் வரும்) — அதனால் account create பண்ணும் ஒரே step மட்டும் நீங்கள் செய்ய வேண்டும். மீதி எல்லாம் (plugin upload, setup) நான் உதவலாம்.

### பரிந்துரை: InfinityFree (முழுக்க இலவசம், credit card தேவையில்லை)

1. https://infinityfree.com -> **Sign Up** -> உங்கள் email/password கொடுத்து account உருவாக்கவும்.
2. Dashboard-ல் **Create Account** -> ஒரு free subdomain தேர்ந்தெடுக்கவும் (எ.கா. `classportal.infinityfreeapp.com`).
3. **Control Panel (cPanel)** திற -> **Softaculous Apps Installer** -> **WordPress** -> **Install Now** (site name, admin username/password கொடுக்கவும்).
4. Install முடிந்ததும் கிடைக்கும் **wp-admin URL + username + password**-ஐ குறித்து வையுங்கள்.
5. wp-admin -> **Plugins -> Add New -> Upload Plugin** -> இந்த repo-வில் உள்ள `class-portal-lms.zip`-ஐ upload பண்ணி **Activate** செய்யவும்.
6. **Class Portal** menu-ல் இருந்து தரங்கள்/பாடங்கள்/மாணவர்களை சேர்க்கவும். "Class Portal" page-ஐ Pages menu-ல் பார்க்கலாம் — அதுவே உங்கள் public URL.

(Alternative: WordPress.com-ன் free plan-லும் இதே போல் plugin upload செய்யலாம்.)

### அடுத்த step

Account create பண்ணி wp-admin login (அல்லது cPanel/FTP details) கிடைத்தவுடன், அதை என்னிடம் share செய்தால் — plugin upload, pages/menu setup, தரம்/பாடம் தரவு entry எல்லாவற்றையும் நானே முடித்து, முழு website-ஐயும் தயார் செய்து தருகிறேன்.

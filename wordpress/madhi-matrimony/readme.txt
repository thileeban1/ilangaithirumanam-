=== Madhi Matrimony ===
Requires at least: 6.0
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later

இலங்கை தமிழர் திருமண மையம் — the Madhi Matrimony site as a WordPress plugin.

== Description ==

* சுயவிவர பதிவு (profile registration) with up to 3 photos, auto 5-digit Profile ID (10000, 10001 …)
* Phone + password member login, member dashboard, edit own profile
* Admin approval: pending / approved / rejected (wp-admin → Matrimony)
* Search with quick + advanced filters (gender, religion, age, district, marital status, profession, education)
* Name + photos and phone + email stay hidden until a member spends a Photo / Phone credit
* Packages (Start / Pro / Super Pro / Mega Pro) with editable price, months and quotas; admin assigns them
* Interests (விருப்பம்): send, accept / reject; admin sees matches first
* WhatsApp contact buttons, watermarked photos

== Installation ==

1. Upload the `madhi-matrimony` folder (or the zip) via Plugins → Add New → Upload Plugin, then Activate.
2. A page "திருமண மையம்" containing the shortcode [madhi_matrimony] is created automatically.
   To make it the homepage: Settings → Reading → "A static page" → Homepage: திருமண மையம்.
3. Settings → Permalinks → "Post name" is recommended.
4. wp-admin → Matrimony → அமைப்புகள்: set the site name, tagline, WhatsApp number and package prices.

Admins are WordPress administrators. Members are created automatically when they register.

Photos are stored in wp-content/uploads/mm-private/ (not the Media Library) and are only served
through the plugin after a permission check. Apache blocks direct access via .htaccess; on nginx add:

    location ^~ /wp-content/uploads/mm-private/ { deny all; }

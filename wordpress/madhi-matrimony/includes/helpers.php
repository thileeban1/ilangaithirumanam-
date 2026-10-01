<?php
/**
 * Shared constants and small helpers — the WordPress counterpart of the
 * constants at the top of the React app's src/App.jsx.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const MM_MAX_PHOTOS       = 3;
const MM_MAX_PHOTO_DIM    = 480;
const MM_PHOTO_QUALITY    = 72;
const MM_FIRST_MEMBER_ID  = 10000;
const MM_MEMBER_ROLE      = 'mm_member';
const MM_ADMIN_CAP        = 'mm_manage';
const MM_PER_PAGE         = 20;

function mm_genders() {
	return array( 'ஆண்', 'பெண்' );
}

function mm_marital_statuses() {
	return array( 'திருமணமாகாதவர்', 'விவாகரத்து பெற்றவர்', 'விதவை / விதவன்' );
}

function mm_religions() {
	return array( 'இந்து', 'கிறிஸ்தவர்', 'இஸ்லாம்', 'பிற' );
}

function mm_rasis() {
	return array( 'மேஷம்', 'ரிஷபம்', 'மிதுனம்', 'கடகம்', 'சிம்மம்', 'கன்னி', 'துலாம்', 'விருச்சிகம்', 'தனுசு', 'மகரம்', 'கும்பம்', 'மீனம்' );
}

function mm_natchathirams() {
	return array(
		'அஸ்வினி', 'பரணி', 'கார்த்திகை', 'ரோகிணி', 'மிருகசீரிடம்', 'திருவாதிரை', 'புனர்பூசம்',
		'பூசம்', 'ஆயில்யம்', 'மகம்', 'பூரம்', 'உத்திரம்', 'ஹஸ்தம்', 'சித்திரை', 'சுவாதி',
		'விசாகம்', 'அனுஷம்', 'கேட்டை', 'மூலம்', 'பூராடம்', 'உத்திராடம்', 'திருவோணம்',
		'அவிட்டம்', 'சதயம்', 'பூரட்டாதி', 'உத்திரட்டாதி', 'ரேவதி',
	);
}

function mm_status_labels() {
	return array(
		'pending'  => 'பரிசீலனையில்',
		'approved' => 'ஏற்றுக்கொள்ளப்பட்டது',
		'rejected' => 'நிராகரிக்கப்பட்டது',
	);
}

function mm_interest_status_labels() {
	return array(
		'pending'  => 'பதிலுக்கு காத்திருக்கிறது',
		'accepted' => 'ஏற்றுக்கொள்ளப்பட்டது',
		'rejected' => 'நிராகரிக்கப்பட்டது',
	);
}

/** Empty profile form values (same defaults as EMPTY_PROFILE in the React app). */
function mm_empty_profile() {
	return array(
		'name'           => '',
		'gender'         => '',
		'dob'            => '',
		'birth_time'     => '',
		'rasi'           => '',
		'natchathiram'   => '',
		'height'         => '',
		'religion'       => '',
		'caste'          => '',
		'mother_tongue'  => 'தமிழ்',
		'country'        => 'இலங்கை',
		'district'       => '',
		'marital_status' => '',
		'education'      => '',
		'profession'     => '',
		'about'          => '',
		'phone'          => '',
		'email'          => '',
	);
}

function mm_default_settings() {
	return array(
		'site_name'      => 'இலங்கை தமிழர் திருமண மையம்',
		'tagline'        => 'நம்பிக்கையுடன் ஒரு புதிய தொடக்கம்',
		'admin_whatsapp' => '0752495266',
	);
}

function mm_settings() {
	return wp_parse_args( (array) get_option( 'mm_settings', array() ), mm_default_settings() );
}

/**
 * Seed values only — the admin can change price/months/quotas for every
 * package from the settings page; the live numbers are stored in the
 * mm_packages option. Adding a new key here is the only code change needed
 * to introduce another tier later.
 */
function mm_default_packages() {
	return array(
		'start'    => array( 'label' => 'Start', 'price' => 3000, 'months' => 1, 'photo_quota' => 5, 'phone_quota' => 2 ),
		'pro'      => array( 'label' => 'Pro', 'price' => 8000, 'months' => 3, 'photo_quota' => 20, 'phone_quota' => 5 ),
		'superpro' => array( 'label' => 'Super Pro', 'price' => 15000, 'months' => 6, 'photo_quota' => 50, 'phone_quota' => 15 ),
		'megapro'  => array( 'label' => 'Mega Pro', 'price' => 25000, 'months' => 12, 'photo_quota' => 100, 'phone_quota' => 20 ),
	);
}

function mm_packages() {
	$live = (array) get_option( 'mm_packages', array() );
	$out  = array();
	foreach ( mm_default_packages() as $key => $pkg ) {
		$out[ $key ] = wp_parse_args( isset( $live[ $key ] ) ? (array) $live[ $key ] : array(), $pkg );
	}
	return $out;
}

function mm_package_label( $key ) {
	$packages = mm_packages();
	return isset( $packages[ $key ] ) ? $packages[ $key ]['label'] : (string) $key;
}

function mm_digits( $s ) {
	return preg_replace( '/\D/', '', (string) $s );
}

/**
 * WordPress username a member logs in with, derived from their phone. A local
 * Sri Lankan number (07XXXXXXXX) is stored in its +94 form, so "0771234567"
 * and "+94 77 123 4567" are the same account.
 */
function mm_login_from_phone( $phone ) {
	$digits = mm_digits( $phone );
	if ( 10 === strlen( $digits ) && 0 === strpos( $digits, '0' ) ) {
		$digits = '94' . substr( $digits, 1 );
	}
	return 'm' . $digits;
}

/**
 * Converts a local Sri Lankan number (07XXXXXXXX) or an already-international
 * one to the digits-only, country-code-prefixed form wa.me links need.
 */
function mm_wa_link( $phone, $text = '' ) {
	$digits = mm_digits( $phone );
	if ( 0 === strpos( $digits, '0' ) ) {
		$digits = '94' . substr( $digits, 1 );
	} elseif ( 0 !== strpos( $digits, '94' ) ) {
		$digits = '94' . $digits;
	}
	return 'https://wa.me/' . $digits . ( $text ? '?text=' . rawurlencode( $text ) : '' );
}

function mm_calc_age( $dob ) {
	if ( empty( $dob ) || '0000-00-00' === $dob ) {
		return null;
	}
	try {
		$birth = new DateTimeImmutable( $dob, wp_timezone() );
		$now   = new DateTimeImmutable( 'now', wp_timezone() );
	} catch ( Exception $e ) {
		return null;
	}
	return (int) $birth->diff( $now )->y;
}

function mm_fmt_date( $mysql_date ) {
	if ( empty( $mysql_date ) ) {
		return '';
	}
	$ts = strtotime( $mysql_date );
	return $ts ? date_i18n( 'd M Y', $ts ) : '';
}

function mm_is_admin() {
	return current_user_can( MM_ADMIN_CAP ) || current_user_can( 'manage_options' );
}

/** "45 வயது • யாழ்ப்பாணம் • ஆசிரியர்" style one-liner for a profile row. */
function mm_profile_summary( $p, $with_profession = true ) {
	$parts = array();
	$age   = mm_calc_age( $p->dob );
	if ( null !== $age ) {
		$parts[] = $age . ' வயது';
	}
	if ( $p->district ) {
		$parts[] = $p->district;
	}
	if ( $with_profession && $p->profession ) {
		$parts[] = $p->profession;
	}
	return implode( ' • ', $parts );
}

function mm_whatsapp_icon() {
	return '<svg width="19" height="19" viewBox="0 0 24 24" fill="#04240F" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51-.17-.01-.37-.01-.57-.01s-.52.07-.8.37c-.27.3-1.04 1.02-1.04 2.5s1.07 2.9 1.22 3.1c.15.2 2.1 3.21 5.1 4.5.71.31 1.27.49 1.7.62.72.23 1.37.2 1.89.12.58-.09 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35z"/><path d="M12.02 2C6.5 2 2 6.48 2 12c0 1.85.5 3.58 1.36 5.08L2 22l5.06-1.33A9.96 9.96 0 0 0 12.02 22C17.53 22 22 17.52 22 12S17.53 2 12.02 2zm0 18.2c-1.62 0-3.13-.44-4.43-1.21l-.32-.19-3 .79.8-2.92-.21-.3A8.17 8.17 0 0 1 3.8 12c0-4.53 3.7-8.2 8.22-8.2 4.52 0 8.2 3.67 8.2 8.2 0 4.53-3.68 8.2-8.2 8.2z"/></svg>';
}

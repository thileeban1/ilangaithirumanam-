<?php
/**
 * Member accounts and the profile form shared by registration, a member's
 * own edit, and the admin's edit.
 *
 * Every registrant gets an ordinary WordPress user (role mm_member) whose
 * username is "m" + the digits of their phone number, so they log back in
 * with phone + password exactly as on the Firebase site. Admins are normal
 * WordPress administrators (or any role given the mm_manage capability).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MM_Members {

	public static function init() {
		add_action( 'admin_init', array( __CLASS__, 'keep_members_out_of_wp_admin' ) );
		add_filter( 'show_admin_bar', array( __CLASS__, 'hide_admin_bar_for_members' ) );
	}

	public static function is_member_only( $user = null ) {
		$user = $user ? $user : wp_get_current_user();
		return $user && $user->exists() && in_array( MM_MEMBER_ROLE, (array) $user->roles, true ) && ! user_can( $user, MM_ADMIN_CAP ) && ! user_can( $user, 'manage_options' );
	}

	public static function keep_members_out_of_wp_admin() {
		if ( wp_doing_ajax() || ( defined( 'DOING_CRON' ) && DOING_CRON ) ) {
			return;
		}
		$script = isset( $_SERVER['PHP_SELF'] ) ? basename( sanitize_text_field( wp_unslash( $_SERVER['PHP_SELF'] ) ) ) : '';
		if ( 'admin-post.php' === $script ) {
			return;
		}
		if ( self::is_member_only() ) {
			wp_safe_redirect( MM_Frontend::url( 'dashboard' ) );
			exit;
		}
	}

	public static function hide_admin_bar_for_members( $show ) {
		return self::is_member_only() ? false : $show;
	}

	/**
	 * Profile fields from the submitted form. They're posted as mmf[...]
	 * because bare names like "name" are WordPress query vars and would turn
	 * the request into a post lookup (404).
	 */
	public static function posted_profile() {
		return self::read_profile_form( isset( $_POST['mmf'] ) && is_array( $_POST['mmf'] ) ? $_POST['mmf'] : array() ); // phpcs:ignore -- sanitized in read_profile_form.
	}

	/**
	 * Reads and sanitizes the profile fields from a submitted form.
	 */
	public static function read_profile_form( $src ) {
		$f = mm_empty_profile();
		foreach ( $f as $key => $default ) {
			if ( ! isset( $src[ $key ] ) ) {
				continue;
			}
			$raw     = wp_unslash( $src[ $key ] );
			$f[ $key ] = 'about' === $key ? sanitize_textarea_field( $raw ) : sanitize_text_field( $raw );
		}
		$f['email'] = sanitize_email( $f['email'] );
		if ( $f['dob'] && ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $f['dob'] ) ) {
			$f['dob'] = '';
		}
		if ( $f['birth_time'] && ! preg_match( '/^\d{2}:\d{2}$/', $f['birth_time'] ) ) {
			$f['birth_time'] = '';
		}
		// Only fixed-choice fields from their lists; anything else is dropped.
		$choices = array(
			'gender'         => mm_genders(),
			'religion'       => mm_religions(),
			'marital_status' => mm_marital_statuses(),
			'rasi'           => mm_rasis(),
			'natchathiram'   => mm_natchathirams(),
		);
		foreach ( $choices as $key => $list ) {
			if ( '' !== $f[ $key ] && ! in_array( $f[ $key ], $list, true ) ) {
				$f[ $key ] = '';
			}
		}
		// Horoscope fields only apply to Hindu profiles.
		if ( 'இந்து' !== $f['religion'] ) {
			$f['birth_time']   = '';
			$f['rasi']         = '';
			$f['natchathiram'] = '';
		}
		return $f;
	}

	/** Profile values as stored in the DB (dob NULL when empty). */
	public static function to_db( $f ) {
		$row        = $f;
		$row['dob'] = $f['dob'] ? $f['dob'] : null;
		return $row;
	}

	/** DB row → form values. */
	public static function from_db( $p ) {
		$f = mm_empty_profile();
		foreach ( $f as $key => $v ) {
			if ( isset( $p->$key ) ) {
				$f[ $key ] = (string) $p->$key;
			}
		}
		return $f;
	}

	/**
	 * Applies "remove these photos" checkboxes + new uploads to an existing
	 * photo list, keeping the 1..MM_MAX_PHOTOS rule.
	 *
	 * @return array{0: string[], 1: string[], 2: string} [new list, files to delete, error]
	 */
	public static function merge_photos( $current, $remove_indexes, $field ) {
		$remove = array_map( 'intval', (array) $remove_indexes );
		$keep   = array();
		$drop   = array();
		foreach ( $current as $i => $name ) {
			if ( in_array( $i, $remove, true ) ) {
				$drop[] = $name;
			} else {
				$keep[] = $name;
			}
		}
		list( $added, $err ) = MM_Photos::save_uploads( $field, MM_MAX_PHOTOS - count( $keep ) );
		if ( $err ) {
			MM_Photos::delete_files( $added );
			return array( $current, array(), $err );
		}
		$list = array_merge( $keep, $added );
		if ( ! $list ) {
			MM_Photos::delete_files( $added );
			return array( $current, array(), 'குறைந்தது ஒரு புகைப்படமாவது இருக்க வேண்டும்.' );
		}
		return array( $list, $drop, '' );
	}

	/**
	 * Creates the WP user + pending profile + empty member row.
	 *
	 * @return int|string profile id, or an error message.
	 */
	public static function register( $f, $password, $password_confirm ) {
		if ( '' === trim( $f['name'] ) || '' === $f['gender'] || '' === $f['dob'] || '' === trim( $f['phone'] ) ) {
			return 'பெயர், பாலினம், பிறந்த தேதி, தொடர்பு எண் ஆகியவற்றை நிரப்பவும்.';
		}
		if ( strlen( mm_digits( $f['phone'] ) ) < 7 ) {
			return 'சரியான தொடர்பு எண்ணை உள்ளிடவும்.';
		}
		if ( empty( $_FILES['mm_photos']['name'] ) || ! array_filter( (array) $_FILES['mm_photos']['name'] ) ) {
			return 'குறைந்தது ஒரு புகைப்படமாவது பதிவேற்ற வேண்டும்.';
		}
		if ( strlen( $password ) < 6 ) {
			return 'கடவுச்சொல் குறைந்தது 6 எழுத்துகள் இருக்க வேண்டும்.';
		}
		if ( $password !== $password_confirm ) {
			return 'கடவுச்சொற்கள் பொருந்தவில்லை.';
		}
		$login = mm_login_from_phone( $f['phone'] );
		if ( username_exists( $login ) ) {
			return 'இந்த தொடர்பு எண் ஏற்கனவே பதிவு செய்யப்பட்டுள்ளது. உள்நுழையவும்.';
		}

		list( $photos, $err ) = MM_Photos::save_uploads( 'mm_photos', MM_MAX_PHOTOS );
		if ( $err || ! $photos ) {
			MM_Photos::delete_files( $photos );
			return $err ? $err : 'குறைந்தது ஒரு புகைப்படமாவது பதிவேற்ற வேண்டும்.';
		}

		$user_id = wp_insert_user(
			array(
				'user_login'   => $login,
				'user_pass'    => $password,
				'display_name' => $f['name'],
				'role'         => MM_MEMBER_ROLE,
			)
		);
		if ( is_wp_error( $user_id ) ) {
			MM_Photos::delete_files( $photos );
			return 'சேமிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.';
		}

		$row            = self::to_db( $f );
		$row['user_id'] = $user_id;
		$row['photos']  = wp_json_encode( $photos );
		$profile_id     = MM_DB::insert_profile( $row );
		if ( ! $profile_id ) {
			require_once ABSPATH . 'wp-admin/includes/user.php';
			wp_delete_user( $user_id );
			MM_Photos::delete_files( $photos );
			return 'சேமிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.';
		}
		MM_DB::ensure_member( $user_id );
		return $profile_id;
	}
}

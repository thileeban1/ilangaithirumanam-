<?php
/**
 * Profile photos.
 *
 * Photos are NOT added to the WordPress media library (whose files are public
 * to anyone with the URL). They're resized to at most 480px, saved under
 * wp-content/uploads/mm-private/ with random file names, and only ever sent
 * to the browser through ?mm_photo=… after PHP checks the viewer is an
 * admin, the profile's owner, or a member who spent a photo credit on it.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MM_Photos {

	public static function init() {
		add_action( 'init', array( __CLASS__, 'maybe_serve' ) );
	}

	public static function dir() {
		$uploads = wp_upload_dir( null, false );
		return trailingslashit( $uploads['basedir'] ) . 'mm-private';
	}

	public static function ensure_private_dir() {
		$dir = self::dir();
		if ( ! is_dir( $dir ) ) {
			wp_mkdir_p( $dir );
		}
		// Apache honours this; on nginx the random, unlisted file names are
		// what keeps photos from being guessed (see readme for an nginx rule).
		if ( ! file_exists( $dir . '/.htaccess' ) ) {
			file_put_contents( $dir . '/.htaccess', "Require all denied\nDeny from all\n" );
		}
		if ( ! file_exists( $dir . '/index.php' ) ) {
			file_put_contents( $dir . '/index.php', "<?php\n// Silence is golden.\n" );
		}
	}

	/**
	 * Saves uploaded images from $_FILES[$field] (multiple) as resized JPEGs.
	 *
	 * @return array{0: string[], 1: string} [saved file names, error message or '']
	 */
	public static function save_uploads( $field, $max_new ) {
		$saved = array();
		if ( $max_new <= 0 || empty( $_FILES[ $field ] ) || ! is_array( $_FILES[ $field ]['name'] ) ) {
			return array( $saved, '' );
		}
		self::ensure_private_dir();
		$files = $_FILES[ $field ]; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput -- validated below.
		$count = count( $files['name'] );
		for ( $i = 0; $i < $count && count( $saved ) < $max_new; $i++ ) {
			if ( UPLOAD_ERR_NO_FILE === (int) $files['error'][ $i ] ) {
				continue;
			}
			$tmp = $files['tmp_name'][ $i ];
			if ( UPLOAD_ERR_OK !== (int) $files['error'][ $i ] || ! is_uploaded_file( $tmp ) ) {
				return array( $saved, 'புகைப்படத்தை சேர்க்க முடியவில்லை. வேறு படத்தை முயற்சிக்கவும்.' );
			}
			$type = wp_check_filetype_and_ext( $tmp, $files['name'][ $i ] );
			if ( empty( $type['type'] ) || 0 !== strpos( $type['type'], 'image/' ) ) {
				return array( $saved, 'படக் கோப்புகள் (JPG/PNG/WEBP) மட்டுமே பதிவேற்ற முடியும்.' );
			}
			$editor = wp_get_image_editor( $tmp );
			if ( is_wp_error( $editor ) ) {
				return array( $saved, 'புகைப்படத்தை சேர்க்க முடியவில்லை. வேறு படத்தை முயற்சிக்கவும்.' );
			}
			$editor->resize( MM_MAX_PHOTO_DIM, MM_MAX_PHOTO_DIM, false );
			$editor->set_quality( MM_PHOTO_QUALITY );
			$name   = wp_generate_password( 32, false ) . '.jpg';
			$result = $editor->save( self::dir() . '/' . $name, 'image/jpeg' );
			if ( is_wp_error( $result ) ) {
				return array( $saved, 'புகைப்படத்தை சேமிக்க முடியவில்லை.' );
			}
			$saved[] = $name;
		}
		return array( $saved, '' );
	}

	public static function delete_files( $names ) {
		foreach ( (array) $names as $name ) {
			$name = basename( (string) $name );
			if ( $name && file_exists( self::dir() . '/' . $name ) ) {
				wp_delete_file( self::dir() . '/' . $name );
			}
		}
	}

	public static function url( $profile_id, $index ) {
		return add_query_arg(
			array(
				'mm_photo' => (int) $profile_id,
				'n'        => (int) $index,
			),
			home_url( '/' )
		);
	}

	public static function maybe_serve() {
		if ( ! isset( $_GET['mm_photo'] ) ) {
			return;
		}
		$profile = MM_DB::get_profile( absint( $_GET['mm_photo'] ) );
		$index   = isset( $_GET['n'] ) ? absint( $_GET['n'] ) : 0;
		if ( ! $profile || ! MM_DB::can_see_identity( $profile, get_current_user_id() ) ) {
			status_header( 403 );
			exit;
		}
		$photos = MM_DB::photos_of( $profile );
		$file   = isset( $photos[ $index ] ) ? self::dir() . '/' . basename( $photos[ $index ] ) : '';
		if ( ! $file || ! is_readable( $file ) ) {
			status_header( 404 );
			exit;
		}
		nocache_headers();
		header( 'Content-Type: image/jpeg' );
		header( 'Content-Length: ' . filesize( $file ) );
		header( 'Cache-Control: private, no-store, max-age=0' );
		header( 'Content-Disposition: inline; filename="photo.jpg"' );
		header( 'X-Content-Type-Options: nosniff' );
		readfile( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		exit;
	}
}

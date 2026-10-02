<?php
/**
 * Public site: the [madhi_matrimony] shortcode renders every visitor/member
 * screen (home, register, login, dashboard, search, profile, interests),
 * picked by the ?mm= query arg. Form posts are handled on template_redirect,
 * before any output, so they can log people in and redirect.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MM_Frontend {

	const SCREENS = array( 'home', 'register', 'registered', 'login', 'dashboard', 'browse', 'profile', 'interests' );
	const MEMBER_SCREENS = array( 'registered', 'dashboard', 'browse', 'profile', 'interests' );

	/** Error message from a POST that re-renders the same form. */
	private static $error = '';

	public static function init() {
		add_shortcode( 'madhi_matrimony', array( __CLASS__, 'shortcode' ) );
		add_action( 'template_redirect', array( __CLASS__, 'handle_request' ) );
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue' ) );
	}

	/** Creates the page that hosts the shortcode, once. */
	public static function ensure_page() {
		$page_id = (int) get_option( 'mm_page_id' );
		if ( $page_id && get_post_status( $page_id ) ) {
			return;
		}
		$page_id = wp_insert_post(
			array(
				'post_title'   => 'திருமண மையம்',
				'post_name'    => 'matrimony',
				'post_content' => '<!-- wp:shortcode -->[madhi_matrimony]<!-- /wp:shortcode -->',
				'post_status'  => 'publish',
				'post_type'    => 'page',
			)
		);
		if ( $page_id && ! is_wp_error( $page_id ) ) {
			update_option( 'mm_page_id', $page_id );
		}
	}

	public static function base_url() {
		$page_id = (int) get_option( 'mm_page_id' );
		$url     = $page_id ? get_permalink( $page_id ) : '';
		return $url ? $url : home_url( '/' );
	}

	public static function url( $screen = 'home', $args = array() ) {
		$args = 'home' === $screen ? $args : array_merge( array( 'mm' => $screen ), $args );
		return add_query_arg( $args, self::base_url() );
	}

	public static function current_screen() {
		$screen = isset( $_GET['mm'] ) ? sanitize_key( wp_unslash( $_GET['mm'] ) ) : 'home';
		return in_array( $screen, self::SCREENS, true ) ? $screen : 'home';
	}

	public static function enqueue() {
		if ( ! is_singular() || ! has_shortcode( (string) get_post_field( 'post_content', get_queried_object_id() ), 'madhi_matrimony' ) ) {
			return;
		}
		wp_enqueue_style( 'mm-fonts', 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Noto+Sans+Tamil:wght@400;500;600;700&display=swap', array(), null );
		wp_enqueue_style( 'mm', MM_URL . 'assets/mm.css', array(), MM_VERSION );
		wp_enqueue_script( 'mm', MM_URL . 'assets/mm.js', array(), MM_VERSION, true );
	}

	// ---------- flash messages (survive one redirect) ----------

	public static function flash( $msg, $type = 'ok' ) {
		$uid = get_current_user_id();
		if ( $uid ) {
			set_transient( 'mm_flash_' . $uid, array( $msg, $type ), 60 );
		}
	}

	public static function take_flash() {
		$uid = get_current_user_id();
		if ( ! $uid ) {
			return null;
		}
		$f = get_transient( 'mm_flash_' . $uid );
		if ( $f ) {
			delete_transient( 'mm_flash_' . $uid );
		}
		return $f ? $f : null;
	}

	private static function redirect( $url ) {
		wp_safe_redirect( $url );
		exit;
	}

	// ---------- request handling ----------

	public static function handle_request() {
		if ( isset( $_GET['mm_logout'] ) ) {
			if ( wp_verify_nonce( sanitize_text_field( wp_unslash( $_GET['mm_logout'] ) ), 'mm_logout' ) ) {
				wp_logout();
			}
			self::redirect( self::url() );
		}

		if ( 'POST' === ( isset( $_SERVER['REQUEST_METHOD'] ) ? $_SERVER['REQUEST_METHOD'] : '' ) && isset( $_POST['mm_action'] ) ) {
			$action = sanitize_key( wp_unslash( $_POST['mm_action'] ) );
			if ( ! isset( $_POST['_mmnonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['_mmnonce'] ) ), 'mm_' . $action ) ) {
				self::$error = 'அமர்வு காலாவதியானது. பக்கத்தை refresh செய்து மீண்டும் முயற்சிக்கவும்.';
				return;
			}
			$method = 'action_' . $action;
			if ( method_exists( __CLASS__, $method ) ) {
				self::$method();
			}
			return;
		}

		// Member-only screens bounce guests to the login screen.
		if ( isset( $_GET['mm'] ) && in_array( self::current_screen(), self::MEMBER_SCREENS, true ) && ! is_user_logged_in() ) {
			self::redirect( self::url( 'login' ) );
		}
	}

	private static function action_register() {
		if ( is_user_logged_in() ) {
			self::redirect( self::url( 'dashboard' ) );
		}
		$f        = MM_Members::posted_profile();
		$password = isset( $_POST['password'] ) ? (string) wp_unslash( $_POST['password'] ) : ''; // phpcs:ignore -- passwords are not sanitized.
		$confirm  = isset( $_POST['password_confirm'] ) ? (string) wp_unslash( $_POST['password_confirm'] ) : ''; // phpcs:ignore
		$result   = MM_Members::register( $f, $password, $confirm );
		if ( is_string( $result ) ) {
			self::$error = $result;
			return;
		}
		$user = get_user_by( 'login', mm_login_from_phone( $f['phone'] ) );
		wp_set_current_user( $user->ID );
		wp_set_auth_cookie( $user->ID, true );
		self::redirect( self::url( 'registered' ) );
	}

	private static function action_login() {
		$phone    = isset( $_POST['phone'] ) ? sanitize_text_field( wp_unslash( $_POST['phone'] ) ) : '';
		$password = isset( $_POST['password'] ) ? (string) wp_unslash( $_POST['password'] ) : ''; // phpcs:ignore
		if ( '' === trim( $phone ) || '' === $password ) {
			self::$error = 'தொடர்பு எண் மற்றும் கடவுச்சொல்லை உள்ளிடவும்.';
			return;
		}
		$user = wp_signon(
			array(
				'user_login'    => mm_login_from_phone( $phone ),
				'user_password' => $password,
				'remember'      => true,
			),
			is_ssl()
		);
		if ( is_wp_error( $user ) ) {
			self::$error = 'தொடர்பு எண் அல்லது கடவுச்சொல் தவறு.';
			return;
		}
		self::redirect( self::url( 'dashboard' ) );
	}

	private static function require_member() {
		if ( ! is_user_logged_in() ) {
			self::redirect( self::url( 'login' ) );
		}
		return get_current_user_id();
	}

	private static function action_save_profile() {
		$uid     = self::require_member();
		$profile = MM_DB::get_profile_by_user( $uid );
		if ( ! $profile ) {
			self::redirect( self::url( 'dashboard' ) );
		}
		$f = MM_Members::posted_profile();
		if ( '' === trim( $f['name'] ) || '' === $f['gender'] || '' === trim( $f['phone'] ) ) {
			self::$error = 'பெயர், பாலினம், தொடர்பு எண் ஆகியவற்றை நிரப்பவும்.';
			return;
		}
		$remove = isset( $_POST['remove_photo'] ) ? array_map( 'absint', (array) $_POST['remove_photo'] ) : array();
		list( $photos, $drop, $err ) = MM_Members::merge_photos( MM_DB::photos_of( $profile ), $remove, 'mm_photos' );
		if ( $err ) {
			self::$error = $err;
			return;
		}
		// The login stays tied to the phone they registered with; editing the
		// contact number shown to others doesn't change how they log in.
		$row           = MM_Members::to_db( $f );
		$row['photos'] = wp_json_encode( $photos );
		if ( MM_DB::update_profile( $profile->id, $row ) ) {
			MM_Photos::delete_files( $drop );
			wp_update_user( array( 'ID' => $uid, 'display_name' => $f['name'] ) );
			self::flash( 'மாற்றங்கள் சேமிக்கப்பட்டன' );
		} else {
			self::flash( 'சேமிக்க முடியவில்லை.', 'error' );
		}
		self::redirect( self::url( 'dashboard' ) );
	}

	private static function action_unlock() {
		$uid        = self::require_member();
		$profile_id = isset( $_POST['profile_id'] ) ? absint( $_POST['profile_id'] ) : 0;
		$type       = isset( $_POST['unlock_type'] ) && 'phone' === $_POST['unlock_type'] ? 'phone' : 'photo';
		$back       = self::profile_back_arg();
		$target     = MM_DB::get_profile( $profile_id );
		if ( ! $target || 'approved' !== $target->status ) {
			self::redirect( self::url( 'browse' ) );
		}
		$result = MM_DB::unlock( $uid, $profile_id, $type );
		if ( true !== $result ) {
			self::flash( $result, 'error' );
		}
		self::redirect( self::url( 'profile', array( 'id' => $profile_id, 'back' => $back ) ) );
	}

	private static function action_interest() {
		$uid        = self::require_member();
		$profile_id = isset( $_POST['profile_id'] ) ? absint( $_POST['profile_id'] ) : 0;
		$back       = self::profile_back_arg();
		$target     = MM_DB::get_profile( $profile_id );
		$mine       = MM_DB::get_profile_by_user( $uid );
		if ( ! $target || 'approved' !== $target->status || ! $mine || (int) $target->user_id === $uid ) {
			self::redirect( self::url( 'browse' ) );
		}
		$result = MM_DB::add_interest( $uid, $mine->id, $target );
		if ( true === $result ) {
			self::flash( 'உங்கள் விருப்பம் தெரிவிக்கப்பட்டது. அவர்களின் பதிலை "விருப்பங்கள்" பக்கத்தில் பார்க்கலாம்.' );
		} else {
			self::flash( $result, 'error' );
		}
		self::redirect( self::url( 'profile', array( 'id' => $profile_id, 'back' => $back ) ) );
	}

	private static function action_respond() {
		$uid    = self::require_member();
		$id     = isset( $_POST['interest_id'] ) ? absint( $_POST['interest_id'] ) : 0;
		$status = isset( $_POST['status'] ) ? sanitize_key( wp_unslash( $_POST['status'] ) ) : '';
		if ( ! MM_DB::respond_interest( $id, $uid, $status ) ) {
			self::flash( 'செயல்படுத்த முடியவில்லை.', 'error' );
		}
		self::redirect( self::url( 'interests' ) );
	}

	private static function profile_back_arg() {
		$back = isset( $_REQUEST['back'] ) ? sanitize_key( wp_unslash( $_REQUEST['back'] ) ) : 'browse';
		return in_array( $back, array( 'browse', 'interests', 'dashboard' ), true ) ? $back : 'browse';
	}

	// ---------- rendering ----------

	public static function render( $template, $vars = array() ) {
		$vars = array_merge(
			array(
				'settings' => mm_settings(),
				'packages' => mm_packages(),
				'error'    => self::$error,
			),
			$vars
		);
		extract( $vars, EXTR_SKIP ); // phpcs:ignore WordPress.PHP.DontExtract
		include MM_DIR . 'templates/' . $template . '.php';
	}

	public static function shortcode() {
		ob_start();
		$screen   = self::current_screen();
		$uid      = get_current_user_id();
		$settings = mm_settings();
		$flash    = self::take_flash();

		echo '<div class="mm-app">';
		self::render( 'header' );
		if ( $flash ) {
			printf( '<div class="%s">%s</div>', 'error' === $flash[1] ? 'mm-err' : 'mm-flash', esc_html( $flash[0] ) );
		}

		if ( in_array( $screen, self::MEMBER_SCREENS, true ) && ! $uid ) {
			$screen = 'login';
		}
		$my_profile = $uid ? MM_DB::get_profile_by_user( $uid ) : null;
		$vars       = array(
			'uid'        => $uid,
			'my_profile' => $my_profile,
			'member'     => $uid ? MM_DB::get_member( $uid ) : null,
			'watermark'  => mm_is_admin() ? 'ADMIN' : ( $my_profile ? 'ID ' . $my_profile->member_id : 'GUEST' ),
		);

		switch ( $screen ) {
			case 'register':
				self::render( 'register', $vars + array( 'values' => self::$error ? MM_Members::posted_profile() : mm_empty_profile() ) );
				break;
			case 'login':
				self::render( 'login', $vars + array( 'phone' => isset( $_POST['phone'] ) ? sanitize_text_field( wp_unslash( $_POST['phone'] ) ) : '' ) );
				break;
			case 'registered':
				self::render( 'registered', $vars );
				break;
			case 'dashboard':
				$editing = isset( $_GET['edit'] ) || ( self::$error && isset( $_POST['mm_action'] ) && 'save_profile' === $_POST['mm_action'] );
				$values  = $my_profile ? MM_Members::from_db( $my_profile ) : mm_empty_profile();
				if ( self::$error && isset( $_POST['mm_action'] ) ) {
					$values = MM_Members::posted_profile();
				}
				self::render(
					'dashboard',
					$vars + array(
						'editing'       => $editing && $my_profile,
						'values'        => $values,
						'interest_count' => $uid ? count( MM_DB::interests_sent( $uid ) ) + count( MM_DB::interests_received( $uid ) ) : 0,
						'filters'       => self::filters(),
					)
				);
				self::render( 'bottom-nav', array( 'active' => 'dashboard' ) );
				break;
			case 'browse':
				$filters = self::filters();
				$page    = isset( $_GET['pg'] ) ? max( 1, absint( $_GET['pg'] ) ) : 1;
				list( $rows, $total ) = MM_DB::search( $filters, $page );
				self::render(
					'browse',
					$vars + array(
						'filters'  => $filters,
						'rows'     => $rows,
						'total'    => $total,
						'page'     => $page,
						'unlocked' => MM_DB::unlocked_ids( $uid, 'photo' ),
					)
				);
				self::render( 'bottom-nav', array( 'active' => 'browse' ) );
				break;
			case 'profile':
				$p = MM_DB::get_profile( isset( $_GET['id'] ) ? absint( $_GET['id'] ) : 0 );
				if ( ! $p || ( 'approved' !== $p->status && (int) $p->user_id !== $uid && ! mm_is_admin() ) ) {
					echo '<div class="mm-card"><p class="mm-muted">சுயவிவரம் காணப்படவில்லை.</p></div>';
					break;
				}
				self::render(
					'profile',
					$vars + array(
						'p'            => $p,
						'back'         => self::profile_back_arg(),
						'show_identity' => MM_DB::can_see_identity( $p, $uid ),
						'show_contact' => MM_DB::can_see_contact( $p, $uid ),
						'sent'         => MM_DB::interest_sent( $uid, $p->id ),
					)
				);
				break;
			case 'interests':
				$received = MM_DB::interests_received( $uid );
				$sent     = MM_DB::interests_sent( $uid );
				$ids      = array_merge( wp_list_pluck( $received, 'requester_profile_id' ), wp_list_pluck( $sent, 'profile_id' ) );
				self::render(
					'interests',
					$vars + array(
						'received' => $received,
						'sent'     => $sent,
						'profiles' => MM_DB::get_profiles_by_ids( $ids ),
					)
				);
				self::render( 'bottom-nav', array( 'active' => 'interests' ) );
				break;
			default:
				self::render( 'home', $vars );
		}
		echo '</div>';
		return ob_get_clean();
	}

	public static function filters() {
		$f = array();
		foreach ( array( 'gender', 'religion', 'marital_status', 'district', 'profession', 'education' ) as $k ) {
			$f[ $k ] = isset( $_GET[ $k ] ) ? sanitize_text_field( wp_unslash( $_GET[ $k ] ) ) : '';
		}
		foreach ( array( 'min_age', 'max_age' ) as $k ) {
			$f[ $k ] = isset( $_GET[ $k ] ) && '' !== $_GET[ $k ] ? (string) min( 120, absint( $_GET[ $k ] ) ) : '';
		}
		return $f;
	}

	/** Hidden fields every front-end form needs. */
	public static function form_fields( $action ) {
		printf( '<input type="hidden" name="mm_action" value="%s">', esc_attr( $action ) );
		wp_nonce_field( 'mm_' . $action, '_mmnonce', false );
	}

	public static function logout_url() {
		return add_query_arg( 'mm_logout', wp_create_nonce( 'mm_logout' ), self::base_url() );
	}

	/** Shared <select> renderer. */
	public static function select( $name, $options, $value, $placeholder = 'தேர்ந்தெடுக்கவும்', $attrs = '' ) {
		printf( '<select class="mm-input" name="%s" %s>', esc_attr( $name ), $attrs ); // phpcs:ignore -- $attrs is a literal from templates.
		printf( '<option value="">%s</option>', esc_html( $placeholder ) );
		foreach ( $options as $o ) {
			printf( '<option value="%s"%s>%s</option>', esc_attr( $o ), selected( $value, $o, false ), esc_html( $o ) );
		}
		echo '</select>';
	}
}

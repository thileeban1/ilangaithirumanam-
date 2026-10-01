<?php
/**
 * wp-admin screens: review registrations (pending / approved / rejected),
 * edit any profile and assign packages, see interests (matches first), and
 * edit site + package settings. Replaces the React app's "நிர்வாகி பலகை".
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MM_Admin {

	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue' ) );
		foreach ( array( 'status', 'delete', 'save_profile', 'package', 'delete_interest', 'settings' ) as $a ) {
			add_action( 'admin_post_mm_' . $a, array( __CLASS__, 'post_' . $a ) );
		}
	}

	public static function cap() {
		return current_user_can( MM_ADMIN_CAP ) ? MM_ADMIN_CAP : 'manage_options';
	}

	public static function menu() {
		$counts  = MM_DB::count_by_status();
		$pending = $counts['pending'] ? ' <span class="awaiting-mod">' . (int) $counts['pending'] . '</span>' : '';
		add_menu_page( 'Matrimony', 'Matrimony' . $pending, self::cap(), 'mm-profiles', array( __CLASS__, 'page_profiles' ), 'dashicons-heart', 26 );
		add_submenu_page( 'mm-profiles', 'சுயவிவரங்கள்', 'சுயவிவரங்கள்', self::cap(), 'mm-profiles', array( __CLASS__, 'page_profiles' ) );
		add_submenu_page( 'mm-profiles', 'விருப்பங்கள்', 'விருப்பங்கள் (Interests)', self::cap(), 'mm-interests', array( __CLASS__, 'page_interests' ) );
		add_submenu_page( 'mm-profiles', 'அமைப்புகள்', 'அமைப்புகள் / Packages', self::cap(), 'mm-settings', array( __CLASS__, 'page_settings' ) );
	}

	public static function enqueue( $hook ) {
		if ( false === strpos( (string) $hook, 'mm-' ) ) {
			return;
		}
		wp_enqueue_style( 'mm', MM_URL . 'assets/mm.css', array(), MM_VERSION );
		wp_enqueue_style( 'mm-admin', MM_URL . 'assets/mm-admin.css', array( 'mm' ), MM_VERSION );
		wp_enqueue_script( 'mm', MM_URL . 'assets/mm.js', array(), MM_VERSION, true );
	}

	// ---------- helpers ----------

	private static function guard( $nonce_action ) {
		if ( ! mm_is_admin() ) {
			wp_die( 'அனுமதி இல்லை.', 403 );
		}
		check_admin_referer( $nonce_action );
	}

	private static function back( $page, $args = array(), $msg = '' ) {
		$args = array_merge( array( 'page' => $page ), $args );
		if ( $msg ) {
			$args['mm_msg'] = rawurlencode( $msg );
		}
		wp_safe_redirect( add_query_arg( $args, admin_url( 'admin.php' ) ) );
		exit;
	}

	private static function notice() {
		if ( empty( $_GET['mm_msg'] ) ) {
			return;
		}
		$msg   = sanitize_text_field( rawurldecode( wp_unslash( $_GET['mm_msg'] ) ) );
		$error = 0 === strpos( $msg, '!' );
		printf( '<div class="notice notice-%s is-dismissible"><p>%s</p></div>', $error ? 'error' : 'success', esc_html( ltrim( $msg, '!' ) ) );
	}

	private static function action_url( $action, $args ) {
		return wp_nonce_url( add_query_arg( array_merge( array( 'action' => 'mm_' . $action ), $args ), admin_url( 'admin-post.php' ) ), 'mm_' . $action . '_' . ( isset( $args['id'] ) ? (int) $args['id'] : 0 ) );
	}

	// ---------- profiles ----------

	public static function page_profiles() {
		if ( isset( $_GET['edit'] ) ) {
			self::page_edit( absint( $_GET['edit'] ) );
			return;
		}
		$tab    = isset( $_GET['tab'] ) ? sanitize_key( wp_unslash( $_GET['tab'] ) ) : 'pending';
		$tab    = in_array( $tab, array( 'pending', 'approved', 'rejected' ), true ) ? $tab : 'pending';
		$counts = MM_DB::count_by_status();
		$rows   = MM_DB::list_by_status( $tab );
		$labels = array( 'pending' => 'பரிசீலனையில்', 'approved' => 'ஏற்கப்பட்டவை', 'rejected' => 'நிராகரிக்கப்பட்டவை' );
		?>
		<div class="wrap">
			<h1 class="wp-heading-inline">சுயவிவரங்களை நிர்வகிக்கவும்</h1>
			<a class="page-title-action" href="<?php echo esc_url( MM_Frontend::base_url() ); ?>" target="_blank">தளத்தை பார்க்க ↗</a>
			<?php self::notice(); ?>
			<nav class="nav-tab-wrapper">
				<?php foreach ( $labels as $key => $label ) : ?>
					<a class="nav-tab <?php echo $tab === $key ? 'nav-tab-active' : ''; ?>" href="<?php echo esc_url( admin_url( 'admin.php?page=mm-profiles&tab=' . $key ) ); ?>"><?php echo esc_html( $label . ' (' . $counts[ $key ] . ')' ); ?></a>
				<?php endforeach; ?>
			</nav>
			<table class="widefat striped mm-admin-table">
				<thead><tr><th>Profile ID</th><th>பெயர்</th><th>பாலினம்</th><th>வயது / மாவட்டம்</th><th>தொலைபேசி</th><th>Package</th><th>பதிவு</th><th>செயல்கள்</th></tr></thead>
				<tbody>
				<?php if ( ! $rows ) : ?>
					<tr><td colspan="8">சுயவிவரங்கள் இல்லை.</td></tr>
				<?php endif; ?>
				<?php foreach ( $rows as $p ) : ?>
					<?php $member = MM_DB::get_member( $p->user_id ); ?>
					<tr>
						<td><strong><?php echo esc_html( $p->member_id ); ?></strong></td>
						<td>
							<?php $photos = MM_DB::photos_of( $p ); ?>
							<?php if ( $photos ) : ?>
								<img class="mm-admin-thumb" src="<?php echo esc_url( MM_Photos::url( $p->id, 0 ) ); ?>" alt="">
							<?php endif; ?>
							<a href="<?php echo esc_url( admin_url( 'admin.php?page=mm-profiles&edit=' . $p->id ) ); ?>"><?php echo esc_html( $p->name ); ?></a>
						</td>
						<td><?php echo esc_html( $p->gender ); ?></td>
						<td><?php echo esc_html( mm_profile_summary( $p, false ) ); ?></td>
						<td><?php echo esc_html( $p->phone ); ?></td>
						<td><?php echo esc_html( $member->package ? mm_package_label( $member->package ) . ( MM_DB::package_active( $member ) ? '' : ' (காலாவதி)' ) : '—' ); ?></td>
						<td><?php echo esc_html( mm_fmt_date( $p->created_at ) ); ?></td>
						<td class="mm-actions">
							<?php if ( 'approved' !== $p->status ) : ?>
								<a class="mm-ok" href="<?php echo esc_url( self::action_url( 'status', array( 'id' => $p->id, 'status' => 'approved', 'tab' => $tab ) ) ); ?>">ஏற்றுக்கொள்</a>
							<?php endif; ?>
							<?php if ( 'rejected' === $p->status ) : ?>
								<a href="<?php echo esc_url( self::action_url( 'status', array( 'id' => $p->id, 'status' => 'pending', 'tab' => $tab ) ) ); ?>">மீண்டும் பரிசீலி</a>
							<?php else : ?>
								<a class="mm-danger" href="<?php echo esc_url( self::action_url( 'status', array( 'id' => $p->id, 'status' => 'rejected', 'tab' => $tab ) ) ); ?>">நிராகரி</a>
							<?php endif; ?>
							<a href="<?php echo esc_url( admin_url( 'admin.php?page=mm-profiles&edit=' . $p->id ) ); ?>">திருத்து / Package</a>
							<a class="mm-danger" onclick="return confirm('இந்த சுயவிவரத்தை நிரந்தரமாக நீக்கவா?');" href="<?php echo esc_url( self::action_url( 'delete', array( 'id' => $p->id, 'tab' => $tab ) ) ); ?>">நீக்கு</a>
						</td>
					</tr>
				<?php endforeach; ?>
				</tbody>
			</table>
		</div>
		<?php
	}

	private static function page_edit( $id ) {
		$p = MM_DB::get_profile( $id );
		echo '<div class="wrap">';
		if ( ! $p ) {
			echo '<h1>சுயவிவரம் காணப்படவில்லை</h1></div>';
			return;
		}
		$member   = MM_DB::get_member( $p->user_id );
		$statuses = mm_status_labels();
		$urls     = array();
		foreach ( MM_DB::photos_of( $p ) as $i => $name ) {
			$urls[] = MM_Photos::url( $p->id, $i );
		}
		$user = get_userdata( $p->user_id );
		?>
		<h1>Profile <?php echo esc_html( $p->member_id ); ?> — <?php echo esc_html( $p->name ); ?></h1>
		<p>
			நிலை: <strong><?php echo esc_html( isset( $statuses[ $p->status ] ) ? $statuses[ $p->status ] : $p->status ); ?></strong>
			<?php if ( $user ) : ?>
				&nbsp;•&nbsp; Login: <code><?php echo esc_html( $user->user_login ); ?></code>
				&nbsp;•&nbsp; <a href="<?php echo esc_url( get_edit_user_link( $user->ID ) ); ?>">கடவுச்சொல் மாற்ற (WP user)</a>
			<?php endif; ?>
			&nbsp;•&nbsp; <a href="<?php echo esc_url( MM_Frontend::url( 'profile', array( 'id' => $p->id ) ) ); ?>" target="_blank">தளத்தில் பார்க்க ↗</a>
			&nbsp;•&nbsp; <a href="<?php echo esc_url( admin_url( 'admin.php?page=mm-profiles&tab=' . $p->status ) ); ?>">← பட்டியலுக்கு</a>
		</p>
		<?php self::notice(); ?>

		<div class="mm-admin-cols">
			<form class="mm-app mm-admin-box" method="post" enctype="multipart/form-data" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="mm_save_profile">
				<input type="hidden" name="id" value="<?php echo (int) $p->id; ?>">
				<?php wp_nonce_field( 'mm_save_profile_' . $p->id ); ?>
				<?php MM_Frontend::render( 'profile-fields', array( 'values' => MM_Members::from_db( $p ), 'photo_urls' => $urls ) ); ?>
				<button class="mm-btn-primary" type="submit">சேமிக்க</button>
			</form>

			<div class="mm-app mm-admin-box">
				<div class="mm-eyebrow">Package நிலை</div>
				<div class="mm-info-value">
					<?php
					if ( $member->package ) {
						echo esc_html( mm_package_label( $member->package ) . ' (' . mm_fmt_date( $member->package_expires_at ) . ' வரை)' );
						if ( ! MM_DB::package_active( $member ) ) {
							echo ' — <strong class="mm-danger-text">காலாவதியானது</strong>';
						}
					} else {
						echo 'இல்லை';
					}
					?>
				</div>
				<?php if ( $member->package ) : ?>
					<p class="mm-muted mm-small">Photo: <?php echo (int) ( $member->photo_quota - $member->photo_used ); ?>/<?php echo (int) $member->photo_quota; ?> • Phone: <?php echo (int) ( $member->phone_quota - $member->phone_used ); ?>/<?php echo (int) $member->phone_quota; ?></p>
				<?php endif; ?>
				<p class="mm-muted mm-small">Package கொடுத்தால் quota + காலாவதி தேதி தானாக அமையும் (பழைய credits reset ஆகும்).</p>
				<div class="mm-pkg-buttons">
					<?php foreach ( mm_packages() as $key => $pkg ) : ?>
						<a class="mm-btn-ghost mm-btn-auto" href="<?php echo esc_url( self::action_url( 'package', array( 'id' => $p->id, 'pkg' => $key ) ) ); ?>"><?php echo esc_html( $pkg['label'] ); ?> கொடு</a>
					<?php endforeach; ?>
					<?php if ( $member->package ) : ?>
						<a class="mm-danger" onclick="return confirm('Package-ஐ நீக்கவா?');" href="<?php echo esc_url( self::action_url( 'package', array( 'id' => $p->id, 'pkg' => '' ) ) ); ?>">நீக்கு</a>
					<?php endif; ?>
				</div>

				<div class="mm-eyebrow mm-mt-lg">நிலை மாற்ற</div>
				<div class="mm-pkg-buttons">
					<?php foreach ( array( 'approved' => 'ஏற்றுக்கொள்', 'pending' => 'பரிசீலனைக்கு', 'rejected' => 'நிராகரி' ) as $s => $label ) : ?>
						<?php if ( $s !== $p->status ) : ?>
							<a class="mm-btn-ghost mm-btn-auto" href="<?php echo esc_url( self::action_url( 'status', array( 'id' => $p->id, 'status' => $s, 'edit' => 1 ) ) ); ?>"><?php echo esc_html( $label ); ?></a>
						<?php endif; ?>
					<?php endforeach; ?>
				</div>
			</div>
		</div>
		</div>
		<?php
	}

	public static function post_status() {
		$id = isset( $_GET['id'] ) ? absint( $_GET['id'] ) : 0;
		self::guard( 'mm_status_' . $id );
		$status = isset( $_GET['status'] ) ? sanitize_key( wp_unslash( $_GET['status'] ) ) : '';
		$tab    = isset( $_GET['tab'] ) ? sanitize_key( wp_unslash( $_GET['tab'] ) ) : 'pending';
		$msgs   = array(
			'approved' => 'சுயவிவரம் ஏற்றுக்கொள்ளப்பட்டது',
			'rejected' => 'சுயவிவரம் நிராகரிக்கப்பட்டது',
			'pending'  => 'மீண்டும் பரிசீலனைக்கு அனுப்பப்பட்டது',
		);
		$msg = isset( $msgs[ $status ] ) && MM_DB::update_profile( $id, array( 'status' => $status ) ) ? $msgs[ $status ] : '!செயல்படுத்த முடியவில்லை.';
		if ( ! empty( $_GET['edit'] ) ) {
			self::back( 'mm-profiles', array( 'edit' => $id ), $msg );
		}
		self::back( 'mm-profiles', array( 'tab' => $tab ), $msg );
	}

	public static function post_delete() {
		$id = isset( $_GET['id'] ) ? absint( $_GET['id'] ) : 0;
		self::guard( 'mm_delete_' . $id );
		$p   = MM_DB::get_profile( $id );
		$tab = isset( $_GET['tab'] ) ? sanitize_key( wp_unslash( $_GET['tab'] ) ) : 'pending';
		if ( $p && MM_DB::delete_profile( $id ) ) {
			MM_Photos::delete_files( MM_DB::photos_of( $p ) );
			// The member's login account is removed too, so the phone number
			// can register again. Never touches admins.
			$user = get_userdata( $p->user_id );
			if ( $user && MM_Members::is_member_only( $user ) ) {
				require_once ABSPATH . 'wp-admin/includes/user.php';
				wp_delete_user( $user->ID );
				global $wpdb;
				$wpdb->delete( MM_DB::members(), array( 'user_id' => $user->ID ) );
				$wpdb->delete( MM_DB::unlocks(), array( 'user_id' => $user->ID ) );
				$wpdb->delete( MM_DB::interests(), array( 'requester_user_id' => $user->ID ) );
			}
			self::back( 'mm-profiles', array( 'tab' => $tab ), 'நீக்கப்பட்டது' );
		}
		self::back( 'mm-profiles', array( 'tab' => $tab ), '!நீக்க முடியவில்லை.' );
	}

	public static function post_save_profile() {
		$id = isset( $_POST['id'] ) ? absint( $_POST['id'] ) : 0;
		self::guard( 'mm_save_profile_' . $id );
		$p = MM_DB::get_profile( $id );
		if ( ! $p ) {
			self::back( 'mm-profiles' );
		}
		$f = MM_Members::posted_profile();
		if ( '' === trim( $f['name'] ) || '' === $f['gender'] || '' === trim( $f['phone'] ) ) {
			self::back( 'mm-profiles', array( 'edit' => $id ), '!பெயர், பாலினம், தொடர்பு எண் ஆகியவற்றை நிரப்பவும்.' );
		}
		$remove = isset( $_POST['remove_photo'] ) ? array_map( 'absint', (array) $_POST['remove_photo'] ) : array();
		list( $photos, $drop, $err ) = MM_Members::merge_photos( MM_DB::photos_of( $p ), $remove, 'mm_photos' );
		if ( $err ) {
			self::back( 'mm-profiles', array( 'edit' => $id ), '!' . $err );
		}
		$row           = MM_Members::to_db( $f );
		$row['photos'] = wp_json_encode( $photos );
		if ( MM_DB::update_profile( $id, $row ) ) {
			MM_Photos::delete_files( $drop );
			self::back( 'mm-profiles', array( 'edit' => $id ), 'மாற்றங்கள் சேமிக்கப்பட்டன' );
		}
		self::back( 'mm-profiles', array( 'edit' => $id ), '!சேமிக்க முடியவில்லை.' );
	}

	public static function post_package() {
		$id = isset( $_GET['id'] ) ? absint( $_GET['id'] ) : 0;
		self::guard( 'mm_package_' . $id );
		$p   = MM_DB::get_profile( $id );
		$key = isset( $_GET['pkg'] ) ? sanitize_key( wp_unslash( $_GET['pkg'] ) ) : '';
		if ( ! $p ) {
			self::back( 'mm-profiles' );
		}
		if ( '' === $key ) {
			$msg = MM_DB::clear_package( $p->user_id ) ? 'Package நீக்கப்பட்டது' : '!செயல்படுத்த முடியவில்லை.';
		} else {
			$msg = MM_DB::assign_package( $p->user_id, $key ) ? mm_package_label( $key ) . ' package assign செய்யப்பட்டது' : '!Package assign செய்ய முடியவில்லை.';
		}
		self::back( 'mm-profiles', array( 'edit' => $id ), $msg );
	}

	// ---------- interests ----------

	public static function page_interests() {
		$rows     = MM_DB::all_interests();
		$ids      = array_merge( wp_list_pluck( $rows, 'profile_id' ), wp_list_pluck( $rows, 'requester_profile_id' ) );
		$profiles = MM_DB::get_profiles_by_ids( $ids );
		$labels   = mm_interest_status_labels();
		$matches  = count( wp_list_filter( $rows, array( 'status' => 'accepted' ) ) );
		$who      = function ( $pid ) use ( $profiles ) {
			if ( ! isset( $profiles[ (int) $pid ] ) ) {
				return array( '(நீக்கப்பட்ட சுயவிவரம்)', '', '' );
			}
			$p = $profiles[ (int) $pid ];
			return array( 'Profile ' . $p->member_id, $p->name, $p->phone );
		};
		?>
		<div class="wrap">
			<h1>ஆர்வம் தெரிவித்தவர் (<?php echo count( $rows ); ?>)<?php echo $matches ? ' • 💚 ' . (int) $matches . ' மேட்ச்' : ''; ?></h1>
			<?php self::notice(); ?>
			<?php if ( $matches ) : ?>
				<p class="mm-ok-text"><strong>💚 இருவரும் ஏற்றுக்கொண்ட மேட்ச்கள் முதலில் காட்டப்படுகின்றன.</strong></p>
			<?php endif; ?>
			<table class="widefat striped mm-admin-table">
				<thead><tr><th>அனுப்பியவர்</th><th></th><th>பெறுபவர்</th><th>நிலை</th><th>தேதி</th><th></th></tr></thead>
				<tbody>
				<?php if ( ! $rows ) : ?>
					<tr><td colspan="6">ஆர்வம் தெரிவித்தவர்கள் இல்லை.</td></tr>
				<?php endif; ?>
				<?php foreach ( $rows as $it ) : ?>
					<?php
					list( $from_id, $from_name, $from_phone ) = $who( $it->requester_profile_id );
					list( $to_id, $to_name, $to_phone )       = $who( $it->profile_id );
					$is_match                                 = 'accepted' === $it->status;
					?>
					<tr class="<?php echo $is_match ? 'mm-match-row' : ''; ?>">
						<td><strong><?php echo esc_html( $from_id ); ?></strong><br><?php echo esc_html( $from_name ); ?><br><?php echo esc_html( $from_phone ); ?></td>
						<td>→</td>
						<td><strong><?php echo esc_html( $to_id ); ?></strong><br><?php echo esc_html( $to_name ); ?><br><?php echo esc_html( $to_phone ); ?></td>
						<td><?php echo $is_match ? '💚 மேட்ச் ஆனது — இருவரும் ஏற்றுக்கொண்டனர்' : esc_html( isset( $labels[ $it->status ] ) ? $labels[ $it->status ] : $it->status ); ?></td>
						<td><?php echo esc_html( mm_fmt_date( $it->created_at ) ); ?></td>
						<td><a class="mm-danger" onclick="return confirm('நீக்கவா?');" href="<?php echo esc_url( self::action_url( 'delete_interest', array( 'id' => $it->id ) ) ); ?>">நீக்கு</a></td>
					</tr>
				<?php endforeach; ?>
				</tbody>
			</table>
		</div>
		<?php
	}

	public static function post_delete_interest() {
		$id = isset( $_GET['id'] ) ? absint( $_GET['id'] ) : 0;
		self::guard( 'mm_delete_interest_' . $id );
		self::back( 'mm-interests', array(), MM_DB::delete_interest( $id ) ? 'நீக்கப்பட்டது' : '!நீக்க முடியவில்லை.' );
	}

	// ---------- settings ----------

	public static function page_settings() {
		$s        = mm_settings();
		$packages = mm_packages();
		?>
		<div class="wrap">
			<h1>அமைப்புகள்</h1>
			<?php self::notice(); ?>
			<p>தளப் பக்கம்: <a href="<?php echo esc_url( MM_Frontend::base_url() ); ?>" target="_blank"><?php echo esc_html( MM_Frontend::base_url() ); ?></a> — இதையே முகப்புப் பக்கமாக (homepage) வைக்க: <a href="<?php echo esc_url( admin_url( 'options-reading.php' ) ); ?>">Settings → Reading → A static page</a>.</p>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="mm_settings">
				<?php wp_nonce_field( 'mm_settings_0' ); ?>
				<table class="form-table">
					<tr><th><label for="mm-site-name">தளத்தின் பெயர்</label></th><td><input id="mm-site-name" class="regular-text" name="site_name" value="<?php echo esc_attr( $s['site_name'] ); ?>"></td></tr>
					<tr><th><label for="mm-tagline">Tagline</label></th><td><input id="mm-tagline" class="regular-text" name="tagline" value="<?php echo esc_attr( $s['tagline'] ); ?>"></td></tr>
					<tr><th><label for="mm-wa">நிர்வாகி WhatsApp எண்</label></th><td><input id="mm-wa" class="regular-text" name="admin_whatsapp" value="<?php echo esc_attr( $s['admin_whatsapp'] ); ?>" placeholder="07XXXXXXXX"><p class="description">Package கேட்பவர்கள் இதற்கு மெசேஜ் அனுப்புவார்கள்.</p></td></tr>
				</table>

				<h2>Package அமைப்புகள்</h2>
				<p class="description">ஒவ்வொரு package-ன் விலை, காலம், Photo/Phone unlock எண்ணிக்கையை இங்கே எப்போது வேண்டுமானாலும் மாற்றலாம். ஏற்கனவே package வாங்கிய உறுப்பினர்களை இது பாதிக்காது — புதிதாக assign செய்யும்போது மட்டும் இந்த புது எண்ணிக்கை பயன்படும்.</p>
				<table class="widefat striped mm-admin-table mm-pkg-table">
					<thead><tr><th>Package பெயர்</th><th>விலை (Rs.)</th><th>காலம் (மாதம்)</th><th>Photo Unlocks</th><th>Phone Unlocks</th></tr></thead>
					<tbody>
					<?php foreach ( $packages as $key => $pkg ) : ?>
						<tr>
							<td><input name="packages[<?php echo esc_attr( $key ); ?>][label]" value="<?php echo esc_attr( $pkg['label'] ); ?>"></td>
							<td><input type="number" min="0" name="packages[<?php echo esc_attr( $key ); ?>][price]" value="<?php echo esc_attr( $pkg['price'] ); ?>"></td>
							<td><input type="number" min="1" name="packages[<?php echo esc_attr( $key ); ?>][months]" value="<?php echo esc_attr( $pkg['months'] ); ?>"></td>
							<td><input type="number" min="0" name="packages[<?php echo esc_attr( $key ); ?>][photo_quota]" value="<?php echo esc_attr( $pkg['photo_quota'] ); ?>"></td>
							<td><input type="number" min="0" name="packages[<?php echo esc_attr( $key ); ?>][phone_quota]" value="<?php echo esc_attr( $pkg['phone_quota'] ); ?>"></td>
						</tr>
					<?php endforeach; ?>
					</tbody>
				</table>
				<?php submit_button( 'அமைப்புகளை சேமிக்க' ); ?>
			</form>
		</div>
		<?php
	}

	public static function post_settings() {
		self::guard( 'mm_settings_0' );
		$defaults = mm_default_settings();
		$name     = isset( $_POST['site_name'] ) ? sanitize_text_field( wp_unslash( $_POST['site_name'] ) ) : '';
		update_option(
			'mm_settings',
			array(
				'site_name'      => '' !== trim( $name ) ? $name : $defaults['site_name'],
				'tagline'        => isset( $_POST['tagline'] ) ? sanitize_text_field( wp_unslash( $_POST['tagline'] ) ) : '',
				'admin_whatsapp' => isset( $_POST['admin_whatsapp'] ) ? sanitize_text_field( wp_unslash( $_POST['admin_whatsapp'] ) ) : '',
			)
		);
		$in  = isset( $_POST['packages'] ) && is_array( $_POST['packages'] ) ? wp_unslash( $_POST['packages'] ) : array(); // phpcs:ignore -- sanitized per field below.
		$out = array();
		foreach ( mm_default_packages() as $key => $default ) {
			$d           = isset( $in[ $key ] ) ? (array) $in[ $key ] : array();
			$label       = isset( $d['label'] ) ? sanitize_text_field( $d['label'] ) : '';
			$out[ $key ] = array(
				'label'       => '' !== trim( $label ) ? $label : $default['label'],
				'price'       => isset( $d['price'] ) ? absint( $d['price'] ) : $default['price'],
				'months'      => isset( $d['months'] ) ? max( 1, absint( $d['months'] ) ) : $default['months'],
				'photo_quota' => isset( $d['photo_quota'] ) ? absint( $d['photo_quota'] ) : $default['photo_quota'],
				'phone_quota' => isset( $d['phone_quota'] ) ? absint( $d['phone_quota'] ) : $default['phone_quota'],
			);
		}
		update_option( 'mm_packages', $out );
		self::back( 'mm-settings', array(), 'அமைப்புகள் சேமிக்கப்பட்டன' );
	}
}

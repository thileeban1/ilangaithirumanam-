<?php
/**
 * Plugin Name: Class Portal LMS
 * Description: தரம் / பாடம் / Zoom Link / Recordings / PDF குறிப்புகளை நிர்வகிக்கவும், மாணவர்கள் ஒரு Access Code மூலம் தங்களுக்கான பாடங்களை மட்டும் பார்க்கவும் உதவும் எளிய LMS.
 * Version: 1.0.1
 * Author: Class Portal
 * Text Domain: class-portal-lms
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'CPLMS_VERSION', '1.0.1' );
define( 'CPLMS_PATH', plugin_dir_path( __FILE__ ) );
define( 'CPLMS_URL', plugin_dir_url( __FILE__ ) );

/* ---------------------------------------------------------------------
 * 1. Custom Post Types: Grade, Subject, Student
 * ------------------------------------------------------------------- */

function cplms_register_post_types() {

	register_post_type( 'cp_grade', array(
		'labels' => array(
			'name'          => 'தரங்கள்',
			'singular_name' => 'தரம்',
			'add_new_item'  => 'புதிய தரம் சேர்க்க',
			'edit_item'     => 'தரத்தை திருத்த',
			'menu_name'     => 'தரங்கள்',
		),
		'public'       => false,
		'show_ui'      => true,
		'show_in_menu' => 'class-portal-lms',
		'supports'     => array( 'title' ),
		'menu_icon'    => 'dashicons-welcome-learn-more',
	) );

	register_post_type( 'cp_subject', array(
		'labels' => array(
			'name'          => 'பாடங்கள்',
			'singular_name' => 'பாடம்',
			'add_new_item'  => 'புதிய பாடம் சேர்க்க',
			'edit_item'     => 'பாடத்தை திருத்த',
			'menu_name'     => 'பாடங்கள்',
		),
		'public'       => false,
		'show_ui'      => true,
		'show_in_menu' => 'class-portal-lms',
		'supports'     => array( 'title' ),
	) );

	register_post_type( 'cp_student', array(
		'labels' => array(
			'name'          => 'மாணவர்கள்',
			'singular_name' => 'மாணவர்',
			'add_new_item'  => 'புதிய மாணவர் சேர்க்க',
			'edit_item'     => 'மாணவர் விவரம் திருத்த',
			'menu_name'     => 'மாணவர்கள்',
		),
		'public'       => false,
		'show_ui'      => true,
		'show_in_menu' => 'class-portal-lms',
		'supports'     => array( 'title' ),
	) );
}
add_action( 'init', 'cplms_register_post_types' );

function cplms_admin_menu_root() {
	add_menu_page(
		'Class Portal',
		'Class Portal',
		'edit_posts',
		'class-portal-lms',
		'cplms_settings_page',
		'dashicons-welcome-learn-more',
		25
	);
	add_submenu_page( 'class-portal-lms', 'அமைப்புகள்', 'அமைப்புகள்', 'manage_options', 'class-portal-lms', 'cplms_settings_page' );
}
add_action( 'admin_menu', 'cplms_admin_menu_root' );

/* ---------------------------------------------------------------------
 * 2. Meta boxes
 * ------------------------------------------------------------------- */

function cplms_add_meta_boxes() {
	add_meta_box( 'cp_subject_details', 'பாட விவரங்கள்', 'cplms_subject_meta_box', 'cp_subject', 'normal', 'high' );
	add_meta_box( 'cp_student_details', 'மாணவர் விவரங்கள்', 'cplms_student_meta_box', 'cp_student', 'normal', 'high' );
}
add_action( 'add_meta_boxes', 'cplms_add_meta_boxes' );

function cplms_get_grades() {
	return get_posts( array(
		'post_type'      => 'cp_grade',
		'posts_per_page' => -1,
		'orderby'        => 'title',
		'order'          => 'ASC',
	) );
}

function cplms_subject_meta_box( $post ) {
	wp_nonce_field( 'cplms_save_subject', 'cplms_subject_nonce' );
	$grade_id  = get_post_meta( $post->ID, '_cp_grade_id', true );
	$zoom_link = get_post_meta( $post->ID, '_cp_zoom_link', true );
	$recordings = get_post_meta( $post->ID, '_cp_recordings', true );
	$pdfs       = get_post_meta( $post->ID, '_cp_pdfs', true );
	$grades = cplms_get_grades();
	?>
	<p>
		<label><strong>தரம்</strong></label><br>
		<select name="cp_grade_id" style="min-width:250px">
			<option value="">-- தரம் தேர்ந்தெடுக்கவும் --</option>
			<?php foreach ( $grades as $g ) : ?>
				<option value="<?php echo esc_attr( $g->ID ); ?>" <?php selected( $grade_id, $g->ID ); ?>><?php echo esc_html( $g->post_title ); ?></option>
			<?php endforeach; ?>
		</select>
	</p>
	<p>
		<label><strong>Zoom Link</strong></label><br>
		<input type="url" name="cp_zoom_link" value="<?php echo esc_attr( $zoom_link ); ?>" style="width:100%" placeholder="https://zoom.us/j/...">
	</p>
	<p>
		<label><strong>Recordings</strong> (ஒரு வரிக்கு ஒன்று: <code>தலைப்பு | URL</code>)</label><br>
		<textarea name="cp_recordings" rows="4" style="width:100%" placeholder="வகுப்பு 1 | https://..."><?php echo esc_textarea( $recordings ); ?></textarea>
	</p>
	<p>
		<label><strong>PDF குறிப்புகள்</strong> (ஒரு வரிக்கு ஒன்று: <code>தலைப்பு | URL</code>)</label><br>
		<textarea name="cp_pdfs" rows="4" style="width:100%" placeholder="Notes Chapter 1 | https://..."><?php echo esc_textarea( $pdfs ); ?></textarea>
	</p>
	<?php
}

function cplms_student_meta_box( $post ) {
	wp_nonce_field( 'cplms_save_student', 'cplms_student_nonce' );
	$grade_id    = get_post_meta( $post->ID, '_cp_grade_id', true );
	$access_code = get_post_meta( $post->ID, '_cp_access_code', true );
	$subject_ids = get_post_meta( $post->ID, '_cp_subject_ids', true );
	$subject_ids = is_array( $subject_ids ) ? $subject_ids : array();
	$grades   = cplms_get_grades();
	$subjects = get_posts( array( 'post_type' => 'cp_subject', 'posts_per_page' => -1, 'orderby' => 'title', 'order' => 'ASC' ) );
	?>
	<p>
		<label><strong>தரம்</strong></label><br>
		<select name="cp_grade_id" style="min-width:250px">
			<option value="">-- தரம் தேர்ந்தெடுக்கவும் --</option>
			<?php foreach ( $grades as $g ) : ?>
				<option value="<?php echo esc_attr( $g->ID ); ?>" <?php selected( $grade_id, $g->ID ); ?>><?php echo esc_html( $g->post_title ); ?></option>
			<?php endforeach; ?>
		</select>
	</p>
	<p>
		<label><strong>Access Code</strong></label><br>
		<input type="text" name="cp_access_code" value="<?php echo esc_attr( $access_code ); ?>" placeholder="எ.கா. RAJ2025" required>
		<button type="button" class="button" onclick="document.querySelector('[name=cp_access_code]').value = Math.random().toString(36).substring(2,8).toUpperCase();">Random Generate</button>
	</p>
	<p><strong>அனுமதிக்கப்பட்ட பாடங்கள்</strong></p>
	<div style="max-height:200px; overflow:auto; border:1px solid #ddd; padding:8px;">
		<?php foreach ( $subjects as $s ) : ?>
			<label style="display:block; margin-bottom:4px;">
				<input type="checkbox" name="cp_subject_ids[]" value="<?php echo esc_attr( $s->ID ); ?>" <?php checked( in_array( $s->ID, $subject_ids, true ) ); ?>>
				<?php echo esc_html( $s->post_title ); ?>
			</label>
		<?php endforeach; ?>
		<?php if ( empty( $subjects ) ) : ?>
			<em>முதலில் பாடங்கள் சேர்க்கவும்.</em>
		<?php endif; ?>
	</div>
	<?php
}

function cplms_save_post( $post_id ) {
	if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
		return;
	}

	$post_type = get_post_type( $post_id );

	if ( 'cp_subject' === $post_type && isset( $_POST['cplms_subject_nonce'] ) && wp_verify_nonce( $_POST['cplms_subject_nonce'], 'cplms_save_subject' ) ) {
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}
		update_post_meta( $post_id, '_cp_grade_id', absint( $_POST['cp_grade_id'] ?? 0 ) );
		update_post_meta( $post_id, '_cp_zoom_link', esc_url_raw( wp_unslash( $_POST['cp_zoom_link'] ?? '' ) ) );
		update_post_meta( $post_id, '_cp_recordings', sanitize_textarea_field( wp_unslash( $_POST['cp_recordings'] ?? '' ) ) );
		update_post_meta( $post_id, '_cp_pdfs', sanitize_textarea_field( wp_unslash( $_POST['cp_pdfs'] ?? '' ) ) );
	}

	if ( 'cp_student' === $post_type && isset( $_POST['cplms_student_nonce'] ) && wp_verify_nonce( $_POST['cplms_student_nonce'], 'cplms_save_student' ) ) {
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}
		update_post_meta( $post_id, '_cp_grade_id', absint( $_POST['cp_grade_id'] ?? 0 ) );
		$code = sanitize_text_field( wp_unslash( $_POST['cp_access_code'] ?? '' ) );
		update_post_meta( $post_id, '_cp_access_code', strtoupper( trim( $code ) ) );
		$subject_ids = isset( $_POST['cp_subject_ids'] ) ? array_map( 'absint', (array) $_POST['cp_subject_ids'] ) : array();
		update_post_meta( $post_id, '_cp_subject_ids', $subject_ids );
	}
}
add_action( 'save_post', 'cplms_save_post' );

/* Custom admin list columns */
function cplms_student_columns( $columns ) {
	$columns['cp_access_code'] = 'Access Code';
	$columns['cp_grade']       = 'தரம்';
	return $columns;
}
add_filter( 'manage_cp_student_posts_columns', 'cplms_student_columns' );

function cplms_student_column_content( $column, $post_id ) {
	if ( 'cp_access_code' === $column ) {
		echo esc_html( get_post_meta( $post_id, '_cp_access_code', true ) );
	}
	if ( 'cp_grade' === $column ) {
		$grade_id = get_post_meta( $post_id, '_cp_grade_id', true );
		echo $grade_id ? esc_html( get_the_title( $grade_id ) ) : '—';
	}
}
add_action( 'manage_cp_student_posts_custom_column', 'cplms_student_column_content', 10, 2 );

/* ---------------------------------------------------------------------
 * 3. Settings page (பள்ளி பெயர் / tagline)
 * ------------------------------------------------------------------- */

function cplms_settings_page() {
	if ( isset( $_POST['cplms_settings_nonce'] ) && wp_verify_nonce( $_POST['cplms_settings_nonce'], 'cplms_save_settings' ) && current_user_can( 'manage_options' ) ) {
		update_option( 'cplms_school_name', sanitize_text_field( wp_unslash( $_POST['cplms_school_name'] ?? '' ) ) );
		update_option( 'cplms_tagline', sanitize_text_field( wp_unslash( $_POST['cplms_tagline'] ?? '' ) ) );
		echo '<div class="updated"><p>சேமிக்கப்பட்டது.</p></div>';
	}
	$school_name = get_option( 'cplms_school_name', 'வகுப்பு போர்ட்டல்' );
	$tagline     = get_option( 'cplms_tagline', '' );
	?>
	<div class="wrap">
		<h1>Class Portal LMS — அமைப்புகள்</h1>
		<p>ஒரு பக்கத்தில் (Page) <code>[class_portal]</code> shortcode-ஐ சேர்த்தால், அந்த பக்கத்தில் மாணவர்கள் Access Code மூலம் தங்கள் பாடங்களை பார்க்கும் public பகுதி வந்துவிடும்.</p>
		<form method="post">
			<?php wp_nonce_field( 'cplms_save_settings', 'cplms_settings_nonce' ); ?>
			<table class="form-table">
				<tr>
					<th><label for="cplms_school_name">பள்ளி பெயர்</label></th>
					<td><input type="text" id="cplms_school_name" name="cplms_school_name" value="<?php echo esc_attr( $school_name ); ?>" class="regular-text"></td>
				</tr>
				<tr>
					<th><label for="cplms_tagline">Tagline</label></th>
					<td><input type="text" id="cplms_tagline" name="cplms_tagline" value="<?php echo esc_attr( $tagline ); ?>" class="regular-text"></td>
				</tr>
			</table>
			<?php submit_button( 'சேமிக்க' ); ?>
		</form>
		<hr>
		<h2>Quick Links</h2>
		<ul>
			<li><a href="<?php echo esc_url( admin_url( 'post-new.php?post_type=cp_grade' ) ); ?>">➕ புதிய தரம் சேர்க்க</a></li>
			<li><a href="<?php echo esc_url( admin_url( 'post-new.php?post_type=cp_subject' ) ); ?>">➕ புதிய பாடம் சேர்க்க</a></li>
			<li><a href="<?php echo esc_url( admin_url( 'post-new.php?post_type=cp_student' ) ); ?>">➕ புதிய மாணவர் சேர்க்க</a></li>
		</ul>
	</div>
	<?php
}

/* ---------------------------------------------------------------------
 * 4. Public shortcode: [class_portal]
 * ------------------------------------------------------------------- */

function cplms_enqueue_assets() {
	wp_enqueue_style( 'cplms-style', CPLMS_URL . 'assets/style.css', array(), CPLMS_VERSION );
}
add_action( 'wp_enqueue_scripts', 'cplms_enqueue_assets' );

/**
 * Some free-hosting cache/minify setups strip or delay plugin-enqueued CSS.
 * Printing the same stylesheet inline in <head> guarantees the design shows
 * up regardless of caching plugins on the host.
 */
function cplms_print_inline_style() {
	$css_file = CPLMS_PATH . 'assets/style.css';
	if ( file_exists( $css_file ) ) {
		echo '<style id="cplms-inline-style">' . file_get_contents( $css_file ) . '</style>'; // phpcs:ignore
	}
}
add_action( 'wp_head', 'cplms_print_inline_style', 100 );

function cplms_parse_lines( $raw ) {
	$items = array();
	foreach ( preg_split( "/\r\n|\r|\n/", (string) $raw ) as $line ) {
		$line = trim( $line );
		if ( '' === $line ) {
			continue;
		}
		$parts = array_map( 'trim', explode( '|', $line, 2 ) );
		$items[] = array(
			'label' => $parts[0],
			'url'   => $parts[1] ?? $parts[0],
		);
	}
	return $items;
}

function cplms_shortcode( $atts ) {
	$school_name = get_option( 'cplms_school_name', 'வகுப்பு போர்ட்டல்' );
	$tagline     = get_option( 'cplms_tagline', '' );

	ob_start();

	$student   = null;
	$error     = '';
	$entered_code = '';

	if ( isset( $_POST['cplms_access_code'] ) && isset( $_POST['cplms_nonce'] ) && wp_verify_nonce( $_POST['cplms_nonce'], 'cplms_login' ) ) {
		$entered_code = strtoupper( trim( sanitize_text_field( wp_unslash( $_POST['cplms_access_code'] ) ) ) );
		if ( '' === $entered_code ) {
			$error = 'Access Code உள்ளிடவும்.';
		} else {
			$students = get_posts( array(
				'post_type'      => 'cp_student',
				'posts_per_page' => 1,
				'meta_key'       => '_cp_access_code',
				'meta_value'     => $entered_code,
			) );
			if ( empty( $students ) ) {
				$error = 'தவறான Access Code. மீண்டும் முயற்சிக்கவும்.';
			} else {
				$student = $students[0];
			}
		}
	}
	?>
	<div class="cplms-wrap">
		<header class="cplms-header">
			<h2><?php echo esc_html( $school_name ); ?></h2>
			<?php if ( $tagline ) : ?><p class="cplms-tagline"><?php echo esc_html( $tagline ); ?></p><?php endif; ?>
		</header>

		<?php if ( ! $student ) : ?>
			<form method="post" class="cplms-login-form">
				<?php wp_nonce_field( 'cplms_login', 'cplms_nonce' ); ?>
				<label for="cplms_access_code">உங்கள் Access Code உள்ளிடவும்</label>
				<input type="text" id="cplms_access_code" name="cplms_access_code" value="<?php echo esc_attr( $entered_code ); ?>" placeholder="எ.கா. RAJ2025" required>
				<button type="submit" class="cplms-btn">உள் நுழைய</button>
				<?php if ( $error ) : ?><p class="cplms-error"><?php echo esc_html( $error ); ?></p><?php endif; ?>
			</form>
		<?php else :
			$subject_ids = get_post_meta( $student->ID, '_cp_subject_ids', true );
			$subject_ids = is_array( $subject_ids ) ? $subject_ids : array();
			$subjects    = ! empty( $subject_ids ) ? get_posts( array( 'post_type' => 'cp_subject', 'post__in' => $subject_ids, 'posts_per_page' => -1 ) ) : array();
			?>
			<div class="cplms-student-view">
				<p class="cplms-welcome">வணக்கம், <strong><?php echo esc_html( $student->post_title ); ?></strong>!</p>
				<?php if ( empty( $subjects ) ) : ?>
					<p>இதுவரை உங்களுக்கு பாடங்கள் ஒதுக்கப்படவில்லை.</p>
				<?php endif; ?>
				<div class="cplms-subjects">
					<?php foreach ( $subjects as $subject ) :
						$zoom       = get_post_meta( $subject->ID, '_cp_zoom_link', true );
						$recordings = cplms_parse_lines( get_post_meta( $subject->ID, '_cp_recordings', true ) );
						$pdfs       = cplms_parse_lines( get_post_meta( $subject->ID, '_cp_pdfs', true ) );
						?>
						<div class="cplms-subject-card">
							<h3><?php echo esc_html( $subject->post_title ); ?></h3>
							<?php if ( $zoom ) : ?>
								<p><a class="cplms-btn cplms-btn-zoom" href="<?php echo esc_url( $zoom ); ?>" target="_blank" rel="noopener">🔴 Zoom Class-க்கு செல்ல</a></p>
							<?php endif; ?>
							<?php if ( ! empty( $recordings ) ) : ?>
								<div class="cplms-list">
									<strong>Recordings</strong>
									<ul>
										<?php foreach ( $recordings as $r ) : ?>
											<li><a href="<?php echo esc_url( $r['url'] ); ?>" target="_blank" rel="noopener">▶ <?php echo esc_html( $r['label'] ); ?></a></li>
										<?php endforeach; ?>
									</ul>
								</div>
							<?php endif; ?>
							<?php if ( ! empty( $pdfs ) ) : ?>
								<div class="cplms-list">
									<strong>PDF குறிப்புகள்</strong>
									<ul>
										<?php foreach ( $pdfs as $p ) : ?>
											<li><a href="<?php echo esc_url( $p['url'] ); ?>" target="_blank" rel="noopener">📄 <?php echo esc_html( $p['label'] ); ?></a></li>
										<?php endforeach; ?>
									</ul>
								</div>
							<?php endif; ?>
						</div>
					<?php endforeach; ?>
				</div>
				<p><a href="<?php echo esc_url( get_permalink() ); ?>" class="cplms-logout">← வேறு Access Code உள்ளிட</a></p>
			</div>
		<?php endif; ?>
	</div>
	<?php
	return ob_get_clean();
}
add_shortcode( 'class_portal', 'cplms_shortcode' );

/* ---------------------------------------------------------------------
 * 5. Activation: flush rewrite rules, seed a demo page
 * ------------------------------------------------------------------- */

function cplms_activate() {
	cplms_register_post_types();
	flush_rewrite_rules();

	if ( ! get_page_by_path( 'class-portal' ) ) {
		wp_insert_post( array(
			'post_title'   => 'Class Portal',
			'post_name'    => 'class-portal',
			'post_content' => '[class_portal]',
			'post_status'  => 'publish',
			'post_type'    => 'page',
		) );
	}
}
register_activation_hook( __FILE__, 'cplms_activate' );

function cplms_deactivate() {
	flush_rewrite_rules();
}
register_deactivation_hook( __FILE__, 'cplms_deactivate' );

<?php
/**
 * Plugin Name: Class Portal LMS
 * Description: ஆண்டு / மாதம் / பாடம் / தேதி வாரியாக வகுப்புகளை நிர்வகிக்கவும், மாணவர்கள் ஒரு Access Code மூலம் தங்களுக்கான வகுப்புகளை மட்டும் பார்க்கவும் உதவும் LMS.
 * Version: 1.2.0
 * Author: Class Portal
 * Text Domain: class-portal-lms
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'CPLMS_VERSION', '1.2.0' );
define( 'CPLMS_MAX_RECORDING_VIEWS', 3 );
define( 'CPLMS_PATH', plugin_dir_path( __FILE__ ) );
define( 'CPLMS_URL', plugin_dir_url( __FILE__ ) );

function cplms_month_names() {
	return array(
		1  => 'ஜனவரி',
		2  => 'பெப்ரவரி',
		3  => 'மார்ச்',
		4  => 'ஏப்ரல்',
		5  => 'மே',
		6  => 'ஜூன்',
		7  => 'ஜூலை',
		8  => 'ஆகஸ்ட்',
		9  => 'செப்டெம்பர்',
		10 => 'ஒக்டோபர்',
		11 => 'நவம்பர்',
		12 => 'டிசம்பர்',
	);
}

/* ---------------------------------------------------------------------
 * 1. Custom Post Types: Grade, Subject, Student, Class (session)
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

	register_post_type( 'cp_class', array(
		'labels' => array(
			'name'          => 'வகுப்புகள் (Classes)',
			'singular_name' => 'வகுப்பு',
			'add_new_item'  => 'புதிய வகுப்பு சேர்க்க',
			'edit_item'     => 'வகுப்பை திருத்த',
			'menu_name'     => 'வகுப்புகள்',
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
	add_meta_box( 'cp_class_details', 'வகுப்பு விவரங்கள்', 'cplms_class_meta_box', 'cp_class', 'normal', 'high' );
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

function cplms_get_subjects() {
	return get_posts( array(
		'post_type'      => 'cp_subject',
		'posts_per_page' => -1,
		'orderby'        => 'title',
		'order'          => 'ASC',
	) );
}

function cplms_subject_meta_box( $post ) {
	wp_nonce_field( 'cplms_save_subject', 'cplms_subject_nonce' );
	$grade_id  = get_post_meta( $post->ID, '_cp_grade_id', true );
	$zoom_link = get_post_meta( $post->ID, '_cp_zoom_link', true );
	$icon      = get_post_meta( $post->ID, '_cp_icon', true );
	$grades    = cplms_get_grades();
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
		<label><strong>Icon (emoji)</strong></label><br>
		<input type="text" name="cp_icon" value="<?php echo esc_attr( $icon ? $icon : '📘' ); ?>" style="width:80px" maxlength="4">
	</p>
	<p>
		<label><strong>Zoom Link</strong></label><br>
		<input type="url" name="cp_zoom_link" value="<?php echo esc_attr( $zoom_link ); ?>" style="width:100%" placeholder="https://zoom.us/j/...">
	</p>
	<?php
}

/**
 * Load the WordPress Media Uploader on the Class edit screen and wire up
 * the "Upload" buttons so teachers can pick/upload a file instead of having
 * to know or paste a URL themselves.
 */
function cplms_admin_enqueue_media( $hook ) {
	global $post;
	if ( ! in_array( $hook, array( 'post.php', 'post-new.php' ), true ) || ! $post || 'cp_class' !== $post->post_type ) {
		return;
	}
	wp_enqueue_media();
	$inline_js = <<<'JS'
	jQuery(function ($) {
		$('.cplms-upload-btn').on('click', function (e) {
			e.preventDefault();
			var button = $(this);
			var targetId = button.data('target');
			var fileType = button.data('filetype');
			var frame = wp.media({
				title: 'கோப்பு தேர்ந்தெடுக்கவும் / பதிவேற்றவும்',
				button: { text: 'இதை பயன்படுத்த' },
				library: fileType === 'application/pdf' ? { type: 'application/pdf' } : {},
				multiple: false
			});
			frame.on('select', function () {
				var attachment = frame.state().get('selection').first().toJSON();
				var line = (attachment.title || attachment.filename) + ' | ' + attachment.url;
				var textarea = $('#' + targetId);
				var current = textarea.val();
				textarea.val(current && current.trim() !== '' ? current.replace(/\n$/, '') + '\n' + line : line);
			});
			frame.open();
		});
	});
JS;
	wp_add_inline_script( 'media-editor', $inline_js );
}
add_action( 'admin_enqueue_scripts', 'cplms_admin_enqueue_media' );

function cplms_class_meta_box( $post ) {
	wp_nonce_field( 'cplms_save_class', 'cplms_class_nonce' );
	$year       = get_post_meta( $post->ID, '_cp_year', true );
	$month      = get_post_meta( $post->ID, '_cp_month', true );
	$subject_id = get_post_meta( $post->ID, '_cp_subject_id', true );
	$class_no   = get_post_meta( $post->ID, '_cp_class_number', true );
	$class_date = get_post_meta( $post->ID, '_cp_class_date', true );
	$recordings = get_post_meta( $post->ID, '_cp_recordings', true );
	$duration   = get_post_meta( $post->ID, '_cp_recording_duration', true );
	$view_limit = get_post_meta( $post->ID, '_cp_view_limit', true );
	$pdfs       = get_post_meta( $post->ID, '_cp_pdfs', true );
	$worksheets = get_post_meta( $post->ID, '_cp_worksheets', true );
	$note       = get_post_meta( $post->ID, '_cp_teacher_note', true );
	$subjects   = cplms_get_subjects();
	$months     = cplms_month_names();
	if ( '' === $year ) {
		$year = gmdate( 'Y' );
	}
	if ( '' === $view_limit ) {
		$view_limit = CPLMS_MAX_RECORDING_VIEWS;
	}
	?>
	<p>
		<label><strong>ஆண்டு</strong></label><br>
		<input type="number" name="cp_year" value="<?php echo esc_attr( $year ); ?>" style="width:120px" min="2020" max="2100">
	</p>
	<p>
		<label><strong>மாதம்</strong></label><br>
		<select name="cp_month">
			<?php foreach ( $months as $num => $name ) : ?>
				<option value="<?php echo esc_attr( $num ); ?>" <?php selected( (int) $month, $num ); ?>><?php echo esc_html( $name ); ?></option>
			<?php endforeach; ?>
		</select>
	</p>
	<p>
		<label><strong>பாடம்</strong></label><br>
		<select name="cp_subject_id" style="min-width:250px">
			<option value="">-- பாடம் தேர்ந்தெடுக்கவும் --</option>
			<?php foreach ( $subjects as $s ) : ?>
				<option value="<?php echo esc_attr( $s->ID ); ?>" <?php selected( $subject_id, $s->ID ); ?>><?php echo esc_html( $s->post_title ); ?></option>
			<?php endforeach; ?>
		</select>
	</p>
	<p>
		<label><strong>வகுப்பு எண்</strong></label><br>
		<input type="text" name="cp_class_number" value="<?php echo esc_attr( $class_no ); ?>" placeholder="எ.கா. 06">
	</p>
	<p>
		<label><strong>வகுப்பு தேதி</strong></label><br>
		<input type="date" name="cp_class_date" value="<?php echo esc_attr( $class_date ); ?>">
	</p>
	<p>
		<label><strong>பாடத் தலைப்பு</strong></label> (இது Title-ஆகவும் பயன்படும் — மேலே Title box-லும் இதையே type செய்யவும்)
	</p>
	<p>
		<label><strong>Recording</strong> (ஒரு வரிக்கு ஒன்று: <code>தலைப்பு | URL</code>)</label><br>
		<textarea id="cp_recordings" name="cp_recordings" rows="3" style="width:100%" placeholder="Recording 01 | https://..."><?php echo esc_textarea( $recordings ); ?></textarea><br>
		<button type="button" class="button cplms-upload-btn" data-target="cp_recordings" data-filetype="video">📎 Recording பதிவேற்ற (Upload)</button>
	</p>
	<p>
		<label><strong>Recording Duration</strong></label><br>
		<input type="text" name="cp_recording_duration" value="<?php echo esc_attr( $duration ); ?>" placeholder="எ.கா. 45 நிமிடம்">
	</p>
	<p>
		<label><strong>Recording View Limit</strong></label><br>
		<input type="number" name="cp_view_limit" value="<?php echo esc_attr( $view_limit ); ?>" style="width:100px" min="1">
	</p>
	<p>
		<label><strong>PDF</strong> (ஒரு வரிக்கு ஒன்று: <code>தலைப்பு | URL</code>)</label><br>
		<textarea id="cp_pdfs" name="cp_pdfs" rows="3" style="width:100%" placeholder="Notes | https://..."><?php echo esc_textarea( $pdfs ); ?></textarea><br>
		<button type="button" class="button cplms-upload-btn" data-target="cp_pdfs" data-filetype="application/pdf">📎 PDF பதிவேற்ற (Upload)</button>
	</p>
	<p>
		<label><strong>Worksheet</strong> (ஒரு வரிக்கு ஒன்று: <code>தலைப்பு | URL</code>)</label><br>
		<textarea id="cp_worksheets" name="cp_worksheets" rows="3" style="width:100%" placeholder="பயிற்சி 1 | https://..."><?php echo esc_textarea( $worksheets ); ?></textarea><br>
		<button type="button" class="button cplms-upload-btn" data-target="cp_worksheets" data-filetype="application/pdf">📎 Worksheet பதிவேற்ற (Upload)</button>
	</p>
	<p>
		<label><strong>ஆசிரியர் குறிப்பு</strong></label><br>
		<textarea name="cp_teacher_note" rows="2" style="width:100%"><?php echo esc_textarea( $note ); ?></textarea>
	</p>
	<p><em>வலது பக்கம் "Publish" box-ல் Publish/Draft தேர்ந்தெடுக்கலாம். Draft-ஆக இருந்தால் மாணவர்களுக்கு தெரியாது.</em></p>
	<?php
}

function cplms_student_meta_box( $post ) {
	wp_nonce_field( 'cplms_save_student', 'cplms_student_nonce' );
	$grade_id     = get_post_meta( $post->ID, '_cp_grade_id', true );
	$access_code  = get_post_meta( $post->ID, '_cp_access_code', true );
	$subject_ids  = get_post_meta( $post->ID, '_cp_subject_ids', true );
	$subject_ids  = is_array( $subject_ids ) ? $subject_ids : array();
	$month_access = get_post_meta( $post->ID, '_cp_month_access', true );
	$month_access = is_array( $month_access ) ? $month_access : array();
	$grades       = cplms_get_grades();
	$subjects     = cplms_get_subjects();
	$months       = cplms_month_names();
	$edit_year    = gmdate( 'Y' );
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
	<div style="border:1px solid #ddd; padding:8px;">
		<?php if ( empty( $subjects ) ) : ?>
			<em>முதலில் பாடங்கள் சேர்க்கவும்.</em>
		<?php endif; ?>
		<?php foreach ( $subjects as $s ) :
			$checked_months = isset( $month_access[ $s->ID ] ) && is_array( $month_access[ $s->ID ] ) ? $month_access[ $s->ID ] : array();
			?>
			<div style="margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid #eee;">
				<label style="font-weight:600;">
					<input type="checkbox" name="cp_subject_ids[]" value="<?php echo esc_attr( $s->ID ); ?>" <?php checked( in_array( $s->ID, $subject_ids, true ) ); ?>>
					<?php echo esc_html( $s->post_title ); ?>
				</label>
				<div style="margin-left:22px; margin-top:4px; font-size:12px; color:#555;">
					<?php echo esc_html( $edit_year ); ?>-க்கு குறிப்பிட்ட மாதங்கள் மட்டும் அனுமதிக்க (tick செய்யாவிட்டால் எல்லா மாதங்களும் அனுமதி):
					<?php foreach ( $months as $num => $name ) :
						$ym = sprintf( '%04d-%02d', $edit_year, $num );
						?>
						<label style="margin-right:10px; white-space:nowrap;">
							<input type="checkbox" name="cp_months_<?php echo esc_attr( $s->ID ); ?>[]" value="<?php echo esc_attr( $num ); ?>" <?php checked( in_array( $ym, $checked_months, true ) ); ?>>
							<?php echo esc_html( $name ); ?>
						</label>
					<?php endforeach; ?>
				</div>
			</div>
		<?php endforeach; ?>
	</div>
	<input type="hidden" name="cp_access_year" value="<?php echo esc_attr( $edit_year ); ?>">
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
		update_post_meta( $post_id, '_cp_icon', sanitize_text_field( wp_unslash( $_POST['cp_icon'] ?? '📘' ) ) );
	}

	if ( 'cp_class' === $post_type && isset( $_POST['cplms_class_nonce'] ) && wp_verify_nonce( $_POST['cplms_class_nonce'], 'cplms_save_class' ) ) {
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}
		update_post_meta( $post_id, '_cp_year', absint( $_POST['cp_year'] ?? 0 ) );
		update_post_meta( $post_id, '_cp_month', absint( $_POST['cp_month'] ?? 0 ) );
		update_post_meta( $post_id, '_cp_subject_id', absint( $_POST['cp_subject_id'] ?? 0 ) );
		update_post_meta( $post_id, '_cp_class_number', sanitize_text_field( wp_unslash( $_POST['cp_class_number'] ?? '' ) ) );
		update_post_meta( $post_id, '_cp_class_date', sanitize_text_field( wp_unslash( $_POST['cp_class_date'] ?? '' ) ) );
		update_post_meta( $post_id, '_cp_recordings', sanitize_textarea_field( wp_unslash( $_POST['cp_recordings'] ?? '' ) ) );
		update_post_meta( $post_id, '_cp_recording_duration', sanitize_text_field( wp_unslash( $_POST['cp_recording_duration'] ?? '' ) ) );
		update_post_meta( $post_id, '_cp_view_limit', max( 1, absint( $_POST['cp_view_limit'] ?? CPLMS_MAX_RECORDING_VIEWS ) ) );
		update_post_meta( $post_id, '_cp_pdfs', sanitize_textarea_field( wp_unslash( $_POST['cp_pdfs'] ?? '' ) ) );
		update_post_meta( $post_id, '_cp_worksheets', sanitize_textarea_field( wp_unslash( $_POST['cp_worksheets'] ?? '' ) ) );
		update_post_meta( $post_id, '_cp_teacher_note', sanitize_textarea_field( wp_unslash( $_POST['cp_teacher_note'] ?? '' ) ) );
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

		$edit_year    = absint( $_POST['cp_access_year'] ?? gmdate( 'Y' ) );
		$month_access = get_post_meta( $post_id, '_cp_month_access', true );
		$month_access = is_array( $month_access ) ? $month_access : array();
		foreach ( $subject_ids as $sid ) {
			$existing = isset( $month_access[ $sid ] ) && is_array( $month_access[ $sid ] ) ? $month_access[ $sid ] : array();
			// Drop this year's old entries for the subject, keep other years intact.
			$existing = array_filter( $existing, function ( $ym ) use ( $edit_year ) {
				return 0 !== strpos( $ym, $edit_year . '-' );
			} );
			$selected_months = isset( $_POST[ 'cp_months_' . $sid ] ) ? array_map( 'absint', (array) $_POST[ 'cp_months_' . $sid ] ) : array();
			foreach ( $selected_months as $m ) {
				$existing[] = sprintf( '%04d-%02d', $edit_year, $m );
			}
			$month_access[ $sid ] = array_values( array_unique( $existing ) );
		}
		update_post_meta( $post_id, '_cp_month_access', $month_access );
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

function cplms_class_columns( $columns ) {
	$columns['cp_year_month'] = 'ஆண்டு / மாதம்';
	$columns['cp_subject']    = 'பாடம்';
	$columns['cp_date']       = 'தேதி';
	return $columns;
}
add_filter( 'manage_cp_class_posts_columns', 'cplms_class_columns' );

function cplms_class_column_content( $column, $post_id ) {
	if ( 'cp_year_month' === $column ) {
		$months = cplms_month_names();
		$year   = get_post_meta( $post_id, '_cp_year', true );
		$month  = (int) get_post_meta( $post_id, '_cp_month', true );
		echo esc_html( $year . ' - ' . ( $months[ $month ] ?? '' ) );
	}
	if ( 'cp_subject' === $column ) {
		$subject_id = get_post_meta( $post_id, '_cp_subject_id', true );
		echo $subject_id ? esc_html( get_the_title( $subject_id ) ) : '—';
	}
	if ( 'cp_date' === $column ) {
		echo esc_html( get_post_meta( $post_id, '_cp_class_date', true ) );
	}
}
add_action( 'manage_cp_class_posts_custom_column', 'cplms_class_column_content', 10, 2 );

/* ---------------------------------------------------------------------
 * 3. Settings page
 * ------------------------------------------------------------------- */

function cplms_settings_page() {
	if ( isset( $_POST['cplms_settings_nonce'] ) && wp_verify_nonce( $_POST['cplms_settings_nonce'], 'cplms_save_settings' ) && current_user_can( 'manage_options' ) ) {
		update_option( 'cplms_school_name', sanitize_text_field( wp_unslash( $_POST['cplms_school_name'] ?? '' ) ) );
		update_option( 'cplms_tagline', sanitize_text_field( wp_unslash( $_POST['cplms_tagline'] ?? '' ) ) );
		update_option( 'cplms_whatsapp', preg_replace( '/[^0-9]/', '', wp_unslash( $_POST['cplms_whatsapp'] ?? '' ) ) );
		update_option( 'cplms_announcement', sanitize_textarea_field( wp_unslash( $_POST['cplms_announcement'] ?? '' ) ) );
		echo '<div class="updated"><p>சேமிக்கப்பட்டது.</p></div>';
	}
	$school_name  = get_option( 'cplms_school_name', 'வகுப்பு போர்ட்டல்' );
	$tagline      = get_option( 'cplms_tagline', '' );
	$whatsapp     = get_option( 'cplms_whatsapp', '94752495266' );
	$announcement = get_option( 'cplms_announcement', '' );
	?>
	<div class="wrap">
		<h1>Class Portal LMS — அமைப்புகள்</h1>
		<p>ஒரு பக்கத்தில் (Page) <code>[class_portal]</code> shortcode-ஐ சேர்த்தால், அந்த பக்கத்தில் மாணவர்கள் Access Code மூலம் தங்கள் வகுப்புகளை பார்க்கும் public பகுதி வந்துவிடும்.</p>
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
				<tr>
					<th><label for="cplms_whatsapp">WhatsApp Number (country code-உடன், + இல்லாமல்)</label></th>
					<td>
						<input type="text" id="cplms_whatsapp" name="cplms_whatsapp" value="<?php echo esc_attr( $whatsapp ); ?>" class="regular-text" placeholder="94752495266">
					</td>
				</tr>
				<tr>
					<th><label for="cplms_announcement">📢 அறிவிப்பு (Student Dashboard-ல் காட்டப்படும்)</label></th>
					<td><textarea id="cplms_announcement" name="cplms_announcement" rows="3" class="large-text"><?php echo esc_textarea( $announcement ); ?></textarea></td>
				</tr>
			</table>
			<?php submit_button( 'சேமிக்க' ); ?>
		</form>
		<hr>
		<h2>Quick Links</h2>
		<ul>
			<li><a href="<?php echo esc_url( admin_url( 'post-new.php?post_type=cp_grade' ) ); ?>">➕ புதிய தரம் சேர்க்க</a></li>
			<li><a href="<?php echo esc_url( admin_url( 'post-new.php?post_type=cp_subject' ) ); ?>">➕ புதிய பாடம் சேர்க்க</a></li>
			<li><a href="<?php echo esc_url( admin_url( 'post-new.php?post_type=cp_class' ) ); ?>">➕ புதிய வகுப்பு (Class) சேர்க்க</a></li>
			<li><a href="<?php echo esc_url( admin_url( 'post-new.php?post_type=cp_student' ) ); ?>">➕ புதிய மாணவர் சேர்க்க</a></li>
		</ul>
	</div>
	<?php
}

/* ---------------------------------------------------------------------
 * 4. Front-end assets, footer/header cleanup, cache-busting, WhatsApp
 * ------------------------------------------------------------------- */

function cplms_enqueue_assets() {
	wp_enqueue_style( 'cplms-style', CPLMS_URL . 'assets/style.css', array(), CPLMS_VERSION );
}
add_action( 'wp_enqueue_scripts', 'cplms_enqueue_assets' );

function cplms_print_inline_style() {
	$css_file = CPLMS_PATH . 'assets/style.css';
	if ( file_exists( $css_file ) ) {
		echo '<style id="cplms-inline-style">' . file_get_contents( $css_file ) . '</style>'; // phpcs:ignore
	}
}
add_action( 'wp_head', 'cplms_print_inline_style', 100 );

function cplms_hide_wp_credit() {
	?>
	<script>
	document.addEventListener('DOMContentLoaded', function () {
		document.querySelectorAll('a[href*="wordpress.org"]').forEach(function (a) {
			var line = a.closest('p, li, span, div');
			if (line) { line.style.display = 'none'; }
		});
	});
	</script>
	<?php
}
add_action( 'wp_footer', 'cplms_hide_wp_credit', 100 );

function cplms_hide_page_title() {
	if ( is_page( 'class-portal' ) ) {
		echo '<style id="cplms-hide-title">.wp-block-post-title{display:none!important}</style>';
	}
}
add_action( 'wp_head', 'cplms_hide_page_title', 100 );

function cplms_hide_theme_footer() {
	echo '<style id="cplms-hide-footer">footer{display:none!important}</style>';
}
add_action( 'wp_head', 'cplms_hide_theme_footer', 100 );

function cplms_bust_homepage_cache_links() {
	$home = esc_js( trailingslashit( home_url() ) );
	?>
	<script>
	(function () {
		var home = '<?php echo $home; ?>';
		var homeNoSlash = home.slice(0, -1);
		document.addEventListener('click', function (e) {
			var a = e.target.closest('a');
			if (!a) { return; }
			var href = a.getAttribute('href') || '';
			if (href === home || href === homeNoSlash || href === '/' || href === window.location.origin + '/') {
				e.preventDefault();
				window.location.href = home + '?_r=' + Date.now();
			}
		});
	})();
	</script>
	<?php
}
add_action( 'wp_footer', 'cplms_bust_homepage_cache_links', 100 );

function cplms_print_whatsapp_button() {
	$whatsapp = get_option( 'cplms_whatsapp', '94752495266' );
	if ( empty( $whatsapp ) ) {
		return;
	}
	?>
	<a href="https://wa.me/<?php echo esc_attr( $whatsapp ); ?>" target="_blank" rel="noopener" class="cplms-whatsapp-float" aria-label="WhatsApp-ல் தொடர்பு கொள்ள">
		<svg viewBox="0 0 32 32" width="30" height="30" fill="#fff" aria-hidden="true">
			<path d="M16 3C9.373 3 4 8.373 4 15c0 2.386.706 4.607 1.92 6.463L4 29l7.72-1.876A11.93 11.93 0 0 0 16 27c6.627 0 12-5.373 12-12S22.627 3 16 3zm0 21.8a9.76 9.76 0 0 1-4.98-1.36l-.357-.213-3.66.89.89-3.567-.232-.368A9.76 9.76 0 0 1 6.2 15c0-5.404 4.396-9.8 9.8-9.8s9.8 4.396 9.8 9.8-4.396 9.8-9.8 9.8zm5.36-7.34c-.293-.147-1.735-.856-2.004-.954-.269-.098-.464-.147-.66.147-.196.293-.758.954-.929 1.15-.171.196-.342.22-.635.073-.293-.147-1.238-.456-2.358-1.454-.872-.778-1.46-1.739-1.631-2.032-.171-.293-.018-.451.129-.598.132-.132.293-.342.44-.513.147-.171.196-.293.293-.489.098-.196.049-.367-.024-.514-.073-.147-.66-1.591-.904-2.179-.238-.572-.48-.494-.66-.503l-.562-.01c-.196 0-.514.073-.783.367-.269.293-1.026 1.003-1.026 2.447 0 1.444 1.05 2.838 1.197 3.034.147.196 2.067 3.157 5.008 4.427.7.302 1.246.483 1.672.618.703.223 1.343.192 1.849.117.564-.084 1.735-.71 1.98-1.395.244-.685.244-1.272.171-1.395-.073-.122-.269-.196-.562-.343z"/>
		</svg>
	</a>
	<?php
}
add_action( 'wp_footer', 'cplms_print_whatsapp_button', 100 );

/* ---------------------------------------------------------------------
 * 5. Data helpers
 * ------------------------------------------------------------------- */

function cplms_parse_lines( $raw, $auto_label_prefix = '' ) {
	$items = array();
	foreach ( preg_split( "/\r\n|\r|\n/", (string) $raw ) as $line ) {
		$line = trim( $line );
		if ( '' === $line ) {
			continue;
		}
		$parts = array_map( 'trim', explode( '|', $line, 2 ) );
		$url   = $parts[1] ?? $parts[0];
		$label = $parts[0];
		if ( '' !== $auto_label_prefix && $label === $url ) {
			$label = $auto_label_prefix . ' ' . ( count( $items ) + 1 );
		}
		$items[] = array(
			'label' => $label,
			'url'   => $url,
		);
	}
	return $items;
}

/**
 * Whether a student may see a given subject's classes in a given
 * year-month. If the teacher never restricted that subject's months for
 * this student, every month is open (backward compatible default).
 */
function cplms_student_has_month_access( $student_id, $subject_id, $year, $month ) {
	$month_access = get_post_meta( $student_id, '_cp_month_access', true );
	if ( ! is_array( $month_access ) || empty( $month_access[ $subject_id ] ) ) {
		return true;
	}
	$ym = sprintf( '%04d-%02d', $year, $month );
	return in_array( $ym, $month_access[ $subject_id ], true );
}

/**
 * All published cp_class entries a student is allowed to see, newest
 * first, with subject_ids permission + per-month access applied.
 */
function cplms_get_student_classes( $student ) {
	$subject_ids = get_post_meta( $student->ID, '_cp_subject_ids', true );
	$subject_ids = is_array( $subject_ids ) ? $subject_ids : array();
	if ( empty( $subject_ids ) ) {
		return array();
	}

	$classes = get_posts( array(
		'post_type'      => 'cp_class',
		'post_status'    => 'publish',
		'posts_per_page' => -1,
		'meta_query'      => array(
			array(
				'key'     => '_cp_subject_id',
				'value'   => $subject_ids,
				'compare' => 'IN',
			),
		),
	) );

	$allowed = array();
	foreach ( $classes as $class ) {
		$year       = (int) get_post_meta( $class->ID, '_cp_year', true );
		$month      = (int) get_post_meta( $class->ID, '_cp_month', true );
		$subject_id = (int) get_post_meta( $class->ID, '_cp_subject_id', true );
		if ( cplms_student_has_month_access( $student->ID, $subject_id, $year, $month ) ) {
			$allowed[] = $class;
		}
	}

	usort( $allowed, function ( $a, $b ) {
		$da = get_post_meta( $a->ID, '_cp_class_date', true );
		$db = get_post_meta( $b->ID, '_cp_class_date', true );
		return strcmp( $db, $da );
	} );

	return $allowed;
}

function cplms_class_progress_status( $student_id, $class ) {
	$recordings = cplms_parse_lines( get_post_meta( $class->ID, '_cp_recordings', true ), 'Recording' );
	if ( empty( $recordings ) ) {
		return '';
	}
	$limit = (int) get_post_meta( $class->ID, '_cp_view_limit', true );
	if ( $limit < 1 ) {
		$limit = CPLMS_MAX_RECORDING_VIEWS;
	}
	$views       = get_post_meta( $student_id, '_cp_recording_views', true );
	$views       = is_array( $views ) ? $views : array();
	$any_started = false;
	$all_done    = true;
	foreach ( $recordings as $r ) {
		$used = isset( $views[ md5( $r['url'] ) ] ) ? (int) $views[ md5( $r['url'] ) ] : 0;
		if ( $used > 0 ) {
			$any_started = true;
		}
		if ( $used < $limit ) {
			$all_done = false;
		}
	}
	if ( $all_done ) {
		return 'done';
	}
	if ( $any_started ) {
		return 'continue';
	}
	return 'new';
}

/* ---------------------------------------------------------------------
 * 6. Public shortcode: [class_portal]
 * ------------------------------------------------------------------- */

function cplms_shortcode( $atts ) {
	$school_name = get_option( 'cplms_school_name', 'வகுப்பு போர்ட்டல்' );
	$tagline     = get_option( 'cplms_tagline', '' );

	ob_start();

	$student      = null;
	$error        = '';
	$entered_code = '';

	if ( isset( $_POST['cplms_access_code'] ) && isset( $_POST['cplms_nonce'] ) && wp_verify_nonce( $_POST['cplms_nonce'], 'cplms_login' ) ) {
		$entered_code = strtoupper( trim( sanitize_text_field( wp_unslash( $_POST['cplms_access_code'] ) ) ) );
	} elseif ( isset( $_GET['code'] ) ) {
		$entered_code = strtoupper( trim( sanitize_text_field( wp_unslash( $_GET['code'] ) ) ) );
	}

	if ( '' !== $entered_code ) {
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
			cplms_render_student_app( $student, $entered_code );
		endif; ?>
		<p class="cplms-admin-login"><a href="<?php echo esc_url( wp_login_url( get_permalink() ) ); ?>">🔑 ஆசிரியர் நுழைவு (Admin Login)</a></p>
	</div>
	<?php
	return ob_get_clean();
}
add_shortcode( 'class_portal', 'cplms_shortcode' );

function cplms_nav_url( $code, $args = array() ) {
	$args['code'] = $code;
	return add_query_arg( $args, get_permalink() );
}

function cplms_render_student_app( $student, $code ) {
	$view  = isset( $_GET['cp_v'] ) ? sanitize_key( $_GET['cp_v'] ) : 'home';
	$months = cplms_month_names();

	$subject_ids = get_post_meta( $student->ID, '_cp_subject_ids', true );
	$subject_ids = is_array( $subject_ids ) ? $subject_ids : array();
	$subjects    = ! empty( $subject_ids ) ? get_posts( array( 'post_type' => 'cp_subject', 'post__in' => $subject_ids, 'posts_per_page' => -1 ) ) : array();
	$all_classes = cplms_get_student_classes( $student );

	echo '<div class="cplms-student-view">';
	echo '<p class="cplms-welcome">வணக்கம், <strong>' . esc_html( $student->post_title ) . '</strong>!</p>';

	if ( 'classes' === $view ) {
		cplms_view_classes( $student, $code, $all_classes, $subjects, $months );
	} elseif ( 'calendar' === $view ) {
		cplms_view_calendar( $student, $code, $all_classes );
	} elseif ( 'materials' === $view ) {
		cplms_view_materials( $student, $code, $all_classes );
	} elseif ( 'profile' === $view ) {
		cplms_view_profile( $student, $subjects );
	} else {
		cplms_view_home( $student, $code, $all_classes, $subjects, $months );
	}

	echo '<p><a href="' . esc_url( get_permalink() ) . '" class="cplms-logout">← வேறு Access Code உள்ளிட</a></p>';
	echo '</div>';

	cplms_render_bottom_nav( $code, $view );
}

function cplms_render_bottom_nav( $code, $current ) {
	$items = array(
		'home'      => array( '🏠', 'Home' ),
		'classes'   => array( '📚', 'Classes' ),
		'calendar'  => array( '📅', 'Calendar' ),
		'materials' => array( '📄', 'Materials' ),
		'profile'   => array( '👤', 'Profile' ),
	);
	echo '<nav class="cplms-bottom-nav">';
	foreach ( $items as $key => $item ) {
		$active = ( $current === $key || ( 'home' === $key && ! in_array( $current, array_keys( $items ), true ) ) ) ? ' cplms-nav-active' : '';
		echo '<a class="cplms-nav-item' . esc_attr( $active ) . '" href="' . esc_url( cplms_nav_url( $code, array( 'cp_v' => $key ) ) ) . '"><span>' . esc_html( $item[0] ) . '</span><small>' . esc_html( $item[1] ) . '</small></a>';
	}
	echo '</nav>';
}

function cplms_view_home( $student, $code, $all_classes, $subjects, $months ) {
	$grade_id      = get_post_meta( $student->ID, '_cp_grade_id', true );
	$grade_name    = $grade_id ? get_the_title( $grade_id ) : '';
	$announcement  = get_option( 'cplms_announcement', '' );
	$today         = gmdate( 'Y-m-d' );

	$next_class = null;
	foreach ( array_reverse( $all_classes ) as $c ) {
		$date = get_post_meta( $c->ID, '_cp_class_date', true );
		if ( $date >= $today ) {
			$next_class = $c;
			break;
		}
	}

	$done_count = 0;
	$total_count = 0;
	foreach ( $all_classes as $c ) {
		$status = cplms_class_progress_status( $student->ID, $c );
		if ( '' === $status ) {
			continue;
		}
		$total_count++;
		if ( 'done' === $status ) {
			$done_count++;
		}
	}

	echo '<div class="cplms-dashboard">';

	if ( $grade_name ) {
		echo '<p class="cplms-grade-badge">' . esc_html( $grade_name ) . '</p>';
	}

	if ( $announcement ) {
		echo '<div class="cplms-card cplms-announcement"><strong>📢 அறிவிப்பு</strong><p>' . nl2br( esc_html( $announcement ) ) . '</p></div>';
	}

	echo '<div class="cplms-card"><strong>📚 எனது பாடங்கள்</strong><div class="cplms-chip-row">';
	foreach ( $subjects as $s ) {
		$icon = get_post_meta( $s->ID, '_cp_icon', true );
		echo '<span class="cplms-chip">' . esc_html( $icon ? $icon : '📘' ) . ' ' . esc_html( $s->post_title ) . '</span>';
	}
	if ( empty( $subjects ) ) {
		echo '<span class="cplms-chip">இதுவரை பாடங்கள் இல்லை</span>';
	}
	echo '</div></div>';

	echo '<div class="cplms-card"><strong>📅 அடுத்த வகுப்பு</strong>';
	if ( $next_class ) {
		$subject_id = get_post_meta( $next_class->ID, '_cp_subject_id', true );
		$icon       = get_post_meta( $subject_id, '_cp_icon', true );
		echo '<p>' . esc_html( $icon ? $icon : '📘' ) . ' ' . esc_html( get_the_title( $subject_id ) ) . ' — ' . esc_html( get_post_meta( $next_class->ID, '_cp_class_date', true ) ) . '</p>';
	} else {
		echo '<p>அடுத்த வகுப்பு எதுவும் திட்டமிடப்படவில்லை.</p>';
	}
	echo '</div>';

	if ( $total_count > 0 ) {
		echo '<div class="cplms-card"><strong>📊 Progress</strong><p>' . (int) $done_count . ' / ' . (int) $total_count . ' recordings முடிக்கப்பட்டது</p></div>';
	}

	echo '<div class="cplms-card"><strong>📄 சமீபத்திய Materials</strong><ul class="cplms-recent-list">';
	$shown = 0;
	foreach ( $all_classes as $c ) {
		$pdfs = cplms_parse_lines( get_post_meta( $c->ID, '_cp_pdfs', true ), 'PDF' );
		foreach ( $pdfs as $p ) {
			if ( $shown >= 5 ) {
				break 2;
			}
			echo '<li><a href="' . esc_url( $p['url'] ) . '" target="_blank" rel="noopener">📄 ' . esc_html( $p['label'] ) . '</a></li>';
			$shown++;
		}
	}
	if ( 0 === $shown ) {
		echo '<li>இதுவரை PDF இல்லை.</li>';
	}
	echo '</ul></div>';

	echo '</div>';
}

function cplms_view_classes( $student, $code, $all_classes, $subjects, $months ) {
	$year_param    = isset( $_GET['cp_y'] ) ? absint( $_GET['cp_y'] ) : 0;
	$month_param   = isset( $_GET['cp_m'] ) ? absint( $_GET['cp_m'] ) : 0;
	$subject_param = isset( $_GET['cp_s'] ) ? absint( $_GET['cp_s'] ) : 0;
	$class_param   = isset( $_GET['cp_c'] ) ? absint( $_GET['cp_c'] ) : 0;

	echo '<div class="cplms-classes">';

	if ( $class_param ) {
		cplms_view_class_detail( $student, $code, $class_param, $year_param, $month_param, $subject_param );
		echo '</div>';
		return;
	}

	if ( $subject_param && $year_param && $month_param ) {
		cplms_view_date_list( $student, $code, $all_classes, $year_param, $month_param, $subject_param );
		echo '</div>';
		return;
	}

	if ( $year_param && $month_param ) {
		cplms_view_subject_list( $code, $all_classes, $subjects, $year_param, $month_param );
		echo '</div>';
		return;
	}

	if ( $year_param ) {
		cplms_view_month_list( $code, $all_classes, $subjects, $year_param, $months );
		echo '</div>';
		return;
	}

	cplms_view_year_list( $code, $all_classes );
	echo '</div>';
}

function cplms_view_year_list( $code, $all_classes ) {
	$years = array();
	foreach ( $all_classes as $c ) {
		$y = (int) get_post_meta( $c->ID, '_cp_year', true );
		$years[ $y ] = true;
	}
	krsort( $years );
	echo '<h3>📚 வகுப்புகள் — ஆண்டு தேர்ந்தெடுக்கவும்</h3>';
	if ( empty( $years ) ) {
		echo '<p>இதுவரை வகுப்புகள் எதுவும் சேர்க்கப்படவில்லை.</p>';
		return;
	}
	echo '<div class="cplms-grid-list">';
	foreach ( array_keys( $years ) as $y ) {
		echo '<a class="cplms-tile" href="' . esc_url( cplms_nav_url( $code, array( 'cp_v' => 'classes', 'cp_y' => $y ) ) ) . '">' . esc_html( $y ) . '</a>';
	}
	echo '</div>';
}

function cplms_view_month_list( $code, $all_classes, $subjects, $year, $months ) {
	$present = array();
	foreach ( $all_classes as $c ) {
		if ( (int) get_post_meta( $c->ID, '_cp_year', true ) === $year ) {
			$present[ (int) get_post_meta( $c->ID, '_cp_month', true ) ] = true;
		}
	}
	echo '<p><a href="' . esc_url( cplms_nav_url( $code, array( 'cp_v' => 'classes' ) ) ) . '">← ஆண்டுகள்</a></p>';
	echo '<h3>' . esc_html( $year ) . ' — மாதம் தேர்ந்தெடுக்கவும்</h3>';
	echo '<div class="cplms-grid-list">';
	foreach ( $months as $num => $name ) {
		if ( empty( $present[ $num ] ) ) {
			continue;
		}
		echo '<a class="cplms-tile" href="' . esc_url( cplms_nav_url( $code, array( 'cp_v' => 'classes', 'cp_y' => $year, 'cp_m' => $num ) ) ) . '">' . esc_html( $name ) . '</a>';
	}
	echo '</div>';
	if ( empty( $present ) ) {
		echo '<p>இந்த ஆண்டில் வகுப்புகள் இல்லை.</p>';
	}
}

function cplms_view_subject_list( $code, $all_classes, $subjects, $year, $month ) {
	$months_names = cplms_month_names();
	$counts       = array();
	foreach ( $all_classes as $c ) {
		if ( (int) get_post_meta( $c->ID, '_cp_year', true ) === $year && (int) get_post_meta( $c->ID, '_cp_month', true ) === $month ) {
			$sid = (int) get_post_meta( $c->ID, '_cp_subject_id', true );
			$counts[ $sid ] = ( $counts[ $sid ] ?? 0 ) + 1;
		}
	}
	echo '<p><a href="' . esc_url( cplms_nav_url( $code, array( 'cp_v' => 'classes', 'cp_y' => $year ) ) ) . '">← மாதங்கள்</a></p>';
	echo '<h3>' . esc_html( $months_names[ $month ] ?? '' ) . ' ' . esc_html( $year ) . ' — பாடம் தேர்ந்தெடுக்கவும்</h3>';
	echo '<div class="cplms-subjects">';
	foreach ( $subjects as $s ) {
		if ( empty( $counts[ $s->ID ] ) ) {
			continue;
		}
		$icon = get_post_meta( $s->ID, '_cp_icon', true );
		echo '<a class="cplms-subject-card cplms-subject-link" href="' . esc_url( cplms_nav_url( $code, array( 'cp_v' => 'classes', 'cp_y' => $year, 'cp_m' => $month, 'cp_s' => $s->ID ) ) ) . '">';
		echo '<h3>' . esc_html( $icon ? $icon : '📘' ) . ' ' . esc_html( $s->post_title ) . '</h3>';
		echo '<p>' . (int) $counts[ $s->ID ] . ' வகுப்புகள்</p>';
		echo '</a>';
	}
	echo '</div>';
	if ( empty( $counts ) ) {
		echo '<p>இந்த மாதத்தில் வகுப்புகள் இல்லை.</p>';
	}
}

function cplms_view_date_list( $student, $code, $all_classes, $year, $month, $subject_id ) {
	$months_names = cplms_month_names();
	$list         = array();
	foreach ( $all_classes as $c ) {
		if ( (int) get_post_meta( $c->ID, '_cp_year', true ) === $year
			&& (int) get_post_meta( $c->ID, '_cp_month', true ) === $month
			&& (int) get_post_meta( $c->ID, '_cp_subject_id', true ) === $subject_id ) {
			$list[] = $c;
		}
	}
	$icon = get_post_meta( $subject_id, '_cp_icon', true );
	echo '<p><a href="' . esc_url( cplms_nav_url( $code, array( 'cp_v' => 'classes', 'cp_y' => $year, 'cp_m' => $month ) ) ) . '">← பாடங்கள்</a></p>';
	echo '<h3>' . esc_html( $icon ? $icon : '📘' ) . ' ' . esc_html( get_the_title( $subject_id ) ) . ' — ' . esc_html( $months_names[ $month ] ?? '' ) . ' ' . esc_html( $year ) . '</h3>';
	echo '<ul class="cplms-date-list">';
	foreach ( $list as $c ) {
		$status = cplms_class_progress_status( $student->ID, $c );
		$badge  = '⚪';
		if ( 'done' === $status ) {
			$badge = '🟢';
		} elseif ( 'continue' === $status ) {
			$badge = '🟡';
		}
		$date  = get_post_meta( $c->ID, '_cp_class_date', true );
		$no    = get_post_meta( $c->ID, '_cp_class_number', true );
		echo '<li><a href="' . esc_url( cplms_nav_url( $code, array( 'cp_v' => 'classes', 'cp_y' => $year, 'cp_m' => $month, 'cp_s' => $subject_id, 'cp_c' => $c->ID ) ) ) . '">';
		echo '📅 ' . esc_html( $date ) . ' — வகுப்பு ' . esc_html( $no ) . ' — ' . esc_html( get_the_title( $c->ID ) ) . ' ' . esc_html( $badge );
		echo '</a></li>';
	}
	if ( empty( $list ) ) {
		echo '<li>வகுப்புகள் இல்லை.</li>';
	}
	echo '</ul>';
}

function cplms_view_class_detail( $student, $code, $class_id, $year, $month, $subject_id ) {
	$class = get_post( $class_id );
	if ( ! $class || 'cp_class' !== $class->post_type || 'publish' !== $class->post_status ) {
		echo '<p>வகுப்பு கிடைக்கவில்லை.</p>';
		return;
	}
	$sid = (int) get_post_meta( $class_id, '_cp_subject_id', true );
	if ( $subject_id && $sid !== $subject_id ) {
		$subject_id = $sid;
	}
	$icon       = get_post_meta( $sid, '_cp_icon', true );
	$date       = get_post_meta( $class_id, '_cp_class_date', true );
	$no         = get_post_meta( $class_id, '_cp_class_number', true );
	$duration   = get_post_meta( $class_id, '_cp_recording_duration', true );
	$note       = get_post_meta( $class_id, '_cp_teacher_note', true );
	$limit      = (int) get_post_meta( $class_id, '_cp_view_limit', true );
	if ( $limit < 1 ) {
		$limit = CPLMS_MAX_RECORDING_VIEWS;
	}
	$recordings = cplms_parse_lines( get_post_meta( $class_id, '_cp_recordings', true ), 'Recording' );
	$pdfs       = cplms_parse_lines( get_post_meta( $class_id, '_cp_pdfs', true ), 'PDF' );
	$worksheets = cplms_parse_lines( get_post_meta( $class_id, '_cp_worksheets', true ), 'Worksheet' );
	$views      = get_post_meta( $student->ID, '_cp_recording_views', true );
	$views      = is_array( $views ) ? $views : array();

	echo '<p><a href="' . esc_url( cplms_nav_url( $code, array( 'cp_v' => 'classes', 'cp_y' => $year ? $year : get_post_meta( $class_id, '_cp_year', true ), 'cp_m' => $month ? $month : get_post_meta( $class_id, '_cp_month', true ), 'cp_s' => $sid ) ) ) . '">← தேதிகள்</a></p>';
	echo '<div class="cplms-subject-card">';
	echo '<h3>' . esc_html( $icon ? $icon : '📘' ) . ' ' . esc_html( get_the_title( $sid ) ) . '</h3>';
	echo '<p>📅 ' . esc_html( $date ) . ' — வகுப்பு ' . esc_html( $no ) . ' — <strong>' . esc_html( get_the_title( $class_id ) ) . '</strong></p>';

	if ( ! empty( $recordings ) ) {
		echo '<div class="cplms-list"><strong>🎥 Recording</strong>' . ( $duration ? ' <span class="cplms-views-left">(' . esc_html( $duration ) . ')</span>' : '' ) . '<ul>';
		foreach ( $recordings as $r ) {
			$key       = md5( $r['url'] );
			$used      = isset( $views[ $key ] ) ? (int) $views[ $key ] : 0;
			$remaining = max( 0, $limit - $used );
			echo '<li>';
			if ( $remaining > 0 ) {
				echo '<a class="cplms-btn cplms-btn-zoom" href="' . esc_url( add_query_arg( array( 'cplms_watch' => 1, 'code' => $code, 'key' => $key ), get_permalink() ) ) . '" target="_blank" rel="noopener">▶ ' . esc_html( $r['label'] ) . '</a> ';
				echo '<span class="cplms-views-left">பார்வை வரம்பு: ' . (int) $limit . ' | பார்த்தது: ' . (int) $used . ' | மீதம்: ' . (int) $remaining . '</span>';
			} else {
				echo '<span class="cplms-limit-reached">▶ ' . esc_html( $r['label'] ) . ' — பார்வை வரம்பு முடிந்தது</span>';
			}
			echo '</li>';
		}
		echo '</ul></div>';
	}

	if ( ! empty( $pdfs ) ) {
		echo '<div class="cplms-list"><strong>📄 PDF</strong><ul>';
		foreach ( $pdfs as $p ) {
			echo '<li><a href="' . esc_url( $p['url'] ) . '" target="_blank" rel="noopener">📥 ' . esc_html( $p['label'] ) . '</a></li>';
		}
		echo '</ul></div>';
	}

	if ( ! empty( $worksheets ) ) {
		echo '<div class="cplms-list"><strong>📝 Worksheet / பயிற்சி</strong><ul>';
		foreach ( $worksheets as $w ) {
			echo '<li><a href="' . esc_url( $w['url'] ) . '" target="_blank" rel="noopener">📝 ' . esc_html( $w['label'] ) . '</a></li>';
		}
		echo '</ul></div>';
	}

	if ( $note ) {
		echo '<div class="cplms-list"><strong>📌 ஆசிரியர் குறிப்பு</strong><p>' . nl2br( esc_html( $note ) ) . '</p></div>';
	}

	echo '</div>';
}

function cplms_view_calendar( $student, $code, $all_classes ) {
	$year  = isset( $_GET['cp_y'] ) ? absint( $_GET['cp_y'] ) : (int) gmdate( 'Y' );
	$month = isset( $_GET['cp_m'] ) ? absint( $_GET['cp_m'] ) : (int) gmdate( 'n' );
	$day   = isset( $_GET['cp_d'] ) ? sanitize_text_field( wp_unslash( $_GET['cp_d'] ) ) : '';
	$months_names = cplms_month_names();

	$by_date = array();
	foreach ( $all_classes as $c ) {
		if ( (int) get_post_meta( $c->ID, '_cp_year', true ) === $year && (int) get_post_meta( $c->ID, '_cp_month', true ) === $month ) {
			$d = get_post_meta( $c->ID, '_cp_class_date', true );
			$by_date[ $d ][] = $c;
		}
	}

	$prev_month = 1 === $month ? 12 : $month - 1;
	$prev_year  = 1 === $month ? $year - 1 : $year;
	$next_month = 12 === $month ? 1 : $month + 1;
	$next_year  = 12 === $month ? $year + 1 : $year;

	echo '<h3>📅 Calendar</h3>';
	echo '<div class="cplms-calendar-nav">';
	echo '<a href="' . esc_url( cplms_nav_url( $code, array( 'cp_v' => 'calendar', 'cp_y' => $prev_year, 'cp_m' => $prev_month ) ) ) . '">←</a>';
	echo '<strong>' . esc_html( $months_names[ $month ] ?? '' ) . ' ' . esc_html( $year ) . '</strong>';
	echo '<a href="' . esc_url( cplms_nav_url( $code, array( 'cp_v' => 'calendar', 'cp_y' => $next_year, 'cp_m' => $next_month ) ) ) . '">→</a>';
	echo '</div>';

	$first_ts     = mktime( 0, 0, 0, $month, 1, $year );
	$days_in_month = (int) gmdate( 't', $first_ts );
	$start_wday   = (int) gmdate( 'w', $first_ts );

	echo '<div class="cplms-calendar-grid">';
	foreach ( array( 'Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa' ) as $wd ) {
		echo '<div class="cplms-cal-head">' . esc_html( $wd ) . '</div>';
	}
	for ( $i = 0; $i < $start_wday; $i++ ) {
		echo '<div class="cplms-cal-cell cplms-cal-empty"></div>';
	}
	for ( $d = 1; $d <= $days_in_month; $d++ ) {
		$date_str = sprintf( '%04d-%02d-%02d', $year, $month, $d );
		$has      = ! empty( $by_date[ $date_str ] );
		$class    = 'cplms-cal-cell' . ( $has ? ' cplms-cal-has-class' : '' ) . ( $date_str === $day ? ' cplms-cal-selected' : '' );
		if ( $has ) {
			echo '<a class="' . esc_attr( $class ) . '" href="' . esc_url( cplms_nav_url( $code, array( 'cp_v' => 'calendar', 'cp_y' => $year, 'cp_m' => $month, 'cp_d' => $date_str ) ) ) . '">' . (int) $d . '</a>';
		} else {
			echo '<div class="' . esc_attr( $class ) . '">' . (int) $d . '</div>';
		}
	}
	echo '</div>';

	if ( $day && ! empty( $by_date[ $day ] ) ) {
		echo '<div class="cplms-list"><strong>📅 ' . esc_html( $day ) . '</strong><ul>';
		foreach ( $by_date[ $day ] as $c ) {
			$sid  = (int) get_post_meta( $c->ID, '_cp_subject_id', true );
			$icon = get_post_meta( $sid, '_cp_icon', true );
			echo '<li><a href="' . esc_url( cplms_nav_url( $code, array( 'cp_v' => 'classes', 'cp_y' => $year, 'cp_m' => $month, 'cp_s' => $sid, 'cp_c' => $c->ID ) ) ) . '">' . esc_html( $icon ? $icon : '📘' ) . ' ' . esc_html( get_the_title( $sid ) ) . ' — ' . esc_html( get_the_title( $c->ID ) ) . '</a></li>';
		}
		echo '</ul></div>';
	}
}

function cplms_view_materials( $student, $code, $all_classes ) {
	echo '<h3>📄 Materials</h3>';
	echo '<ul class="cplms-recent-list">';
	$count = 0;
	foreach ( $all_classes as $c ) {
		$sid  = (int) get_post_meta( $c->ID, '_cp_subject_id', true );
		$pdfs = cplms_parse_lines( get_post_meta( $c->ID, '_cp_pdfs', true ), 'PDF' );
		$wks  = cplms_parse_lines( get_post_meta( $c->ID, '_cp_worksheets', true ), 'Worksheet' );
		foreach ( array_merge( $pdfs, $wks ) as $item ) {
			echo '<li><a href="' . esc_url( $item['url'] ) . '" target="_blank" rel="noopener">📄 ' . esc_html( get_the_title( $sid ) . ' — ' . $item['label'] ) . '</a></li>';
			$count++;
		}
	}
	if ( 0 === $count ) {
		echo '<li>இதுவரை Materials இல்லை.</li>';
	}
	echo '</ul>';
}

function cplms_view_profile( $student, $subjects ) {
	$grade_id   = get_post_meta( $student->ID, '_cp_grade_id', true );
	$grade_name = $grade_id ? get_the_title( $grade_id ) : '—';
	echo '<div class="cplms-card">';
	echo '<p>👤 <strong>' . esc_html( $student->post_title ) . '</strong></p>';
	echo '<p>தரம்: ' . esc_html( $grade_name ) . '</p>';
	echo '<p>பாடங்கள்: ';
	$names = array();
	foreach ( $subjects as $s ) {
		$names[] = $s->post_title;
	}
	echo esc_html( implode( ', ', $names ) ? implode( ', ', $names ) : '—' );
	echo '</p></div>';
}

/**
 * Gate recording links behind a per-student view counter: a click goes
 * through this handler first, which redirects to the real URL only while
 * the student is under that class's view limit, otherwise shows a
 * limit-reached notice instead. Searches cp_class recordings.
 */
function cplms_handle_watch_redirect() {
	if ( empty( $_GET['cplms_watch'] ) || empty( $_GET['code'] ) || empty( $_GET['key'] ) ) {
		return;
	}

	$code = strtoupper( trim( sanitize_text_field( wp_unslash( $_GET['code'] ) ) ) );
	$key  = sanitize_text_field( wp_unslash( $_GET['key'] ) );

	$students = get_posts( array(
		'post_type'      => 'cp_student',
		'posts_per_page' => 1,
		'meta_key'       => '_cp_access_code',
		'meta_value'     => $code,
	) );
	if ( empty( $students ) ) {
		wp_die( 'தவறான Access Code.' );
	}
	$student = $students[0];

	$target_url = '';
	$limit      = CPLMS_MAX_RECORDING_VIEWS;
	foreach ( cplms_get_student_classes( $student ) as $class ) {
		$recordings = cplms_parse_lines( get_post_meta( $class->ID, '_cp_recordings', true ) );
		foreach ( $recordings as $r ) {
			if ( md5( $r['url'] ) === $key ) {
				$target_url = $r['url'];
				$limit      = (int) get_post_meta( $class->ID, '_cp_view_limit', true );
				if ( $limit < 1 ) {
					$limit = CPLMS_MAX_RECORDING_VIEWS;
				}
				break 2;
			}
		}
	}
	if ( '' === $target_url ) {
		wp_die( 'Recording கிடைக்கவில்லை.' );
	}

	$views = get_post_meta( $student->ID, '_cp_recording_views', true );
	$views = is_array( $views ) ? $views : array();
	$used  = isset( $views[ $key ] ) ? (int) $views[ $key ] : 0;

	if ( $used >= $limit ) {
		wp_die(
			'<div style="font-family:sans-serif;text-align:center;padding:60px 20px;max-width:480px;margin:0 auto;">'
			. '<h2>மன்னிக்கவும் 🙏</h2>'
			. '<p>இந்த recording-ஐ ஏற்கனவே ' . (int) $limit . ' முறை பார்த்துவிட்டீர்கள். மீண்டும் பார்க்க இயலாது.</p>'
			. '<p><a href="' . esc_url( home_url() ) . '">← திரும்பிச் செல்ல</a></p>'
			. '</div>',
			'பார்வை வரம்பு முடிந்தது'
		);
	}

	$views[ $key ] = $used + 1;
	update_post_meta( $student->ID, '_cp_recording_views', $views );

	wp_redirect( $target_url );
	exit;
}
add_action( 'template_redirect', 'cplms_handle_watch_redirect' );

/* ---------------------------------------------------------------------
 * 7. Activation
 * ------------------------------------------------------------------- */

function cplms_activate() {
	cplms_register_post_types();
	flush_rewrite_rules();
	add_option( 'cplms_whatsapp', '94752495266' );

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

<?php
/**
 * @var object|null $my_profile
 * @var object|null $member
 * @var bool        $editing
 * @var array       $values
 * @var int         $interest_count
 * @var array       $filters
 * @var array       $packages
 * @var array       $settings
 * @var string      $error
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
$mm_status = mm_status_labels();
$mm_active = $member && MM_DB::package_active( $member );
?>
<a class="mm-back" href="<?php echo esc_url( MM_Frontend::logout_url() ); ?>">← வெளியேறு</a>
<div class="mm-section">
	<div class="mm-eyebrow">எனது Dashboard</div>
	<h1 class="mm-h1"><?php echo esc_html( $my_profile ? $my_profile->name : 'உங்கள் கணக்கு' ); ?></h1>
</div>
<?php if ( $error ) : ?>
	<div class="mm-err"><?php echo esc_html( $error ); ?></div>
<?php endif; ?>

<?php if ( mm_is_admin() ) : ?>
	<div class="mm-card"><p class="mm-muted">நீங்கள் நிர்வாகியாக உள்நுழைந்துள்ளீர்கள். <a href="<?php echo esc_url( admin_url( 'admin.php?page=mm-profiles' ) ); ?>">நிர்வாகி பலகை →</a></p></div>
<?php endif; ?>

<div class="mm-section">
	<a class="mm-role-card" href="<?php echo esc_url( MM_Frontend::url( 'browse' ) ); ?>"><span class="mm-role-icon">💞</span><span>துணையைத் தேட (Search Matches)</span></a>
</div>

<form class="mm-card" method="get" action="<?php echo esc_url( MM_Frontend::base_url() ); ?>">
	<?php
	// Keep ?page_id=… (plain permalinks) when the form submits via GET.
	parse_str( (string) wp_parse_url( MM_Frontend::base_url(), PHP_URL_QUERY ), $mm_base_q );
	foreach ( $mm_base_q as $mm_k => $mm_v ) {
		printf( '<input type="hidden" name="%s" value="%s">', esc_attr( $mm_k ), esc_attr( $mm_v ) );
	}
	?>
	<input type="hidden" name="mm" value="browse">
	<div class="mm-eyebrow">விரைவு தேடல் (Quick Search)</div>
	<?php MM_Frontend::render( 'search-fields', array( 'filters' => $filters ) ); ?>
	<button class="mm-btn-primary mm-mt-lg" type="submit">🔍 தேடு</button>
</form>

<div class="mm-section">
	<a class="mm-role-card mm-role-card-rose" href="<?php echo esc_url( MM_Frontend::url( 'interests' ) ); ?>">
		<span class="mm-role-inner"><span class="mm-role-icon">💗</span><span>விருப்பங்கள் பார்க்க</span></span>
		<?php if ( $interest_count > 0 ) : ?>
			<span class="mm-count"><?php echo (int) $interest_count; ?></span>
		<?php endif; ?>
	</a>
</div>

<?php if ( ! $my_profile ) : ?>
	<div class="mm-card"><p class="mm-muted">சுயவிவரம் காணப்படவில்லை.</p></div>
<?php elseif ( ! $editing ) : ?>
	<div class="mm-card">
		<div class="mm-info-grid">
			<div><div class="mm-info-label">Profile ID</div><div class="mm-info-value"><?php echo esc_html( $my_profile->member_id ); ?></div></div>
			<div><div class="mm-info-label">நிலை</div><div class="mm-info-value"><?php echo esc_html( isset( $mm_status[ $my_profile->status ] ) ? $mm_status[ $my_profile->status ] : $my_profile->status ); ?></div></div>
			<div><div class="mm-info-label">வயது</div><div class="mm-info-value"><?php $mm_age = mm_calc_age( $my_profile->dob ); echo esc_html( null !== $mm_age ? $mm_age : '-' ); ?></div></div>
			<div><div class="mm-info-label">மாவட்டம்</div><div class="mm-info-value"><?php echo esc_html( $my_profile->district ? $my_profile->district : '-' ); ?></div></div>
		</div>
		<a class="mm-btn-primary" href="<?php echo esc_url( MM_Frontend::url( 'dashboard', array( 'edit' => 1 ) ) ); ?>">எனது சுயவிவரத்தை திருத்த (Edit Profile)</a>
	</div>
<?php else : ?>
	<form class="mm-card" method="post" enctype="multipart/form-data" action="<?php echo esc_url( MM_Frontend::url( 'dashboard' ) ); ?>">
		<?php MM_Frontend::form_fields( 'save_profile' ); ?>
		<?php
		$mm_urls = array();
		foreach ( MM_DB::photos_of( $my_profile ) as $mm_i => $mm_name ) {
			$mm_urls[] = MM_Photos::url( $my_profile->id, $mm_i );
		}
		MM_Frontend::render( 'profile-fields', array( 'values' => $values, 'photo_urls' => $mm_urls ) );
		?>
		<div class="mm-btn-row">
			<button class="mm-btn-primary" type="submit" data-mm-busy="சேமிக்கிறது…">சேமிக்க</button>
			<a class="mm-btn-ghost" href="<?php echo esc_url( MM_Frontend::url( 'dashboard' ) ); ?>">ரத்து</a>
		</div>
	</form>
<?php endif; ?>

<div class="mm-card">
	<div class="mm-info-label">தற்போதைய Package</div>
	<div class="mm-info-value"><?php echo esc_html( $member && $member->package ? mm_package_label( $member->package ) : 'இல்லை (Free)' ); ?></div>
	<?php if ( $member && $member->package ) : ?>
		<div class="mm-info-label">காலாவதி</div>
		<div class="mm-info-value"><?php echo esc_html( mm_fmt_date( $member->package_expires_at ) ); ?><?php echo $mm_active ? '' : ' — <strong class="mm-danger-text">காலாவதியானது</strong>'; // phpcs:ignore ?></div>
		<div class="mm-info-grid">
			<div><div class="mm-info-label">Photo Credits மீதம்</div><div class="mm-info-value"><?php echo (int) MM_DB::remaining( $member, 'photo' ); ?> / <?php echo (int) $member->photo_quota; ?></div></div>
			<div><div class="mm-info-label">Phone Credits மீதம்</div><div class="mm-info-value"><?php echo (int) MM_DB::remaining( $member, 'phone' ); ?> / <?php echo (int) $member->phone_quota; ?></div></div>
		</div>
	<?php else : ?>
		<p class="mm-muted mm-small">கீழே உள்ள Package-களில் ஒன்றை தேர்ந்தெடுத்து, WhatsApp மூலம் நிர்வாகியை தொடர்பு கொள்ளவும்.</p>
	<?php endif; ?>
</div>

<div class="mm-card">
	<div class="mm-eyebrow">Package விபரங்கள்</div>
	<?php foreach ( $packages as $mm_pkg ) : ?>
		<div class="mm-pkg">
			<div class="mm-pkg-top">
				<div class="mm-pkg-name"><?php echo esc_html( $mm_pkg['label'] ); ?></div>
				<div class="mm-pkg-price">Rs. <?php echo esc_html( number_format_i18n( (float) $mm_pkg['price'] ) ); ?> / <?php echo (int) $mm_pkg['months']; ?> மாதம்</div>
			</div>
			<div class="mm-pkg-meta"><?php echo (int) $mm_pkg['photo_quota']; ?> Photo Unlocks • <?php echo (int) $mm_pkg['phone_quota']; ?> Phone Unlocks</div>
		</div>
	<?php endforeach; ?>
	<?php if ( $settings['admin_whatsapp'] ) : ?>
		<a class="mm-btn-whatsapp mm-mt" target="_blank" rel="noopener noreferrer" href="<?php echo esc_url( mm_wa_link( $settings['admin_whatsapp'], 'வணக்கம், எனது Profile ID ' . ( $my_profile ? $my_profile->member_id : '' ) . ' - எனக்கு ஒரு Package வாங்க விரும்புகிறேன்.' ) ); ?>">
			<?php echo mm_whatsapp_icon(); // phpcs:ignore ?> WhatsApp-ல் நிர்வாகியை தொடர்பு கொள்ள
		</a>
	<?php endif; ?>
</div>

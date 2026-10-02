<?php
/**
 * @var object      $p
 * @var string      $back
 * @var bool        $show_identity
 * @var bool        $show_contact
 * @var object|null $sent        Interest this viewer already sent to $p.
 * @var object|null $member
 * @var object|null $my_profile
 * @var int         $uid
 * @var string      $watermark
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
$mm_is_own         = (int) $p->user_id === (int) $uid;
$mm_photo_left     = $member ? MM_DB::remaining( $member, 'photo' ) : 0;
$mm_phone_left     = $member ? MM_DB::remaining( $member, 'phone' ) : 0;
$mm_photos         = $show_identity ? MM_DB::photos_of( $p ) : array();
$mm_title          = $show_identity && $p->name ? $p->name : 'Profile ' . $p->member_id;
$mm_age            = mm_calc_age( $p->dob );
$mm_sub            = trim( ( null !== $mm_age ? $mm_age . ' வயது' : '' ) . ( $p->height ? ' • ' . $p->height : '' ), ' •' );
$mm_interest_label = mm_interest_status_labels();

$mm_photo_html = function ( $index, $alt ) use ( $p, $watermark ) {
	$wm = str_repeat( '<span>' . esc_html( $watermark ) . '</span>', 9 );
	return sprintf(
		'<button type="button" class="mm-photo" data-mm-zoom="%1$s"><img src="%1$s" alt="%2$s" draggable="false" class="mm-protected"><span class="mm-watermark" aria-hidden="true">%3$s</span></button>',
		esc_url( MM_Photos::url( $p->id, $index ) ),
		esc_attr( $alt ),
		$wm
	);
};
?>
<a class="mm-back" href="<?php echo esc_url( MM_Frontend::url( $back ) ); ?>">← பின்செல்</a>
<div class="mm-section">
	<div class="mm-profile-head">
		<div class="mm-avatar mm-avatar-lg">
			<?php echo $mm_photos ? $mm_photo_html( 0, $mm_title ) : '🔒'; // phpcs:ignore -- escaped in closure. ?>
		</div>
		<div>
			<h1 class="mm-h1 mm-mb0"><?php echo esc_html( $mm_title ); ?></h1>
			<p class="mm-sub"><?php echo esc_html( $mm_sub ); ?></p>
		</div>
	</div>
	<?php if ( count( $mm_photos ) > 1 ) : ?>
		<div class="mm-thumbs">
			<?php for ( $mm_i = 1; $mm_i < count( $mm_photos ); $mm_i++ ) : ?>
				<div class="mm-thumb"><?php echo $mm_photo_html( $mm_i, $mm_title . ' ' . ( $mm_i + 1 ) ); // phpcs:ignore ?></div>
			<?php endfor; ?>
		</div>
	<?php endif; ?>
	<?php if ( $mm_photos ) : ?>
		<p class="mm-hint mm-mt">புகைப்படத்தை tap செய்து பெரிதாக பார்க்கவும்</p>
	<?php endif; ?>
</div>

<div class="mm-card">
	<div class="mm-eyebrow">புகைப்படம் & பெயர்</div>
	<?php if ( $show_identity ) : ?>
		<p class="mm-ok-text">✓ Unlock செய்யப்பட்டது</p>
	<?php else : ?>
		<p class="mm-muted mm-small">பெயர் மற்றும் புகைப்படத்தை பார்க்க 1 Photo Credit தேவை. மீதம் உள்ளது: <strong class="mm-maroon"><?php echo (int) $mm_photo_left; ?></strong></p>
		<form method="post" action="<?php echo esc_url( MM_Frontend::url( 'profile', array( 'id' => $p->id, 'back' => $back ) ) ); ?>">
			<?php MM_Frontend::form_fields( 'unlock' ); ?>
			<input type="hidden" name="profile_id" value="<?php echo (int) $p->id; ?>">
			<input type="hidden" name="unlock_type" value="photo">
			<input type="hidden" name="back" value="<?php echo esc_attr( $back ); ?>">
			<button class="mm-btn-primary" type="submit" <?php disabled( $mm_photo_left <= 0 ); ?>>🔓 புகைப்படம் + பெயர் பார்க்க</button>
		</form>
	<?php endif; ?>
</div>

<div class="mm-card">
	<div class="mm-info-grid">
		<?php
		$mm_fields = array(
			'பிறந்த நேரம்' => $p->birth_time,
			'ராசி'        => $p->rasi,
			'நட்சத்திரம்'  => $p->natchathiram,
			'மதம்'        => $p->religion,
			'ஜாதி'        => $p->caste,
			'தாய்மொழி'    => $p->mother_tongue,
			'நாடு'        => $p->country,
			'மாவட்டம்'    => $p->district,
			'திருமண நிலை' => $p->marital_status,
			'கல்வி'       => $p->education,
			'தொழில்'      => $p->profession,
		);
		foreach ( $mm_fields as $mm_label => $mm_val ) :
			?>
			<div><div class="mm-info-label"><?php echo esc_html( $mm_label ); ?></div><div class="mm-info-value"><?php echo esc_html( '' !== (string) $mm_val ? $mm_val : '-' ); ?></div></div>
		<?php endforeach; ?>
	</div>
	<?php if ( $p->about ) : ?>
		<div class="mm-info-label">தன்னைப் பற்றி</div>
		<p class="mm-about"><?php echo nl2br( esc_html( $p->about ) ); ?></p>
	<?php endif; ?>
</div>

<div class="mm-card">
	<div class="mm-eyebrow">தொடர்பு எண்</div>
	<?php if ( $show_contact ) : ?>
		<div class="mm-info-value">
			<a href="tel:<?php echo esc_attr( mm_digits( $p->phone ) ); ?>"><?php echo esc_html( $p->phone ); ?></a><?php if ( $p->email ) : ?> • <a href="mailto:<?php echo esc_attr( $p->email ); ?>"><?php echo esc_html( $p->email ); ?></a><?php endif; ?>
		</div>
	<?php else : ?>
		<p class="mm-muted mm-small">தொடர்பு எண்ணை பார்க்க 1 Phone Credit தேவை. மீதம் உள்ளது: <strong class="mm-maroon"><?php echo (int) $mm_phone_left; ?></strong></p>
		<form method="post" action="<?php echo esc_url( MM_Frontend::url( 'profile', array( 'id' => $p->id, 'back' => $back ) ) ); ?>">
			<?php MM_Frontend::form_fields( 'unlock' ); ?>
			<input type="hidden" name="profile_id" value="<?php echo (int) $p->id; ?>">
			<input type="hidden" name="unlock_type" value="phone">
			<input type="hidden" name="back" value="<?php echo esc_attr( $back ); ?>">
			<button class="mm-btn-primary" type="submit" <?php disabled( $mm_phone_left <= 0 ); ?>>🔓 தொடர்பு எண் பார்க்க</button>
		</form>
	<?php endif; ?>
</div>

<?php if ( ! $mm_is_own && ! mm_is_admin() ) : ?>
	<div class="mm-card">
		<div class="mm-eyebrow">விருப்பம்</div>
		<p class="mm-muted mm-small">இந்த சுயவிவரத்தில் உங்களுக்கு விருப்பம் இருந்தால் தெரிவிக்கவும். இது வெறும் ஒரு "விருப்பம்" குறிப்பு மட்டும் — உங்கள் தொடர்பு எண் அல்லது புகைப்படம் இதனால் யாருக்கும் தெரியாது.</p>
		<?php if ( $sent ) : ?>
			<div class="mm-flash mm-flash-inline">விருப்பம் தெரிவிக்கப்பட்டது — <?php echo esc_html( isset( $mm_interest_label[ $sent->status ] ) ? $mm_interest_label[ $sent->status ] : $sent->status ); ?></div>
		<?php else : ?>
			<form method="post" action="<?php echo esc_url( MM_Frontend::url( 'profile', array( 'id' => $p->id, 'back' => $back ) ) ); ?>">
				<?php MM_Frontend::form_fields( 'interest' ); ?>
				<input type="hidden" name="profile_id" value="<?php echo (int) $p->id; ?>">
				<input type="hidden" name="back" value="<?php echo esc_attr( $back ); ?>">
				<button class="mm-btn-primary" type="submit" <?php disabled( ! $my_profile ); ?> data-mm-busy="அனுப்புகிறது…">💗 விருப்பம் தெரிவிக்க</button>
			</form>
		<?php endif; ?>
	</div>
<?php endif; ?>

<div class="mm-zoom" hidden>
	<button type="button" class="mm-zoom-close" aria-label="மூட">×</button>
	<div class="mm-zoom-frame">
		<img src="" alt="" draggable="false" class="mm-protected">
		<span class="mm-watermark" aria-hidden="true"><?php echo str_repeat( '<span>' . esc_html( $watermark ) . '</span>', 9 ); // phpcs:ignore ?></span>
	</div>
</div>

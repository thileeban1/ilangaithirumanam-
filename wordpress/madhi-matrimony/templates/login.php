<?php
/** @var string $phone @var string $error */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<a class="mm-back" href="<?php echo esc_url( MM_Frontend::url() ); ?>">← பின்செல்</a>
<div class="mm-section">
	<div class="mm-eyebrow">உறுப்பினர் நுழைவு</div>
	<h1 class="mm-h1">உங்கள் Dashboard-க்கு உள்நுழையவும்</h1>
</div>
<?php if ( $error ) : ?>
	<div class="mm-err"><?php echo esc_html( $error ); ?></div>
<?php endif; ?>
<form class="mm-card" method="post" action="<?php echo esc_url( MM_Frontend::url( 'login' ) ); ?>">
	<?php MM_Frontend::form_fields( 'login' ); ?>
	<label class="mm-label">பதிவு செய்த தொடர்பு எண்</label>
	<input class="mm-input" name="phone" value="<?php echo esc_attr( $phone ); ?>" placeholder="+94 7X XXX XXXX" autocomplete="username" required>
	<label class="mm-label">கடவுச்சொல்</label>
	<input class="mm-input" type="password" name="password" placeholder="கடவுச்சொல்" autocomplete="current-password" required>
	<button class="mm-btn-primary" type="submit" data-mm-busy="உள்நுழைகிறது…">LOGIN NOW</button>
	<p class="mm-center mm-hint mm-mt">கணக்கு இல்லையா? <a href="<?php echo esc_url( MM_Frontend::url( 'register' ) ); ?>">சுயவிவரம் பதிவு செய்யவும்</a></p>
	<p class="mm-center mm-hint">கடவுச்சொல் மறந்துவிட்டால் நிர்வாகியை WhatsApp-ல் தொடர்பு கொள்ளவும்.</p>
</form>

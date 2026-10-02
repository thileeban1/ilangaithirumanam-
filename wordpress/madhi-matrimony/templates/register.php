<?php
/** @var array $values @var string $error */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<a class="mm-back" href="<?php echo esc_url( MM_Frontend::url() ); ?>">← பின்செல்</a>
<div class="mm-section">
	<div class="mm-eyebrow">சுயவிவரம் பதிவு</div>
	<h1 class="mm-h1">உங்கள் விவரங்களை உள்ளிடவும்</h1>
</div>
<?php if ( $error ) : ?>
	<div class="mm-err"><?php echo esc_html( $error ); ?></div>
<?php endif; ?>
<?php if ( $uid ) : ?>
	<div class="mm-card"><p class="mm-muted">நீங்கள் ஏற்கனவே உள்நுழைந்துள்ளீர்கள். <a href="<?php echo esc_url( MM_Frontend::url( 'dashboard' ) ); ?>">எனது Dashboard</a></p></div>
<?php else : ?>
	<form class="mm-card" method="post" enctype="multipart/form-data" action="<?php echo esc_url( MM_Frontend::url( 'register' ) ); ?>">
		<?php MM_Frontend::form_fields( 'register' ); ?>
		<?php MM_Frontend::render( 'profile-fields', array( 'values' => $values ) ); ?>
		<label class="mm-label">கடவுச்சொல் * (login-க்கு பயன்படும்)</label>
		<input class="mm-input" type="password" name="password" minlength="6" placeholder="குறைந்தது 6 எழுத்துகள்" autocomplete="new-password" required>
		<label class="mm-label">கடவுச்சொல் மீண்டும் *</label>
		<input class="mm-input" type="password" name="password_confirm" minlength="6" autocomplete="new-password" required>
		<button class="mm-btn-primary" type="submit" data-mm-busy="சமர்ப்பிக்கிறது…">சுயவிவரத்தை சமர்ப்பிக்க</button>
	</form>
<?php endif; ?>

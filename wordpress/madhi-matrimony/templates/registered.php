<?php
/** @var object|null $my_profile */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<a class="mm-back" href="<?php echo esc_url( MM_Frontend::url() ); ?>">← முகப்புக்கு</a>
<div class="mm-section">
	<div class="mm-eyebrow">நன்றி</div>
	<h1 class="mm-h1">உங்கள் சுயவிவரம் பதிவு செய்யப்பட்டது</h1>
</div>
<div class="mm-card">
	<?php if ( $my_profile ) : ?>
		<div class="mm-info-label">உங்கள் Profile ID</div>
		<div class="mm-big-id"><?php echo esc_html( $my_profile->member_id ); ?></div>
	<?php endif; ?>
	<p class="mm-muted">நிர்வாகி பரிசீலித்து ஏற்றுக்கொண்ட பின் உங்கள் சுயவிவரம் பொதுவில் காணப்படும். உங்கள் தொடர்பு எண் + கடவுச்சொல் வைத்து "உறுப்பினர்" பட்டன் மூலம் எப்போதும் login செய்து உங்கள் status-ஐ பார்க்கலாம்.</p>
</div>
<div class="mm-pad"><a class="mm-btn-ghost" href="<?php echo esc_url( MM_Frontend::url( 'dashboard' ) ); ?>">எனது Dashboard-க்கு செல்ல</a></div>

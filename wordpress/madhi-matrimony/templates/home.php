<?php
/** @var array $settings */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<div class="mm-banner">
	<svg class="mm-rings" width="96" height="72" viewBox="0 0 96 72" fill="none" aria-hidden="true">
		<circle cx="36" cy="40" r="22" stroke="#F6E3B4" stroke-width="4" opacity="0.9"/>
		<circle cx="60" cy="40" r="22" stroke="#FBEFD4" stroke-width="4" opacity="0.7"/>
		<path d="M40 16 L44 24 L36 24 Z" fill="#F6E3B4" opacity="0.9"/>
		<circle cx="40" cy="14" r="2.5" fill="#F6E3B4" opacity="0.9"/>
	</svg>
	<div class="mm-eyebrow mm-on-dark">வரவேற்கிறோம் (Welcome)</div>
	<h1 class="mm-h1 mm-on-dark-strong"><?php echo esc_html( $settings['site_name'] ); ?></h1>
	<p class="mm-sub mm-on-dark-soft"><?php echo esc_html( $settings['tagline'] ); ?></p>
</div>

<div class="mm-section">
	<div class="mm-section-title">தொடர்வது எப்படி? (Get Started)</div>
	<?php if ( ! $uid ) : ?>
		<a class="mm-role-card" href="<?php echo esc_url( MM_Frontend::url( 'register' ) ); ?>"><span class="mm-role-icon">📝</span><span>சுயவிவரம் பதிவு செய்ய (Register)</span></a>
	<?php endif; ?>
	<a class="mm-role-card" href="<?php echo esc_url( MM_Frontend::url( $uid ? 'dashboard' : 'login' ) ); ?>"><span class="mm-role-icon">👤</span><span>உறுப்பினர் (Login) / Dashboard</span></a>
</div>

<div class="mm-section">
	<div class="mm-card mm-card-flush">
		<p class="mm-muted mm-small">நீங்கள் பதிவு செய்யும் சுயவிவரம் நிர்வாகியால் பரிசீலிக்கப்பட்ட பின் மட்டுமே பொதுவில் காணப்படும்.</p>
	</div>
</div>

<?php if ( $settings['admin_whatsapp'] ) : ?>
	<div class="mm-pad">
		<a class="mm-btn-whatsapp" target="_blank" rel="noopener noreferrer" href="<?php echo esc_url( mm_wa_link( $settings['admin_whatsapp'], 'வணக்கம், ' . $settings['site_name'] . ' பற்றி விசாரிக்க விரும்புகிறேன்.' ) ); ?>">
			<?php echo mm_whatsapp_icon(); // phpcs:ignore -- static SVG. ?> WhatsApp-ல் தொடர்பு கொள்ள
		</a>
	</div>
<?php endif; ?>

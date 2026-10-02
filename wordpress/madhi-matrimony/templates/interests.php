<?php
/**
 * @var object[] $received
 * @var object[] $sent
 * @var object[] $profiles  keyed by id
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
$mm_labels = mm_interest_status_labels();
?>
<a class="mm-back" href="<?php echo esc_url( MM_Frontend::url( 'dashboard' ) ); ?>">← பின்செல்</a>
<div class="mm-section">
	<div class="mm-eyebrow">விருப்பங்கள்</div>
	<h1 class="mm-h1">எனது விருப்பங்கள்</h1>
</div>

<div class="mm-section">
	<div class="mm-section-title">📥 எனக்கு வந்த விருப்பங்கள் (<?php echo count( $received ); ?>)</div>
</div>
<div class="mm-card">
	<?php if ( ! $received ) : ?>
		<p class="mm-muted">இதுவரை யாரும் விருப்பம் தெரிவிக்கவில்லை.</p>
	<?php endif; ?>
	<?php foreach ( $received as $mm_it ) : ?>
		<?php $mm_from = isset( $profiles[ (int) $mm_it->requester_profile_id ] ) ? $profiles[ (int) $mm_it->requester_profile_id ] : null; ?>
		<div class="mm-item">
			<?php if ( $mm_from && 'approved' === $mm_from->status ) : ?>
				<a class="mm-item-link" href="<?php echo esc_url( MM_Frontend::url( 'profile', array( 'id' => $mm_from->id, 'back' => 'interests' ) ) ); ?>">Profile <?php echo esc_html( $mm_from->member_id ); ?> சுயவிவரத்தை பார்க்க →</a>
				<div class="mm-hint"><?php echo esc_html( trim( mm_profile_summary( $mm_from, false ) . ' • ' . mm_fmt_date( $mm_it->created_at ), ' •' ) ); ?></div>
			<?php else : ?>
				<div class="mm-item-title">சுயவிவரம்</div>
				<div class="mm-hint"><?php echo esc_html( mm_fmt_date( $mm_it->created_at ) ); ?></div>
			<?php endif; ?>

			<?php if ( 'pending' === $mm_it->status ) : ?>
				<form method="post" class="mm-btn-row mm-mt" action="<?php echo esc_url( MM_Frontend::url( 'interests' ) ); ?>">
					<?php MM_Frontend::form_fields( 'respond' ); ?>
					<input type="hidden" name="interest_id" value="<?php echo (int) $mm_it->id; ?>">
					<button class="mm-btn-primary mm-btn-auto" type="submit" name="status" value="accepted">ஏற்றுக்கொள்</button>
					<button class="mm-btn-ghost mm-btn-auto" type="submit" name="status" value="rejected">நிராகரி</button>
				</form>
			<?php elseif ( 'accepted' === $mm_it->status ) : ?>
				<p class="mm-ok-text mm-small">✓ ஏற்றுக்கொண்டீர்கள்</p>
			<?php else : ?>
				<p class="mm-danger-text mm-small">நிராகரித்தீர்கள்</p>
			<?php endif; ?>
		</div>
	<?php endforeach; ?>
</div>

<div class="mm-section">
	<div class="mm-section-title">📤 நான் தெரிவித்த விருப்பங்கள் (<?php echo count( $sent ); ?>)</div>
</div>
<div class="mm-card">
	<?php if ( ! $sent ) : ?>
		<p class="mm-muted">நீங்கள் இதுவரை யாருக்கும் விருப்பம் தெரிவிக்கவில்லை.</p>
	<?php endif; ?>
	<?php foreach ( $sent as $mm_it ) : ?>
		<?php $mm_to = isset( $profiles[ (int) $mm_it->profile_id ] ) ? $profiles[ (int) $mm_it->profile_id ] : null; ?>
		<div class="mm-item">
			<?php if ( $mm_to && 'approved' === $mm_to->status ) : ?>
				<a class="mm-item-link" href="<?php echo esc_url( MM_Frontend::url( 'profile', array( 'id' => $mm_to->id, 'back' => 'interests' ) ) ); ?>">Profile <?php echo esc_html( $mm_to->member_id ); ?></a>
			<?php else : ?>
				<div class="mm-item-title">சுயவிவரம்</div>
			<?php endif; ?>
			<div class="mm-hint"><?php echo esc_html( mm_fmt_date( $mm_it->created_at ) . ' • ' . ( isset( $mm_labels[ $mm_it->status ] ) ? $mm_labels[ $mm_it->status ] : $mm_it->status ) ); ?></div>
		</div>
	<?php endforeach; ?>
</div>

<?php
/**
 * @var array $filters
 * @var array $rows
 * @var int   $total
 * @var int   $page
 * @var int[] $unlocked
 * @var int   $uid
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
$mm_adv_open = '' !== $filters['district'] || '' !== $filters['marital_status'] || '' !== $filters['profession'] || '' !== $filters['education'];
?>
<a class="mm-back" href="<?php echo esc_url( MM_Frontend::url( 'dashboard' ) ); ?>">← பின்செல்</a>
<div class="mm-section">
	<div class="mm-eyebrow">சுயவிவரங்கள்</div>
	<h1 class="mm-h1">பொருத்தமான துணையைத் தேடுங்கள்</h1>
</div>

<form class="mm-card" method="get" action="<?php echo esc_url( MM_Frontend::base_url() ); ?>">
	<?php
	parse_str( (string) wp_parse_url( MM_Frontend::base_url(), PHP_URL_QUERY ), $mm_base_q );
	foreach ( $mm_base_q as $mm_k => $mm_v ) {
		printf( '<input type="hidden" name="%s" value="%s">', esc_attr( $mm_k ), esc_attr( $mm_v ) );
	}
	?>
	<input type="hidden" name="mm" value="browse">
	<?php MM_Frontend::render( 'search-fields', array( 'filters' => $filters ) ); ?>

	<button class="mm-btn-ghost mm-mt" type="button" data-mm-toggle="mm-adv" aria-expanded="<?php echo $mm_adv_open ? 'true' : 'false'; ?>">
		<span data-mm-arrow><?php echo $mm_adv_open ? '▲' : '▼'; ?></span> மேலும் தேடல் விருப்பங்கள் (Advanced Search)
	</button>
	<div id="mm-adv" class="mm-mt" <?php echo $mm_adv_open ? '' : 'hidden'; ?>>
		<label class="mm-label">மாவட்டம்</label>
		<input class="mm-input" name="district" value="<?php echo esc_attr( $filters['district'] ); ?>" placeholder="எ.கா. யாழ்ப்பாணம்">
		<label class="mm-label">திருமண நிலை</label>
		<?php MM_Frontend::select( 'marital_status', mm_marital_statuses(), $filters['marital_status'], 'அனைத்தும்' ); ?>
		<label class="mm-label">தொழில்</label>
		<input class="mm-input" name="profession" value="<?php echo esc_attr( $filters['profession'] ); ?>" placeholder="எ.கா. ஆசிரியர்">
		<label class="mm-label">கல்வித் தகுதி</label>
		<input class="mm-input" name="education" value="<?php echo esc_attr( $filters['education'] ); ?>" placeholder="எ.கா. பட்டதாரி">
	</div>
	<button class="mm-btn-primary mm-mt" type="submit">🔍 தேடு</button>
</form>

<?php if ( ! $rows ) : ?>
	<div class="mm-card"><p class="mm-muted">பொருந்தும் சுயவிவரங்கள் இல்லை.</p></div>
<?php else : ?>
	<div class="mm-pad mm-hint mm-mb"><?php echo (int) $total; ?> சுயவிவரங்கள்</div>
<?php endif; ?>

<?php foreach ( $rows as $mm_p ) : ?>
	<?php $mm_unlocked = in_array( (int) $mm_p->id, $unlocked, true ) || (int) $mm_p->user_id === (int) $uid || mm_is_admin(); ?>
	<a class="mm-profile-card" href="<?php echo esc_url( MM_Frontend::url( 'profile', array( 'id' => $mm_p->id, 'back' => 'browse' ) ) ); ?>">
		<div class="mm-avatar">
			<?php if ( $mm_unlocked && MM_DB::photos_of( $mm_p ) ) : ?>
				<img src="<?php echo esc_url( MM_Photos::url( $mm_p->id, 0 ) ); ?>" alt="" draggable="false" class="mm-protected">
			<?php else : ?>
				<?php echo esc_html( $mm_unlocked ? ( 'பெண்' === $mm_p->gender ? '👰' : '🤵' ) : '🔒' ); ?>
			<?php endif; ?>
		</div>
		<div class="mm-grow">
			<div class="mm-card-title">Profile <?php echo esc_html( $mm_p->member_id ); ?></div>
			<div class="mm-muted mm-small"><?php echo esc_html( mm_profile_summary( $mm_p ) ); ?></div>
		</div>
	</a>
<?php endforeach; ?>

<?php
$mm_pages = (int) ceil( $total / MM_PER_PAGE );
if ( $mm_pages > 1 ) :
	$mm_q = array_filter( $filters, 'strlen' );
	?>
	<div class="mm-pager">
		<?php if ( $page > 1 ) : ?>
			<a class="mm-pill" href="<?php echo esc_url( MM_Frontend::url( 'browse', $mm_q + array( 'pg' => $page - 1 ) ) ); ?>">← முந்தைய</a>
		<?php endif; ?>
		<span class="mm-hint"><?php echo (int) $page; ?> / <?php echo (int) $mm_pages; ?></span>
		<?php if ( $page < $mm_pages ) : ?>
			<a class="mm-pill" href="<?php echo esc_url( MM_Frontend::url( 'browse', $mm_q + array( 'pg' => $page + 1 ) ) ); ?>">அடுத்த →</a>
		<?php endif; ?>
	</div>
<?php endif; ?>

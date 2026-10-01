<?php
/** @var string $active */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
$mm_nav = array(
	'dashboard' => array( '🏠', 'Dashboard' ),
	'browse'    => array( '🔍', 'தேடல்' ),
	'interests' => array( '💌', 'விருப்பங்கள்' ),
);
?>
<div class="mm-nav-spacer"></div>
<nav class="mm-bottom-nav">
	<?php foreach ( $mm_nav as $mm_key => $mm_item ) : ?>
		<a href="<?php echo esc_url( MM_Frontend::url( $mm_key ) ); ?>" class="<?php echo $active === $mm_key ? 'is-active' : ''; ?>">
			<span class="mm-nav-icon"><?php echo esc_html( $mm_item[0] ); ?></span><?php echo esc_html( $mm_item[1] ); ?>
		</a>
	<?php endforeach; ?>
</nav>

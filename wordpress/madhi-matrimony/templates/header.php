<?php
/** @var array $settings */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<div class="mm-header">
	<a class="mm-brand" href="<?php echo esc_url( MM_Frontend::url() ); ?>"><?php echo esc_html( $settings['site_name'] ); ?></a>
	<?php
	// Deliberately unlabeled: a plain icon doesn't invite casual visitors to
	// try the admin login, while an admin who knows it's there can use it.
	?>
	<a class="mm-gear" href="<?php echo esc_url( admin_url( 'admin.php?page=mm-profiles' ) ); ?>" aria-label="Site settings">⚙</a>
</div>

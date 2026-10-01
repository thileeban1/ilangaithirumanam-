<?php
/**
 * Quick filters (gender, religion, age) shared by the dashboard's quick
 * search and the full search screen.
 *
 * @var array $filters
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<label class="mm-label">பாலினம்</label>
<?php MM_Frontend::select( 'gender', mm_genders(), $filters['gender'], 'அனைத்தும்' ); ?>
<label class="mm-label">மதம்</label>
<?php MM_Frontend::select( 'religion', mm_religions(), $filters['religion'], 'அனைத்தும்' ); ?>
<div class="mm-row2">
	<div>
		<label class="mm-label">குறைந்த வயது</label>
		<input class="mm-input mm-mb0" type="number" min="18" max="120" name="min_age" value="<?php echo esc_attr( $filters['min_age'] ); ?>">
	</div>
	<div>
		<label class="mm-label">அதிக வயது</label>
		<input class="mm-input mm-mb0" type="number" min="18" max="120" name="max_age" value="<?php echo esc_attr( $filters['max_age'] ); ?>">
	</div>
</div>

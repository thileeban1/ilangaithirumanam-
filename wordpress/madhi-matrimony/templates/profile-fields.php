<?php
/**
 * Profile form fields shared by registration, a member's own edit and the
 * admin edit screen.
 *
 * @var array    $values
 * @var string[] $photo_urls  Existing photo URLs (edit only).
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
$photo_urls = isset( $photo_urls ) ? $photo_urls : array();
$mm_hindu   = 'இந்து' === $values['religion'];
?>
<label class="mm-label">பெயர் *</label>
<input class="mm-input" name="mmf[name]" value="<?php echo esc_attr( $values['name'] ); ?>" placeholder="முழுப் பெயர்" required>

<label class="mm-label">பாலினம் *</label>
<?php MM_Frontend::select( 'mmf[gender]', mm_genders(), $values['gender'], 'தேர்ந்தெடுக்கவும்', 'required' ); ?>

<label class="mm-label">பிறந்த தேதி *</label>
<input class="mm-input" type="date" name="mmf[dob]" max="<?php echo esc_attr( current_time( 'Y-m-d' ) ); ?>" value="<?php echo esc_attr( $values['dob'] ); ?>" required>

<label class="mm-label">மதம்</label>
<?php MM_Frontend::select( 'mmf[religion]', mm_religions(), $values['religion'], 'தேர்ந்தெடுக்கவும்', 'data-mm-religion' ); ?>

<div class="mm-hindu-only" <?php echo $mm_hindu ? '' : 'hidden'; ?>>
	<label class="mm-label">பிறந்த நேரம் (விருப்பம்)</label>
	<input class="mm-input" type="time" name="mmf[birth_time]" value="<?php echo esc_attr( $values['birth_time'] ); ?>">

	<label class="mm-label">ராசி (விருப்பம்)</label>
	<?php MM_Frontend::select( 'mmf[rasi]', mm_rasis(), $values['rasi'] ); ?>

	<label class="mm-label">நட்சத்திரம் (விருப்பம்)</label>
	<?php MM_Frontend::select( 'mmf[natchathiram]', mm_natchathirams(), $values['natchathiram'] ); ?>
</div>

<label class="mm-label">உயரம் (எ.கா. 5'6")</label>
<input class="mm-input" name="mmf[height]" value="<?php echo esc_attr( $values['height'] ); ?>" placeholder="5'6&quot;">

<label class="mm-label">ஜாதி (விருப்பம்)</label>
<input class="mm-input" name="mmf[caste]" value="<?php echo esc_attr( $values['caste'] ); ?>">

<label class="mm-label">தாய்மொழி</label>
<input class="mm-input" name="mmf[mother_tongue]" value="<?php echo esc_attr( $values['mother_tongue'] ); ?>">

<label class="mm-label">நாடு</label>
<input class="mm-input" name="mmf[country]" value="<?php echo esc_attr( $values['country'] ); ?>">

<label class="mm-label">மாவட்டம் / வசிக்கும் இடம்</label>
<input class="mm-input" name="mmf[district]" value="<?php echo esc_attr( $values['district'] ); ?>" placeholder="எ.கா. யாழ்ப்பாணம்">

<label class="mm-label">திருமண நிலை</label>
<?php MM_Frontend::select( 'mmf[marital_status]', mm_marital_statuses(), $values['marital_status'] ); ?>

<label class="mm-label">கல்வித் தகுதி</label>
<input class="mm-input" name="mmf[education]" value="<?php echo esc_attr( $values['education'] ); ?>">

<label class="mm-label">தொழில்</label>
<input class="mm-input" name="mmf[profession]" value="<?php echo esc_attr( $values['profession'] ); ?>">

<label class="mm-label">புகைப்படங்கள் * (குறைந்தது 1, அதிகபட்சம் <?php echo (int) MM_MAX_PHOTOS; ?>)</label>
<?php if ( $photo_urls ) : ?>
	<div class="mm-photo-previews">
		<?php foreach ( $photo_urls as $mm_i => $mm_url ) : ?>
			<label class="mm-photo-preview">
				<img src="<?php echo esc_url( $mm_url ); ?>" alt="">
				<span><input type="checkbox" name="remove_photo[]" value="<?php echo (int) $mm_i; ?>"> நீக்கு</span>
			</label>
		<?php endforeach; ?>
	</div>
<?php endif; ?>
<input class="mm-input" type="file" name="mm_photos[]" accept="image/*" multiple>
<div class="mm-hint">ஒரே நேரத்தில் பல படங்களை தேர்ந்தெடுக்கலாம். படங்கள் தானாக சிறிதாக்கப்படும்.</div>

<label class="mm-label">தன்னைப் பற்றி</label>
<textarea class="mm-input mm-textarea" name="mmf[about]" placeholder="குடும்பம், பொழுதுபோக்கு, எதிர்பார்ப்பு போன்றவை..."><?php echo esc_textarea( $values['about'] ); ?></textarea>

<label class="mm-label">தொடர்பு எண் *</label>
<input class="mm-input" name="mmf[phone]" value="<?php echo esc_attr( $values['phone'] ); ?>" placeholder="+94 7X XXX XXXX" required>

<label class="mm-label">மின்னஞ்சல் (விருப்பம்)</label>
<input class="mm-input" type="email" name="mmf[email]" value="<?php echo esc_attr( $values['email'] ); ?>">

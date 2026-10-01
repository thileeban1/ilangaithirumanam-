<?php
/**
 * Plugin Name:       Madhi Matrimony (மதி மேட்ரிமோனி)
 * Description:       இலங்கை தமிழர் திருமண மையம் — சுயவிவர பதிவு, நிர்வாகி அனுமதி, தேடல், Photo/Phone unlock credits, Packages, விருப்பங்கள் (interests). Shortcode: [madhi_matrimony]
 * Version:           1.0.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Madhi Matrimony
 * License:           GPL-2.0-or-later
 * Text Domain:       madhi-matrimony
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'MM_VERSION', '1.0.0' );
define( 'MM_FILE', __FILE__ );
define( 'MM_DIR', plugin_dir_path( __FILE__ ) );
define( 'MM_URL', plugin_dir_url( __FILE__ ) );

require_once MM_DIR . 'includes/helpers.php';
require_once MM_DIR . 'includes/class-mm-db.php';
require_once MM_DIR . 'includes/class-mm-photos.php';
require_once MM_DIR . 'includes/class-mm-members.php';
require_once MM_DIR . 'includes/class-mm-frontend.php';
require_once MM_DIR . 'includes/class-mm-admin.php';

register_activation_hook( __FILE__, array( 'MM_DB', 'activate' ) );

add_action( 'plugins_loaded', array( 'MM_DB', 'maybe_upgrade' ) );
MM_Photos::init();
MM_Members::init();
MM_Frontend::init();
MM_Admin::init();

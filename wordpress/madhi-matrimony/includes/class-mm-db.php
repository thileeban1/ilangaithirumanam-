<?php
/**
 * Custom tables and every query the plugin runs.
 *
 * Unlike the Firebase version, nothing private ever reaches the browser
 * unless PHP decided the viewer may see it, so name/photos/phone/email can
 * live on the same row as the public "meters" — every read goes through
 * MM_DB::can_see_identity() / can_see_contact() before it's rendered.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MM_DB {

	const SCHEMA_VERSION = '1';

	public static function profiles() {
		global $wpdb;
		return $wpdb->prefix . 'mm_profiles';
	}

	public static function members() {
		global $wpdb;
		return $wpdb->prefix . 'mm_members';
	}

	public static function unlocks() {
		global $wpdb;
		return $wpdb->prefix . 'mm_unlocks';
	}

	public static function interests() {
		global $wpdb;
		return $wpdb->prefix . 'mm_interests';
	}

	public static function activate() {
		self::install();
		add_role( MM_MEMBER_ROLE, 'Matrimony உறுப்பினர்', array( 'read' => true ) );
		$admin = get_role( 'administrator' );
		if ( $admin ) {
			$admin->add_cap( MM_ADMIN_CAP );
		}
		MM_Photos::ensure_private_dir();
		MM_Frontend::ensure_page();
	}

	public static function maybe_upgrade() {
		if ( get_option( 'mm_schema_version' ) !== self::SCHEMA_VERSION ) {
			self::activate();
		}
	}

	public static function install() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		$charset = $wpdb->get_charset_collate();

		dbDelta(
			'CREATE TABLE ' . self::profiles() . " (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			member_id int(10) unsigned NOT NULL,
			user_id bigint(20) unsigned NOT NULL,
			status varchar(20) NOT NULL DEFAULT 'pending',
			gender varchar(40) NOT NULL DEFAULT '',
			dob date DEFAULT NULL,
			birth_time varchar(10) NOT NULL DEFAULT '',
			rasi varchar(60) NOT NULL DEFAULT '',
			natchathiram varchar(60) NOT NULL DEFAULT '',
			height varchar(30) NOT NULL DEFAULT '',
			religion varchar(60) NOT NULL DEFAULT '',
			caste varchar(120) NOT NULL DEFAULT '',
			mother_tongue varchar(60) NOT NULL DEFAULT '',
			country varchar(120) NOT NULL DEFAULT '',
			district varchar(120) NOT NULL DEFAULT '',
			marital_status varchar(60) NOT NULL DEFAULT '',
			education varchar(191) NOT NULL DEFAULT '',
			profession varchar(191) NOT NULL DEFAULT '',
			about text NOT NULL,
			name varchar(191) NOT NULL DEFAULT '',
			phone varchar(40) NOT NULL DEFAULT '',
			email varchar(191) NOT NULL DEFAULT '',
			photos text NOT NULL,
			created_at datetime NOT NULL,
			updated_at datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY member_id (member_id),
			UNIQUE KEY user_id (user_id),
			KEY status (status)
			) $charset;"
		);

		dbDelta(
			'CREATE TABLE ' . self::members() . " (
			user_id bigint(20) unsigned NOT NULL,
			package varchar(40) DEFAULT NULL,
			package_expires_at datetime DEFAULT NULL,
			photo_quota int(10) unsigned NOT NULL DEFAULT 0,
			photo_used int(10) unsigned NOT NULL DEFAULT 0,
			phone_quota int(10) unsigned NOT NULL DEFAULT 0,
			phone_used int(10) unsigned NOT NULL DEFAULT 0,
			PRIMARY KEY  (user_id)
			) $charset;"
		);

		dbDelta(
			'CREATE TABLE ' . self::unlocks() . " (
			user_id bigint(20) unsigned NOT NULL,
			profile_id bigint(20) unsigned NOT NULL,
			type varchar(10) NOT NULL,
			created_at datetime NOT NULL,
			PRIMARY KEY  (user_id,profile_id,type)
			) $charset;"
		);

		dbDelta(
			'CREATE TABLE ' . self::interests() . " (
			id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
			profile_id bigint(20) unsigned NOT NULL,
			recipient_user_id bigint(20) unsigned NOT NULL,
			requester_user_id bigint(20) unsigned NOT NULL,
			requester_profile_id bigint(20) unsigned NOT NULL,
			status varchar(20) NOT NULL DEFAULT 'pending',
			created_at datetime NOT NULL,
			PRIMARY KEY  (id),
			UNIQUE KEY pair (requester_user_id,profile_id),
			KEY recipient_user_id (recipient_user_id)
			) $charset;"
		);

		update_option( 'mm_schema_version', self::SCHEMA_VERSION );
	}

	// ---------- profiles ----------

	public static function get_profile( $id ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::profiles() . ' WHERE id = %d', $id ) );
	}

	public static function get_profile_by_user( $user_id ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::profiles() . ' WHERE user_id = %d', $user_id ) );
	}

	/** Profiles keyed by id, for resolving many interest rows at once. */
	public static function get_profiles_by_ids( $ids ) {
		global $wpdb;
		$ids = array_values( array_unique( array_filter( array_map( 'intval', (array) $ids ) ) ) );
		if ( ! $ids ) {
			return array();
		}
		$in   = implode( ',', $ids );
		$rows = $wpdb->get_results( 'SELECT * FROM ' . self::profiles() . " WHERE id IN ($in)" ); // phpcs:ignore WordPress.DB.PreparedSQL -- ints only.
		$out  = array();
		foreach ( $rows as $r ) {
			$out[ (int) $r->id ] = $r;
		}
		return $out;
	}

	public static function count_by_status() {
		global $wpdb;
		$counts = array( 'pending' => 0, 'approved' => 0, 'rejected' => 0 );
		foreach ( $wpdb->get_results( 'SELECT status, COUNT(*) AS n FROM ' . self::profiles() . ' GROUP BY status' ) as $r ) {
			$counts[ $r->status ] = (int) $r->n;
		}
		return $counts;
	}

	public static function list_by_status( $status ) {
		global $wpdb;
		return $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . self::profiles() . ' WHERE status = %s ORDER BY created_at DESC, id DESC', $status ) );
	}

	/**
	 * Approved profiles matching the search filters. Returns [rows, total].
	 */
	public static function search( $f, $page = 1 ) {
		global $wpdb;
		$where = array( "status = 'approved'" );
		$args  = array();

		foreach ( array( 'gender' => 'gender', 'religion' => 'religion', 'marital_status' => 'marital_status' ) as $key => $col ) {
			if ( '' !== $f[ $key ] ) {
				$where[] = "$col = %s";
				$args[]  = $f[ $key ];
			}
		}
		foreach ( array( 'district', 'profession', 'education' ) as $col ) {
			if ( '' !== $f[ $col ] ) {
				$where[] = "$col LIKE %s";
				$args[]  = '%' . $wpdb->esc_like( $f[ $col ] ) . '%';
			}
		}
		$today = new DateTimeImmutable( 'today', wp_timezone() );
		if ( '' !== $f['min_age'] ) {
			// age >= min  <=>  born on or before today minus min years
			$where[] = 'dob IS NOT NULL AND dob <= %s';
			$args[]  = $today->modify( '-' . (int) $f['min_age'] . ' years' )->format( 'Y-m-d' );
		}
		if ( '' !== $f['max_age'] ) {
			// age <= max  <=>  born after today minus (max + 1) years
			$where[] = 'dob IS NOT NULL AND dob > %s';
			$args[]  = $today->modify( '-' . ( (int) $f['max_age'] + 1 ) . ' years' )->format( 'Y-m-d' );
		}

		$sql_where = implode( ' AND ', $where );
		$count_sql = 'SELECT COUNT(*) FROM ' . self::profiles() . " WHERE $sql_where";
		$total     = (int) ( $args ? $wpdb->get_var( $wpdb->prepare( $count_sql, $args ) ) : $wpdb->get_var( $count_sql ) );

		$offset = max( 0, ( (int) $page - 1 ) * MM_PER_PAGE );
		$sql    = 'SELECT * FROM ' . self::profiles() . " WHERE $sql_where ORDER BY created_at DESC, id DESC LIMIT %d OFFSET %d";
		$rows   = $wpdb->get_results( $wpdb->prepare( $sql, array_merge( $args, array( MM_PER_PAGE, $offset ) ) ) );
		return array( $rows, $total );
	}

	/**
	 * Hands out the next sequential 5-digit Profile ID. The UNIQUE index on
	 * member_id is what actually guarantees no two members share one: if two
	 * registrations race, the loser's insert fails and it retries with the
	 * next number.
	 */
	public static function insert_profile( $data ) {
		global $wpdb;
		$now = current_time( 'mysql' );
		for ( $attempt = 0; $attempt < 5; $attempt++ ) {
			$max       = (int) $wpdb->get_var( 'SELECT MAX(member_id) FROM ' . self::profiles() );
			$member_id = max( MM_FIRST_MEMBER_ID, $max + 1 );
			$ok        = $wpdb->insert(
				self::profiles(),
				array_merge(
					$data,
					array(
						'member_id'  => $member_id,
						'status'     => 'pending',
						'created_at' => $now,
						'updated_at' => $now,
					)
				)
			);
			if ( $ok ) {
				return (int) $wpdb->insert_id;
			}
		}
		return 0;
	}

	public static function update_profile( $id, $data ) {
		global $wpdb;
		$data['updated_at'] = current_time( 'mysql' );
		return false !== $wpdb->update( self::profiles(), $data, array( 'id' => (int) $id ) );
	}

	public static function delete_profile( $id ) {
		global $wpdb;
		$id = (int) $id;
		$wpdb->delete( self::unlocks(), array( 'profile_id' => $id ) );
		$wpdb->delete( self::interests(), array( 'profile_id' => $id ) );
		$wpdb->delete( self::interests(), array( 'requester_profile_id' => $id ) );
		return (bool) $wpdb->delete( self::profiles(), array( 'id' => $id ) );
	}

	public static function photos_of( $profile ) {
		$list = json_decode( (string) $profile->photos, true );
		return is_array( $list ) ? array_values( $list ) : array();
	}

	// ---------- members (packages + credits) ----------

	public static function get_member( $user_id ) {
		global $wpdb;
		$row = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::members() . ' WHERE user_id = %d', $user_id ) );
		if ( ! $row ) {
			$row = (object) array(
				'user_id'            => (int) $user_id,
				'package'            => null,
				'package_expires_at' => null,
				'photo_quota'        => 0,
				'photo_used'         => 0,
				'phone_quota'        => 0,
				'phone_used'         => 0,
			);
		}
		return $row;
	}

	public static function ensure_member( $user_id ) {
		global $wpdb;
		$wpdb->query( $wpdb->prepare( 'INSERT IGNORE INTO ' . self::members() . ' (user_id) VALUES (%d)', $user_id ) );
	}

	public static function package_active( $member ) {
		return ! empty( $member->package )
			&& ( empty( $member->package_expires_at ) || strtotime( $member->package_expires_at ) > current_time( 'timestamp' ) );
	}

	public static function remaining( $member, $type ) {
		if ( ! self::package_active( $member ) ) {
			return 0;
		}
		return 'photo' === $type
			? max( 0, (int) $member->photo_quota - (int) $member->photo_used )
			: max( 0, (int) $member->phone_quota - (int) $member->phone_used );
	}

	/** Only admins call this — a member can never grant themselves quota. */
	public static function assign_package( $user_id, $key ) {
		global $wpdb;
		$packages = mm_packages();
		if ( ! isset( $packages[ $key ] ) ) {
			return false;
		}
		$pkg     = $packages[ $key ];
		$expires = ( new DateTimeImmutable( current_time( 'mysql' ) ) )->modify( '+' . max( 1, (int) $pkg['months'] ) . ' months' );
		self::ensure_member( $user_id );
		return false !== $wpdb->update(
			self::members(),
			array(
				'package'            => $key,
				'package_expires_at' => $expires->format( 'Y-m-d H:i:s' ),
				'photo_quota'        => (int) $pkg['photo_quota'],
				'photo_used'         => 0,
				'phone_quota'        => (int) $pkg['phone_quota'],
				'phone_used'         => 0,
			),
			array( 'user_id' => (int) $user_id )
		);
	}

	public static function clear_package( $user_id ) {
		global $wpdb;
		self::ensure_member( $user_id );
		return false !== $wpdb->query(
			$wpdb->prepare(
				'UPDATE ' . self::members() . ' SET package = NULL, package_expires_at = NULL, photo_quota = 0, photo_used = 0, phone_quota = 0, phone_used = 0 WHERE user_id = %d',
				$user_id
			)
		);
	}

	// ---------- unlocks ----------

	public static function has_unlock( $user_id, $profile_id, $type ) {
		global $wpdb;
		return (bool) $wpdb->get_var(
			$wpdb->prepare( 'SELECT 1 FROM ' . self::unlocks() . ' WHERE user_id = %d AND profile_id = %d AND type = %s', $user_id, $profile_id, $type )
		);
	}

	public static function unlocked_ids( $user_id, $type ) {
		global $wpdb;
		return array_map( 'intval', $wpdb->get_col( $wpdb->prepare( 'SELECT profile_id FROM ' . self::unlocks() . ' WHERE user_id = %d AND type = %s', $user_id, $type ) ) );
	}

	/**
	 * Spends one photo/phone credit to unlock a profile. The credit is taken
	 * with a single conditional UPDATE so two quick clicks can't overspend.
	 *
	 * @return true|string true on success, otherwise an error message.
	 */
	public static function unlock( $user_id, $profile_id, $type ) {
		global $wpdb;
		if ( self::has_unlock( $user_id, $profile_id, $type ) ) {
			return true;
		}
		$col   = 'photo' === $type ? 'photo' : 'phone';
		$taken = $wpdb->query(
			$wpdb->prepare(
				'UPDATE ' . self::members() . " SET {$col}_used = {$col}_used + 1
				 WHERE user_id = %d AND package IS NOT NULL AND {$col}_used < {$col}_quota
				 AND (package_expires_at IS NULL OR package_expires_at > %s)",
				$user_id,
				current_time( 'mysql' )
			)
		);
		if ( ! $taken ) {
			return 'photo' === $type
				? 'Photo credits தீர்ந்துவிட்டது. Package renew செய்ய நிர்வாகியை தொடர்பு கொள்ளவும்.'
				: 'Phone credits தீர்ந்துவிட்டது. Package renew செய்ய நிர்வாகியை தொடர்பு கொள்ளவும்.';
		}
		$inserted = $wpdb->query(
			$wpdb->prepare(
				'INSERT IGNORE INTO ' . self::unlocks() . ' (user_id, profile_id, type, created_at) VALUES (%d, %d, %s, %s)',
				$user_id,
				$profile_id,
				$type,
				current_time( 'mysql' )
			)
		);
		if ( ! $inserted ) {
			// Raced with another request that already unlocked it — refund.
			$wpdb->query( $wpdb->prepare( 'UPDATE ' . self::members() . " SET {$col}_used = {$col}_used - 1 WHERE user_id = %d AND {$col}_used > 0", $user_id ) );
		}
		return true;
	}

	// ---------- visibility ----------

	public static function can_see_identity( $profile, $user_id ) {
		if ( ! $user_id ) {
			return false;
		}
		return mm_is_admin() || (int) $profile->user_id === (int) $user_id || self::has_unlock( $user_id, $profile->id, 'photo' );
	}

	public static function can_see_contact( $profile, $user_id ) {
		if ( ! $user_id ) {
			return false;
		}
		return mm_is_admin() || (int) $profile->user_id === (int) $user_id || self::has_unlock( $user_id, $profile->id, 'phone' );
	}

	// ---------- interests ----------

	/**
	 * @return true|string
	 */
	public static function add_interest( $requester_user_id, $requester_profile_id, $target ) {
		global $wpdb;
		$ok = $wpdb->query(
			$wpdb->prepare(
				'INSERT IGNORE INTO ' . self::interests() . " (profile_id, recipient_user_id, requester_user_id, requester_profile_id, status, created_at) VALUES (%d, %d, %d, %d, 'pending', %s)",
				$target->id,
				$target->user_id,
				$requester_user_id,
				$requester_profile_id,
				current_time( 'mysql' )
			)
		);
		return $ok ? true : 'நீங்கள் ஏற்கனவே இந்த சுயவிவரத்திற்கு விருப்பம் தெரிவித்துள்ளீர்கள்.';
	}

	public static function interest_sent( $user_id, $profile_id ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::interests() . ' WHERE requester_user_id = %d AND profile_id = %d', $user_id, $profile_id ) );
	}

	public static function interests_sent( $user_id ) {
		global $wpdb;
		return $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . self::interests() . ' WHERE requester_user_id = %d ORDER BY created_at DESC, id DESC', $user_id ) );
	}

	public static function interests_received( $user_id ) {
		global $wpdb;
		return $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . self::interests() . ' WHERE recipient_user_id = %d ORDER BY created_at DESC, id DESC', $user_id ) );
	}

	/** Matches (both sides accepted) first, then newest first. */
	public static function all_interests() {
		global $wpdb;
		return $wpdb->get_results( 'SELECT * FROM ' . self::interests() . " ORDER BY (status = 'accepted') DESC, created_at DESC, id DESC" );
	}

	/** The recipient may only accept/reject a still-pending request. */
	public static function respond_interest( $interest_id, $user_id, $status ) {
		global $wpdb;
		if ( ! in_array( $status, array( 'accepted', 'rejected' ), true ) ) {
			return false;
		}
		return (bool) $wpdb->update(
			self::interests(),
			array( 'status' => $status ),
			array(
				'id'                => (int) $interest_id,
				'recipient_user_id' => (int) $user_id,
				'status'            => 'pending',
			)
		);
	}

	public static function delete_interest( $id ) {
		global $wpdb;
		return (bool) $wpdb->delete( self::interests(), array( 'id' => (int) $id ) );
	}
}

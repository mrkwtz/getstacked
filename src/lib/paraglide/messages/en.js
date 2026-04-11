/* eslint-disable */
/** 
 * This file contains language specific message functions for tree-shaking. 
 * 
 *! WARNING: Only import messages from this file if you want to manually
 *! optimize your bundle. Else, import from the `messages.js` file. 
 * 
 * Your bundler will (in the future) automatically replace the index function 
 * with a language specific message function in the build step. 
 */


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const app_name = () => `GetStacked`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const nav_home = () => `Home`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const nav_dashboard = () => `Dashboard`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const nav_tournaments = () => `Tournaments`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const nav_members = () => `Members`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const nav_settings = () => `Settings`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const nav_leaderboard = () => `Leaderboard`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const nav_admin = () => `Admin`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const auth_sign_in = () => `Sign in`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const auth_email_label = () => `Email`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const auth_magic_link_button = () => `Send magic link`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const auth_continue_with_google = () => `Continue with Google`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const auth_or_divider = () => `or`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const auth_check_email = () => `Check your email — we sent you a magic link.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const auth_invalid_email = () => `Please enter a valid email address.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const club_create_title = () => `Create your club`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const club_name_label = () => `Club name`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const club_slug_label = () => `URL slug`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const club_display_name_label = () => `Your display name in this club`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const club_create_button = () => `Create club`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const invite_link_generate = () => `Generate invite link`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const invite_link_copy = () => `Copy`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const invite_link_copied = () => `Copied!`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const invite_link_revoke = () => `Revoke`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const invite_title = () => `You've been invited`


/**
 * @param {{ club_name: NonNullable<unknown> }} params
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const invite_body = (params) => `You've been invited to join ${params.club_name}. Choose a display name to get started.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const invite_join_button = () => `Join club`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const invite_already_used = () => `This invite link has already been used.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const invite_expired = () => `This invite link has expired.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const settings_title = () => `Club settings`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const settings_save = () => `Save changes`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const settings_saved = () => `Settings saved.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const error_required = () => `This field is required.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const error_invalid_slug = () => `Slug must be lowercase letters, numbers, and hyphens only.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const error_slug_taken = () => `That slug is already taken.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const error_already_member = () => `This user is already a member.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const error_cannot_remove_self = () => `Cannot remove yourself.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const server_error = () => `Something went wrong. Please try again.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const landing_eyebrow = () => `Poker club management`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const get_started = () => `Get started`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const landing_tagline = () => `Manage your club, run tournaments, track your legends.`


/**
 * @param {{ club_name: NonNullable<unknown> }} params
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const club_home_welcome = (params) => `Welcome to ${params.club_name}`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const club_home_placeholder = () => `Tournaments and recent results will appear here.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_list_title = () => `Tournaments`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_new_button = () => `New tournament`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_new_title = () => `New tournament`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_name_label = () => `Name`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_date_label = () => `Date`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_format_label = () => `Format`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_format_freezeout = () => `Freezeout`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_format_rebuy = () => `Rebuy`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_buyin_label = () => `Buy-in (€)`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_buy_in_label = () => `Buy-in`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_rebuy_label = () => `Rebuy amount`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_addon_label = () => `Add-on amount`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_format_options_title = () => `Rebuy format options`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_buy_in_rake_label = () => `Buy-in rake`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_rebuy_rake_label = () => `Rebuy rake`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_addon_rake_label = () => `Add-on rake`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_rake_label = () => `Rake`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_blind_structure_label = () => `Blind structure (optional)`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_prize_structure_label = () => `Prize structure (optional)`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_create_button = () => `Create tournament`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_none_option = () => `None`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_status_registration = () => `Registration open`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_status_running = () => `Running`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_status_finished = () => `Finished`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_players_title = () => `Players`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_add_player_button = () => `Add player`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_member_placeholder = () => `Select member`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_guest_placeholder = () => `Or type guest name`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_prize_pool_label = () => `Prize pool`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_no_players = () => `No players registered yet.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_empty = () => `No tournaments yet.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_guest_suffix = () => `(guest)`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_start_button = () => `Start tournament`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_finish_button = () => `Finish tournament`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_confirm_finish = () => `Confirm & close tournament`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_delete_confirm_title = () => `Delete Tournament`


/**
 * @param {{ name: NonNullable<unknown> }} params
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_delete_confirm_body = (params) => `Are you sure you want to delete ${params.name}? All player registrations and results will be lost. This action cannot be undone.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_delete_confirm = () => `Delete`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_cancel_review = () => `Cancel`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_review_title = () => `Review results`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_position_col = () => `Position`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_payout_col = () => `Payout`


/**
 * @param {{ position: NonNullable<unknown> }} params
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_bust_button = (params) => `→ ${params.position}`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_undo_bust = () => `Undo`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_rebuy_col = () => `Rebuys`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_addon_col = () => `Add-on`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_min_players_error = () => `At least 2 players required to start.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_positions_incomplete = () => `Assign all finish positions before finishing.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const blind_structures_title = () => `Blind structures`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const blind_structure_new_title = () => `New blind structure`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const blind_structure_name_label = () => `Name`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const blind_structure_add_level = () => `Add level`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const blind_structure_duration_label = () => `Duration (min)`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const blind_structure_sb_label = () => `Small blind`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const blind_structure_bb_label = () => `Big blind`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const blind_structure_ante_label = () => `Ante`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const blind_structure_create_button = () => `Create`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const blind_structure_empty = () => `No blind structures yet.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const blind_structure_in_use = () => `In use`


/**
 * @param {{ count: NonNullable<unknown> }} params
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const structure_count = (params) => `${params.count} structures`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const prize_structures_title = () => `Prize structures`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const prize_structure_new_title = () => `New prize structure`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const prize_structure_name_label = () => `Name`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const prize_structure_add_payout = () => `Add place`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const prize_structure_position_label = () => `Place`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const prize_structure_percentage_label = () => `%`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const prize_structure_create_button = () => `Create`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const prize_structure_empty = () => `No prize structures yet.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const prize_structure_in_use = () => `In use`


/**
 *
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const prize_structure_edit_title = () => `Edit prize structure`


/**
 *
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const prize_structure_save_button = () => `Save`


/**
 *
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const prize_structure_edit_button = () => `Edit`


/**
 *
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const error_percentage_sum = () => `Percentages must sum to 100.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const error_duplicate_position = () => `Duplicate position.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const error_duplicate_player = () => `This player is already registered.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const error_no_blind_structures = () => `Create a blind structure first.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const error_no_prize_structures = () => `Create a prize structure first.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_no_prize_structure_note = () => `No prize structure selected — payouts will not be recorded.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_payout_total_label = () => `Total`


/**
 * @param {{ pool: NonNullable<unknown> }} params
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_payout_mismatch_warning = (params) => `Total does not match prize pool (€${params.pool})`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const error_tournament_not_open = () => `Tournament registration is closed.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const error_tournament_not_running = () => `This action requires the tournament to be running.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const error_structure_in_use = () => `This structure is used by an existing tournament.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const error_club_name_mismatch = () => `Club name does not match.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const common_delete = () => `Delete`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const settings_danger_zone = () => `Danger zone`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const settings_delete_club = () => `Delete club`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const settings_delete_warning = () => `This will permanently delete the club and all its data including members, tournaments, and structures. This cannot be undone.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const settings_delete_title = () => `Delete club`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const settings_delete_description = () => `This action is permanent and cannot be undone. Type the club name to confirm.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const settings_delete_confirm_label = () => `Club name`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const settings_delete_button = () => `Delete club`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_title = () => `Seating`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_tables_label = () => `Tables`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_seats_per_table_label = () => `Seats / table`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_set_tables_button = () => `Set tables`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_reset_warning = () => `This will reset all seat assignments and locks.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_confirm_reset_button = () => `Confirm reset`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_lock_label = () => `Lock to table`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_lock_any = () => `Any`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_draw_button = () => `Draw seats`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_redraw_button = () => `Re-draw`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_auto_seat_button = () => `Auto-Seat`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_unseated_title = () => `Unseated players`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_dealer_label = () => `Dealer`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_confirm_move_button = () => `Confirm`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_dismiss_button = () => `Dismiss`


/**
 * @param {{ table: NonNullable<unknown>, locks: NonNullable<unknown>, seats: NonNullable<unknown> }} params
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_error_lock_overflow = (params) => `Table ${params.table} has ${params.locks} locks but only ${params.seats} seats.`


/**
 * @param {{ seat: NonNullable<unknown>, table: NonNullable<unknown> }} params
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_error_seat_taken = (params) => `Seat ${params.seat} at Table ${params.table} is already taken.`


/**
 * @param {{ count: NonNullable<unknown> }} params
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_active_count = (params) => `${params.count} active`


/**
 * @param {{ number: NonNullable<unknown> }} params
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_table_label = (params) => `Table ${params.number}`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_assign_seat_placeholder = () => `Assign seat…`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_error_invalid_config = () => `Please enter a valid number of tables and seats.`


/**
 * @param {{ name: NonNullable<unknown> }} params
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_move_hint = (params) => `Tap an empty seat to move ${params.name} there`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_cancel_move = () => `Cancel move`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const dashboard_stat_members = () => `Members`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const dashboard_stat_tournaments = () => `Tournaments`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const dashboard_stat_balance = () => `Balance`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const dashboard_next_game = () => `Next game`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const members_title = () => `Members`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const members_empty = () => `No members yet.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_add_button = () => `Add Member`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_first_name_label = () => `First name`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_last_name_label = () => `Last name`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_nickname_label = () => `Nickname`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_birthday_label = () => `Birthday`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_country_label = () => `Country`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_city_label = () => `City`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_phone_label = () => `Phone`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_address_label = () => `Address`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_notes_label = () => `Notes`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_member_number_label = () => `Member #`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_registration_date_label = () => `Registration date`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_remove = () => `Remove`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_delete_confirm_title = () => `Delete Member`


/**
 * @param {{ name: NonNullable<unknown> }} params
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_delete_confirm_body = (params) => `Are you sure you want to delete ${params.name}? This action cannot be undone.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_delete_confirm = () => `Delete`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_save = () => `Save`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_cancel = () => `Cancel`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_linked = () => `Account linked`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_not_linked = () => `No account`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_generate_invite = () => `Generate invite link`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_detail_title = () => `Member Details`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_edit_title = () => `Edit Member`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_quick_add_title = () => `Quick Add Member`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_quick_add_button = () => `Add & Register`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_role_label = () => `Role`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_role_admin = () => `Admin`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_role_member = () => `Member`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_role_guest = () => `Guest`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_last_admin_error = () => `At least one admin must remain in the club.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const invite_first_name_label = () => `First name`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const invite_last_name_label = () => `Last name`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const invite_linked_title = () => `Link Your Account`


/**
 * @param {{ club_name: NonNullable<unknown> }} params
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const invite_linked_body = (params) => `You've been invited to link your account to your member profile in ${params.club_name}.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const invite_copy = () => `Copy`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const invite_copied = () => `Copied!`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_select_player = () => `Select player…`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const club_switch_title = () => `Switch club`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_buy_in_chips_label = () => `Buy-in chips`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_rebuy_chips_label = () => `Rebuy chips`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_addon_chips_label = () => `Add-on chips`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_avg_stack_label = () => `Avg. stack`


/**
 *
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_edit_blind_structure = () => `Edit blind structure`


/**
 *
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_edit_prize_structure = () => `Edit prize structure`


/**
 *
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const blind_structure_add_break = () => `Add Break`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const blind_structure_break_label_placeholder = () => `Break name (e.g. Dinner Break)`


/**
 *
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const blind_structure_edit_title = () => `Edit blind structure`


/**
 *
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const blind_structure_save_button = () => `Save`


/**
 *
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const blind_structure_edit_button = () => `Edit`


/**
 *
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const timer_level = () => `Level`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const timer_break = () => `Break`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const timer_pause = () => `Pause`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const timer_resume = () => `Resume`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const timer_next_level = () => `Next`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const timer_clock_link = () => `Clock`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const timer_times_up = () => `Time's up`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const timer_next_preview = () => `Next`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const clock_small_blind = () => `Small Blind`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const clock_big_blind = () => `Big Blind`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const clock_ante = () => `Ante`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const clock_next_level = () => `Next Level`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const clock_players = () => `Players`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const clock_avg_stack = () => `Avg Stack`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const clock_prize_pool = () => `Prize Pool`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const clock_next_break = () => `Next Break`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const clock_playing = () => `Playing`

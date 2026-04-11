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
export const nav_home = () => `Startseite`


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
export const nav_tournaments = () => `Turniere`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const nav_members = () => `Mitglieder`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const nav_settings = () => `Einstellungen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const nav_leaderboard = () => `Rangliste`


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
export const auth_sign_in = () => `Anmelden`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const auth_email_label = () => `E-Mail`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const auth_magic_link_button = () => `Magic Link senden`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const auth_continue_with_google = () => `Mit Google fortfahren`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const auth_or_divider = () => `oder`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const auth_check_email = () => `Bitte prüfe deine E-Mails — wir haben dir einen Magic Link gesendet.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const auth_invalid_email = () => `Bitte gib eine gültige E-Mail-Adresse ein.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const club_create_title = () => `Club erstellen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const club_name_label = () => `Club-Name`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const club_slug_label = () => `URL-Slug`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const club_display_name_label = () => `Dein Anzeigename in diesem Club`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const club_create_button = () => `Club erstellen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const invite_link_generate = () => `Einladungslink generieren`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const invite_link_copy = () => `Kopieren`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const invite_link_copied = () => `Kopiert!`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const invite_link_revoke = () => `Widerrufen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const invite_title = () => `Du wurdest eingeladen`


/**
 * @param {{ club_name: NonNullable<unknown> }} params
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const invite_body = (params) => `Du wurdest eingeladen, ${params.club_name} beizutreten. Wähle einen Anzeigenamen um loszulegen.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const invite_join_button = () => `Club beitreten`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const invite_already_used = () => `Dieser Einladungslink wurde bereits verwendet.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const invite_expired = () => `Dieser Einladungslink ist abgelaufen.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const settings_title = () => `Club-Einstellungen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const settings_save = () => `Änderungen speichern`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const settings_saved = () => `Einstellungen gespeichert.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const error_required = () => `Dieses Feld ist erforderlich.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const error_invalid_slug = () => `Slug darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const error_slug_taken = () => `Dieser Slug ist bereits vergeben.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const error_already_member = () => `Dieser Benutzer ist bereits Mitglied.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const error_cannot_remove_self = () => `Du kannst dich nicht selbst entfernen.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const server_error = () => `Etwas ist schiefgelaufen. Bitte versuche es erneut.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const landing_eyebrow = () => `Poker-Club-Verwaltung`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const get_started = () => `Loslegen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const landing_tagline = () => `Verwalte deinen Club, organisiere Turniere, verewige deine Legenden.`


/**
 * @param {{ club_name: NonNullable<unknown> }} params
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const club_home_welcome = (params) => `Willkommen bei ${params.club_name}`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const club_home_placeholder = () => `Turniere und aktuelle Ergebnisse erscheinen hier.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_list_title = () => `Turniere`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_new_button = () => `Neues Turnier`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_new_title = () => `Neues Turnier`


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
export const tournament_date_label = () => `Datum`


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
export const tournament_rebuy_label = () => `Rebuy-Betrag`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_addon_label = () => `Add-on-Betrag`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_format_options_title = () => `Rebuy-Formatoptionen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_buy_in_rake_label = () => `Buy-in Rake`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_rebuy_rake_label = () => `Rebuy Rake`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_addon_rake_label = () => `Add-on Rake`


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
export const tournament_blind_structure_label = () => `Blind-Struktur (optional)`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_prize_structure_label = () => `Preisstruktur (optional)`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_create_button = () => `Turnier erstellen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_none_option = () => `Keine`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_status_registration = () => `Registrierung offen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_status_running = () => `Läuft`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_status_finished = () => `Beendet`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_players_title = () => `Spieler`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_add_player_button = () => `Spieler hinzufügen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_member_placeholder = () => `Mitglied auswählen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_guest_placeholder = () => `Oder Gastnamen eingeben`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_prize_pool_label = () => `Preispool`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_no_players = () => `Noch keine Spieler registriert.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_empty = () => `Noch keine Turniere.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_guest_suffix = () => `(Gast)`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_start_button = () => `Turnier starten`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_finish_button = () => `Turnier beenden`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_confirm_finish = () => `Bestätigen & Turnier schließen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_delete_confirm_title = () => `Turnier löschen`


/**
 * @param {{ name: NonNullable<unknown> }} params
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_delete_confirm_body = (params) => `Möchtest du ${params.name} wirklich löschen? Alle Spielerregistrierungen und Ergebnisse gehen verloren. Diese Aktion kann nicht rückgängig gemacht werden.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_delete_confirm = () => `Löschen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_cancel_review = () => `Abbrechen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_review_title = () => `Ergebnisse prüfen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_position_col = () => `Platz`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_payout_col = () => `Auszahlung`


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
export const tournament_undo_bust = () => `Rückgängig`


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
export const tournament_min_players_error = () => `Mindestens 2 Spieler erforderlich.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_positions_incomplete = () => `Alle Platzierungen müssen vergeben sein.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const blind_structures_title = () => `Blind-Strukturen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const blind_structure_new_title = () => `Neue Blind-Struktur`


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
export const blind_structure_add_level = () => `Level hinzufügen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const blind_structure_duration_label = () => `Dauer (Min.)`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const blind_structure_sb_label = () => `Small Blind`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const blind_structure_bb_label = () => `Big Blind`


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
export const blind_structure_create_button = () => `Erstellen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const blind_structure_edit_title = () => `Blind-Struktur bearbeiten`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const blind_structure_edit_button = () => `Bearbeiten`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const blind_structure_save_button = () => `Speichern`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const blind_structure_empty = () => `Noch keine Blind-Strukturen.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const blind_structure_in_use = () => `In Verwendung`


/**
 * @param {{ count: NonNullable<unknown> }} params
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const structure_count = (params) => `${params.count} Strukturen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const prize_structures_title = () => `Preisstrukturen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const prize_structure_new_title = () => `Neue Preisstruktur`


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
export const prize_structure_add_payout = () => `Platz hinzufügen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const prize_structure_position_label = () => `Platz`


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
export const prize_structure_create_button = () => `Erstellen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const prize_structure_edit_title = () => `Preisstruktur bearbeiten`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const prize_structure_edit_button = () => `Bearbeiten`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const prize_structure_save_button = () => `Speichern`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const prize_structure_empty = () => `Noch keine Preisstrukturen.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const prize_structure_in_use = () => `In Verwendung`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const error_percentage_sum = () => `Prozentwerte müssen 100 ergeben.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const error_duplicate_position = () => `Doppelter Platz.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const error_duplicate_player = () => `Dieser Spieler ist bereits registriert.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const error_no_blind_structures = () => `Bitte zuerst eine Blind-Struktur erstellen.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const error_no_prize_structures = () => `Bitte zuerst eine Preisstruktur erstellen.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_no_prize_structure_note = () => `Keine Preisstruktur gewählt — Auszahlungen werden nicht erfasst.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_payout_total_label = () => `Gesamt`


/**
 * @param {{ pool: NonNullable<unknown> }} params
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_payout_mismatch_warning = (params) => `Summe stimmt nicht mit dem Preispool überein (€${params.pool})`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const error_tournament_not_open = () => `Die Turnier-Registrierung ist geschlossen.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const error_tournament_not_running = () => `Diese Aktion erfordert ein laufendes Turnier.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const error_structure_in_use = () => `Diese Struktur wird von einem bestehenden Turnier verwendet.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const error_club_name_mismatch = () => `Club-Name stimmt nicht überein.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const common_delete = () => `Löschen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const settings_danger_zone = () => `Gefahrenzone`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const settings_delete_club = () => `Club löschen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const settings_delete_warning = () => `Dadurch wird der Club und alle zugehörigen Daten dauerhaft gelöscht, einschließlich Mitglieder, Turniere und Strukturen. Dies kann nicht rückgängig gemacht werden.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const settings_delete_title = () => `Club löschen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const settings_delete_description = () => `Diese Aktion ist dauerhaft und kann nicht rückgängig gemacht werden. Gib den Club-Namen ein, um zu bestätigen.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const settings_delete_confirm_label = () => `Club-Name`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const settings_delete_button = () => `Club löschen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_title = () => `Sitzordnung`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_tables_label = () => `Tische`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_seats_per_table_label = () => `Plätze / Tisch`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_set_tables_button = () => `Tische festlegen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_reset_warning = () => `Alle Platzzuweisungen und Sperren werden zurückgesetzt.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_confirm_reset_button = () => `Zurücksetzen bestätigen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_lock_label = () => `Tisch zuweisen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_lock_any = () => `Beliebig`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_draw_button = () => `Plätze auslosen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_redraw_button = () => `Neu auslosen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_auto_seat_button = () => `Auto-Sitz`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_unseated_title = () => `Nicht platzierte Spieler`


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
export const seating_confirm_move_button = () => `Bestätigen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_dismiss_button = () => `Verwerfen`


/**
 * @param {{ table: NonNullable<unknown>, locks: NonNullable<unknown>, seats: NonNullable<unknown> }} params
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_error_lock_overflow = (params) => `Tisch ${params.table} hat ${params.locks} Sperren, aber nur ${params.seats} Plätze.`


/**
 * @param {{ seat: NonNullable<unknown>, table: NonNullable<unknown> }} params
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_error_seat_taken = (params) => `Platz ${params.seat} an Tisch ${params.table} ist bereits belegt.`


/**
 * @param {{ count: NonNullable<unknown> }} params
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_active_count = (params) => `${params.count} aktiv`


/**
 * @param {{ number: NonNullable<unknown> }} params
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_table_label = (params) => `Tisch ${params.number}`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_assign_seat_placeholder = () => `Platz zuweisen…`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_error_invalid_config = () => `Bitte gültige Anzahl von Tischen und Plätzen eingeben.`


/**
 * @param {{ name: NonNullable<unknown> }} params
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_move_hint = (params) => `${params.name} hierher verschieben: freien Platz antippen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const seating_cancel_move = () => `Verschieben abbrechen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const dashboard_stat_members = () => `Mitglieder`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const dashboard_stat_tournaments = () => `Turniere`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const dashboard_stat_balance = () => `Guthaben`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const dashboard_next_game = () => `Nächstes Spiel`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const members_title = () => `Mitglieder`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const members_empty = () => `Noch keine Mitglieder.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_add_button = () => `Mitglied hinzufügen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_first_name_label = () => `Vorname`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_last_name_label = () => `Nachname`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_nickname_label = () => `Spitzname`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_birthday_label = () => `Geburtstag`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_country_label = () => `Land`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_city_label = () => `Stadt`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_phone_label = () => `Telefon`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_address_label = () => `Adresse`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_notes_label = () => `Notizen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_member_number_label = () => `Mitglieds-Nr.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_registration_date_label = () => `Registrierungsdatum`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_remove = () => `Entfernen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_delete_confirm_title = () => `Mitglied löschen`


/**
 * @param {{ name: NonNullable<unknown> }} params
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_delete_confirm_body = (params) => `Möchtest du ${params.name} wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_delete_confirm = () => `Löschen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_save = () => `Speichern`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_cancel = () => `Abbrechen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_linked = () => `Konto verknüpft`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_not_linked = () => `Kein Konto`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_generate_invite = () => `Einladungslink erstellen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_detail_title = () => `Mitgliedsdetails`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_edit_title = () => `Mitglied bearbeiten`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_quick_add_title = () => `Mitglied schnell hinzufügen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_quick_add_button = () => `Hinzufügen & Registrieren`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_role_label = () => `Rolle`


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
export const member_role_member = () => `Mitglied`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_role_guest = () => `Gast`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const member_last_admin_error = () => `Es muss mindestens ein Admin im Club bleiben.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const invite_first_name_label = () => `Vorname`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const invite_last_name_label = () => `Nachname`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const invite_linked_title = () => `Konto verknüpfen`


/**
 * @param {{ club_name: NonNullable<unknown> }} params
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const invite_linked_body = (params) => `Du wurdest eingeladen, dein Konto mit deinem Mitgliedsprofil bei ${params.club_name} zu verknüpfen.`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const invite_copy = () => `Kopieren`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const invite_copied = () => `Kopiert!`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_select_player = () => `Spieler auswählen…`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const club_switch_title = () => `Club wechseln`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_buy_in_chips_label = () => `Buy-in Chips`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_rebuy_chips_label = () => `Rebuy Chips`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_addon_chips_label = () => `Add-on Chips`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const tournament_avg_stack_label = () => `Ø Stack`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const blind_structure_add_break = () => `Pause hinzufügen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const blind_structure_break_label_placeholder = () => `Pausenname (z.B. Abendessen)`


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
export const timer_break = () => `Pause`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const timer_pause = () => `Pausieren`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const timer_resume = () => `Fortsetzen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const timer_next_level = () => `Weiter`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const timer_clock_link = () => `Uhr`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const timer_times_up = () => `Zeit abgelaufen`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const timer_next_preview = () => `Nächstes`


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
export const clock_next_level = () => `Nächstes Level`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const clock_players = () => `Spieler`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const clock_avg_stack = () => `Ø Stack`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const clock_prize_pool = () => `Preispool`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const clock_next_break = () => `Nächste Pause`


/**
 * 
 * @returns {string}
 */
/* @__NO_SIDE_EFFECTS__ */
export const clock_playing = () => `Spieldauer`

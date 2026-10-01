-- CRM_THINK_V2 - P0-S1B identity user directory indexes.
-- Controlled architecture artifact only. Do not execute in production without owner approval.

USE `CRM_THINK_V2`;

ALTER TABLE sec_user
  ADD KEY ix_sec_user_directory_status_name (status_user, display_name_user, id_user);

ALTER TABLE sec_user
  ADD KEY ix_sec_user_directory_status_activity (status_user, last_login_at_user, id_user);

ALTER TABLE sec_auth_identity
  ADD KEY ix_sec_auth_identity_user_provider_status (user_id_auth_identity, provider_code_auth_identity, status_auth_identity);

ALTER TABLE int_user_external_identity
  ADD KEY ix_int_user_external_identity_user_system_status (user_id_user_external_identity, external_system_id_user_external_identity, status_user_external_identity);

ALTER TABLE sec_user
  ADD FULLTEXT KEY ft_sec_user_directory_search (display_name_user, email_user, normalized_email_user);

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS application_data JSON DEFAULT NULL AFTER offer_recommended;

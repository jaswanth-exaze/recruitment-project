ALTER TABLE job_requisitions
  ADD COLUMN department VARCHAR(120) DEFAULT NULL AFTER employment_type,
  ADD COLUMN experience_level VARCHAR(60) DEFAULT NULL AFTER department,
  ADD COLUMN salary_min DECIMAL(12,2) DEFAULT NULL AFTER experience_level,
  ADD COLUMN salary_max DECIMAL(12,2) DEFAULT NULL AFTER salary_min,
  ADD COLUMN application_deadline DATE DEFAULT NULL AFTER salary_max;

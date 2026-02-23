CREATE DATABASE IF NOT EXISTS recruitment_platform_1
DEFAULT CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE recruitment_platform_1;

CREATE TABLE companies (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255) DEFAULT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_name (name),
  KEY idx_domain (domain)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  id INT NOT NULL AUTO_INCREMENT,
  company_id INT DEFAULT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role ENUM('PlatformAdmin','CompanyAdmin','HR','HiringManager','Interviewer','Candidate') NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  last_login_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY email (email),
  KEY idx_company_id (company_id),
  KEY idx_role (role),
  CONSTRAINT users_ibfk_1 FOREIGN KEY (company_id)
    REFERENCES companies (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE candidate_profiles (
  user_id INT NOT NULL,
  phone VARCHAR(20) DEFAULT NULL,
  address TEXT,
  resume_url VARCHAR(500) DEFAULT NULL,
  profile_data JSON DEFAULT NULL,
  is_verified TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  KEY idx_is_verified (is_verified),
  CONSTRAINT candidate_profiles_ibfk_1 FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE job_requisitions (
  id INT NOT NULL AUTO_INCREMENT,
  company_id INT NOT NULL,
  created_by INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  requirements TEXT,
  location VARCHAR(255) DEFAULT NULL,
  employment_type ENUM('Full-time','Part-time','Contract') DEFAULT 'Full-time',
  status ENUM('draft','pending','published','rejected','closed') DEFAULT 'draft',
  published_at TIMESTAMP NULL DEFAULT NULL,
  closed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  positions_count INT NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY idx_company_id (company_id),
  KEY idx_status (status),
  KEY idx_created_by (created_by),
  CONSTRAINT job_requisitions_ibfk_1 FOREIGN KEY (company_id)
    REFERENCES companies (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT job_requisitions_ibfk_2 FOREIGN KEY (created_by)
    REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE applications (
  id INT NOT NULL AUTO_INCREMENT,
  job_id INT NOT NULL,
  candidate_id INT NOT NULL,
  status ENUM('applied','screening','interview','interview score submited','selected','offer_letter_sent','offer accecepted','rejected','hired') DEFAULT 'applied',
  current_stage_id INT DEFAULT NULL,
  applied_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  screening_decision_at TIMESTAMP NULL DEFAULT NULL,
  final_decision_at TIMESTAMP NULL DEFAULT NULL,
  offer_recommended TINYINT(1) DEFAULT 0,
  application_data JSON DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_job_id (job_id),
  KEY idx_candidate_id (candidate_id),
  KEY idx_status (status),
  CONSTRAINT applications_ibfk_1 FOREIGN KEY (job_id)
    REFERENCES job_requisitions (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT applications_ibfk_2 FOREIGN KEY (candidate_id)
    REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE interviews (
  id INT NOT NULL AUTO_INCREMENT,
  application_id INT NOT NULL,
  interviewer_id INT NOT NULL,
  scheduled_at TIMESTAMP NOT NULL,
  duration_minutes INT DEFAULT NULL,
  meeting_link VARCHAR(500) DEFAULT NULL,
  status ENUM('scheduled','completed','cancelled') DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_application_id (application_id),
  KEY idx_interviewer_id (interviewer_id),
  KEY idx_scheduled_at (scheduled_at),
  CONSTRAINT interviews_ibfk_1 FOREIGN KEY (application_id)
    REFERENCES applications (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT interviews_ibfk_2 FOREIGN KEY (interviewer_id)
    REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE scorecards (
  id INT NOT NULL AUTO_INCREMENT,
  interview_id INT NOT NULL,
  interviewer_id INT NOT NULL,
  ratings JSON DEFAULT NULL,
  comments TEXT,
  recommendation ENUM('Strong Yes','Yes','Maybe','No') DEFAULT NULL,
  is_final TINYINT(1) DEFAULT 0,
  submitted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_interview_id (interview_id),
  KEY idx_interviewer_id (interviewer_id),
  CONSTRAINT scorecards_ibfk_1 FOREIGN KEY (interview_id)
    REFERENCES interviews (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT scorecards_ibfk_2 FOREIGN KEY (interviewer_id)
    REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE job_approvals (
  id INT NOT NULL AUTO_INCREMENT,
  job_id INT NOT NULL,
  approver_id INT NOT NULL,
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  comments TEXT,
  approved_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_job_approver (job_id, approver_id),
  KEY approver_id (approver_id),
  KEY idx_status (status),
  CONSTRAINT job_approvals_ibfk_1 FOREIGN KEY (job_id)
    REFERENCES job_requisitions (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT job_approvals_ibfk_2 FOREIGN KEY (approver_id)
    REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE offers (
  id INT NOT NULL AUTO_INCREMENT,
  application_id INT NOT NULL,
  created_by INT NOT NULL,
  status ENUM('draft','sent','accepted','declined') DEFAULT 'draft',
  offer_details JSON DEFAULT NULL,
  document_url VARCHAR(500) DEFAULT NULL,
  esign_link VARCHAR(500) DEFAULT NULL,
  sent_at TIMESTAMP NULL DEFAULT NULL,
  responded_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY created_by (created_by),
  KEY idx_application_id (application_id),
  KEY idx_status (status),
  CONSTRAINT offers_ibfk_1 FOREIGN KEY (application_id)
    REFERENCES applications (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT offers_ibfk_2 FOREIGN KEY (created_by)
    REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE saved_jobs (
  id INT NOT NULL AUTO_INCREMENT,
  candidate_id INT NOT NULL,
  job_id INT NOT NULL,
  saved_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY unique_candidate_job (candidate_id, job_id),
  KEY job_id (job_id),
  CONSTRAINT saved_jobs_ibfk_1 FOREIGN KEY (candidate_id)
    REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT saved_jobs_ibfk_2 FOREIGN KEY (job_id)
    REFERENCES job_requisitions (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE contact_requests (
  id BIGINT NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(150) NOT NULL,
  work_email VARCHAR(255) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  role VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  agreed_to_contact TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_contact_created_at (created_at),
  KEY idx_contact_email (work_email),
  KEY idx_contact_company (company_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_logs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id INT DEFAULT NULL,
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INT NOT NULL,
  old_data JSON DEFAULT NULL,
  new_data JSON DEFAULT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_id (user_id),
  KEY idx_entity (entity_type, entity_id),
  KEY idx_created_at (created_at),
  CONSTRAINT audit_logs_ibfk_1 FOREIGN KEY (user_id)
    REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE background_jobs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  job_type VARCHAR(100) NOT NULL,
  payload JSON DEFAULT NULL,
  status ENUM('pending','processing','completed','failed') DEFAULT 'pending',
  retries INT DEFAULT 0,
  error_message TEXT,
  scheduled_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_status (status),
  KEY idx_scheduled_at (scheduled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  is_revoked BOOLEAN DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
-- =============================================================================================================
-- ==============================================================================================================
-- ==============================================================================================================
-- ==============================================================================================================
-- ==============================================================================================================
INSERT INTO companies (id,name,domain,is_active,created_at,updated_at) VALUES
(1,'TCS Limited','tcs.com',1,'2026-01-04 09:16:17','2026-01-04 09:16:17'),
(2,'Infosys Private Ltd','infosys.com',1,'2026-01-11 09:16:17','2026-01-11 09:16:17'),
(3,'Wipro Technologies','wipro.com',1,'2026-01-19 09:16:17','2026-01-19 09:16:17');

INSERT INTO users (id,company_id,email,password_hash,first_name,last_name,role,is_active,last_login_at,created_at,updated_at) VALUES
(1,1,'admin@tcs.com','$2y$10$YourHashedPasswordHere','Amit','Sharma','CompanyAdmin',1,'2026-02-17 09:16:17','2026-01-04 09:16:17','2026-02-17 09:16:17'),
(2,1,'hr@tcs.com','$2y$10$YourHashedPasswordHere','Priya','Verma','HR',1,'2026-02-16 09:16:17','2026-01-05 09:16:17','2026-02-16 09:16:17'),
(3,1,'hiring.manager@tcs.com','$2y$10$YourHashedPasswordHere','Rajan','Kapoor','HiringManager',1,'2026-02-15 09:16:17','2026-01-06 09:16:17','2026-02-15 09:16:17'),
(4,1,'interviewer@tcs.com','$2y$10$YourHashedPasswordHere','Deepa','Iyer','Interviewer',1,'2026-02-14 09:16:17','2026-01-07 09:16:17','2026-02-14 09:16:17'),
(5,2,'admin@infosys.com','$2y$10$YourHashedPasswordHere','Vikram','Patel','CompanyAdmin',1,'2026-02-13 09:16:17','2026-01-11 09:16:17','2026-02-13 09:16:17'),
(6,2,'hr@infosys.com','$2y$10$YourHashedPasswordHere','Sunita','Rao','HR',1,'2026-02-12 09:16:17','2026-01-12 09:16:17','2026-02-12 09:16:17'),
(7,2,'hiring.manager@infosys.com','$2y$10$YourHashedPasswordHere','Anand','Desai','HiringManager',1,'2026-02-11 09:16:17','2026-01-13 09:16:17','2026-02-11 09:16:17'),
(8,2,'interviewer@infosys.com','$2y$10$YourHashedPasswordHere','Kavita','Nair','Interviewer',1,'2026-02-10 09:16:17','2026-01-14 09:16:17','2026-02-10 09:16:17'),
(9,3,'admin@wipro.com','$2y$10$YourHashedPasswordHere','Rajesh','Kumar','CompanyAdmin',1,'2026-02-09 09:16:17','2026-01-19 09:16:17','2026-02-09 09:16:17'),
(10,3,'hr@wipro.com','$2y$10$YourHashedPasswordHere','Neha','Singh','HR',1,'2026-02-08 09:16:17','2026-01-20 09:16:17','2026-02-08 09:16:17'),
(11,3,'hiring.manager@wipro.com','$2y$10$YourHashedPasswordHere','Sanjay','Gupta','HiringManager',1,'2026-02-07 09:16:17','2026-01-21 09:16:17','2026-02-07 09:16:17'),
(12,3,'interviewer@wipro.com','$2y$10$YourHashedPasswordHere','Pooja','Reddy','Interviewer',1,'2026-02-06 09:16:17','2026-01-22 09:16:17','2026-02-06 09:16:17'),
(13,NULL,'rahul.sharma@example.com','$2y$10$YourHashedPasswordHere','Rahul','Sharma','Candidate',1,'2026-02-03 09:16:19','2025-12-30 09:16:19','2026-02-03 09:16:19'),
(14,NULL,'priya.kapoor@example.com','$2y$10$YourHashedPasswordHere','Priya','Kapoor','Candidate',1,'2026-02-08 09:16:19','2026-01-04 09:16:19','2026-02-08 09:16:19'),
(15,NULL,'amit.patil@example.com','$2y$10$YourHashedPasswordHere','Amit','Patil','Candidate',1,'2026-02-06 09:21:10','2025-12-25 09:21:10','2026-02-06 09:21:10'),
(16,NULL,'neha.gupta@example.com','$2y$10$YourHashedPasswordHere','Neha','Gupta','Candidate',1,'2026-02-09 09:21:10','2025-12-28 09:21:10','2026-02-09 09:21:10'),
(17,NULL,'raj.kumar@example.com','$2y$10$YourHashedPasswordHere','Raj','Kumar','Candidate',1,'2026-02-04 09:21:10','2026-01-01 09:21:10','2026-02-04 09:21:10'),
(18,NULL,'pooja.desai@example.com','$2y$10$YourHashedPasswordHere','Pooja','Desai','Candidate',1,'2026-02-11 09:21:10','2025-12-27 09:21:10','2026-02-11 09:21:10'),
(19,NULL,'vikram.singh@example.com','$2y$10$YourHashedPasswordHere','Vikram','Singh','Candidate',1,'2026-02-13 09:21:10','2025-12-20 09:21:10','2026-02-13 09:21:10'),
(20,NULL,'ananya.reddy@example.com','$2y$10$YourHashedPasswordHere','Ananya','Reddy','Candidate',1,'2026-02-07 09:21:10','2026-01-02 09:21:10','2026-02-07 09:21:10');

INSERT INTO candidate_profiles VALUES
(13,'+91-9876543210','404, Lotus Apartments, Andheri East, Mumbai','https://s3.example.com/resumes/rahul_sharma.pdf',NULL,1,'2025-12-30 09:16:19','2026-02-03 09:16:19'),
(14,'+91-9988776655','12, Krishna Nagar, Bengaluru','https://s3.example.com/resumes/priya_kapoor.pdf',NULL,1,'2026-01-04 09:16:19','2026-02-08 09:16:19'),
(15,'+91-9876512345','Flat 201, Sunshine Apartments, Pune','https://s3.example.com/resumes/amit_patil.pdf',NULL,1,'2025-12-25 09:21:10','2026-02-06 09:21:10'),
(16,'+91-9988771122','45, Brigade Road, Bengaluru','https://s3.example.com/resumes/neha_gupta.pdf',NULL,1,'2025-12-28 09:21:10','2026-02-09 09:21:10'),
(17,'+91-9876512346','102, Green Park Extension, Delhi','https://s3.example.com/resumes/raj_kumar.pdf',NULL,1,'2026-01-01 09:21:10','2026-02-04 09:21:10'),
(18,'+91-9988773344','7, Banjara Hills, Hyderabad','https://s3.example.com/resumes/pooja_desai.pdf',NULL,1,'2025-12-27 09:21:10','2026-02-11 09:21:10'),
(19,'+91-9876512347','15, MG Road, Gurgaon','https://s3.example.com/resumes/vikram_singh.pdf',NULL,1,'2025-12-20 09:21:10','2026-02-13 09:21:10'),
(20,'+91-9988775566','8-2-293, Jubilee Hills, Hyderabad','https://s3.example.com/resumes/ananya_reddy.pdf',NULL,1,'2026-01-02 09:21:10','2026-02-07 09:21:10');

INSERT INTO job_requisitions 
(id,company_id,created_by,title,description,requirements,location,employment_type,status,published_at,closed_at,created_at,updated_at,positions_count) VALUES
(1,1,2,'Senior Java Developer','Develop microservices for banking client.','5+ years Java, Spring Boot, Oracle','Mumbai, India','Full-time','published','2026-01-09 09:16:18',NULL,'2026-01-07 09:16:18','2026-02-18 09:32:35',3),
(2,1,2,'Project Manager – Insurance Domain','Lead agile team for insurance project.','7+ years IT project management, insurance domain preferred','Pune, India','Full-time','pending',NULL,NULL,'2026-01-29 09:16:18','2026-01-29 09:16:18',1),
(3,1,2,'Cloud Architect','Design AWS/Azure solutions.','AWS Certified, Terraform, Kubernetes','Bengaluru, India','Full-time','draft',NULL,NULL,'2026-02-08 09:16:18','2026-02-18 09:32:35',2),
(4,2,6,'Business Analyst','Gather requirements for digital transformation.','3+ years BA experience, Agile, banking domain','Bengaluru, India','Full-time','published','2026-01-19 09:16:18',NULL,'2026-01-17 09:16:18','2026-02-18 09:32:35',2),
(5,2,6,'UI/UX Designer','Design web and mobile applications.','Figma, Adobe XD, portfolio required','Hyderabad, India','Full-time','published','2026-01-24 09:16:18',NULL,'2026-01-22 09:16:18','2026-01-24 09:16:18',1),
(6,2,6,'DevOps Engineer','CI/CD pipeline automation.','Jenkins, Docker, Ansible','Chennai, India','Full-time','rejected',NULL,NULL,'2026-02-03 09:16:18','2026-02-04 09:16:18',1),
(7,3,10,'Network Engineer','Manage enterprise network infrastructure.','CCNA, routing/switching, firewall','Delhi, India','Full-time','published','2026-01-29 09:16:18',NULL,'2026-01-27 09:16:18','2026-02-18 09:32:35',3),
(8,3,10,'Technical Support Engineer','L1/L2 support for global clients.','1+ years support experience, good communication','Gurgaon, India','Full-time','published','2026-01-31 09:16:18',NULL,'2026-01-30 09:16:18','2026-01-31 09:16:18',1),
(9,3,10,'Cybersecurity Analyst','Monitor and respond to security incidents.','CEH or equivalent, SIEM tools','Noida, India','Full-time','closed','2026-01-24 09:16:18','2026-02-13 09:16:18','2026-01-21 09:16:18','2026-02-13 09:16:18',1);

INSERT INTO job_approvals
(id,job_id,approver_id,status,comments,approved_at,created_at,updated_at) VALUES
(1,1,3,'approved','Good to proceed.','2026-01-08 09:16:18','2026-01-07 09:16:18','2026-01-08 09:16:18'),
(2,4,7,'approved','Looks fine.','2026-01-18 09:16:18','2026-01-17 09:16:18','2026-01-18 09:16:18'),
(3,5,7,'approved','Approve.','2026-01-23 09:16:18','2026-01-22 09:16:18','2026-01-23 09:16:18'),
(4,7,11,'approved','Ok.','2026-01-28 09:16:18','2026-01-27 09:16:18','2026-01-28 09:16:18'),
(5,8,11,'approved','Approved.','2026-01-30 09:16:18','2026-01-29 09:16:18','2026-01-30 09:16:18');

INSERT INTO applications
(id,job_id,candidate_id,status,current_stage_id,applied_at,screening_decision_at,final_decision_at,offer_recommended,created_at,updated_at) VALUES
(1,1,13,'applied',NULL,'2026-01-14 09:16:19',NULL,NULL,0,'2026-01-14 09:16:19','2026-01-14 09:16:19'),
(2,5,14,'applied',NULL,'2026-01-29 09:16:19',NULL,NULL,0,'2026-01-29 09:16:19','2026-01-29 09:16:19'),
(3,1,15,'screening',NULL,'2026-01-19 09:21:10','2026-01-21 09:21:10',NULL,0,'2026-01-19 09:21:10','2026-01-21 09:21:10'),
(4,4,16,'interview',1,'2026-01-24 09:21:10','2026-01-27 09:21:10',NULL,0,'2026-01-24 09:21:10','2026-01-27 09:21:10'),
(5,7,17,'selected',NULL,'2026-01-29 09:21:10',NULL,'2026-02-06 09:21:10',1,'2026-01-29 09:21:10','2026-02-06 09:21:10'),
(6,5,18,'hired',NULL,'2026-01-21 09:21:10',NULL,'2026-02-08 09:21:10',1,'2026-01-21 09:21:10','2026-02-08 09:21:10'),
(7,2,19,'rejected',NULL,'2026-02-03 09:21:10','2026-02-05 09:21:10',NULL,0,'2026-02-03 09:21:10','2026-02-05 09:21:10'),
(8,8,20,'rejected',NULL,'2026-01-31 09:21:10','2026-02-03 09:21:10','2026-02-08 09:21:10',0,'2026-01-31 09:21:10','2026-02-08 09:21:10');

INSERT INTO interviews
(id,application_id,interviewer_id,scheduled_at,duration_minutes,meeting_link,status,notes,created_at,updated_at) VALUES
(1,4,8,'2026-01-31 09:21:11',60,'https://meet.google.com/abc-defg-hij','completed','First round technical interview','2026-01-29 09:21:11','2026-01-31 09:21:11'),
(2,5,12,'2026-02-03 09:21:11',45,'https://meet.google.com/xyz-uvwx-yz','completed','Technical round on networking','2026-02-01 09:21:11','2026-02-03 09:21:11'),
(3,8,12,'2026-02-06 09:21:11',30,'https://meet.google.com/abcd-efgh-ijk','completed','Support skills assessment','2026-02-04 09:21:11','2026-02-06 09:21:11');

INSERT INTO scorecards
(id,interview_id,interviewer_id,ratings,comments,recommendation,is_final,submitted_at,created_at,updated_at) VALUES
(1,1,8,'{\"domain\": 5, \"communication\": 4, \"problem_solving\": 4}','Good communication, strong domain knowledge.','Yes',1,'2026-01-31 09:21:11','2026-01-31 09:21:11','2026-01-31 09:21:11'),
(2,2,12,'{\"culture\": 4, \"technical\": 5, \"experience\": 4}','Excellent technical knowledge, good fit.','Strong Yes',1,'2026-02-03 09:21:11','2026-02-03 09:21:11','2026-02-03 09:21:11'),
(3,3,12,'{\"attitude\": 3, \"technical\": 2, \"communication\": 3}','Lacks depth in troubleshooting, not suitable.','No',1,'2026-02-06 09:21:11','2026-02-06 09:21:11','2026-02-06 09:21:11');

INSERT INTO saved_jobs (id,candidate_id,job_id,saved_at) VALUES
(1,15,4,'2026-01-27 09:21:11'),
(2,16,1,'2026-01-29 09:21:11'),
(3,18,7,'2026-02-03 09:21:11'),
(4,20,5,'2026-02-08 09:21:11');

INSERT INTO contact_requests
(id,full_name,work_email,company_name,role,message,agreed_to_contact,created_at,updated_at) VALUES
(1,'Elena Ruiz','elena.ruiz@corasystems.com','Cora Systems','Recruitment Lead','Need a platform demo for 4 business units and centralized approvals.',1,'2026-02-15 11:20:00','2026-02-15 11:20:00'),
(2,'Nikhil Sharma','nikhil.sharma@novalynx.com','Novalynx Technologies','Hiring Manager','Looking for interview scorecard templates and role-based access setup.',1,'2026-02-18 14:05:00','2026-02-18 14:05:00');

INSERT INTO audit_logs
(id,user_id,action,entity_type,entity_id,old_data,new_data,ip_address,created_at) VALUES
(1,1,'COMPANY_CREATED','companies',1,NULL,'{\"name\": \"TCS Limited\"}','203.0.113.1','2026-01-04 09:16:19'),
(5,15,'APPLICATION_SUBMITTED','applications',3,NULL,'{\"status\": \"applied\"}','203.0.113.5','2026-01-19 09:25:16'),
(6,16,'INTERVIEW_SCHEDULED','interviews',1,NULL,'{\"scheduled_at\": \"2026-01-31 14:55:16\"}','203.0.113.6','2026-01-30 09:25:16'),
(7,17,'OFFER_RECOMMENDED','applications',5,NULL,'{\"offer_recommended\": true}','203.0.113.7','2026-02-05 09:25:16');


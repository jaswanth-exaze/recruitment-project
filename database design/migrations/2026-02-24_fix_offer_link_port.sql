-- Fix existing offer links saved with the wrong localhost port.
-- Backend serves generated offer letters from port 3000 in this project.
UPDATE offers
SET
  document_url = REPLACE(document_url, 'http://localhost:5000/', 'http://localhost:3000/'),
  esign_link = REPLACE(esign_link, 'http://localhost:5000/', 'http://localhost:3000/'),
  updated_at = NOW()
WHERE
  document_url LIKE 'http://localhost:5000/%'
  OR esign_link LIKE 'http://localhost:5000/%';

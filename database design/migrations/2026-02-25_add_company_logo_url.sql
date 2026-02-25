ALTER TABLE companies
ADD COLUMN logo_url VARCHAR(1000) NULL AFTER domain;

UPDATE companies
SET logo_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/TCS_Logo_%28cropped%29.jpg/640px-TCS_Logo_%28cropped%29.jpg'
WHERE LOWER(name) LIKE '%tcs%';

UPDATE companies
SET logo_url = 'https://upload.wikimedia.org/wikipedia/commons/9/95/Infosys_logo.svg'
WHERE LOWER(name) LIKE '%infosys%';

UPDATE companies
SET logo_url = 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Wipro_Primary_Logo_Color_RGB.svg'
WHERE LOWER(name) LIKE '%wipro%';

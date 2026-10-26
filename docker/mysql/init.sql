-- Base aparte para la suite de pruebas (Pest), con el mismo usuario de la aplicación.
CREATE DATABASE IF NOT EXISTS finantech_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON finantech_test.* TO 'finantech'@'%';
FLUSH PRIVILEGES;

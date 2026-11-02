-- Base aparte para la suite de pruebas (Pest), con el mismo usuario de la aplicación.
-- Las bases finantech_test_<agente> permiten que varios agentes corran Pest en paralelo
-- sin pisarse: docker compose exec -e DB_DATABASE=finantech_test_backend app ./vendor/bin/pest
CREATE DATABASE IF NOT EXISTS finantech_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS finantech_test_backend CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS finantech_test_fullstack CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS finantech_test_qa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON `finantech\_test%`.* TO 'finantech'@'%';
FLUSH PRIVILEGES;

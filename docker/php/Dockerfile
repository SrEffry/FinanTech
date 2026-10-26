FROM php:8.4-fpm

RUN apt-get update \
    && apt-get install -y --no-install-recommends git unzip libzip-dev libicu-dev \
    && docker-php-ext-install pdo_mysql bcmath intl zip opcache pcntl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY php.ini /usr/local/etc/php/conf.d/finantech.ini
COPY entrypoint.sh /usr/local/bin/finantech-entrypoint
RUN sed -i 's/\r$//' /usr/local/bin/finantech-entrypoint && chmod +x /usr/local/bin/finantech-entrypoint

ENV COMPOSER_PROCESS_TIMEOUT=0

WORKDIR /var/www/html

ENTRYPOINT ["finantech-entrypoint"]
CMD ["php-fpm"]

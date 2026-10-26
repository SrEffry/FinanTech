#!/bin/sh
set -e

# php-fpm corre como www-data, pero el código montado desde el host pertenece a root.
if [ -d storage ]; then
    chown -R www-data:www-data storage bootstrap/cache
fi

exec "$@"

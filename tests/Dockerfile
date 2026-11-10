ARG PHP_VERSION=8.3
FROM php:${PHP_VERSION}-cli-bookworm
RUN docker-php-ext-install -j2 pdo_mysql
WORKDIR /app

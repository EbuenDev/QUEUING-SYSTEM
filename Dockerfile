FROM php:8.3-apache

# Install PostgreSQL development libraries and PHP PostgreSQL extensions
RUN apt-get update \
    && apt-get install -y libpq-dev \
    && docker-php-ext-install pdo pdo_pgsql pgsql \
    && rm -rf /var/lib/apt/lists/*

# Enable Apache mod_rewrite for clean URLs
RUN a2enmod rewrite

# Copy the website into Apache
COPY . /var/www/html/

# Set working directory
WORKDIR /var/www/html

# Set proper permissions for Apache
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html

# Create custom Apache configuration to serve from public directory
RUN cat > /etc/apache2/sites-available/000-default.conf <<'EOF'
<VirtualHost *:80>
    DocumentRoot /var/www/html/public
    <Directory /var/www/html/public>
        AllowOverride All
        Require all granted
    </Directory>
    # Alias for backend API access
    Alias /backend /var/www/html/backend
    <Directory /var/www/html/backend>
        AllowOverride All
        Require all granted
    </Directory>
    ErrorLog ${APACHE_LOG_DIR}/error.log
    CustomLog ${APACHE_LOG_DIR}/access.log combined
</VirtualHost>
EOF

# Expose port 80
EXPOSE 80

# Start Apache in foreground
CMD ["apache2-foreground"]
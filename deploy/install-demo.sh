#!/usr/bin/env bash
set -euo pipefail
# Run on Ubuntu after uploading /tmp/kbu-demo.tar.gz. Existing Nginx HTTPS is preserved.
release="$(date -u +%Y%m%dT%H%M%SZ)"
backup="/var/backups/kbu-demo/$release"
sudo mkdir -p "$backup" "/var/www/kbu-demo/releases/$release"
sudo cp /etc/apache2/ports.conf "$backup/apache-ports.conf"
sudo cp /etc/nginx/sites-available/n8n "$backup/n8n"
sudo tar -xzf /tmp/kbu-demo.tar.gz -C "/var/www/kbu-demo/releases/$release" --no-same-owner
sudo chmod -R a+rX "/var/www/kbu-demo/releases/$release"
sudo ln -sfn "/var/www/kbu-demo/releases/$release" /var/www/kbu-demo/current
sudo tee /etc/apache2/ports.conf >/dev/null <<'APACHEPORT'
Listen 127.0.0.1:8088
APACHEPORT
sudo tee /etc/apache2/sites-available/kbu-demo.conf >/dev/null <<'APACHE'
<VirtualHost 127.0.0.1:8088>
    ServerName cc.pjhpjh.kr
    DocumentRoot /var/www/kbu-demo/current
    <Directory /var/www/kbu-demo/current>
        Options -Indexes +FollowSymLinks
        AllowOverride None
        Require all granted
        DirectoryIndex index.html
    </Directory>
    Header always set Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'"
    Header always set X-Content-Type-Options "nosniff"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    <Files "index.html">
        Header set Cache-Control "no-cache"
    </Files>
    ProxyPass /api/demo-ai/ http://127.0.0.1:8089/api/demo-ai/
    ProxyPassReverse /api/demo-ai/ http://127.0.0.1:8089/api/demo-ai/
    ErrorLog ${APACHE_LOG_DIR}/kbu-demo-error.log
    CustomLog ${APACHE_LOG_DIR}/kbu-demo-access.log combined
</VirtualHost>
APACHE
sudo a2dissite 000-default
sudo a2enmod headers proxy proxy_http
sudo a2ensite kbu-demo
sudo apache2ctl configtest
sudo systemctl restart apache2
curl --fail --silent http://127.0.0.1:8088/ >/dev/null
sudo python3 - <<'PY'
from pathlib import Path
p=Path('/etc/nginx/sites-available/n8n')
s=p.read_text()
block='''    # KBU public demo served by Apache
    location = /kbu { return 301 /kbu/; }
    location ^~ /kbu/ {
        proxy_pass http://127.0.0.1:8088/;
        proxy_set_header Host $host;
    }

'''
if 'location ^~ /kbu/' not in s:
    assert s.count('    location / {') == 1
    p.write_text(s.replace('    location / {',block+'    location / {',1))
PY
if ! sudo nginx -t; then
    sudo cp "$backup/n8n" /etc/nginx/sites-available/n8n
    exit 1
fi
sudo systemctl reload nginx
sudo systemctl enable apache2
printf 'Release: %s\nBackup: %s\nURL: https://cc.pjhpjh.kr/kbu/\n' "$release" "$backup"

#!/usr/bin/env bash
set -euo pipefail
sudo install -d -m 755 /opt/kbu-demo-ai
sudo tar -xzf /tmp/kbu-ai.tar.gz -C /opt/kbu-demo-ai --no-same-owner
sudo chmod -R a+rX /opt/kbu-demo-ai
sudo tee /etc/systemd/system/kbu-demo-ai.service >/dev/null <<'SERVICE'
[Unit]
Description=KBU demo GPT explanation API
After=network-online.target
[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/kbu-demo-ai
EnvironmentFile=/etc/kbu-demo-ai.env
Environment=DEMO_DATA=/opt/kbu-demo-ai/edcDemo.json
ExecStart=/usr/bin/python3 /opt/kbu-demo-ai/server.py
Restart=on-failure
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
[Install]
WantedBy=multi-user.target
SERVICE
sudo systemctl daemon-reload
sudo systemctl enable --now kbu-demo-ai
sudo systemctl restart kbu-demo-ai

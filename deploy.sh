#!/bin/bash
set -euo pipefail

# ==========================================================
#  e-Dokter (SIMRS) — Deployment Script
#  Usage: bash deploy.sh
#  Run this script on the target server after cloning the repo.
#  It installs dependencies, builds, and starts all services.
# ==========================================================

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[$(date +%H:%M:%S)]${NC} $1"; }
ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; exit 1; }

# --- Configuration ---
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-09}"
DB_NAME="${DB_NAME:-rsisa_lokal}"
JWT_SECRET="${JWT_SECRET:-e-dokter-$(date +%s)}"
API_PORT="${API_PORT:-4000}"
E_DOKTER_DOMAIN="${E_DOKTER_DOMAIN:-dokter.example.com}"
SERVER_ADMIN="${SERVER_ADMIN:-admin@example.com}"
SERVER_USER="${SUDO_USER:-$(whoami)}"
SETUP_SSL="${SETUP_SSL:-false}"
CONTINUE_ON_FAIL="${CONTINUE_ON_FAIL:-false}"

_err_handler() {
  local rc=$?
  [ "$CONTINUE_ON_FAIL" = "true" ] && warn "Step gagal (kode $rc), lanjut..." && return 0
  fail "Script gagal pada langkah sebelumnya (kode $rc). Set CONTINUE_ON_FAIL=true untuk skip error."
}
trap _err_handler ERR

echo ""
echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}   e-Dokter (SIMRS) — Auto Deployment${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""
echo "  App Directory : $APP_DIR"
echo "  Database      : $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
echo "  API Port      : $API_PORT"
echo "  Domain        : $E_DOKTER_DOMAIN"
echo ""

# --------------------------------------------------
# 1. Install system dependencies (if needed)
# --------------------------------------------------
log "[1/9] Memeriksa & menginstall prerequisites..."

install_pkg() {
  if command -v apt-get &>/dev/null; then
    sudo apt-get update -qq && sudo apt-get install -y -qq "$@"
  elif command -v yum &>/dev/null; then
    sudo yum install -y -q "$@"
  elif command -v dnf &>/dev/null; then
    sudo dnf install -y -q "$@"
  else
    fail "Package manager tidak dikenal. Install manual: $*"
  fi
}

if ! command -v node &>/dev/null; then
  warn "Node.js belum terinstall. Menginstall..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
  install_pkg nodejs
  ok "Node.js: $(node --version)"
else
  ok "Node.js: $(node --version)"
fi

if ! command -v npm &>/dev/null; then
  install_pkg npm
fi
ok "npm: $(npm --version)"

if ! command -v mysql &>/dev/null; then
  warn "MySQL client tidak ditemukan. Menginstall..."
  install_pkg mysql-client
fi
ok "MySQL client tersedia"

if ! command -v git &>/dev/null; then
  install_pkg git
fi

# --------------------------------------------------
# 2. Setup environment variables
# --------------------------------------------------
log "[2/9] Membuat konfigurasi environment..."

cat > "$APP_DIR/backend/.env" <<EOF
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME
JWT_SECRET=$JWT_SECRET
PORT=$API_PORT
FRONTEND_URL=http://$E_DOKTER_DOMAIN
EOF
ok "backend/.env berhasil dibuat"

# --------------------------------------------------
# 3. Test database connection
# --------------------------------------------------
log "[3/9] Menguji koneksi database..."

if mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SELECT 1" &>/dev/null; then
  ok "Koneksi database berhasil"
else
  fail "Gagal konek ke database. Cek DB_HOST/DB_USER/DB_PASSWORD/DB_NAME"
fi

# --------------------------------------------------
# 4. Install backend dependencies
# --------------------------------------------------
log "[4/9] Menginstall dependensi backend..."
cd "$APP_DIR/backend"
npm install --omit=dev
ok "Dependensi backend selesai"

# --------------------------------------------------
# 5. Install & build frontend
# --------------------------------------------------
log "[5/9] Menginstall & build frontend..."
cd "$APP_DIR/frontend"
npm install
npm run build
ok "Frontend berhasil di-build"

# --------------------------------------------------
# 6. Seed database
# --------------------------------------------------
log "[6/9] Menyiapkan data aplikasi..."
cd "$APP_DIR/backend"
npx tsx src/db/seed.ts 2>&1 || warn "Seed mungkin sudah ada (abaikan jika sudah ada user)"
ok "Data aplikasi siap"

# --------------------------------------------------
# 7. Setup systemd service
# --------------------------------------------------
log "[7/9] Membuat systemd service..."

SYSTEMD_FILE="/etc/systemd/system/e-dokter.service"

sudo tee "$SYSTEMD_FILE" > /dev/null <<EOF
[Unit]
Description=e-Dokter (SIMRS) Backend
Documentation=https://$E_DOKTER_DOMAIN
After=network.target mysql.service
Wants=mysql.service

[Service]
Type=simple
User=$SERVER_USER
WorkingDirectory=$APP_DIR/backend
ExecStart=$(which npx) tsx src/index.ts
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=$API_PORT
Environment=DB_HOST=$DB_HOST
Environment=DB_PORT=$DB_PORT
Environment=DB_USER=$DB_USER
Environment=DB_PASSWORD=$DB_PASSWORD
Environment=DB_NAME=$DB_NAME
Environment=JWT_SECRET=$JWT_SECRET

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable e-dokter
sudo systemctl restart e-dokter
ok "Systemd service e-dokter berjalan di port $API_PORT"

# --------------------------------------------------
# 8. Setup reverse proxy (Nginx or Apache)
# --------------------------------------------------
log "[8/9] Konfigurasi reverse proxy..."

setup_nginx() {
  sudo tee "/etc/nginx/sites-available/$E_DOKTER_DOMAIN" > /dev/null <<NGINX
server {
    listen 80;
    server_name $E_DOKTER_DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:$API_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX
  sudo ln -sf "/etc/nginx/sites-available/$E_DOKTER_DOMAIN" /etc/nginx/sites-enabled/
  sudo nginx -t && sudo systemctl reload nginx
}

setup_apache() {
  sudo a2enmod proxy proxy_http headers rewrite 2>/dev/null || true
  sudo tee "/etc/apache2/sites-available/$E_DOKTER_DOMAIN.conf" > /dev/null <<APACHE
<VirtualHost *:80>
    ServerName $E_DOKTER_DOMAIN
    ServerAdmin $SERVER_ADMIN
    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:$API_PORT/
    ProxyPassReverse / http://127.0.0.1:$API_PORT/
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/?(.*) ws://127.0.0.1:$API_PORT/\$1 [P,L]
    ErrorLog \${APACHE_LOG_DIR}/$E_DOKTER_DOMAIN-error.log
    CustomLog \${APACHE_LOG_DIR}/$E_DOKTER_DOMAIN-access.log combined
</VirtualHost>
APACHE
  sudo a2ensite "$E_DOKTER_DOMAIN" 2>/dev/null || true
  sudo systemctl reload apache2
}

setup_ssl() {
  if command -v certbot &>/dev/null; then
    sudo certbot --nginx -d "$E_DOKTER_DOMAIN" --non-interactive --agree-tos -m "$SERVER_ADMIN" 2>/dev/null ||
    sudo certbot --apache -d "$E_DOKTER_DOMAIN" --non-interactive --agree-tos -m "$SERVER_ADMIN" 2>/dev/null ||
    warn "Gagal setup SSL. Jalankan manual: sudo certbot --nginx -d $E_DOKTER_DOMAIN"
  else
    warn "certbot tidak ditemukan. Install: sudo apt install certbot python3-certbot-nginx"
  fi
}

if command -v nginx &>/dev/null; then
  setup_nginx
  ok "Nginx reverse proxy untuk $E_DOKTER_DOMAIN"
elif command -v apache2ctl &>/dev/null || command -v apachectl &>/dev/null; then
  setup_apache
  ok "Apache reverse proxy untuk $E_DOKTER_DOMAIN"
else
  warn "Nginx/Apache tidak terdeteksi. Buat reverse proxy manual ke http://127.0.0.1:$API_PORT"
fi

if [ "$SETUP_SSL" = "true" ]; then
  setup_ssl
fi

# --------------------------------------------------
# 9. Verify deployment
# --------------------------------------------------
log "[9/9] Verifikasi deployment..."

sleep 3
if curl -s "http://localhost:$API_PORT/ping" | grep -q "ok"; then
  ok "Backend API merespons: http://localhost:$API_PORT/ping"
else
  warn "Backend belum merespons. Cek: journalctl -u e-dokter -n 50 --no-pager"
fi

if [ -f "$APP_DIR/frontend/dist/index.html" ]; then
  ok "Frontend build tersedia"
fi

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}   DEPLOYMENT SELESAI${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "  Akses        : http://$E_DOKTER_DOMAIN"
echo "  Backend API  : http://127.0.0.1:$API_PORT"
echo ""
echo "  Log backend  : journalctl -u e-dokter -f"
echo "  Restart      : sudo systemctl restart e-dokter"
echo "  Status       : sudo systemctl status e-dokter"
echo ""
if [ "$SETUP_SSL" = "false" ]; then
  echo "  Setup SSL    : SETUP_SSL=true bash deploy.sh"
fi
echo ""

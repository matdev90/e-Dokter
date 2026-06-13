#!/bin/bash
set -e

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
NC='\033[0m' # No Color

log()  { echo -e "${CYAN}[$(date +%H:%M:%S)]${NC} $1"; }
ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; exit 1; }

# --- Configuration (change these for your environment) ---
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-09}"
DB_NAME="${DB_NAME:-rsisa_lokal}"
JWT_SECRET="${JWT_SECRET:-e-dokter-prod-secret-$(date +%s)}"
API_PORT="${API_PORT:-4000}"

# --- Domain configuration (baru untuk e-dokter) ---
E_DOKTER_DOMAIN="${E_DOKTER_DOMAIN:-dokter.rsisanggoro.com}"
DOMAIN_MAIN="${DOMAIN_MAIN:-rsisanggoro.com}"
SERVER_ADMIN="${SERVER_ADMIN:-admin@rsisanggoro.com}"
SERVER_USER="${SUDO_USER:-$(whoami)}"

# Auto-detect Bun path
BUN_PATH=""
if command -v bun &>/dev/null; then
  BUN_PATH=$(command -v bun)
elif [ -f "$HOME/.bun/bin/bun" ]; then
  BUN_PATH="$HOME/.bun/bin/bun"
fi

FRONTEND_URL="${FRONTEND_URL:-http://$E_DOKTER_DOMAIN}"

echo ""
echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}   e-Dokter (SIMRS) — Auto Deployment${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""
echo "  App Directory : $APP_DIR"
echo "  Database      : $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
echo "  API Port      : $API_PORT"
echo "  Domain        : $E_DOKTER_DOMAIN"
echo "  Frontend URL  : $FRONTEND_URL"
echo ""
echo -e "  ${YELLOW}Catatan: 3 domain existing (rsisanggoro.com,${NC}"
echo -e "  ${YELLOW}api.rsisanggoro.com, presensi.rsisanggoro.com)${NC}"
echo -e "  ${YELLOW}tidak akan disentuh.${NC}"
echo ""

# --------------------------------------------------
# 1. Check prerequisites
# --------------------------------------------------
log "[1/9] Memeriksa prerequisites..."

if ! command -v mysql &>/dev/null; then
  fail "MySQL client tidak ditemukan. Install: apt install mysql-client"
fi
ok "MySQL client tersedia"

if command -v bun &>/dev/null; then
  BUN=$(command -v bun)
  ok "Bun ditemukan: $BUN ($(bun --version))"
else
  warn "Bun belum terinstall. Menginstall Bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
  if ! command -v bun &>/dev/null; then
    fail "Gagal menginstall Bun. Install manual: curl -fsSL https://bun.sh/install | bash"
  fi
  BUN_PATH=$(command -v bun)
  ok "Bun berhasil diinstall: $(bun --version)"
fi

if ! command -v node &>/dev/null; then
  warn "Node.js belum terinstall. Menginstall Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs
  ok "Node.js berhasil diinstall: $(node --version)"
fi
ok "Node.js tersedia: $(node --version)"

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
FRONTEND_URL=$FRONTEND_URL
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
bun install --frozen-lockfile 2>/dev/null || bun install
ok "Dependensi backend selesai"

# --------------------------------------------------
# 5. Install & build frontend
# --------------------------------------------------
log "[5/9] Menginstall & build frontend..."

cd "$APP_DIR/frontend"
npm install 2>&1 | tail -1
npm run build
ok "Frontend berhasil di-build ke frontend/dist/"

# --------------------------------------------------
# 6. Seed database (app_users)
# --------------------------------------------------
log "[6/9] Menyiapkan data aplikasi..."

cd "$APP_DIR/backend"
bun run src/db/seed.ts 2>&1 || warn "Seed mungkin sudah ada (abaikan jika sudah ada user)"
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
ExecStart=$BUN_PATH run src/index.ts
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
Environment=FRONTEND_URL=$FRONTEND_URL

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable e-dokter
sudo systemctl restart e-dokter

ok "Systemd service e-dokter berjalan di port $API_PORT"

# --------------------------------------------------
# 8. Setup Apache reverse proxy (if Apache detected)
# --------------------------------------------------
log "[8/9] Konfigurasi Apache reverse proxy..."

if command -v apache2ctl &>/dev/null || command -v apachectl &>/dev/null; then
  # Enable required modules
  sudo a2enmod proxy proxy_http proxy_balancer lbmethod_byrequests headers ssl rewrite 2>/dev/null || true

  # --- Hanya buat konfigurasi untuk e-dokter ---
  # 3 domain existing (rsisanggoro.com, api.rsisanggoro.com, presensi.rsisanggoro.com)
  # tidak disentuh karena sudah berjalan.
  sudo tee "/etc/apache2/sites-available/$E_DOKTER_DOMAIN.conf" > /dev/null <<APACHE
<VirtualHost *:80>
    ServerName $E_DOKTER_DOMAIN
    ServerAdmin $SERVER_ADMIN

    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:$API_PORT/
    ProxyPassReverse / http://127.0.0.1:$API_PORT/

    # WebSocket support
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

  ok "Apache virtual host untuk $E_DOKTER_DOMAIN"
  ok "3 domain existing (rsisanggoro.com, api, presensi) tidak diubah"
else
  warn "Apache tidak terdeteksi. Lewati konfigurasi reverse proxy."
  echo "  Buat manual reverse proxy di web server Anda ke http://127.0.0.1:$API_PORT"
fi

# --------------------------------------------------
# 9. Verify deployment
# --------------------------------------------------
log "[9/9] Verifikasi deployment..."

sleep 3
if curl -s "http://localhost:$API_PORT/ping" | grep -q "ok"; then
  ok "Backend API merespons: http://localhost:$API_PORT/ping"
else
  warn "Backend belum merespons. Cek log: journalctl -u e-dokter -n 50 --no-pager"
fi

if [ -f "$APP_DIR/frontend/dist/index.html" ]; then
  ok "Frontend build tersedia di frontend/dist/"
fi

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}   DEPLOYMENT SELESAI${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "  Akses        : http://$E_DOKTER_DOMAIN"
echo "  Backend API  : http://127.0.0.1:$API_PORT"
echo ""
echo "  Sebelum akses, tambahkan DNS A record:"
echo "    $E_DOKTER_DOMAIN → (IP server)"
echo ""
echo "  Log backend  : journalctl -u e-dokter -f"
echo "  Restart      : sudo systemctl restart e-dokter"
echo "  Status       : sudo systemctl status e-dokter"
echo "  Apache       : sudo systemctl reload apache2"
echo ""
echo -e "  ${GREEN}Domain existing tidak disentuh:${NC}"
echo "    ✓ rsisanggoro.com"
echo "    ✓ api.rsisanggoro.com"
echo "    ✓ presensi.rsisanggoro.com"
echo ""

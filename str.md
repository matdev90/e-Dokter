# Strategi Deployment e-Dokter (Sub-path Existing Domain)

## Tujuan

Menempatkan aplikasi e-dokter di `rsisanggoro.com/e-dokter/` tanpa membuat subdomain baru.

## Arsitektur

```
Browser → rsisanggoro.com/e-dokter/*
              ↕ (Apache ProxyPass)
         localhost:4000/
              ↕
         Node.js (Express) → Serve frontend build + API
              ↕
         MySQL (SIMRS)
```

Semua request masuk lewat domain utama, Apache meneruskan path `/e-dokter/` ke backend di port `4000`.

## Layout File di Server

```
/var/www/
├── rsisanggoro.com/public_html/    ← domain utama (existing)
├── api.rsisanggoro.com/public_html/
├── presensi.rsisanggoro.com/public_html/
└── e-dokter/                       ← aplikasi e-dokter (clone repo di sini)
    ├── backend/
    ├── frontend/
    ├── deploy.sh
    └── ...
```

## Apache Configuration

Buat `/etc/apache2/sites-available/rsisanggoro.com.conf` (atau edit existing):

```apache
<VirtualHost *:80>
    ServerName rsisanggoro.com
    ServerAdmin admin@rsisanggoro.com
    DocumentRoot /var/www/rsisanggoro.com/public_html

    # ... existing config ...

    # e-Dokter — proxy semua /e-dokter/* ke Node.js
    ProxyPass /e-dokter/ http://127.0.0.1:4000/
    ProxyPassReverse /e-dokter/ http://127.0.0.1:4000/

    # Uploads (gambar, file) — serve langsung dari backend
    ProxyPass /uploads/ http://127.0.0.1:4000/uploads/
    ProxyPassReverse /uploads/ http://127.0.0.1:4000/uploads/

    ErrorLog ${APACHE_LOG_DIR}/rsisanggoro.com-error.log
    CustomLog ${APACHE_LOG_DIR}/rsisanggoro.com-access.log combined
</VirtualHost>
```

## Konfigurasi Frontend

### `frontend/vite.config.ts`
```ts
base: '/e-dokter/',
```

### `frontend/src/main.tsx`
```tsx
<BrowserRouter basename="/e-dokter">
```

### `frontend/src/services/api.ts`
```ts
const api = axios.create({
  baseURL: "/e-dokter/api",
  headers: { "Content-Type": "application/json" },
});
```

### `frontend/src/services/api.ts` (refresh token)
```ts
const { data } = await axios.post("/e-dokter/api/auth/refresh", { refreshToken });
```

### `frontend/src/services/api.ts` (redirect after logout)
```ts
window.location.href = "/e-dokter/login";
```

Ada 3 tempat yang hardcode `"/login"` dan `"/api"` di `api.ts` — sudah diubah semua.

### Build Frontend
```bash
cd frontend
npm run build
```

## Konfigurasi Backend

Tidak perlu ubah kode backend. Backend tetap serve di `/`.
Apache yang handle mapping `/e-dokter/` → `/`.

Cukup update `.env`:
```
PORT=4000
FRONTEND_URL=https://rsisanggoro.com
```

## Langkah Deployment

```bash
# 1. Clone repo
cd /var/www
git clone https://github.com/matdev90/e-Dokter.git e-dokter
cd e-dokter

# 2. Setup environment
export DB_HOST=localhost
export DB_USER=root
export DB_PASSWORD=xxx
export DB_NAME=rsisa_lokal
export E_DOKTER_DOMAIN=rsisanggoro.com
export JWT_SECRET=$(openssl rand -hex 32)

# 3. Jalankan deploy (skip reverse proxy karena manual)
export CONTINUE_ON_FAIL=true
bash deploy.sh

# 4. Setup ulang Apache manual (sesuai template di atas)
sudo systemctl reload apache2

# 5. Verifikasi
curl -s http://localhost:4000/ping           # harus {"status":"ok"}
curl -s http://localhost:4000/ | head -5     # harus HTML index.html
```

Akses: `https://rsisanggoro.com/e-dokter/`

## Catatan

- Semua path `/e-dokter/*` diproxy ke backend. Backend tidak perlu tahu tentang prefix `/e-dokter`.
- File statis (CSS, JS, images) dari `frontend/dist/assets/` disajikan langsung oleh Express.
- API endpoint tetap `/api/*` di backend, diakses via `/e-dokter/api/*` dari browser.
- Upload file: path `/uploads/` juga diproxy.

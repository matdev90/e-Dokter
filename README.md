# e-Dokter (SIMRS)

Aplikasi web untuk pembuatan resume medis dan laporan operasi, terintegrasi dengan database SIMRS (Rekam Medis Elektronik) rumah sakit.

## Fitur

- **Dashboard** — Statistik kunjungan dokter, grafik bulanan, distribusi poli, top obat
- **Rawat Jalan** — Buat & kelola resume pasien rawat jalan
- **Rawat Inap** — Buat & kelola resume pasien rawat inap  
- **Laporan Operasi** — Buat & kelola laporan operasi dengan template
- **Laporan Resume** — Lihat semua resume (ralan + ranap)
- **Manajemen Pengguna** — Admin dapat mengelola user aplikasi
- **Audit Log** — Catatan aktivitas sistem
- **Notifikasi** — Pengingat resume & laporan yang belum lengkap

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, React Router, Recharts |
| Backend | Express.js, TypeScript, Bun |
| Database | MySQL (database SIMRS existing) |
| Auth | JWT + Refresh Token, AES Encrypt (SIMRS) |

## Persyaratan

- Node.js 20+
- Bun
- MySQL (database SIMRS)
- Apache (production, untuk reverse proxy)

## Instalasi & Menjalankan

### 1. Clone & Setup

```bash
git clone https://github.com/matdev90/e-Dokter.git
cd e-Dokter
```

### 2. Backend

```bash
cd backend
cp .env.example .env   # sesuaikan konfigurasi database
bun install
bun run dev            # http://localhost:4000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
```

### 4. Build Frontend untuk Production

```bash
cd frontend
npm run build          # output di frontend/dist/
```

### 5. Deployment (Production)

Gunakan script deploy untuk setup otomatis:

```bash
bash deploy.sh
```

Script akan:
- Install dependencies
- Build frontend
- Setup systemd service (`e-dokter.service`)
- Konfigurasi Apache reverse proxy
- Verifikasi deployment

## Konfigurasi

### Backend (`backend/.env`)

| Variable | Default | Keterangan |
|----------|---------|------------|
| `DB_HOST` | `localhost` | Host database |
| `DB_PORT` | `3306` | Port database |
| `DB_USER` | `root` | User database |
| `DB_PASSWORD` | `09` | Password database |
| `DB_NAME` | `rsisa_lokal` | Nama database SIMRS |
| `JWT_SECRET` | - | Secret key JWT |
| `PORT` | `4000` | Port API |
| `FRONTEND_URL` | `http://localhost:5173` | URL frontend untuk CORS |

### Domain (deploy.sh)

| Variable | Default | Keterangan |
|----------|---------|------------|
| `E_DOKTER_DOMAIN` | `dokter.rsisanggoro.com` | Domain aplikasi |

## Login

Aplikasi menggunakan kredensial SIMRS yang sudah ada:

- **Username**: Kode dokter SIMRS (contoh: `D00000034`)
- **Password**: Password SIMRS dokter

Untuk admin/assistant, gunakan akun yang dibuat melalui menu **Pengguna** (admin only).

## Struktur Proyek

```
e-dokter/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Entry point Express
│   │   ├── middleware/auth.ts    # JWT auth middleware
│   │   ├── db/index.ts           # Koneksi MySQL + inisialisasi tabel
│   │   ├── db/seed.ts            # Seed data awal
│   │   └── routes/
│   │       ├── auth.ts           # Login, logout, refresh, ganti password
│   │       ├── patients.ts       # CRUD pasien
│   │       ├── records.ts        # Rekam medis
│   │       ├── resume-ralan.ts   # Resume rawat jalan
│   │       ├── resume-ranap.ts   # Resume rawat inap
│   │       ├── resume.ts         # Resume gabungan + delete
│   │       ├── operasi.ts        # Laporan operasi
│   │       ├── dashboard.ts      # Statistik dashboard
│   │       ├── notifications.ts  # Notifikasi
│   │       ├── users.ts          # Manajemen user
│   │       ├── attachments.ts    # Upload file
│   │       └── audit.ts          # Audit log
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx               # Router + protected routes
│   │   ├── components/
│   │   │   ├── Layout.tsx        # Sidebar + navbar
│   │   │   ├── CenteredNotification.tsx
│   │   │   ├── DeleteConfirmModal.tsx
│   │   │   ├── DoctorSearchInput.tsx
│   │   │   ├── EmployeeSearchInput.tsx
│   │   │   └── IcdAutocompleteInput.tsx
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── ResumeRalan.tsx
│   │   │   ├── ResumeRanap.tsx
│   │   │   ├── LaporanOperasi.tsx
│   │   │   ├── LaporanResume.tsx
│   │   │   ├── Users.tsx
│   │   │   ├── AuditLog.tsx
│   │   │   ├── Profile.tsx
│   │   │   └── GantiPassword.tsx
│   │   ├── services/api.ts       # Axios + API functions
│   │   └── index.css             # Global styles
│   └── package.json
├── deploy.sh                     # Script deployment
├── panduan.md                    # Panduan penggunaan
└── README.md
```

## Lisensi

MIT

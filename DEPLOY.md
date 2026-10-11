# Deploy Backend eKantin

Dokumen ini menjelaskan cara menyiapkan backend agar bisa dipakai dari ponsel lain atau dari internet publik.

## 1) Persiapan server VPS

Gunakan VPS Ubuntu 22.04 atau yang terbaru.

1. Install Node.js 22+
2. Install Git
3. Install PM2 (opsional untuk proses tetap hidup)
4. Install Nginx (opsional untuk reverse proxy)
5. Install Certbot untuk HTTPS

Contoh:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs nginx git
sudo npm install -g pm2
sudo apt install -y certbot python3-certbot-nginx
```

## 2) Clone proyek

```bash
git clone <repo-url>
cd Kelompok 2 Infor
npm install
```

## 3) Konfigurasi environment

Salin file contoh:

```bash
cp .env.example .env
```

Edit `.env`:

```env
HOST=0.0.0.0
PORT=3000
ALLOWED_ORIGINS=https://your-domain.com
EKANTIN_DB_PATH=./data/ekantin.sqlite
EKANTIN_UPLOAD_PATH=./uploads
```

## 4) Jalankan backend

Mode normal:

```bash
npm start
```

Mode production dengan PM2:

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 5) Setup Nginx reverse proxy

Salin konfigurasi contoh:

```bash
sudo cp nginx.conf.example /etc/nginx/sites-available/ekantin-api
sudo ln -s /etc/nginx/sites-available/ekantin-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Ubah `server_name` menjadi domain Anda, misalnya:

```text
server_name api.ekantin.com;
```

## 6) HTTPS

```bash
sudo certbot --nginx -d api.yourdomain.com
```

## 7) Hubungkan APK ke backend publik

Arahkan aplikasi ke URL backend publik, misalnya:

```javascript
localStorage.setItem("ekantinApiBaseUrl", "https://api.yourdomain.com");
```

Atau lewat query string:

```text
https://your-app-domain.com?apiBase=https://api.yourdomain.com
```

## 8) Catatan penting

- `localhost` hanya bisa dipakai di perangkat yang sama.
- SQLite cocok untuk demo lokal, tetapi untuk banyak pengguna lebih baik pindah ke PostgreSQL/MySQL.
- Untuk file upload foto, gunakan storage yang persistent dan aman.

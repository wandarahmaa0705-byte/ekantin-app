# eKantin

## Menjalankan aplikasi

1. Buka terminal di folder proyek.
2. Jalankan `npm.cmd start` di PowerShell.
3. Buka `http://127.0.0.1:3000` di browser.

Untuk menguji API, jalankan `npm.cmd test` di PowerShell. Tes akan memulai server dan database sementara, lalu menghapusnya setelah selesai.

Node.js 22.5 atau yang lebih baru diperlukan. Server menggunakan modul SQLite bawaan Node.js dan otomatis membuat database di `data/ekantin.sqlite` saat pertama kali dijalankan. Menu demo awal juga dibuat otomatis.

## Fitur backend

- Pendaftaran dan login pembeli (siswa/guru) serta penjual kantin.
- Password di-hash dengan scrypt dan akses API dibatasi menurut peran.
- Penjual dapat mengelola menu miliknya.
- Penjual dapat mengunggah foto menu PNG, JPG, atau WebP hingga 4 MB; file disimpan di folder `uploads`.
- Pembeli dapat memesan dengan saldo demo awal Rp50.000; pembayaran, saldo, dan riwayat pesanan disimpan di SQLite.
- Top up saldo disimulasikan untuk demo dan tidak memproses pembayaran uang sungguhan.
- Endpoint pemeriksaan server: `GET /api/health`.

## Versi Android / APK (Capacitor)

1. Pastikan Java JDK dan Android Studio sudah terinstall.
2. Jalankan `npm install`.
3. Jalankan `npx cap add android` untuk membuat project Android.
4. Jalankan `npx cap sync android` setelah setiap perubahan frontend.
5. Buka project Android di Android Studio dengan `npx cap open android`.
6. Di Android Studio, pilih build APK / bundle atau run ke emulator/device.

Catatan penting: aplikasi ini sudah dibuat agar backend dapat diatur dinamis. Untuk memakai di ponsel lain, jalankan server di komputer/laptop yang bisa diakses dari jaringan yang sama, lalu buka aplikasi dengan parameter `?apiBase=http://IP_LAN_KOMPUTER:3000` atau simpan di `localStorage` dengan kunci `ekantinApiBaseUrl`.

Untuk jaringan internet publik, backend harus dipasang di server hosting yang bisa diakses dari ponsel secara umum. `localhost` dan `127.0.0.1` hanya akan bekerja di perangkat yang sama. Database pada folder `data` hanya tersedia di komputer yang menjalankan server ini. Untuk penggunaan bersama melalui internet, aplikasi perlu dipasang pada server hosting dengan penyimpanan persisten dan konfigurasi keamanan produksi.

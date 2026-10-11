const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

function loadDotEnv(filePath) {
    if (!fs.existsSync(filePath)) return;
    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
        const separatorIndex = trimmed.indexOf("=");
        const key = trimmed.slice(0, separatorIndex).trim();
        let value = trimmed.slice(separatorIndex + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
    }
}

loadDotEnv(path.join(__dirname, ".env"));

const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "*").split(",").map(origin => origin.trim()).filter(Boolean);
const publicRoot = __dirname;
const dataDirectory = path.join(__dirname, "data");
const uploadDirectory = process.env.EKANTIN_UPLOAD_PATH || path.join(publicRoot, "uploads");
const databasePath = process.env.EKANTIN_DB_PATH || path.join(dataDirectory, "ekantin.sqlite");
const sessionLifetimeMs = 1000 * 60 * 60 * 24 * 7;
const passwordSaltBytes = 16;
const passwordKeyLength = 64;

fs.mkdirSync(dataDirectory, { recursive: true });
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
fs.mkdirSync(uploadDirectory, { recursive: true });

const database = new DatabaseSync(databasePath);
database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        identity_code TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('buyer', 'seller')),
        buyer_type TEXT CHECK (buyer_type IN ('student', 'teacher')),
        canteen_name TEXT,
        delivery_location TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS balances (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL DEFAULT 50000 CHECK (amount >= 0)
    );

    CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS menu_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seller_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL,
        price INTEGER NOT NULL CHECK (price > 0),
        image TEXT NOT NULL DEFAULT '',
        calories REAL,
        protein REAL,
        carbs REAL,
        fat REAL,
        available INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        total INTEGER NOT NULL CHECK (total > 0),
        delivery_method TEXT NOT NULL DEFAULT 'pickup',
        delivery_fee INTEGER NOT NULL DEFAULT 0,
        delivery_location TEXT,
        qris_image TEXT,
        payment_method TEXT NOT NULL DEFAULT 'saldo' CHECK (payment_method IN ('saldo', 'qris')),
        status TEXT NOT NULL DEFAULT 'Berhasil',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE SET NULL,
        seller_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        canteen_name TEXT NOT NULL,
        price INTEGER NOT NULL,
        quantity INTEGER NOT NULL CHECK (quantity > 0)
    );

    CREATE TABLE IF NOT EXISTS seller_order_progress (
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'Sedang dibuat',
        credited_amount INTEGER NOT NULL DEFAULT 0 CHECK (credited_amount >= 0),
        completed_at TEXT,
        PRIMARY KEY (order_id, seller_id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
        amount INTEGER NOT NULL,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS topup_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL CHECK (amount > 0),
        payment_method TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        proof_text TEXT DEFAULT '',
        proof_image TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        approved_at TEXT
    );
`);

database.exec(`
    INSERT OR IGNORE INTO seller_order_progress (order_id, seller_id)
    SELECT DISTINCT order_id, seller_id
    FROM order_items
    WHERE seller_id IS NOT NULL;
`);

const menuColumns = database.prepare("PRAGMA table_info(menu_items)").all().map(column => column.name);
if (!menuColumns.includes("calories")) database.exec("ALTER TABLE menu_items ADD COLUMN calories REAL");
if (!menuColumns.includes("protein")) database.exec("ALTER TABLE menu_items ADD COLUMN protein REAL");
if (!menuColumns.includes("carbs")) database.exec("ALTER TABLE menu_items ADD COLUMN carbs REAL");
if (!menuColumns.includes("fat")) database.exec("ALTER TABLE menu_items ADD COLUMN fat REAL");

const orderColumns = database.prepare("PRAGMA table_info(orders)").all().map(column => column.name);
if (!orderColumns.includes("delivery_method")) database.exec("ALTER TABLE orders ADD COLUMN delivery_method TEXT NOT NULL DEFAULT 'pickup'");
if (!orderColumns.includes("delivery_fee")) database.exec("ALTER TABLE orders ADD COLUMN delivery_fee INTEGER NOT NULL DEFAULT 0");
if (!orderColumns.includes("delivery_location")) database.exec("ALTER TABLE orders ADD COLUMN delivery_location TEXT");
if (!orderColumns.includes("payment_method")) database.exec("ALTER TABLE orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'saldo'");

const userColumns = database.prepare("PRAGMA table_info(users)").all().map(column => column.name);
if (!userColumns.includes("date_of_birth")) database.exec("ALTER TABLE users ADD COLUMN date_of_birth TEXT");
if (!userColumns.includes("student_class")) database.exec("ALTER TABLE users ADD COLUMN student_class TEXT");
if (!userColumns.includes("nisn")) database.exec("ALTER TABLE users ADD COLUMN nisn TEXT");
if (!userColumns.includes("profile_photo")) database.exec("ALTER TABLE users ADD COLUMN profile_photo TEXT");
if (!userColumns.includes("delivery_location")) database.exec("ALTER TABLE users ADD COLUMN delivery_location TEXT");
if (!userColumns.includes("qris_image")) database.exec("ALTER TABLE users ADD COLUMN qris_image TEXT");

const defaultMenu = [
    ["Nasi Ayam Sehat", "Nasi dengan ayam dan sayuran bergizi.", "makanan sehat", 15000, "kanmenu1.jpg"],
    ["Nasi Ikan", "Nasi dengan ikan dan sayuran segar.", "makanan sehat", 14000, ""],
    ["Sandwich Sayur", "Roti gandum dengan sayuran segar.", "snack sehat", 10000, ""],
    ["Susu Segar", "Susu segar dengan kandungan protein.", "minuman sehat", 8000, ""],
    ["Jus Buah", "Jus buah segar tanpa tambahan gula berlebihan.", "minuman sehat", 7000, ""],
    ["Roti Gandum", "Roti gandum kaya serat untuk sarapan.", "snack sehat", 6000, ""]
];

if (database.prepare("SELECT COUNT(*) AS count FROM menu_items").get().count === 0) {
    const addDefaultMenu = database.prepare(`
        INSERT INTO menu_items (name, description, category, price, image)
        VALUES (?, ?, ?, ?, ?)
    `);
    for (const item of defaultMenu) addDefaultMenu.run(...item);
}

const mimeTypes = {
    ".css": "text/css; charset=utf-8",
    ".gif": "image/gif",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp"
};

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function sendJson(response, status, payload) {
    response.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
    });
    response.end(JSON.stringify(payload));
}

function readJson(request, maxBytes = 1024 * 1024) {
    return new Promise((resolve, reject) => {
        let body = "";
        request.on("data", chunk => {
            body += chunk;
            if (body.length > maxBytes) {
                reject(new HttpError(413, "Ukuran permintaan terlalu besar."));
                request.destroy();
            }
        });
        request.on("end", () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch {
                reject(new HttpError(400, "Format JSON tidak valid."));
            }
        });
        request.on("error", reject);
    });
}

function hashPassword(password, salt = crypto.randomBytes(passwordSaltBytes).toString("hex")) {
    const hash = crypto.scryptSync(password, salt, passwordKeyLength).toString("hex");
    return { hash, salt };
}

function verifyPassword(password, salt, expectedHash) {
    const actualHash = Buffer.from(hashPassword(password, salt).hash, "hex");
    const storedHash = Buffer.from(expectedHash, "hex");
    return actualHash.length === storedHash.length && crypto.timingSafeEqual(actualHash, storedHash);
}

function publicUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        identityCode: user.identity_code,
        profilePhoto: user.profile_photo,
        dateOfBirth: user.date_of_birth,
        studentClass: user.student_class,
        nisn: user.nisn,
        deliveryLocation: user.delivery_location,
        qrisImage: user.qris_image,
        role: user.role,
        buyerType: user.buyer_type,
        canteenName: user.canteen_name
    };
}

async function saveImageDataUrl(imageData) {
    const match = String(imageData || "").match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match) throw new HttpError(400, "Pilih gambar PNG, JPG, atau WebP yang valid.");

    const mimeType = match[1];
    const imageBytes = Buffer.from(match[2], "base64");
    if (imageBytes.length === 0 || imageBytes.length > 4 * 1024 * 1024) {
        throw new HttpError(413, "Ukuran gambar maksimal 4 MB.");
    }

    const validSignature = mimeType === "image/png"
        ? imageBytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : mimeType === "image/jpeg"
            ? imageBytes[0] === 255 && imageBytes[1] === 216 && imageBytes[2] === 255
            : imageBytes.toString("ascii", 0, 4) === "RIFF" && imageBytes.toString("ascii", 8, 12) === "WEBP";
    if (!validSignature) throw new HttpError(400, "Isi berkas tidak sesuai dengan format gambar.");

    const extension = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" }[mimeType];
    const fileName = `${crypto.randomUUID()}${extension}`;
    await fs.promises.writeFile(path.join(uploadDirectory, fileName), imageBytes, { flag: "wx" });
    return `/uploads/${fileName}`;
}

async function removeUploadedImage(imageUrl) {
    const match = String(imageUrl || "").match(/^\/uploads\/([a-f0-9-]+\.(?:png|jpg|webp))$/);
    if (match) await fs.promises.rm(path.join(uploadDirectory, match[1]), { force: true });
}

function createSession(userId) {
    const token = crypto.randomBytes(32).toString("base64url");
    database.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
        .run(crypto.createHash("sha256").update(token).digest("hex"), userId, Date.now() + sessionLifetimeMs);
    return token;
}

function authenticate(request, requiredRole) {
    const authorization = request.headers.authorization || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!token) throw new HttpError(401, "Silakan masuk terlebih dahulu.");

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const session = database.prepare(`
        SELECT users.*, sessions.token_hash
        FROM sessions JOIN users ON users.id = sessions.user_id
        WHERE sessions.token_hash = ? AND sessions.expires_at > ?
    `).get(tokenHash, Date.now());
    if (!session) throw new HttpError(401, "Sesi tidak berlaku. Silakan masuk kembali.");
    if (requiredRole && session.role !== requiredRole) throw new HttpError(403, "Akses tidak diizinkan untuk jenis akun ini.");
    return session;
}

function normalizeMenuInput(body) {
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    const category = String(body.category || "").trim().toLowerCase();
    const price = Number(body.price);
    const image = String(body.image || "").trim();
    const nutrition = {};
    for (const [field, label, maximum] of [
        ["calories", "Kalori", 100000],
        ["protein", "Protein", 10000],
        ["carbs", "Karbohidrat", 10000],
        ["fat", "Lemak", 10000]
    ]) {
        const value = body[field];
        if (value === undefined || value === null || value === "") {
            nutrition[field] = null;
            continue;
        }
        const amount = Number(value);
        if (!Number.isFinite(amount) || amount < 0 || amount > maximum) {
            throw new HttpError(400, `Nilai ${label.toLowerCase()} tidak valid.`);
        }
        nutrition[field] = amount;
    }
    const allowedCategories = ["makanan", "minuman", "snack", "makanan sehat", "minuman sehat", "snack sehat"];

    if (!name || name.length > 100) throw new HttpError(400, "Nama menu wajib diisi (maksimal 100 karakter).");
    if (!allowedCategories.includes(category)) throw new HttpError(400, "Pilih kategori makanan, minuman, atau snack.");
    if (!Number.isSafeInteger(price) || price < 1 || price > 10000000) throw new HttpError(400, "Harga menu tidak valid.");
    if (description.length > 500) throw new HttpError(400, "Deskripsi maksimal 500 karakter.");
    if (image.length > 500) throw new HttpError(400, "Lokasi gambar maksimal 500 karakter.");

    return { name, description, category, price, image, ...nutrition };
}

function menuSelect(where = "", params = []) {
    return database.prepare(`
        SELECT menu_items.id, menu_items.seller_id AS sellerId, menu_items.name,
               menu_items.description, menu_items.category, menu_items.price,
               menu_items.image, menu_items.calories, menu_items.protein,
               menu_items.carbs, menu_items.fat, menu_items.available,
               COALESCE(users.canteen_name, 'eKantin') AS canteenName,
               users.qris_image AS qrisImage
        FROM menu_items
        LEFT JOIN users ON users.id = menu_items.seller_id
        ${where}
        ORDER BY menu_items.created_at DESC, menu_items.id DESC
    `).all(...params);
}

function formatOrder(order, items, sellerProgress = []) {
    const paymentMethod = String(order.payment_method || "saldo").toLowerCase();
    return {
        id: order.id,
        total: order.total,
        status: order.status,
        date: order.created_at,
        paymentMethod: paymentMethod === "qris" ? "QRIS" : "Saldo eKantin",
        deliveryMethod: order.delivery_method || "pickup",
        deliveryFee: order.delivery_fee || 0,
        deliveryLocation: order.delivery_location || null,
        sellerProgress: sellerProgress.map(progress => ({
            canteenName: progress.canteenName,
            status: progress.status
        })),
        items: items.map(item => ({
            name: item.name,
            canteenName: item.canteen_name,
            price: item.price,
            quantity: item.quantity
        }))
    };
}

function selectSellerOrderItems(sellerId, completed) {
    return database.prepare(`
        SELECT orders.id AS orderId, orders.total, orders.delivery_method AS deliveryMethod,
               orders.delivery_fee AS deliveryFee, orders.status, orders.created_at AS date,
             orders.delivery_location AS deliveryLocation,
               seller_order_progress.status AS sellerStatus,
               seller_order_progress.credited_amount AS creditedAmount,
               users.name AS buyerName, order_items.name, order_items.price, order_items.quantity,
               order_items.canteen_name AS canteenName
        FROM seller_order_progress
        JOIN orders ON orders.id = seller_order_progress.order_id
        JOIN users ON users.id = orders.user_id
        JOIN order_items ON order_items.order_id = orders.id
            AND order_items.seller_id = seller_order_progress.seller_id
        WHERE seller_order_progress.seller_id = ?
            AND seller_order_progress.status ${completed ? "= 'Selesai'" : "!= 'Selesai'"}
        ORDER BY orders.id DESC, order_items.id
    `).all(sellerId);
}

async function handleApi(request, response, url) {
    const { pathname } = url;
    const method = request.method;

    if (method === "GET" && pathname === "/api/health") {
        return sendJson(response, 200, { status: "ok", database: "sqlite" });
    }

    if (method === "POST" && pathname === "/api/auth/register") {
        const body = await readJson(request);
        const name = String(body.name || "").trim();
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");
        const role = body.role;
        const buyerType = role === "buyer" ? body.buyerType : null;
        const canteenName = role === "seller" ? String(body.canteenName || "").trim() : null;
        const identityCode = role === "buyer" ? String(body.identityCode || "").trim() : null;

        if (!name || name.length > 100) throw new HttpError(400, "Nama wajib diisi.");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Format email tidak valid.");
        if (password.length < 6 || password.length > 200) throw new HttpError(400, "Password minimal 6 karakter.");
        if (!["buyer", "seller"].includes(role)) throw new HttpError(400, "Pilih jenis akun.");
        if (role === "buyer" && !["student", "teacher"].includes(buyerType)) throw new HttpError(400, "Pilih kategori siswa atau guru.");
        if (role === "buyer" && !identityCode) throw new HttpError(400, "Nomor telepon wajib diisi.");
        if (role === "seller" && (!canteenName || canteenName.length > 100)) throw new HttpError(400, "Nama kantin wajib diisi.");

        const credentials = hashPassword(password);
        try {
            const result = database.prepare(`
                INSERT INTO users (name, email, identity_code, password_hash, password_salt, role, buyer_type, canteen_name)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(name, email, identityCode, credentials.hash, credentials.salt, role, buyerType, canteenName);
            const userId = Number(result.lastInsertRowid);
            database.prepare("INSERT INTO balances (user_id) VALUES (?)").run(userId);
            return sendJson(response, 201, { message: "Akun berhasil dibuat." });
        } catch (error) {
            if (String(error.message).includes("UNIQUE constraint failed")) throw new HttpError(409, "Email atau nomor telepon sudah terdaftar.");
            throw error;
        }
    }

    if (method === "POST" && pathname === "/api/auth/login") {
        const body = await readJson(request);
        const username = String(body.username || "").trim().toLowerCase();
        const password = String(body.password || "");
        if (!username || !password) throw new HttpError(400, "Email/nomor telepon dan password wajib diisi.");

        const user = database.prepare("SELECT * FROM users WHERE lower(email) = ? OR lower(identity_code) = ?")
            .get(username, username);
        if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
            throw new HttpError(401, "Email/nomor telepon atau password salah.");
        }

        const token = createSession(user.id);
        const balance = database.prepare("SELECT amount FROM balances WHERE user_id = ?").get(user.id).amount;
        return sendJson(response, 200, { token, user: publicUser(user), balance });
    }

    if (method === "POST" && pathname === "/api/auth/logout") {
        const user = authenticate(request);
        const token = request.headers.authorization.slice(7);
        database.prepare("DELETE FROM sessions WHERE token_hash = ?")
            .run(crypto.createHash("sha256").update(token).digest("hex"));
        return sendJson(response, 200, { message: "Berhasil keluar.", userId: user.id });
    }

    if (method === "GET" && pathname === "/api/auth/me") {
        const user = authenticate(request);
        const balance = database.prepare("SELECT amount FROM balances WHERE user_id = ?").get(user.id).amount;
        return sendJson(response, 200, { user: publicUser(user), balance });
    }

    if (method === "PUT" && pathname === "/api/account/profile") {
        const user = authenticate(request);
        const body = await readJson(request);
        const name = String(body.name || "").trim();
        const email = String(body.email || "").trim().toLowerCase();
        const identityCode = user.role === "buyer" ? String(body.identityCode || "").trim() : null;
        const dateOfBirth = user.role === "buyer" ? String(body.dateOfBirth || "").trim() || null : user.date_of_birth;
        const studentClass = user.role === "buyer" ? String(body.studentClass || "").trim() || null : user.student_class;
        const nisn = user.role === "buyer" ? String(body.nisn || "").trim() || null : user.nisn;
        const deliveryLocation = user.role === "buyer" ? String(body.deliveryLocation || "").trim() || null : user.delivery_location;
        const canteenName = user.role === "seller" ? String(body.canteenName || "").trim() : null;
        if (!name || name.length > 100) throw new HttpError(400, "Nama wajib diisi.");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Format email tidak valid.");
        if (user.role === "buyer" && !identityCode) throw new HttpError(400, "Nomor telepon wajib diisi.");
        if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) throw new HttpError(400, "Format tanggal lahir tidak valid.");
        if (studentClass && studentClass.length > 30) throw new HttpError(400, "Kelas maksimal 30 karakter.");
        if (nisn && nisn.length > 30) throw new HttpError(400, "NISN maksimal 30 karakter.");
        if (deliveryLocation && deliveryLocation.length > 100) throw new HttpError(400, "Lokasi antar maksimal 100 karakter.");
        if (user.role === "seller" && (!canteenName || canteenName.length > 100)) throw new HttpError(400, "Nama kantin wajib diisi.");
        try {
            database.prepare(`
                UPDATE users SET name = ?, email = ?, identity_code = ?, canteen_name = ?,
                    date_of_birth = ?, student_class = ?, nisn = ?, delivery_location = ?
                WHERE id = ?
            `).run(name, email, identityCode, canteenName, dateOfBirth, studentClass, nisn, deliveryLocation, user.id);
            if (user.role === "buyer" && deliveryLocation) {
                database.prepare(`
                    UPDATE orders SET delivery_location = ?
                    WHERE user_id = ? AND delivery_method = 'delivery' AND delivery_location IS NULL
                        AND EXISTS (
                            SELECT 1 FROM seller_order_progress
                            WHERE seller_order_progress.order_id = orders.id
                                AND seller_order_progress.status <> 'Selesai'
                        )
                `).run(deliveryLocation, user.id);
            }
        } catch (error) {
            if (String(error.message).includes("UNIQUE constraint failed")) throw new HttpError(409, "Email atau nomor telepon sudah terdaftar.");
            throw error;
        }
        const updatedUser = database.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
        return sendJson(response, 200, { user: publicUser(updatedUser) });
    }

    if (method === "POST" && pathname === "/api/account/profile-photo") {
        const user = authenticate(request, "buyer");
        const body = await readJson(request, 6 * 1024 * 1024);
        const profilePhoto = await saveImageDataUrl(body.imageData);
        database.prepare("UPDATE users SET profile_photo = ? WHERE id = ?").run(profilePhoto, user.id);
        await removeUploadedImage(user.profile_photo);
        const updatedUser = database.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
        return sendJson(response, 201, { user: publicUser(updatedUser) });
    }

    if (method === "DELETE" && pathname === "/api/account/profile-photo") {
        const user = authenticate(request, "buyer");
        database.prepare("UPDATE users SET profile_photo = NULL WHERE id = ?").run(user.id);
        await removeUploadedImage(user.profile_photo);
        const updatedUser = database.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
        return sendJson(response, 200, { user: publicUser(updatedUser) });
    }

    if (method === "GET" && pathname === "/api/menu") {
        const items = menuSelect("WHERE menu_items.seller_id IS NOT NULL");
        return sendJson(response, 200, { items });
    }

    if (method === "GET" && pathname === "/api/menu/popular") {
        const items = database.prepare(`
            SELECT menu_items.id, menu_items.seller_id AS sellerId, menu_items.name,
                   menu_items.description, menu_items.category, menu_items.price,
                   menu_items.image, menu_items.calories, menu_items.protein,
                   menu_items.carbs, menu_items.fat, menu_items.available,
                   COALESCE(users.canteen_name, 'eKantin') AS canteenName,
                   SUM(order_items.quantity) AS orderCount
            FROM order_items
            JOIN menu_items ON menu_items.id = order_items.menu_item_id
            LEFT JOIN users ON users.id = menu_items.seller_id
            WHERE menu_items.seller_id IS NOT NULL
            GROUP BY menu_items.id
            ORDER BY orderCount DESC, menu_items.created_at DESC
            LIMIT 3
        `).all();
        return sendJson(response, 200, { items });
    }

    if (method === "POST" && pathname === "/api/seller/menu-image") {
        authenticate(request, "seller");
        const body = await readJson(request, 6 * 1024 * 1024);
        return sendJson(response, 201, { image: await saveImageDataUrl(body.imageData) });
    }

    if (method === "POST" && pathname === "/api/seller/qris") {
        const seller = authenticate(request, "seller");
        const body = await readJson(request, 6 * 1024 * 1024);
        const qrisImage = await saveImageDataUrl(body.imageData);
        database.prepare("UPDATE users SET qris_image = ? WHERE id = ?").run(qrisImage, seller.id);
        await removeUploadedImage(seller.qris_image);
        return sendJson(response, 201, { qrisImage });
    }

    if (method === "DELETE" && pathname === "/api/seller/qris") {
        const seller = authenticate(request, "seller");
        database.prepare("UPDATE users SET qris_image = NULL WHERE id = ?").run(seller.id);
        await removeUploadedImage(seller.qris_image);
        return sendJson(response, 200, { qrisImage: null });
    }

    if (method === "GET" && pathname === "/api/seller/menu") {
        const seller = authenticate(request, "seller");
        return sendJson(response, 200, { items: menuSelect("WHERE menu_items.seller_id = ?", [seller.id]) });
    }

    if (method === "GET" && pathname === "/api/seller/balance") {
        const seller = authenticate(request, "seller");
        const balance = database.prepare("SELECT amount FROM balances WHERE user_id = ?").get(seller.id);
        return sendJson(response, 200, { balance: balance?.amount || 0 });
    }

    if (method === "POST" && pathname === "/api/seller/balance/topup") {
        authenticate(request, "seller");
        const body = await readJson(request);
        const identityCode = String(body.identityCode || "").trim();
        const amount = Number(body.amount);
        if (!identityCode) throw new HttpError(400, "Nomor telepon pembeli wajib diisi.");
        if (!Number.isSafeInteger(amount) || amount < 1000 || amount > 10000000) {
            throw new HttpError(400, "Nominal top up minimal Rp1.000 dan maksimal Rp10.000.000.");
        }

        const buyer = database.prepare("SELECT * FROM users WHERE role = 'buyer' AND lower(identity_code) = lower(?)").get(identityCode);
        if (!buyer) throw new HttpError(404, "Pembeli dengan nomor telepon tersebut tidak ditemukan.");

        database.exec("BEGIN IMMEDIATE");
        try {
            database.prepare("UPDATE balances SET amount = amount + ? WHERE user_id = ?").run(amount, buyer.id);
            database.prepare("INSERT INTO transactions (user_id, amount, title) VALUES (?, ?, ?)")
                .run(buyer.id, amount, "Top Up Saldo oleh Penjual");
            const balance = database.prepare("SELECT amount FROM balances WHERE user_id = ?").get(buyer.id).amount;
            database.exec("COMMIT");
            return sendJson(response, 201, { user: publicUser(buyer), balance });
        } catch (error) {
            database.exec("ROLLBACK");
            throw error;
        }
    }

    if (method === "POST" && pathname === "/api/seller/menu") {
        const seller = authenticate(request, "seller");
        const item = normalizeMenuInput(await readJson(request));
        const result = database.prepare(`
            INSERT INTO menu_items (seller_id, name, description, category, price, image, calories, protein, carbs, fat)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(seller.id, item.name, item.description, item.category, item.price, item.image,
            item.calories, item.protein, item.carbs, item.fat);
        return sendJson(response, 201, { item: menuSelect("WHERE menu_items.id = ?", [Number(result.lastInsertRowid)])[0] });
    }

    const menuItemMatch = pathname.match(/^\/api\/seller\/menu\/(\d+)$/);
    if (menuItemMatch && ["PUT", "PATCH", "DELETE"].includes(method)) {
        const seller = authenticate(request, "seller");
        const id = Number(menuItemMatch[1]);
        const existing = database.prepare("SELECT id FROM menu_items WHERE id = ? AND seller_id = ?").get(id, seller.id);
        if (!existing) throw new HttpError(404, "Menu tidak ditemukan.");

        if (method === "PATCH") {
            const body = await readJson(request);
            if (typeof body.available !== "boolean") throw new HttpError(400, "Pilih status Ready atau Sold out.");
            database.prepare("UPDATE menu_items SET available = ? WHERE id = ? AND seller_id = ?")
                .run(Number(body.available), id, seller.id);
            return sendJson(response, 200, { item: menuSelect("WHERE menu_items.id = ?", [id])[0] });
        }

        if (method === "DELETE") {
            database.prepare("DELETE FROM menu_items WHERE id = ? AND seller_id = ?").run(id, seller.id);
            return sendJson(response, 200, { message: "Menu berhasil dihapus." });
        }

        const item = normalizeMenuInput(await readJson(request));
        database.prepare(`
            UPDATE menu_items SET name = ?, description = ?, category = ?, price = ?, image = ?,
                calories = ?, protein = ?, carbs = ?, fat = ?
            WHERE id = ? AND seller_id = ?
        `).run(item.name, item.description, item.category, item.price, item.image,
            item.calories, item.protein, item.carbs, item.fat, id, seller.id);
        return sendJson(response, 200, { item: menuSelect("WHERE menu_items.id = ?", [id])[0] });
    }

    if (method === "GET" && pathname === "/api/balance") {
        const user = authenticate(request, "buyer");
        const balance = database.prepare("SELECT amount FROM balances WHERE user_id = ?").get(user.id).amount;
        return sendJson(response, 200, { balance });
    }

    if (method === "POST" && pathname === "/api/topup/request") {
        const buyer = authenticate(request, "buyer");
        const body = await readJson(request);
        const sellerId = Number(body.sellerId);
        const amount = Number(body.amount);
        const paymentMethod = String(body.paymentMethod || "").trim();
        const proofText = String(body.proofText || "").trim();
        const proofImage = String(body.proofImage || "").trim();

        if (!Number.isSafeInteger(sellerId) || sellerId <= 0) {
            throw new HttpError(400, "ID penjual tidak valid.");
        }
        if (!Number.isSafeInteger(amount) || amount < 1000 || amount > 10000000) {
            throw new HttpError(400, "Nominal top up minimal Rp1.000 dan maksimal Rp10.000.000.");
        }
        if (!paymentMethod) {
            throw new HttpError(400, "Pilih metode pembayaran.");
        }
        if (!proofText && !proofImage) {
            throw new HttpError(400, "Isi catatan transfer atau upload bukti transfer.");
        }

        const seller = database.prepare("SELECT id, name, role FROM users WHERE id = ? AND role = 'seller'").get(sellerId);
        if (!seller) throw new HttpError(404, "Penjual tidak ditemukan.");

        const result = database.prepare(`
            INSERT INTO topup_requests (buyer_id, seller_id, amount, payment_method, status, proof_text, proof_image)
            VALUES (?, ?, ?, ?, 'pending', ?, ?)
        `).run(buyer.id, sellerId, amount, paymentMethod, proofText, proofImage);

        const requestRow = database.prepare("SELECT * FROM topup_requests WHERE id = ?").get(Number(result.lastInsertRowid));
        return sendJson(response, 201, { request: {
            id: requestRow.id,
            buyerId: requestRow.buyer_id,
            sellerId: requestRow.seller_id,
            amount: requestRow.amount,
            paymentMethod: requestRow.payment_method,
            status: requestRow.status,
            proofText: requestRow.proof_text,
            proofImage: requestRow.proof_image,
            createdAt: requestRow.created_at
        }, message: "Permintaan top up berhasil dikirim dan menunggu persetujuan penjual." });
    }

    if (method === "GET" && pathname === "/api/seller/topup-requests") {
        const seller = authenticate(request, "seller");
        const rows = database.prepare(`
            SELECT tr.id, tr.amount, tr.payment_method AS paymentMethod, tr.status, tr.created_at AS createdAt,
                   tr.proof_text AS proofText, tr.proof_image AS proofImage,
                   u.id AS buyerId, u.name AS buyerName, u.identity_code AS buyerIdentityCode
            FROM topup_requests tr
            JOIN users u ON u.id = tr.buyer_id
            WHERE tr.seller_id = ?
            ORDER BY tr.id DESC
        `).all(seller.id);
        return sendJson(response, 200, { requests: rows.map(row => ({
            id: row.id,
            buyerId: row.buyerId,
            buyerName: row.buyerName,
            buyerIdentityCode: row.buyerIdentityCode,
            amount: row.amount,
            paymentMethod: row.paymentMethod,
            proofText: row.proofText,
            proofImage: row.proofImage,
            status: row.status,
            createdAt: row.createdAt
        })) });
    }

    if (method === "POST" && pathname.match(/^\/api\/seller\/topup-requests\/(\d+)\/approve$/)) {
        const seller = authenticate(request, "seller");
        const requestId = Number(pathname.match(/^\/api\/seller\/topup-requests\/(\d+)\/approve$/)[1]);
        const requestRow = database.prepare("SELECT * FROM topup_requests WHERE id = ? AND seller_id = ?").get(requestId, seller.id);
        if (!requestRow) throw new HttpError(404, "Request top up tidak ditemukan.");
        if (requestRow.status !== "pending") throw new HttpError(400, "Request top up sudah diproses.");

        database.exec("BEGIN IMMEDIATE");
        try {
            database.prepare("UPDATE balances SET amount = amount + ? WHERE user_id = ?").run(requestRow.amount, requestRow.buyer_id);
            database.prepare("INSERT INTO transactions (user_id, amount, title) VALUES (?, ?, ?)")
                .run(requestRow.buyer_id, requestRow.amount, "Top Up Saldo disetujui penjual");
            database.prepare("UPDATE topup_requests SET status = 'approved', approved_at = CURRENT_TIMESTAMP WHERE id = ?").run(requestId);
            const balance = database.prepare("SELECT amount FROM balances WHERE user_id = ?").get(requestRow.buyer_id).amount;
            database.exec("COMMIT");
            return sendJson(response, 200, { balance, message: "Top up berhasil disetujui." });
        } catch (error) {
            database.exec("ROLLBACK");
            throw error;
        }
    }

    if (method === "POST" && pathname.match(/^\/api\/seller\/topup-requests\/(\d+)\/reject$/)) {
        const seller = authenticate(request, "seller");
        const requestId = Number(pathname.match(/^\/api\/seller\/topup-requests\/(\d+)\/reject$/)[1]);
        const requestRow = database.prepare("SELECT * FROM topup_requests WHERE id = ? AND seller_id = ?").get(requestId, seller.id);
        if (!requestRow) throw new HttpError(404, "Request top up tidak ditemukan.");
        if (requestRow.status !== "pending") throw new HttpError(400, "Request top up sudah diproses.");
        database.prepare("UPDATE topup_requests SET status = 'rejected', approved_at = CURRENT_TIMESTAMP WHERE id = ?").run(requestId);
        return sendJson(response, 200, { message: "Top up ditolak." });
    }

    if (method === "POST" && pathname === "/api/balance/topup") {
        const user = authenticate(request, "buyer");
        const body = await readJson(request);
        const amount = Number(body.amount);
        if (!Number.isSafeInteger(amount) || amount < 1000 || amount > 10000000) {
            throw new HttpError(400, "Nominal top up minimal Rp1.000 dan maksimal Rp10.000.000.");
        }

        database.exec("BEGIN IMMEDIATE");
        try {
            database.prepare("UPDATE balances SET amount = amount + ? WHERE user_id = ?").run(amount, user.id);
            database.prepare("INSERT INTO transactions (user_id, amount, title) VALUES (?, ?, ?)")
                .run(user.id, amount, "Top Up Saldo");
            const balance = database.prepare("SELECT amount FROM balances WHERE user_id = ?").get(user.id).amount;
            database.exec("COMMIT");
            return sendJson(response, 201, { balance });
        } catch (error) {
            database.exec("ROLLBACK");
            throw error;
        }
    }

    if (method === "GET" && pathname === "/api/topup/requests") {
        const buyer = authenticate(request, "buyer");
        const rows = database.prepare(`
            SELECT tr.id, tr.amount, tr.payment_method AS paymentMethod, tr.status, tr.created_at AS createdAt,
                   tr.proof_text AS proofText, tr.proof_image AS proofImage,
                   u.name AS sellerName
            FROM topup_requests tr
            JOIN users u ON u.id = tr.seller_id
            WHERE tr.buyer_id = ?
            ORDER BY tr.id DESC
        `).all(buyer.id);
        return sendJson(response, 200, { requests: rows.map(row => ({
            id: row.id,
            amount: row.amount,
            paymentMethod: row.paymentMethod,
            status: row.status,
            proofText: row.proofText,
            proofImage: row.proofImage,
            sellerName: row.sellerName,
            createdAt: row.createdAt
        })) });
    }

    if (method === "GET" && pathname === "/api/transactions/topups") {
        const user = authenticate(request, "buyer");
        const transactions = database.prepare(`
            SELECT id, amount, created_at AS date
            FROM transactions
            WHERE user_id = ? AND title LIKE 'Top Up Saldo%'
            ORDER BY id DESC
        `).all(user.id);
        return sendJson(response, 200, { transactions });
    }

    if (method === "POST" && pathname === "/api/orders") {
        const user = authenticate(request, "buyer");
        const body = await readJson(request);
        const deliveryMethod = body.deliveryMethod === undefined ? "pickup" : String(body.deliveryMethod);
        if (!["delivery", "pickup"].includes(deliveryMethod)) {
            throw new HttpError(400, "Pilih metode diantarkan atau ambil di kantin.");
        }
        const paymentMethod = body.paymentMethod === undefined ? "saldo" : String(body.paymentMethod).trim().toLowerCase();
        if (!["saldo", "qris"].includes(paymentMethod)) {
            throw new HttpError(400, "Pilih metode pembayaran saldo atau QRIS.");
        }
        const deliveryFee = deliveryMethod === "delivery" ? 2000 : 0;
        const submittedDeliveryLocation = String(body.deliveryLocation || "").trim();
        const deliveryLocation = deliveryMethod === "delivery"
            ? submittedDeliveryLocation || String(user.delivery_location || "").trim()
            : null;
        if (deliveryLocation && deliveryLocation.length > 100) {
            throw new HttpError(400, "Lokasi antar maksimal 100 karakter.");
        }
        if (deliveryMethod === "delivery" && !deliveryLocation) {
            throw new HttpError(400, "Isi lokasi antar di checkout atau profil sebelum memilih pengantaran.");
        }
        if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 50) {
            throw new HttpError(400, "Keranjang kosong atau jumlah jenis menu tidak valid.");
        }

        const quantities = new Map();
        for (const item of body.items) {
            const id = Number(item.menuId);
            const quantity = Number(item.quantity);
            if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 50) {
                throw new HttpError(400, "Isi keranjang tidak valid.");
            }
            quantities.set(id, (quantities.get(id) || 0) + quantity);
        }

        const orderItems = [];
        let subtotal = 0;
        for (const [menuId, quantity] of quantities) {
            const item = menuSelect("WHERE menu_items.id = ? AND menu_items.available = 1", [menuId])[0];
            if (!item || item.sellerId === null) throw new HttpError(400, "Salah satu menu sudah tidak tersedia.");
            subtotal += item.price * quantity;
            orderItems.push({ ...item, quantity });
        }
        const total = subtotal + deliveryFee;
        if (!Number.isSafeInteger(total) || total < 1) throw new HttpError(400, "Total pesanan tidak valid.");

        database.exec("BEGIN IMMEDIATE");
        try {
            const currentBalance = database.prepare("SELECT amount FROM balances WHERE user_id = ?").get(user.id).amount;
            if (paymentMethod === "saldo" && currentBalance < total) {
                throw new HttpError(400, "Saldo tidak mencukupi.");
            }
            if (deliveryMethod === "delivery" && deliveryLocation !== user.delivery_location) {
                database.prepare("UPDATE users SET delivery_location = ? WHERE id = ?").run(deliveryLocation, user.id);
            }
            const result = database.prepare(`
                INSERT INTO orders (user_id, total, delivery_method, delivery_fee, delivery_location, payment_method)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(user.id, total, deliveryMethod, deliveryFee, deliveryLocation, paymentMethod);
            const orderId = Number(result.lastInsertRowid);
            if (paymentMethod === "saldo") {
                database.prepare("UPDATE balances SET amount = amount - ? WHERE user_id = ?").run(total, user.id);
            }
            const addItem = database.prepare(`
                INSERT INTO order_items (order_id, menu_item_id, seller_id, name, canteen_name, price, quantity)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            for (const item of orderItems) {
                addItem.run(orderId, item.id, item.sellerId, item.name, item.canteenName, item.price, item.quantity);
            }
            const addSellerProgress = database.prepare(`
                INSERT INTO seller_order_progress (order_id, seller_id)
                VALUES (?, ?)
            `);
            for (const sellerId of new Set(orderItems.map(item => item.sellerId))) {
                addSellerProgress.run(orderId, sellerId);
            }
            if (paymentMethod === "saldo") {
                database.prepare("INSERT INTO transactions (user_id, order_id, amount, title) VALUES (?, ?, ?, ?)")
                    .run(user.id, orderId, -total, "Pembayaran Pesanan");
            }
            const newBalance = database.prepare("SELECT amount FROM balances WHERE user_id = ?").get(user.id).amount;
            database.exec("COMMIT");
            return sendJson(response, 201, {
                order: formatOrder({
                    id: orderId,
                    total,
                    delivery_method: deliveryMethod,
                    delivery_fee: deliveryFee,
                    delivery_location: deliveryLocation,
                    payment_method: paymentMethod,
                    status: "Berhasil",
                    created_at: new Date().toISOString()
                }, orderItems),
                balance: newBalance
            });
        } catch (error) {
            database.exec("ROLLBACK");
            throw error;
        }
    }

    if (method === "GET" && pathname === "/api/orders/mine") {
        const user = authenticate(request, "buyer");
        const orders = database.prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC").all(user.id);
        const getItems = database.prepare("SELECT name, canteen_name, price, quantity FROM order_items WHERE order_id = ? ORDER BY id");
        const getSellerProgress = database.prepare(`
            SELECT COALESCE(users.canteen_name, 'eKantin') AS canteenName,
                   seller_order_progress.status
            FROM seller_order_progress
            JOIN users ON users.id = seller_order_progress.seller_id
            WHERE seller_order_progress.order_id = ?
            ORDER BY users.canteen_name
        `);
        return sendJson(response, 200, {
            orders: orders.map(order => formatOrder(
                order,
                getItems.all(order.id),
                getSellerProgress.all(order.id)
            ))
        });
    }

    if (method === "GET" && pathname === "/api/seller/orders") {
        const seller = authenticate(request, "seller");
        return sendJson(response, 200, { items: selectSellerOrderItems(seller.id, false) });
    }

    if (method === "GET" && pathname === "/api/seller/orders/completed") {
        const seller = authenticate(request, "seller");
        return sendJson(response, 200, { items: selectSellerOrderItems(seller.id, true) });
    }

    const sellerOrderProgressMatch = pathname.match(/^\/api\/seller\/orders\/(\d+)\/status$/);
    if (method === "PATCH" && sellerOrderProgressMatch) {
        const seller = authenticate(request, "seller");
        const orderId = Number(sellerOrderProgressMatch[1]);
        const body = await readJson(request);
        if (!["ready", "complete"].includes(body.action)) {
            throw new HttpError(400, "Aksi penyelesaian pesanan tidak valid.");
        }

        database.exec("BEGIN IMMEDIATE");
        try {
            const progress = database.prepare(`
                SELECT status FROM seller_order_progress WHERE order_id = ? AND seller_id = ?
            `).get(orderId, seller.id);
            if (!progress) throw new HttpError(404, "Pesanan tidak ditemukan untuk kantin ini.");

            const order = database.prepare(`
                SELECT delivery_method AS deliveryMethod, delivery_fee AS deliveryFee
                FROM orders WHERE id = ?
            `).get(orderId);

            if (body.action === "ready") {
                if (progress.status !== "Sedang dibuat") {
                    throw new HttpError(409, "Status pesanan sudah berubah.");
                }
                const nextStatus = order.deliveryMethod === "delivery" ? "Siap diantar" : "Siap diambil";
                database.prepare(`
                    UPDATE seller_order_progress SET status = ? WHERE order_id = ? AND seller_id = ?
                `).run(nextStatus, orderId, seller.id);
                database.exec("COMMIT");
                return sendJson(response, 200, { status: nextStatus });
            }

            const requiredReadyStatus = order.deliveryMethod === "delivery" ? "Siap diantar" : "Siap diambil";
            if (progress.status !== requiredReadyStatus) {
                throw new HttpError(409, "Tandai pesanan siap sebelum menyelesaikannya.");
            }

            const sellerSubtotals = database.prepare(`
                SELECT seller_id AS sellerId, SUM(price * quantity) AS subtotal
                FROM order_items WHERE order_id = ? AND seller_id IS NOT NULL
                GROUP BY seller_id ORDER BY seller_id
            `).all(orderId);
            const fullSubtotal = sellerSubtotals.reduce((sum, entry) => sum + entry.subtotal, 0);
            let allocatedDeliveryFee = 0;
            let creditedAmount = 0;
            for (let index = 0; index < sellerSubtotals.length; index++) {
                const entry = sellerSubtotals[index];
                const deliveryShare = order.deliveryMethod !== "delivery" || fullSubtotal === 0
                    ? 0
                    : index === sellerSubtotals.length - 1
                        ? order.deliveryFee - allocatedDeliveryFee
                        : Math.floor(order.deliveryFee * entry.subtotal / fullSubtotal);
                allocatedDeliveryFee += deliveryShare;
                if (entry.sellerId === seller.id) creditedAmount = entry.subtotal + deliveryShare;
            }

            database.prepare("UPDATE balances SET amount = amount + ? WHERE user_id = ?")
                .run(creditedAmount, seller.id);
            database.prepare("INSERT INTO transactions (user_id, order_id, amount, title) VALUES (?, ?, ?, ?)")
                .run(seller.id, orderId, creditedAmount, `Pendapatan Pesanan #${orderId}`);
            database.prepare(`
                UPDATE seller_order_progress
                SET status = 'Selesai', credited_amount = ?, completed_at = CURRENT_TIMESTAMP
                WHERE order_id = ? AND seller_id = ?
            `).run(creditedAmount, orderId, seller.id);
            const balance = database.prepare("SELECT amount FROM balances WHERE user_id = ?").get(seller.id).amount;
            database.exec("COMMIT");
            return sendJson(response, 200, { status: "Selesai", creditedAmount, balance });
        } catch (error) {
            database.exec("ROLLBACK");
            throw error;
        }
    }

    throw new HttpError(404, "Endpoint tidak ditemukan.");
}

function injectApiConfigScript(html) {
    const script = `
    <script>
        (function () {
            try {
                const storageKey = "ekantinApiBaseUrl";
                const params = new URLSearchParams(window.location.search || "");
                const storedBase = localStorage.getItem(storageKey) || "";
                const configuredBase = (params.get("apiBase") || (storedBase && storedBase !== "https://ekantin-backend.onrender.com" ? storedBase : "")).trim();
                const fallbackBase = window.location.origin && window.location.origin !== "null" ? window.location.origin : "";
                const base = (configuredBase || fallbackBase).replace(/\/+$/, "");

                if (base) {
                    window.EKANTIN_API_BASE = base;
                    const originalFetch = window.fetch ? window.fetch.bind(window) : null;
                    if (originalFetch) {
                        window.fetch = function (input, init) {
                            let nextInput = input;
                            if (typeof nextInput === "string" && nextInput.startsWith("/")) {
                                nextInput = base + nextInput;
                            } else if (nextInput && typeof nextInput === "object" && typeof nextInput.href === "string") {
                                const rawUrl = nextInput.href;
                                if (rawUrl.startsWith("/") || rawUrl.startsWith("./") || rawUrl.startsWith("../")) {
                                    nextInput = new URL(rawUrl, base).toString();
                                }
                            }
                            return originalFetch(nextInput, init);
                        };
                    }
                }
            } catch (error) {
                console.warn("eKantin API config error:", error);
            }
        })();
    </script>`;

    if (html.includes("</body>")) return html.replace("</body>", `${script}\n</body>`);
    if (html.includes("</head>")) return html.replace("</head>", `${script}\n</head>`);
    return `${html}\n${script}`;
}

function serveStatic(request, response, url) {
    let pathname;
    try {
        pathname = decodeURIComponent(url.pathname);
    } catch {
        return sendJson(response, 400, { error: "Alamat halaman tidak valid." });
    }
    if (pathname === "/") pathname = "/index.html";

    const isUpload = pathname.startsWith("/uploads/");
    const staticRoot = isUpload ? uploadDirectory : publicRoot;
    const relativePath = isUpload ? pathname.slice("/uploads".length) : pathname;
    const filePath = path.resolve(staticRoot, `.${relativePath}`);
    if (!filePath.startsWith(`${staticRoot}${path.sep}`) || filePath === dataDirectory || filePath.startsWith(`${dataDirectory}${path.sep}`)) {
        return sendJson(response, 403, { error: "Akses ditolak." });
    }

    fs.stat(filePath, (error, stats) => {
        if (error || !stats.isFile()) return sendJson(response, 404, { error: "Halaman tidak ditemukan." });

        const ext = path.extname(filePath).toLowerCase();
        if (ext === ".html") {
            fs.readFile(filePath, "utf8", (readError, content) => {
                if (readError) return sendJson(response, 500, { error: "Gagal membaca halaman." });
                response.writeHead(200, {
                    "Content-Type": mimeTypes[ext] || "text/html; charset=utf-8",
                    "Cache-Control": "no-store",
                    "X-Content-Type-Options": "nosniff"
                });
                response.end(injectApiConfigScript(content));
            });
            return;
        }

        response.writeHead(200, {
            "Content-Type": mimeTypes[ext] || "application/octet-stream",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff"
        });
        fs.createReadStream(filePath).pipe(response);
    });
}

const server = http.createServer(async (request, response) => {
    const origin = request.headers.origin || "";
    const allowOrigin = allowedOrigins.includes("*") || allowedOrigins.includes(origin)
        ? (origin || "*")
        : "*";

    response.setHeader("Access-Control-Allow-Origin", allowOrigin);
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.setHeader("Access-Control-Max-Age", "86400");

    if (request.method === "OPTIONS") {
        response.writeHead(204);
        response.end();
        return;
    }

    const url = new URL(request.url, `http://${request.headers.host || `${host}:${port}`}`);
    try {
        if (url.pathname.startsWith("/api/")) {
            await handleApi(request, response, url);
        } else if (request.method === "GET" || request.method === "HEAD") {
            serveStatic(request, response, url);
        } else {
            sendJson(response, 405, { error: "Metode tidak diizinkan." });
        }
    } catch (error) {
        if (response.headersSent || response.destroyed) return;
        const status = error instanceof HttpError ? error.status : 500;
        if (status === 500) console.error(error);
        sendJson(response, status, { error: status === 500 ? "Terjadi kesalahan pada server." : error.message });
    }
});

server.listen(port, host, () => {
    console.log(`eKantin berjalan di http://${host}:${port}`);
    console.log(`Database SQLite: ${databasePath}`);
});

function shutdown() {
    server.close(() => {
        database.close();
        process.exit(0);
    });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

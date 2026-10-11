const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

let baseUrl;
let serverProcess;
let testDirectory;

before(async () => {
    testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "ekantin-api-test-"));
    const portProbe = net.createServer();
    await new Promise((resolve, reject) => {
        portProbe.once("error", reject);
        portProbe.listen(0, "127.0.0.1", resolve);
    });
    const port = portProbe.address().port;
    await new Promise((resolve, reject) => portProbe.close(error => error ? reject(error) : resolve()));
    baseUrl = `http://127.0.0.1:${port}`;

    serverProcess = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
        cwd: path.resolve(__dirname, ".."),
        env: {
            ...process.env,
            HOST: "127.0.0.1",
            PORT: String(port),
            EKANTIN_DB_PATH: path.join(testDirectory, "ekantin.sqlite"),
            EKANTIN_UPLOAD_PATH: path.join(testDirectory, "uploads")
        },
        stdio: ["ignore", "pipe", "pipe"]
    });

    let output = "";
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`Server tes tidak siap: ${output}`)), 10000);
        serverProcess.stdout.on("data", chunk => {
            output += chunk.toString();
            if (output.includes(`http://127.0.0.1:${port}`)) {
                clearTimeout(timeout);
                resolve();
            }
        });
        serverProcess.stderr.on("data", chunk => { output += chunk.toString(); });
        serverProcess.once("error", error => {
            clearTimeout(timeout);
            reject(error);
        });
        serverProcess.once("exit", code => {
            clearTimeout(timeout);
            reject(new Error(`Server tes keluar (${code}): ${output}`));
        });
    });
}, { timeout: 15000 });

after(async () => {
    if (serverProcess && serverProcess.exitCode === null) {
        await new Promise(resolve => {
            serverProcess.once("exit", resolve);
            serverProcess.kill();
        });
    }
    if (testDirectory) fs.rmSync(testDirectory, { recursive: true, force: true });
}, { timeout: 10000 });

async function request(path, { method = "GET", token, body } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const contentType = response.headers.get("content-type") || "";
    const result = contentType.includes("application/json")
        ? await response.json()
        : await response.text();
    return { status: response.status, body: result };
}

test("top up pending harus disetujui penjual sebelum saldo bertambah", async () => {
    const tag = randomUUID();
    const password = "Kantin123";
    const sellerEmail = `seller-review-${tag}@example.test`;
    const buyerEmail = `buyer-review-${tag}@example.test`;
    const identityCode = `B-${tag}`;

    assert.equal((await request("/api/auth/register", {
        method: "POST",
        body: { name: "Penjual Review", email: sellerEmail, password, role: "seller", canteenName: "Kantin Review" }
    })).status, 201);
    assert.equal((await request("/api/auth/register", {
        method: "POST",
        body: { name: "Pembeli Review", email: buyerEmail, password, role: "buyer", buyerType: "student", identityCode }
    })).status, 201);

    const sellerLogin = await request("/api/auth/login", {
        method: "POST",
        body: { username: sellerEmail, password }
    });
    const buyerLogin = await request("/api/auth/login", {
        method: "POST",
        body: { username: identityCode, password }
    });

    const requestTopup = await request("/api/topup/request", {
        method: "POST",
        token: buyerLogin.body.token,
        body: { sellerId: sellerLogin.body.user.id, amount: 15000, paymentMethod: "QRIS", proofText: "Transfer QRIS 15000 - no ref 12345" }
    });
    assert.equal(requestTopup.status, 201);
    assert.equal(requestTopup.body.request.amount, 15000);
    assert.equal(requestTopup.body.request.status, "pending");

    const pendingList = await request("/api/seller/topup-requests", { token: sellerLogin.body.token });
    assert.equal(pendingList.status, 200);
    assert.equal(pendingList.body.requests.length, 1);
    assert.equal(pendingList.body.requests[0].status, "pending");
    assert.equal(pendingList.body.requests[0].amount, 15000);
    assert.equal(pendingList.body.requests[0].proofText, "Transfer QRIS 15000 - no ref 12345");

    const beforeBalance = (await request("/api/balance", { token: buyerLogin.body.token })).body.balance;
    assert.equal(beforeBalance, 50000);

    const approve = await request(`/api/seller/topup-requests/${pendingList.body.requests[0].id}/approve`, {
        method: "POST",
        token: sellerLogin.body.token
    });
    assert.equal(approve.status, 200);
    assert.equal(approve.body.balance, 65000);

    const afterBalance = (await request("/api/balance", { token: buyerLogin.body.token })).body.balance;
    assert.equal(afterBalance, 65000);
    assert.equal((await request("/api/transactions/topups", { token: buyerLogin.body.token })).body.transactions[0].amount, 15000);

    const buyerTopupRequests = await request("/api/topup/requests", { token: buyerLogin.body.token });
    assert.equal(buyerTopupRequests.status, 200);
    assert.equal(buyerTopupRequests.body.requests.length, 1);
    assert.equal(buyerTopupRequests.body.requests[0].status, "approved");
    assert.equal(buyerTopupRequests.body.requests[0].amount, 15000);
});

test("pesanan dengan metode QRIS harus diproses tanpa saldo", async () => {
    const tag = randomUUID();
    const password = "Kantin123";
    const buyerEmail = `buyer-qris-${tag}@example.test`;
    const sellerEmail = `seller-qris-${tag}@example.test`;

    assert.equal((await request("/api/auth/register", {
        method: "POST",
        body: { name: "Penjual QRIS", email: sellerEmail, password, role: "seller", canteenName: "Kantin QRIS" }
    })).status, 201);
    assert.equal((await request("/api/auth/register", {
        method: "POST",
        body: { name: "Pembeli QRIS", email: buyerEmail, password, role: "buyer", buyerType: "student", identityCode: `Q-${tag}` }
    })).status, 201);

    const sellerLogin = await request("/api/auth/login", {
        method: "POST",
        body: { username: sellerEmail, password }
    });
    const buyerLogin = await request("/api/auth/login", {
        method: "POST",
        body: { username: `Q-${tag}`, password }
    });

    const menuResponse = await request("/api/seller/menu", {
        method: "POST",
        token: sellerLogin.body.token,
        body: {
            name: "Menu QRIS",
            description: "Menu untuk tes QRIS",
            category: "makanan",
            price: 12500,
            image: "",
            calories: 320,
            protein: 15,
            carbs: 38,
            fat: 9
        }
    });
    assert.equal(menuResponse.status, 201);

    const result = await request("/api/orders", {
        method: "POST",
        token: buyerLogin.body.token,
        body: { items: [{ menuId: menuResponse.body.item.id, quantity: 2 }], deliveryMethod: "pickup", paymentMethod: "qris" }
    });

    assert.equal(result.status, 201);
    assert.equal(result.body.order.paymentMethod, "QRIS");
    assert.equal(result.body.balance, 50000);
    assert.equal((await request("/api/balance", { token: buyerLogin.body.token })).body.balance, 50000);
});

test("akun, menu penjual, checkout, riwayat, dan batas peran", async () => {
    const tag = randomUUID();
    const password = "Kantin123";
    const sellerEmail = `seller-${tag}@example.test`;
    const buyerEmail = `buyer-${tag}@example.test`;
    const identityCode = `S-${tag}`;

    assert.equal((await request("/api/health")).body.status, "ok");
    assert.deepEqual((await request("/api/menu")).body.items, []);

    assert.equal((await request("/api/auth/register", {
        method: "POST",
        body: { name: "Penjual Uji", email: sellerEmail, password, role: "seller", canteenName: "Kantin Uji" }
    })).status, 201);
    assert.equal((await request("/api/auth/register", {
        method: "POST",
        body: { name: "Pembeli Uji", email: buyerEmail, password, role: "buyer", buyerType: "student", identityCode }
    })).status, 201);

    const sellerLogin = await request("/api/auth/login", {
        method: "POST",
        body: { username: sellerEmail, password }
    });
    const buyerLogin = await request("/api/auth/login", {
        method: "POST",
        body: { username: identityCode, password }
    });
    assert.equal(sellerLogin.body.user.role, "seller");
    assert.ok(Number.isSafeInteger(sellerLogin.body.user.id));
    assert.equal(buyerLogin.body.user.role, "buyer");

    const sellerProfileUpdate = await request("/api/account/profile", {
        method: "PUT",
        token: sellerLogin.body.token,
        body: { name: "Penjual Profil Uji", email: sellerEmail, canteenName: "Kantin Uji" }
    });
    assert.equal(sellerProfileUpdate.status, 200);
    assert.equal(sellerProfileUpdate.body.user.name, "Penjual Profil Uji");
    assert.equal(sellerProfileUpdate.body.user.canteenName, "Kantin Uji");

    const sellerQris = await request("/api/seller/qris", {
        method: "POST",
        token: sellerLogin.body.token,
        body: { imageData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lWQAAAAASUVORK5CYII=" }
    });
    assert.equal(sellerQris.status, 201);
    assert.match(sellerQris.body.qrisImage, /^\/uploads\/[a-f0-9-]+\.png$/);
    assert.equal((await request("/api/seller/balance", { token: sellerLogin.body.token })).body.balance, sellerLogin.body.balance);
    assert.equal((await request("/api/seller/balance", { token: buyerLogin.body.token })).status, 403);
    assert.equal((await request("/api/orders", {
        method: "POST",
        token: buyerLogin.body.token,
        body: { items: [{ menuId: 1, quantity: 1 }], deliveryMethod: "delivery" }
    })).status, 400);

    const profile = await request("/api/account/profile", {
        method: "PUT",
        token: buyerLogin.body.token,
        body: {
            name: "Pembeli Profil Uji",
            email: buyerEmail,
            identityCode,
            dateOfBirth: "2008-05-14",
            studentClass: "10A",
            nisn: "0081234567",
            deliveryLocation: ""
        }
    });
    assert.equal(profile.body.user.name, "Pembeli Profil Uji");
    assert.equal(profile.body.user.dateOfBirth, "2008-05-14");
    assert.equal(profile.body.user.studentClass, "10A");
    assert.equal(profile.body.user.nisn, "0081234567");
    assert.equal(profile.body.user.deliveryLocation, null);

    const profilePhoto = await request("/api/account/profile-photo", {
        method: "POST",
        token: buyerLogin.body.token,
        body: { imageData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lWQAAAAASUVORK5CYII=" }
    });
    assert.equal(profilePhoto.status, 201);
    assert.match(profilePhoto.body.user.profilePhoto, /^\/uploads\/[a-f0-9-]+\.png$/);
    assert.equal((await request(profilePhoto.body.user.profilePhoto)).status, 200);

    const removedPhoto = await request("/api/account/profile-photo", {
        method: "DELETE",
        token: buyerLogin.body.token
    });
    assert.equal(removedPhoto.status, 200);
    assert.equal(removedPhoto.body.user.profilePhoto, null);

    const uploadedImage = await request("/api/seller/menu-image", {
        method: "POST",
        token: sellerLogin.body.token,
        body: { imageData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lWQAAAAASUVORK5CYII=" }
    });
    assert.equal(uploadedImage.status, 201);
    assert.match(uploadedImage.body.image, /^\/uploads\/[a-f0-9-]+\.png$/);
    assert.equal((await request(uploadedImage.body.image)).status, 200);
    assert.equal((await request("/api/seller/menu-image", {
        method: "POST",
        token: sellerLogin.body.token,
        body: { imageData: "data:text/plain;base64,SGVsbG8=" }
    })).status, 400);

    const menuResponse = await request("/api/seller/menu", {
        method: "POST",
        token: sellerLogin.body.token,
        body: {
            name: "Menu Integrasi",
            description: "Menu untuk tes API",
            category: "makanan",
            price: 1250,
            image: uploadedImage.body.image,
            calories: 320,
            protein: 15,
            carbs: 38,
            fat: 9
        }
    });
    assert.equal(menuResponse.status, 201);
    assert.equal(menuResponse.body.item.calories, 320);
    assert.equal(menuResponse.body.item.protein, 15);
    const menuId = menuResponse.body.item.id;

    const publicMenu = await request("/api/menu");
    const uploadedMenu = publicMenu.body.items.find(item => item.id === menuId);
    assert.equal(publicMenu.body.items.length, 1);
    assert.ok(publicMenu.body.items.every(item => item.sellerId !== null));
    assert.deepEqual((await request("/api/menu/popular")).body.items, []);
    assert.equal(uploadedMenu.image, uploadedImage.body.image);
    assert.equal(uploadedMenu.carbs, 38);
    assert.equal(uploadedMenu.fat, 9);
    assert.equal(uploadedMenu.qrisImage, sellerQris.body.qrisImage);

    const soldOutMenu = await request(`/api/seller/menu/${menuId}`, {
        method: "PATCH",
        token: sellerLogin.body.token,
        body: { available: false }
    });
    assert.equal(soldOutMenu.body.item.available, 0);
    const buyerSoldOutMenu = (await request("/api/menu")).body.items.find(item => item.id === menuId);
    assert.equal(buyerSoldOutMenu.available, 0);
    assert.equal((await request("/api/orders", {
        method: "POST",
        token: buyerLogin.body.token,
        body: { items: [{ menuId, quantity: 1 }], deliveryMethod: "pickup" }
    })).status, 400);

    const readyMenu = await request(`/api/seller/menu/${menuId}`, {
        method: "PATCH",
        token: sellerLogin.body.token,
        body: { available: true }
    });
    assert.equal(readyMenu.body.item.available, 1);

    const updatedMenu = await request(`/api/seller/menu/${menuId}`, {
        method: "PUT",
        token: sellerLogin.body.token,
        body: {
            name: "Menu Integrasi",
            description: "Menu diperbarui",
            category: "makanan",
            price: 1250,
            image: uploadedImage.body.image,
            calories: 300,
            protein: 14,
            carbs: 40,
            fat: 8
        }
    });
    assert.equal(updatedMenu.body.item.calories, 300);
    assert.equal(updatedMenu.body.item.protein, 14);

    const topup = await request("/api/balance/topup", {
        method: "POST",
        token: buyerLogin.body.token,
        body: { amount: 5000 }
    });
    assert.equal(topup.status, 201);
    assert.equal(topup.body.balance, 55000);

    const orderResponse = await request("/api/orders", {
        method: "POST",
        token: buyerLogin.body.token,
        body: { items: [{ menuId, quantity: 2 }], deliveryMethod: "delivery", deliveryLocation: "Gedung B, kelas 10A" }
    });
    assert.equal(orderResponse.status, 201);
    assert.equal(orderResponse.body.order.total, 4500);
    assert.equal(orderResponse.body.order.deliveryMethod, "delivery");
    assert.equal(orderResponse.body.order.deliveryFee, 2000);
    assert.equal(orderResponse.body.order.deliveryLocation, "Gedung B, kelas 10A");
    assert.equal((await request("/api/auth/me", { token: buyerLogin.body.token })).body.user.deliveryLocation, "Gedung B, kelas 10A");
    assert.equal(orderResponse.body.balance, 50500);
    assert.equal((await request("/api/menu/popular")).body.items[0].orderCount, 2);

    const incomingOrders = await request("/api/seller/orders", { token: sellerLogin.body.token });
    assert.equal(incomingOrders.body.items[0].sellerStatus, "Sedang dibuat");
    assert.equal(incomingOrders.body.items[0].deliveryLocation, "Gedung B, kelas 10A");
    const buyerHistoryWhilePreparing = await request("/api/orders/mine", { token: buyerLogin.body.token });
    assert.equal(buyerHistoryWhilePreparing.body.orders[0].sellerProgress[0].status, "Sedang dibuat");
    assert.equal(buyerHistoryWhilePreparing.body.orders[0].sellerProgress[0].canteenName, "Kantin Uji");
    assert.equal((await request(`/api/seller/orders/${orderResponse.body.order.id}/status`, {
        method: "PATCH",
        token: sellerLogin.body.token,
        body: { action: "complete" }
    })).status, 409);

    const readyOrder = await request(`/api/seller/orders/${orderResponse.body.order.id}/status`, {
        method: "PATCH",
        token: sellerLogin.body.token,
        body: { action: "ready" }
    });
    assert.equal(readyOrder.body.status, "Siap diantar");

    const activeOrders = await request("/api/seller/orders", { token: sellerLogin.body.token });
    assert.equal(activeOrders.body.items[0].sellerStatus, "Siap diantar");
    const buyerHistoryReady = await request("/api/orders/mine", { token: buyerLogin.body.token });
    assert.equal(buyerHistoryReady.body.orders[0].sellerProgress[0].status, "Siap diantar");

    const completedOrder = await request(`/api/seller/orders/${orderResponse.body.order.id}/status`, {
        method: "PATCH",
        token: sellerLogin.body.token,
        body: { action: "complete" }
    });
    assert.equal(completedOrder.body.status, "Selesai");
    assert.equal(completedOrder.body.creditedAmount, 4500);
    assert.equal(completedOrder.body.balance, sellerLogin.body.balance + 4500);
    assert.equal((await request("/api/seller/balance", { token: sellerLogin.body.token })).body.balance, sellerLogin.body.balance + 4500);
    assert.equal((await request("/api/seller/orders", { token: sellerLogin.body.token })).body.items.length, 0);

    const completedOrders = await request("/api/seller/orders/completed", { token: sellerLogin.body.token });
    assert.equal(completedOrders.body.items[0].sellerStatus, "Selesai");
    assert.equal(completedOrders.body.items[0].creditedAmount, 4500);
    assert.equal((await request(`/api/seller/orders/${orderResponse.body.order.id}/status`, {
        method: "PATCH",
        token: sellerLogin.body.token,
        body: { action: "complete" }
    })).status, 409);

    const pickupOrder = await request("/api/orders", {
        method: "POST",
        token: buyerLogin.body.token,
        body: { items: [{ menuId, quantity: 1 }], deliveryMethod: "pickup" }
    });
    assert.equal(pickupOrder.body.order.total, 1250);
    assert.equal(pickupOrder.body.order.deliveryFee, 0);
    assert.equal(pickupOrder.body.order.deliveryLocation, null);
    assert.equal(pickupOrder.body.balance, 49250);
    assert.equal((await request("/api/menu/popular")).body.items[0].orderCount, 3);

    const readyPickup = await request(`/api/seller/orders/${pickupOrder.body.order.id}/status`, {
        method: "PATCH",
        token: sellerLogin.body.token,
        body: { action: "ready" }
    });
    assert.equal(readyPickup.body.status, "Siap diambil");
    const completedPickup = await request(`/api/seller/orders/${pickupOrder.body.order.id}/status`, {
        method: "PATCH",
        token: sellerLogin.body.token,
        body: { action: "complete" }
    });
    assert.equal(completedPickup.body.creditedAmount, 1250);
    assert.equal(completedPickup.body.balance, sellerLogin.body.balance + 5750);
    const buyerHistoryCompleted = await request("/api/orders/mine", { token: buyerLogin.body.token });
    assert.equal(buyerHistoryCompleted.body.orders[0].sellerProgress[0].status, "Selesai");
    assert.equal(buyerHistoryCompleted.body.orders[1].sellerProgress[0].status, "Selesai");

    const popularSoldOutMenu = await request(`/api/seller/menu/${menuId}`, {
        method: "PATCH",
        token: sellerLogin.body.token,
        body: { available: false }
    });
    assert.equal(popularSoldOutMenu.body.item.available, 0);
    const popularWhileSoldOut = (await request("/api/menu/popular")).body.items[0];
    assert.equal(popularWhileSoldOut.id, menuId);
    assert.equal(popularWhileSoldOut.orderCount, 3);
    assert.equal(popularWhileSoldOut.available, 0);

    assert.equal((await request("/api/orders", {
        method: "POST",
        token: buyerLogin.body.token,
        body: { items: [{ menuId, quantity: 1 }], deliveryMethod: "invalid" }
    })).status, 400);

    const history = await request("/api/orders/mine", { token: buyerLogin.body.token });
    assert.equal(history.body.orders[0].items[0].name, "Menu Integrasi");
    assert.equal(history.body.orders.find(order => order.id === orderResponse.body.order.id).deliveryFee, 2000);
    const topupHistory = await request("/api/transactions/topups", { token: buyerLogin.body.token });
    assert.equal(topupHistory.body.transactions[0].amount, 5000);
    const sellerTopup = await request("/api/seller/balance/topup", {
        method: "POST",
        token: sellerLogin.body.token,
        body: { identityCode: identityCode.toLowerCase(), amount: 10000 }
    });
    assert.equal(sellerTopup.status, 201);
    assert.equal(sellerTopup.body.user.identityCode, identityCode);
    assert.equal(sellerTopup.body.balance, 59250);
    assert.equal((await request("/api/transactions/topups", { token: buyerLogin.body.token })).body.transactions[0].amount, 10000);
    assert.equal((await request("/api/seller/balance/topup", {
        method: "POST",
        token: buyerLogin.body.token,
        body: { identityCode, amount: 10000 }
    })).status, 403);
    assert.equal((await request("/api/seller/balance/topup", {
        method: "POST",
        token: sellerLogin.body.token,
        body: { identityCode: "missing-buyer", amount: 10000 }
    })).status, 404);
    assert.equal((await request("/api/seller/balance/topup", {
        method: "POST",
        token: sellerLogin.body.token,
        body: { identityCode, amount: 500 }
    })).status, 400);
    const sellerOrders = await request("/api/seller/orders", { token: sellerLogin.body.token });
    assert.equal(sellerOrders.body.items.length, 0);
    const allCompletedOrders = await request("/api/seller/orders/completed", { token: sellerLogin.body.token });
    assert.ok(allCompletedOrders.body.items.some(item => item.orderId === pickupOrder.body.order.id));

    assert.equal((await request("/api/seller/menu", { token: buyerLogin.body.token })).status, 403);
    assert.equal((await request("/api/orders", { method: "POST", token: sellerLogin.body.token, body: { items: [{ menuId, quantity: 1 }] } })).status, 403);
});

test("default API base mengikuti origin lokal agar browser tidak terlempar ke backend publik", () => {
    const originalWindow = global.window;
    const originalLocalStorage = global.localStorage;
    const originalFetch = global.fetch;
    const calls = [];

    const storage = { values: new Map() };
    global.window = {
        location: { search: "", origin: "http://localhost:3000" },
        fetch: (...args) => {
            calls.push(args);
            return Promise.resolve(new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            }));
        }
    };
    global.localStorage = {
        getItem: key => storage.values.get(key) ?? null,
        setItem: (key, value) => storage.values.set(key, value)
    };
    global.fetch = global.window.fetch;

    delete require.cache[require.resolve("../api-config.js")];
    require("../api-config.js");

    return global.window.fetch("/api/auth/register", { method: "POST" }).then(() => {
        assert.equal(calls[0][0], "http://localhost:3000/api/auth/register");
    }).finally(() => {
        global.window = originalWindow;
        global.localStorage = originalLocalStorage;
        global.fetch = originalFetch;
    });
});
    assert.equal((await request("/data/ekantin.sqlite")).status, 403);
});

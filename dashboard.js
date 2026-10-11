// ==========================================
// AMBIL DATA USER
// ==========================================

const sessionToken = localStorage.getItem("ekantinToken");
const currentUser = JSON.parse(localStorage.getItem("ekantinUser") || "null");
const userName = currentUser?.name || "Pengguna";
const profileAvatarImage = document.getElementById("profileAvatarImage");
const profileAvatarFallback = document.getElementById("profileAvatarFallback");

if (currentUser?.profilePhoto && profileAvatarImage && profileAvatarFallback) {
    profileAvatarImage.src = currentUser.profilePhoto;
    profileAvatarImage.hidden = false;
    profileAvatarFallback.hidden = true;
    profileAvatarImage.addEventListener("error", () => {
        profileAvatarImage.hidden = true;
        profileAvatarFallback.hidden = false;
    }, { once: true });
}

if (!sessionToken || !currentUser) {
    window.location.href = "index.html";
} else if (currentUser.role !== "buyer") {
    window.location.href = "seller.html";
}


// ==========================================
// TAMPILKAN SALDO
// ==========================================

function formatRupiah(number) {

    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0
    }).format(number);

}


async function displayBalance() {
    const balanceElement = document.getElementById("dashboardBalance");
    if (!balanceElement) return;

    try {
        const response = await fetch("/api/balance", {
            headers: { Authorization: `Bearer ${sessionToken}` }
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Saldo gagal dimuat.");
        localStorage.setItem("ekantinSaldo", String(result.balance));
        balanceElement.textContent = formatRupiah(result.balance);
    } catch (error) {
        balanceElement.textContent = "Saldo tidak tersedia";
    }

}


// ==========================================
// TAMPILKAN NAMA USER
// ==========================================

if (userName) {

    document.getElementById("userName").textContent =
        userName;

    document.getElementById("welcomeName").textContent =
        userName;

} else {

    // Jika belum login
    document.getElementById("userName").textContent =
        "Pengguna";

    document.getElementById("welcomeName").textContent =
        "Pengguna";
}


// ==========================================
// NAVIGASI
// ==========================================

function openPage(page) {

    window.location.href = page;

}

async function loadNotifications() {
    const notificationButton = document.getElementById("notificationButton");
    const notificationPanel = document.getElementById("notificationPanel");
    const notificationList = document.getElementById("notificationList");
    const notificationDot = document.getElementById("notificationDot");

    if (!notificationButton || !notificationPanel || !notificationList) return;

    notificationButton.addEventListener("click", () => {
        const isHidden = notificationPanel.hidden;
        notificationPanel.hidden = !isHidden;
        notificationButton.setAttribute("aria-expanded", String(isHidden));
    });

    try {
        const response = await fetch("/api/topup/requests", {
            headers: { Authorization: `Bearer ${sessionToken}` }
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Pemberitahuan gagal dimuat.");

        const requests = result.requests || [];
        const pendingCount = requests.filter(item => item.status === "pending").length;
        const hasNotifications = requests.length > 0;
        notificationDot.hidden = !hasNotifications || pendingCount === 0;

        if (requests.length === 0) {
            notificationList.innerHTML = '<p class="notification-empty">Belum ada pemberitahuan. Semua pemberitahuan akan muncul di sini.</p>';
            return;
        }

        notificationList.innerHTML = requests.slice(0, 5).map(request => {
            const statusClass = request.status === "pending" ? "pending" : request.status === "approved" ? "approved" : "rejected";
            const title = request.status === "pending" ? "Top up menunggu persetujuan" : request.status === "approved" ? "Top up disetujui" : "Top up ditolak";
            const message = `${request.paymentMethod} · ${request.amount ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(request.amount) : ""} · Penjual: ${request.sellerName || "-"}`;
            return `
                <div class="notification-item ${statusClass}">
                    <strong>${title}</strong>
                    <p>${message}</p>
                </div>
            `;
        }).join("");
    } catch (error) {
        notificationList.innerHTML = `<p class="notification-empty">${error.message || "Tidak ada pemberitahuan."}</p>`;
        if (notificationDot) notificationDot.hidden = true;
    }

}


// ==========================================
// TOP UP
// ==========================================

function topUp() {

    window.location.href = "topup.html";

}


// ==========================================
// TAMBAH MAKANAN
// ==========================================

function updateDashboardCartCount() {
    const cart = JSON.parse(localStorage.getItem("ekantinCart") || "[]");
    const totalItems = cart.reduce((total, item) => total + (Number(item.quantity) || 0), 0);
    const badgeText = totalItems > 99 ? "99+" : String(totalItems);
    document.querySelectorAll("#headerCartCount").forEach(badge => {
        badge.textContent = badgeText;
        badge.hidden = totalItems === 0;
    });
    document.querySelectorAll(".header-cart").forEach(link => {
        link.setAttribute("aria-label", totalItems ? `Keranjang, ${totalItems} item` : "Keranjang, kosong");
    });
}

function addFood(item) {
    const cart = JSON.parse(localStorage.getItem("ekantinCart") || "[]");
    const existingItem = cart.find(cartItem => cartItem.menuId === item.id);

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            menuId: item.id,
            name: item.name,
            price: item.price,
            quantity: 1,
            image: item.image || ""
        });
    }

    localStorage.setItem("ekantinCart", JSON.stringify(cart));
    updateDashboardCartCount();
    alert(`${item.name} ditambahkan ke keranjang.`);
}

function getPopularMenuIcon(item) {
    const description = `${item.name} ${item.description}`.toLowerCase();
    if (/susu|milk|yogurt|keju/.test(description)) return "🥛";
    if (/sayur|brokoli|selada|bayam|wortel/.test(description)) return "🥬";
    if (/ayam/.test(description)) return "🍗";
    if (/ikan/.test(description)) return "🐟";
    if (/buah|jus/.test(description)) return "🍓";
    if (item.category.includes("minuman")) return "🥤";
    if (item.category.includes("snack")) return "🥪";
    if (/nasi/.test(description)) return "🍚";
    return "🍽️";
}

function createPopularMenuCard(item) {
    const itemAvailable = item.available !== 0 && item.available !== false;
    const card = document.createElement("article");
    card.className = "food-card";
    card.addEventListener("click", () => {
        window.location.href = `detail-menu.html?name=${encodeURIComponent(item.name)}&price=${item.price}&category=${encodeURIComponent(item.category)}&id=${item.id}`;
    });

    const imageContainer = document.createElement("div");
    imageContainer.className = "food-image";
    if (item.image) {
        const image = document.createElement("img");
        image.src = item.image;
        image.alt = item.name;
        imageContainer.append(image);
    } else {
        imageContainer.textContent = getPopularMenuIcon(item);
    }
    if (!itemAvailable) {
        const status = document.createElement("span");
        status.className = "popular-sold-out";
        status.textContent = "Sold out";
        imageContainer.append(status);
    }

    const content = document.createElement("div");
    content.className = "food-info";
    if (item.category.includes("sehat")) {
        const healthyLabel = document.createElement("span");
        healthyLabel.className = "healthy-label";
        healthyLabel.textContent = "✓ Sehat";
        content.append(healthyLabel);
    }

    const name = document.createElement("h3");
    name.textContent = item.name;
    const description = document.createElement("p");
    description.textContent = item.description || item.category;
    const popularity = document.createElement("p");
    popularity.className = "popular-order-count";
    popularity.textContent = `Dipesan ${item.orderCount} kali`;

    const bottom = document.createElement("div");
    bottom.className = "food-bottom";
    const price = document.createElement("strong");
    price.textContent = formatRupiah(item.price);
    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.textContent = itemAvailable ? "+" : "Habis";
    addButton.disabled = !itemAvailable;
    addButton.setAttribute("aria-label", itemAvailable ? `Tambah ${item.name} ke keranjang` : `${item.name} sold out`);
    addButton.addEventListener("click", event => {
        event.stopPropagation();
        if (itemAvailable) addFood(item);
    });
    bottom.append(price, addButton);
    content.append(name, description, popularity, bottom);
    card.append(imageContainer, content);
    return card;
}

async function loadPopularMenu() {
    const menuList = document.getElementById("popularMenuList");
    const emptyMessage = document.getElementById("popularMenuEmpty");
    if (!menuList || !emptyMessage) return;

    try {
        const response = await fetch("/api/menu/popular");
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Menu populer gagal dimuat.");
        menuList.replaceChildren(...result.items.map(createPopularMenuCard));
        emptyMessage.hidden = result.items.length > 0;
    } catch {
        menuList.replaceChildren();
        emptyMessage.hidden = false;
        emptyMessage.textContent = "Menu populer belum tersedia.";
    }
}

displayBalance();
loadNotifications();
loadPopularMenu();
updateDashboardCartCount();

window.addEventListener("storage", event => {
    if (event.key === "ekantinCart") updateDashboardCartCount();
});
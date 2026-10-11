const user = JSON.parse(localStorage.getItem("ekantinUser") || "null");
const token = localStorage.getItem("ekantinToken");
const userNameElement = document.getElementById("userName");
const profileAvatarImage = document.getElementById("profileAvatarImage");
const profileAvatarFallback = document.getElementById("profileAvatarFallback");
const searchInput = document.getElementById("searchInput");
const menuGrid = document.querySelector(".menu-grid");
const noResult = document.getElementById("noResult");
const menuCount = document.getElementById("menuCount");
const categoryButtons = document.querySelectorAll(".category-button");
let menuItems = [];
let activeCategory = "all";

if (!token || !user) {
    window.location.href = "index.html";
} else if (user.role !== "buyer") {
    window.location.href = "seller.html";
}

if (userNameElement && user) userNameElement.textContent = user.name;
if (user?.profilePhoto && profileAvatarImage && profileAvatarFallback) {
    profileAvatarImage.src = user.profilePhoto;
    profileAvatarImage.hidden = false;
    profileAvatarFallback.hidden = true;
    profileAvatarImage.addEventListener("error", () => {
        profileAvatarImage.hidden = true;
        profileAvatarFallback.hidden = false;
    }, { once: true });
}

function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem("ekantinCart")) || [];
    const totalItems = cart.reduce((total, item) => total + (Number(item.quantity) || 0), 0);
    const cartCount = document.getElementById("cartCount");
    if (cartCount) cartCount.textContent = totalItems;
}

function formatRupiah(amount) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
}

function addToCart(event, item) {
    event.stopPropagation();
    const cart = JSON.parse(localStorage.getItem("ekantinCart")) || [];
    const existingItem = cart.find(cartItem => cartItem.menuId === item.id);

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            menuId: item.id,
            name: item.name,
            price: item.price,
            quantity: 1,
            image: item.image
        });
    }

    localStorage.setItem("ekantinCart", JSON.stringify(cart));
    updateCartCount();
    alert(`${item.name} berhasil ditambahkan ke keranjang.`);
}

function openCart() {
    window.location.href = "cart.html";
}

function goBack() {
    window.location.href = "dashboard.html";
}

function openDetail(foodName, price = 0, category = "", menuId = "") {
    const url = "detail-menu.html" +
        "?name=" + encodeURIComponent(foodName) +
        "&price=" + price +
        "&category=" + encodeURIComponent(category) +
        "&id=" + encodeURIComponent(menuId);
    window.location.href = url;
}

function getMenuIcon(item) {
    const details = `${item.name} ${item.description}`.toLowerCase();
    if (/susu|milk|yogurt|yoghurt|keju/.test(details)) return "🥛";
    if (/sayur|brokoli|selada|bayam|kangkung|wortel|tomat/.test(details)) return "🥬";
    if (/telur/.test(details)) return "🥚";
    if (/ayam/.test(details)) return "🍗";
    if (/ikan/.test(details)) return "🐟";
    if (/buah|jus/.test(details)) return "🍓";
    if (item.category.includes("minuman")) return "🥤";
    if (item.category.includes("snack")) return "🥪";
    if (/nasi/.test(details)) return "🍚";
    return "🍽️";
}

function createMenuCard(item) {
    const itemAvailable = item.available !== 0 && item.available !== false;
    const card = document.createElement("article");
    card.className = "food-card";
    if (!itemAvailable) card.classList.add("sold-out");
    card.dataset.name = item.name.toLowerCase();
    card.dataset.category = item.category.toLowerCase();
    card.addEventListener("click", () => {
        if (itemAvailable) openDetail(item.name, item.price, item.category, item.id);
    });

    const imageContainer = document.createElement("div");
    imageContainer.className = "food-image";
    if (item.image) {
        const image = document.createElement("img");
        image.src = item.image;
        image.alt = item.name;
        imageContainer.append(image);
    } else {
        imageContainer.textContent = getMenuIcon(item);
    }
    if (item.category.includes("sehat")) {
        const badge = document.createElement("span");
        badge.className = "healthy-label";
        badge.textContent = "Sehat";
        imageContainer.append(badge);
    }
    if (!itemAvailable) {
        const soldOutBadge = document.createElement("span");
        soldOutBadge.className = "sold-out-label";
        soldOutBadge.textContent = "Sold out";
        imageContainer.append(soldOutBadge);
    }

    const content = document.createElement("div");
    content.className = "food-content";
    const name = document.createElement("h3");
    name.textContent = item.name;
    const description = document.createElement("p");
    description.className = "description";
    const descriptionIcon = document.createElement("span");
    descriptionIcon.className = "description-icon";
    descriptionIcon.setAttribute("aria-hidden", "true");
    descriptionIcon.textContent = getMenuIcon(item);
    const descriptionText = document.createElement("span");
    descriptionText.textContent = item.description || "Menu tersedia di kantin.";
    description.append(descriptionIcon, descriptionText);
    const canteen = document.createElement("div");
    canteen.className = "canteen-name";
    const canteenName = document.createElement("span");
    canteenName.textContent = item.canteenName;
    canteen.append(canteenName);
    const nutrition = document.createElement("div");
    nutrition.className = "nutrition";
    for (const [value, label, icon] of [
        [item.calories, "kkal", "🔥"],
        [item.protein, "g protein", "💪"],
        [item.carbs, "g karbohidrat", "🍚"],
        [item.fat, "g lemak", "🥑"]
    ]) {
        if (value !== null && value !== undefined) {
            const nutrient = document.createElement("span");
            nutrient.textContent = `${icon} ${value} ${label}`;
            nutrition.append(nutrient);
        }
    }
    const bottom = document.createElement("div");
    bottom.className = "food-bottom";
    const price = document.createElement("strong");
    price.textContent = formatRupiah(item.price);
    const addButton = document.createElement("button");
    addButton.className = "add-button";
    addButton.type = "button";
    addButton.textContent = itemAvailable ? "Tambah" : "Sold out";
    addButton.disabled = !itemAvailable;
    if (itemAvailable) addButton.addEventListener("click", event => addToCart(event, item));
    bottom.append(price, addButton);
    content.append(name, description, canteen, nutrition, bottom);
    card.append(imageContainer, content);
    return card;
}

function renderMenu() {
    const keyword = searchInput.value.toLowerCase().trim();
    const filteredItems = menuItems.filter(item => {
        const matchesName = item.name.toLowerCase().includes(keyword);
        const matchesCategory = activeCategory === "all" ||
            (activeCategory === "sehat" ? item.category.includes("sehat") : item.category.includes(activeCategory));
        return matchesName && matchesCategory;
    });

    menuGrid.replaceChildren(...filteredItems.map(createMenuCard));
    menuCount.textContent = `${filteredItems.length} menu tersedia`;
    noResult.textContent = menuItems.length
        ? "Maaf, menu yang kamu cari tidak ditemukan."
        : "Belum ada menu dari akun penjual kantin.";
    noResult.style.display = filteredItems.length ? "none" : "block";
}

searchInput.addEventListener("input", renderMenu);
categoryButtons.forEach(button => button.addEventListener("click", function () {
    categoryButtons.forEach(item => item.classList.remove("active"));
    this.classList.add("active");
    activeCategory = this.dataset.category;
    renderMenu();
}));

async function loadMenu() {
    try {
        const response = await fetch("/api/menu");
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Menu gagal dimuat.");
        menuItems = result.items;
        renderMenu();
    } catch (error) {
        menuCount.textContent = error.message || "Server tidak terhubung.";
        menuGrid.replaceChildren();
    }
}

updateCartCount();
loadMenu();

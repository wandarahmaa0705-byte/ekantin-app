// =====================================================
// DETAIL MENU eKANTIN
// =====================================================


// =====================================================
// 1. DATA DARI URL
// =====================================================

const params = new URLSearchParams(window.location.search);

let foodName =
    params.get("name") || "Nasi Ayam Sehat";

let foodPrice =
    Number(params.get("price")) || 15000;

let foodCategory =
    params.get("category") || "makanan";

const requestedMenuId = Number(params.get("id")) || null;
let activeMenuId = requestedMenuId;
let selectedMenuAvailable = true;


// =====================================================
// 2. DATA MAKANAN
// =====================================================

const foodData = {

    "Nasi Ayam Sehat": {
        image: "kanmenu1.jpg",
        emoji: "🍛",
        description: "Nasi dengan ayam panggang, sayuran dan telur.",
        calories: "450",
        protein: "25g",
        carbs: "55g",
        fat: "12g"
    },

    "Nasi Ikan": {
        image: "",
        emoji: "🐟",
        description: "Nasi, ikan goreng, sayur dan sambal.",
        calories: "420",
        protein: "22g",
        carbs: "52g",
        fat: "11g"
    },

    "Sandwich Sayur": {
        image: "",
        emoji: "🥪",
        description: "Roti gandum, telur, selada dan tomat.",
        calories: "320",
        protein: "15g",
        carbs: "38g",
        fat: "9g"
    },

    "Susu Segar": {
        image: "",
        emoji: "🥛",
        description: "Susu segar rendah gula untuk kebutuhan harian.",
        calories: "150",
        protein: "8g",
        carbs: "12g",
        fat: "6g"
    },

    "Jus Buah": {
        image: "",
        emoji: "🥤",
        description: "Jus buah segar tanpa tambahan pemanis berlebihan.",
        calories: "120",
        protein: "2g",
        carbs: "25g",
        fat: "1g"
    },

    "Roti Gandum": {
        image: "",
        emoji: "🍞",
        description: "Roti gandum dengan kandungan serat tinggi.",
        calories: "180",
        protein: "7g",
        carbs: "30g",
        fat: "4g"
    }

};


// =====================================================
// 3. DATA MAKANAN YANG DIPILIH
// =====================================================

let selectedFood =
    foodData[foodName] ||
    foodData["Nasi Ayam Sehat"];


// =====================================================
// 4. VARIABEL JUMLAH
// =====================================================

let quantity = 1;


// =====================================================
// 5. FORMAT RUPIAH
// =====================================================

function formatRupiah(number) {

    return "Rp" +
        Number(number).toLocaleString("id-ID");

}


// =====================================================
// 6. UPDATE TAMPILAN JUMLAH DAN TOTAL
// =====================================================

function updateQuantity() {

    const quantityElement =
        document.getElementById("quantity");

    const totalPriceElement =
        document.getElementById("totalPrice");


    if (!quantityElement) {
        console.error("Elemen #quantity tidak ditemukan!");
        return;
    }


    if (!totalPriceElement) {
        console.error("Elemen #totalPrice tidak ditemukan!");
        return;
    }


    quantityElement.innerText = quantity;


    const total =
        foodPrice * quantity;


    totalPriceElement.innerText =
        formatRupiah(total);

}


// =====================================================
// 7. TOMBOL +
// =====================================================

function increaseQuantity() {

    console.log("Tombol PLUS ditekan");

    quantity++;

    updateQuantity();

}


// =====================================================
// 8. TOMBOL -
// =====================================================

function decreaseQuantity() {

    console.log("Tombol MINUS ditekan");

    if (quantity > 1) {

        quantity--;

        updateQuantity();

    }

}


// =====================================================
// 9. TAMPILKAN DATA KE HTML
// =====================================================

function displayFood() {

    const nameElement =
        document.getElementById("foodName");

    const priceElement =
        document.getElementById("foodPrice");

    const descriptionElement =
        document.getElementById("foodDescription");

    const caloriesElement =
        document.getElementById("calories");

    const proteinElement =
        document.getElementById("protein");

    const carbsElement =
        document.getElementById("carbs");

    const fatElement =
        document.getElementById("fat");
    const availabilityStatus = document.getElementById("availabilityStatus");
    const addCartButton = document.querySelector(".add-cart-button");

    if (availabilityStatus) availabilityStatus.hidden = selectedMenuAvailable;
    if (addCartButton) {
        addCartButton.disabled = !selectedMenuAvailable;
        addCartButton.textContent = selectedMenuAvailable ? "🛒 Tambah ke Keranjang" : "Sold out";
    }


    if (nameElement) {
        nameElement.innerText = foodName;
    }


    if (priceElement) {
        priceElement.innerText =
            formatRupiah(foodPrice);
    }


    if (descriptionElement) {
        descriptionElement.innerText =
            selectedFood.description;
    }


    if (caloriesElement) {
        caloriesElement.innerText =
            selectedFood.calories;
    }


    if (proteinElement) {
        proteinElement.innerText =
            selectedFood.protein;
    }


    if (carbsElement) {
        carbsElement.innerText =
            selectedFood.carbs;
    }


    if (fatElement) {
        fatElement.innerText =
            selectedFood.fat;
    }

    const healthyLabel = document.querySelector(".healthy-label");
    if (healthyLabel) {
        healthyLabel.style.display = foodCategory.includes("sehat") ? "inline-flex" : "none";
    }


    // =================================================
    // GAMBAR
    // =================================================

    const foodImage =
        document.getElementById("foodImage");


    if (foodImage) {

        if (selectedFood.image) {
            foodImage.src =
                selectedFood.image;

            foodImage.alt =
                foodName;
            foodImage.style.display = "block";
        } else {
            foodImage.removeAttribute("src");
            foodImage.alt = "";
            foodImage.style.display = "none";
            foodImage.parentElement.textContent = selectedFood.emoji || "🍽️";
        }

    }

}


// =====================================================
// 10. TAMBAH KE KERANJANG
// =====================================================

function addToCart() {

    if (!selectedMenuAvailable) {
        alert("Menu sedang sold out.");
        return;
    }

    if (!activeMenuId) {
        alert("Menu tidak valid. Silakan pilih ulang dari halaman menu.");
        return;
    }

    let cart =
        JSON.parse(
            localStorage.getItem("ekantinCart")
        ) || [];


    const existingItem =
        cart.find(
            item =>
                item.menuId === activeMenuId
        );


    if (existingItem) {

        existingItem.quantity += quantity;

    } else {

        cart.push({

            menuId: activeMenuId,

            name: foodName,

            price: foodPrice,

            quantity: quantity,

            image:
                selectedFood.image || ""

        });

    }


    localStorage.setItem(
        "ekantinCart",
        JSON.stringify(cart)
    );


    updateCartCount();


    alert(
        foodName +
        " berhasil ditambahkan ke keranjang."
    );

}


// =====================================================
// 11. UPDATE JUMLAH IKON KERANJANG
// =====================================================

function updateCartCount() {

    const cart =
        JSON.parse(
            localStorage.getItem("ekantinCart")
        ) || [];


    let totalItems = 0;


    cart.forEach(function(item) {

        totalItems +=
            Number(item.quantity) || 0;

    });


    const cartCount =
        document.getElementById("cartCount");


    if (cartCount) {

        cartCount.innerText =
            totalItems;

    }

}


// =====================================================
// 12. KEMBALI KE MENU
// =====================================================

function goBack() {

    window.location.href =
        "menu.html";

}


// =====================================================
// 13. BUKA KERANJANG
// =====================================================

function openCart() {

    window.location.href =
        "cart.html";

}


// =====================================================
// 14. JALANKAN SAAT HALAMAN SELESAI DIMUAT
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    async function() {
        if (requestedMenuId) {
            try {
                const response = await fetch("/api/menu");
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || "Menu gagal dimuat.");
                const item = result.items.find(entry => entry.id === requestedMenuId);
                if (!item) throw new Error("Menu sudah tidak tersedia.");
                foodName = item.name;
                foodPrice = item.price;
                foodCategory = item.category;
                selectedMenuAvailable = item.available !== 0 && item.available !== false;
                selectedFood = {
                    image: item.image || "",
                    emoji: item.category.includes("minuman") ? "🥤" : "🍽️",
                    description: item.description || "Menu tersedia di kantin.",
                    calories: item.calories == null ? "-" : `${item.calories} kkal`,
                    protein: item.protein == null ? "-" : `${item.protein}g`,
                    carbs: item.carbs == null ? "-" : `${item.carbs}g`,
                    fat: item.fat == null ? "-" : `${item.fat}g`
                };
            } catch (error) {
                alert(error.message);
                window.location.href = "menu.html";
                return;
            }
        }

        displayFood();
        updateQuantity();
        updateCartCount();
    }
);
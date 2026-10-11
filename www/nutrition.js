const nutritionData = [
    {
        name: "Nasi Ayam Sehat",
        category: "makanan",
        emoji: "🍛",
        description: "Nasi dengan ayam panggang, sayuran dan telur.",
        calories: "450",
        protein: "25g",
        carbs: "55g",
        fat: "12g"
    },
    {
        name: "Nasi Ikan",
        category: "makanan",
        emoji: "🐟",
        description: "Nasi, ikan goreng, sayur dan sambal.",
        calories: "420",
        protein: "22g",
        carbs: "52g",
        fat: "11g"
    },
    {
        name: "Sandwich Sayur",
        category: "makanan",
        emoji: "🥪",
        description: "Roti gandum, telur, selada dan tomat.",
        calories: "320",
        protein: "15g",
        carbs: "38g",
        fat: "9g"
    },
    {
        name: "Susu Segar",
        category: "minuman",
        emoji: "🥛",
        description: "Susu segar rendah gula untuk kebutuhan harian.",
        calories: "150",
        protein: "8g",
        carbs: "12g",
        fat: "6g"
    },
    {
        name: "Jus Buah",
        category: "minuman",
        emoji: "🥤",
        description: "Jus buah segar tanpa tambahan pemanis berlebihan.",
        calories: "120",
        protein: "2g",
        carbs: "25g",
        fat: "1g"
    },
    {
        name: "Roti Gandum",
        category: "snack",
        emoji: "🍞",
        description: "Roti gandum dengan kandungan serat tinggi.",
        calories: "180",
        protein: "7g",
        carbs: "30g",
        fat: "4g"
    }
];

let selectedCategory = "all";

function renderNutrition() {
    const searchInput = document.getElementById("nutritionSearch");
    const list = document.getElementById("nutritionList");
    const keyword = searchInput.value.toLowerCase().trim();
    const visibleItems = nutritionData.filter(item => {
        const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
        const matchesSearch = item.name.toLowerCase().includes(keyword) ||
            item.description.toLowerCase().includes(keyword);
        return matchesCategory && matchesSearch;
    });

    if (visibleItems.length === 0) {
        list.innerHTML = `
            <div class="empty-nutrition">
                Tidak ada menu yang sesuai dengan pencarianmu.
            </div>
        `;
        return;
    }

    list.innerHTML = visibleItems.map(item => `
        <article class="nutrition-card">
            <div class="nutrition-card-header">
                <div class="food-icon">${item.emoji}</div>
                <div>
                    <h3>${escapeHTML(item.name)}</h3>
                    <p class="nutrition-card-description">${escapeHTML(item.description)}</p>
                </div>
            </div>
            <div class="nutrition-values">
                <div class="nutrient-value"><strong>${item.calories}</strong><span>Kalori</span></div>
                <div class="nutrient-value"><strong>${item.protein}</strong><span>Protein</span></div>
                <div class="nutrient-value"><strong>${item.carbs}</strong><span>Karbo</span></div>
                <div class="nutrient-value"><strong>${item.fat}</strong><span>Lemak</span></div>
            </div>
            <a class="detail-link" href="detail-menu.html?name=${encodeURIComponent(item.name)}">Lihat detail makanan →</a>
        </article>
    `).join("");
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function goBack() {
    window.history.back();
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("nutritionSearch").addEventListener("input", renderNutrition);

    document.querySelectorAll(".category-button").forEach(button => {
        button.addEventListener("click", () => {
            selectedCategory = button.dataset.category;
            document.querySelectorAll(".category-button").forEach(item => {
                item.classList.toggle("active", item === button);
            });
            renderNutrition();
        });
    });

    renderNutrition();
});

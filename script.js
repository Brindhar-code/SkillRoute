"use strict";

// ==========================================
// SkillRoute — Student Opportunity Explorer
// ==========================================

// 1. DOM ELEMENTS
// ==========================================

const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const sortFilter = document.getElementById("sortFilter");

const opportunitiesGrid = document.getElementById("opportunitiesGrid");
const resultsCount = document.getElementById("resultsCount");

const emptyState = document.getElementById("emptyState");
const resetSearch = document.getElementById("resetSearch");

const errorState = document.getElementById("errorState");
const errorMessage = document.getElementById("errorMessage");
const retryButton = document.getElementById("retryButton");

const clearFilters = document.getElementById("clearFilters");

const paginationWrapper = document.getElementById("paginationWrapper");
const pageInfo = document.getElementById("pageInfo");
const pageNumbers = document.getElementById("pageNumbers");
const prevPage = document.getElementById("prevPage");
const nextPage = document.getElementById("nextPage");

// Opportunity details modal elements
const opportunityModal = document.getElementById("opportunityModal");
const modalClose = document.getElementById("modalClose");
const modalDone = document.getElementById("modalDone");

const modalCategory = document.getElementById("modalCategory");
const modalTitle = document.getElementById("modalTitle");
const modalCompany = document.getElementById("modalCompany");
const modalLocation = document.getElementById("modalLocation");
const modalDuration = document.getElementById("modalDuration");
const modalType = document.getElementById("modalType");
const modalDescription = document.getElementById("modalDescription");
const modalSkills = document.getElementById("modalSkills");

// Application state
let opportunities = [];
let filteredOpportunities = [];
let currentPage = 1;

const ITEMS_PER_PAGE = 6;
const DEBOUNCE_DELAY = 250;

let debounceTimer = null;
let isLoading = false;
let previouslyFocusedElement = null;


// ==========================================
// 2. LOAD OPPORTUNITIES FROM JSON
// ==========================================

async function loadOpportunities() {
    if (isLoading) return;

    isLoading = true;

    hideAllStates();

    opportunitiesGrid.hidden = false;

    opportunitiesGrid.innerHTML = `
        <div class="loading-state">
            <div class="loading-spinner"></div>
            <p>Finding opportunities for you...</p>
        </div>
    `;

    retryButton.disabled = true;

    try {
        const response = await fetch("./opportunities.json", {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(
                `Unable to load opportunities. Server returned ${response.status}.`
            );
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error(
                "The opportunities file must contain a JSON array."
            );
        }

        opportunities = data.filter(isValidOpportunity);

        if (opportunities.length === 0) {
            throw new Error(
                "No valid opportunities were found in the data file."
            );
        }

        currentPage = 1;

        updateDashboardStats();
        applyFilters();

    } catch (error) {
        console.error("SkillRoute loading error:", error);

        opportunitiesGrid.hidden = true;
        emptyState.hidden = true;
        paginationWrapper.hidden = true;

        errorState.hidden = false;

        errorMessage.textContent =
            "We couldn't load the opportunity list. Please check that " +
            "opportunities.json exists and that you're running the website " +
            "using a local server.";

        resultsCount.textContent = "Unable to load opportunities";

    } finally {
        isLoading = false;
        retryButton.disabled = false;
    }
}


// ==========================================
// 3. VALIDATE OPPORTUNITY DATA
// ==========================================

function isValidOpportunity(item) {
    return (
        item !== null &&
        typeof item === "object" &&
        typeof item.title === "string" &&
        typeof item.category === "string" &&
        typeof item.company === "string" &&
        typeof item.description === "string"
    );
}


// ==========================================
// 4. UPDATE DASHBOARD STATISTICS
// ==========================================

function updateDashboardStats() {
    const statElements = document.querySelectorAll("[data-stat]");

    statElements.forEach((element) => {
        const statType = element.dataset.stat;

        if (statType === "total") {
            element.textContent = opportunities.length;
        }

        if (statType === "internships") {
            element.textContent = opportunities.filter(
                (item) => item.category === "Internship"
            ).length;
        }

        if (statType === "hackathons") {
            element.textContent = opportunities.filter(
                (item) => item.category === "Hackathon"
            ).length;
        }

        if (statType === "projects") {
            element.textContent = opportunities.filter(
                (item) => item.category === "Project"
            ).length;
        }
    });
}


// ==========================================
// 5. DEBOUNCED SEARCH
// ==========================================

function handleSearchInput() {
    clearTimeout(debounceTimer);

    debounceTimer = setTimeout(() => {
        currentPage = 1;
        applyFilters();
    }, DEBOUNCE_DELAY);
}


// ==========================================
// 6. SEARCH AND CATEGORY FILTERS
// ==========================================

function applyFilters() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    const selectedCategory = categoryFilter.value;

    filteredOpportunities = opportunities.filter((item) => {
        const searchableText = [
            item.title,
            item.company,
            item.category,
            item.location,
            item.type,
            item.duration,
            item.description,
            ...(Array.isArray(item.skills) ? item.skills : [])
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        const matchesSearch = searchableText.includes(searchTerm);

        const matchesCategory =
            selectedCategory === "all" ||
            item.category.toLowerCase() === selectedCategory.toLowerCase();

        return matchesSearch && matchesCategory;
    });

    sortOpportunities();

    const totalPages = Math.ceil(
        filteredOpportunities.length / ITEMS_PER_PAGE
    );

    currentPage = Math.min(
        currentPage,
        Math.max(1, totalPages)
    );

    renderOpportunities();
    renderPagination();
}


// ==========================================
// 7. SORT OPPORTUNITIES
// ==========================================

function sortOpportunities() {
    const sortValue = sortFilter.value;

    filteredOpportunities.sort((a, b) => {
        switch (sortValue) {
            case "title-asc":
                return a.title.localeCompare(b.title);

            case "title-desc":
                return b.title.localeCompare(a.title);

            case "company-asc":
                return a.company.localeCompare(b.company);

            case "featured":
            default:
                return (
                    Number(Boolean(b.featured)) -
                    Number(Boolean(a.featured))
                );
        }
    });
}


// ==========================================
// 8. CREATE HTML ELEMENTS SAFELY
// ==========================================

function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
        element.className = className;
    }

    if (text !== undefined) {
        element.textContent = text;
    }

    return element;
}


// ==========================================
// 9. CREATE OPPORTUNITY CARD
// ==========================================

function createOpportunityCard(item) {
    const card = createElement("article", "opportunity-card");

    // Category and featured badge
    const cardTop = createElement("div", "card-top");

    const category = createElement(
        "span",
        `category-badge ${getCategoryClass(item.category)}`,
        item.category
    );

    cardTop.appendChild(category);

    if (item.featured) {
        cardTop.appendChild(
            createElement("span", "featured-badge", "✦ Featured")
        );
    }

    card.appendChild(cardTop);

    // Title
    const title = createElement("h3", "card-title", item.title);
    card.appendChild(title);

    // Company
    const company = createElement(
        "p",
        "card-company",
        `↗ ${item.company}`
    );

    card.appendChild(company);

    // Description
    const description = createElement(
        "p",
        "card-description",
        item.description
    );

    card.appendChild(description);

    // Location and duration
    const details = createElement("div", "card-details");

    if (item.location) {
        details.appendChild(
            createElement("span", "detail-item", `⌖ ${item.location}`)
        );
    }

    if (item.duration) {
        details.appendChild(
            createElement("span", "detail-item", `◷ ${item.duration}`)
        );
    }

    card.appendChild(details);

    // Skills
    if (Array.isArray(item.skills) && item.skills.length > 0) {
        const skillsContainer = createElement("div", "card-skills");

        item.skills.forEach((skill) => {
            skillsContainer.appendChild(
                createElement("span", "skill-tag", skill)
            );
        });

        card.appendChild(skillsContainer);
    }

    // Card footer
    const cardFooter = createElement("div", "card-footer");

    const typeLabel = createElement(
        "span",
        "opportunity-type",
        item.type || item.category
    );

    cardFooter.appendChild(typeLabel);

    // View Details button
    const detailsButton = document.createElement("button");

    detailsButton.type = "button";
    detailsButton.className = "card-link";
    detailsButton.textContent = "View Details ↗";

    detailsButton.setAttribute(
        "aria-label",
        `View details for ${item.title}`
    );

    detailsButton.addEventListener("click", () => {
        openOpportunityModal(item);
    });

    cardFooter.appendChild(detailsButton);

    card.appendChild(cardFooter);

    return card;
}


// ==========================================
// 10. CATEGORY STYLING
// ==========================================

function getCategoryClass(category) {
    const normalizedCategory = String(category).toLowerCase();

    const categoryClasses = {
        internship: "category-internship",
        hackathon: "category-hackathon",
        project: "category-project",
        course: "category-course"
    };

    return categoryClasses[normalizedCategory] || "category-default";
}


// ==========================================
// 11. RENDER OPPORTUNITY CARDS
// ==========================================

function renderOpportunities() {
    hideAllStates();

    const totalResults = filteredOpportunities.length;

    resultsCount.textContent =
        totalResults === 1
            ? "1 opportunity found"
            : `${totalResults} opportunities found`;

    if (totalResults === 0) {
        opportunitiesGrid.hidden = true;
        emptyState.hidden = false;
        paginationWrapper.hidden = true;
        return;
    }

    opportunitiesGrid.hidden = false;

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;

    const currentItems = filteredOpportunities.slice(
        startIndex,
        endIndex
    );

    opportunitiesGrid.replaceChildren();

    currentItems.forEach((item) => {
        opportunitiesGrid.appendChild(createOpportunityCard(item));
    });
}


// ==========================================
// 12. PAGINATION
// ==========================================

function renderPagination() {
    const totalPages = Math.ceil(
        filteredOpportunities.length / ITEMS_PER_PAGE
    );

    pageNumbers.replaceChildren();

    if (totalPages <= 1) {
        paginationWrapper.hidden = true;
        return;
    }

    paginationWrapper.hidden = false;

    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

    prevPage.disabled = currentPage === 1;
    nextPage.disabled = currentPage === totalPages;

    for (let page = 1; page <= totalPages; page++) {
        const button = createElement(
            "button",
            "page-number",
            String(page)
        );

        button.type = "button";

        button.setAttribute(
            "aria-label",
            `Go to page ${page}`
        );

        if (page === currentPage) {
            button.classList.add("active");
            button.setAttribute("aria-current", "page");
        }

        button.addEventListener("click", () => {
            currentPage = page;

            renderOpportunities();
            renderPagination();
            scrollToOpportunityList();
        });

        pageNumbers.appendChild(button);
    }
}


// ==========================================
// 13. HIDE EMPTY AND ERROR STATES
// ==========================================

function hideAllStates() {
    emptyState.hidden = true;
    errorState.hidden = true;
}


// ==========================================
// 14. SCROLL TO OPPORTUNITIES
// ==========================================

function scrollToOpportunityList() {
    const section = document.getElementById("opportunities");

    if (section) {
        section.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }
}


// ==========================================
// 15. RESET FILTERS
// ==========================================

function resetAllFilters() {
    clearTimeout(debounceTimer);

    searchInput.value = "";
    categoryFilter.value = "all";
    sortFilter.value = "featured";

    currentPage = 1;

    applyFilters();
}


// ==========================================
// 16. OPPORTUNITY DETAILS MODAL
// ==========================================

function openOpportunityModal(item) {
    if (
        !opportunityModal ||
        !modalCategory ||
        !modalTitle ||
        !modalCompany ||
        !modalLocation ||
        !modalDuration ||
        !modalType ||
        !modalDescription ||
        !modalSkills
    ) {
        console.error(
            "The details modal is missing from index.html. Please check the modal element IDs."
        );

        return;
    }

    previouslyFocusedElement = document.activeElement;

    modalCategory.textContent = item.category;

    modalCategory.className =
        `modal-category ${getCategoryClass(item.category)}`;

    modalTitle.textContent = item.title;
    modalCompany.textContent = `Company: ${item.company}`;
    modalLocation.textContent = item.location || "Not specified";
    modalDuration.textContent = item.duration || "Not specified";
    modalType.textContent = item.type || item.category;
    modalDescription.textContent = item.description;

    // Display skills inside the modal
    modalSkills.replaceChildren();

    if (Array.isArray(item.skills) && item.skills.length > 0) {
        item.skills.forEach((skill) => {
            const tag = createElement(
                "span",
                "modal-skill-tag",
                skill
            );

            modalSkills.appendChild(tag);
        });
    } else {
        modalSkills.appendChild(
            createElement(
                "span",
                "",
                "No specific skills listed."
            )
        );
    }

    opportunityModal.hidden = false;
    opportunityModal.setAttribute("aria-hidden", "false");

    document.body.classList.add("modal-open");

    if (modalClose) {
        modalClose.focus();
    }
}


// Close modal
function closeOpportunityModal() {
    if (!opportunityModal || opportunityModal.hidden) {
        return;
    }

    opportunityModal.hidden = true;
    opportunityModal.setAttribute("aria-hidden", "true");

    document.body.classList.remove("modal-open");

    if (
        previouslyFocusedElement &&
        document.contains(previouslyFocusedElement)
    ) {
        previouslyFocusedElement.focus();
    }
}


// ==========================================
// 17. EVENT LISTENERS
// ==========================================

// Search
searchInput.addEventListener("input", handleSearchInput);

// Category filter
categoryFilter.addEventListener("change", () => {
    currentPage = 1;
    applyFilters();
});

// Sorting
sortFilter.addEventListener("change", () => {
    currentPage = 1;
    applyFilters();
});

// Clear filters
clearFilters.addEventListener("click", resetAllFilters);
resetSearch.addEventListener("click", resetAllFilters);

// Retry loading
retryButton.addEventListener("click", loadOpportunities);

// Previous page
prevPage.addEventListener("click", () => {
    if (currentPage > 1) {
        currentPage--;

        renderOpportunities();
        renderPagination();
        scrollToOpportunityList();
    }
});

// Next page
nextPage.addEventListener("click", () => {
    const totalPages = Math.ceil(
        filteredOpportunities.length / ITEMS_PER_PAGE
    );

    if (currentPage < totalPages) {
        currentPage++;

        renderOpportunities();
        renderPagination();
        scrollToOpportunityList();
    }
});

// Modal close button
if (modalClose) {
    modalClose.addEventListener("click", closeOpportunityModal);
}

// Modal Done button
if (modalDone) {
    modalDone.addEventListener("click", closeOpportunityModal);
}

// Close modal by clicking outside it
if (opportunityModal) {
    opportunityModal.addEventListener("click", (event) => {
        if (event.target === opportunityModal) {
            closeOpportunityModal();
        }
    });
}

// Close modal with Escape
document.addEventListener("keydown", (event) => {
    if (
        event.key === "Escape" &&
        opportunityModal &&
        !opportunityModal.hidden
    ) {
        closeOpportunityModal();
    }
});


// ==========================================
// 18. START SKILLROUTE
// ==========================================

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        loadOpportunities,
        { once: true }
    );
} else {
    loadOpportunities();
}
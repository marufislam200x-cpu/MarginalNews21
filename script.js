
/* =========================================
   MARGINAL NEWS
   Homepage JavaScript
   API: Cloudflare Pages Functions
========================================= */

"use strict";

/* =========================================
   1. CONFIGURATION
========================================= */

const API = {
  stories: "/api/stories",
  subscribe: "/api/subscribe"
};

const CATEGORY_NAMES = {
  bd: "Bangladesh",
  intl: "International",
  geo: "Geopolitics",
  eco: "Economy",
  sci: "Science & Technology",
  env: "Environment",
  edu: "Education",
  fact: "Fact Check",
  read: "Long Read",
  op: "Opinion"
};

let allStories = [];
let currentCategory = "all";
let searchQuery = "";


/* =========================================
   2. DOM HELPERS
========================================= */

const $ = (id) => document.getElementById(id);

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function formatDate(dateValue) {
  if (!dateValue) return "Recently";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function categoryName(code) {
  return CATEGORY_NAMES[code] || "News";
}

function showToast(message) {
  const toast = $("toast");

  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function getStoryImage(story) {
  return story.image || story.imageUrl || "";
}

function getStoryDate(story) {
  return story.publishAt || story.ts || "";
}

function getStoryLink(story) {
  return `#story-${encodeURIComponent(story.id)}`;
}


/* =========================================
   3. IMAGE FALLBACK
========================================= */

function imageHTML(story, className = "") {
  const image = getStoryImage(story);

  if (!image) {
    return `<div class="placeholder ${className}">Marginal News</div>`;
  }

  return `
    <img
      class="${escapeHTML(className)}"
      src="${escapeHTML(image)}"
      alt="${escapeHTML(story.title)}"
      loading="lazy"
      onerror="this.outerHTML='<div class=&quot;placeholder&quot;>Marginal News</div>'"
    >
  `;
}


/* =========================================
   4. STORY API
========================================= */

async function fetchStories() {
  const grid = $("newsGrid");

  try {
    const response = await fetch(API.stories, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error("Unable to load news.");
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("Invalid news data.");
    }

    allStories = data;

    renderHomepage();

  } catch (error) {
    console.error("News API Error:", error);

    if (grid) {
      grid.innerHTML = `
        <div class="empty-state">
          <h3>News is temporarily unavailable</h3>
          <p>Please try again later.</p>
        </div>
      `;
    }
  }
}


/* =========================================
   5. FILTER STORIES
========================================= */

function getFilteredStories() {
  return allStories.filter(story => {

    const categoryMatch =
      currentCategory === "all" ||
      story.sec === currentCategory;

    const query = searchQuery.toLowerCase();

    const searchMatch =
      !query ||
      [
        story.title,
        story.summary,
        story.body,
        story.author,
        categoryName(story.sec)
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);

    return categoryMatch && searchMatch;
  });
}


/* =========================================
   6. HOMEPAGE RENDERER
========================================= */

function renderHomepage() {
  renderHero();
  renderNews();
  renderBreakingNews();
  renderMostRead();
  renderEditorPicks();
  renderOpinions();
}


/* =========================================
   7. FEATURED HERO STORY
========================================= */

function renderHero() {
  const hero = $("heroMain");
  const side = $("heroSide");

  if (!hero) return;

  const featured =
    allStories.find(story => story.featured) ||
    allStories[0];

  if (!featured) {
    return;
  }

  const image = getStoryImage(featured);

  hero.innerHTML = `
    ${image ? `
      <img
        src="${escapeHTML(image)}"
        alt="${escapeHTML(featured.title)}"
      >
    ` : ""}

    <div class="hero-content">

      <span class="category-tag">
        ${escapeHTML(categoryName(featured.sec))}
      </span>

      <h1>${escapeHTML(featured.title)}</h1>

      <p>${escapeHTML(featured.summary)}</p>

      <div class="hero-meta">
        ${escapeHTML(featured.author || "Marginal News Desk")}
        ·
        ${escapeHTML(formatDate(getStoryDate(featured)))}
      </div>

      <a
        href="${getStoryLink(featured)}"
        class="read-more"
        data-read="${escapeHTML(featured.id)}"
      >
        Read Full Story
      </a>

    </div>
  `;

  if (side) {
    const sideStories = allStories
      .filter(story => story.id !== featured.id)
      .slice(0, 3);

    if (sideStories.length) {
      side.innerHTML = sideStories.map(story => `
        <article class="side-story">

          ${imageHTML(story)}

          <div>

            <span class="category-tag">
              ${escapeHTML(categoryName(story.sec))}
            </span>

            <h3>
              <a
                href="${getStoryLink(story)}"
                data-read="${escapeHTML(story.id)}"
              >
                ${escapeHTML(story.title)}
              </a>
            </h3>

            <div class="news-meta">
              ${escapeHTML(formatDate(getStoryDate(story)))}
            </div>

          </div>

        </article>
      `).join("");
    }
  }
}


/* =========================================
   8. NEWS CARDS
========================================= */

function renderNews() {
  const grid = $("newsGrid");

  if (!grid) return;

  const stories = getFilteredStories();

  if (!stories.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <h3>No Stories Found</h3>
        <p>There are no published stories in this category yet.</p>
      </div>
    `;

    return;
  }

  grid.innerHTML = stories.map(story => `
    <article class="news-card">

      <a
        href="${getStoryLink(story)}"
        data-read="${escapeHTML(story.id)}"
      >
        ${imageHTML(story, "thumb")}
      </a>

      <div class="news-card-content">

        <span class="category-tag">
          ${escapeHTML(categoryName(story.sec))}
        </span>

        <h3>
          <a
            href="${getStoryLink(story)}"
            data-read="${escapeHTML(story.id)}"
          >
            ${escapeHTML(story.title)}
          </a>
        </h3>

        <p>
          ${escapeHTML(story.summary)}
        </p>

        <div class="news-meta">
          ${escapeHTML(story.author || "Marginal News Desk")}
          ·
          ${escapeHTML(formatDate(getStoryDate(story)))}
        </div>

      </div>

    </article>
  `).join("");
}


/* =========================================
   9. BREAKING NEWS
========================================= */

function renderBreakingNews() {
  const ticker = $("breakingTrack");

  if (!ticker) return;

  if (!allStories.length) return;

  const headlines = allStories.slice(0, 8);

  const content = headlines.map(story => `
    <a
      href="${getStoryLink(story)}"
      data-read="${escapeHTML(story.id)}"
    >
      ${escapeHTML(story.title)}
    </a>
  `).join("");

  ticker.innerHTML = content + content;
}


/* =========================================
   10. MOST READ
========================================= */

function renderMostRead() {
  const container = $("mostRead");

  if (!container) return;

  const stories = allStories.slice(0, 5);

  if (!stories.length) return;

  container.innerHTML = stories.map(story => `
    <li>
      <div>
        <a
          href="${getStoryLink(story)}"
          data-read="${escapeHTML(story.id)}"
        >
          ${escapeHTML(story.title)}
        </a>

        <small>
          ${escapeHTML(categoryName(story.sec))}
        </small>
      </div>
    </li>
  `).join("");
}


/* =========================================
   11. EDITOR'S PICKS
========================================= */

function renderEditorPicks() {
  const container = $("editorPicks");

  if (!container) return;

  const stories = allStories
    .filter(story => story.editorsPick)
    .slice(0, 4);

  if (!stories.length) {
    container.innerHTML = `
      <p class="text-muted">
        No editor picks published yet.
      </p>
    `;

    return;
  }

  container.innerHTML = stories.map(story => `
    <div style="padding:10px 0;border-bottom:1px solid #eee">

      <span class="category-tag">
        ${escapeHTML(categoryName(story.sec))}
      </span>

      <h4 style="font-family:Georgia,serif;margin-top:5px">

        <a
          href="${getStoryLink(story)}"
          data-read="${escapeHTML(story.id)}"
        >
          ${escapeHTML(story.title)}
        </a>

      </h4>

    </div>
  `).join("");
}


/* =========================================
   12. OPINION STORIES
========================================= */

function renderOpinions() {
  const container = $("opinionGrid");

  if (!container) return;

  const stories = allStories
    .filter(story => story.sec === "op")
    .slice(0, 3);

  if (!stories.length) return;

  container.innerHTML = stories.map(story => `
    <article class="opinion-card">

      <span class="category-tag">
        OPINION
      </span>

      <h3>
        <a
          href="${getStoryLink(story)}"
          data-read="${escapeHTML(story.id)}"
        >
          ${escapeHTML(story.title)}
        </a>
      </h3>

      <p>${escapeHTML(story.summary)}</p>

      <div class="news-meta">
        By ${escapeHTML(story.author || "Marginal News Desk")}
      </div>

    </article>
  `).join("");
}


/* =========================================
   13. CATEGORY FILTER
========================================= */

function setCategory(category) {
  currentCategory = category;
  searchQuery = "";

  document.querySelectorAll(
    "#categoryFilter button"
  ).forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.category === category
    );
  });

  renderNews();
}

function initializeCategoryFilters() {

  const filter = $("categoryFilter");

  if (filter) {
    filter.addEventListener("click", event => {

      const button = event.target.closest("[data-category]");

      if (!button) return;

      setCategory(button.dataset.category);

    });
  }

  document.querySelectorAll(
    "[data-category]"
  ).forEach(element => {

    if (element.closest("#categoryFilter")) return;

    element.addEventListener("click", () => {

      const category = element.dataset.category;

      if (!category) return;

      setCategory(category);

    });

  });
}


/* =========================================
   14. ARTICLE READER
========================================= */

function openArticle(id) {

  const story = allStories.find(
    item => item.id === id
  );

  if (!story) return;

  const modal = $("articleModal");
  const content = $("articleContent");

  if (!modal || !content) return;

  const image = getStoryImage(story);

  content.innerHTML = `

    <span class="category-tag">
      ${escapeHTML(categoryName(story.sec))}
    </span>

    <h1 class="article-title">
      ${escapeHTML(story.title)}
    </h1>

    <div class="news-meta">
      By ${escapeHTML(story.author || "Marginal News Desk")}
      ·
      ${escapeHTML(formatDate(getStoryDate(story)))}
    </div>

    ${image ? `
      <img
        class="article-image"
        src="${escapeHTML(image)}"
        alt="${escapeHTML(story.title)}"
      >
    ` : ""}

    <p style="font-weight:700;margin-bottom:20px">
      ${escapeHTML(story.summary)}
    </p>

    <div class="article-body">
      ${escapeHTML(story.body)}
    </div>

    <div style="margin-top:25px;border-top:1px solid #ddd;padding-top:15px">

      <strong>Marginal News</strong>

      <p class="text-muted">
        Voices Beyond the Headlines.
      </p>

    </div>

  `;

  modal.classList.add("active");

  document.body.style.overflow = "hidden";

  history.replaceState(
    null,
    "",
    getStoryLink(story)
  );
}

function closeArticle() {

  const modal = $("articleModal");

  if (!modal) return;

  modal.classList.remove("active");

  document.body.style.overflow = "";

  history.replaceState(
    null,
    "",
    window.location.pathname
  );
}


/* =========================================
   15. SEARCH SYSTEM
========================================= */

function openSearch() {

  const modal = $("searchModal");

  if (!modal) return;

  modal.classList.add("active");

  const input = $("searchInput");

  if (input) input.focus();
}

function closeSearch() {

  const modal = $("searchModal");

  if (!modal) return;

  modal.classList.remove("active");
}

function initializeSearch() {

  $("openSearch")?.addEventListener(
    "click",
    openSearch
  );

  $("closeSearch")?.addEventListener(
    "click",
    closeSearch
  );

  $("searchForm")?.addEventListener(
    "submit",
    event => {

      event.preventDefault();

      searchQuery = $("searchInput").value.trim();

      currentCategory = "all";

      closeSearch();

      renderNews();

      $("latest")?.scrollIntoView({
        behavior: "smooth"
      });

    }
  );

}


/* =========================================
   16. NEWSLETTER SUBSCRIPTION
========================================= */

function initializeNewsletter() {

  const form = $("newsletterForm");

  if (!form) return;

  form.addEventListener("submit", async event => {

    event.preventDefault();

    const email = $("newsletterEmail").value.trim();

    const message = $("newsletterMessage");

    const button = form.querySelector("button");

    button.disabled = true;
    button.textContent = "Subscribing...";

    message.textContent = "";

    try {

      const response = await fetch(API.subscribe, {

        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({ email })

      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Subscription failed."
        );
      }

      message.textContent =
        "Thank you! Your subscription is successful.";

      form.reset();

      showToast("Successfully subscribed!");

    } catch (error) {

      message.textContent = error.message;

    } finally {

      button.disabled = false;
      button.textContent = "Subscribe Now";

    }

  });

}


/* =========================================
   17. GLOBAL ARTICLE CLICK HANDLER
========================================= */

document.addEventListener("click", event => {

  const link = event.target.closest("[data-read]");

  if (!link) return;

  event.preventDefault();

  const id = link.dataset.read;

  openArticle(id);

});


/* =========================================
   18. MODAL CONTROLS
========================================= */

$("closeArticle")?.addEventListener(
  "click",
  closeArticle
);

$("articleModal")?.addEventListener(
  "click",
  event => {

    if (event.target === $("articleModal")) {
      closeArticle();
    }

  }
);

$("searchModal")?.addEventListener(
  "click",
  event => {

    if (event.target === $("searchModal")) {
      closeSearch();
    }

  }
);

document.addEventListener("keydown", event => {

  if (event.key === "Escape") {
    closeArticle();
    closeSearch();
  }

});


/* =========================================
   19. DATE AND COPYRIGHT
========================================= */

function initializeDate() {

  const dateElement = $("currentDate");

  if (dateElement) {

    dateElement.textContent =
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      });

  }

  const year = $("copyrightYear");

  if (year) {
    year.textContent = new Date().getFullYear();
  }

}


/* =========================================
   20. INITIALIZE WEBSITE
========================================= */

async function initializeWebsite() {

  initializeDate();

  initializeCategoryFilters();

  initializeSearch();

  initializeNewsletter();

  await fetchStories();

  console.log(
    "Marginal News Website Initialized Successfully."
  );

}


/* =========================================
   START
========================================= */

document.addEventListener(
  "DOMContentLoaded",
  initializeWebsite
);

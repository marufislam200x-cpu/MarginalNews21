
/* =========================================
   MARGINAL NEWS
   ADMIN DASHBOARD JAVASCRIPT
========================================= */

"use strict";

/* API CONFIGURATION */

const API = {
  stories: "../api/stories",
  subscribe: "../api/subscribe"
};

const $ = id => document.getElementById(id);

let adminPassword = "";
let stories = [];


/* CATEGORY NAMES */

const categories = {
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


/* =========================================
   1. HELPERS
========================================= */

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function formatDate(value) {
  if (!value) return "Not scheduled";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function isScheduled(story) {
  return story.status === "published" &&
    story.publishAt &&
    new Date(story.publishAt).getTime() > Date.now();
}

function getStatus(story) {
  if (isScheduled(story)) return "Scheduled";
  return story.status === "published" ? "Published" : "Draft";
}

function apiHeaders() {
  return {
    "Content-Type": "application/json",
    "x-admin-password": adminPassword
  };
}

function showMessage(elementId, message, isError = false) {
  const element = $(elementId);

  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error", isError);
}


/* =========================================
   2. LOGIN AND LOGOUT
========================================= */

function showLogin() {
  $("loginSection").classList.remove("hidden");
  $("dashboardSection").classList.add("hidden");
  $("headerActions").classList.add("hidden");
}

function showDashboard() {
  $("loginSection").classList.add("hidden");
  $("dashboardSection").classList.remove("hidden");
  $("headerActions").classList.remove("hidden");
}

async function login(event) {
  event.preventDefault();

  const password = $("adminPassword").value.trim();

  if (!password) {
    showMessage("loginMessage", "Please enter your password.", true);
    return;
  }

  adminPassword = password;

  const button = $("loginBtn");
  button.disabled = true;
  button.textContent = "Checking...";

  showMessage("loginMessage", "Connecting to newsroom...");

  try {
    const response = await fetch(
      API.stories + "?admin=1",
      {
        method: "GET",
        headers: apiHeaders()
      }
    );

    if (response.status === 401) {
      throw new Error("Incorrect administrator password.");
    }

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(
        result.error || "Unable to connect to the server."
      );
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("Invalid server response.");
    }

    stories = data;

    showDashboard();
    updateDashboardDate();
    renderDashboard();
    showMessage("loginMessage", "");

  } catch (error) {
    adminPassword = "";

    showMessage(
      "loginMessage",
      error.message,
      true
    );

  } finally {
    button.disabled = false;
    button.textContent = "Sign In to Dashboard";
  }
}

function logout() {
  adminPassword = "";
  stories = [];

  $("adminPassword").value = "";
  $("loginForm").reset();

  clearStoryForm();

  showLogin();
}


/* =========================================
   3. DASHBOARD DATE
========================================= */

function updateDashboardDate() {
  const dateElement = $("dashboardDate");

  if (!dateElement) return;

  dateElement.textContent = new Date().toLocaleDateString(
    "en-GB",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    }
  );
}


/* =========================================
   4. LOAD ALL STORIES
========================================= */

async function loadStories() {
  const list = $("storiesList");

  list.innerHTML = `
    <div class="loading-message">
      Loading newsroom stories...
    </div>
  `;

  try {
    const response = await fetch(
      API.stories + "?admin=1",
      {
        headers: apiHeaders()
      }
    );

    if (response.status === 401) {
      logout();
      throw new Error("Your session is no longer valid. Please sign in again.");
    }

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || "Could not load stories.");
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("Invalid story data.");
    }

    stories = data;

    renderDashboard();

  } catch (error) {
    list.innerHTML = `
      <div class="loading-message">
        ${escapeHTML(error.message)}
      </div>
    `;
  }
}


/* =========================================
   5. DASHBOARD STATISTICS
========================================= */

function renderStatistics() {
  const total = stories.length;

  const published = stories.filter(
    story => story.status === "published" && !isScheduled(story)
  ).length;

  const drafts = stories.filter(
    story => story.status !== "published"
  ).length;

  const scheduled = stories.filter(
    story => isScheduled(story)
  ).length;

  $("totalStories").textContent = total;
  $("publishedStories").textContent = published;
  $("draftStories").textContent = drafts;
  $("scheduledStories").textContent = scheduled;
}


/* =========================================
   6. STORY LIST
========================================= */

function renderStories() {
  const container = $("storiesList");

  const filter = $("storyFilter").value;

  let filtered = [...stories];

  if (filter === "published") {
    filtered = filtered.filter(
      story => story.status === "published" && !isScheduled(story)
    );
  }

  if (filter === "draft") {
    filtered = filtered.filter(
      story => story.status !== "published"
    );
  }

  if (filter === "scheduled") {
    filtered = filtered.filter(isScheduled);
  }

  filtered.sort((a, b) => (b.ts || 0) - (a.ts || 0));

  if (!filtered.length) {
    container.innerHTML = `
      <div class="loading-message">
        No stories found.
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(story => {

    const status = getStatus(story);

    const statusClass =
      status === "Published" ? "status-published" :
      status === "Scheduled" ? "status-scheduled" :
      "status-draft";

    return `
      <article class="story-item">

        <div class="story-information">

          <h3>${escapeHTML(story.title)}</h3>

          <div class="story-meta">

            <span class="status-badge ${statusClass}">
              ${escapeHTML(status)}
            </span>

            ${escapeHTML(categories[story.sec] || "News")}

            ·

            ${escapeHTML(story.author || "Marginal News Desk")}

            ·

            ${escapeHTML(formatDate(story.ts))}

          </div>

          ${story.featured ? "<small>★ Featured Story</small>" : ""}

          ${story.editorsPick ? "<small> · Editor's Pick</small>" : ""}

        </div>

        <div class="story-actions">

          <button
            type="button"
            class="edit-btn"
            data-action="edit"
            data-id="${escapeHTML(story.id)}">
            Edit
          </button>

          <button
            type="button"
            class="delete-btn"
            data-action="delete"
            data-id="${escapeHTML(story.id)}">
            Delete
          </button>

        </div>

      </article>
    `;

  }).join("");
}


/* =========================================
   7. RENDER DASHBOARD
========================================= */

function renderDashboard() {
  renderStatistics();
  renderStories();
}


/* =========================================
   8. CLEAR STORY FORM
========================================= */

function clearStoryForm() {
  $("storyForm").reset();

  $("storyId").value = "";

  $("editorTitle").textContent = "Create New Story";

  $("saveStoryBtn").textContent = "Save Story";

  showMessage("storyMessage", "");
}


/* =========================================
   9. EDIT STORY
========================================= */

function editStory(id) {
  const story = stories.find(
    item => item.id === id
  );

  if (!story) {
    showMessage("storyMessage", "Story not found.", true);
    return;
  }

  $("storyId").value = story.id || "";
  $("storyTitle").value = story.title || "";
  $("storySummary").value = story.summary || "";
  $("storyBody").value = story.body || "";
  $("storyCategory").value = story.sec || "bd";
  $("storyAuthor").value = story.author || "";
  $("storyImage").value = story.image || "";
  $("storyStatus").value = story.status || "draft";

  $("storyFeatured").checked = !!story.featured;
  $("storyEditorsPick").checked = !!story.editorsPick;

  if (story.publishAt) {
    const date = new Date(story.publishAt);

    $("publishAt").value = new Date(
      date.getTime() - date.getTimezoneOffset() * 60000
    ).toISOString().slice(0, 16);
  } else {
    $("publishAt").value = "";
  }

  $("editorTitle").textContent = "Edit News Story";
  $("saveStoryBtn").textContent = "Update Story";

  $("editorSection").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}


/* =========================================
   10. SAVE NEW OR UPDATED STORY
========================================= */

async function saveStory(event) {
  event.preventDefault();

  const id = $("storyId").value;

  const scheduleValue = $("publishAt").value;

  let publishAt = "";

  if (scheduleValue) {
    const date = new Date(scheduleValue);

    if (Number.isNaN(date.getTime())) {
      showMessage("storyMessage", "Invalid schedule date.", true);
      return;
    }

    publishAt = date.toISOString();
  }

  const story = {
    id: id || undefined,

    title: $("storyTitle").value.trim(),

    summary: $("storySummary").value.trim(),

    body: $("storyBody").value.trim(),

    sec: $("storyCategory").value,

    author: $("storyAuthor").value.trim() ||
      "Marginal News Desk",

    image: $("storyImage").value.trim(),

    status: $("storyStatus").value,

    publishAt,

    featured: $("storyFeatured").checked,

    editorsPick: $("storyEditorsPick").checked
  };

  if (!story.title || !story.summary || !story.body) {
    showMessage(
      "storyMessage",
      "Headline, summary and full content are required.",
      true
    );
    return;
  }

  const button = $("saveStoryBtn");

  button.disabled = true;
  button.textContent = "Saving...";

  showMessage("storyMessage", "Saving story...");

  try {
    const response = await fetch(API.stories, {
      method: id ? "PUT" : "POST",
      headers: apiHeaders(),
      body: JSON.stringify(story)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to save story.");
    }

    clearStoryForm();

    showMessage(
      "storyMessage",
      "Story saved successfully."
    );

    await loadStories();

  } catch (error) {
    showMessage(
      "storyMessage",
      error.message,
      true
    );

  } finally {
    button.disabled = false;
    button.textContent = id ? "Update Story" : "Save Story";
  }
}


/* =========================================
   11. DELETE STORY
========================================= */

async function deleteStory(id) {
  const story = stories.find(item => item.id === id);

  if (!story) return;

  const confirmed = confirm(
    `Are you sure you want to delete "${story.title}"?`
  );

  if (!confirmed) return;

  try {
    const response = await fetch(API.stories, {
      method: "DELETE",
      headers: apiHeaders(),
      body: JSON.stringify({ id })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Could not delete story.");
    }

    showMessage(
      "storyMessage",
      "Story deleted successfully."
    );

    await loadStories();

  } catch (error) {
    alert(error.message);
  }
}


/* =========================================
   12. STORY ACTIONS
========================================= */

$("storiesList").addEventListener("click", event => {

  const button = event.target.closest("[data-action]");

  if (!button) return;

  const id = button.dataset.id;
  const action = button.dataset.action;

  if (action === "edit") {
    editStory(id);
  }

  if (action === "delete") {
    deleteStory(id);
  }

});


/* =========================================
   13. FILTER STORIES
========================================= */

$("storyFilter").addEventListener("change", renderStories);


/* =========================================
   14. NEWSLETTER CSV DOWNLOAD
========================================= */

async function downloadSubscribers() {
  const button = $("downloadSubscribersBtn");

  button.disabled = true;
  button.textContent = "Preparing...";

  try {
    const response = await fetch(API.subscribe, {
      method: "GET",
      headers: apiHeaders()
    });

    if (response.status === 401) {
      logout();
      throw new Error("Please sign in again.");
    }

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || "Download failed.");
    }

    const blob = await response.blob();

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = "marginal-news-subscribers.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

  } catch (error) {
    alert(error.message);

  } finally {
    button.disabled = false;
    button.textContent = "↓ Download CSV";
  }
}


/* =========================================
   15. INITIALIZE EVENTS
========================================= */

$("loginForm").addEventListener("submit", login);

$("logoutBtn").addEventListener("click", logout);

$("storyForm").addEventListener("submit", saveStory);

$("newStoryBtn").addEventListener("click", () => {

  clearStoryForm();

  $("editorSection").scrollIntoView({
    behavior: "smooth"
  });

});

$("cancelEditBtn").addEventListener(
  "click",
  clearStoryForm
);

$("clearFormBtn").addEventListener(
  "click",
  clearStoryForm
);

$("refreshBtn").addEventListener(
  "click",
  loadStories
);

$("downloadSubscribersBtn").addEventListener(
  "click",
  downloadSubscribers
);


/* =========================================
   16. START
========================================= */

showLogin();

console.log("Marginal News Admin Ready.");

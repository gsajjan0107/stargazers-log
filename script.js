const listEl = document.getElementById("starred");

let allEvents = [];
let sortOrder = "desc"; // "desc" (newest first) | "asc" (oldest first)
let searchQuery = "";
let controlsInitialized = false;
let filterInputEl = null;
let sortButtonEl = null;

function renderMessage(message, isError = false) {
  if (!listEl) return;

  listEl.replaceChildren();

  const statusItem = document.createElement("li");
  statusItem.textContent = message;
  statusItem.dataset.state = isError ? "error" : "empty";
  listEl.appendChild(statusItem);
}

function normalizeEvent(event) {
  const name =
    typeof event?.name === "string" && event.name.trim()
      ? event.name.trim()
      : "Unknown repository";
  const starredRaw =
    typeof event?.starred === "string" && event.starred.trim()
      ? event.starred.trim()
      : "";

  let timestamp = Number.NEGATIVE_INFINITY;
  let hasValidDate = false;
  let isoDateAttr = "";

  if (starredRaw) {
    const parsed = Date.parse(starredRaw);
    if (!Number.isNaN(parsed)) {
      timestamp = parsed;
      hasValidDate = true;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(starredRaw)) {
      isoDateAttr = starredRaw;
    }
  }

  return {
    name,
    starredRaw,
    timestamp,
    hasValidDate,
    isoDateAttr,
    searchText: `${name} ${starredRaw}`.toLowerCase(),
  };
}

function compareEventsByDate(a, b) {
  // Put entries without valid parseable dates at the bottom regardless of sort order
  if (a.hasValidDate && !b.hasValidDate) return -1;
  if (!a.hasValidDate && b.hasValidDate) return 1;
  if (!a.hasValidDate && !b.hasValidDate) {
    return a.name.localeCompare(b.name);
  }

  if (a.timestamp !== b.timestamp) {
    return sortOrder === "asc"
      ? a.timestamp - b.timestamp
      : b.timestamp - a.timestamp;
  }

  return a.name.localeCompare(b.name);
}

function updateSortButtonLabel() {
  if (!sortButtonEl) return;

  const isNewestFirst = sortOrder === "desc";
  sortButtonEl.textContent = isNewestFirst
    ? "Sort: Newest first"
    : "Sort: Oldest first";
  sortButtonEl.setAttribute(
    "aria-label",
    isNewestFirst
      ? "Chronological sort order: newest first. Activate to sort oldest first."
      : "Chronological sort order: oldest first. Activate to sort newest first."
  );
  sortButtonEl.setAttribute("aria-pressed", String(!isNewestFirst));
}

function ensureControls() {
  if (controlsInitialized || !listEl || !listEl.parentNode) return;

  const toolbar = document.createElement("div");
  toolbar.className = "starred-controls";
  toolbar.setAttribute("role", "region");
  toolbar.setAttribute("aria-label", "Filter and sort starred repositories");

  const labelEl = document.createElement("label");
  labelEl.htmlFor = "starred-search";
  labelEl.className = "filter-label";
  labelEl.textContent = "Filter repositories";

  const inputEl = document.createElement("input");
  inputEl.id = "starred-search";
  inputEl.type = "search";
  inputEl.className = "filter-input";
  inputEl.placeholder = "Search by owner, repo, or date...";
  inputEl.autocomplete = "off";

  inputEl.addEventListener("input", () => {
    searchQuery = inputEl.value.trim().toLowerCase();
    renderFilteredEvents();
  });

  const buttonEl = document.createElement("button");
  buttonEl.type = "button";
  buttonEl.className = "sort-button";

  buttonEl.addEventListener("click", () => {
    sortOrder = sortOrder === "desc" ? "asc" : "desc";
    updateSortButtonLabel();
    renderFilteredEvents();
  });

  filterInputEl = inputEl;
  sortButtonEl = buttonEl;
  updateSortButtonLabel();

  toolbar.append(labelEl, inputEl, buttonEl);
  listEl.parentNode.insertBefore(toolbar, listEl);
  controlsInitialized = true;
}

function createStarredItem(entry) {
  const item = document.createElement("li");

  const repoSpan = document.createElement("span");
  repoSpan.className = "repo-name";
  repoSpan.textContent = entry.name;
  item.appendChild(repoSpan);

  if (entry.starredRaw) {
    item.appendChild(document.createTextNode(" — starred "));

    const timeEl = document.createElement("time");
    timeEl.textContent = entry.starredRaw;
    if (entry.isoDateAttr) {
      timeEl.dateTime = entry.isoDateAttr;
    }
    item.appendChild(timeEl);
  }

  return item;
}

function renderFilteredEvents() {
  if (!listEl) return;

  if (allEvents.length === 0) {
    renderMessage("No starred repositories recorded yet.", false);
    return;
  }

  const terms = searchQuery.split(/\s+/).filter(Boolean);
  const matching = allEvents
    .filter((entry) => terms.every((term) => entry.searchText.includes(term)))
    .sort(compareEventsByDate);

  if (matching.length === 0) {
    const queryDisplay = filterInputEl?.value.trim() || searchQuery;
    renderMessage(`No repositories match "${queryDisplay}".`, false);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const entry of matching) {
    fragment.appendChild(createStarredItem(entry));
  }

  listEl.replaceChildren(fragment);
}

async function loadStarredEvents() {
  if (!listEl) {
    console.warn('Missing required "#starred" list element.');
    return;
  }

  try {
    const response = await fetch("events.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} (${response.statusText || "Request failed"})`
      );
    }

    const data = await response.json();
    const rawEvents = Array.isArray(data)
      ? data
      : Array.isArray(data?.events)
        ? data.events
        : null;

    if (!rawEvents) {
      throw new Error("Invalid events format: expected an array.");
    }

    allEvents = rawEvents.map(normalizeEvent);
    ensureControls();
    renderFilteredEvents();
  } catch (error) {
    console.error("Failed to load starred repositories:", error);
    renderMessage("Unable to load starred repositories right now.", true);
  }
}

loadStarredEvents();
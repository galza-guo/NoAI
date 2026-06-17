# FAQ Progressive Navigation Bar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a progressive navigation sidebar to the FAQ page that highlights the active section as the user scrolls.

**Architecture:** We will modify `src/main.ts` to generate the DOM layout including a sidebar with links to section IDs. We will use `IntersectionObserver` to track the active section and update link states. We will update `src/styles.css` to style the layout correctly for desktop (sticky sidebar) and mobile (horizontal scrolling bar).

**Tech Stack:** TypeScript, DOM API, IntersectionObserver, CSS Grid/Flexbox.

---

### Task 1: Update CSS Styles

**Files:**
- Modify: `src/styles.css`

**Step 1: Write the failing test**
(No automated tests for CSS, visual verification required)

**Step 2: Run test to verify it fails**
N/A

**Step 3: Write minimal implementation**

Add the following to `src/styles.css` (around where `.info-page` is defined):

```css
.info-page-layout {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.info-sidebar {
  position: sticky;
  top: 60px;
  max-height: calc(100vh - 80px);
  overflow-y: auto;
  align-self: start;
  min-width: 220px;
  padding: 10px 0;
}

.info-toc {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toc-link {
  font-size: 0.9rem;
  color: var(--color-text-muted);
  text-decoration: none;
  padding: 6px 12px;
  border-left: 2px solid transparent;
  transition: all 0.2s ease;
}

.toc-link:hover, .toc-link:focus-visible {
  color: var(--color-text-main);
  background: var(--color-bg-panel);
  text-decoration: none !important;
}

.toc-link.active {
  color: var(--color-accent);
  font-weight: 600;
  border-left-color: var(--color-accent);
}

.info-content-wrap {
  flex: 1;
  min-width: 0;
}

/* Desktop layout */
@media (min-width: 761px) {
  .info-page-layout {
    flex-direction: row;
    gap: 40px;
  }
}

/* Mobile layout (Horizontal Scrollable Nav) */
@media (max-width: 760px) {
  .info-sidebar {
    position: relative;
    top: 0;
    max-height: none;
    overflow-y: visible;
    padding: 0;
    border-bottom: 1px solid var(--color-border-soft);
    margin-bottom: 16px;
  }
  
  .info-toc {
    flex-direction: row;
    overflow-x: auto;
    padding-bottom: 10px;
    gap: 16px;
    scrollbar-width: none; /* Firefox */
  }
  
  .info-toc::-webkit-scrollbar {
    display: none; /* Chrome/Safari */
  }

  .toc-link {
    border-left: none;
    border-bottom: 2px solid transparent;
    white-space: nowrap;
    padding: 6px 4px;
  }

  .toc-link.active {
    border-left-color: transparent;
    border-bottom-color: var(--color-accent);
  }
}
```

**Step 4: Run test to verify it passes**
N/A

**Step 5: Commit**
```bash
git add src/styles.css
git commit -m "style: add layout styles for FAQ progressive navigation"
```

---

### Task 2: Modify DOM Generation in `src/main.ts`

**Files:**
- Modify: `src/main.ts`

**Step 1: Write the failing test**
(No automated tests for this DOM scaffold)

**Step 2: Run test to verify it fails**
N/A

**Step 3: Write minimal implementation**

Modify `renderInfoPage` in `src/main.ts` to output the new DOM structure.

```typescript
function renderInfoPage(route: InfoRoute): void {
  const page = INFO_PAGE_SCAFFOLDS[route];
  const versionMeta = /* existing code */;

  const sectionHtml = page.sections
    .map((section) => {
      const id = section.heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      return `
        <section id="${id}" class="info-section">
          <h2>${escapeHtml(section.heading)}</h2>
          ${renderInfoBlocks(section.blocks)}
        </section>
      `;
    })
    .join("");

  let sidebarHtml = "";
  if (page.sections.length > 0) {
    const tocLinks = page.sections
      .map((section) => {
        const id = section.heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        return `<a href="#/${route}#${id}" class="toc-link" data-target="${id}">${escapeHtml(section.heading)}</a>`;
      })
      .join("");
    
    sidebarHtml = `
      <aside class="info-sidebar" aria-label="Table of contents">
        <nav class="info-toc">
          ${tocLinks}
        </nav>
      </aside>
    `;
  }

  infoView.innerHTML = `
    <article class="info-page" aria-labelledby="info-title">
      <div class="info-page-layout">
        ${sidebarHtml}
        <div class="info-content-wrap">
          <header class="info-hero">
            <a class="info-back-link" href="#/">
              <i class="ph ph-arrow-left" aria-hidden="true"></i>
              <span>Back to workspace</span>
            </a>
            <h1 id="info-title">${escapeHtml(page.title)}</h1>
            <p>${escapeHtml(page.summary)}</p>
            ${versionMeta}
          </header>
          <div class="info-section-list">
            ${sectionHtml}
          </div>
          <footer class="info-footer">
            ${SITE_LINKS.map(link => `<a href="${routeHref(link.route)}">${escapeHtml(link.label)}</a>`).join("")}
          </footer>
        </div>
      </div>
    </article>
  `;

  if (page.sections.length > 0) {
    setupScrollSpy();
  }
}
```

**Step 4: Run test to verify it passes**
N/A

**Step 5: Commit**
```bash
git add src/main.ts
git commit -m "feat: render FAQ layout with sidebar"
```

---

### Task 3: Implement Scroll Spy Logic in `src/main.ts`

**Files:**
- Modify: `src/main.ts`

**Step 1: Write the failing test**
N/A

**Step 2: Run test to verify it fails**
N/A

**Step 3: Write minimal implementation**

Add `setupScrollSpy` function to `src/main.ts`:

```typescript
function setupScrollSpy(): void {
  const sections = infoView.querySelectorAll<HTMLElement>(".info-section");
  const tocLinks = infoView.querySelectorAll<HTMLAnchorElement>(".toc-link");
  if (sections.length === 0 || tocLinks.length === 0) return;

  const observerOptions = {
    root: null,
    rootMargin: "-20% 0px -60% 0px", // Active when in upper middle of viewport
    threshold: 0
  };

  const activeSections = new Set<string>();

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        activeSections.add(entry.target.id);
      } else {
        activeSections.delete(entry.target.id);
      }
    });

    // Find the first active section in DOM order to highlight
    let highlightedId: string | null = null;
    for (const section of Array.from(sections)) {
      if (activeSections.has(section.id)) {
        highlightedId = section.id;
        break;
      }
    }

    if (!highlightedId && activeSections.size === 0) {
      // If nothing is active, default to first or keep last
      return;
    }

    tocLinks.forEach(link => {
      if (link.dataset.target === highlightedId) {
        link.classList.add("active");
        // Ensure visible on mobile horizontal scroll
        link.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      } else {
        link.classList.remove("active");
      }
    });
  }, observerOptions);

  sections.forEach(sec => observer.observe(sec));

  // Handle click for smooth scrolling
  tocLinks.forEach(link => {
    link.addEventListener("click", (e) => {
      const targetId = link.dataset.target;
      const targetSection = document.getElementById(targetId || "");
      if (targetSection) {
        e.preventDefault();
        window.history.pushState(null, "", link.href);
        targetSection.scrollIntoView({ behavior: "smooth" });
      }
    });
  });

  // Initial active state
  tocLinks[0]?.classList.add("active");
}
```

**Step 4: Run test to verify it passes**
Run `npm run dev` and test scroll behavior manually in browser.

**Step 5: Commit**
```bash
git add src/main.ts
git commit -m "feat: add IntersectionObserver scroll spy for FAQ navigation"
```

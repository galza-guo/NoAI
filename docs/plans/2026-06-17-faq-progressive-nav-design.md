# FAQ Progressive Navigation Bar Design

## Goal
Enhance the FAQ page (and potentially other info pages) with a progressive side navigation bar that serves as a Table of Contents (ToC). The navigation bar will highlight the active section as the user scrolls, providing a "progressive" scroll-spy experience.

## Layout & Styling
1. **Desktop View:**
   - A sticky left sidebar containing the ToC.
   - The main content sits to the right of the sidebar.
   - The sidebar remains sticky as the user scrolls through the content.
2. **Mobile/Smaller Screens:**
   - The layout switches to a single column.
   - The ToC becomes a horizontal, scrollable sticky bar anchored just below the main top header, allowing quick jumps without occupying too much vertical space.

## DOM Structure

```html
<article class="info-page" aria-labelledby="info-title">
  <div class="info-page-layout">
    <aside class="info-sidebar" aria-label="Table of contents">
      <nav class="info-toc">
        <a href="#/faq#how-noai-works" class="toc-link active" data-target="how-noai-works">How NoAI works</a>
        <!-- Other sections... -->
      </nav>
    </aside>

    <div class="info-content-wrap">
      <header class="info-hero">...</header>
      <div class="info-section-list">
        <section id="how-noai-works" class="info-section">
          <h2>How NoAI works</h2>
          <!-- Content -->
        </section>
        <!-- Other sections... -->
      </div>
      <footer class="info-footer">...</footer>
    </div>
  </div>
</article>
```
Each section's ID will be generated programmatically from its heading text (e.g., lowercase, spaces replaced by hyphens).

## JavaScript Logic (Scroll Spy)
- **IntersectionObserver:** An `IntersectionObserver` will be attached to each `.info-section` element.
- **Threshold & Root Margin:** The observer will be configured with appropriate thresholds and negative root margins (e.g., `-100px 0px 0px 0px`) to determine which section is currently at the top of the reading area.
- **State Management:** When a section enters the target zone, the `active` class is applied to its corresponding `.toc-link` in the navigation sidebar, and removed from the others.
- **Click Behavior:** Clicking a `.toc-link` will scroll the main view smoothly to the corresponding section.

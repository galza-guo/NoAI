# Design: Hover-to-Reveal Delete Action

## Context
The Replacements list displays the original text, a replacement text input, and a delete ("x") button for each entry. The persistent display of the delete button on every row causes visual clutter.

## Requirements
- Reduce visual noise in the Replacements panel.
- Ensure the delete action remains accessible and intuitive.
- Prevent layout shifts (e.g., the input box expanding or jumping) when the delete action is revealed.

## Approach: Opacity-Based Hover State
We will use a pure CSS approach to hide the delete button by default and reveal it when the user interacts with the specific entry row.

### Styling Mechanism
1. **Hidden Default State**:
   - The `.entry-delete` button will remain in the DOM, preserving its layout space.
   - It will be styled with `opacity: 0` to make it visually invisible.
   - It will use `pointer-events: none` to ensure invisible buttons don't capture accidental clicks or interfere with text selection.

2. **Revealed State**:
   - When the user hovers over the parent `.entry-row` (`.entry-row:hover`), the `.entry-delete` button will transition to `opacity: 1` and `pointer-events: auto`.
   - To maintain accessibility for keyboard navigation, the button will also reveal if any element inside the row receives focus (`.entry-row:focus-within .entry-delete`).

3. **Transitions**:
   - A smooth CSS transition (`transition: opacity 0.2s ease`) will provide a polished fade-in/fade-out effect.

### Impact
- **No Layout Shift**: Because opacity is used instead of `display: none`, the layout structure mathematically reserves the space for the button at all times. The input field will not resize or move.
- **Clean Interface**: Scanning the list will only show the original and replacement text, significantly reducing UI clutter.

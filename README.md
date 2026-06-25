# The Sorting Studio

An interactive, side-by-side visualizer for four classic sorting algorithms —
**Insertion, Selection, Merge, and Quick sort** — built as a learning tool.

## How to open it

Just **double-click `index.html`** and it opens in your web browser. Nothing to
install. (An internet connection makes the fonts look their best, but it works
offline too.)

## What you can do

- **Array size** — slider at the top sets how many bars to sort (4–24).
- **Shape** — start from a *Random*, *Nearly sorted*, *Reversed*, or *Few unique*
  list, then **Regenerate** for a new one.
- **Methods** — show **1 or all 4** algorithms at once. Every panel animates in
  lock-step on the same step number, so you can compare them directly.
- **View** — arrange the panels as a **2 × 2 grid** or **side by side** in one row.
- Each panel has two halves:
  - **Top:** the algorithm, shown as **Pseudocode**, **Python**, or **Java**
    (toggle per panel). The current line highlights as the animation runs.
  - **Bottom:** an animation of the array, with a one-line description of each step.
- **Playback** — ⏮ reset · ◀ step back · ▶ play (1 step/second by default) ·
  ▶▮ step forward. Drag the **Step** slider to jump anywhere, or change **Speed**.
- **Keyboard:** `Space` = play/pause, `←` / `→` = step back/forward.

## Color key

| Color | Meaning |
|-------|---------|
| Tan | Unsorted |
| Burnt orange | Being compared |
| Brick red | Moving / swapping |
| Dusty blue | Pivot (quick sort) |
| Ochre/gold | Key being inserted / current minimum |
| Olive outline | Partition boundary (quick sort) |
| Sage green | In its final sorted position |

## Files

- `index.html` — the page
- `styles.css` — the look (muted earth-tone palette)
- `algorithms.js` — the four algorithms + the pseudocode/Python/Java listings
- `app.js` — the controls, animation, and playback

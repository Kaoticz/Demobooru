# Ticket 1 — Browsing the grid is a chore: same-size thumbnails and endless clicking

**Type:** Feature / UX
**Scope:** frontend only

## Problem

"I've uploaded a few dozen photos and browsing them is getting annoying.
Every image is the same middle-of-the-road size, so I either squint at the
small ones or page through forever. When I'm looking for one specific photo I
want a denser overview so I can scan more at once; when I'm just admiring the
board I'd rather have bigger pictures. And clicking 'Next' 'Next' 'Next' to
get through 200 images is genuinely miserable."

Right now the board has exactly one way to view it: a fixed-size grid with
explicit previous/next pages. That was fine with three images on it. It is
not fine anymore.

## Desired outcome

People can browse a large board comfortably. Concretely, one or both of:

- I can change how large the thumbnails in the grid are — smaller to see more
  per screen, larger to see each image better — and the board remembers or at
  least respects that choice while I use it.
- I can move through a large number of images without explicitly clicking
  page controls every twenty images.

If only one of these can be done well, prefer whichever gives the bigger
improvement to the "scanning a large board" experience.

## Open questions

- Should the chosen size persist between visits, or reset each session?
- Is there a sensible default for small screens / projectors?
- Nice to have: keyboard navigation (arrows / page keys) through the grid.

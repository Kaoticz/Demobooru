# Ticket 2 — I can't remember how tags are spelled, and I don't know what tags exist

**Type:** Feature / UX + backend
**Scope:** frontend + backend

## Problem

"The tag system only works if you already know the tags. When I search, I'm
typing blind: was it `landscape_photo` or `landscapephoto`? `cats` or `cat`?
If I guess wrong I get 'No results' and no help figuring out why. And when I
do get results, there's no easy way to narrow them down — I have to guess
which other tags those images might carry. The tag list on the side helps a
little, but scrolling an alphabetical list isn't finding, and it gives me no
idea which tags are actually worth searching for."

Typing tags on upload has the same problem in reverse: I never remember the
conventions we already use, so we end up with near-duplicate tags.

## Desired outcome

- While typing in the search box, I see suggestions drawn from the tags that
  actually exist, with the ones used on the most images first, so a partial
  word is enough to find the right tag.
- When I'm looking at search results, I can see other tags that co-occur with
  what I searched for, so I can refine or branch out from what I found.

## Open questions

- How many characters before suggestions appear, and how many suggestions at
  once? (Enough to be useful, not enough to be a wall.)
- Should the upload form's tag field get the same helping hand? It feels like
  the same problem, but maybe that's a follow-up.
- Nice to have: clicking one of the related tags *adds* to my current search
  instead of replacing it — is that too clever?

# Ticket 3 — Uploads of big photos bog everything down, and I can't say "cats but not dogs"

**Type:** Feature / architecture
**Scope:** full stack

This ticket collects two complaints that keep coming up together when people
upload a batch of photos from a phone.

## Problem 1: large uploads block everything

"Modern phone photos are 8–10 MB. When I upload one, the whole upload form
locks up with 'Uploading…' for what feels like a minute, the rest of the page
is effectively dead, and I just have to wait with no idea whether anything is
happening. If something goes wrong at the end, all of that waiting was for
nothing. Meanwhile whoever is looking at the board sees nothing until the
very end, and then the image pops in all at once."

The board was built to do everything in one go when an image arrives, which
was simple and honest when images were small. It now makes large uploads feel
broken even when they succeed.

## Desired outcome 1

Uploading a large image no longer feels like the app has died: the rest of
the board stays usable while an upload is in flight, the person uploading
gets meaningful feedback along the way, and a freshly uploaded image becomes
visible and usable promptly — even if the board still has work left to do on
it afterwards. What "still has work left" means in practice, and what
everyone else sees in the meantime, is an open design question.

## Problem 2: searches can't exclude anything

"Everything is AND-only. I can search `cat dog` and get images with both, but
what I actually want half the time is 'cats but not dogs' — my cat photos are
drowned out by every dog photo that happens to also have a cat in it. I have
started hand-deleting dog photos, which is not a search strategy."

## Desired outcome 2

I can express, in the one search box, something like "all of these tags, but
none of those tags" — for example cats excluding dogs — and get exactly that.
When I type something the search can't make sense of, the board tells me
what's wrong in plain language instead of silently returning nothing.

## Open questions

- For exclusions: what's the least surprising way to write "not this tag"?
  Users will never read a manual for this.
- Should an in-flight or still-processing image be visibly different from a
  finished one on the board? If so, who can do what with it while it's in
  that state?
- Nice to have: excluding a tag straight from the search UI once a search is
  active.

# Working in this repo

Two apps live here: **Penny** (`want3.html`, finance) and **Tempo** (`tempo/`, schedule and time).
The design language for both is in `.claude/skills/penny-design/SKILL.md`. Read it before touching any screen.

## The owner's standing rule: review every screen before you ship it

After **every** change to the interface, however small, render the changed screens with realistic data
(Playwright, phone size 390x844, English **and** Hebrew), look at the screenshots, and go through the
**UI review questions** in `.claude/skills/penny-design/SKILL.md` one by one. Fix what fails, re-render,
and only then commit. Do not guess how a screen looks; look at it.

Then scan the rest of the app for the same problem. A note from the owner about one screen is a rule
for every screen.

In your reply, say briefly which questions caught something and what you changed.

## Find code fast (read before searching)
- `docs/PROJECT_MAP.md`: how the pieces connect. `docs/CODE_INDEX.md`: every function with its line number per file.
- Look the symbol up in the index, then read only that part of the file. Don't scan the big single files end to end.
- After large edits run `python3 tools/code_index.py` to refresh the index.

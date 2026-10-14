# GDSaveEditor

A offline Geometry Dash save editor.

If this project helps you, please give it a star on GitHub. It is open source.

## Quick start
1. Drop `CCGameManager.dat` or `CCLocalLevels.dat` onto the page.
2. Edit, then export. Rename the exported `.edited.dat` back to the original file name and keep a backup of the original.

Save locations: Windows `%localappdata%\GeometryDash`, Android (Geode) `Android/media/com.geode.launcher/saves`.

## Features
- Opens `.dat` saves (XOR 11, URL-safe Base64, GZIP), plain XML and raw GZIP; tolerates junk bytes after the Base64 padding or GZIP stream
- Nested view with search, type filter (text, number, boolean, empty), virtual scrolling for very large saves
- Edit values with type validation, undo and redo
- Add keys: choose the group, name, type (text, whole number, decimal, boolean, group) and value
- Remove keys or whole groups
- Multi-select (checkboxes, Shift range, select all shown) and bulk edit: set, add, subtract or multiply many values in one undo step
- Help button that opens the usage guide ([HELP.md](HELP.md)) after asking
- Collapse all and Open all buttons
- Summary chips for your main stats (stars, moons, demons, diamonds, orbs, coins, keys, jumps, attempts), with a button to show every other stat
- Green alias labels under keys for:
  - top-level keys (`bgVolume`, `GLM_*`, `GS_*`, `GJA_*` and more)
  - `GS_value` stats, including shards and path progress
  - `valueKeeper` settings (`gv_0001` to `gv_0181`) and `unlockValueKeeper` flags (`ugv_1` to `ugv_37`)
  - `GS_completed` entries and ID-keyed tables such as level progress, stars and shop purchases
  - Aliases are searchable. Keys that are not documented are left unlabelled.
- Export `.dat` (same format it was opened in), XML, or JSON (numbers and booleans keep their types)

## Limits
- macOS saves (AES) are not supported
- JSON export lists numeric-looking keys first, because JavaScript objects order them that way
- Editing saves can break your progress or get an account flagged/leaderboards banned. Always keep a backup.

## Credits
- Key and slot names come from [GD Docs](https://boomlings.dev/resources/client/gamesave).
- Fonts: Torus (you can find it at `./resources/fonts.Torus.otf`)
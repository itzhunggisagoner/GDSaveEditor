# GDSaveEditor – How to use

GDSaveEditor is a local-first Geometry Dash save editor. Everything runs in your browser; your files are never uploaded.

> **Always keep a backup** of the original `CCGameManager.dat` and `CCLocalLevels.dat` before editing. Editing saves can result a **leaderboards ban**.

## 1. Find your save files

| Platform | Location |
| --- | --- |
| Windows | `C:/Users/Name/AppData/Local/GeometryDash` |
| Android [(Geode)](https://geode-sdk.org)| `Android/media/com.geode.launcher/saves` (root or backup tools needed) |

- `CCGameManager.dat` – icons, stats, settings, achievements, progress.
- `CCLocalLevels.dat` – your local levels progress.
- macOS saves (AES) are not supported.

## 2. Open a save

1. Go to [GDSaveEditor page.](https://gdsave.hungg.indevs.in)
2. Drop the `.dat` file on the page or press **Open file**.
3. Plain XML and raw GZIP files also work.

## 3. Find things

- Press `/` to jump to the search box. Search matches key names, the green alias labels and values.
- Use the **type filter** (text, numbers, booleans, empty) to narrow the list.
- The stat chips at the top (Stars, Moons, Demons, Diamonds, Orbs, Coins, Keys, Jumps, Attempts…) jump straight to that value. **+N more** shows the remaining stats such as shards and path progress.
- **Collapse all / Open all** fold the groups. Click a group row to fold or unfold it.
- Green text under a key is its **alias** – a readable name for keys such as `GS_value → 6` (Stars), `gv_0001` (settings), `ship_12` (unlocked icons), level keys (`k2` = Level name) and `geometry.ach.*` achievements (name and requirement).

## 4. Edit one value

1. Hover a row and press the pencil icon.
2. Type the new value and press **Save changes**. Numbers must be numbers, booleans must be `true` or `false`.
3. **Undo / Redo** (`Ctrl+Z` / `Ctrl+Y`) work for every change, including bulk edits.

## 5. Edit many values at once (multi-select)

1. Tick the checkboxes at the start of the rows you want. `Shift`+click selects a range, the header checkbox selects everything currently shown, `Ctrl+A` selects all shown rows, `Esc` clears.
2. Tip: search or filter first (for example `shard`), then tick the header checkbox to select every match.
3. Press **Edit selected** and choose an action:
   - **Set all to this value**
   - **Add to / Subtract from / Multiply** each number
4. The preview tells you how many values will change and how many will be skipped (for example text rows when you add a number).
5. **Apply to selected** applies everything as a single undo step.

## 6. Add and delete

- **Add key** creates a text, number, boolean or group key in the group you choose. The `+` icon on a group adds a key inside it.
- The `×` icon deletes a key, or a whole group.

## 7. Export

| Button | Result |
| --- | --- |
| Export .dat | Re-encrypted save the game can read (same format it was opened in) |
| Export XML | Readable XML for inspection |
| Export JSON | JSON with numbers and booleans typed |

Rename the exported `.edited.dat` back to the original file name, close Geometry Dash, and replace the file in your save folder.

## 8. Handy stat keys (`GS_value`)

| Key | Meaning | Key | Meaning |
| --- | --- | --- | --- |
| 1 | Jumps | 6 | Stars |
| 2 | Attempts | 12 | User coins |
| 5 | Demons | 13 | Diamonds |
| 8 | Secret coins | 14 | Mana orbs (current) |
| 21 | Demon keys | 22 | Total orbs |
| 28 | Moons | 29 | Diamond shards |
| 16–20, 23–27 | Elemental shards | 30–39 | Path progress |

## 9. Tips

- Make small edits and test them in the game before changing a lot.
- Use Export XML if you want to inspect exactly what will be written.
- The editor is open source: <https://github.com/itzhunggisagoner/GDSaveEditor>

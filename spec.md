# ChexClear

## Current State
Each Client has a single `letter: string` field. No notes field. No multi-letter support.

## Requested Changes (Diff)

### Add
- `Letter` type: id, title, text, createdAt, status (draft/sent/printed)
- `letters: Letter[]` and `notes: string` on Client
- Letters list on Client Detail: cards with title, date, status badge
- Letter detail view: inline edit title/text, copy, status change
- New Blank Letter button
- AI generation splits on `====` separators into multiple Letter docs (generic title: Dispute Letter X of N - date)
- Notes textarea on Client Detail, auto-saving

### Modify
- Client interface: remove `letter`, add `letters`, `notes`
- loadClients: normalize old data (letters = client.letters ?? [], notes = client.notes ?? '')
- NewClientPanel: init letters:[], notes:''
- handleGenerateLetter: split and save as Letter[]

### Remove
- Single letter textarea UI and letter field

## Implementation Plan
1. Update types
2. Update storage helpers to normalize
3. Update NewClientPanel
4. Update handleGenerateLetter to split + save
5. Replace letter UI with letters list + detail view
6. Add notes section

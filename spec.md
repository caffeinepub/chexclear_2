# ChexClear

## Current State
The Client Detail page shows client info (name, address, cityStateZip, dob, ssnLast4, phone, reportText) as read-only display. There is a separate inline Status selector that calls `updateActive`. The backend already has `updateClient(client: Client): async Bool`. There is no dedicated edit form/modal.

## Requested Changes (Diff)

### Add
- Edit Client modal/dialog that opens from the Client Detail page via an Edit button
- Modal contains editable fields for all client fields: name, address, cityStateZip, dob, ssnLast4, phone, reportText, and status
- On save, calls actor.updateClient(...) and updates local state
- Cancel button closes modal without saving

### Modify
- Client Info Card: add an Edit button that opens the Edit Client modal
- Keep existing inline status selector for quick status changes

### Remove
- Nothing

## Implementation Plan
1. Add showEditModal state boolean and editForm state (copy of active client fields)
2. Add EditClientModal using shadcn Dialog with inputs for all fields
3. Add Edit button to the Client Info Card header
4. On modal save: call actor.updateClient, update clients state, close modal, show toast
5. Status field in modal uses select or radio matching STATUS_CONFIG options

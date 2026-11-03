# Calendar lifecycle and notifications

PATCH /calendar/events/:id/status accepts moduleCode, action (complete/cancel/reactivate), expectedStatus, expectedVersion, operationId, optional expectedOutlookVersion and cancellation reason. Organizer authorization, state and version are revalidated under lock; the operation UUID is replay protected. Completing changes CRM only; cancelling requests Microsoft cancellation; reactivating a cancelled event cancels any remaining old Outlook copy before creating a new invitation while retaining the CRM ID. External failures retain CRM state and return unconfirmed delivery for safe retry.

PUT /calendar/notifications/events/:eventId/read acknowledges visible notifications only for the current recipient. Event detail calls this after authorized content loads and refreshes the bell. Linked-record navigation is exposed only when the existing target route permission is available; target APIs retain record authorization.

# Host queue removal implementation plan
Goal: the tournament creator can remove a single submitted video before launch, preserving other links and reclaiming capacity.
1. Test a pure transaction planner and Firestore owner-only atomic transition, including last-link deletion, closed-room rejection, invalid counters and unauthorized users.
2. Add stable submission UID + URL to lobby entries, an accessible Remove button with pending/error feedback, and disable launch during deletion.
3. Run an owner-checked Firestore transaction that updates the submission (or deletes its last link), usedCount and reservedVideoKeys together. Synchronize host and viewer UI via existing listeners.
4. Verify focused tests, emulator permissions, browser interaction, and publish frontend + new Rules source. Firebase Console Rules publication remains a user step because no publishing connection is available.

Expanded user scope: increase an existing lobby capacity (16 -> 32 -> 64) without changing the room ID or submissions, show match progress within each round and clear stage names, and make confirmed viewer submissions editable and deletable (including the last link). Rules and UI enforce all changes only while collecting. Add room metadata subscription so changes reach host and viewer tabs. Test increases, closed/unauthorized rejection, per-round progress reset, viewer editing/deletion and slot release.

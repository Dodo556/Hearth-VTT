# Map drawings: first slice

The GM needs simple saved map markings for shared play and private preparation. Add straight lines and outlined rectangles, four colors, shared and GM-only visibility, and undo of the most recent drawing in the selected scene. Mouse and keyboard use the same authoritative commands.

Drawings belong to scenes and remain after a restart. Commands are GM-only, validated and revisioned like other scene changes. Player snapshots must exclude GM drawings and shared drawings whose bounding box intersects hidden fog. This conservative fog rule may hide a diagonal that only crosses revealed cells. Reuse snapshot updates so reconnect and privacy follow existing projections. Limit drawings to 64 per scene to keep snapshots bounded.

The renderer places shared drawings above the grid and below fog/tokens; GM-only drawings appear above tokens. Text, freehand, editing individual shapes and custom layer ordering remain future work. Preserve schema 10 backup verification and isolated restore when migrating to schema 11. The browser-only self-hosted product direction remains unchanged.

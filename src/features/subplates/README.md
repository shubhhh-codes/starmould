# Subplate Master

`src/views/subplate-page.tsx` is the screen entrypoint. It keeps the existing public
stage-helper exports and connects the feature's presentation to its page controller.

- `hooks/use-subplate-page-controller.ts`: existing state, filters, calculations,
  requests, permissions and action ordering. The 98 statements moved from the old
  screen were compared against their previous syntax trees, in order.
- `components/subplate-mould-group.tsx`: mould header and its desktop/mobile views.
- `components/subplate-desktop-table.tsx`, `subplate-mobile-cards.tsx`: row/card presentation.
- `components/subplate-stage-studio.tsx`, `subplate-stage-card.tsx`,
  `subplate-mobile-stage.tsx`: production stage presentation.
- `components/*-stage-details.tsx`: purchase, inward and dispatch details.
- `components/subplate-form-modal.tsx`, `subplate-dimension-fields.tsx`: the existing form and geometry fields.
- Remaining components own filters, summary cards, menus, purchase notice and quick assignment.
- `model/format-timestamp.ts`: the existing IST timestamp formatter.

All feature files use 2-space indentation. No business rule is shared with a
dashboard form merely because the fields look similar.

Run `npm run test:ui` for isolated browser checks. These supplement actual app checks;
they do not establish production account permissions or external service behavior.

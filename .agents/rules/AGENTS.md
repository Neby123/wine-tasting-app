# Workspace Rules: Wine Tasting App

These rules govern all agent workflows and code generations for the Wine Tasting App.

## Modern Web Guidance v1 Standard
Adhere strictly to Chrome Modern Web Guidance v1 across all frontend code (`src/`):
- **Components & Forms**: Use semantic HTML, native controls, standard `autocomplete` attributes (`current-password`, `name`, etc.), and `:user-invalid` / `:user-valid` validation pseudos.
- **Scrollbars & Theming**: Maintain standard CSS `scrollbar-width` and `scrollbar-color` properties with legacy `@supports not (scrollbar-color: auto)` fallbacks.
- **Motion & Accessibility**: Always honor `prefers-reduced-motion` and pair interactive custom toggles with proper ARIA roles (`role="switch"`, `aria-checked`).
- **Tooling**: Consult `npx modern-web-guidance search/retrieve` for platform patterns and run `npx modern-web-guidance legacy-scan src/ --json` before finalizing code.

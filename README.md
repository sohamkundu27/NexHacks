# NexHacks – Medical prescription conflict check

## Flow

1. **Upload PDF** – User uploads a medical/medication PDF. The server parses it, extracts text, and detects medication names (heuristic). Stored in temporary in-memory storage.
2. **Start call** – User joins a LiveKit video room (uses [LiveKit Cloud](https://cloud.livekit.io)).
3. **STT** – While in the call, a **Prescription listener** (Web Speech API) runs on the doctor’s mic. When it detects prescription-like phrases (e.g. “I’m prescribing X”, “Take metformin”), it extracts the drug name.
4. **Conflict check** – On detection, the app calls `/check-interactions` with the new drug. The server checks it against medications from the PDF using:
   - **Browserbase** (if `BROWSERBASE_API_KEY` and `BROWSERBASE_PROJECT_ID` are set) to scrape drugs.com, or
   - **RxNav** (NIH) as fallback.
5. **Visual indicator** – A banner shows “Checking for drug conflicts…” and then “No conflicts found” or “Potential interaction: …”.

## Env

- **`.env.local`** (or `.env`):  
  - `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` – LiveKit Cloud  
  - `VITE_PUBLIC_LIVEKIT_URL` – e.g. `wss://your-project.livekit.cloud`  
  - `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID` – optional; used for drugs.com scraping. If unset, RxNav is used.

## Run

- **Dev**: `npm run dev` (Vite) and in another terminal `npm start` or `node server.js` (backend on port 3001). Vite proxies `/getToken`, `/upload-pdf`, `/check-interactions`, `/api`, `/health` to the backend.
- **Prod**: `npm run build && npm start` (serves `dist` and API on port 3001). Override with `PORT=3000 npm start` if needed.

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

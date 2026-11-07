Absolutely—you write the code, and I’ll help you work through it. For **Task 1**, keep the goal to a clean monorepo where the three apps start, the website builds with SSR, and the API has a working health check. Assume **npm workspaces** for this setup.

### Do these steps in order

1. **Create your repository and local workspace.** Clone your empty GitHub repo, then from its root initialize npm and Git if needed. Add workspace entries for `apps/*` and `packages/*`, and create:
   ```text
   apps/admin
   apps/website
   apps/api
   packages/contracts
   ```

2. **Scaffold the two Angular apps.** Use Angular CLI to create `admin` and `website` as separate apps under `apps/`. Configure both for routing and SCSS; **enable SSR for `website`**. Skip installing dependencies during scaffolding if you’ll install from the workspace root.

3. **Scaffold the Express API.** Create a TypeScript Express app in `apps/api`. Add a `GET /health` endpoint that returns a simple success response. Don’t build CMS endpoints yet.

4. **Create the contracts package placeholder.** Add a `package.json` and `src/index.ts` under `packages/contracts`. Task 2 will define the actual page and component contracts.

5. **Add workspace basics.** Set up root scripts to run each app and build the workspaces. Add a `.gitignore` for dependencies, build output, and local environment files. Add an `.env.example` with placeholder values only—no real secrets.

6. **Install dependencies and verify each app.** From the repo root, install once. Start the admin and API, then confirm `GET /health` works. Build the public website and verify the build includes its SSR server output.

### Task 1 is done when

- All three applications are in the monorepo and start locally.
- The API health check responds successfully.
- The public website builds with SSR enabled.
- Secrets and generated build files are excluded from Git.

Keep this task to scaffolding; don’t start MongoDB models, authentication, or page rendering yet. Once you’ve pushed it, send me the repository link and I’ll review the setup before we move on.

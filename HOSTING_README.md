# Hosting and API Key Configuration

This application is designed to be hosted on modern static hosting platforms or as part of a larger web application deployment.

## API Key Configuration (Crucial)

The application requires a Gemini API Key to function correctly. This key is accessed via `window.process.env.API_KEY` in the client-side code.

**You must configure the `API_KEY` as an environment variable in your chosen hosting platform's settings.**

The application **does not** read from a `.env` file directly at runtime in the browser. The `index.html` file sets up `window.process.env` and expects `API_KEY` to be injected by the hosting environment.

### How to Set Environment Variables:

-   **Vercel**:
    1.  Go to your Project Settings > Environment Variables.
    2.  Add a new variable with the name `API_KEY` and your actual Gemini API key as the value.
    3.  Ensure it's available for all relevant environments (Production, Preview, Development).

-   **Netlify**:
    1.  Go to Site settings > Build & deploy > Environment.
    2.  Add a new variable with the key `API_KEY` and your actual Gemini API key as the value.

-   **Other Platforms (AWS Amplify, Google Cloud, Azure Static Web Apps, etc.)**:
    *   Consult your hosting provider's documentation for setting environment variables for your frontend deployment. The variable name must be `API_KEY`.

### Example for local development (if using a local server that supports `.env`):

If you were running a local development server that uses a library like `dotenv` (more common for Node.js backends or build tools), you would create a `.env` file in your project root (and add it to `.gitignore`):

```env
# .env (for local development, DO NOT COMMIT if it contains real keys)
API_KEY="YOUR_ACTUAL_GEMINI_API_KEY"
```

**Important**: For client-side deployments, this `.env` file itself is not directly used by the browser. The value from this file (or an equivalent setting) needs to be made available as an environment variable by your build tool or hosting platform, which then makes it accessible as `window.process.env.API_KEY`. The current `index.html` already handles the `window.process.env` setup.

## Build and Deployment

-   This project is set up as a Single Page Application (SPA).
-   The `vercel.json` file is included for easy deployment to Vercel, handling client-side routing rewrites.
-   For other platforms, ensure your server configuration correctly serves `index.html` for all non-asset paths to support client-side routing.

## Security Reminder

-   **Never commit your actual API key directly into your codebase or version control system (Git).**
-   Always use environment variables provided by your hosting platform for sensitive keys in production.
-   The `.env` file, if used locally, should be listed in your `.gitignore` file.
```
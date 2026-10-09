# Record Wall Visualizer

A web application that lets you visualize your Discogs record collection as a wall display. Arrange your vinyl collection in a virtual wall, sort by artist or genre, and share or save the result as an image.

## Features

- Load your Discogs vinyl collection, or try the built-in demo wall without an account
- Arrange records in an 8x4 grid wall display
- Drag and drop records between the wall and the pool
- Sort records by artist or genre
- Save your wall display as an image (without album labels)

## Demo wall

Visitors without a Discogs account can try a demo wall of 96 well-known albums. First-time visitors
are offered it in a welcome dialog; after that it stays one click away in the page header. The
albums are listed in `public/demo/collection.json`, so the demo never contacts Discogs or the
proxy and does not change the remembered username. Cover art is loaded from the
[Cover Art Archive](https://coverartarchive.org/) through the same image proxy as real
collections, and any cover that fails to load falls back to a placeholder. Shuffling, pinning,
rearranging, saving the wall as an image and copying a share link all work as they do for a real
collection, and a demo share link reopens the same arrangement.

The demo is saved and shared under the reserved name `~demo`. Discogs usernames cannot contain a
tilde, so the demo can never overwrite or open a real account's saved wall. If the demo file is
missing or invalid the demo is not offered and loading by username is unaffected.

## Tech Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- DND Kit for drag and drop
- Discogs API integration
- html2canvas for image export

## Development

```bash
# Install dependencies
npm install

# Set environment variables
echo "NEXT_PUBLIC_DISCOGS_PROXY_URL=your_lambda_function_url" > .env.local

# Run development server
npm run dev
```

## Deployment Options

This application supports two deployment modes:

### 1. Static Export (for GitHub Pages, Netlify, etc.)

Static export generates HTML, CSS, and JavaScript files without requiring a Node.js server.

```bash
# Build for static deployment
npm run build:static

# The static files will be in the 'out' directory
# You can serve them locally with:
npm run start
```

### 2. Server-Side Rendering (for Vercel, etc.)

SSR mode enables server-side rendering for enhanced performance and SEO.

```bash
# Build for server-side rendering
npm run build:ssr

# Run the server
npm run start:next
```

## Environment Variables

- `NEXT_PUBLIC_DISCOGS_PROXY_URL`: Public AWS Lambda Function URL used by the frontend to load Discogs collections through the proxy
- `NEXT_PUBLIC_BASE_PATH`: Base path for GitHub Pages deployment (set automatically in CI/CD)
- `NEXT_STATIC_EXPORT`: Set to "true" for static export or "false" for server-side rendering

## CI/CD Deployment

This application is deployed to GitHub Pages at [bradleygolski.com/album-wall](https://bradleygolski.com/album-wall/). On every push to `main`, GitHub Actions deploys the AWS stack, builds the static site, and publishes it with `actions/deploy-pages`. No personal access token is needed.

### AWS Discogs Proxy

The Discogs proxy infrastructure lives under [infra/README.md](infra/README.md).

GitHub Actions deploys the AWS CDK stack by assuming an AWS role through GitHub OIDC. The required repository configuration is:

- repository variable `AWS_DEPLOY_ROLE_ARN`
- repository secret `DISCOGS_PROXY_URL` for PR validation builds
- Settings → Pages → Source set to **GitHub Actions**

The production deploy workflow runs `cd infra && npx cdk deploy --require-approval never`, reads the `DiscogsProxyFunctionUrl` CloudFormation output, and uses that live URL when building the GitHub Pages site.

## Running Locally

```bash
# Development mode
npm run dev

# Production mode (static)
npm run build:static
npm run start

# Production mode (SSR)
npm run build:ssr
npm run start:next
```

Open [http://localhost:3000](http://localhost:3000) (dev) or [http://localhost:3001](http://localhost:3001) (production) with your browser to see the result.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# Record Wall Visualizer

A web application that lets you visualize your Discogs record collection as a wall display. Arrange your vinyl collection in a virtual wall, sort by artist or genre, and export your arrangement to CSV or as an image.

## Features

- Load your Discogs vinyl collection
- Arrange records in an 8x4 grid wall display
- Drag and drop records between the wall and the pool
- Sort records by artist or genre
- Export your arrangement to CSV
- Save your wall display as an image (without album labels)

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
echo "NEXT_PUBLIC_DISCOGS_TOKEN=your_discogs_token" > .env.local

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

- `NEXT_PUBLIC_DISCOGS_TOKEN`: Your Discogs API token (required for accessing the Discogs API)
- `NEXT_PUBLIC_BASE_PATH`: Base path for GitHub Pages deployment (set automatically in CI/CD)
- `NEXT_STATIC_EXPORT`: Set to "true" for static export or "false" for server-side rendering

## CI/CD Deployment

This application is configured for deployment to GitHub Pages. The CI/CD pipeline is set up using GitHub Actions to automatically build and deploy the application when changes are pushed to the main branch.

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

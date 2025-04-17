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

## Deployment

This application is configured for deployment to GitHub Pages. The CI/CD pipeline is set up using GitHub Actions to automatically build and deploy the application when changes are pushed to the main branch.

### Manual Deployment

```bash
# Build for production
npm run build

# The static files will be in the 'out' directory
```

## Environment Variables

- `NEXT_PUBLIC_DISCOGS_TOKEN`: Your Discogs API token (required for accessing the Discogs API)
- `NEXT_PUBLIC_BASE_PATH`: Base path for GitHub Pages deployment (set automatically in CI/CD)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

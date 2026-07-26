import "./globals.css";
export const metadata = { title: "Anupam Outreach", description: "Marketing Command Center — Anupam Paints" };
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎯</text></svg>" /></head>
      <body>{children}</body>
    </html>
  );
}

import "./globals.css";

// The real <html> lives in app/[locale]/layout.tsx so it can carry lang="en" or lang="bn".
// The two pages outside [locale] (the "/" redirect and the 404) render their own <html>.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}

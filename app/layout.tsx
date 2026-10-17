import "@fontsource-variable/onest";
import "@fontsource-variable/geologica";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
export const metadata = {
  title: "Socot — afacerea ta, în echilibru",
  description: "Socot • spațiu financiar pentru afaceri din Moldova",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro">
      <body>{children}</body>
    </html>
  );
}

import "./globals.css";

export const metadata = {
  title: "Doodle Dash",
  description: "Real-time multiplayer drawing & guessing game",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

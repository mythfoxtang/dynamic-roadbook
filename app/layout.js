import "./globals.css";

export const metadata = {
  title: "Into the Plateau // Interactive Roadbook",
  description: "Cyber rally style interactive roadbook from Lijiang to Urumqi."
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

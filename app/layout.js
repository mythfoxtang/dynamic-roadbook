import "./globals.css";

export const metadata = {
  title: "动态路书",
  description: "行程规划与动态路书协同工作台"
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

import "./globals.css";

export const metadata = {
  title: "动态路书",
  description: "从丽江到乌鲁木齐的家庭自驾动态路书。"
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

import Link from "next/link";
import AiSettings from "@/components/ai-settings";
export const metadata = { title: "DeepSeek API 配置 · 行程规划" };
export default function AiSettingsPage() {
  return <main className="min-h-screen bg-[#101715] px-4 py-10 sm:px-6"><div className="mx-auto max-w-3xl"><nav className="mb-6 flex gap-5 text-sm text-white/70"><Link href="/booking/">行程预订</Link><Link href="/planner/">行程规划</Link><Link href="/">首页</Link></nav><AiSettings /></div></main>;
}

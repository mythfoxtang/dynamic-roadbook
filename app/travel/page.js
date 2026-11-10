import Link from "next/link";
import TravelWorkspace from "@/components/travel-workspace";
export const metadata = { title: "机票、高铁、酒店与租车 · 行程预订" };
export default function TravelPage() {
  return <main className="min-h-screen bg-[#101715] px-4 py-7 sm:px-6"><div className="mx-auto max-w-7xl"><nav className="mb-5 flex flex-wrap gap-5 text-sm text-white/65"><Link href="/agent/">DeepSeek 旅行智能体</Link><Link href="/planner/">AI 行程规划</Link><Link href="/booking/">预订任务</Link><Link href="/">首页</Link></nav><TravelWorkspace /></div></main>;
}

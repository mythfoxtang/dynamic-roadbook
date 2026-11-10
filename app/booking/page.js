import Link from "next/link";
import BookingWorkbench from "@/components/booking-workbench";
import AiSettings from "@/components/ai-settings";
import { ROADBOOK_DAYS } from "@/lib/roadtrip-data";

export const metadata = { title: "行程预订 · 机票、酒店与租车" };
export default function BookingPage() {
  return <main className="min-h-screen bg-[#101715] px-4 py-8 sm:px-6"><div className="mx-auto max-w-6xl"><nav className="mb-6 flex flex-wrap gap-5 text-sm text-white/65"><Link href="/">返回首页</Link><Link href="/roadbook/">查看行程</Link><Link href="/settings/ai/">AI 设置</Link><Link href="/planner/">AI 规划</Link><Link href="/travel/" className="text-accent">国内机票与住宿</Link><Link href="/booking/hotels/" className="text-accent">站内酒店试订</Link></nav><details className="mb-5"><summary className="mb-3 cursor-pointer text-sm text-accent">配置 DeepSeek API</summary><AiSettings /></details><BookingWorkbench days={ROADBOOK_DAYS} /></div></main>;
}

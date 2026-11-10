import Link from "next/link";
import HotelTrial from "@/components/hotel-trial";
export const metadata = { title: "站内酒店试订 · LiteAPI 沙盒" };
export default function HotelTrialPage() {
  return <main className="min-h-screen bg-[#101715] px-4 py-8 sm:px-6"><div className="mx-auto max-w-5xl"><nav className="mb-5 flex flex-wrap gap-5 text-sm text-white/70"><Link href="/booking/">行程预订</Link><Link href="/planner/">AI 行程规划</Link><Link href="/">首页</Link></nav><HotelTrial /></div></main>;
}

import Link from "next/link";
import AiSettings from "@/components/ai-settings";
import TripPlannerWorkspace from "@/components/trip-planner-workspace";
export default function PlannerPage() {
  return <><div className="bg-[#101715] px-4 pt-6 sm:px-6"><div className="mx-auto max-w-6xl"><nav className="mb-5 flex gap-5 text-sm text-white/70"><Link href="/booking/">行程预订</Link><Link href="/settings/ai/">AI 设置</Link><Link href="/">首页</Link></nav><AiSettings /><p className="py-4 text-sm leading-7 text-white/60">AI 规划不代表真实价格或库存。机票、酒店和租车请到预订页查询确认。</p></div></div><TripPlannerWorkspace /></>;
}

import Link from "next/link";
import { ArrowRight, Route } from "lucide-react";

export default function PlannerPage() {
  return (
    <main className="planner-shell min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-4xl items-center px-4 py-10 sm:px-6">
        <section className="planner-hero w-full rounded-[32px] border border-white/10 px-5 py-8 sm:px-8">
          <div className="text-[11px] uppercase tracking-[0.28em] text-white/55">Static Publish</div>
          <h1 className="mt-5 text-3xl font-semibold leading-tight text-white sm:text-4xl">
            公开版先保留动态路书
          </h1>
          <p className="mt-4 text-sm leading-7 text-white/70 sm:text-base">
            行程规划里的酒店、机票和模型探针依赖后端服务。为了让国内静态托管网址稳定访问，公开版暂时关闭规划助手入口，核心路书、地图、照片、预订清单和本地执行状态仍可使用。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/roadbook/" className="inline-flex items-center gap-2 rounded-full border border-[#e3b56e]/35 bg-[#e3b56e]/12 px-5 py-3 text-sm text-[#f2cf9a] transition hover:bg-[#e3b56e]/18">
              去看动态路书
              <Route className="h-4 w-4" />
            </Link>
            <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-5 py-3 text-sm text-white/78 transition hover:bg-white/12">
              回到首页
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

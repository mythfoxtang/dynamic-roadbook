import Link from "next/link";
import { ArrowRight, Compass, Map, Route, Sparkles } from "lucide-react";

const MODULES = [
  {
    title: "行程规划",
    kicker: "NEXT MODULE",
    href: "/planner",
    description: "从需求采集、节奏收敛到逐日草案，先把旅行计划共同搭起来，再进入执行。",
    points: ["采集用户偏好与约束", "生成可协商的行程骨架", "沉淀为正式路书输入"],
    accent: "from-[#ecd8b1] via-[#d89a52] to-[#6d4026]",
    icon: Compass
  },
  {
    title: "动态路书",
    kicker: "LIVE MODULE",
    href: "/roadbook",
    description: "承接已生成的路线，按天查看地图、执行进度、照片和分享信息。",
    points: ["现有 28 天家庭自驾路书", "地图、时间和 AI 工作台", "直接进入当天执行视图"],
    accent: "from-[#b8d0bc] via-[#698f79] to-[#24372c]",
    icon: Route
  }
];

const JOURNEY_STEPS = [
  { label: "1", title: "先定旅行框架", text: "目的地、天数、预算、同行人和节奏要求先收敛成可执行边界。" },
  { label: "2", title: "共同生成行程", text: "围绕住宿锚点、跨城顺序和每日强度生成第一版草案。" },
  { label: "3", title: "进入动态路书", text: "确认行程后切到路书模块，接地图、照片、执行和分享。" }
];

export default function ModuleHub() {
  return (
    <main className="hub-shell min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-[1440px] flex-col px-4 py-5 sm:px-6 lg:px-8">
        <section className="hub-hero overflow-hidden rounded-[32px] border border-white/10 px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
          <div className="grid gap-8 xl:grid-cols-[1.1fr,0.9fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-white/70">
                <Sparkles className="h-4 w-4 text-[#f1c17a]" />
                Dynamic Travel Workspace
              </div>
              <h1 className="mt-6 max-w-[12ch] text-4xl font-semibold leading-[1.02] text-white sm:text-5xl lg:text-6xl">
                先共同规划
                <br />
                再进入路书执行
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-white/72 sm:text-lg">
                入口页只放两个模块。左边把新的行程规划立起来，右边继续接现在已经完成的动态路书，产品路径会更清楚。
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/planner" className="inline-flex items-center gap-2 rounded-full border border-[#e3b56e]/35 bg-[#e3b56e]/12 px-5 py-3 text-sm text-[#f2cf9a] transition hover:bg-[#e3b56e]/18">
                  进入行程规划
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/roadbook" className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/7 px-5 py-3 text-sm text-white/80 transition hover:bg-white/10">
                  查看动态路书
                  <Map className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="grid gap-4">
              {JOURNEY_STEPS.map((step) => (
                <article key={step.label} className="panel-soft rounded-[28px] p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-white/8 text-sm font-semibold text-white">
                      {step.label}
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-white">{step.title}</div>
                      <p className="mt-2 text-sm leading-7 text-white/66">{step.text}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-2">
          {MODULES.map((module) => {
            const Icon = module.icon;
            return (
              <article key={module.title} className="module-card relative overflow-hidden rounded-[30px] border border-white/10 p-[1px]">
                <div className={`absolute inset-0 bg-gradient-to-br ${module.accent} opacity-90`} />
                <div className="relative h-full rounded-[29px] bg-[#120f0ddd] p-6 sm:p-7">
                  <div className="flex items-start justify-between gap-5">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.28em] text-white/45">{module.kicker}</div>
                      <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">{module.title}</h2>
                    </div>
                    <div className="rounded-2xl border border-white/12 bg-white/8 p-3 text-white/78">
                      <Icon className="h-6 w-6" />
                    </div>
                  </div>

                  <p className="mt-5 max-w-xl text-sm leading-7 text-white/70 sm:text-base">{module.description}</p>

                  <div className="mt-6 grid gap-3">
                    {module.points.map((point) => (
                      <div key={point} className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white/78">
                        {point}
                      </div>
                    ))}
                  </div>

                  <div className="mt-7 flex items-center justify-between gap-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-white/42">Module Entry</div>
                    <Link href={module.href} className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/8 px-4 py-2.5 text-sm text-white transition hover:bg-white/12">
                      打开模块
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}

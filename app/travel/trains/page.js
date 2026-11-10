import Link from 'next/link';
import TravelWorkspace from '@/components/travel-workspace';
export const metadata={title:'高铁火车 · 行程预订'};
export default function TrainsPage(){return <main className="min-h-screen bg-[#101715] px-4 py-7 sm:px-6"><div className="mx-auto max-w-7xl"><nav className="mb-5 flex gap-5 text-sm text-white/65"><Link href="/travel/">全部预订</Link><Link href="/planner/">行程规划</Link><Link href="/">首页</Link></nav><TravelWorkspace initialKind="train"/></div></main>;}

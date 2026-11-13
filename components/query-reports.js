'use client';
import {useEffect,useState} from 'react';
export default function QueryReports(){
 const [reports,setReports]=useState([]);
 useEffect(()=>{
  try{setReports(JSON.parse(localStorage.getItem('roadbook-query-reports')||'[]'));}catch{}
  const receive=e=>setReports(old=>{const next=[e.detail,...old].slice(0,50);try{localStorage.setItem('roadbook-query-reports',JSON.stringify(next));}catch{}return next;});
  window.addEventListener('query-report',receive);return()=>window.removeEventListener('query-report',receive);
 },[]);
 return <details><summary>查询测试报告（{reports.length}）</summary><p>每次规划、确认和查价都会自动生成独立 Markdown 报告；点击下载可反馈具体问题。</p>{reports.map(r=><p key={r.url}><a href={r.url} download>{r.time} · {r.ok?'请求成功':'请求失败'} · 下载测试情况.md</a></p>)}</details>;
}

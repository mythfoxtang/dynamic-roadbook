export async function reportedFetch(...args){
 const response=await fetch(...args);
 const url=response.headers.get('X-Query-Report');
 if(url)window.dispatchEvent(new CustomEvent('query-report',{detail:{url,time:new Date().toLocaleString('zh-CN'),ok:response.ok}}));
 return response;
}

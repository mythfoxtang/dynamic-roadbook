import {carProviderStatus} from './travel-car.mjs';
export function travelSourceCatalog(env=process.env){
 const tuniu=Boolean(env.TUNIU_API_KEY&&!env.TUNIU_API_KEY.startsWith('your_'));
 return [
  {id:'tuniu-flight',kind:'flight',name:'国内机票',state:tuniu?'configured':'needs_auth',notice:tuniu?'途牛已配置；可查询、翻页、读取舱位':'需要供应商授权'},
  {id:'tuniu-hotel',kind:'hotel',name:'酒店',state:tuniu?'configured':'needs_auth',notice:tuniu?'途牛已配置；可查询、翻页、读取房型':'需要供应商授权'},
  {id:'tuniu-train',kind:'train',name:'高铁／火车',state:tuniu?'configured':'needs_auth',notice:tuniu?'途牛已配置；支持15天预售期内成人车次与席别查询':'需要供应商授权'},
  {id:'car',kind:'car',name:'自驾租车',state:carProviderStatus(env).connected?'configured':'needs_auth',notice:carProviderStatus(env).connected?'已配置合作网关，正式覆盖以实际查询为准':'真实货源尚未授权，当前仅可规划取还车条件'},
  {id:'attraction',kind:'attraction',name:'景区预约',state:'not_connected',notice:'已识别需求；尚未接入实时门票或预约库存'},
  {id:'liteapi-sandbox',kind:'hotel',name:'LiteAPI 酒店试订',state:'sandbox',href:'/booking/hotels/',notice:'独立沙盒入口；可搜索、验价与模拟试订，仅支持1间房1成人，不扣款、不能入住；不会混入正式候选'},
  {id:'duffel',kind:'flight',name:'Duffel 机票备用接口',state:env.DUFFEL_ACCESS_TOKEN?'configured':'needs_auth',href:'/booking/',notice:'独立查询入口；需配置授权Token，环境与实际覆盖以返回结果为准，尚未并入智能体自动查询'}
 ];
}

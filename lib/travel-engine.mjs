import { randomUUID } from "node:crypto";
import { TravelError, validateTravelSearch, normalizeHotels, normalizeFlights, normalizeHotelRooms, normalizeCabins, publicTravelValue, requiredText } from "./travel-core.mjs";
import { callTuniu } from "./tuniu-transport.mjs";
import { accountOwner, getTravelTools } from "./travel-account.mjs";
import { readTravelPrivate, writeTravelPrivate } from "./travel-vault.mjs";
import { validateTravelPassenger } from "./travel-people.mjs";
import { validateTrainSearch, normalizeTrains, normalizeTrainSeats, safeTrainOrderSummary } from "./travel-train.mjs";
const int = (v, fallback = 1) => Number.isInteger(Number(v)) && Number(v) > 0 && Number(v) <= 1000 ? Number(v) : fallback;

export class TravelEngine {
  constructor({ call = callTuniu, tools = getTravelTools, now = Date.now, initialOrders = [], persistOrders = () => {} } = {}) { Object.assign(this, { call, tools, now, persistOrders }); this.searches = new Map(); this.cache = new Map(); this.orders = new Map(initialOrders); }
  listOrders(credential) { return [...this.orders.values()].filter((o) => o.owner === accountOwner(credential)).map((o) => o.receipt).reverse(); }
  persist() { this.persistOrders([...this.orders]); }
  cleanup() {
    for (const [id, s] of this.searches) if (this.now() - s.updatedAt > 30 * 60000 && !s.busy) this.searches.delete(id);
    for (const [key, id] of this.cache) if (!this.searches.has(id)) this.cache.delete(key);
  }
  publicSearch(s, cached = false) {
    return publicTravelValue({ id: s.id, provider: "途牛官方账号", source: "live", kind: s.query.kind, query: s.query, queriedAt: new Date(s.queriedAt).toISOString(), lastUpdatedAt: new Date(s.updatedAt).toISOString(), cached,
      loadedPages: s.loadedPages, totalPages: s.totalPages, complete: s.totalPages !== null && s.loadedPages >= s.totalPages, count: s.offers.size, offers: [...s.offers.values()], warnings: s.warnings,
      coverage: s.totalPages === null ? `已读取 ${s.loadedPages} 页，供应商未给出有效总页数，无法确认覆盖完整度` : s.loadedPages >= s.totalPages ? "已读取本次供应商查询声明的全部分页，不代表全市场库存" : `仅读取 ${s.loadedPages}/${s.totalPages} 页，可继续加载，不代表完整结果`, paymentMode: "supplier_checkout" });
  }
  owned(id, credential) {
    const s = this.searches.get(id);
    if (!s || s.owner !== accountOwner(credential)) throw new TravelError("搜索记录不存在、已过期或不属于当前账号，请重新查询", 404, "SEARCH_NOT_FOUND");
    return s;
  }
  searchArgs(q, page = 1, search) {
    if (q.kind === "train") {
      if (page > 1) { if (!search.queryId) throw new TravelError("未返回车次分页标识，不能继续加载",409,"MISSING_PAGE_TOKEN"); return {queryId:search.queryId,pageNum:page}; }
      return {departureCityName:q.from,arrivalCityName:q.to,departureDate:q.date,searchType:q.mode,...(q.departureTime?{departureTime:q.departureTime}:{}),...(q.arrivalTime?{arrivalTime:q.arrivalTime}:{})};
    }
    if (q.kind === "hotel") {
      if (page > 1) { if (!search.queryId) throw new TravelError("供应商未给出翻页标识，不能伪造下一页", 409, "MISSING_PAGE_TOKEN"); return { queryId: search.queryId, pageNum: page }; }
      return { cityName: q.city, checkIn: q.startDate, checkOut: q.endDate, adultNum: q.adults, childNum: q.children, ...(q.children ? { childAges: q.childAges } : {}), ...(q.keyword ? { keyword: q.keyword } : {}), ...(q.poi ? { poiName: q.poi } : {}), ...(q.minPrice !== null || q.maxPrice !== null ? { prices: `${q.minPrice ?? 0}-${q.maxPrice ?? 100000}` } : {}) };
    }
    return { departureCityName: q.from, arrivalCityName: q.to, departureDate: q.date,
      ...(q.mode !== "LOWEST" ? { searchType: q.mode } : {}), ...(q.mode === "TIME" && q.departureTime ? { departureTime: q.departureTime } : {}), ...(q.mode === "TIME" && q.arrivalTime ? { arrivalTime: q.arrivalTime } : {}),
      ...(q.mode === "PRICE" ? { priceRange: `${q.minPrice ?? 0}-${q.maxPrice ?? 100000}` } : {}), ...(page > 1 ? { pageNum: page } : {}) };
  }
  async appendPage(s, credential, page) {
    const result = await this.call(credential, s.query.kind, "search", this.searchArgs(s.query, page, s), s.tools);
    const rows = s.query.kind === "hotel" ? result.hotels : result.data;
    if (!Array.isArray(rows)) throw new TravelError("供应商未返回完整的列表结构，无法确认是否无库存", 502, "INVALID_LIST");
    if (s.query.kind === "hotel") {
      const cityKey = (value) => String(value || "").trim().replace(/[市县]$/, "");
      const expected = cityKey(s.query.city), resolved = result.cityInfo?.cityName || s.resolvedCity;
      // Diqing's official administrative table lists these three subordinate cities/counties.
      // Tuniu resolves the requested city correctly in cityInfo but labels hotel rows by prefecture.
      const parent = { 香格里拉: "迪庆", 德钦: "迪庆", 维西: "迪庆" }[expected];
      const wrong = resolved && cityKey(resolved) !== expected ? resolved : rows.find((h) => h.cityName && cityKey(h.cityName) !== expected && !(resolved && cityKey(resolved) === expected && parent && cityKey(h.cityName) === parent))?.cityName;
      if (wrong) throw new TravelError(`供应商把“${s.query.city}”解析成了“${String(wrong).slice(0, 40)}”，已拒绝展示异地报价。请核实城市名称或选择其他货源。`, 502, "CITY_MISMATCH");
      s.resolvedCity = resolved;
    }
    const offers = s.query.kind === "hotel" ? normalizeHotels(result, s.query) : s.query.kind === "train" ? normalizeTrains(result,s.query) : normalizeFlights(result, s.query);
    const totalPages = int(result.totalPageNum, s.totalPages);
    for (const offer of offers) {
      const key = offer.kind === "hotel" ? offer.supplierId : [offer.supplierId, offer.departureTime, offer.departureAirport || offer.departureStation, offer.arrivalAirport || offer.arrivalStation].join("|");
      if (!s.dedupe.has(key)) { s.offers.set(offer.id, offer); s.dedupe.add(key); }
    }
    s.queryId = result.queryId || s.queryId; s.totalPages = totalPages === null ? null : Math.max(page, totalPages); s.loadedPages = page; s.updatedAt = this.now();
    if (!offers.length && page < s.totalPages) s.warnings.push(`第 ${page} 页未返回有效条目，后续页尚未读取。`);
  }
  async search(body, credential, refresh = false) {
    this.cleanup();
    const query = body.kind === "train" ? validateTrainSearch(body) : validateTravelSearch(body);
    const owner = accountOwner(credential), cacheKey = JSON.stringify([owner, query]);
    const prior = this.searches.get(this.cache.get(cacheKey));
    if (!refresh && prior && this.now() - prior.queriedAt < 120000) return this.publicSearch(prior, true);
    if (this.searches.size >= 200) throw new TravelError("搜索会话过多，请稍后重试", 429);
    const tools = await this.tools(credential, query.kind);
    const s = { id: randomUUID(), owner, query, tools, offers: new Map(), dedupe: new Set(), quotes: new Map(), loadedPages: 0, totalPages: null, queriedAt: this.now(), updatedAt: this.now(), warnings: [], busy: true };
    await this.appendPage(s, credential, 1); s.busy = false;
    this.searches.set(s.id, s); this.cache.set(cacheKey, s.id);
    return this.publicSearch(s);
  }
  async next(id, credential, count = 1) {
    const s = this.owned(id, credential);
    if (s.busy) throw new TravelError("上一页尚未完成，请稍候", 409);
    s.busy = true;
    try {
      const limit = Math.min(3, Math.max(1, Number(count) || 1));
      let added = 0;
      for (; added < limit && s.loadedPages < s.totalPages; added++) {
        try { await this.appendPage(s, credential, s.loadedPages + 1); }
        catch (error) { if (!added) throw error; s.warnings.push(error.message); break; }
      }
      return this.publicSearch(s);
    } finally { s.busy = false; }
  }
  async detail(searchId, offerId, credential, refresh = false) {
    const s = this.owned(searchId, credential), offer = s.offers.get(offerId);
    if (!offer) throw new TravelError("该酒店或航班不属于本次搜索", 404);
    const cached = [...s.quotes.values()].find((q) => q.offerId === offerId && this.now() - q.createdAt < 60000 && q.state === "ready");
    if (!refresh && cached) return publicTravelValue(cached);
    if (s.busy) throw new TravelError("当前查询尚未完成，请稍候", 409);
    s.busy = true;
    try {
      const q = s.query;
      const args = q.kind === "train" ? {departureStationName:offer.departureStation,arrivalStationName:offer.arrivalStation,departureDate:q.date,trainNum:offer.supplierId} : q.kind === "hotel" ? { hotelId: Number(offer.supplierId), checkIn: q.startDate, checkOut: q.endDate, roomNum: q.rooms, adultNum: q.adults, childNum: q.children, ...(q.children ? { childAges: q.childAges } : {}) }
        : { departureCityName: q.from, arrivalCityName: q.to, departureDate: q.date, flightNo: offer.supplierId };
      const result = await this.call(credential, q.kind, "detail", args, s.tools);
      const options = q.kind === "hotel" ? normalizeHotelRooms(result, q) : q.kind === "train" ? normalizeTrainSeats(result,q,offer) : normalizeCabins(result, q);
      const detail = { id: randomUUID(), offerId, kind: q.kind, title: offer.name, createdAt: this.now(), expiresAt: this.now() + 5 * 60000, query: q, state: "ready", options,
        policies: q.kind === "hotel" ? result.policies || {} : {}, flightInfo: q.kind === "flight" ? result.flightInfo || [] : [], priceNotice: q.kind === "train" ? "每位成人所选席别票价；服务费与整单金额以官方订单确认为准。当前仅成人票，默认不接受无座，不自动购买服务包。" : q.kind === "hotel" ? "此处为官方详情原始报价。多人、多房、多晚的总额须在供应商验价／支付页面确认，不自行换算。" : "每位成人含税参考价；儿童票价和最终多人金额以供应商验价为准。" };
      s.quotes.set(detail.id, detail); return publicTravelValue(detail);
    } finally { s.busy = false; }
  }
  async requirements(searchId, credential) {
    const s = this.owned(searchId, credential);
    if (s.query.kind !== "flight") return { text: "酒店需按每间房填写入住人姓名和联系人手机号，最终必填字段由供应商确认。" };
    if (!s.requirements) s.requirements = await this.call(credential, "flight", "requirements", {}, s.tools);
    return { text: typeof s.requirements.text === "string" ? s.requirements.text : JSON.stringify(s.requirements) };
  }
  async book(body, credential) {
    const s = this.owned(body.searchId, credential), quote = s.quotes.get(body.quoteId);
    const option = quote?.options.find((o) => o.id === body.optionId);
    if (!quote || !option) throw new TravelError("报价不属于本次查询，请重新选择", 404);
    if (quote.receipt) return quote.receipt;
    if (quote.state !== "ready") throw new TravelError("上次交易尚在处理或结果未知，请勿重复创单", 409, "ORDER_UNCERTAIN");
    if (quote.expiresAt <= this.now()) throw new TravelError("报价已过期，请刷新房型或舱位后再次确认", 409, "QUOTE_EXPIRED");
    if (body.confirmed !== true) throw new TravelError("请先核对价格、退改与乘客资料并明确确认提交未支付订单");
    if (option.price === null) throw new TravelError("报价未提供有效数字价格，不允许提交订单", 409, "UNKNOWN_PRICE");
    const contactName = requiredText(body.contactName, "联系人姓名", 50), contactPhone = requiredText(body.contactPhone, "联系人手机号", 20);
    if (!/^1\d{10}$/.test(contactPhone)) throw new TravelError("请填写中国大陆 11 位联系人手机号");
    const q = s.query, offer = s.offers.get(quote.offerId);
    let args;
    if (q.kind === "train") {
      if (option.seats !== null && Number(option.seats) < q.adults) throw new TravelError("所选席别明确余票不足，请重新查询",409,"INSUFFICIENT_STOCK");
      if (q.children || !Array.isArray(body.tourists) || body.tourists.length !== q.adults) throw new TravelError("当前仅支持成人票，乘车人数必须与查询一致");
      if (option.standing && body.acceptStandingTicket !== true) throw new TravelError("无座席别必须单独确认接受无座",400,"STANDING_CONFIRMATION_REQUIRED");
      const tourists=body.tourists.map((p)=>{const person=validateTravelPassenger({...p,type:"成人"},q.date,contactPhone); if(!["身份证","护照"].includes(person.idType)) throw new TravelError("当前火车票接口仅支持身份证或护照"); const birth=person.idType==="身份证"?`${person.idNumber.slice(6,10)}-${person.idNumber.slice(10,12)}-${person.idNumber.slice(12,14)}`:person.birthday; const cutoff=new Date(q.date);cutoff.setUTCFullYear(cutoff.getUTCFullYear()-14); if(birth>cutoff.toISOString().slice(0,10)) throw new TravelError("未满14周岁乘客请通过支持儿童票的官方流程购票"); return {name:person.name,psptType:person.idType==="身份证"?1:2,psptId:person.idNumber,isStuDisabledArmyPolice:0,tel:contactPhone};});
      args={resources:[{resourceId:Number(option.bookingParam),departsDate:option.departureDate,adultPrice:option.price}],adultTourists:tourists,contact:{tel:contactPhone},acceptStandingTicket:option.standing && body.acceptStandingTicket===true};
    } else if (q.kind === "hotel") {
      if (option.capacity !== null && option.capacity * q.rooms < q.adults + q.children) throw new TravelError("所选房型标注的可住人数不足，请调整房间数或房型", 409, "INSUFFICIENT_CAPACITY");
      if (/^\d+$/.test(option.stock) && Number(option.stock) < q.rooms) throw new TravelError("当前明确房量不足，请重新查房", 409, "INSUFFICIENT_STOCK");
    } else if (/^\d+$/.test(option.seats) && Number(option.seats) < q.adults + q.children) throw new TravelError("当前明确余票少于乘机人数，请重新选择舱位", 409, "INSUFFICIENT_STOCK");
    if (q.kind === "hotel") {
      if (!Array.isArray(body.roomGuests) || body.roomGuests.length !== q.rooms || body.roomGuests.some((r) => !Array.isArray(r.guests) || !r.guests.length)) throw new TravelError("请为每间房填写至少一位入住人");
      const roomGuests = body.roomGuests.map((r) => ({ guests: r.guests.map((g) => ({ firstName: requiredText(g.firstName, "入住人名", 50), lastName: requiredText(g.lastName, "入住人姓", 50) })) }));
      args = { hotelId: offer.supplierId, roomId: option.supplierRoomId, preBookParam: option.bookingParam, checkInDate: q.startDate, checkOutDate: q.endDate, roomCount: q.rooms, roomGuests, contactName, contactPhone };
    } else if (q.kind === "flight") {
      if (!s.requirements) throw new TravelError("请先获取并阅读官方机票预订须知", 409);
      if (!Array.isArray(body.tourists) || body.tourists.length !== q.adults + q.children) throw new TravelError("乘机人数必须与查询条件一致");
      const tourists = body.tourists.map((p) => validateTravelPassenger(p, q.date, contactPhone));
      if (tourists.filter((p) => p.type === "成人").length !== q.adults) throw new TravelError("成人和儿童类型必须与查询人数一致");
      args = { departureCityName: q.from, arrivalCityName: q.to, departureDate: q.date, flightNo: offer.supplierId, cabinPriceId: option.bookingParam, tourists, contactTourist: { name: contactName, mobile: contactPhone } };
    }
    if (s.busy) throw new TravelError("前一项请求尚未完成", 409);
    s.busy = true; quote.state = "submitting";
    const intent = { owner: s.owner, receipt: { id: randomUUID(), kind: q.kind, provider: "途牛", title: quote.title, status: "submitting", createdAt: new Date(this.now()).toISOString() } };
    try {
      this.orders.set(intent.receipt.id, intent); this.persist();
      const result = await this.call(credential, q.kind, "book", args, s.tools);
      if (!result.orderId) throw new TravelError("供应商未返回订单号，结果未知，请勿重新提交", 502, "ORDER_UNCERTAIN");
      const pay = result.paymentUrl || result.payUrl || result.orderDetailUrl;
      let paymentUrl = null;
      if (pay) { try { const url = new URL(pay); if (url.protocol === "https:" && (url.hostname === "tuniu.com" || url.hostname.endsWith(".tuniu.com")) && !url.username && !url.password) paymentUrl = url.href; } catch { /* Never expose unsafe checkout URLs. */ } }
      const receipt = Object.assign(intent.receipt, { supplierOrderId: String(result.orderId), status: "created_unpaid", paymentUrl, notice: "供应商已返回订单号。尚未确认支付、出票或酒店确认；请到官方订单页面核对最终金额及状态。" });
      quote.receipt = receipt; quote.state = "created_unpaid";
      try { this.persist(); } catch { receipt.notice += " 本地记录未能保存，请立即记下官方订单号。"; }
      return receipt;
    } catch (error) { quote.state = "unknown"; intent.receipt.status = "unknown"; try { this.persist(); } catch {} throw error; }
    finally { s.busy = false; }
  }
  async cancelOrder(body, credential) {
    const record = this.orders.get(body.orderId);
    if (!record || record.owner !== accountOwner(credential)) throw new TravelError("订单不属于当前账号", 404);
    if (body.confirmed !== true) throw new TravelError("请明确确认取消该未支付机票订单");
    const receipt = record.receipt;
    if(receipt.kind==='train') {
      if(receipt.status!=='created_unpaid')throw new TravelError('当前订单已处理或状态需核实，请先同步官方状态',409);
      if(record.cancelBusy)throw new TravelError("取消申请正在处理中，请勿重复操作",409);
      record.cancelBusy=true;
      try {
        const synced=await this.syncOrder({orderId:body.orderId},credential);
        if(![1,2].includes(synced.providerPayCode)||synced.providerStatus!=='待付款')throw new TravelError("官方状态不是待付款，不能按未支付订单取消；已支付订单请在官方办理退改",409,"ORDER_NOT_UNPAID");
        const trainTools=await this.tools(credential,'train');
        receipt.status='cancellation_submitting';this.persist();
        try{const result=await this.call(credential,'train','cancel',{orderId:Number(receipt.supplierOrderId)},trainTools);receipt.status=result.successCode===true?'cancelled_unpaid':'cancellation_pending';receipt.providerStatus=result.successCode===true?'已取消':receipt.providerStatus;receipt.notice='仅申请取消未支付火车票订单，不代表已退款；最终状态可重新同步官方订单。';this.persist();return receipt;}
        catch(e){receipt.status='cancellation_unknown';try{this.persist();}catch{}throw e;}
      }finally{record.cancelBusy=false;}
    }
    if (receipt.kind !== "flight" || receipt.status !== "created_unpaid") throw new TravelError("当前只支持向供应商申请取消本项目创建的未支付机票订单", 409);
    const tools = await this.tools(credential, "flight");
    receipt.status = "cancellation_submitting"; this.persist();
    try {
      const result = await this.call(credential, "flight", "cancel", { orderId: receipt.supplierOrderId }, tools);
      receipt.status = result.successCode === true ? "cancelled_unpaid" : "cancellation_pending";
      receipt.notice = "此处只处理未支付订单取消，不代表退款。供应商官方订单页是最终状态依据。";
      this.persist(); return receipt;
    } catch (error) { receipt.status = "cancellation_unknown"; try { this.persist(); } catch {} throw error; }
  }
  async syncOrder(body, credential) {
    const record=this.orders.get(body.orderId);
    if (!record || record.owner!==accountOwner(credential)) throw new TravelError("订单不属于当前账号",404);
    const receipt=record.receipt;
    if(receipt.kind!=="train" || !receipt.supplierOrderId || !Number.isSafeInteger(Number(receipt.supplierOrderId))) throw new TravelError("当前仅支持同步本项目创建的高铁订单",409);
    const tools=await this.tools(credential,"train");
    const result=await this.call(credential,"train","order",{orderId:Number(receipt.supplierOrderId)},tools);
    if(result.data?.orderId && String(result.data.orderId)!==receipt.supplierOrderId)throw new TravelError('返回订单与当前订单不一致',502,'ORDER_ID_MISMATCH');
    Object.assign(receipt,safeTrainOrderSummary(result));
    if(![1,2].includes(receipt.providerPayCode)||receipt.providerStatus!=='待付款')receipt.status='provider_reported';
    this.persist(); return receipt;
  }
}
export const travelEngine = globalThis.__travelEngine || (globalThis.__travelEngine = new TravelEngine({ initialOrders: readTravelPrivate("orders", []), persistOrders: (value) => writeTravelPrivate("orders", value) }));

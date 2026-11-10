export function numericPrice(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  const text = String(value).trim().replace(/^[¥￥]\s*/, "").replace(/,/g, "");
  const n = Number(text);
  return /^\d+(\.\d+)?$/.test(text) && Number.isFinite(n) ? n : null;
}
function timeOf(value) { return String(value || "").match(/(?:^|\s|T)(\d{2}:\d{2})/)?.[1] || ""; }
export function filterTravelOptions(options, f = {}, kind = "hotel") {
  return options.filter((o) => {
    if (f.maxPrice !== "" && f.maxPrice != null && (o.price === null || o.price > Number(f.maxPrice))) return false;
    if (f.refundable && (!/免费取消|可.*取消|可退/.test(o.refund) || /不可|不退|不支持|无法|不能|非免费/.test(o.refund))) return false;
    if (kind === "hotel") {
      if (f.bed && !o.bed.includes(f.bed)) return false;
      if (f.breakfast && (!/含.*早|[一二双单2]早|早餐/.test(o.meal) || /无早|不含/.test(o.meal))) return false;
      if (f.capacity && (o.capacity === null || o.capacity < Number(f.capacity))) return false;
    } else {
      if (f.cabin && !o.name.includes(f.cabin)) return false;
      if (f.baggage && (!/免费[^。；;]*[1-9]\d*\s*(kg|公斤|千克)/i.test(o.baggage) || /无免费|不含|不提供/.test(o.baggage))) return false;
    }
    return true;
  }).sort((a, b) => a.price === null ? b.price === null ? 0 : 1 : b.price === null ? -1 : a.price - b.price);
}
export function filterTravelOffers(offers, f = {}) {
  const filtered = offers.map(o=>o.kind==='train'&&f.seat?{...o,price:o.seats.find(s=>s.code===f.seat&&s.remaining!==0)?.price??null}:o).filter((o) => {
    if (f.minPrice !== "" && f.minPrice != null && (o.price === null || o.price < Number(f.minPrice))) return false;
    if (f.maxPrice !== "" && f.maxPrice != null && (o.price === null || o.price > Number(f.maxPrice))) return false;
    if (f.keyword && ![o.name, o.brand, o.address, o.area].join(" ").toLowerCase().includes(String(f.keyword).toLowerCase())) return false;
    if (o.kind === "hotel") {
      if (f.category && o.stars !== f.category) return false;
      if (f.brand && !o.brand.includes(f.brand)) return false;
      if (f.minRating && (o.rating === null || o.rating < Number(f.minRating))) return false;
      if (f.breakfast && (!/含.*早|[一二双单2]早|早餐/.test(o.meal) || /无早|不含|不包含/.test(o.meal))) return false;
      if (f.refundable && (!/可.*取消|免费取消|可退/.test(o.refund) || /不可|不退|不支持|无法|不能|非免费/.test(o.refund))) return false;
      if (f.window && (!/有窗|外窗|明窗|可开窗|落地窗/.test(o.window) || /无窗|封闭/.test(o.window))) return false;
      if (f.parking && !o.facilities.some((v) => /停车/.test(v) && !/无停车|不提供/.test(v))) return false;
    } else if (o.kind === "train") {
      if (f.highSpeedOnly && !o.highSpeed) return false;
      if (f.departureStation && o.departureStation !== f.departureStation) return false;
      if (f.arrivalStation && o.arrivalStation !== f.arrivalStation) return false;
      const time=timeOf(o.departureTime);
      if (f.departAfter && (!time || time<f.departAfter)) return false;
      if (f.departBefore && (!time || time>f.departBefore)) return false;
      if (f.seat && !o.seats.some(s=>s.code===f.seat && s.remaining!==0)) return false;
      if ((f.availableOnly||f.minSeats) && !o.seats.some(s=>s.remaining!==null && s.remaining>=Number(f.minSeats||1) && (!f.seat || s.code===f.seat))) return false;
    } else {
      if (f.directOnly && o.type !== "直飞") return false;
      if (f.airline && o.airline !== f.airline) return false;
      if (f.departureAirport && o.departureAirport !== f.departureAirport) return false;
      if (f.arrivalAirport && o.arrivalAirport !== f.arrivalAirport) return false;
      const time = timeOf(o.departureTime);
      if (f.departAfter && (!time || time < f.departAfter)) return false;
      if (f.departBefore && (!time || time > f.departBefore)) return false;
      if (f.minSeats && (!/^\d+$/.test(o.seats) || Number(o.seats) < Number(f.minSeats))) return false;
    }
    return true;
  });
  return filtered.sort((a, b) => {
    if (f.sort === "rating") return (b.rating ?? -1) - (a.rating ?? -1);
    if (f.sort === "departure") return a.departureTime.localeCompare(b.departureTime);
    if (a.price === null) return b.price === null ? 0 : 1;
    if (b.price === null) return -1;
    return f.sort === "priceDesc" ? b.price - a.price : a.price - b.price;
  });
}

export function filterCarOffers(offers,filters={}) {
  return offers.filter(o=>(!filters.maxTotal||o.totalAmount<=Number(filters.maxTotal))&&(!filters.minSeats||(o.seats!==null&&o.seats>=Number(filters.minSeats)))&&(!filters.automatic||o.transmission==='自动')&&(!filters.unlimitedMileage||o.unlimitedMileage===true)&&(!filters.category||o.category===filters.category)&&(!filters.provider||o.provider===filters.provider)).sort((a,b)=>filters.sort==='priceDesc'?b.totalAmount-a.totalAmount:a.totalAmount-b.totalAmount);
}

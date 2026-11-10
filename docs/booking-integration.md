# 行程预订接入

入口：`/booking/`，或首页的「预订」标签。沿用当前行程生成酒店、机票、租车任务，点击「带入条件查询」后修改日期、地点和成人数。

## 当前可以做什么

- 机票、酒店、租车共用查询表单；服务端校验日期、人数与地点。
- 通过携程官方页面搜索、下单和付款，再回填订单确认号。本地状态是用户记录，不是平台核验结果。
- 配置 Duffel 后，可查询单程经济舱机票。支持部分中文城市和任意三位 IATA 代码。返回的报价总额覆盖所填成人数，保留原币种，不自动换算人民币。
- 配置自有供应商适配网关后，可以显示酒店、租车及机票报价。正式报价包含白名单内的结算链接时，可跳转该供应商确认预订。
- 查询失败、无库存、未配置接口、测试环境、过期报价都有明确提示；不会生成模拟价格。
- 支持保存候选和手动记录订单。候选与订单只保存在当前浏览器，不收集证件或银行卡，不自动下单、不自动同步订单。

**尚未完成的真实能力：** 当前没有携程/同程授权，也没有验证真实价格、区域库存、订单创建、支付或出票。Duffel 适配器只提供查询，不提供报价对应的结算链接。携程首页链接是平台入口，不保证带入搜索条件。后续接到授权后，需要按合作方提供的文档实现网关、验价、订单、支付与订单同步。

## 启动与配置

需要 Node.js 服务端，纯静态托管无法运行 API。在 `.env.local` 配置后重启：

```sh
npm install
npm run dev
# 或生产运行
npm run build
npm run start
```

默认端口 3000；可执行 `npx next dev -p 3010` 使用其他端口。不要把 token 放入 `NEXT_PUBLIC_` 变量。

```dotenv
DUFFEL_ACCESS_TOKEN=从Duffel后台获得的令牌

# 三类产品统一使用自有网关；配置后优先于 Duffel
BOOKING_GATEWAY_URL=https://your-authorized-adapter.example/api
BOOKING_GATEWAY_TOKEN=你的网关访问令牌
BOOKING_CHECKOUT_HOSTS=checkout.your-approved-provider.example
```

网关 URL 与 token 必须同时配置。配置状态表示已填写参数，连接与权限在查询时检验。测试令牌的响应 `live_mode: false` 会始终标为测试数据。未配置时返回 503，可继续通过携程网页预订。

`STATIC_EXPORT=1` 仅保留旧静态导出选项；现有动态 API 路由无法直接静态导出，需要单独部署后端并调整请求地址。不应使用纯静态模式部署当前预订功能。

## 供后续 AI / 网关调用的契约

`GET /api/bookings/providers` 返回三类接口配置状态，不返回密钥。

`POST /api/bookings/search` 请求：

```json
{"kind":"flight","from":"上海","to":"昆明","date":"2027-06-27","adults":2}
```

```json
{"kind":"hotel","city":"丽江古城","startDate":"2027-06-27","endDate":"2027-06-29","adults":2}
```

```json
{"kind":"car","city":"丽江","returnCity":"昆明","startDate":"2027-06-27","endDate":"2027-06-29","adults":2}
```

租车按日期搜索，取还车时间、驾驶员年龄、车型、保险、异地还车费需要供应商结算时确认；酒店默认未指定房数和儿童，不能直接生成最终订单。机票目前仅成人单程经济舱。日期按 Asia/Shanghai 校验，不能早于当天。

服务器将规范化请求原样 POST 到 `${BOOKING_GATEWAY_URL}/search`，带 `Authorization: Bearer <BOOKING_GATEWAY_TOKEN>`。这是本项目定义的适配协议，**不是携程官方 API 协议**。网关需在服务端完成合作方签名、城市/酒店 ID 映射、库存查询和授权转换。

网关响应示例（仅协议示例，不能作为真实报价）：

```json
{
  "provider": "你的供应商名称",
  "liveMode": false,
  "offers": [{
    "id": "supplier-offer-id",
    "title": "房型 / 航班 / 车型名称",
    "description": "退改、行李、早餐、保险等具体条件",
    "amount": 1000,
    "currency": "CNY",
    "priceBasis": "2 位成人、1 间房、2 晚含税总价",
    "expiresAt": "2027-06-01T10:00:00Z",
    "checkoutUrl": "https://checkout.your-approved-provider.example/session/123"
  }]
}
```

必须返回 `provider`、布尔类型 `liveMode` 和 `offers` 数组，金额必须是非负 JSON 数字。`priceBasis` 应说明每晚、每天或总价、税费和人数。服务端最多展示 50 条报价，不跨币种排序。结算 URL 只允许 HTTPS、无用户名密码且主机名与 `BOOKING_CHECKOUT_HOSTS` 完全一致；测试环境不返回结算链接。没有结算链接的报价只能保存候选，不冒充可下单商品。

成功响应另包含 `query`、`kind`、`searchedAt`、`notice`；旧入口 `/api/flight-price-probe`、`/api/hotel-price-probe` 现在返回同一结构，不再返回原网页抓取的 minPrice/risk 等摘要。

验证命令：`node --test lib/booking-service.test.mjs lib/duffel-flight-provider.test.mjs scripts/flight-monitor.test.mjs`。启动本地服务后，可运行 `node scripts/booking-ui.smoke.mjs http://127.0.0.1:3010` 检查浏览器流程；该脚本的成功报价使用明确标记的测试响应，不调用供应商，不执行订单或支付。截图写入 `.automation/booking-desktop.png` 和 `.automation/booking-mobile.png`。测试结束关闭独立浏览器上下文，不会改动用户当前浏览器的本地记录。

请求和响应禁止缓存。接口设置 35 秒超时、请求大小限制和单进程每分钟 20 次查询限制。公开上线前需要增加账户、按用户限流与供应商预算控制；当前内存限流不跨进程共享。跨站 Origin 会被拒绝，服务端客户端可不提供 Origin。未接入任何 AI 平台，后续 AI 可以生成上述查询参数，用户仍需在平台确认实际预订。

## 官方接入入口（2026-11-09 核查）

- [携程 / Trip.com 开放平台](https://connect.trip.com/)
- [携程合作渠道](https://pages.ctrip.com/public/dlhz.htm)
- [同程开放平台](https://union.ly.com/zhuanti/open/index.html)
- [Duffel 机票报价 API](https://duffel.com/docs/api/v2/offer-requests/create-offer-request)

需向对应平台确认分销资格、产品覆盖、授权和结算方式。供应商入驻 API 与向旅客售卖产品的分销 API 不是同一业务角色，不能直接互换。

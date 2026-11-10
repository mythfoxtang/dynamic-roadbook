# 站内酒店试订（已实际调用供应商沙盒）

入口 `/booking/hotels/`。在同一页面完成查询 → 选择房型 → 供应商验价 → 核对测试入住人和规则 → 确认模拟付款 → 查看供应商订单结果。没有外部网页跳转，没有银行卡表单。

## 已验证与范围

2026-11-09 实际使用 LiteAPI 官方文档公布的共享沙盒 Key 调用接口：

- 上海地点查询成功，但所试日期的房价查询没有可售结果，未伪造库存。
- 巴黎样例查询、验价、模拟付款及创建订单成功。首次服务端测试订单 `KD-yZg1eI`，供应商状态 `CONFIRMED`，沙盒确认码 `test`。
- 该测试不是本地模拟响应。它是供应商测试环境返回的订单，**未扣款、不能入住**。

目前页面限制为 1 间房、1 位成人、最多 14 晚。保留原始 USD 币种，分别展示报价之外的税费。排除供应商标记的 package-only 房价，不能把机酒套餐价作为独立房价售卖。金额以验价结果为准，取消政策或餐食变更会提示重新确认。

测试用虚拟姓名 Sandbox Test、邮箱 booking-test@example.com；请勿填写真实证件、银行卡或其他敏感资料。

## 住宿筛选

新增每晚房价上限（默认 500）、CNY/USD/EUR 币种、2/3/4/5 星及以下或不限、只看可退款、只看含早餐、价格升降序。默认人民币、3 星及以下、低价优先；预算可留空，未标星酒店仅在星级不限时展示。

星级数组 `starRating`、`refundableRatesOnly`、早餐 `boardType: BI` 和报价币种直接提交供应商。未使用供应商文档没有提供的价格字段；服务端对返回金额按每晚预算进一步筛选。预算比较整单房价除以入住晚数，**不含报价之外的另付税费**；供应商如果返回不同币种则报错，不自行换汇。

每次从最多 100 家供应商候选中筛选、为每家保留最低的符合条件房型，再按价格排序并取最多 30 家。不再先截取前 12 个房型，也不让同一酒店的多个房型挤满列表。该结果不保证覆盖全城所有可售酒店。修改条件后必须重新查询才能选房或下单；空结果会提示放宽预算等条件，不自动扩大星级范围。

实测巴黎样例（2027-01-15 至 2027-01-16）3 星及以下、CNY 1000 每晚内返回 2 星/3 星酒店；CNY 500 预算无结果。测试报价随供应商变化，不能作为正式价格承诺。

## API

`POST /api/hotel-trial/` 的 action：

- `search`：city、startDate、endDate；在供应商处解析城市，再查询该城市原始房价。
- `prebook`：offerId（只能来自当前会话返回的报价标识）。
- `book`：prebookId（本站验价标识）、firstName、lastName、email、confirmed: true。

`GET /api/hotel-trial/`：读取当前会话的搜索、验价与订单记录，用于刷新恢复。会话在服务端内存保存 30 分钟，浏览器只有 HttpOnly 随机会话 Cookie。服务重启后会话丢失，不作为生产订单数据库。不会把沙盒订单写为真实行程已预订。

服务端保存供应商 offer/prebook 和固定 clientReference，不信任前端金额。会话并发互斥，成功订单重复提交返回原结果。交易超时或未知结果不自动重试，锁定重复提交。未知/待确认订单尚未实现完整的供应商对账、退款和异步确认管理，生产上线前需要补齐。

## 配置与正式支付

不用申请账号即可先使用官方公开共享沙盒 Key 试流程。共享 Key 可能有配额限制或失效，可在 `.env.local` 配置自己的 `LITEAPI_SANDBOX_KEY=sandbox_...`，重启服务。所有供应商请求仅在后端发起。

**此入口明确拒绝 prod_ 等生产 Key**，模拟付款使用官方沙盒 `ACC_CREDIT_CARD` 方法。本实现没有正式扣款能力，不应仅换 Key 就上线。

正式上线仍需自有账号及产品授权、确认目标地区库存，接入站内 Payment SDK/支付控件、支付状态核验、持久化订单、异步确认与退改。官方 Payment SDK 支持在本站嵌入表单并返回本站回调页；银行卡验证如涉及 3DS，仍可能需要银行认证，不能承诺所有支付方法绝不发生认证跳转。本页当前没有接入该 SDK，因此不能把模拟付款视为正式支付验证。

机票和租车尚未打通站内下单；此页先验证酒店这一个垂直流程。

## 验证

```sh
node --test lib/liteapi-hotel.test.mjs
node scripts/hotel-trial.live-smoke.mjs http://127.0.0.1:3010
node scripts/hotel-filters.smoke.mjs http://127.0.0.1:3010
```

浏览器脚本会真实调用供应商沙盒并创建一张模拟订单，不使用 mock，不调用正式支付。截图在 `.automation/hotel-trial-*.png`。不要把脚本指向正式交易实现。

官方依据：[接入样例与公开沙盒 Key](https://docs.liteapi.travel/reference/prompt-for-vibe-coding-tools)、[房价查询](https://docs.liteapi.travel/reference/post_hotels-rates)、[验价](https://docs.liteapi.travel/reference/post_rates-prebook)、[沙盒付款与下单](https://docs.liteapi.travel/reference/post_rates-book)。

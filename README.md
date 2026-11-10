# 动态路书

DeepSeek 旅行智能体：`/agent/`。交代确定行程，由 DeepSeek 分析预订需求、自动执行机酒查询、比较实际候选；只需选择房型／舱位。支持配置加密恢复、自动等待限流、候选和选择恢复；选择不会创单。[真实测试结果、数据缺口与 Git 同步说明](docs/deepseek-agent-validation.md)。

新增：高铁 `/travel/trains/` 与自驾租车 `/travel/cars/`，统一入口 `/travel/`。[高铁、租车与工作唤醒验证说明](docs/train-car-and-awake.md)记录真实接口覆盖、租车授权依赖、测试与Windows唤醒边界。

国内机票与住宿正式查价入口：`/travel/`。支持途牛官方服务端 Key / 个人账号授权、中文城市与日期查询、多页结果、预算和条件筛选、候选比较、房型／舱位详情、用户确认的未支付订单提交。路书预订任务可以带入查询条件；过去的日期需要先修改。

最新真实数据测试及支付限制：[国内机票与住宿实测验收](docs/domestic-travel-validation.md)。途牛当前付款使用官方订单页，本站尚未取得独立支付、支付后状态同步与售后闭环权限。

测试：`npm.cmd run test:travel`；浏览器测试：`npm.cmd run test:travel:ui`（默认测试本机 3012 端口，使用 fixture）；真实只读验证会消耗供应商每日额度，见验收文档。

一个给家里人直接看的自驾动态路书页面。

特点：

- 28 天路线时间线
- 当日里程、海拔、疲劳指数
- 高德在线地图，可选
- 高德不可用时自动退回离线底图
- 本地图片资源，不依赖 Google Fonts

## 本地启动

```bash
npm install
npm run dev
```

默认地址：

- 本机：`http://localhost:3000`
- 局域网：`http://你的局域网IP:3000`

行程预订入口：`http://localhost:3000/booking/`，支持机票、酒店和租车查询表单、平台跳转、候选保存及订单手动记录。真实报价需要配置授权接口，详见 [预订接口接入说明](docs/booking-integration.md)。预订 API 需要 Node.js 服务端部署。

DeepSeek 配置入口：`http://localhost:3000/settings/ai/`，在「DeepSeek API Key」框填写密钥并点击「保存并检测连接」。也可在预订页展开配置框。详见 [DeepSeek 配置说明](docs/deepseek-setup.md)。

站内酒店试订：`http://localhost:3000/booking/hotels/`，使用 LiteAPI 官方沙盒完成搜索、验价、模拟付款与订单确认，不跳转外部网页；未扣款、不能入住。详见 [已验证范围与正式支付差距](docs/hotel-trial.md)。

因为脚本已经绑定到 `0.0.0.0`，所以同一 Wi-Fi 下的手机也能直接打开。

## 生产启动

```bash
npm run build
npm run start
```

## 高德地图配置

如果要启用高德在线地图，在 `.env.local` 里配置：

```bash
NEXT_PUBLIC_AMAP_KEY=你的高德Web端Key
NEXT_PUBLIC_AMAP_SECURITY_CODE=你的高德安全密钥
```

如果不配：

- 页面仍然可正常访问
- 地图区域会自动使用离线备用底图

## 部署建议

优先顺序：

1. 你自己的服务器或家宽 DDNS
2. 同一局域网临时访问
3. 国内静态托管

不建议继续用：

- `cloudflared quick tunnel`
- `localhost.run`
- `localtunnel`

这些方案适合临时调试，不适合长期发给家里人。

## 你最终只需要做的事

1. 选一个可长期访问的位置部署这个项目
2. 如果要在线地图，就把高德 Key 配上
3. 如果买了域名，就把域名解析到你的部署地址

## 相关文件

- 分享方案说明：`SHARE_GUIDE.md`
- 路线数据：`lib/roadtrip-data.js`
- 地点信息：`lib/place-data.js`

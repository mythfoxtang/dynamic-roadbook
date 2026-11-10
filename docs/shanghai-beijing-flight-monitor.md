# 上海 → 北京机票价格试点

这个试点固定比较上海 → 北京（`SHA → BJS`）同一天、同一乘客人数、同一来源的报价。每次成功记录后在本机保存价格快照，并在下次记录时输出最低价变化。它是手动触发的监控原型，尚无后台定时任务或提醒。

## 无 API 凭据：手动记录真实报价

先在购票网站查询上海 → 北京指定日期的报价，再把实际看到的价格记录下来：

```powershell
$actualPrice = Read-Host "请输入你在购票页面看到的总价（元）"
npm.cmd run monitor:flight -- --date 2026-11-14 --adults 1 --price $actualPrice --source 携程
```

可另外附上 `--flight 航班号 --url 报价页面网址`。再次查询后用同样的日期、人数和来源执行一次，就会显示与上次记录相比的差额。手动记录会明确标为 `manual:携程`，不会冒充自动获取的实时报价。

## 有 API 凭据：自动查询

Duffel 注册入口：[app.duffel.com/join](https://app.duffel.com/join)。完成注册后，在 Dashboard 的 **More → Developers → Access tokens** 中，切换到 **Developer test mode** 并创建测试 token。将其填入项目的 `.env.local`：

```dotenv
DUFFEL_ACCESS_TOKEN=你的测试_token
```

测试 token 通常以 `duffel_test_` 开头，测试价格和航班时刻不能用于真实购票决策。要获取真实报价，需要完成 Duffel 的账户激活和身份 / 企业验证，在 Live mode 创建 live token，并替换同一个环境变量。是否覆盖上海—北京航线应以实际查询结果为准。不要将 token 放到前端、聊天或 Git 仓库。

## 查询和比较

```powershell
npm.cmd run monitor:flight -- --date 2026-11-14 --adults 1
```

再次运行同一命令，即可看到与上一次成功报价的价格差额。快照保存在 `.automation/flight-monitor/shanghai-beijing.json`；查询失败或没有报价时不会写入价格。显示的是记录时的报价，购买前仍需在供应商处重新确认价格和余票。

项目当前使用 Next.js 静态导出，这个脚本在本机运行，不会随公开静态站点自动执行。

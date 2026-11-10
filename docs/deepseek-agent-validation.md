# DeepSeek 旅行智能体

入口：`http://localhost:3012/agent/`。本轮使用 2026-11-16 至 11-21 的用户原文作为真实测试输入。

## 工作方式

1. DeepSeek 读取原文，输出逐日安排、机票／住宿／租车／预约任务、工具查询参数、查价假设和风险。
2. 程序校验日期连续性、住宿重叠和工具参数，执行模型识别出的查询任务。没有 DeepSeek 时明确报错，不用固定模板或 Qwen 替代。
3. 自动排队执行真实途牛机酒和已配置租车接口；供应商分钟限流时等待重试，失败项单独保留，其他任务继续。
4. DeepSeek 比较本次实际返回的候选，给出最多三个推荐及理由。程序检查推荐 ID 是否来自该任务，拒绝虚构候选。
5. 用户只选择候选及实际房型／舱位，汇总到“我的选择”。选择本身不会创单、支付或被标记为已预订。

原文示例仅在输入框；预期拆解不参与生产执行。`lib/travel-agent.test.mjs` 使用其他城市、其他年份验证模型提供输出。完整基准：6天、3段航班、4段酒店共5晚、宜昌取车恩施还车、3个景区预约需求。

## 真实覆盖与缺口

DeepSeek `deepseek-flash` 实际完成分析和候选推荐。途牛返回：上海→宜昌3个候选、宜昌酒店5家、恩施酒店7家、北京酒店7家、北京→上海10个航班。只读取首页，不能代表全市场库存或完整结果；供应商 POI 不保证酒店在景区附近。

- 奉节县住宿被供应商解析为重庆，已拒绝展示。不能以重庆市区酒店替代三峡之巅附近住宿。
- 恩施→北京本次首页查询无结果，不代表当天所有航班都不存在，也不能保证游完大峡谷后可飞北京。
- 租车尚无正式货源授权；门票和预约尚无实时接口。已识别需求不等于已经接入库存。
- 人数、房间数、驾驶人年龄和取还车时刻为 DeepSeek 明确列出的查价假设；未收集真实旅客证件，未创建任何真实订单。
- 不将每成人机票价、酒店起价和多晚房型价混加为预算。

证据（仅本机，Git忽略）：`.automation/agent-live-plan.json`、`.automation/agent-live-results.json`，以及 desktop/mobile 截图。脚本 `scripts/agent-live-readonly.mjs` 使用本地加密会话，不输出 Key，禁止创单与取消。

## 配置恢复

DeepSeek 配置按浏览器会话加密存放于 `.automation/travel-private/ai-sessions.enc`，浏览器仅接收 HttpOnly 随机会话ID。新保存会话最长30天；旧会话保留原有效期。密钥和本机加密材料均被 Git 忽略；服务重启可恢复，会话到期或浏览器清除 Cookie 后仍需重新连接。加密文件和加密密钥同机存放，不防御本机账号失陷。

## Git检查

实际仓库是工作区下的 `动态路书开发中/` 子目录，外层目录本身不是仓库。GitHub连接器确认仓库 `mythfoxtang/dynamic-roadbook` 具有 pull/push 权限，远端main原版本为 `67f6a42d2df3e65379a977f9fde4c4448bfdea2a`。

最初执行账号无法读取旧SSH私钥，HTTPS直连也超时。后续已在本机生成新的配对密钥，由用户在GitHub添加公钥并授权写入；仓库本地配置改用 `ssh.github.com:443`，固定核对GitHub官方主机密钥，真实fetch及push预检已通过。`scripts/sync-git.ps1 -Push` 会推送已提交内容并再次fetch、比对本地与远端commit，不关闭主机校验、不强推，也不自动提交额外文件。配置和私钥不提交到仓库。

服务现采用独立后台守护进程，健康检查、子进程自动重启、旧候选重新查价及限流恢复详见 [本地服务说明](local-service.md)。

项目约定通知渠道已检查：微信为登录窗口，无法向文件传输助手发送阻塞通知；未尝试重复发送。

## 验证命令

`node --test lib/travel-agent.test.mjs lib/ai-config.test.mjs lib/travel.test.mjs lib/travel-vault.test.mjs lib/travel-expansion.test.mjs`

`node scripts/agent-ui.smoke.mjs` 为明确标记fixture的浏览器交互验证。

`npm.cmd run build` 验证生产构建。真实只读脚本消耗供应商额度，勿反复运行。

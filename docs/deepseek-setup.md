# DeepSeek 官方 API 配置

打开 `/settings/ai/`，或在 `/booking/` 展开「配置 DeepSeek API」，也可以在 `/planner/` 顶部直接配置。

1. 在「DeepSeek API Key」输入框粘贴你在 DeepSeek 官方平台创建的密钥。
2. 默认模型 `deepseek-flash`，也可以填写官方账号可用的模型，例如 `deepseek-v4-pro`。
3. 点击「保存并检测连接」。服务端请求官方 `/models` 接口验证密钥及所填模型，不发送生成请求。模型列表成功不保证余额充足，实际调用时会提示余额或权限错误。
4. 保存后打开「行程规划」，或使用路书中的「AI 行程助手」。这两个助手均读取同一项配置。

官方地址固定为 `https://api.deepseek.com`，浏览器仅向本项目后端提交密钥，不会直接请求第三方代理。

同源检查优先采用浏览器发送的 `Sec-Fetch-Site: same-origin`，兼容反向代理改写内部主机名与协议；不提供该标识的请求按实际 Host、协议和端口校验。跨站请求仍被拒绝，不直接信任 `X-Forwarded-Host`。依据：[W3C Fetch Metadata](https://www.w3.org/TR/fetch-metadata/)。

网页配置加密保存于本机 Git 忽略的 `.automation/travel-private/ai-sessions.enc`，新会话最长30天；旧会话仍按原有效期。浏览器只接收 HttpOnly 随机会话 ID，不接收密钥，不写入 localStorage、sessionStorage 或日志。服务重启可恢复；会话到期、清除浏览器 Cookie 或清除配置后需要重新连接。各浏览器会话隔离。当前本地单进程部署可用，多进程/多实例部署需要共享且支持并发更新的会话存储。

需要长期配置时，在项目 `.env.local` 中填写：

```dotenv
DEEPSEEK_API_KEY=你的真实密钥
DEEPSEEK_MODEL=deepseek-flash
```

然后重启网站服务。不要加 `NEXT_PUBLIC_` 前缀，不要提交 `.env.local`。网页会话配置优先于 DeepSeek 环境变量；没有 DeepSeek 配置时兼容原 DashScope 环境变量。清除网页配置不会删除环境变量。

`/agent/` 的 DeepSeek 会识别用户确定行程、产生查询参数并比较供应商返回的真实候选；程序执行只读查价工具，不将模型文字当库存。选择结果会恢复到当前会话，不自动创单。原 `/planner/` 继续支持行程规划。无密钥、模型错误、余额不足或网络失败时明确提示，不将本地规则包装成模型成功响应。

验证：`node --test lib/ai-config.test.mjs`；浏览器验证脚本 `node scripts/ai-settings.smoke.mjs http://127.0.0.1:3010`。自动化使用明确标记的测试响应验证表单交互，未使用用户真实密钥。

官方依据（2026-11-09 核查）：[首次 API 调用](https://api-docs.deepseek.com/)、[模型列表](https://api-docs.deepseek.com/api/list-models/)、[Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/)。模型以账号实际返回的列表为准。

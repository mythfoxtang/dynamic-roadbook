# 临时公网测试入口

2026-11-11，使用已安装的 cpolar 3.3.18，将本机 127.0.0.1:3010 暴露为临时 HTTPS 网址。选择 cn 地区，仅转发网站，管理界面没有暴露。公网入口启用 cpolar 自带 Basic Auth，原 localhost 入口不变。

## 使用

在项目目录执行 `npm.cmd run share:status`。最新网址、测试账号与访问口令也保存在本机 `.automation/cpolar/测试访问信息.txt`，只分享给受邀测试者。该文件不包含 cpolar authtoken。

网站与 cpolar 都在后台运行，不需要保持终端或聊天窗口打开。电脑必须开机、联网且不能休眠。免费网址会变化，每次重新连接后用 status 获取新地址，不能将该方案当成永久托管。

- 停止对外访问：`npm.cmd run share:stop`，保留本机网站服务。
- 重新开放：先确认 `npm.cmd run service:status` 正常，再运行 `npm.cmd run share:start`，稍后运行 `npm.cmd run share:status`。
- 检查网站服务：`npm.cmd run service:status`。

使用项目独立配置，不改写用户默认 cpolar 配置，也不停止其他 cpolar 服务。cpolar 路径默认 D:/cpolar.exe，迁移时可设置 CPOLAR_BIN。配置、访问口令、进程信息与日志均在 Git 忽略的 .automation/cpolar 内。账号凭据不通过进程命令行参数传递，HTTP 请求检查已关闭。

## 已验证与限制

通过真实公网 HTTPS 网址验证：匿名页面和 AI 配置 API 返回401；登录后页面及配置API返回200，两种模式按钮可用；真实 DeepSeek 通过公网请求生成3天昆明草案，修改意见框和确认按钮可见，手机布局无横向溢出，无页面脚本错误。没有创建或支付订单。

浏览器测试显式使用 --no-proxy-server 禁用浏览器代理。未独立验证系统级路由或其他运营商网络，也没有代替用户实际测试手机流量；朋友首次使用时应关闭代理，以其实际网络确认访问效果。免费中转带宽有限，首次页面加载可能较慢。DeepSeek及供应商额度仍由当前服务器配置承担。

`npm.cmd run test:share` 会做真实公网和真实模型验证，消耗少量模型用量，不查询供应商库存。证据在 .automation/cpolar/verification.json、public-desktop.png、public-mobile.png。

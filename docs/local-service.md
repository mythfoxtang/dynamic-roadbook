# 本地服务常驻与恢复

入口固定为 `http://localhost:3010/agent/`，服务只监听 `127.0.0.1`。不需要保持 PowerShell 窗口打开。

```powershell
npm.cmd run service:build
npm.cmd run service:start
npm.cmd run service:status
```

启动器创建独立隐藏后台守护进程。守护进程监测自己启动的 Next.js 子进程，异常退出会重新启动；健康检查连续失败也会重启自己的子进程。重复启动不会创建第二个实例。

停止：`npm.cmd run service:stop`。更新代码后执行 `npm.cmd run service:build`、`npm.cmd run service:restart`。每次构建放在独立的 `.next-service-时间戳/`，成功后才更新本机发布记录，不覆盖正在使用的构建。停止指令只发送给本实例，不按端口终止其他进程。日志与PID记录在 `.automation/service/`，运行文件均被 Git 忽略。

这提供本机开机且守护进程存活期间的持续服务，没有安装 Windows 系统服务或开机任务。电脑关机、休眠或系统终止守护进程后，需再次启动。不要把仅本机地址当作互联网地址。

服务重启会丢失供应商的临时搜索会话，但已保存的行程和选择仍可恢复。点击旧候选时会自动重新查询同一酒店或航班，按供应商身份重新获取房型／舱位；搜索和详情阶段的分钟限流都会自动等待，超过重试上限或每日额度不足会明确提示。原候选未出现在最新结果时，不自动替换为其他酒店／航班。

## Git 恢复结果

2026-11-10，本机生成新配对密钥，用户在 GitHub 添加公钥并开启写权限。使用仓库本地 `core.sshCommand` 通过 `ssh.github.com:443` 连接，固定核对 GitHub 官方 Ed25519 主机公钥，不关闭主机验证。

私钥与known_hosts保存在 `.automation/git-auth/`，不提交。此前的 `.deploy_keys/` 文件没有被覆盖。Git 拉取、推送权限预检及提交同步使用 `scripts/sync-git.ps1`；该脚本沿用已配置的仓库SSH命令，不改全局Git配置、不强推。

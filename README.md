# 动态路书

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

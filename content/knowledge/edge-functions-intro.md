---
title: 边缘函数入门
description: 了解 EdgeOne 边缘函数的基本概念和使用方法
tags: [EdgeOne, 边缘计算, Serverless]
category: 技术文档
published: 2026-01-20
author: Admin
---

## 边缘函数简介

边缘函数是运行在 EdgeOne 边缘节点上的 Serverless 函数，可以在离用户最近的节点执行自定义逻辑，实现超低延迟响应。

## 使用场景

- **A/B 测试**：在边缘节点进行流量分配，无需修改后端代码
- **请求重写**：动态修改请求 URL、Header 等
- **访问控制**：实现 IP 黑名单、地域限制等安全策略
- **缓存策略**：根据业务需求自定义缓存规则

## 基本示例

```javascript
export default function(request) {
  const url = new URL(request.url);
  if (url.pathname === '/api/hello') {
    return new Response(JSON.stringify({ message: 'Hello from Edge!' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return fetch(request);
}
```

## 部署方式

通过 EdgeOne 控制台或 CLI 工具部署边缘函数，支持版本管理和灰度发布。

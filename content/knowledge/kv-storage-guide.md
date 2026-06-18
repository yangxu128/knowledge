---
title: KV 存储使用指南
description: EdgeOne KV 存储服务的使用方法和最佳实践
tags: [EdgeOne, 存储, 数据库]
category: 技术文档
published: 2026-02-01
author: Admin
---

## KV 存储概述

EdgeOne KV 是一个全球分布式的键值存储服务，专为边缘计算场景设计，提供低延迟的数据读写能力。

## 基本操作

### 写入数据

```javascript
await KV.put('user:123', JSON.stringify({ name: '张三', role: 'admin' }));
```

### 读取数据

```javascript
const value = await KV.get('user:123');
const user = JSON.parse(value);
```

### 删除数据

```javascript
await KV.delete('user:123');
```

## 最佳实践

- 使用命名空间前缀组织键名（如 `user:`, `cache:`, `config:`）
- 设置合理的 TTL 过期时间
- 利用列表操作管理集合数据
- 在边缘函数中直接访问 KV，避免回源

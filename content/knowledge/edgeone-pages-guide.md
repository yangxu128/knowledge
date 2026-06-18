---
title: EdgeOne Pages 部署指南
description: 介绍如何使用 EdgeOne Pages 快速部署前端应用
tags: [EdgeOne, 部署, 前端]
category: 技术文档
published: 2026-01-15
author: Admin
---

## 什么是 EdgeOne Pages

EdgeOne Pages 是腾讯云推出的边缘计算静态站点托管服务，能够将你的前端应用部署到全球边缘节点，实现毫秒级响应。

## 快速开始

### 1. 创建项目

在 EdgeOne 控制台创建新项目，选择对应的框架模板，一键初始化。

### 2. 配置构建

支持主流前端框架：Next.js、Astro、Vue、React 等。自动识别框架并配置构建命令。

### 3. 自动部署

连接 Git 仓库后，每次推送自动触发构建和部署。支持预览环境和生产环境分离。

## 自定义域名

在项目设置中绑定自定义域名，EdgeOne 会自动配置 SSL 证书和 CDN 加速。

## 性能优势

- 全球 2800+ 边缘节点
- 自动 HTTPS 和 HTTP/3
- 智能缓存策略
- 实时日志和监控

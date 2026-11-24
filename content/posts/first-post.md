---
title: "第一篇文章：为什么又开始写博客"
date: 2026-11-24T09:25:00-07:00
draft: false
tags: ["随笔"]
categories: []
summary: "Hugo 和 GitHub。"
---

## 这次的技术选择

| 环节 | 方案 | 理由 |
| --- | --- | --- |
| 写作 | Markdown 文件 | 纯文本，二十年后还打得开 |
| 生成 | Hugo | 单个可执行文件，构建不到 1 秒 |
| 托管 | GitHub Pages | 免费，不用管服务器 |
| 部署 | GitHub Actions | `git push` 即上线 |
| 评论 | giscus | 基于 GitHub Discussions，不需要数据库 |

整个站点的构建产物只有几百 KB，没有数据库，没有后台

## 一个代码块测试

```python
def hello():
    print("hello, blog")
```

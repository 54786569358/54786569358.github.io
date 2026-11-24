---
title: "怎么写：所有花样的用法都在这一页"
date: 2026-11-23T23:30:00+08:00
draft: false
tags: ["用法"]
math: true
ShowToc: true
---

这一页是写给自己的说明书 —— 过三个月忘了怎么写提示框，回来看这里就行。

## 提示框

```
{{</* note "标题可省略" */>}}
正文，支持 markdown
{{</* /note */>}}
```

四种颜色：

{{< note "说明" >}}
这是个 note，蓝色。适合补充一句背景。
{{< /note >}}

{{< tip "提示" >}}
这是个 tip，绿色。适合写"其实有更简单的办法"。
{{< /tip >}}

{{< warning "注意" >}}
这是个 warning，橙色。适合写"这里容易踩坑"。
{{< /warning >}}

{{< danger "警告" >}}
这是个 danger，红色。适合写"干了就会出事"。
{{< /danger >}}

## 折叠

```
{{</* details "点开看看" */>}}
藏在里面的内容
{{</* /details */>}}
```

{{< details "点开看看" >}}
里面可以放任何东西，包括代码块和列表。

- 一
- 二
{{< /details >}}

## 公式

只要在这篇文章的 front matter 里写 `math: true`，然后：

行内：$E = mc^2$，块级：

$$
\int_{-\infty}^{\infty} e^{-x^2}\,dx = \sqrt{\pi}
$$

## 图表

用 mermaid 代码块：

```mermaid
graph LR
  A[写 markdown] --> B[git push]
  B --> C[Actions 构建]
  C --> D[Pages 上线]
```

## 嵌入视频

B 站（填 BV 号）：

```
{{</* bilibili BV1GJ411x7h7 */>}}
```

{{< bilibili BV1GJ411x7h7 >}}

YouTube（填视频 ID）：

```
{{</* youtube dQw4w9WgXcQ */>}}
```

{{< youtube dQw4w9WgXcQ "标题可选" >}}

## 音乐播放器

每行一首，格式 `曲名 | 音频直链`：

```
{{</* music */>}}
SoundHelix 1 | https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3
SoundHelix 2 | https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3
{{</* /music */>}}
```

{{< music >}}
SoundHelix 1 | https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3
SoundHelix 2 | https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3
{{< /music >}}

## 天气

```
{{</* weather "天津" */>}}
```

{{< weather "天津" >}}

## 键盘按键

用 `<kbd>` 包起来：<kbd>Ctrl</kbd> + <kbd>K</kbd> 打开搜索，<kbd>Esc</kbd> 关掉。

## 还有几个不在这页的

- **相册**：图片丢进 `content/gallery/`，页面里写 `{{</* gallery */>}}`
- **友链**：`content/links.md` 里用 `{{</* friends */>}}`，每行 `名字 | 链接 | 描述`
- **微语**：`content/moments/` 下新建 md，比文章更随意
- **用 Issue 发文章**：仓库里开个 issue，打个 `post` 标签，正文就是文章内容

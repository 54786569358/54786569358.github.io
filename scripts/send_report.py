#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Send a one-off progress report for the weather page rebuild.

Run inside GitHub Actions (secrets QQ_USER / QQ_PASS / MAIL_TO are injected);
can also be executed locally with those environment variables set.
"""
import os
import smtplib
import ssl
from email.header import Header
from email.mime.text import MIMEText
from email.utils import formataddr, formatdate

SITE = "https://54786569358.github.io"
PAGE = SITE + "/weather/"


def build_html(mail_to: str) -> str:
    rows = [
        ("桌面端排版", "主容器放宽到 1180px，主温度 3.6rem，七天预报 7 列等宽，地图高度 480px，不再挤在两栏里。"),
        ("四个环形统计图", "湿度 / 云量 / 降水概率 / 紫外线，用 conic-gradient 画圆环，降水≥50% 转橙、≥80% 转红，UV≥6 转橙、≥8 转红。"),
        ("实时数据 12 格", "体感、露点、气压、风向、风速、阵风、能见度、降水量、日出、日落、观测时间、云量；固定 6 列 × 2 行，任何宽度都不留半行。"),
        ("六个图层各自成卡", "风向与流场 / 卫星云图 / 云量 / 降雨雷达 / 气温 / 海浪，点哪张卡，下面的大地图就切到哪一层，卡片上直接写着这一层的实时数值。"),
        ("今日建议 8 张卡", "穿衣、带伞、户外运动、晾晒、防晒、风况、能见度与出行、舒适度；配一个「适合出门指数」，按降水、风力、紫外线、能见度、温度加权算出来。"),
        ("响应式", "8 张建议卡在宽屏 4 列 × 2 行、平板与手机 2 列 × 4 行；实时数据 6/4/3/2 列，全部能整除，不留豁口。"),
        ("定位", "打开就按网络位置自动显示当地天气，也可以手动搜城市或授权精确位置，选择会被记住。"),
    ]
    cards = []
    for idx, (title, body) in enumerate(rows, 1):
        cards.append(
            '<tr><td style="padding:14px 16px;border-bottom:1px solid #eceff3;">'
            '<div style="font-size:15px;font-weight:700;color:#1f2430;margin-bottom:4px;">'
            f'{idx}. {title}</div>'
            '<div style="font-size:14px;line-height:1.7;color:#4b5563;">'
            f'{body}</div></td></tr>'
        )
    rows_html = "\n".join(cards)

    return f"""<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:#f4f6f9;
  font-family:-apple-system,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
    style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;
    box-shadow:0 2px 10px rgba(15,23,42,.06);">
    <tr><td style="padding:26px 24px;background:linear-gradient(135deg,#2563eb,#4f46e5);color:#fff;">
      <div style="font-size:13px;opacity:.85;letter-spacing:.5px;">燕绛的博客 · 改版报告</div>
      <div style="font-size:24px;font-weight:750;margin-top:6px;line-height:1.35;">天气页重做完了</div>
      <div style="font-size:13px;opacity:.9;margin-top:8px;">
        桌面端放大排版 · 环形统计图 · 12 格实时数据 · 六图层独立成卡 · 今日建议
      </div>
    </td></tr>

    <tr><td style="padding:20px 24px 4px;">
      <div style="font-size:14px;line-height:1.75;color:#374151;">
        按你说的改完了：电脑端不再把所有东西挤在一起，六个图层各自一张卡，加了圆形统计图和实时数据表，
        今天的建议也做成了整齐对称的 8 张卡。下面逐条说明。
      </div>
    </td></tr>

    <tr><td style="padding:12px 24px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
        style="border:1px solid #eceff3;border-radius:12px;overflow:hidden;">
        {rows_html}
      </table>
    </td></tr>

    <tr><td style="padding:22px 24px 6px;">
      <a href="{PAGE}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;
        font-size:14px;font-weight:600;padding:11px 22px;border-radius:10px;">打开天气页</a>
      <span style="font-size:12px;color:#6b7280;margin-left:12px;">{PAGE}</span>
    </td></tr>

    <tr><td style="padding:16px 24px 8px;">
      <div style="font-size:13px;line-height:1.8;color:#6b7280;border-top:1px solid #eceff3;padding-top:14px;">
        手机打开会自动定位到你所在城市；电脑上如果走了代理，IP 定位可能落在出口城市，
        点右上角「换城市」手动选一下就好，选择会被记住。<br>
        数据来自 Open-Meteo（天气、海浪）与中国气象局台风网（台风），均为公开接口。
      </div>
    </td></tr>

    <tr><td style="padding:14px 24px 26px;">
      <div style="font-size:12px;color:#9aa4b2;">
        这封邮件由 GitHub Actions 自动发送 · {mail_to}
      </div>
    </td></tr>
  </table>
</body></html>"""


def build_text() -> str:
    return (
        "燕绛的博客 · 天气页改版完成\n"
        "================================\n"
        "1. 桌面端排版：主容器 1180px，主温度放大，七天预报 7 列，地图 480px。\n"
        "2. 四个环形统计图：湿度 / 云量 / 降水概率 / 紫外线，按阈值变色。\n"
        "3. 实时数据 12 格：体感、露点、气压、风向、风速、阵风、能见度、降水量、日出、日落、\n"
        "   观测时间、云量；6 列 × 2 行。\n"
        "4. 六个图层各自一张卡：风向与流场 / 卫星云图 / 云量 / 降雨雷达 / 气温 / 海浪。\n"
        "5. 今日建议 8 张卡：穿衣、带伞、户外运动、晾晒、防晒、风况、能见度与出行、舒适度，\n"
        "   附适合出门指数。\n"
        "6. 响应式：建议卡 4 列 / 2 列，数据格 6/4/3/2 列，均能整除。\n"
        "7. 定位：自动 IP 定位 + 手动搜城市 + 可选精确位置。\n\n"
        f"页面：{PAGE}\n"
    )


def main() -> int:
    user = os.environ.get("QQ_USER", "").strip()
    password = os.environ.get("QQ_PASS", "").strip()
    mail_to = (os.environ.get("MAIL_TO", "") or user).strip()
    if not user or not password or not mail_to:
        print("缺少凭据：需要 QQ_USER / QQ_PASS / MAIL_TO")
        return 0

    msg = MIMEText(build_html(mail_to), "html", "utf-8")
    msg["Subject"] = Header("燕绛的博客 · 天气页改版完成", "utf-8")
    msg["From"] = formataddr((str(Header("燕绛的博客", "utf-8")), user))
    msg["To"] = mail_to
    msg["Date"] = formatdate(localtime=True)

    ctx = ssl.create_default_context()
    with smtplib.SMTP_SSL("smtp.qq.com", 465, context=ctx, timeout=30) as srv:
        srv.login(user, password)
        srv.sendmail(user, [mail_to], msg.as_string())
    print("已发送 -> " + mail_to)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

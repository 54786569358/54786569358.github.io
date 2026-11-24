#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""石狮市每日天气邮件。

数据源：Open-Meteo（免费、无需 API key）
发送：QQ 邮箱 SMTP（smtp.qq.com:465，需使用「授权码」而不是登录密码）

环境变量：
  QQ_USER  发件邮箱，例如 2629347410@qq.com
  QQ_PASS  QQ 邮箱 SMTP 授权码（16 位）
  MAIL_TO  收件邮箱，默认 2629347410@qq.com
  DRY_RUN  设为 1 时只打印不发送
"""

import json
import os
import smtplib
import ssl
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from email.header import Header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr, formatdate

CITY = "石狮市"
LAT, LON = 24.7217, 118.6472
TZ = timezone(timedelta(hours=8))

WMO = {
    0: "晴", 1: "大致晴朗", 2: "多云", 3: "阴", 45: "雾", 48: "雾凇",
    51: "小毛毛雨", 53: "毛毛雨", 55: "大毛毛雨", 56: "冻毛毛雨", 57: "强冻毛毛雨",
    61: "小雨", 63: "中雨", 65: "大雨", 66: "冻雨", 67: "强冻雨",
    71: "小雪", 73: "中雪", 75: "大雪", 77: "雪粒",
    80: "阵雨", 81: "强阵雨", 82: "暴雨", 85: "阵雪", 86: "强阵雪",
    95: "雷阵雨", 96: "雷阵雨伴冰雹", 99: "强雷暴伴冰雹",
}
ICON = {
    0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️", 45: "🌫️", 48: "🌫️",
    51: "🌦️", 53: "🌦️", 55: "🌦️", 56: "🌧️", 57: "🌧️",
    61: "🌧️", 63: "🌧️", 65: "🌧️", 66: "🌧️", 67: "🌧️",
    71: "🌨️", 73: "🌨️", 75: "❄️", 77: "❄️",
    80: "🌦️", 81: "🌧️", 82: "⛈️", 85: "🌨️", 86: "❄️",
    95: "⛈️", 96: "⛈️", 99: "⛈️",
}
WEEK = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]


def fetch():
    query = {
        "latitude": LAT,
        "longitude": LON,
        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,"
                   "wind_speed_10m,precipitation,is_day",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,"
                 "precipitation_sum,sunrise,sunset,uv_index_max",
        "hourly": "temperature_2m,precipitation_probability",
        "timezone": "Asia/Shanghai",
        "forecast_days": "7",
    }
    url = "https://api.open-meteo.com/v1/forecast?" + urllib.parse.urlencode(query)
    req = urllib.request.Request(url, headers={"User-Agent": "shishi-weather-mail/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def advise(d, i=0):
    tips = []
    try:
        pop = d["daily"]["precipitation_probability_max"][i] or 0
        tmax = d["daily"]["temperature_2m_max"][i]
        tmin = d["daily"]["temperature_2m_min"][i]
        uv = (d["daily"].get("uv_index_max") or [None])[i]
        code = d["daily"]["weather_code"][i]
    except (KeyError, IndexError, TypeError):
        return tips
    if pop >= 60 or code in (61, 63, 65, 80, 81, 82, 95, 96, 99):
        tips.append("今天有雨，出门带伞。")
    elif pop >= 30:
        tips.append("可能有阵雨，备把折叠伞稳妥。")
    if tmax is not None and tmax >= 33:
        tips.append("白天偏热（{:.0f}°），注意补水防晒。".format(tmax))
    if tmin is not None and tmin <= 12:
        tips.append("早晚偏凉（{:.0f}°），加件外套。".format(tmin))
    if uv is not None and uv >= 7:
        tips.append("紫外线较强（UV {:.0f}），做好防晒。".format(uv))
    if code in (95, 96, 99):
        tips.append("有雷雨，避免在空旷处久留。")
    return tips


def build_html(d, now):
    cur = d["current"]
    dl = d["daily"]
    code = cur["weather_code"]
    rows = []
    for i, day in enumerate(dl["time"][:5]):
        dt = datetime.strptime(day, "%Y-%m-%d")
        label = "今天" if i == 0 else ("明天" if i == 1 else WEEK[dt.weekday()])
        rows.append(
            "<tr>"
            "<td style='padding:8px 10px;border-bottom:1px solid #eceff4;color:#333'>{label}<br>"
            "<span style='color:#98a2b3;font-size:12px'>{date}</span></td>"
            "<td style='padding:8px 10px;border-bottom:1px solid #eceff4;font-size:18px'>{icon}</td>"
            "<td style='padding:8px 10px;border-bottom:1px solid #eceff4;color:#333'>{desc}</td>"
            "<td style='padding:8px 10px;border-bottom:1px solid #eceff4;color:#333;white-space:nowrap'>"
            "<b>{tmax:.0f}°</b> / {tmin:.0f}°</td>"
            "<td style='padding:8px 10px;border-bottom:1px solid #eceff4;color:#667085'>降水 {pop:.0f}%</td>"
            "</tr>".format(
                label=label, date=day[5:],
                icon=ICON.get(dl["weather_code"][i], "🌡️"),
                desc=WMO.get(dl["weather_code"][i], "未知"),
                tmax=dl["temperature_2m_max"][i], tmin=dl["temperature_2m_min"][i],
                pop=dl["precipitation_probability_max"][i] or 0,
            )
        )

    tips = advise(d, 0)
    tip_html = ""
    if tips:
        tip_html = ("<div style='margin:14px 0 0;padding:10px 14px;background:#fff8e6;"
                    "border-left:3px solid #f0b429;border-radius:6px;color:#6b5200;font-size:13px'>"
                    + "<br>".join(tips) + "</div>")

    return """<!DOCTYPE html>
<html><body style="margin:0;padding:24px 12px;background:#f5f6f8;font-family:-apple-system,'Segoe UI','Microsoft YaHei',sans-serif">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(16,24,40,.08)">
  <div style="padding:20px 24px;background:linear-gradient(135deg,#2563eb,#7aa2ff);color:#fff">
    <div style="font-size:13px;opacity:.85">{date} {week} · {city}</div>
    <div style="margin-top:6px;font-size:30px;font-weight:700;letter-spacing:-.5px">
      {icon} {temp:.0f}° <span style="font-size:15px;font-weight:400;opacity:.9">{desc}</span>
    </div>
    <div style="margin-top:6px;font-size:13px;opacity:.9">
      最高 {tmax:.0f}° · 最低 {tmin:.0f}° · 体感 {feels:.0f}° · 湿度 {hum:.0f}%
    </div>
  </div>
  <div style="padding:18px 24px 6px">
    <div style="font-size:12px;color:#98a2b3;letter-spacing:.08em">今天</div>
    <div style="margin-top:6px;font-size:14px;color:#344054;line-height:1.7">
      风 {wind:.0f} km/h · 降水概率 {pop:.0f}% · 日出 {sunrise} · 日落 {sunset}
    </div>
    {tips}
  </div>
  <div style="padding:10px 24px 20px">
    <div style="font-size:12px;color:#98a2b3;letter-spacing:.08em;margin:14px 0 4px">未来几天</div>
    <table style="width:100%;border-collapse:collapse;font-size:14px">{rows}</table>
  </div>
  <div style="padding:14px 24px;background:#fafbfc;color:#98a2b3;font-size:12px;line-height:1.7">
    数据来自 Open-Meteo · 每天 05:00（北京时间）自动发送<br>
    来自 <a href="https://54786569358.github.io/" style="color:#2563eb;text-decoration:none">燕绛的博客</a>
  </div>
</div>
</body></html>""".format(
        date=now.strftime("%Y-%m-%d"), week=WEEK[now.weekday()], city=CITY,
        icon=ICON.get(code, "🌡️"), temp=cur["temperature_2m"], desc=WMO.get(code, "未知"),
        tmax=dl["temperature_2m_max"][0], tmin=dl["temperature_2m_min"][0],
        feels=cur["apparent_temperature"], hum=cur["relative_humidity_2m"],
        wind=cur["wind_speed_10m"], pop=dl["precipitation_probability_max"][0] or 0,
        sunrise=dl["sunrise"][0][11:16], sunset=dl["sunset"][0][11:16],
        tips=tip_html, rows="".join(rows),
    )


def build_text(d, now):
    cur = d["current"]
    dl = d["daily"]
    lines = [
        "{} {} {} 天气".format(now.strftime("%Y-%m-%d"), WEEK[now.weekday()], CITY),
        "现在 {:.0f}° {}，体感 {:.0f}°，湿度 {:.0f}%".format(
            cur["temperature_2m"], WMO.get(cur["weather_code"], ""), cur["apparent_temperature"],
            cur["relative_humidity_2m"]),
        "今天 {:.0f}° / {:.0f}°，降水概率 {:.0f}%".format(
            dl["temperature_2m_max"][0], dl["temperature_2m_min"][0],
            dl["precipitation_probability_max"][0] or 0),
        "",
    ]
    for i, day in enumerate(dl["time"][:5]):
        dt = datetime.strptime(day, "%Y-%m-%d")
        label = "今天" if i == 0 else ("明天" if i == 1 else WEEK[dt.weekday()])
        lines.append("{} {} {:.0f}°/{:.0f}° 降水{:.0f}%".format(
            label, WMO.get(dl["weather_code"][i], ""),
            dl["temperature_2m_max"][i], dl["temperature_2m_min"][i],
            dl["precipitation_probability_max"][i] or 0))
    tips = advise(d, 0)
    if tips:
        lines += [""] + tips
    lines += ["", "数据 Open-Meteo · 燕绛的博客 https://54786569358.github.io/"]
    return "\n".join(lines)


def main():
    user = os.environ.get("QQ_USER", "").strip()
    pwd = os.environ.get("QQ_PASS", "").strip()
    to = os.environ.get("MAIL_TO", "2629347410@qq.com").strip()
    dry = os.environ.get("DRY_RUN", "") == "1"

    now = datetime.now(TZ)
    data = fetch()
    subject = "{} {} 天气 {:.0f}° {}".format(
        CITY, now.strftime("%m-%d"), data["current"]["temperature_2m"],
        WMO.get(data["current"]["weather_code"], ""))
    html = build_html(data, now)
    text = build_text(data, now)

    print(subject)
    print(text)

    if dry or not user or not pwd:
        print("\n[跳过发送] 未配置 QQ_USER / QQ_PASS 或处于 DRY_RUN。", file=sys.stderr)
        return 0

    msg = MIMEMultipart("alternative")
    msg["Subject"] = Header(subject, "utf-8")
    msg["From"] = formataddr((str(Header("石狮天气", "utf-8")), user))
    msg["To"] = to
    msg["Date"] = formatdate(localtime=True)
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    ctx = ssl.create_default_context()
    with smtplib.SMTP_SSL("smtp.qq.com", 465, context=ctx, timeout=30) as s:
        s.login(user, pwd)
        s.sendmail(user, [to], msg.as_string())
    print("\n已发送 -> " + to)
    return 0


if __name__ == "__main__":
    sys.exit(main())

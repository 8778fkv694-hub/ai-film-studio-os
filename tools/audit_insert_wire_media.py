from __future__ import annotations

import csv
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path("/Users/yiliwen/开发/ai-film-studio-os/outputs/全景插线理线_切割重命名")
MANIFEST = ROOT / "映射表.csv"
VIDEO_THUMBS = ROOT / "04_内容核对" / "video_thumbs"
OUT_DIR = ROOT / "04_内容核对"
FONT_PATHS = [
    Path("/System/Library/Fonts/STHeiti Medium.ttc"),
    Path("/System/Library/Fonts/Supplemental/Songti.ttc"),
]


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in FONT_PATHS:
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


FONT = load_font(22)
SMALL = load_font(18)
TITLE = load_font(28)


def thumb(path: Path | None, size: tuple[int, int]) -> Image.Image:
    canvas = Image.new("RGB", size, "white")
    if not path or not path.exists():
        draw = ImageDraw.Draw(canvas)
        draw.rectangle([0, 0, size[0] - 1, size[1] - 1], outline=(190, 190, 190), width=2)
        draw.text((20, size[1] // 2 - 12), "无素材", fill=(120, 120, 120), font=FONT)
        return canvas
    try:
        image = Image.open(path).convert("RGB")
        image.thumbnail((size[0] - 10, size[1] - 10), Image.Resampling.LANCZOS)
        x = (size[0] - image.width) // 2
        y = (size[1] - image.height) // 2
        canvas.paste(image, (x, y))
    except Exception as exc:  # pragma: no cover - diagnostic helper
        draw = ImageDraw.Draw(canvas)
        draw.text((12, 12), f"打开失败: {exc}", fill=(180, 0, 0), font=SMALL)
    return canvas


def write_wrapped(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, width: int, font: ImageFont.ImageFont, fill: tuple[int, int, int]) -> int:
    x, y = xy
    lines: list[str] = []
    for raw_line in str(text).splitlines() or [""]:
        if not raw_line:
            lines.append("")
            continue
        current = ""
        for char in raw_line:
            candidate = current + char
            if draw.textlength(candidate, font=font) <= width:
                current = candidate
            else:
                if current:
                    lines.append(current)
                current = char
        if current:
            lines.append(current)
    for line in lines:
        draw.text((x, y), line, fill=fill, font=font)
        y += int(font.size * 1.25)
    return y


def video_thumb_for(video_path: str) -> Path | None:
    if not video_path:
        return None
    candidate = VIDEO_THUMBS / (Path(video_path).name + ".png")
    return candidate if candidate.exists() else None


def row_has_focus(row: dict[str, str]) -> bool:
    text = "|".join(row.values())
    focus_tokens = [
        "置信度,中",
        "电源线",
        "走线2",
        "增压泵",
        "扎线",
        "信号线",
        "插线前主控板",
    ]
    return row.get("置信度", "").strip() != "高" or any(token in text for token in focus_tokens)


def make_sheet(rows: list[dict[str, str]], output: Path, title: str) -> None:
    image_size = (430, 320)
    video_size = (430, 320)
    label_width = 700
    row_height = 390
    margin = 24
    gap = 18
    width = margin * 2 + image_size[0] + gap + video_size[0] + gap + label_width
    height = margin * 2 + 48 + row_height * len(rows)
    sheet = Image.new("RGB", (width, height), (248, 249, 250))
    draw = ImageDraw.Draw(sheet)
    draw.text((margin, margin), title, fill=(22, 28, 36), font=TITLE)
    y = margin + 50
    for idx, row in enumerate(rows, 1):
        bg = (255, 255, 255) if idx % 2 else (242, 245, 248)
        draw.rounded_rectangle([margin, y, width - margin, y + row_height - 12], radius=10, fill=bg, outline=(216, 222, 228), width=1)
        image_path = Path(row["最终图片"]) if row.get("最终图片") else None
        video_path = video_thumb_for(row.get("最终视频", ""))
        x = margin + 14
        sheet.paste(thumb(image_path, image_size), (x, y + 44))
        draw.text((x, y + 14), "图片", fill=(70, 80, 95), font=FONT)
        x += image_size[0] + gap
        sheet.paste(thumb(video_path, video_size), (x, y + 44))
        draw.text((x, y + 14), "视频缩略图", fill=(70, 80, 95), font=FONT)
        x += video_size[0] + gap
        status = row.get("置信度", "")
        note = row.get("备注", "")
        label = (
            f"{row.get('Sheet序号', '')}_{row.get('作业标准书Sheet', '')} / {row.get('步骤', '')} / {row.get('步骤名称', '')}\n"
            f"原图：{row.get('原图片', '')}\n"
            f"原视频：{row.get('原视频', '')} {row.get('时间段', '')}\n"
            f"格：{row.get('工作格/图片格', '')} / 置信度：{status}\n"
            f"备注：{note}"
        )
        write_wrapped(draw, (x, y + 50), label, label_width - 20, SMALL, (28, 35, 45))
        y += row_height
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, quality=92)


def main() -> None:
    with MANIFEST.open("r", encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))

    rows_with_media = [r for r in rows if r.get("最终图片") or r.get("最终视频")]
    focus = [r for r in rows_with_media if row_has_focus(r)]
    make_sheet(focus, OUT_DIR / "疑点媒体内容核对.jpg", "插线理线 SOP 疑点媒体内容核对")
    make_sheet(rows_with_media, OUT_DIR / "全部媒体内容核对.jpg", "插线理线 SOP 全部媒体内容核对")
    print(OUT_DIR / "疑点媒体内容核对.jpg")
    print(OUT_DIR / "全部媒体内容核对.jpg")


if __name__ == "__main__":
    main()

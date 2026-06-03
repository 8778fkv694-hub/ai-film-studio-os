from __future__ import annotations

import csv
import shutil
import sqlite3
from datetime import datetime
from pathlib import Path
from urllib.parse import quote


SOP_SYS = Path("/Users/yiliwen/开发/sop-sys")
DB_PATH = SOP_SYS / "database" / "dev.sqlite"
ASSET_SET = "ycz-jt1600-02-x20g"
IMAGE_DIR = SOP_SYS / "runtime" / "data" / "current" / "assets" / "images" / ASSET_SET
VIDEO_DIR = SOP_SYS / "runtime" / "data" / "current" / "assets" / "videos" / ASSET_SET
REPORT_PATH = SOP_SYS / "runtime" / "insert-wire-sop-media-audit-fixes.csv"


DOC01 = "ycz-jt1600-02-x20g-01-增压泵线走线"
DOC02 = "ycz-jt1600-02-x20g-02-电源板与wifi装配"
DOC07 = "ycz-jt1600-02-x20g-07-走线"
DOC08 = "ycz-jt1600-02-x20g-08-固定信号线"
DOC09 = "ycz-jt1600-02-x20g-09-固定电源线固定"
DOC11 = "ycz-jt1600-02-x20g-11-走线2"


OLD_37_IMAGE = "01_增压泵线走线_步骤04B_增压泵线走线放置水路板后侧_O20_37增压泵线走线放置水路板后侧.jpg"
OLD_37_VIDEO = "01_增压泵线走线_步骤04B_增压泵线走线放置水路板后侧_O20_37增压泵线走线放置水路板后侧.mp4"
NEW_37_IMAGE = "11_走线2_步骤03_增压泵线束磁环放置于水路板后侧_O7_37增压泵线走线放置水路板后侧.jpg"
NEW_37_VIDEO = "11_走线2_步骤03_增压泵线束磁环放置于水路板后侧_O7_37增压泵线走线放置水路板后侧.mp4"

OLD_33_IMAGE = "11_走线2_步骤03_电源线插入_O7_33电源线插入.jpg"
NEW_33_IMAGE = "09_固定电源线固定_步骤01_固定电源线_G7_33电源线插入.jpg"


def runtime_url(category: str, file_name: str) -> str:
    return "/api/files/runtime-assets/current/" + "/".join(
        quote(part) for part in [category, ASSET_SET, file_name]
    )


def backup_database() -> Path:
    backup = DB_PATH.with_name(f"{DB_PATH.name}.bak-{datetime.now().strftime('%Y%m%d-%H%M%S')}-media-audit")
    shutil.copy2(DB_PATH, backup)
    return backup


def revision_id(document_id: str) -> str:
    return f"{document_id}@rev-A0"


def step_id(document_id: str, step: int) -> str:
    return f"{revision_id(document_id)}:step-{step:02d}"


def copy_verified_assets() -> list[list[str]]:
    actions: list[list[str]] = []
    copies = [
        (IMAGE_DIR / OLD_37_IMAGE, IMAGE_DIR / NEW_37_IMAGE, "复制并重命名37图片到走线2步骤03"),
        (VIDEO_DIR / OLD_37_VIDEO, VIDEO_DIR / NEW_37_VIDEO, "复制并重命名37视频到走线2步骤03"),
        (IMAGE_DIR / OLD_33_IMAGE, IMAGE_DIR / NEW_33_IMAGE, "复制并重命名33图片到固定电源线步骤01"),
    ]
    for source, target, note in copies:
        if not source.exists():
            raise FileNotFoundError(source)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        actions.append(["asset", note, str(source), str(target)])
    return actions


def delete_video_like(
    db: sqlite3.Connection,
    src_pattern: str,
    reason: str,
    actions: list[list[str]],
    title_pattern: str | None = None,
    step_title_pattern: str | None = None,
) -> None:
    title_pattern = title_pattern or "\uffff"
    step_title_pattern = step_title_pattern or "\uffff"
    rows = db.execute(
        """
        SELECT m.id, s.title, m.title, m.src
        FROM step_media m
        JOIN sop_steps s ON s.id = m.step_id
        WHERE m.media_kind = 'video'
          AND (m.src LIKE ? OR m.title LIKE ? OR s.title LIKE ?)
        ORDER BY m.src
        """,
        (src_pattern, title_pattern, step_title_pattern),
    ).fetchall()
    for media_id, step_title, media_title, src in rows:
        db.execute("DELETE FROM step_media WHERE id = ?", (media_id,))
        actions.append(["delete-video", reason, step_title, media_title, src])


def replace_step_media(db: sqlite3.Connection, target_step_id: str, media_rows: list[dict[str, object]]) -> None:
    db.execute("DELETE FROM step_media WHERE step_id = ?", (target_step_id,))
    for index, media in enumerate(media_rows, 1):
        db.execute(
            """
            INSERT INTO step_media (
              id, step_id, media_order, media_kind, src, title,
              poster, crop_x, crop_y, crop_width, crop_height,
              is_default, annotations_json, play_sequential,
              play_interval, play_loop
            ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, 1, NULL, ?, ?, ?)
            """,
            (
                f"{target_step_id}:{media['id']}",
                target_step_id,
                index,
                media["kind"],
                media["src"],
                media["title"],
                1 if media.get("playSequential") else 0,
                media.get("playInterval", 0.6),
                1 if media.get("playLoop") else 0,
            ),
        )


def update_revision_summaries(db: sqlite3.Connection) -> None:
    rows = db.execute(
        """
        SELECT d.id, d.title, r.id, r.page_number, COUNT(s.id)
        FROM sop_documents d
        JOIN sop_revisions r ON r.document_id = d.id AND r.is_current = 1
        LEFT JOIN sop_steps s ON s.revision_id = r.id
        WHERE d.id LIKE 'ycz-jt1600-02-x20g-%'
        GROUP BY d.id, r.id
        """
    ).fetchall()
    now = datetime.now().replace(microsecond=0).isoformat()
    for doc_id, title, rev_id, page_number, step_count in rows:
        summary = f"{title}，电子版 {step_count} 个步骤，纸版第 {page_number} 页。"
        db.execute("UPDATE sop_revisions SET summary = ?, updated_at = ? WHERE id = ?", (summary, now, rev_id))
        db.execute("UPDATE sop_documents SET updated_at = ? WHERE id = ?", (now, doc_id))


def repair_database(backup: Path, asset_actions: list[list[str]]) -> list[list[str]]:
    actions = list(asset_actions)
    db = sqlite3.connect(DB_PATH)
    db.execute("PRAGMA foreign_keys = ON")
    try:
        with db:
            # Low-confidence or semantically mismatched videos are removed rather than guessed.
            delete_video_like(
                db,
                "\uffff",
                "固定主控板视频为整体/近景主控板，不能确认是固定动作",
                actions,
                title_pattern="固定主控板 视频%",
            )
            delete_video_like(
                db,
                "%/videos/ycz-jt1600-02-x20g/07_%",
                "走线/扎线连续视频缩略图与对应图片角度和动作不稳定，按保守原则不挂视频",
                actions,
            )
            delete_video_like(
                db,
                "\uffff",
                "信号线穿线视频缩略图与图片不是同一可确认动作",
                actions,
                title_pattern="信号线穿线 视频%",
            )
            delete_video_like(
                db,
                "\uffff",
                "走线2步骤03表格内容为增压泵线束磁环，33电源线插入错挂",
                actions,
                title_pattern="电源线插入 视频%",
            )

            # Remove the extra 37 step from page 1. The paper SOP page 11 step 3 is the matching location.
            old_step_37 = step_id(DOC01, 5)
            old = db.execute("SELECT title FROM sop_steps WHERE id = ?", (old_step_37,)).fetchone()
            if old:
                db.execute("DELETE FROM step_media WHERE step_id = ?", (old_step_37,))
                db.execute("DELETE FROM sop_steps WHERE id = ?", (old_step_37,))
                actions.append(["delete-step", "37应属于走线2步骤03，删除增压泵线走线页面的步骤04B", old_step_37, old[0]])

            # Correct page 11 step 3 and attach the verified 37 image/video pair.
            step11_03 = step_id(DOC11, 3)
            db.execute(
                """
                UPDATE sop_steps
                SET title = ?,
                    action_text = ?,
                    detail_text = ?,
                    source_label = ?,
                    control_point = ?
                WHERE id = ?
                """,
                (
                    "步骤03 增压泵线束磁环放置于水路板后侧",
                    "增压泵线束磁环放置于水路板后侧",
                    "操作要求：将增压泵线束磁环放置于水路板后侧",
                    "走线2 / 步骤03 / 工作格 O7 / 37增压泵线走线放置水路板后侧.jpg",
                    "走线",
                    step11_03,
                ),
            )
            replace_step_media(
                db,
                step11_03,
                [
                    {
                        "id": "image-1",
                        "kind": "image",
                        "src": runtime_url("images", NEW_37_IMAGE),
                        "title": "增压泵线束磁环放置于水路板后侧 图片（O7）",
                    },
                    {
                        "id": "video-2",
                        "kind": "video",
                        "src": runtime_url("videos", NEW_37_VIDEO),
                        "title": "增压泵线束磁环放置于水路板后侧 视频（33-44s）",
                        "playSequential": False,
                        "playInterval": 0.6,
                        "playLoop": False,
                    },
                ],
            )
            actions.append(["update-step", "走线2步骤03改为表格原文对应的37图片/视频", step11_03, NEW_37_IMAGE, NEW_37_VIDEO])

            # Add the 33 power-line still to page 9 step 1 only. Its video segment is not attached.
            step09_01 = step_id(DOC09, 1)
            db.execute(
                """
                UPDATE sop_steps
                SET source_label = ?
                WHERE id = ?
                """,
                ("固定电源线固定 / 步骤01 / 工作格 G7 / 33电源线插入.jpg", step09_01),
            )
            replace_step_media(
                db,
                step09_01,
                [
                    {
                        "id": "image-1",
                        "kind": "image",
                        "src": runtime_url("images", NEW_33_IMAGE),
                        "title": "固定电源线 图片（G7）",
                    }
                ],
            )
            actions.append(["update-step", "33电源线插入仅作为固定电源线步骤01图片，不挂不确定视频", step09_01, NEW_33_IMAGE])

            update_revision_summaries(db)
            actions.append(["backup", "修正前数据库备份", str(backup)])
    finally:
        db.close()
    return actions


def write_report(actions: list[list[str]]) -> None:
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with REPORT_PATH.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["类型", "原因/动作", "对象1", "对象2", "对象3"])
        writer.writerows(actions)


def main() -> None:
    if not DB_PATH.exists():
        raise FileNotFoundError(DB_PATH)
    backup = backup_database()
    asset_actions = copy_verified_assets()
    actions = repair_database(backup, asset_actions)
    write_report(actions)
    print(f"backup={backup}")
    print(f"report={REPORT_PATH}")
    print(f"actions={len(actions)}")


if __name__ == "__main__":
    main()

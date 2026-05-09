#!/usr/bin/env python3
"""Extract all 1,160 copy blocks from generate_review_doc.py into a structured
content.json file that the CMS can seed from."""

import ast
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "generate_review_doc.py")
OUT = os.path.join(HERE, "content.json")

with open(SRC) as f:
    src = f.read()

tree = ast.parse(src)

TRACKED = {
    "add_h1", "add_h2", "add_h3", "add_page_header",
    "add_block", "add_page_break", "add_bullets", "add_bullet",
    "add_para", "add_hint", "add_label",
}

records = []
for node in tree.body:
    if isinstance(node, ast.Expr) and isinstance(node.value, ast.Call):
        call = node.value
        if isinstance(call.func, ast.Name) and call.func.id in TRACKED:
            try:
                args = [ast.literal_eval(a) for a in call.args]
                records.append((call.func.id, args))
            except Exception:
                pass


def slugify(text):
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s or "page"


pages = []
current_page = None
current_section = None
current_subsection = None
order_counter = 0

# walk from first h1 onwards
h1_indexes = [i for i, r in enumerate(records) if r[0] == "add_h1"]
# Skip the first h1 (the "How to Use This Document" instructions page that we
# already replaced in the Word rewrite).
start = h1_indexes[1] if len(h1_indexes) > 1 else 0

i = start
while i < len(records):
    name, args = records[i]

    if name in ("add_h1", "add_page_header"):
        current_page = {
            "slug": slugify(args[0]),
            "title": args[0],
            "intro": None,
            "sections": [],
        }
        pages.append(current_page)
        current_section = None
        current_subsection = None

    elif name == "add_h2":
        current_section = {
            "title": args[0],
            "subsections": [],
            "blocks": [],
        }
        if current_page is not None:
            current_page["sections"].append(current_section)
        current_subsection = None

    elif name == "add_h3":
        current_subsection = {
            "title": args[0],
            "blocks": [],
        }
        if current_section is not None:
            current_section["subsections"].append(current_subsection)

    elif name == "add_block":
        label, hint, content = args[0], args[1], args[2]
        order_counter += 1
        block = {
            "label": label,
            "hint": hint,
            "kind": "list" if isinstance(content, list) else "text",
            "value": content,
            "order": order_counter,
        }
        target = current_subsection if current_subsection is not None else current_section
        if target is None:
            # orphan block — create a default section
            current_section = {"title": "General", "subsections": [], "blocks": []}
            if current_page is not None:
                current_page["sections"].append(current_section)
            target = current_section
        target["blocks"].append(block)

    elif name == "add_label":
        # orphan label usually followed by hint + bullets
        label = args[0]
        hint = ""
        content_items = []
        j = i + 1
        if j < len(records) and records[j][0] == "add_hint":
            hint = records[j][1][0]
            j += 1
        if j < len(records) and records[j][0] == "add_bullets":
            content_items = list(records[j][1][0])
            j += 1
        else:
            while j < len(records) and records[j][0] == "add_bullet":
                content_items.append(records[j][1][0])
                j += 1
        order_counter += 1
        block = {
            "label": label,
            "hint": hint,
            "kind": "list",
            "value": content_items,
            "order": order_counter,
        }
        target = current_subsection if current_subsection is not None else current_section
        if target is None:
            current_section = {"title": "General", "subsections": [], "blocks": []}
            if current_page is not None:
                current_page["sections"].append(current_section)
            target = current_section
        target["blocks"].append(block)
        i = j - 1  # skip the consumed records

    elif name in ("add_para", "add_hint", "add_bullets", "add_bullet", "add_page_break"):
        # narrative prose in the instructions page — ignore for CMS
        pass

    i += 1


# compute stats
def count_blocks(page):
    n = 0
    for s in page["sections"]:
        n += len(s["blocks"])
        for ss in s["subsections"]:
            n += len(ss["blocks"])
    return n


result = {
    "pages": pages,
    "stats": {
        "total_pages": len(pages),
        "total_blocks": sum(count_blocks(p) for p in pages),
        "per_page": {p["slug"]: count_blocks(p) for p in pages},
    },
}

with open(OUT, "w") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(f"Wrote {OUT}")
print(f"Pages: {result['stats']['total_pages']}")
print(f"Blocks: {result['stats']['total_blocks']}")
print("\nBlocks per page:")
for slug, n in result["stats"]["per_page"].items():
    print(f"  {slug}: {n}")

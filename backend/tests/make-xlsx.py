#!/usr/bin/env python3
"""Bikin berkas .xlsx asli untuk menguji import siswa (fixture smoke test).

Ditulis manual memakai zipfile supaya tidak butuh openpyxl/xlsxwriter, tapi
strukturnya sama dengan berkas buatan Excel: [Content_Types].xml, rels,
workbook, worksheet, dan sharedStrings.xml dengan namespace default — jadi
parser di app/Services/StudentListParser.php diuji pada bentuk yang sebenarnya.

Pakai:
    python3 tests/make-xlsx.py /tmp/daftar.xlsx "Budi Santoso:4A" "Siti Aminah:4B"

Argumen kedua dan seterusnya: "Nama:ROMBEL" (baris judul + kolom nomor
ditambahkan otomatis, meniru ekspor Excel pada umumnya).
"""
import sys
import zipfile

CT = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>"""

ROOT_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>"""

WORKBOOK = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Daftar Siswa" sheetId="1" r:id="rId1"/></sheets>
</workbook>"""

WORKBOOK_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>"""


def col_letter(idx):
    """0 -> A, 1 -> B, ... 26 -> AA"""
    letters = ""
    idx += 1
    while idx > 0:
        idx, rem = divmod(idx - 1, 26)
        letters = chr(65 + rem) + letters
    return letters


def esc(text):
    return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def build_xlsx(path, rows, header=True):
    """rows: list of list nilai sel (str -> shared string, int -> angka)."""
    shared = []
    shared_index = {}

    def sid(value):
        if value not in shared_index:
            shared_index[value] = len(shared)
            shared.append(value)
        return shared_index[value]

    body = [["No", "Nama Siswa", "Rombel"]] if header else []
    body.extend(rows)

    row_xml = []
    for r, row in enumerate(body, start=1):
        cells = []
        for c, value in enumerate(row):
            ref = f"{col_letter(c)}{r}"
            if isinstance(value, int):
                cells.append(f'<c r="{ref}"><v>{value}</v></c>')
            else:
                cells.append(f'<c r="{ref}" t="s"><v>{sid(value)}</v></c>')
        row_xml.append(f'<row r="{r}">{"".join(cells)}</row>')

    sheet = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f'<sheetData>{"".join(row_xml)}</sheetData></worksheet>'
    )

    sst_items = "".join(f'<si><t xml:space="preserve">{esc(s)}</t></si>' for s in shared)
    sst = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        f'count="{len(shared)}" uniqueCount="{len(shared)}">{sst_items}</sst>'
    )

    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", CT)
        z.writestr("_rels/.rels", ROOT_RELS)
        z.writestr("xl/workbook.xml", WORKBOOK)
        z.writestr("xl/_rels/workbook.xml.rels", WORKBOOK_RELS)
        z.writestr("xl/worksheets/sheet1.xml", sheet)
        z.writestr("xl/sharedStrings.xml", sst)

    return path


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    target = sys.argv[1]
    rows = []
    for i, arg in enumerate(sys.argv[2:], start=1):
        name, _, rombel = arg.partition(":")
        rows.append([i, name, rombel or ""])

    build_xlsx(target, rows)
    print(f"OK -> {target} ({len(rows)} siswa + 1 baris judul)")

"""
Stream one sheet of an .xlsx workbook out as CSV, using only the stdlib.

The pipeline deliberately carries no third-party dependencies: every source it
reads must be re-readable by anyone, years from now, with a stock interpreter.

Usage: python3 xlsx2csv.py <book.xlsx> <sheet name> > out.csv
       python3 xlsx2csv.py <book.xlsx> --list
"""
import csv
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
REL = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'


def col_index(ref):
    letters = re.match(r'[A-Z]+', ref).group(0)
    n = 0
    for ch in letters:
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def shared_strings(z):
    if 'xl/sharedStrings.xml' not in z.namelist():
        return []
    out = []
    with z.open('xl/sharedStrings.xml') as f:
        for _, el in ET.iterparse(f):
            if el.tag == NS + 'si':
                out.append(''.join(t.text or '' for t in el.iter(NS + 't')))
                el.clear()
    return out


def sheet_paths(z):
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    target = {r.get('Id'): r.get('Target') for r in rels}
    out = {}
    for s in wb.iter(NS + 'sheet'):
        t = target[s.get(REL + 'id')].lstrip('/')
        out[s.get('name')] = t if t.startswith('xl/') else 'xl/' + t
    return out


def rows(z, path, strings):
    with z.open(path) as f:
        for _, el in ET.iterparse(f):
            if el.tag != NS + 'row':
                continue
            cells = {}
            for c in el.iter(NS + 'c'):
                t = c.get('t')
                v = c.find(NS + 'v')
                if t == 's' and v is not None:
                    val = strings[int(v.text)]
                elif t == 'inlineStr':
                    val = ''.join(x.text or '' for x in c.iter(NS + 't'))
                else:
                    val = v.text if v is not None else ''
                cells[col_index(c.get('r'))] = val
            el.clear()
            if cells:
                yield [cells.get(i, '') for i in range(max(cells) + 1)]


def main():
    book, sheet = sys.argv[1], sys.argv[2]
    z = zipfile.ZipFile(book)
    paths = sheet_paths(z)
    if sheet == '--list':
        for name in paths:
            print(name)
        return
    w = csv.writer(sys.stdout)
    for r in rows(z, paths[sheet], shared_strings(z)):
        w.writerow(r)


if __name__ == '__main__':
    main()

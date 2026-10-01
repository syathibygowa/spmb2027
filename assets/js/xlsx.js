/* =====================================================================
   EKSPOR EXCEL (.xlsx) TANPA PUSTAKA LUAR
   window.SPMB.unduhXlsx(namaBerkas, lembar)
     lembar: satu objek atau larik objek
       { nama: 'Data', judul: 'Judul di baris 1', sub: 'Keterangan baris 2',
         kolom: [{ j: 'Nama kolom', w: 24, t: 'teks'|'angka'|'uang'|'desimal'|'tgl' }],
         baris: [[...], ...], jumlah: { 3: 'sum', 5: 'sum' } (opsional, baris total) }
   - Teks disimpan sebagai teks (NIK, NISN, nomor HP tidak kehilangan
     angka nol di depan dan tidak berubah menjadi 1,23E+15).
   - Tanggal disimpan sebagai tanggal Excel dengan format dd/mm/yyyy.
   - Baris judul kolom tebal, berbingkai tipis, dibekukan, dan bersaring.
   ===================================================================== */
(function () {
  'use strict';
  const enc = new TextEncoder();

  /* ---------- ZIP (tanpa kompresi) ---------- */
  const TABEL_CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = TABEL_CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };

  function zip(berkas) {
    const bagian = [], pusat = [];
    let posisi = 0;
    const d = new Date();
    const waktu = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const tanggal = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    for (const [nama, isi] of berkas) {
      const n = enc.encode(nama), data = typeof isi === 'string' ? enc.encode(isi) : isi, crc = crc32(data);
      const lokal = new DataView(new ArrayBuffer(30));
      lokal.setUint32(0, 0x04034b50, true); lokal.setUint16(4, 20, true); lokal.setUint16(6, 0x0800, true); lokal.setUint16(8, 0, true);
      lokal.setUint16(10, waktu, true); lokal.setUint16(12, tanggal, true); lokal.setUint32(14, crc, true);
      lokal.setUint32(18, data.length, true); lokal.setUint32(22, data.length, true); lokal.setUint16(26, n.length, true); lokal.setUint16(28, 0, true);
      bagian.push(new Uint8Array(lokal.buffer), n, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, waktu, true); c.setUint16(14, tanggal, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true);
      c.setUint32(24, data.length, true); c.setUint16(28, n.length, true); c.setUint32(42, posisi, true);
      pusat.push(new Uint8Array(c.buffer), n);
      posisi += 30 + n.length + data.length;
    }
    const ukPusat = pusat.reduce((a, x) => a + x.length, 0);
    const akhir = new DataView(new ArrayBuffer(22));
    akhir.setUint32(0, 0x06054b50, true); akhir.setUint16(8, berkas.length, true); akhir.setUint16(10, berkas.length, true);
    akhir.setUint32(12, ukPusat, true); akhir.setUint32(16, posisi, true);
    return new Blob([...bagian, ...pusat, new Uint8Array(akhir.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  /* ---------- Isi lembar ---------- */
  const xml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const kolHuruf = i => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  const AWAL_EXCEL = Date.UTC(1899, 11, 30);
  function serialTanggal(v) {
    if (v == null || v === '') return null;
    let y, m, d;
    if (v instanceof Date && !isNaN(v)) { y = v.getFullYear(); m = v.getMonth() + 1; d = v.getDate(); }
    else {
      const s = String(v), a = s.match(/^(\d{4})-(\d{2})-(\d{2})/), b = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (a) [y, m, d] = [+a[1], +a[2], +a[3]]; else if (b) [y, m, d] = [+b[3], +b[2], +b[1]]; else return null;
    }
    return (Date.UTC(y, m - 1, d) - AWAL_EXCEL) / 86400000;
  }
  // gaya: 1 judul kolom, 2 teks, 3 angka bulat, 4 tanggal, 5 judul lembar, 6 desimal, 7 keterangan, 8 total
  const GAYA = { teks: 2, angka: 3, uang: 3, tgl: 4, desimal: 6 };
  function sel(ref, v, t, gaya) {
    if (v == null || v === '') return `<c r="${ref}" s="${gaya}"/>`;
    if (t === 'tgl') { const n = serialTanggal(v); if (n != null) return `<c r="${ref}" s="${gaya}"><v>${n}</v></c>`; }
    if ((t === 'angka' || t === 'uang' || t === 'desimal') && v !== '' && isFinite(+String(v).replace(',', '.'))) return `<c r="${ref}" s="${gaya}"><v>${+String(v).replace(',', '.')}</v></c>`;
    return `<c r="${ref}" s="${t === 'tgl' || t === 'angka' || t === 'uang' || t === 'desimal' ? 2 : gaya}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
  }
  function lembarXml(L) {
    const kol = L.kolom, baris = [], gabung = [];
    let r = 0;
    const akhirKol = kolHuruf(Math.max(0, kol.length - 1));
    if (L.judul) { r++; baris.push(`<row r="${r}" ht="22" customHeight="1">${sel('A' + r, L.judul, 'teks', 5)}</row>`); gabung.push(`A${r}:${akhirKol}${r}`); }
    if (L.sub) { r++; baris.push(`<row r="${r}">${sel('A' + r, L.sub, 'teks', 7)}</row>`); gabung.push(`A${r}:${akhirKol}${r}`); }
    if (L.judul || L.sub) { r++; baris.push(`<row r="${r}"/>`); }
    r++; const barisJudul = r;
    baris.push(`<row r="${r}" ht="30" customHeight="1">${kol.map((k, i) => sel(kolHuruf(i) + r, k.j, 'teks', 1)).join('')}</row>`);
    const awalData = r + 1;
    for (const b of L.baris) {
      r++;
      baris.push(`<row r="${r}">${kol.map((k, i) => sel(kolHuruf(i) + r, b[i], k.t || 'teks', GAYA[k.t] || 2)).join('')}</row>`);
    }
    if (L.jumlah && L.baris.length) {
      r++;
      baris.push(`<row r="${r}">${kol.map((k, i) => {
        const ref = kolHuruf(i) + r;
        if (L.jumlah[i] === 'sum') return `<c r="${ref}" s="8"><f>SUM(${kolHuruf(i)}${awalData}:${kolHuruf(i)}${r - 1})</f></c>`;
        if (typeof L.jumlah[i] === 'string') return `<c r="${ref}" s="8" t="inlineStr"><is><t>${xml(L.jumlah[i])}</t></is></c>`;
        return `<c r="${ref}" s="8"/>`;
      }).join('')}</row>`);
    }
    const lebar = kol.map((k, i) => `<col min="${i + 1}" max="${i + 1}" width="${k.w || 16}" customWidth="1"/>`).join('');
    const akhirData = Math.max(barisJudul, awalData + L.baris.length - 1);
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
<sheetViews><sheetView workbookViewId="0"><pane ySplit="${barisJudul}" topLeftCell="A${barisJudul + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/><cols>${lebar}</cols>
<sheetData>${baris.join('')}</sheetData>
${kol.length ? `<autoFilter ref="A${barisJudul}:${akhirKol}${akhirData}"/>` : ''}
${gabung.length ? `<mergeCells count="${gabung.length}">${gabung.map(g => `<mergeCell ref="${g}"/>`).join('')}</mergeCells>` : ''}
<pageMargins left="0.79" right="0.79" top="0.79" bottom="0.79" header="0.3" footer="0.3"/>
<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
  }

  const GAYA_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="#,##0"/><numFmt numFmtId="166" formatCode="#,##0.00"/></numFmts>
<fonts count="4"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="14"/><name val="Calibri"/><family val="2"/></font><font><i/><sz val="10"/><color rgb="FF555555"/><name val="Calibri"/><family val="2"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF3E3DD"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="9">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="165" fontId="1" fillId="2" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  const namaLembar = (s, i, pakai) => {
    let n = String(s || 'Lembar ' + (i + 1)).replace(/[\[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Lembar ' + (i + 1);
    while (pakai.has(n.toLowerCase())) n = n.slice(0, 28) + ' ' + (i + 1);
    pakai.add(n.toLowerCase());
    return n;
  };

  function buatXlsx(lembar) {
    const daftar = Array.isArray(lembar) ? lembar : [lembar], pakai = new Set();
    const nama = daftar.map((L, i) => namaLembar(L.nama, i, pakai));
    const dibuat = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    const berkas = [
      ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
${daftar.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
      ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`],
      ['docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:creator>SPMB</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${dibuat}</dcterms:created></cp:coreProperties>`],
      ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>
${nama.map((n, i) => `<sheet name="${xml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
      ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${daftar.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}
<Relationship Id="rId${daftar.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
      ['xl/styles.xml', GAYA_XML],
      ...daftar.map((L, i) => [`xl/worksheets/sheet${i + 1}.xml`, lembarXml(L)])
    ];
    return zip(berkas);
  }

  function unduhXlsx(namaBerkas, lembar) {
    const blob = buatXlsx(lembar);
    const nama = String(namaBerkas || 'Ekspor').replace(/[\\/:*?"<>|]+/g, '-').trim() + '.xlsx';
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: nama });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return nama;
  }

  window.SPMB = Object.assign(window.SPMB || {}, { buatXlsx, unduhXlsx });
})();

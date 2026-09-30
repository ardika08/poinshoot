<?php

namespace App\Services;

use DOMDocument;
use DOMElement;
use DOMXPath;
use Illuminate\Http\UploadedFile;
use RuntimeException;
use ZipArchive;

/**
 * Baca daftar siswa dari tempelan Excel / file spreadsheet, tanpa library tambahan.
 *
 * Kenapa tanpa library: file .xlsx sebenarnya cuma arsip ZIP berisi XML
 * (sharedStrings + worksheet). PHP sudah punya ext-zip + ext-dom, jadi kita
 * tidak perlu menambah dependency besar hanya untuk membaca dua kolom teks.
 *
 * Yang penting di sini bukan parsing-nya, tapi TOLERANSI: daftar siswa dari guru
 * bentuknya beda-beda. Ada yang satu kolom nama saja, ada yang pakai nomor urut,
 * ada yang menaruh kolom rombel di depan, ada yang menyertakan baris judul.
 * Semua bentuk itu diterima dan dinormalkan, sisanya dilaporkan sebagai invalid
 * supaya operator bisa koreksi tanpa mengulang seluruh daftar.
 *
 * Catatan teknis: pembacaan XML pakai DOM, bukan SimpleXML. Pada dokumen dengan
 * namespace default (seperti .xlsx), SimpleXML kadang mengembalikan string kosong
 * untuk `$cell['r']` sehingga referensi kolom hilang; DOM `getAttribute()`
 * berperilaku konsisten.
 */
class StudentListParser
{
    private const XLSX_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    private const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    private const PKG_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';

    /** Kata yang menandakan baris itu judul kolom, bukan nama siswa. */
    private const HEADER_WORDS = [
        'nama', 'name', 'no', 'nomor', 'no.', 'nis', 'nisn', 'absen', 'no absen',
        'rombel', 'kelas', 'class', 'kelas/rombel', 'rombel/kelas', 'siswa',
        'student', 'nama siswa', 'nama lengkap', 'nama murid', 'murid',
    ];

    private const MAX_RECORDS = 2000;

    /**
     * Baca file yang diunggah menjadi baris-baris sel.
     *
     * @return array<int, array<int, string>>
     */
    public function rowsFromFile(UploadedFile $file): array
    {
        $ext = strtolower($file->getClientOriginalExtension());
        $path = $file->getRealPath();

        if ($path === false) {
            throw new RuntimeException('File gagal dibaca, coba unggah ulang.');
        }

        return match ($ext) {
            'xlsx' => $this->rowsFromXlsx($path),
            'csv', 'txt' => $this->rowsFromText($this->readPlainText($path)),
            'xls' => throw new RuntimeException(
                'Format .xls lama belum didukung. Di Excel pilih "Save As" lalu simpan sebagai .xlsx.'
            ),
            default => throw new RuntimeException(
                'Format file belum didukung. Gunakan .xlsx, .csv, atau .txt.'
            ),
        };
    }

    /**
     * Pecah teks tempelan jadi baris-baris sel.
     *
     * Copy dari Excel / Google Sheets menghasilkan TAB antar kolom, jadi TAB
     * diprioritaskan. Kalau operator menempel dari CSV, koma / titik-koma dipakai.
     *
     * @return array<int, array<int, string>>
     */
    public function rowsFromText(string $text): array
    {
        $text = str_replace(["\r\n", "\r"], "\n", $text);
        $rows = [];

        foreach (explode("\n", $text) as $line) {
            if (trim($line) === '') {
                continue;
            }

            if (str_contains($line, "\t")) {
                $cells = explode("\t", $line);
            } elseif (str_contains($line, ';')) {
                $cells = explode(';', $line);
            } elseif (str_contains($line, ',')) {
                $cells = explode(',', $line);
            } else {
                $cells = [$line];
            }

            $rows[] = array_map(fn ($cell) => $this->cleanCell((string) $cell), $cells);
        }

        return $rows;
    }

    /**
     * Ubah baris-baris sel jadi pasangan nama + rombel.
     *
     * @param  array<int, array<int, string>>  $rows
     * @return array{records: array<int, array{name: string, rombel: string}>, invalid: array<int, array{name: string, reason: string}>}
     */
    public function normalize(array $rows, ?string $defaultRombel = null): array
    {
        $defaultRombel = $defaultRombel !== null ? $this->normalizeRombel($defaultRombel) : null;

        $records = [];
        $invalid = [];
        $headerChecked = false;

        foreach ($rows as $cells) {
            // Buang sel kosong, termasuk yang cuma berisi spasi
            $cells = array_values(array_filter(
                array_map(fn ($c) => $this->cleanCell((string) $c), $cells),
                fn ($c) => $c !== ''
            ));

            if ($cells === []) {
                continue;
            }

            // Baris judul ("Nama | Rombel") hanya dicek sekali di awal data
            if (! $headerChecked) {
                $headerChecked = true;

                if ($this->looksLikeHeader($cells)) {
                    continue;
                }
            }

            $rombel = null;
            $nameParts = [];

            foreach ($cells as $cell) {
                $candidate = $this->normalizeRombel($cell);

                // Kolom pertama yang berbentuk rombel dipakai sebagai rombel
                if ($rombel === null && $candidate !== null) {
                    $rombel = $candidate;

                    continue;
                }

                // Nomor urut / NIS yang berdiri sendiri bukan bagian nama
                if ($this->isNumeric($cell)) {
                    continue;
                }

                $nameParts[] = $cell;
            }

            $name = $this->cleanName(implode(' ', $nameParts));

            if ($name === '') {
                continue;
            }

            $rombel ??= $defaultRombel;

            if ($rombel === null) {
                $invalid[] = ['name' => $name, 'reason' => 'Rombel tidak ada di file maupun pilihan'];

                continue;
            }

            $records[] = ['name' => $name, 'rombel' => $rombel];

            if (count($records) >= self::MAX_RECORDS) {
                break;
            }
        }

        return ['records' => $records, 'invalid' => $invalid];
    }

    // ------------------------------------------------------------------
    // Pembacaan .xlsx (ZIP + XML)
    // ------------------------------------------------------------------

    /**
     * @return array<int, array<int, string>>
     */
    private function rowsFromXlsx(string $path): array
    {
        if (! class_exists(ZipArchive::class)) {
            throw new RuntimeException(
                'Server belum mendukung pembacaan file Excel. Pakai "Tempel dari Excel", atau simpan file sebagai .csv.'
            );
        }

        $zip = new ZipArchive();

        if ($zip->open($path) !== true) {
            throw new RuntimeException(
                'File Excel tidak bisa dibuka. Pastikan benar-benar format .xlsx (Excel 2007 ke atas), bukan .xls lama.'
            );
        }

        $shared = $this->readSharedStrings($zip);
        $sheetPath = $this->firstSheetPath($zip);
        $sheetXml = $zip->getFromName($sheetPath);
        $zip->close();

        if ($sheetXml === false) {
            throw new RuntimeException('Sheet pertama tidak ditemukan di dalam file Excel.');
        }

        $doc = $this->loadXml($sheetXml, 'Isi file Excel tidak bisa dibaca.');

        $xpath = new DOMXPath($doc);
        $xpath->registerNamespace('m', self::XLSX_NS);

        $rows = [];

        foreach ($xpath->query('//m:sheetData/m:row') ?: [] as $rowNode) {
            if (! $rowNode instanceof DOMElement) {
                continue;
            }

            $cells = [];
            $maxColumn = -1;

            foreach ($xpath->query('m:c', $rowNode) ?: [] as $cellNode) {
                if (! $cellNode instanceof DOMElement) {
                    continue;
                }

                $column = $this->columnIndex($cellNode->getAttribute('r'));
                $type = $cellNode->getAttribute('t');

                $value = match ($type) {
                    // t="s": angka di <v> adalah indeks ke tabel sharedStrings
                    's' => $shared[(int) $this->nodeText($xpath, 'm:v', $cellNode)] ?? '',
                    // t="inlineStr": teksnya langsung di dalam sel
                    'inlineStr' => trim($cellNode->textContent),
                    default => $this->nodeText($xpath, 'm:v', $cellNode),
                };

                $cells[$column] = $value;
                $maxColumn = max($maxColumn, $column);
            }

            // Ratakan supaya kolom yang dilewati tetap jadi sel kosong
            $flat = [];

            for ($i = 0; $i <= $maxColumn; $i++) {
                $flat[] = $cells[$i] ?? '';
            }

            $rows[] = $flat;
        }

        return $rows;
    }

    /**
     * @return array<int, string>
     */
    private function readSharedStrings(ZipArchive $zip): array
    {
        $xml = $zip->getFromName('xl/sharedStrings.xml');

        if ($xml === false) {
            return [];
        }

        try {
            $doc = $this->loadXml($xml, 'Tabel teks file Excel tidak bisa dibaca.');
        } catch (RuntimeException) {
            return [];
        }

        $xpath = new DOMXPath($doc);
        $xpath->registerNamespace('m', self::XLSX_NS);

        $shared = [];

        foreach ($xpath->query('//m:si') ?: [] as $siNode) {
            // textContent menggabungkan <t> langsung maupun potongan <r><t>
            // (teks kaya dari Excel), jadi keduanya tertangani.
            $shared[] = $siNode->textContent;
        }

        return $shared;
    }

    /**
     * Cari path sheet pertama lewat workbook + relasi-nya.
     */
    private function firstSheetPath(ZipArchive $zip): string
    {
        $fallback = 'xl/worksheets/sheet1.xml';

        $workbookXml = $zip->getFromName('xl/workbook.xml');
        $relsXml = $zip->getFromName('xl/_rels/workbook.xml.rels');

        if ($workbookXml === false || $relsXml === false) {
            return $fallback;
        }

        try {
            $workbook = $this->loadXml($workbookXml, 'Workbook Excel tidak bisa dibaca.');
            $rels = $this->loadXml($relsXml, 'Relasi workbook Excel tidak bisa dibaca.');
        } catch (RuntimeException) {
            return $fallback;
        }

        $workbookXpath = new DOMXPath($workbook);
        $workbookXpath->registerNamespace('m', self::XLSX_NS);
        $workbookXpath->registerNamespace('r', self::REL_NS);

        $sheets = $workbookXpath->query('//m:sheets/m:sheet');

        if ($sheets === false || $sheets->length === 0) {
            return $fallback;
        }

        /** @var DOMElement $firstSheet */
        $firstSheet = $sheets->item(0);
        $rid = $firstSheet->getAttributeNS(self::REL_NS, 'id');

        if ($rid === '') {
            return $fallback;
        }

        $relsXpath = new DOMXPath($rels);
        $relsXpath->registerNamespace('p', self::PKG_REL_NS);

        foreach ($relsXpath->query('//p:Relationship') ?: [] as $rel) {
            if (! $rel instanceof DOMElement || $rel->getAttribute('Id') !== $rid) {
                continue;
            }

            $target = ltrim($rel->getAttribute('Target'), '/');

            return str_starts_with($target, 'xl/') ? $target : 'xl/' . $target;
        }

        return $fallback;
    }

    /**
     * Ambil teks anak langsung (mis. <v>) dari sebuah sel.
     */
    private function nodeText(DOMXPath $xpath, string $query, DOMElement $context): string
    {
        $node = $xpath->query($query, $context);

        if ($node === false || $node->length === 0) {
            return '';
        }

        return trim($node->item(0)->textContent);
    }

    private function loadXml(string $xml, string $errorMessage): DOMDocument
    {
        $previous = libxml_use_internal_errors(true);
        libxml_clear_errors();

        $doc = new DOMDocument();

        // LIBXML_NONET: cegah pengambilan resource jaringan dari XML tak dikenal
        $ok = $doc->loadXML($xml, LIBXML_NONET);

        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        if (! $ok) {
            throw new RuntimeException($errorMessage);
        }

        return $doc;
    }

    /**
     * "B3" -> 1 (nol-indeks kolom).
     */
    private function columnIndex(string $reference): int
    {
        if (! preg_match('/^([A-Z]+)/i', $reference, $matches)) {
            return 0;
        }

        $index = 0;

        foreach (str_split(strtoupper($matches[1])) as $char) {
            $index = $index * 26 + (ord($char) - 64);
        }

        return $index - 1;
    }

    // ------------------------------------------------------------------
    // Normalisasi nilai
    // ------------------------------------------------------------------

    private function readPlainText(string $path): string
    {
        $raw = (string) file_get_contents($path);

        // BOM UTF-8 yang sering disisipkan Excel
        $raw = preg_replace('/^\xEF\xBB\xBF/', '', $raw) ?? $raw;

        // CSV dari Excel Indonesia biasanya Windows-1252, bukan UTF-8
        if (! mb_check_encoding($raw, 'UTF-8')) {
            $raw = mb_convert_encoding($raw, 'UTF-8', 'Windows-1252');
        }

        return $raw;
    }

    private function cleanCell(string $value): string
    {
        $value = preg_replace('/\s+/u', ' ', trim($value)) ?? '';

        // Buang tanda kutip pembungkus dari CSV
        return trim($value, " \t\"'");
    }

    private function cleanName(string $value): string
    {
        $value = preg_replace('/\s+/u', ' ', trim($value)) ?? '';

        // "1. Budi" / "1) Budi" / "1 - Budi" -> "Budi"
        $value = preg_replace('/^\d+\s*[.)\-–]\s*/u', '', $value) ?? $value;

        return trim($value);
    }

    /**
     * Terima "4A", "4a", "4 A", "Kelas 4A" -> "4A". Selain itu null.
     */
    private function normalizeRombel(string $value): ?string
    {
        $candidate = mb_strtoupper(trim($value));
        $candidate = preg_replace('/^(KELAS|KLS|CLASS)\s*/u', '', $candidate) ?? $candidate;
        $candidate = preg_replace('/\s+/u', '', $candidate) ?? $candidate;

        // Rombel = angka 1-6 + huruf A/B.
        return preg_match('/^[1-6][AB]$/', $candidate) ? $candidate : null;
    }

    private function isNumeric(string $value): bool
    {
        return (bool) preg_match('/^\d+([.,]\d+)?$/', trim($value));
    }

    /**
     * @param  array<int, string>  $cells
     */
    private function looksLikeHeader(array $cells): bool
    {
        $hits = 0;

        foreach ($cells as $cell) {
            if (in_array(mb_strtolower(trim($cell)), self::HEADER_WORDS, true)) {
                $hits++;
            }
        }

        // Sebagian besar sel berupa kata kunci judul -> anggap baris judul
        return $hits >= max(1, (int) ceil(count($cells) / 2));
    }
}

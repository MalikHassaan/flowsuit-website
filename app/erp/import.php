<?php
// Reads an uploaded .xlsx or .csv into ['columns' => [...], 'rows' => [[...], ...]],
// and works out receivables figures (total, aging, top customers) from whatever columns it has.

const ERP_MAX_ROWS = 20000;
const ERP_MAX_COLS = 60;

function erp_read_table(string $path, string $name): array
{
    $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    if ($ext === 'xlsx') {
        $grid = erp_read_xlsx($path);
    } elseif ($ext === 'csv' || $ext === 'txt') {
        $grid = erp_read_csv($path);
    } else {
        throw new RuntimeException('Upload an Excel file (.xlsx) or a .csv file. Old .xls files: open in Excel and "Save as" .xlsx first.');
    }

    // The header is the first row with at least two filled cells (reports often start with a title line).
    $headerAt = null;
    foreach ($grid as $i => $row) {
        if (count(array_filter($row, fn($v) => trim((string) $v) !== '')) >= 2) {
            $headerAt = $i;
            break;
        }
    }
    if ($headerAt === null) {
        throw new RuntimeException('The file looks empty: no row with at least two filled cells.');
    }
    $columns = [];
    foreach (array_slice($grid[$headerAt], 0, ERP_MAX_COLS) as $i => $h) {
        $h = trim(preg_replace('/\s+/', ' ', (string) $h));
        $columns[] = $h !== '' ? mb_substr($h, 0, 80) : 'Column ' . ($i + 1);
    }

    $dateCols = [];
    foreach ($columns as $i => $h) {
        if (preg_match('/date|due on|dated/i', $h)) {
            $dateCols[$i] = true;
        }
    }

    $rows = [];
    foreach (array_slice($grid, $headerAt + 1) as $row) {
        $cells = [];
        foreach ($columns as $i => $_) {
            $v = trim((string) ($row[$i] ?? ''));
            // Excel stores dates as day numbers; turn them back into dates in date columns.
            if (isset($dateCols[$i]) && is_numeric($v) && $v > 20000 && $v < 80000) {
                $v = gmdate('Y-m-d', (int) round(((float) $v - 25569) * 86400));
            }
            $cells[] = mb_substr($v, 0, 300);
        }
        if (!array_filter($cells, fn($v) => $v !== '')) {
            continue;
        }
        $rows[] = $cells;
        if (count($rows) >= ERP_MAX_ROWS) {
            break;
        }
    }
    if (!$rows) {
        throw new RuntimeException('Found the headings but no data rows under them.');
    }
    return ['columns' => $columns, 'rows' => $rows];
}

function erp_read_csv(string $path): array
{
    $fh = fopen($path, 'r');
    if (!$fh) {
        throw new RuntimeException('Could not read the file.');
    }
    $first = (string) fgets($fh);
    rewind($fh);
    $first = preg_replace('/^\xEF\xBB\xBF/', '', $first);
    $delims = [',' => substr_count($first, ','), ';' => substr_count($first, ';'), "\t" => substr_count($first, "\t")];
    arsort($delims);
    $delim = array_key_first($delims);
    $grid = [];
    while (($row = fgetcsv($fh, 0, $delim, '"', '')) !== false && count($grid) < ERP_MAX_ROWS + 50) {
        if (!$grid && isset($row[0])) {
            $row[0] = preg_replace('/^\xEF\xBB\xBF/', '', (string) $row[0]);
        }
        $grid[] = array_map(fn($v) => mb_convert_encoding((string) $v, 'UTF-8', 'UTF-8, Windows-1252'), $row);
    }
    fclose($fh);
    return $grid;
}

// Minimal .xlsx reader: first worksheet, values only. Avoids pulling in a large library.
function erp_read_xlsx(string $path): array
{
    if (!class_exists('ZipArchive')) {
        throw new RuntimeException('This server cannot read .xlsx files. Save the report as .csv and upload that.');
    }
    $zip = new ZipArchive();
    if ($zip->open($path) !== true) {
        throw new RuntimeException('This is not a valid .xlsx file.');
    }
    $read = function (string $name) use ($zip): ?SimpleXMLElement {
        $stat = $zip->statName($name);
        if (!$stat || $stat['size'] > 80 * 1024 * 1024) {
            return null;
        }
        $xml = $zip->getFromName($name);
        return $xml === false ? null : (simplexml_load_string($xml, 'SimpleXMLElement', LIBXML_NONET | LIBXML_COMPACT) ?: null);
    };

    $shared = [];
    if ($sst = $read('xl/sharedStrings.xml')) {
        foreach ($sst->si as $si) {
            $text = (string) $si->t;
            foreach ($si->r as $run) {
                $text .= (string) $run->t;
            }
            $shared[] = $text;
        }
    }

    // Find the first sheet's file through the workbook relationships.
    $sheetFile = 'xl/worksheets/sheet1.xml';
    $wb = $read('xl/workbook.xml');
    $rels = $read('xl/_rels/workbook.xml.rels');
    if ($wb && $rels && isset($wb->sheets->sheet[0])) {
        $rid = (string) $wb->sheets->sheet[0]->attributes('http://schemas.openxmlformats.org/officeDocument/2006/relationships')['id'];
        foreach ($rels->Relationship as $rel) {
            if ((string) $rel['Id'] === $rid) {
                $target = ltrim((string) $rel['Target'], '/');
                $sheetFile = strpos($target, 'xl/') === 0 ? $target : 'xl/' . $target;
            }
        }
    }
    $sheet = $read($sheetFile);
    $zip->close();
    if (!$sheet) {
        throw new RuntimeException('Could not find a worksheet in this file.');
    }

    $grid = [];
    foreach ($sheet->sheetData->row as $row) {
        $cells = [];
        foreach ($row->c as $c) {
            $ref = (string) $c['r'];
            $col = 0;
            if (preg_match('/^([A-Z]+)/', $ref, $m)) {
                foreach (str_split($m[1]) as $ch) {
                    $col = $col * 26 + (ord($ch) - 64);
                }
                $col--;
            } else {
                $col = count($cells);
            }
            if ($col >= ERP_MAX_COLS) {
                continue;
            }
            $type = (string) $c['t'];
            if ($type === 's') {
                $v = $shared[(int) $c->v] ?? '';
            } elseif ($type === 'inlineStr') {
                $v = (string) $c->is->t;
            } else {
                $v = (string) $c->v;
            }
            $cells[$col] = $v;
        }
        if ($cells) {
            $max = max(array_keys($cells));
            $grid[] = array_replace(array_fill(0, $max + 1, ''), $cells);
        }
        if (count($grid) >= ERP_MAX_ROWS + 50) {
            break;
        }
    }
    return $grid;
}

// "1,250.50", "(300)", "Rs 4,000" -> float; null when the cell is not a number.
function erp_number(string $v): ?float
{
    $v = trim($v);
    if ($v === '' || $v === '-') {
        return null;
    }
    $neg = false;
    if (preg_match('/^\((.*)\)$/', $v, $m)) {
        $neg = true;
        $v = $m[1];
    }
    $v = preg_replace('/(?i)^(rs\.?|pkr|usd|aed|\$|£|€)\s*|\s*(rs\.?|pkr|cr|dr)$/i', '', $v);
    $v = str_replace([',', ' '], '', $v);
    if (!is_numeric($v)) {
        return null;
    }
    return $neg ? -(float) $v : (float) $v;
}

function erp_is_total_row(array $row): bool
{
    foreach ($row as $v) {
        if ($v !== '') {
            return (bool) preg_match('/^(grand\s+)?(sub\s*)?total\b/i', $v);
        }
    }
    return false;
}

// Guess which columns mean what, then add up the report. Works on whatever headings the file has.
function erp_receivables_summary(array $columns, array $rows): array
{
    $find = function (string $pattern, bool $numeric = false) use ($columns, $rows): ?int {
        foreach ($columns as $i => $h) {
            if (!preg_match($pattern, $h)) {
                continue;
            }
            if ($numeric) {
                $nums = 0;
                foreach (array_slice($rows, 0, 50) as $r) {
                    $nums += erp_number($r[$i] ?? '') !== null ? 1 : 0;
                }
                if ($nums === 0) {
                    continue;
                }
            }
            return $i;
        }
        return null;
    };

    $data = array_values(array_filter($rows, fn($r) => !erp_is_total_row($r)));
    $customer = $find('/customer|client|party|debtor|account name|name/i');
    $amount = $find('/balance|outstanding|receivable|net due|amount due|due amount/i', true)
        ?? $find('/amount|total|value/i', true);

    // Reports that already split the balance into age columns (0-30, 31-60, ...).
    $bucketCols = [];
    foreach ($columns as $i => $h) {
        if (preg_match('/^(current|not due|\d+\s*(-|–|to)\s*\d+|\d+\s*\+|(over|above|more than|>)\s*\d+)/i', trim($h))) {
            $bucketCols[$i] = $h;
        }
    }

    $buckets = [];
    $basis = null;
    if (count($bucketCols) >= 2) {
        $basis = 'from the age columns in the file';
        foreach ($bucketCols as $i => $h) {
            $buckets[$h] = 0.0;
        }
        foreach ($data as $r) {
            foreach ($bucketCols as $i => $h) {
                $buckets[$h] += erp_number($r[$i] ?? '') ?? 0;
            }
        }
    } else {
        $days = $find('/days|age|aging|ageing|overdue/i', true);
        $due = $find('/due date|due on|due/i');
        $inv = $find('/invoice date|bill date|date/i');
        $today = new DateTimeImmutable('today');
        $ageOf = null;
        if ($days !== null) {
            $basis = 'from the "' . $columns[$days] . '" column';
            $ageOf = fn($r) => erp_number($r[$days] ?? '');
        } elseif ($due !== null || $inv !== null) {
            $col = $due ?? $inv;
            $basis = 'days since "' . $columns[$col] . '"';
            $ageOf = function ($r) use ($col, $today) {
                $ts = strtotime(str_replace('/', '-', (string) ($r[$col] ?? '')));
                return $ts ? (float) $today->diff(new DateTimeImmutable('@' . $ts))->days * ($ts > $today->getTimestamp() ? -1 : 1) : null;
            };
        }
        if ($ageOf && $amount !== null) {
            $buckets = ['Not due' => 0.0, '1-30 days' => 0.0, '31-60 days' => 0.0, '61-90 days' => 0.0, '90+ days' => 0.0];
            foreach ($data as $r) {
                $age = $ageOf($r);
                $amt = erp_number($r[$amount] ?? '') ?? 0;
                if ($age === null) {
                    continue;
                }
                $key = $age <= 0 ? 'Not due' : ($age <= 30 ? '1-30 days' : ($age <= 60 ? '31-60 days' : ($age <= 90 ? '61-90 days' : '90+ days')));
                $buckets[$key] += $amt;
            }
        }
    }

    $total = null;
    if ($amount !== null) {
        $total = 0.0;
        foreach ($data as $r) {
            $total += erp_number($r[$amount] ?? '') ?? 0;
        }
    } elseif ($buckets) {
        $total = array_sum($buckets);
    }

    $top = [];
    if ($customer !== null && ($amount !== null || $bucketCols)) {
        foreach ($data as $r) {
            $name = trim((string) ($r[$customer] ?? ''));
            if ($name === '') {
                continue;
            }
            $amt = $amount !== null ? (erp_number($r[$amount] ?? '') ?? 0)
                : array_sum(array_map(fn($i) => erp_number($r[$i] ?? '') ?? 0, array_keys($bucketCols)));
            $top[$name] = ($top[$name] ?? 0) + $amt;
        }
        arsort($top);
    }

    $numeric = [];
    foreach ($columns as $i => $h) {
        $count = 0;
        foreach (array_slice($data, 0, 50) as $r) {
            $count += erp_number($r[$i] ?? '') !== null ? 1 : 0;
        }
        $numeric[$i] = $count > 0 && $count >= min(count($data), 50) * 0.6;
    }

    $oldest = $buckets ? array_key_last($buckets) : null;
    return [
        'customer'  => $customer,
        'amount'    => $amount,
        'total'     => $total,
        'customers' => count($top),
        'buckets'   => $buckets,
        'basis'     => $basis,
        'oldest'    => $oldest,
        'oldestSum' => $oldest !== null ? $buckets[$oldest] : null,
        'top'       => array_slice($top, 0, 8, true),
        'numeric'   => $numeric,
        'rows'      => count($data),
    ];
}

function erp_money(?float $v): string
{
    if ($v === null) {
        return '-';
    }
    return ($v < 0 ? '-' : '') . number_format(abs($v), abs($v) >= 1000 ? 0 : 2);
}

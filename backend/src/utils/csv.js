import { HttpError } from './httpError.js';

export function parseCsv(text, { maximumRows = 1000, maximumColumns = 80 } = {}) {
  if (typeof text !== 'string' || !text.trim()) throw new HttpError(400, 'CSV content is required.');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let afterQuote = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
        afterQuote = true;
      } else {
        field += character;
      }
      continue;
    }
    if (afterQuote && character !== ',' && character !== '\n' && character !== '\r' && character !== ' ' && character !== '\t') {
      throw new HttpError(400, 'CSV contains invalid characters after a quoted value.');
    }
    if (character === '"') {
      if (field.length || afterQuote) throw new HttpError(400, 'CSV contains a misplaced quote.');
      quoted = true;
      continue;
    }
    if (character === ',') {
      row.push(field);
      field = '';
      afterQuote = false;
      continue;
    }
    if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field);
      rows.push(row);
      if (rows.length > maximumRows + 1) throw new HttpError(413, `CSV may contain at most ${maximumRows} data rows.`);
      row = [];
      field = '';
      afterQuote = false;
      continue;
    }
    if (!afterQuote) field += character;
  }
  if (quoted) throw new HttpError(400, 'CSV contains an unclosed quoted value.');
  if (field.length || row.length || afterQuote) {
    row.push(field);
    rows.push(row);
  }
  while (rows.length && rows[rows.length - 1].every((value) => !value.trim())) rows.pop();
  if (rows.length - 1 > maximumRows) {
    throw new HttpError(413, `CSV may contain at most ${maximumRows} data rows.`);
  }
  if (rows.length < 2) throw new HttpError(400, 'CSV must contain a header and at least one data row.');

  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, '').trim());
  if (headers.length > maximumColumns || headers.some((header) => !header) ||
      new Set(headers.map((header) => header.toLowerCase())).size !== headers.length) {
    throw new HttpError(400, 'CSV headers must be non-empty, unique, and within the supported column limit.');
  }
  if (rows.slice(1).some((dataRow) => dataRow.length !== headers.length)) {
    throw new HttpError(400, 'Every CSV data row must have the same number of columns as the header.');
  }
  return rows.slice(1).map((dataRow, index) => ({
    rowNumber: index + 2,
    values: Object.fromEntries(headers.map((header, column) => [header, dataRow[column]]))
  }));
}

export function serializeCsv(headers, rows) {
  const quote = (value) => {
    const text = value == null ? '' : String(value);
    const safe = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
    return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
  };
  return [
    headers.map(quote).join(','),
    ...rows.map((row) => headers.map((header) => quote(row[header])).join(','))
  ].join('\r\n');
}

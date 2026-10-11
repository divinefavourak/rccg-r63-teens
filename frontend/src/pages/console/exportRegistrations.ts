import api from '../../api/axios';
import { parseAPIDate } from '../../utils/dates';

/**
 * One event's registrations, as a file to keep or print.
 *
 * Built in the browser from the same endpoint the table reads, a page at a
 * time, so an export holds exactly what this person is allowed to see and
 * honours the filter and search that are on the screen. Nothing new is asked
 * of the server.
 */

/** The fields of `EventRegistrationListSerializer` that go into a file. */
export interface ExportRow {
  registration_id: string;
  attendee_name: string;
  attendee_email: string;
  attendee_phone?: string;
  attendee_gender?: string;
  attendee_province?: string;
  attendee_parish?: string;
  attending_as_leader?: boolean;
  status: string;
  payment_status: string;
  bed?: { code: string; hostel: string } | null;
  checked_in_at?: string | null;
  created_at?: string;
}

export interface ExportEvent {
  id: string;
  title: string;
  bedspaces_enabled?: boolean;
}

export interface ExportScope {
  status?: string;
  search?: string;
}

/** The most the API hands over in one page (`DefaultPagination.max_page_size`). */
const PAGE = 200;

/** Every registration the filter matches, however many pages that is. */
export async function fetchRegistrations(event: ExportEvent, scope: ExportScope): Promise<ExportRow[]> {
  const rows: ExportRow[] = [];
  for (let page = 1; ; page++) {
    const { data } = await api.get<{ results?: ExportRow[]; next?: string | null } | ExportRow[]>(
      `/events/events/${event.id}/registrations/`,
      { params: { status: scope.status, search: scope.search, page, page_size: PAGE } },
    );
    if (Array.isArray(data)) return data;
    rows.push(...(data.results ?? []));
    if (!data.next || !data.results?.length) return rows;
  }
}

const label = (value: string | undefined) =>
  value ? value.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : '';

const when = (iso: string | null | undefined) => {
  const date = iso ? parseAPIDate(iso) : null;
  return date
    ? date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
};

const bed = (row: ExportRow) => (row.bed ? `${row.bed.hostel} ${row.bed.code}` : '');

interface Column {
  heading: string;
  value: (row: ExportRow) => string;
}

function columns(event: ExportEvent): Column[] {
  return [
    { heading: 'Ticket', value: (r) => r.registration_id },
    { heading: 'Name', value: (r) => r.attendee_name },
    { heading: 'Email', value: (r) => r.attendee_email },
    { heading: 'Phone', value: (r) => r.attendee_phone ?? '' },
    { heading: 'Gender', value: (r) => label(r.attendee_gender) },
    { heading: 'Province', value: (r) => r.attendee_province ?? '' },
    { heading: 'Parish', value: (r) => r.attendee_parish ?? '' },
    { heading: 'Attending as', value: (r) => (r.attending_as_leader ? 'Leader' : 'Attendee') },
    { heading: 'Status', value: (r) => label(r.status) },
    { heading: 'Payment', value: (r) => label(r.payment_status) },
    ...(event.bedspaces_enabled ? [{ heading: 'Bed', value: bed }] : []),
    { heading: 'Checked in', value: (r) => when(r.checked_in_at) },
    { heading: 'Registered', value: (r) => when(r.created_at) },
  ];
}

/**
 * One CSV cell. Quoted when it has to be, and a value that a spreadsheet would
 * run as a formula (a name typed as `=…`, `+…`, `-…` or `@…`) is given a
 * leading apostrophe so it stays text: these are words people typed into a
 * sign-up form, opened later on a leader's computer.
 */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function fileName(event: ExportEvent, extension: string): string {
  const slug = event.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const day = new Date().toISOString().slice(0, 10);
  return `${slug || 'event'}-registrations-${day}.${extension}`;
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Let the click start the download before the address is withdrawn.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCsv(event: ExportEvent, rows: ExportRow[]) {
  const cols = columns(event);
  const lines = [
    cols.map((c) => cell(c.heading)).join(','),
    ...rows.map((row) => cols.map((c) => cell(c.value(row))).join(',')),
  ];
  // The byte-order mark is what makes Excel read the file as UTF-8, so names
  // with accents and tone marks survive.
  save(new Blob(['\uFEFF', lines.join('\r\n'), '\r\n'], { type: 'text/csv;charset=utf-8' }), fileName(event, 'csv'));
}

/**
 * jsPDF's built-in fonts only cover Western European letters. Tone marks and
 * dotted vowels (Ọ, ẹ, ṣ) would print as stray symbols, so they are reduced
 * to their base letter here. The CSV keeps every name exactly as typed.
 */
const plain = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '?');

export async function downloadPdf(event: ExportEvent, rows: ExportRow[], scopeLabel: string) {
  // Loaded only when someone exports: it is far larger than this page.
  const { default: JsPDF } = await import('jspdf');
  const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const MARGIN = 12;
  const WIDTH = doc.internal.pageSize.getWidth();
  const HEIGHT = doc.internal.pageSize.getHeight();
  const ROW = 7;

  // The sheet is narrower than the CSV: what a person at the gate or with a
  // clipboard needs, in widths (mm) that add up to the printable 273.
  const cols: (Column & { width: number })[] = [
    { heading: 'Ticket', width: 36, value: (r) => r.registration_id },
    { heading: 'Name', width: event.bedspaces_enabled ? 54 : 66, value: (r) => r.attendee_name },
    { heading: 'Phone', width: 30, value: (r) => r.attendee_phone ?? '' },
    { heading: 'Parish', width: event.bedspaces_enabled ? 50 : 68, value: (r) => r.attendee_parish ?? '' },
    { heading: 'As', width: 18, value: (r) => (r.attending_as_leader ? 'Leader' : 'Attendee') },
    { heading: 'Status', width: 24, value: (r) => label(r.status) },
    { heading: 'Payment', width: 22, value: (r) => label(r.payment_status) },
    ...(event.bedspaces_enabled ? [{ heading: 'Bed', width: 30, value: bed }] : []),
  ];
  const NUMBER = WIDTH - 2 * MARGIN - cols.reduce((sum, c) => sum + c.width, 0);

  /** The text cut to its column, with an ellipsis when something was lost. */
  const fit = (text: string, width: number) => {
    const clean = plain(text);
    if (doc.getTextWidth(clean) <= width - 3) return clean;
    let cut = clean;
    while (cut.length > 1 && doc.getTextWidth(`${cut}...`) > width - 3) cut = cut.slice(0, -1);
    return `${cut.trimEnd()}...`;
  };

  let y = MARGIN;
  const heading = (first: boolean) => {
    y = MARGIN;
    if (first) {
      doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(28, 25, 22);
      doc.text(fit(event.title, WIDTH - 2 * MARGIN), MARGIN, y + 5);
      doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(111, 104, 98);
      const count = `${rows.length.toLocaleString()} ${rows.length === 1 ? 'registration' : 'registrations'}`;
      doc.text(`${count} · ${plain(scopeLabel)} · exported ${when(new Date().toISOString())}`, MARGIN, y + 11);
      y += 16;
    }
    doc.setFillColor(242, 234, 224).rect(MARGIN, y, WIDTH - 2 * MARGIN, ROW, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(28, 25, 22);
    let x = MARGIN;
    doc.text('#', x + 1.5, y + 4.8);
    x += NUMBER;
    for (const col of cols) {
      doc.text(col.heading, x + 1.5, y + 4.8);
      x += col.width;
    }
    y += ROW;
    doc.setFont('helvetica', 'normal');
  };

  heading(true);
  rows.forEach((row, index) => {
    if (y + ROW > HEIGHT - MARGIN - 4) {
      doc.addPage();
      heading(false);
    }
    doc.setTextColor(28, 25, 22);
    let x = MARGIN;
    doc.text(String(index + 1), x + 1.5, y + 4.8);
    x += NUMBER;
    for (const col of cols) {
      doc.text(fit(col.value(row), col.width), x + 1.5, y + 4.8);
      x += col.width;
    }
    doc.setDrawColor(234, 227, 218).line(MARGIN, y + ROW, WIDTH - MARGIN, y + ROW);
    y += ROW;
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFontSize(8).setTextColor(111, 104, 98);
    doc.text(`Page ${page} of ${pages}`, WIDTH - MARGIN, HEIGHT - 6, { align: 'right' });
  }

  doc.save(fileName(event, 'pdf'));
}

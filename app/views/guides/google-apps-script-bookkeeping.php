<p>If your books live in Google Sheets, you already have a free automation tool built in: Google Apps Script. It runs inside your spreadsheet, can read and write any cell, send emails and create documents, and it can run on a timer. Here are five automations that save bookkeepers real time every week.</p>

<h2>1. Automatic invoice numbers</h2>
<p>Duplicate or skipped invoice numbers cause trouble with customers and auditors. A short script can watch the invoice sheet and assign the next number the moment a new row is added, so nobody types numbers by hand.</p>
<pre><code>function onEdit(e) {
  const sheet = e.range.getSheet();
  if (sheet.getName() !== 'Invoices' || e.range.getColumn() !== 2) return;
  const row = e.range.getRow();
  const idCell = sheet.getRange(row, 1);
  if (idCell.getValue()) return;
  const props = PropertiesService.getDocumentProperties();
  const next = Number(props.getProperty('nextInvoice') || 1001);
  idCell.setValue('INV-' + next);
  props.setProperty('nextInvoice', String(next + 1));
}</code></pre>

<h2>2. Turn a row into a PDF invoice and email it</h2>
<p>Most small businesses copy invoice details into a Word template, export a PDF and attach it to an email. Apps Script can fill a Google Docs template from the selected row, save it as a PDF in Drive and email it to the customer in one click from a custom menu.</p>

<h2>3. Payment reminders for overdue invoices</h2>
<p>A script that runs every morning can check the due date and status columns, and send a polite reminder to any customer whose invoice is overdue and still unpaid. It can copy you on each email and record the reminder date on the row, so you never chase the same customer twice in a day.</p>

<h2>4. Import bank statements into a standard layout</h2>
<p>Every bank exports CSV files slightly differently. A script can take the downloaded file, map its columns into your own ledger layout, skip transactions already imported, and highlight the ones that still need a category. Reconciliation goes from an afternoon to a few minutes.</p>

<h2>5. Month-end checklist and summary email</h2>
<p>On the last working day of the month, a timed script can total income and expenses by category, compare them with last month, and email the owner a short summary. It can also lock last month's rows so they cannot be edited after the books are closed.</p>

<div class="callout"><strong>Good to know:</strong> scripts run under the Google account that installs them. Use a shared business account rather than a personal one, so automations keep working when staff change.</div>

<h2>When Apps Script is enough, and when it is not</h2>
<p>Apps Script is ideal when your team is comfortable in Sheets and the volume is modest. It starts to struggle when several people edit at once, when you need strict permissions per user, or when the sheet grows past tens of thousands of rows. At that point, dedicated <a href="/products/finance">finance software</a> is a better home for the books.</p>
<p>FlowSuit builds and maintains <a href="/services/google-apps-script">Google Apps Script automations</a> for businesses that want to keep their sheets, and moves the ones that have outgrown them into <a href="/products/finance">FlowSuit Finance</a>.</p>

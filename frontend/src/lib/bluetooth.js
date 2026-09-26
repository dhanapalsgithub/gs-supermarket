/* Web Bluetooth ESC/POS for Milestone Y50 (58mm) */
/* eslint-disable no-bitwise */

const PRINTER_SERVICES = [
  0x18f0, // Milestone Y50 typical
  "000018f0-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000fff0-0000-1000-8000-00805f9b34fb",
];

const CHAR_UUIDS = [
  0x2af1,
  "00002af1-0000-1000-8000-00805f9b34fb",
  "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f",
  "0000ff02-0000-1000-8000-00805f9b34fb",
  "0000fff2-0000-1000-8000-00805f9b34fb",
];

let deviceRef = null;
let charRef = null;

function isBleAvailable() {
  return typeof navigator !== "undefined" && !!navigator.bluetooth;
}

async function pickCharacteristic(server) {
  for (const s of PRINTER_SERVICES) {
    try {
      const svc = await server.getPrimaryService(s);
      const chars = await svc.getCharacteristics();
      const writable = chars.find(
        (c) => c.properties.write || c.properties.writeWithoutResponse
      );
      if (writable) return writable;
      for (const cu of CHAR_UUIDS) {
        try {
          const ch = await svc.getCharacteristic(cu);
          if (ch.properties.write || ch.properties.writeWithoutResponse) return ch;
        } catch {}
      }
    } catch {}
  }
  return null;
}

export async function connectPrinter() {
  if (!isBleAvailable()) throw new Error("Web Bluetooth not supported. Use Chrome or Edge on desktop.");
  const device = await navigator.bluetooth.requestDevice({
    filters: [
      { namePrefix: "Milestone" },
      { namePrefix: "MHT" },
      { namePrefix: "Printer" },
      { namePrefix: "BT" },
    ],
    optionalServices: PRINTER_SERVICES,
  });
  const server = await device.gatt.connect();
  const ch = await pickCharacteristic(server);
  if (!ch) throw new Error("No writable characteristic found on printer");
  deviceRef = device;
  charRef = ch;
  device.addEventListener("gattserverdisconnected", () => { charRef = null; });
  return { name: device.name || "Milestone Y50" };
}

export function isConnected() {
  return !!(charRef && deviceRef && deviceRef.gatt && deviceRef.gatt.connected);
}

export async function disconnectPrinter() {
  try {
    if (deviceRef && deviceRef.gatt && deviceRef.gatt.connected) deviceRef.gatt.disconnect();
  } catch {}
  charRef = null; deviceRef = null;
}

async function writeChunks(bytes) {
  const CHUNK = 180;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const chunk = bytes.slice(i, i + CHUNK);
    // eslint-disable-next-line no-await-in-loop
    try {
      if (charRef.properties.write) await charRef.writeValueWithResponse(chunk);
      else await charRef.writeValueWithoutResponse(chunk);
    } catch (e) {
      // fallback
      await charRef.writeValue(chunk);
    }
  }
}

// ESC/POS command helpers
const ESC = 0x1b, GS = 0x1d, LF = 0x0a;

function encodeText(str) {
  // Use Latin1/CP437 fallback via TextEncoder for ASCII
  return new TextEncoder().encode(str);
}

function buildReceiptBytes(sale) {
  const parts = [];
  const push = (arr) => parts.push(new Uint8Array(arr));
  const line = (str) => parts.push(encodeText(str + "\n"));
  const dashes = () => line("--------------------------------");

  // init
  push([ESC, 0x40]);
  // codepage cp437
  push([ESC, 0x74, 0x00]);
  // center + bold + double height
  push([ESC, 0x61, 0x01]);
  push([ESC, 0x21, 0x30]);
  line("R I BILLING PRO");
  push([ESC, 0x21, 0x00]);
  push([ESC, 0x45, 0x01]);
  line("CashierPro Mart");
  push([ESC, 0x45, 0x00]);
  line("Fresh Groceries - Daily Needs");
  line("GSTIN: 33ABCDE1234F1Z5");
  dashes();
  push([ESC, 0x61, 0x00]);
  line(`Receipt : ${sale.receipt_no}`);
  line(`Date    : ${new Date(sale.created_at).toLocaleString("en-IN", { hour12: true })}`);
  line(`Cashier : ${sale.cashier || "Cashier"}`);
  if (sale.customer_name) line(`Customer: ${sale.customer_name}`);
  if (sale.customer_phone) line(`Phone   : ${sale.customer_phone}`);
  dashes();
  push([ESC, 0x45, 0x01]);
  line("Item                 Qty   Amt");
  push([ESC, 0x45, 0x00]);
  dashes();
  for (const it of sale.items) {
    const n = (it.name || "").slice(0, 30);
    line(n);
    const qty = String(it.quantity);
    const amt = Number(it.subtotal).toFixed(2);
    const priceLine = `${qty} x ${Number(it.price).toFixed(2)}`;
    const spaces = Math.max(1, 32 - priceLine.length - amt.length);
    line(priceLine + " ".repeat(spaces) + amt);
  }
  dashes();
  const row = (a, b) => {
    const s = Math.max(1, 32 - a.length - b.length);
    line(a + " ".repeat(s) + b);
  };
  row("Subtotal", Number(sale.subtotal).toFixed(2));
  row(`Tax (${(sale.tax_rate * 100).toFixed(0)}%)`, Number(sale.tax_amount).toFixed(2));
  if (sale.discount > 0) row("Discount", `-${Number(sale.discount).toFixed(2)}`);
  dashes();
  push([ESC, 0x21, 0x30]);
  push([ESC, 0x61, 0x01]);
  line(`TOTAL Rs${Number(sale.total).toFixed(2)}`);
  push([ESC, 0x21, 0x00]);
  push([ESC, 0x61, 0x00]);
  row(`Paid (${sale.payment_method})`, Number(sale.amount_paid || sale.total).toFixed(2));
  if (sale.change_due > 0) row("Change", Number(sale.change_due).toFixed(2));
  dashes();
  push([ESC, 0x61, 0x01]);
  line("Thank you - Visit again!");
  line("Built by R I Billing Pro");
  line("Milestone Y50 - 58mm");
  push([LF, LF, LF, LF]);
  // cut
  push([GS, 0x56, 0x00]);

  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

export async function printReceipt(sale) {
  if (!isConnected()) throw new Error("Printer not connected");
  const bytes = buildReceiptBytes(sale);
  await writeChunks(bytes);
}

export { isBleAvailable };

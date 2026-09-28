let port = null;
let writer = null;

export function isUsbAvailable() {
  return "serial" in navigator;
}

export function isUsbConnected() {
  return port !== null && writer !== null;
}

export async function connectUsbPrinter() {
  if (!isUsbAvailable()) {
    throw new Error("Web Serial API is not supported in this browser. Use Chrome or Edge.");
  }
  // Prompts user to select the connected Retsol USB thermal printer
  port = await navigator.serial.requestPort();
  await port.open({ baudRate: 9600 }); // Standard baud rate for Retsol receipt printers
  writer = port.writable.getWriter();
  return { name: "Retsol RTP-80 USB Printer" };
}

export async function disconnectUsbPrinter() {
  try {
    if (writer) {
      await writer.releaseLock();
      writer = null;
    }
    if (port) {
      await port.close();
      port = null;
    }
  } catch (e) {
    console.error(e);
  }
}

export async function printUsbReceipt(order) {
  if (!isUsbConnected()) {
    throw new Error("USB printer is not connected");
  }

  const encoder = new TextEncoder();
  const commands = [];

  // ESC/POS Commands optimized for 80mm width (48 chars per line approx)
  commands.push(new Uint8Array([0x1B, 0x40])); // Initialize printer
  commands.push(new Uint8Array([0x1B, 0x61, 0x01])); // Center align
  commands.push(encoder.encode("STORE BILL\n"));
  commands.push(encoder.encode("================================\n"));
  
  commands.push(new Uint8Array([0x1B, 0x61, 0x00])); // Left align
  commands.push(encoder.encode(`Bill ID: #${order.id || "POS"}\n`));
  commands.push(encoder.encode(`Date: ${new Date().toLocaleString()}\n`));
  commands.push(encoder.encode(`Cashier: ${order.cashier || "Counter"}\n`));
  if (order.customer_name) {
    commands.push(encoder.encode(`Customer: ${order.customer_name} (${order.customer_phone || ""})\n`));
  }
  commands.push(encoder.encode("--------------------------------\n"));
  commands.push(encoder.encode("Item            Qty   Price  Total\n"));
  commands.push(encoder.encode("--------------------------------\n"));

  order.items.forEach(item => {
    const name = item.name.padEnd(14, " ").substring(0, 14);
    const qty = String(item.quantity).padStart(3, " ");
    const price = String(item.price.toFixed(2)).padStart(6, " ");
    const sub = String(item.subtotal.toFixed(2)).padStart(7, " ");
    commands.push(encoder.encode(`${name} ${qty} ${price} ${sub}\n`));
  });

  commands.push(encoder.encode("--------------------------------\n"));
  commands.push(encoder.encode(`Subtotal: Rs. ${order.subtotal.toFixed(2)}\n`));
  commands.push(encoder.encode(`Tax (5%): Rs. ${order.tax_amount.toFixed(2)}\n`));
  if (order.discount > 0) {
    commands.push(encoder.encode(`Discount: -Rs. ${order.discount.toFixed(2)}\n`));
  }
  commands.push(encoder.encode(`TOTAL: Rs. ${order.total.toFixed(2)}\n`));
  commands.push(encoder.encode(`Payment: ${order.payment_method}\n`));
  
  commands.push(new Uint8Array([0x1B, 0x61, 0x01])); // Center align
  commands.push(encoder.encode("\nThank you for shopping with us!\n"));
  commands.push(encoder.encode("Retsol RTP-80 · 230mm/s\n\n\n"));
  
  // Cut paper command (Partial cut)
  commands.push(new Uint8Array([0x1D, 0x56, 0x42, 0x00]));

  for (const cmd of commands) {
    await writer.write(cmd);
  }
}
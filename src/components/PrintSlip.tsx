import { useState, useEffect } from 'react';
import './PrintSlip.css';

export default function PrintSlip() {
  const [inputText, setInputText] = useState<string>('processing\t09-05-2025\t2012\t1\t\tManual\tKarthika Anand, 80/a2, mitta office street, krishnapuram, kadayanallur, Kadayanallur, Tamil Nadu 627759  Phone 9342579621');
  const [output, setOutput] = useState<string>('');

  useEffect(() => {
    // Load JsBarcode script
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const generateSlips = () => {
    const rawInput = inputText.trim();
    const lines = rawInput.split('\n');
    let outputHtml = '';

    const fromAddress = `TSMC Creations India\n14/5 2nd Floor, Sri Saara Towers,\nBalasundaram Road, Paapanaickenpalayam,\nCoimbatore, Tamil Nadu - 641037\nPhone: 8610554711`;

    lines.forEach((line) => {
      const parts = line.split('\t');
      if (parts.length < 7) return;

      const date = parts[1];
      const orderId = parts[2];
      const qty = parts[3] || '1';
      const mode = parts[5];
      const toRaw = parts.slice(6).join(' ');
      const phoneMatch = toRaw.match(/Phone\s*=?\s*(\d+)/i);
      const phone = phoneMatch ? phoneMatch[1] : '';
      const toAddress = toRaw.replace(/Phone\s*=?\s*\d+/i, '').trim();
      
      // Calculate weight based on quantity (450g per packet)
      const singlePacketWeight = 450; // in grams
      const totalWeightGrams = parseInt(qty) * singlePacketWeight;
      const totalWeightKg = (totalWeightGrams / 1000).toFixed(2) + ' KG';

      const html = `
        <div class="slip">
          <div class="slip-header">
            <div class="ship-to" style="width: 100%; border-right: none;">
              <div class="ship-to-label">SHIP TO:</div>
              <div class="address">${toAddress}\n${phone ? `<span class="phone-highlight">${phone}</span>` : ''}</div>
            </div>
          </div>
          
          <div class="slip-details">
            <div class="details-left">
              <div class="detail-row">
                <div class="detail-label">ORDER ID:</div>
                <div class="detail-value">${orderId}</div>
              </div>
              <div class="detail-row">
                <div class="detail-label">WEIGHT:</div>
                <div class="detail-value">${totalWeightKg} (${qty} × 450g)</div>
              </div>
              <div class="detail-row">
                <div class="detail-label">DIMENSIONS:</div>
                <div class="detail-value">-</div>
              </div>
              <div class="detail-row">
                <div class="detail-label">SHIPPING DATE:</div>
                <div class="detail-value">${date}</div>
              </div>
            </div>
            <div class="details-right">
              <div class="remarks">
                <div class="remarks-label">REMARKS:</div>
                <div>Mode: ${mode} | Qty: ${qty}</div>
              </div>
            </div>
          </div>
          
          <div class="barcode-container">
            <div class="barcode-column">
              <svg class="barcode" jsbarcode-format="code128" jsbarcode-value="${orderId}" jsbarcode-textmargin="0" jsbarcode-fontoptions="bold"></svg>
            </div>
            <div class="from-column">
              <div class="from-label" style="margin-bottom: 5px;">FROM:</div>
              <img src="https://aurawill.in/cdn/shop/files/White-label.png?v=1741582343&width=200" style="height: 50px; object-fit: contain; margin-bottom: 10px;" alt="Aurawill Logo" />
              <div class="address" style="font-size: 14px;">${fromAddress}</div>
            </div>
          </div>
        </div>
      `;
      outputHtml += html;
    });
    
    setOutput(outputHtml);
    
    // Initialize barcodes after rendering
    setTimeout(() => {
      if (window.JsBarcode) {
        window.JsBarcode(".barcode").init();
      }
    }, 100);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Courier Slip Generator</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              max-width: 850px;
              margin: auto;
              background: #f9f9f9;
            }
            .slip {
              background: white;
              border: 2px solid #000;
              padding: 0;
              margin-bottom: 30px;
              border-radius: 10px;
              box-shadow: 0 2px 6px rgba(0,0,0,0.1);
              page-break-after: always;
              width: 800px;
              overflow: hidden;
            }
            .slip-header {
              display: flex;
              width: 100%;
            }
            .ship-from {
              width: 50%;
              border-bottom: 2px solid #000;
              padding: 0;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
            .ship-to {
              width: 50%;
              border-right: 2px solid #000;
              border-bottom: 2px solid #000;
              padding: 0;
              position: relative;
            }
            .ship-to-label {
              background: #000;
              color: white;
              padding: 10px 20px;
              font-weight: bold;
              font-size: 28px;
              display: inline-block;
              margin-bottom: 15px;
              border-radius: 0 0 10px 0;
            }
            .from-label {
              padding: 10px 20px;
              font-weight: bold;
              font-size: 20px;
              color: #555;
            }
            .address {
              padding: 10px 20px 20px 20px;
              font-size: 18px;
              line-height: 1.5;
            }
            .ship-to .address {
              font-size: 20px;
              font-weight: 500;
            }
            .slip-details {
              display: flex;
              width: 100%;
            }
            .details-left {
              width: 50%;
              border-right: 2px solid #000;
            }
            .details-right {
              width: 50%;
            }
            .detail-row {
              padding: 10px 20px;
              display: flex;
              border-bottom: 2px solid #000;
            }
            .detail-row:last-child {
              border-bottom: none;
            }
            .detail-label {
              font-weight: bold;
              width: 40%;
              font-size: 16px;
              color: #555;
            }
            .detail-value {
              width: 60%;
              font-size: 16px;
            }
            .remarks {
              padding: 10px 20px;
              min-height: 100px;
            }
            .remarks-label {
              font-weight: bold;
              font-size: 16px;
              margin-bottom: 10px;
              color: #555;
            }
            .barcode-container {
              padding: 20px;
              border-top: 2px solid #000;
              display: flex;
            }
            .barcode-column {
              width: 55%;
              text-align: center;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .from-column {
              width: 45%;
              text-align: left;
              padding-left: 20px;
              border-left: 1px solid #ddd;
            }
            .phone-highlight {
              background-color: #ffff00;
              padding: 2px 5px;
              font-weight: bold;
              border-radius: 3px;
            }
            .barcode {
              width: 90%;
              max-height: 120px;
            }
            @media print {
              body {
                background: white;
              }
              .slip {
                margin: 0;
                box-shadow: none;
              }
            }
          </style>
        </head>
        <body>
          <div id="output">${output}</div>
          <script>
            window.onload = function() {
              JsBarcode(".barcode").init();
              setTimeout(() => {
                window.print();
              }, 500);
            };
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">Courier Slip Generator</h2>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Paste Records (one per line, tab-separated):
          </label>
          <textarea 
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 outline-none font-mono text-sm h-40"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Format: status&#9;date&#9;orderID&#9;qty&#9;&#9;mode&#9;address with Phone number"
          />
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={generateSlips}
            className="flex items-center justify-center gap-2 py-3 px-6 rounded-lg text-white font-medium transition-all duration-300 bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Generate Slips
          </button>
          
          <button 
            onClick={handlePrint}
            disabled={!output}
            className="flex items-center justify-center gap-2 py-3 px-6 rounded-lg text-white font-medium transition-all duration-300 bg-green-500 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🖨️ Print All
          </button>
        </div>
      </div>
      
      {output && (
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Preview</h2>
          <div 
            className="preview-container" 
            dangerouslySetInnerHTML={{ __html: output }}
          />
        </div>
      )}
    </div>
  );
}

// Add TypeScript interface for the global window object
declare global {
  interface Window {
    JsBarcode: (selector: string) => {
      init: () => void;
    };
  }
}

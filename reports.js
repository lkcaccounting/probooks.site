/* ═══════════════════════════════════════════
   ProBooks — Reports Module
═══════════════════════════════════════════ */

function generateReport(type) {
  const bizId = CURRENT_USER.bizId;
  const biz = DB.getBusiness(bizId);
  const currency = biz ? (biz.currency || 'KES') : 'KES';
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const monthName = now.toLocaleString('en', { month: 'long', year: 'numeric' });

  const output = document.getElementById('report-output');
  output.classList.remove('hidden');

  if (type === 'profit-loss') {
    const income = DB.getIncome(bizId).filter(r => r.date && r.date.startsWith(thisMonth));
    const expenses = DB.getExpenses(bizId).filter(r => r.date && r.date.startsWith(thisMonth));
    const sales = DB.getSales(bizId).filter(r => r.date && r.date.startsWith(thisMonth));

    const totalIncome = income.reduce((s, r) => s + Number(r.amount || 0), 0);
    const totalExpenses = expenses.reduce((s, r) => s + Number(r.amount || 0), 0);
    const totalSales = sales.reduce((s, r) => s + Number(r.total || 0), 0);
    const totalRevenue = totalIncome + totalSales;
    const profit = totalRevenue - totalExpenses;

    const incomeBycat = {};
    income.forEach(r => { incomeBycat[r.category] = (incomeBycat[r.category] || 0) + Number(r.amount || 0); });
    const expBycat = {};
    expenses.forEach(r => { expBycat[r.category] = (expBycat[r.category] || 0) + Number(r.amount || 0); });

    output.innerHTML = `
      <h3>📊 Profit & Loss — ${monthName}</h3>
      <p style="color:var(--text-secondary);margin-bottom:16px">Generated: ${now.toLocaleString('en-KE')}</p>

      <h4 style="color:var(--success);margin-bottom:8px">REVENUE</h4>
      <table>
        <tr><th>Source</th><th style="text-align:right">Amount</th></tr>
        ${Object.entries(incomeBycat).map(([k,v]) => `
          <tr><td>${esc(k)}</td><td style="text-align:right">${DB.fmtMoney(v, currency)}</td></tr>
        `).join('')}
        ${totalSales > 0 ? `<tr><td>Product Sales</td><td style="text-align:right">${DB.fmtMoney(totalSales, currency)}</td></tr>` : ''}
        <tr style="font-weight:700;border-top:2px solid var(--border)">
          <td>Total Revenue</td><td style="text-align:right;color:var(--success)">${DB.fmtMoney(totalRevenue, currency)}</td>
        </tr>
      </table>

      <h4 style="color:var(--danger);margin:16px 0 8px">EXPENSES</h4>
      <table>
        <tr><th>Category</th><th style="text-align:right">Amount</th></tr>
        ${Object.entries(expBycat).map(([k,v]) => `
          <tr><td>${esc(k)}</td><td style="text-align:right">${DB.fmtMoney(v, currency)}</td></tr>
        `).join('')}
        <tr style="font-weight:700;border-top:2px solid var(--border)">
          <td>Total Expenses</td><td style="text-align:right;color:var(--danger)">${DB.fmtMoney(totalExpenses, currency)}</td>
        </tr>
      </table>

      <div style="margin-top:20px;padding:16px;background:${profit>=0?'var(--success-bg)':'var(--danger-bg)'};border-radius:8px">
        <strong style="font-size:16px;color:${profit>=0?'var(--success)':'var(--danger)'}">
          NET PROFIT: ${DB.fmtMoney(profit, currency)} ${profit >= 0 ? '✅' : '⚠️'}
        </strong>
      </div>
    `;
  }

  else if (type === 'sales-summary') {
    const sales = DB.getSales(bizId);

    const byPerson = {};
    const byItem = {};
    const byPayment = {};

    sales.forEach(s => {
      byPerson[s.recordedBy] = (byPerson[s.recordedBy] || { count: 0, revenue: 0 });
      byPerson[s.recordedBy].count++;
      byPerson[s.recordedBy].revenue += Number(s.total || 0);

      byItem[s.itemName] = (byItem[s.itemName] || { qty: 0, revenue: 0 });
      byItem[s.itemName].qty += Number(s.qty || 0);
      byItem[s.itemName].revenue += Number(s.total || 0);

      byPayment[s.payment] = (byPayment[s.payment] || 0) + Number(s.total || 0);
    });

    const totalSales = sales.reduce((s, r) => s + Number(r.total || 0), 0);

    output.innerHTML = `
      <h3>🧾 Sales Summary (All Time)</h3>
      <p style="color:var(--text-secondary);margin-bottom:16px">Total: ${DB.fmtMoney(totalSales, currency)} across ${sales.length} transactions</p>

      <h4 style="margin-bottom:8px">By Sales Person</h4>
      <table>
        <tr><th>Name</th><th style="text-align:right">Sales</th><th style="text-align:right">Revenue</th></tr>
        ${Object.entries(byPerson).sort((a,b) => b[1].revenue - a[1].revenue).map(([k,v]) => `
          <tr><td>${esc(k)}</td><td style="text-align:right">${v.count}</td><td style="text-align:right">${DB.fmtMoney(v.revenue, currency)}</td></tr>
        `).join('') || '<tr><td colspan="3">No data</td></tr>'}
      </table>

      <h4 style="margin:16px 0 8px">Top Products</h4>
      <table>
        <tr><th>Product</th><th style="text-align:right">Units Sold</th><th style="text-align:right">Revenue</th></tr>
        ${Object.entries(byItem).sort((a,b) => b[1].revenue - a[1].revenue).slice(0,15).map(([k,v]) => `
          <tr><td>${esc(k)}</td><td style="text-align:right">${v.qty}</td><td style="text-align:right">${DB.fmtMoney(v.revenue, currency)}</td></tr>
        `).join('') || '<tr><td colspan="3">No data</td></tr>'}
      </table>

      <h4 style="margin:16px 0 8px">By Payment Method</h4>
      <table>
        <tr><th>Method</th><th style="text-align:right">Revenue</th></tr>
        ${Object.entries(byPayment).sort((a,b) => b[1] - a[1]).map(([k,v]) => `
          <tr><td>${esc(k)}</td><td style="text-align:right">${DB.fmtMoney(v, currency)}</td></tr>
        `).join('') || '<tr><td colspan="2">No data</td></tr>'}
      </table>
    `;
  }

  else if (type === 'stock-report') {
    const stock = DB.getStock(bizId);
    const biz_ = DB.getBusiness(bizId);
    const threshold = biz_ ? (biz_.threshold || 5) : 5;
    const totalValue = stock.reduce((s, i) => s + (Number(i.qty) * Number(i.costPrice || 0)), 0);
    const totalRetailValue = stock.reduce((s, i) => s + (Number(i.qty) * Number(i.sellPrice || 0)), 0);

    output.innerHTML = `
      <h3>📦 Stock Report</h3>
      <p style="color:var(--text-secondary);margin-bottom:8px">${stock.length} items &nbsp;|&nbsp; Cost value: ${DB.fmtMoney(totalValue, currency)} &nbsp;|&nbsp; Retail value: ${DB.fmtMoney(totalRetailValue, currency)}</p>
      <table>
        <tr><th>Item</th><th>SKU</th><th style="text-align:right">Qty</th><th>Unit</th><th style="text-align:right">Cost</th><th style="text-align:right">Sell Price</th><th>Status</th></tr>
        ${stock.map(s => {
          const low = Number(s.qty) <= Number(s.reorderLevel || threshold);
          return `<tr>
            <td><strong>${esc(s.name)}</strong></td>
            <td>${esc(s.sku || '—')}</td>
            <td style="text-align:right">${s.qty}</td>
            <td>${esc(s.unit)}</td>
            <td style="text-align:right">${DB.fmtMoney(s.costPrice, currency)}</td>
            <td style="text-align:right">${DB.fmtMoney(s.sellPrice, currency)}</td>
            <td><span class="pill ${low ? 'pill-low' : 'pill-ok'}">${low ? '⚠️ Low' : 'OK'}</span></td>
          </tr>`;
        }).join('') || '<tr><td colspan="7">No stock items</td></tr>'}
      </table>
    `;
  }

  else if (type === 'vat-paye') {
    const income = DB.getIncome(bizId).filter(r => r.date && r.date.startsWith(thisMonth));
    const sales = DB.getSales(bizId).filter(r => r.date && r.date.startsWith(thisMonth));
    const expenses = DB.getExpenses(bizId).filter(r => r.date && r.date.startsWith(thisMonth));

    const totalRevenue =
      income.reduce((s, r) => s + Number(r.amount || 0), 0) +
      sales.reduce((s, r) => s + Number(r.total || 0), 0);

    const salaryExpenses = expenses
      .filter(r => r.category === 'Salaries')
      .reduce((s, r) => s + Number(r.amount || 0), 0);

    // Kenya standard VAT = 16%
    const vatRate = 0.16;
    const vatCollected = totalRevenue * vatRate / (1 + vatRate); // Assume inclusive pricing
    const payeEstimate = salaryExpenses * 0.15; // Rough PAYE estimate at 15%

    output.innerHTML = `
      <h3>🏦 VAT / PAYE Summary — ${monthName}</h3>
      <p style="color:var(--text-secondary);margin-bottom:16px">
        ⚠️ <em>This is an estimate. Consult a licensed accountant or KRA for official filings.</em>
      </p>

      <h4 style="margin-bottom:8px">VAT (Value Added Tax)</h4>
      <table>
        <tr><th>Item</th><th style="text-align:right">Amount</th></tr>
        <tr><td>Total Revenue (incl. VAT)</td><td style="text-align:right">${DB.fmtMoney(totalRevenue, currency)}</td></tr>
        <tr><td>VAT Rate</td><td style="text-align:right">16%</td></tr>
        <tr style="font-weight:700"><td>Estimated VAT Payable</td><td style="text-align:right;color:var(--warning)">${DB.fmtMoney(vatCollected, currency)}</td></tr>
      </table>

      <h4 style="margin:16px 0 8px">PAYE (Pay As You Earn)</h4>
      <table>
        <tr><th>Item</th><th style="text-align:right">Amount</th></tr>
        <tr><td>Total Salaries Paid</td><td style="text-align:right">${DB.fmtMoney(salaryExpenses, currency)}</td></tr>
        <tr><td>Estimated PAYE Rate</td><td style="text-align:right">~15%</td></tr>
        <tr style="font-weight:700"><td>Estimated PAYE</td><td style="text-align:right;color:var(--warning)">${DB.fmtMoney(payeEstimate, currency)}</td></tr>
      </table>

      <div style="margin-top:16px;padding:14px;background:var(--warning-bg);border-radius:8px;font-size:12px;color:var(--text-secondary)">
        📌 <strong>Disclaimer:</strong> These are estimates based on standard Kenya rates (VAT 16%, PAYE ~15%). 
        Actual liability depends on exemptions, deductions, and KRA classification. Always confirm with a certified accountant before filing.
      </div>
    `;
  }

  output.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

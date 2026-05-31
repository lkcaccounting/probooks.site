/* ═══════════════════════════════════════════
   ProBooks — AI Accountant
   Uses Claude API (free via Anthropic proxy)
═══════════════════════════════════════════ */

let _aiHistory = []; // { role, content }

function buildBusinessContext() {
  if (!CURRENT_USER || !CURRENT_USER.bizId) return '';
  const bizId = CURRENT_USER.bizId;
  const biz = DB.getBusiness(bizId);
  const currency = biz ? biz.currency : 'KES';

  const income = DB.getIncome(bizId);
  const expenses = DB.getExpenses(bizId);
  const sales = DB.getSales(bizId);
  const stock = DB.getStock(bizId);
  const invoices = DB.getInvoices(bizId);

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

  const monthIncome = income.filter(r => r.date && r.date.startsWith(thisMonth));
  const monthExpenses = expenses.filter(r => r.date && r.date.startsWith(thisMonth));
  const monthSales = sales.filter(r => r.date && r.date.startsWith(thisMonth));

  const totalIncome = monthIncome.reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalExpenses = monthExpenses.reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalSales = monthSales.reduce((s, r) => s + Number(r.total || 0), 0);
  const profit = totalIncome - totalExpenses;

  const incomeByCategory = {};
  income.forEach(r => { incomeByCategory[r.category] = (incomeByCategory[r.category] || 0) + Number(r.amount || 0); });

  const expensesByCategory = {};
  expenses.forEach(r => { expensesByCategory[r.category] = (expensesByCategory[r.category] || 0) + Number(r.amount || 0); });

  const salesByItem = {};
  sales.forEach(r => {
    if (!salesByItem[r.itemName]) salesByItem[r.itemName] = { qty: 0, revenue: 0 };
    salesByItem[r.itemName].qty += Number(r.qty || 0);
    salesByItem[r.itemName].revenue += Number(r.total || 0);
  });

  const salesByPerson = {};
  sales.forEach(r => {
    if (!salesByPerson[r.recordedBy]) salesByPerson[r.recordedBy] = { count: 0, revenue: 0 };
    salesByPerson[r.recordedBy].count++;
    salesByPerson[r.recordedBy].revenue += Number(r.total || 0);
  });

  const biz_ = biz ? `Name: ${biz.name}, Type: ${biz.type}, Currency: ${currency}` : 'Unknown';
  const threshold = biz ? (biz.threshold || 5) : 5;
  const lowStockItems = stock.filter(s => Number(s.qty) <= Number(s.reorderLevel || threshold));

  const unpaidInvoices = invoices.filter(i => i.status === 'Unpaid');
  const unpaidTotal = unpaidInvoices.reduce((s, i) => s + Number(i.total || 0), 0);

  return `
You are a professional AI Accountant for a business. You have access to real-time business data below.
Respond clearly, professionally, and helpfully. Format numbers with commas. Use the business currency (${currency}).

=== BUSINESS ===
${biz_}
Today: ${now.toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

=== THIS MONTH (${thisMonth}) ===
Total Income: ${currency} ${totalIncome.toLocaleString('en', {minimumFractionDigits:2})}
Total Expenses: ${currency} ${totalExpenses.toLocaleString('en', {minimumFractionDigits:2})}
Sales Revenue: ${currency} ${totalSales.toLocaleString('en', {minimumFractionDigits:2})}
Net Profit: ${currency} ${profit.toLocaleString('en', {minimumFractionDigits:2})}

=== INCOME BREAKDOWN (all time) ===
${Object.entries(incomeByCategory).map(([k,v]) => `${k}: ${currency} ${v.toLocaleString('en', {minimumFractionDigits:2})}`).join('\n') || 'No data'}

=== EXPENSE BREAKDOWN (all time) ===
${Object.entries(expensesByCategory).map(([k,v]) => `${k}: ${currency} ${v.toLocaleString('en', {minimumFractionDigits:2})}`).join('\n') || 'No data'}

=== TOP SELLING ITEMS ===
${Object.entries(salesByItem).sort((a,b)=>b[1].revenue-a[1].revenue).slice(0,10)
  .map(([k,v]) => `${k}: ${v.qty} units sold, ${currency} ${v.revenue.toLocaleString('en', {minimumFractionDigits:2})} revenue`).join('\n') || 'No sales data'}

=== SALES BY STAFF ===
${Object.entries(salesByPerson)
  .map(([k,v]) => `${k}: ${v.count} sales, ${currency} ${v.revenue.toLocaleString('en', {minimumFractionDigits:2})} revenue`).join('\n') || 'No sales data'}

=== STOCK STATUS ===
Total items: ${stock.length}
Low stock items (${lowStockItems.length}): ${lowStockItems.map(s => `${s.name} (${s.qty} ${s.unit})`).join(', ') || 'None'}

=== INVOICES ===
Total invoices: ${invoices.length}
Unpaid invoices: ${unpaidInvoices.length} totaling ${currency} ${unpaidTotal.toLocaleString('en', {minimumFractionDigits:2})}

=== RECENT TRANSACTIONS (last 10 sales) ===
${sales.slice(0,10).map(s => `${s.date}: ${s.recordedBy} sold ${s.qty}×${s.itemName} for ${currency} ${s.total.toFixed(2)} via ${s.payment}`).join('\n') || 'No sales'}

=== RECENT INCOME (last 5) ===
${income.slice(0,5).map(r => `${r.date}: ${r.category} - ${currency} ${r.amount} (${r.payment})`).join('\n') || 'None'}

=== RECENT EXPENSES (last 5) ===
${expenses.slice(0,5).map(r => `${r.date}: ${r.category} - ${currency} ${r.amount} (${r.vendor || r.description || ''})`).join('\n') || 'None'}
  `.trim();
}

async function sendAiMessage() {
  const inputEl = document.getElementById('ai-input');
  const msg = inputEl.value.trim();
  if (!msg) return;

  inputEl.value = '';
  appendAiMessage('user', msg);
  const thinking = appendAiMessage('thinking', '🤔 Analyzing your business data...');

  try {
    const systemContext = buildBusinessContext();
    _aiHistory.push({ role: 'user', content: msg });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemContext,
        messages: _aiHistory
      })
    });

    const data = await response.json();

    if (data.error) {
      thinking.remove();
      appendAiMessage('ai', `⚠️ Error: ${data.error.message}`);
      _aiHistory.pop();
      return;
    }

    const reply = data.content?.map(b => b.text || '').join('') || 'No response.';
    _aiHistory.push({ role: 'assistant', content: reply });

    // Keep history manageable (last 20 messages)
    if (_aiHistory.length > 20) _aiHistory = _aiHistory.slice(-20);

    thinking.remove();
    appendAiMessage('ai', reply);

  } catch (err) {
    thinking.remove();
    appendAiMessage('ai', `⚠️ Could not connect to AI. Check your internet connection.\n\nError: ${err.message}`);
    _aiHistory.pop();
  }
}

function appendAiMessage(role, text) {
  const box = document.getElementById('ai-chat-box');
  const div = document.createElement('div');
  div.className = `ai-msg ${role}`;
  div.style.whiteSpace = 'pre-wrap';
  div.textContent = text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  return div;
}

function aiQuickAsk(question) {
  document.getElementById('ai-input').value = question;
  sendAiMessage();
}

// Allow Ctrl+Enter or Enter in AI input to send
document.addEventListener('DOMContentLoaded', () => {
  const aiInput = document.getElementById('ai-input');
  if (aiInput) {
    aiInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendAiMessage();
      }
    });
  }
});

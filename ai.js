// ============================================================
// ai.js — AI Accountant powered by Google Gemini (Free)
// ============================================================

async function askAIAccountant(businessId, question, chatHistory = []) {
  try {
    // Gather business data context
    const [settings, transactions, stock, invoices] = await Promise.all([
      getBusinessSettings(businessId),
      getTransactions(businessId),
      getStockItems(businessId),
      getInvoices(businessId)
    ]);

    // Build financial summary
    const now = new Date();
    const thisMonth = now.toISOString().slice(0, 7); // YYYY-MM
    const monthTx = transactions.filter(t => (t.date || "").startsWith(thisMonth));
    const monthIncome = monthTx.filter(t => t.type === "sale" || t.type === "income")
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const monthExpenses = monthTx.filter(t => t.type === "expense" || t.type === "restock")
      .reduce((s, t) => s + Number(t.amount || 0), 0);

    const allIncome = transactions.filter(t => t.type === "sale" || t.type === "income")
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const allExpenses = transactions.filter(t => t.type === "expense" || t.type === "restock")
      .reduce((s, t) => s + Number(t.amount || 0), 0);

    const lowStock = stock.filter(s => s.quantity <= (s.reorderLevel || 5));
    const unpaidInvoices = invoices.filter(i => i.status === "unpaid");
    const unpaidTotal = unpaidInvoices.reduce((s, i) => s + Number(i.total || 0), 0);

    // Recent 20 transactions for context
    const recent = transactions.slice(0, 20).map(t =>
      `${t.date} | ${t.type} | ${t.itemName || t.category || ""} | ${settings?.currency || "KES"} ${Number(t.amount || 0).toLocaleString()} | ${t.paymentMethod || ""} | by ${t.recordedBy || "owner"}`
    ).join("\n");

    const systemPrompt = `You are ProBooks AI Accountant — a professional, friendly accounting assistant for ${settings?.businessName || "this business"}.

BUSINESS DATA (as of ${now.toDateString()}):
Business: ${settings?.businessName || "N/A"} | Type: ${settings?.businessType || "N/A"} | Currency: ${settings?.currency || "KES"}

THIS MONTH SUMMARY:
- Income: ${settings?.currency || "KES"} ${monthIncome.toLocaleString()}
- Expenses: ${settings?.currency || "KES"} ${monthExpenses.toLocaleString()}
- Net Profit: ${settings?.currency || "KES"} ${(monthIncome - monthExpenses).toLocaleString()}

ALL-TIME SUMMARY:
- Total Income: ${settings?.currency || "KES"} ${allIncome.toLocaleString()}
- Total Expenses: ${settings?.currency || "KES"} ${allExpenses.toLocaleString()}
- Total Profit: ${settings?.currency || "KES"} ${(allIncome - allExpenses).toLocaleString()}

STOCK (${stock.length} items, ${lowStock.length} low):
${stock.map(s => `${s.name}: ${s.quantity} units @ ${settings?.currency || "KES"} ${s.sellingPrice || 0}`).join("\n") || "No stock items."}

LOW STOCK ALERTS: ${lowStock.map(s => s.name).join(", ") || "None"}

UNPAID INVOICES: ${unpaidInvoices.length} | Total Outstanding: ${settings?.currency || "KES"} ${unpaidTotal.toLocaleString()}

RECENT 20 TRANSACTIONS:
${recent || "No transactions yet."}

PAYMENT METHODS USED: Cash, M-Pesa, Bank Transfer, Card, Cheque

YOUR ROLE:
- Answer accounting and business questions based on this real data
- Automatically categorize patterns you see
- Flag unusual or suspicious transactions (fraud detection)
- Calculate VAT (Kenya standard: 16%), PAYE, or other taxes when asked
- Generate insights, reports, and recommendations
- Be concise but thorough
- If Kenya-specific tax advice: apply KRA rules
- Always respond in the same language the user writes in
- Never make up data not in this context`;

    // Build messages for Gemini
    const messages = [
      ...chatHistory,
      { role: "user", parts: [{ text: question }] }
    ];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: messages,
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 1024
          }
        })
      }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "Gemini API error");
    }

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a response. Please try again.";
    return { success: true, reply };

  } catch (e) {
    console.error("AI error:", e);
    return { success: false, reply: `AI Error: ${e.message}` };
  }
}

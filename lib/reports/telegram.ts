import "server-only";

// Sends Said a Telegram message for each new report. Needs TELEGRAM_BOT_TOKEN (from @BotFather) and
// TELEGRAM_CHAT_ID. A failed message never fails the report: the report is already saved.

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export interface TelegramMessage {
  title: string;
  lines: [label: string, value: string | null | undefined][];
  link?: { label: string; url: string };
}

export function formatMessage({ title, lines, link }: TelegramMessage): string {
  const body = lines
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([label, value]) => `<b>${escape(label)}:</b> ${escape(String(value).slice(0, 900))}`)
    .join("\n");
  return `<b>${escape(title)}</b>\n${body}${link ? `\n\n<a href="${escape(link.url)}">${escape(link.label)}</a>` : ""}`;
}

/** true when Telegram accepted the message; false when it's not set up or failed. */
export async function notify(message: TelegramMessage): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: formatMessage(message), parse_mode: "HTML", disable_web_page_preview: true }),
      signal: AbortSignal.timeout(6000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

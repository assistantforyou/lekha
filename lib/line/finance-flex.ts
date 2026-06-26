import { flex, type LineMessage } from "./client";

export type StockResult = {
  ok: true;
  symbol: string;
  price: number;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  currency: string;
  exchange: string | null;
  marketState: string | undefined;
  asOf: string | null;
  source: string;
};

export type CryptoResult = {
  ok: true;
  id: string;
  usd: number;
  change24h: number | null;
  asOf: string | null;
  source: string;
};

function fmtPrice(amount: number, currency = "USD"): string {
  const sym =
    currency === "USD" ? "$"
    : currency === "THB" ? "฿"
    : currency === "EUR" ? "€"
    : currency === "GBP" ? "£"
    : `${currency} `;
  const abs = Math.abs(amount);
  const formatted =
    abs >= 1000
      ? abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : abs >= 1
        ? abs.toFixed(2)
        : abs.toFixed(4);
  return `${amount < 0 ? "-" : ""}${sym}${formatted}`;
}

function marketLabel(state: string | undefined): string {
  const s = (state ?? "").toUpperCase();
  if (s === "REGULAR") return "🟢 Market open";
  if (s === "PRE") return "🌅 Pre-market";
  if (s === "POST" || s === "POSTPOST") return "🌙 After-hours";
  return "⏸ Market closed";
}

function statCol(label: string, value: string, valueColor = "#ffffff"): unknown {
  return {
    type: "box",
    layout: "vertical",
    flex: 1,
    contents: [
      { type: "text", text: value, size: "sm", weight: "bold", color: valueColor, align: "center", wrap: true },
      { type: "text", text: label, size: "xxs", color: "#AAAAAA", align: "center", margin: "xs" },
    ],
  };
}

function vDivider(): unknown {
  return {
    type: "box",
    layout: "vertical",
    width: "1px",
    contents: [{ type: "filler" }],
  };
}

function detailRow(label: string, value: string): unknown {
  return {
    type: "box",
    layout: "horizontal",
    paddingTop: "8px",
    paddingBottom: "8px",
    contents: [
      { type: "text", text: label, size: "sm", flex: 1, color: "#888888" },
      { type: "text", text: value, size: "sm", flex: 1, align: "end", color: "#333333", weight: "bold" },
    ],
  };
}

export function buildStockFlex(r: StockResult): LineMessage {
  const isUp = r.change != null ? r.change >= 0 : null;
  const changeColor = isUp === true ? "#69F0AE" : isUp === false ? "#FF5252" : "#999999";
  const arrow = isUp === true ? "▲" : isUp === false ? "▼" : "";

  const priceText = fmtPrice(r.price, r.currency);
  const changeText =
    r.change != null && r.changePercent != null
      ? `${arrow} ${r.changePercent >= 0 ? "+" : ""}${r.changePercent.toFixed(2)}%  (${r.change >= 0 ? "+" : ""}${fmtPrice(Math.abs(r.change), r.currency)})`
      : r.changePercent != null
        ? `${arrow} ${r.changePercent >= 0 ? "+" : ""}${r.changePercent.toFixed(2)}%`
        : "";

  const statCols: unknown[] = [];
  if (r.previousClose != null) {
    statCols.push(vDivider());
    statCols.push(statCol("Prev close", fmtPrice(r.previousClose, r.currency)));
  }
  if (r.exchange) {
    statCols.push(vDivider());
    statCols.push(statCol("Exchange", r.exchange));
  }

  const headerContents: unknown[] = [
    { type: "text", text: `📊 ${r.symbol}`, size: "xs", color: "#C0C0C0", weight: "bold", letterSpacing: "1px" },
    { type: "text", text: priceText, size: "4xl", weight: "bold", color: "#ffffff", margin: "sm" },
    { type: "text", text: changeText, size: "sm", color: changeColor, margin: "xs" },
  ];

  if (statCols.length > 0) {
    const marketCol = statCol("Market", marketLabel(r.marketState).replace(/^[^\s]+\s/, ""), "#E8E8E8");
    const allCols = [marketCol, ...statCols];
    headerContents.push({ type: "separator", margin: "md", color: "#334466" });
    headerContents.push({
      type: "box",
      layout: "horizontal",
      margin: "md",
      height: "44px",
      alignItems: "center",
      contents: allCols,
    });
  }

  const footerContents: unknown[] = [
    { type: "text", text: marketLabel(r.marketState), size: "xs", color: "#888888" },
  ];
  if (r.asOf) {
    footerContents.push({
      type: "text",
      text: `As of ${r.asOf.slice(0, 10)}  ·  ${r.source}`,
      size: "xxs",
      color: "#bbbbbb",
      margin: "xs",
    });
  }

  const bubble = {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#0D1B4B",
      paddingAll: "20px",
      contents: headerContents,
    },
    footer: {
      type: "box",
      layout: "vertical",
      paddingTop: "10px",
      paddingBottom: "12px",
      paddingStart: "16px",
      paddingEnd: "16px",
      contents: footerContents,
    },
  };

  return flex(`${r.symbol}: ${priceText} ${changeText}`, bubble);
}

export function buildCryptoFlex(r: CryptoResult): LineMessage {
  const isUp = r.change24h != null ? r.change24h >= 0 : null;
  const changeColor = isUp === true ? "#69F0AE" : isUp === false ? "#FF5252" : "#999999";
  const arrow = isUp === true ? "▲" : isUp === false ? "▼" : "";

  const priceText =
    r.usd >= 1
      ? `$${r.usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `$${r.usd.toFixed(6)}`;
  const changeText =
    r.change24h != null
      ? `${arrow} ${r.change24h >= 0 ? "+" : ""}${r.change24h.toFixed(2)}%  24h`
      : "";

  const name = r.id.charAt(0).toUpperCase() + r.id.slice(1);
  const sym = coinSymbol(r.id);

  const headerContents: unknown[] = [
    { type: "text", text: `${sym}  ${name.toUpperCase()}`, size: "xs", color: "#C0C0C0", weight: "bold", letterSpacing: "1px" },
    { type: "text", text: priceText, size: "4xl", weight: "bold", color: "#ffffff", margin: "sm" },
    { type: "text", text: changeText, size: "sm", color: changeColor, margin: "xs" },
  ];

  const footerContents: unknown[] = [];
  if (r.asOf) {
    footerContents.push({
      type: "text",
      text: `As of ${r.asOf.slice(0, 10)}  ·  ${r.source}`,
      size: "xxs",
      color: "#bbbbbb",
    });
  }

  const bubble = {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#1A0533",
      paddingAll: "20px",
      contents: headerContents,
    },
    ...(footerContents.length > 0
      ? {
          footer: {
            type: "box",
            layout: "vertical",
            paddingTop: "10px",
            paddingBottom: "12px",
            paddingStart: "16px",
            paddingEnd: "16px",
            contents: footerContents,
          },
        }
      : {}),
  };

  return flex(`${name}: ${priceText} ${changeText}`, bubble);
}

function coinSymbol(id: string): string {
  const map: Record<string, string> = {
    bitcoin: "₿",
    ethereum: "Ξ",
    solana: "◎",
    dogecoin: "Ð",
    ripple: "✕",
    cardano: "₳",
  };
  return map[id.toLowerCase()] ?? "🪙";
}

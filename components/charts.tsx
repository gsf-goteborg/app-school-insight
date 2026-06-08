"use client";

import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";

// Göteborg-anpassad seriepalett.
const SERIES = ["#005293", "#6a9a1f", "#7f3f98", "#f47815", "#e8364a", "#82bbdb", "#9ec038", "#c39bd3"];
const AXIS = "#5b6b77";
const GRID = "#e4eaef";

const BASE: EChartsOption = {
  textStyle: { fontFamily: "var(--font-body), sans-serif", color: "#243743" },
  color: SERIES,
  grid: { left: 48, right: 20, top: 30, bottom: 36, containLabel: true },
};

// Serialiserbara värdeformat (funktioner kan inte skickas från server till klient).
export type ValueFormat = "raw" | "pct0" | "pct1" | "dec1" | "sek" | "tkr";
const FORMATTERS: Record<ValueFormat, (v: number) => string> = {
  raw: (v) => String(v),
  pct0: (v) => `${Math.round(v)} %`,
  pct1: (v) => `${v.toFixed(1)} %`,
  dec1: (v) => v.toFixed(1),
  sek: (v) => new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK", maximumFractionDigits: 0 }).format(v),
  tkr: (v) => `${new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(v / 1000)} tkr`,
};

function Chart({ option, height = 300, ariaLabel }: { option: EChartsOption; height?: number; ariaLabel: string }) {
  return (
    <div role="img" aria-label={ariaLabel}>
      <ReactECharts
        option={{ ...BASE, ...option }}
        style={{ height }}
        opts={{ renderer: "svg" }}
        notMerge
        lazyUpdate
      />
    </div>
  );
}

// --- Linjediagram (progression över tid) ---
export function LineChart({
  categories, series, height, ariaLabel, yMax, valueFormat,
}: {
  categories: string[];
  series: { name: string; data: (number | null)[] }[];
  height?: number;
  ariaLabel: string;
  yMax?: number;
  valueFormat?: ValueFormat;
}) {
  const fmt = valueFormat ? FORMATTERS[valueFormat] : undefined;
  return (
    <Chart
      height={height}
      ariaLabel={ariaLabel}
      option={{
        tooltip: { trigger: "axis", valueFormatter: fmt ? (v) => fmt(Number(v)) : undefined },
        legend: { bottom: 0, icon: "roundRect" },
        xAxis: { type: "category", data: categories, axisLine: { lineStyle: { color: GRID } }, axisLabel: { color: AXIS } },
        yAxis: {
          type: "value", max: yMax,
          splitLine: { lineStyle: { color: GRID } },
          axisLabel: { color: AXIS, formatter: fmt ? (v: number) => fmt(v) : undefined },
        },
        series: series.map((s) => ({
          name: s.name, type: "line", data: s.data, smooth: true, symbolSize: 7, lineStyle: { width: 3 }, connectNulls: true,
        })),
      }}
    />
  );
}

// --- Stapeldiagram (kan staplas) ---
export function BarChart({
  categories, series, stacked, height, ariaLabel, colors, valueFormat, horizontal,
}: {
  categories: string[];
  series: { name: string; data: number[] }[];
  stacked?: boolean;
  height?: number;
  ariaLabel: string;
  colors?: string[];
  valueFormat?: ValueFormat;
  horizontal?: boolean;
}) {
  const fmt = valueFormat ? FORMATTERS[valueFormat] : undefined;
  const cat = { type: "category" as const, data: categories, axisLabel: { color: AXIS }, axisLine: { lineStyle: { color: GRID } } };
  const val = { type: "value" as const, splitLine: { lineStyle: { color: GRID } }, axisLabel: { color: AXIS, formatter: fmt ? (v: number) => fmt(v) : undefined } };
  return (
    <Chart
      height={height}
      ariaLabel={ariaLabel}
      option={{
        color: colors ?? SERIES,
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: fmt ? (v) => fmt(Number(v)) : undefined },
        legend: series.length > 1 ? { bottom: 0, icon: "roundRect" } : undefined,
        xAxis: horizontal ? val : cat,
        yAxis: horizontal ? cat : val,
        series: series.map((s) => ({
          name: s.name, type: "bar", data: s.data, stack: stacked ? "total" : undefined,
          barMaxWidth: 40, itemStyle: { borderRadius: stacked ? 0 : 4 },
        })),
      }}
    />
  );
}

// --- Heatmap (frånvaro per veckodag och årskurs) ---
export function Heatmap({
  xLabels, yLabels, data, height, ariaLabel, max, valueSuffix = "",
}: {
  xLabels: string[];
  yLabels: string[];
  data: [number, number, number][]; // [xIndex, yIndex, value]
  height?: number;
  ariaLabel: string;
  max: number;
  valueSuffix?: string;
}) {
  return (
    <Chart
      height={height}
      ariaLabel={ariaLabel}
      option={{
        grid: { left: 48, right: 20, top: 10, bottom: 70, containLabel: true },
        tooltip: {
          position: "top",
          formatter: (p) => {
            const d = (p as unknown as { data: [number, number, number] }).data;
            return `${yLabels[d[1]]}, ${xLabels[d[0]]}: ${d[2].toFixed(1)}${valueSuffix}`;
          },
        },
        xAxis: { type: "category", data: xLabels, splitArea: { show: true }, axisLabel: { color: AXIS } },
        yAxis: { type: "category", data: yLabels, splitArea: { show: true }, axisLabel: { color: AXIS } },
        visualMap: {
          min: 0, max, calculable: true, orient: "horizontal", left: "center", bottom: 10,
          inRange: { color: ["#eef7e6", "#f9b000", "#e8364a"] },
          textStyle: { color: AXIS },
        },
        series: [{
          type: "heatmap", data,
          label: { show: true, formatter: (p) => ((p as unknown as { data: [number, number, number] }).data[2]).toFixed(0), color: "#142430" },
          itemStyle: { borderColor: "#fff", borderWidth: 1 },
        }],
      }}
    />
  );
}

// --- Punktdiagram (sambandsanalys) ---
export function ScatterChart({
  points, xName, yName, height, ariaLabel, xMax, yMax,
}: {
  points: { x: number; y: number; label: string }[];
  xName: string;
  yName: string;
  height?: number;
  ariaLabel: string;
  xMax?: number;
  yMax?: number;
}) {
  return (
    <Chart
      height={height}
      ariaLabel={ariaLabel}
      option={{
        tooltip: {
          trigger: "item",
          formatter: (p) => {
            const d = (p as unknown as { data: [number, number, string] }).data;
            return `${d[2]}<br/>${xName}: ${d[0]}<br/>${yName}: ${d[1]}`;
          },
        },
        xAxis: { type: "value", name: xName, nameLocation: "middle", nameGap: 28, max: xMax, splitLine: { lineStyle: { color: GRID } }, axisLabel: { color: AXIS } },
        yAxis: { type: "value", name: yName, max: yMax, splitLine: { lineStyle: { color: GRID } }, axisLabel: { color: AXIS } },
        series: [{
          type: "scatter", symbolSize: 9,
          itemStyle: { color: "#005293", opacity: 0.55 },
          data: points.map((p) => [p.x, p.y, p.label]),
        }],
      }}
    />
  );
}

// --- Sankey (elever mellan risknivåer över tid) ---
export function SankeyChart({
  nodes, links, height, ariaLabel,
}: {
  nodes: { name: string; itemStyle?: { color: string } }[];
  links: { source: string; target: string; value: number }[];
  height?: number;
  ariaLabel: string;
}) {
  return (
    <Chart
      height={height}
      ariaLabel={ariaLabel}
      option={{
        tooltip: { trigger: "item", triggerOn: "mousemove" },
        series: [{
          type: "sankey", data: nodes, links, emphasis: { focus: "adjacency" },
          nodeWidth: 16, nodeGap: 10,
          label: { color: "#142430", fontSize: 12 },
          lineStyle: { color: "gradient", opacity: 0.45 },
        }],
      }}
    />
  );
}

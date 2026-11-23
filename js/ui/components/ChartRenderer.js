/**
 * @file Bar + line chart drawn with the Canvas API (no chart library).
 * Depends on: nothing (browser only).
 *
 * Sales are bars, profit is a solid line and expenses a dashed line. Colors
 * come from the CSS variables, so the chart matches the rest of the store.
 */

const PADDING = { top: 20, right: 16, bottom: 36, left: 64 };
const GRID_STEPS = 5; // 5 steps keep ticks round for every niceCeiling result

/**
 * Rounds a maximum up to a "nice" number for axis ticks (e.g. 3,712 → 4,000).
 * @param {number} value
 * @returns {number}
 */
export function niceCeiling(value) {
  if (value <= 0) {
    return 1;
  }
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((multiplier) => multiplier * magnitude >= value);
  return step * magnitude;
}

export class ChartRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{formatValue: function(number): string}} options
   */
  constructor(canvas, { formatValue }) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.formatValue = formatValue;
    this.series = [];
    this.resizeObserver = new ResizeObserver(() => this.draw());
    this.resizeObserver.observe(canvas);
  }

  /** Stops watching the canvas size (call when the view unmounts). */
  destroy() {
    this.resizeObserver.disconnect();
  }

  /**
   * @param {Array<{label:string, sales:number, profit:number, expenses:number}>} series
   */
  setData(series) {
    this.series = series;
    this.draw();
  }

  /** @returns {Object<string, string>} Theme colors read from CSS. */
  readColors() {
    const styles = getComputedStyle(document.documentElement);
    const read = (name) => styles.getPropertyValue(name).trim();
    return {
      bar: read('--color-sale-red'),
      ink: read('--color-ink'),
      faint: read('--color-ink-faint'),
      profit: read('--color-grille-dark'),
      expense: read('--color-warn'),
      font: read('--font-body'),
    };
  }

  /** Sizes the canvas for sharp lines on high-DPI screens, then draws everything. */
  draw() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width === 0 || height === 0) {
      return;
    }
    const ratio = window.devicePixelRatio || 1;
    this.canvas.width = width * ratio;
    this.canvas.height = height * ratio;
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.context.clearRect(0, 0, width, height);
    const colors = this.readColors();
    const maxValue = niceCeiling(
      Math.max(1, ...this.series.map((point) => Math.max(point.sales, point.profit))),
    );
    const plot = {
      x: PADDING.left,
      y: PADDING.top,
      width: width - PADDING.left - PADDING.right,
      height: height - PADDING.top - PADDING.bottom,
    };
    this.drawGrid(plot, maxValue, colors);
    this.drawBars(plot, maxValue, colors);
    this.drawLine(plot, maxValue, { color: colors.profit, key: 'profit', dash: [] });
    this.drawLine(plot, maxValue, { color: colors.expense, key: 'expenses', dash: [5, 4] });
    this.drawLabels(plot, colors);
  }

  /**
   * @param {Object} plot
   * @param {number} maxValue
   * @param {Object} colors
   */
  drawGrid(plot, maxValue, colors) {
    const ctx = this.context;
    ctx.font = `12px ${colors.font}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let step = 0; step <= GRID_STEPS; step += 1) {
      const y = plot.y + plot.height - (plot.height * step) / GRID_STEPS;
      ctx.strokeStyle = colors.faint;
      ctx.setLineDash(step === 0 ? [] : [2, 4]);
      ctx.beginPath();
      ctx.moveTo(plot.x, y);
      ctx.lineTo(plot.x + plot.width, y);
      ctx.stroke();
      ctx.fillStyle = colors.ink;
      ctx.fillText(this.formatValue((maxValue * step) / GRID_STEPS), plot.x - 8, y);
    }
    ctx.setLineDash([]);
  }

  /**
   * @param {Object} plot
   * @param {number} index
   * @returns {{center:number, width:number}}
   */
  slot(plot, index) {
    const slotWidth = plot.width / Math.max(1, this.series.length);
    return { center: plot.x + slotWidth * (index + 0.5), width: slotWidth };
  }

  /**
   * @param {Object} plot
   * @param {number} maxValue
   * @param {Object} colors
   */
  drawBars(plot, maxValue, colors) {
    const ctx = this.context;
    this.series.forEach((point, index) => {
      const { center, width } = this.slot(plot, index);
      const barWidth = Math.max(4, width * 0.6);
      const barHeight = (plot.height * point.sales) / maxValue;
      ctx.fillStyle = colors.bar;
      ctx.fillRect(center - barWidth / 2, plot.y + plot.height - barHeight, barWidth, barHeight);
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(center - barWidth / 2, plot.y + plot.height - barHeight, barWidth, barHeight);
    });
  }

  /**
   * @param {Object} plot
   * @param {number} maxValue
   * @param {{color: string, key: ('profit'|'expenses'), dash: number[]}} style
   */
  drawLine(plot, maxValue, { color, key, dash }) {
    const ctx = this.context;
    const points = this.series.map((point, index) => ({
      x: this.slot(plot, index).center,
      y: plot.y + plot.height - (plot.height * point[key]) / maxValue,
    }));
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.5;
    ctx.setLineDash(dash);
    ctx.beginPath();
    points.forEach((point, index) =>
      index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y),
    );
    ctx.stroke();
    ctx.setLineDash([]);
    points.forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /**
   * X-axis labels; skips some when there are too many to fit.
   * @param {Object} plot
   * @param {Object} colors
   */
  drawLabels(plot, colors) {
    const ctx = this.context;
    const every = Math.ceil(this.series.length / Math.max(1, Math.floor(plot.width / 56)));
    ctx.fillStyle = colors.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    this.series.forEach((point, index) => {
      if (index % every === 0) {
        ctx.fillText(point.label, this.slot(plot, index).center, plot.y + plot.height + 10);
      }
    });
  }
}

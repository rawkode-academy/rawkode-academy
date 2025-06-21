# Time-Series Visualization Architecture for Iceberg Analytics

## Overview

This document outlines the architecture and implementation strategies for building performant time-series visualizations on top of Apache Iceberg data. The design focuses on handling large-scale time-series data efficiently while providing interactive and responsive user experiences.

## Visualization Requirements

### Performance Goals
- Initial render: <500ms for default view
- Interaction response: <100ms for zoom/pan
- Data loading: <2s for 1M data points
- Memory usage: <200MB for typical dashboard

### Functional Requirements
- Multiple time granularities (second to year)
- Interactive zoom and pan
- Real-time data updates
- Multi-series comparison
- Anomaly highlighting
- Export capabilities

## Architecture Components

### 1. Data Pipeline Architecture

```typescript
interface TimeSeriesDataPipeline {
  // Data source layer
  source: IcebergDataSource;
  
  // Transformation layer
  aggregator: TimeSeriesAggregator;
  sampler: DataSampler;
  
  // Cache layer
  cache: TimeSeriesCache;
  
  // Streaming layer
  streamer: RealTimeStreamer;
  
  // Visualization layer
  renderer: ChartRenderer;
}
```

### 2. Adaptive Data Loading Strategy

```typescript
class AdaptiveTimeSeriesLoader {
  private readonly VIEWPORT_BUFFER = 0.2; // 20% buffer on each side
  private readonly MAX_POINTS_PER_SERIES = 10000;
  
  async loadData(params: TimeSeriesParams): Promise<TimeSeriesData> {
    const { timeRange, granularity, metric } = params;
    const dataPoints = this.estimateDataPoints(timeRange, granularity);
    
    if (dataPoints <= this.MAX_POINTS_PER_SERIES) {
      // Load full resolution
      return this.loadFullResolution(params);
    } else {
      // Load with adaptive sampling
      return this.loadWithSampling(params);
    }
  }
  
  private async loadFullResolution(params: TimeSeriesParams): Promise<TimeSeriesData> {
    const query = `
      SELECT 
        time_bucket('${params.granularity}', timestamp) as time,
        ${params.metric.aggregation}(${params.metric.field}) as value
      FROM analytics.events
      WHERE timestamp >= ?
        AND timestamp < ?
        AND event_type = ?
      GROUP BY 1
      ORDER BY 1
    `;
    
    return this.executeQuery(query, [
      params.timeRange.start,
      params.timeRange.end,
      params.eventType
    ]);
  }
  
  private async loadWithSampling(params: TimeSeriesParams): Promise<TimeSeriesData> {
    // Use Iceberg's sampling capabilities
    const sampleRate = this.MAX_POINTS_PER_SERIES / this.estimateDataPoints(params.timeRange, params.granularity);
    
    const query = `
      WITH sampled_data AS (
        SELECT 
          timestamp,
          ${params.metric.field} as value
        FROM analytics.events TABLESAMPLE SYSTEM (${sampleRate * 100})
        WHERE timestamp >= ?
          AND timestamp < ?
          AND event_type = ?
      )
      SELECT 
        time_bucket('${params.granularity}', timestamp) as time,
        ${params.metric.aggregation}(value) as value,
        COUNT(*) as sample_count
      FROM sampled_data
      GROUP BY 1
      ORDER BY 1
    `;
    
    const result = await this.executeQuery(query, [
      params.timeRange.start,
      params.timeRange.end,
      params.eventType
    ]);
    
    // Adjust values based on sample rate
    return result.map(row => ({
      ...row,
      value: row.value / sampleRate,
      confidence: Math.min(row.sample_count / 10, 1) // Confidence based on sample size
    }));
  }
}
```

### 3. Progressive Loading Implementation

```typescript
class ProgressiveTimeSeriesLoader {
  private loadingStages = [
    { resolution: 'hour', maxPoints: 168 },    // 1 week of hourly data
    { resolution: 'minute', maxPoints: 1440 }, // 1 day of minute data
    { resolution: 'second', maxPoints: 3600 }  // 1 hour of second data
  ];
  
  async loadProgressive(
    params: TimeSeriesParams,
    onProgress: (data: TimeSeriesData, stage: number) => void
  ): Promise<TimeSeriesData> {
    const duration = params.timeRange.end - params.timeRange.start;
    
    // Determine appropriate stages based on time range
    const stages = this.loadingStages.filter(stage => {
      const stagePoints = duration / this.getGranularityMs(stage.resolution);
      return stagePoints <= stage.maxPoints * 2;
    });
    
    let finalData: TimeSeriesData = [];
    
    // Load data progressively from coarse to fine
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const stageData = await this.loadStageData({
        ...params,
        granularity: stage.resolution
      });
      
      finalData = this.mergeData(finalData, stageData);
      onProgress(finalData, i / stages.length);
      
      // Check if user has zoomed/panned - abort if so
      if (this.isAborted()) break;
    }
    
    return finalData;
  }
  
  private mergeData(existing: TimeSeriesData, newData: TimeSeriesData): TimeSeriesData {
    // Merge new higher-resolution data with existing
    const merged = new Map<number, DataPoint>();
    
    // Add existing data
    existing.forEach(point => merged.set(point.time.getTime(), point));
    
    // Override with new data where available
    newData.forEach(point => merged.set(point.time.getTime(), point));
    
    return Array.from(merged.values()).sort((a, b) => a.time.getTime() - b.time.getTime());
  }
}
```

### 4. Visualization Components

#### Base Chart Component
```typescript
interface TimeSeriesChartProps {
  data: TimeSeriesData;
  config: ChartConfig;
  onTimeRangeChange?: (range: TimeRange) => void;
  onGranularityChange?: (granularity: TimeGranularity) => void;
}

const TimeSeriesChart: Component<TimeSeriesChartProps> = (props) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState({ k: 1, x: 0, y: 0 });
  
  // Initialize D3 chart
  useEffect(() => {
    if (!chartRef.current || !props.data.length) return;
    
    const chart = new D3TimeSeriesChart(chartRef.current, {
      ...props.config,
      onZoom: (transform) => {
        setZoom(transform);
        debouncedTimeRangeUpdate(transform);
      }
    });
    
    chart.render(props.data);
    
    return () => chart.destroy();
  }, [props.data, dimensions]);
  
  // Handle resize
  useResizeObserver(chartRef, (entries) => {
    const { width, height } = entries[0].contentRect;
    setDimensions({ width, height });
  });
  
  return (
    <div className="time-series-chart" ref={chartRef}>
      <ChartControls 
        zoom={zoom}
        onReset={() => setZoom({ k: 1, x: 0, y: 0 })}
        onExport={() => exportChart(chartRef.current)}
      />
      <ChartLegend series={props.config.series} />
    </div>
  );
};
```

#### D3.js Chart Implementation
```typescript
class D3TimeSeriesChart {
  private svg: d3.Selection<SVGSVGElement>;
  private xScale: d3.ScaleTime<number, number>;
  private yScale: d3.ScaleLinear<number, number>;
  private line: d3.Line<DataPoint>;
  private zoom: d3.ZoomBehavior<Element, unknown>;
  
  constructor(container: HTMLElement, config: ChartConfig) {
    const { width, height } = container.getBoundingClientRect();
    const margin = { top: 20, right: 80, bottom: 30, left: 50 };
    
    // Create SVG
    this.svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height);
    
    // Create scales
    this.xScale = d3.scaleTime()
      .range([margin.left, width - margin.right]);
    
    this.yScale = d3.scaleLinear()
      .range([height - margin.bottom, margin.top]);
    
    // Create line generator
    this.line = d3.line<DataPoint>()
      .x(d => this.xScale(d.time))
      .y(d => this.yScale(d.value))
      .curve(d3.curveMonotoneX);
    
    // Setup zoom
    this.zoom = d3.zoom()
      .scaleExtent([0.1, 100])
      .on('zoom', (event) => {
        config.onZoom?.(event.transform);
        this.updateChart(event.transform);
      });
    
    this.svg.call(this.zoom);
    
    // Create chart groups
    this.createChartStructure(margin);
  }
  
  render(data: TimeSeriesData) {
    // Update scales
    this.xScale.domain(d3.extent(data, d => d.time) as [Date, Date]);
    this.yScale.domain([0, d3.max(data, d => d.value) as number]);
    
    // Render axes
    this.renderAxes();
    
    // Render line
    this.renderLine(data);
    
    // Render points (if not too many)
    if (data.length < 1000) {
      this.renderPoints(data);
    }
    
    // Render brush for selection
    this.renderBrush();
  }
  
  private renderLine(data: TimeSeriesData) {
    const path = this.svg.select('.line-group')
      .selectAll('.line')
      .data([data]);
    
    path.enter()
      .append('path')
      .attr('class', 'line')
      .merge(path)
      .transition()
      .duration(750)
      .attr('d', this.line)
      .attr('fill', 'none')
      .attr('stroke', 'steelblue')
      .attr('stroke-width', 1.5);
    
    path.exit().remove();
  }
  
  private updateChart(transform: d3.ZoomTransform) {
    // Update scales with zoom
    const newXScale = transform.rescaleX(this.xScale);
    
    // Update axes
    this.svg.select('.x-axis')
      .call(d3.axisBottom(newXScale));
    
    // Update line
    this.svg.select('.line')
      .attr('d', this.line.x(d => newXScale(d.time)));
    
    // Update points if rendered
    this.svg.selectAll('.point')
      .attr('cx', d => newXScale((d as DataPoint).time));
  }
}
```

### 5. Real-time Update Architecture

```typescript
class RealTimeTimeSeriesChart {
  private data: TimeSeriesData = [];
  private updateBuffer: DataPoint[] = [];
  private updateTimer?: number;
  private chart: D3TimeSeriesChart;
  
  constructor(container: HTMLElement, config: ChartConfig) {
    this.chart = new D3TimeSeriesChart(container, config);
    this.startRealTimeUpdates();
  }
  
  private startRealTimeUpdates() {
    // Connect to WebSocket or SSE for real-time data
    const eventSource = new EventSource('/api/analytics/stream');
    
    eventSource.onmessage = (event) => {
      const dataPoint: DataPoint = JSON.parse(event.data);
      this.updateBuffer.push(dataPoint);
      
      // Batch updates for performance
      if (!this.updateTimer) {
        this.updateTimer = window.setTimeout(() => {
          this.applyUpdates();
          this.updateTimer = undefined;
        }, 100); // Update every 100ms max
      }
    };
  }
  
  private applyUpdates() {
    if (this.updateBuffer.length === 0) return;
    
    // Merge new data with existing
    this.data = this.mergeAndTrim(this.data, this.updateBuffer);
    this.updateBuffer = [];
    
    // Smooth update animation
    this.chart.smoothUpdate(this.data);
  }
  
  private mergeAndTrim(existing: TimeSeriesData, updates: DataPoint[]): TimeSeriesData {
    // Add new points
    const merged = [...existing, ...updates];
    
    // Sort by time
    merged.sort((a, b) => a.time.getTime() - b.time.getTime());
    
    // Trim to visible window + buffer
    const visibleRange = this.chart.getVisibleTimeRange();
    const buffer = (visibleRange.end - visibleRange.start) * 0.1;
    
    return merged.filter(point => 
      point.time >= new Date(visibleRange.start - buffer) &&
      point.time <= new Date(visibleRange.end + buffer)
    );
  }
}
```

### 6. Performance Optimization Strategies

#### Virtual Rendering for Large Datasets
```typescript
class VirtualizedTimeSeriesRenderer {
  private visibleRange: { start: number; end: number };
  private dataIndex: RBTree<DataPoint>; // Red-black tree for efficient range queries
  
  render(fullData: TimeSeriesData, viewport: Viewport): RenderedData {
    // Build index if needed
    if (!this.dataIndex) {
      this.dataIndex = this.buildIndex(fullData);
    }
    
    // Calculate visible range with buffer
    const buffer = (viewport.endTime - viewport.startTime) * 0.1;
    const queryRange = {
      start: viewport.startTime - buffer,
      end: viewport.endTime + buffer
    };
    
    // Query only visible data
    const visibleData = this.dataIndex.range(queryRange.start, queryRange.end);
    
    // Apply level-of-detail based on zoom
    const lod = this.calculateLOD(visibleData.length, viewport.width);
    const renderedData = this.applyLOD(visibleData, lod);
    
    return {
      data: renderedData,
      stats: {
        totalPoints: fullData.length,
        visiblePoints: visibleData.length,
        renderedPoints: renderedData.length,
        compressionRatio: visibleData.length / renderedData.length
      }
    };
  }
  
  private calculateLOD(dataPoints: number, pixelWidth: number): number {
    const pointsPerPixel = dataPoints / pixelWidth;
    
    if (pointsPerPixel <= 1) return 1;        // Full detail
    if (pointsPerPixel <= 10) return 2;       // Every 2nd point
    if (pointsPerPixel <= 100) return 10;     // Every 10th point
    return Math.ceil(pointsPerPixel / 10);     // Adaptive
  }
  
  private applyLOD(data: DataPoint[], lod: number): DataPoint[] {
    if (lod === 1) return data;
    
    // Use Douglas-Peucker algorithm for intelligent point reduction
    return this.douglasPeucker(data, lod);
  }
}
```

#### WebGL Rendering for Ultra-Large Datasets
```typescript
class WebGLTimeSeriesRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private buffers: {
    position: WebGLBuffer;
    color: WebGLBuffer;
  };
  
  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl');
    if (!gl) throw new Error('WebGL not supported');
    
    this.gl = gl;
    this.initializeWebGL();
  }
  
  render(data: TimeSeriesData, config: RenderConfig) {
    const positions = this.dataToPositions(data, config);
    const colors = this.dataToColors(data, config);
    
    // Update buffers
    this.updateBuffer(this.buffers.position, positions);
    this.updateBuffer(this.buffers.color, colors);
    
    // Clear and draw
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.drawArrays(this.gl.LINE_STRIP, 0, data.length);
  }
  
  private dataToPositions(data: TimeSeriesData, config: RenderConfig): Float32Array {
    const positions = new Float32Array(data.length * 2);
    
    for (let i = 0; i < data.length; i++) {
      const x = (data[i].time.getTime() - config.xMin) / (config.xMax - config.xMin) * 2 - 1;
      const y = (data[i].value - config.yMin) / (config.yMax - config.yMin) * 2 - 1;
      
      positions[i * 2] = x;
      positions[i * 2 + 1] = y;
    }
    
    return positions;
  }
}
```

### 7. Interactive Features

#### Tooltip System
```typescript
class TimeSeriesToolTip {
  private tooltip: d3.Selection<HTMLDivElement>;
  private bisectDate = d3.bisector<DataPoint, Date>(d => d.time).left;
  
  constructor(container: HTMLElement) {
    this.tooltip = d3.select(container)
      .append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0);
  }
  
  show(data: TimeSeriesData, mousePos: { x: number; y: number }, xScale: d3.ScaleTime) {
    // Find closest data point
    const x0 = xScale.invert(mousePos.x);
    const i = this.bisectDate(data, x0, 1);
    const d0 = data[i - 1];
    const d1 = data[i];
    const d = x0.getTime() - d0.time.getTime() > d1.time.getTime() - x0.getTime() ? d1 : d0;
    
    // Update tooltip content
    this.tooltip.html(`
      <div class="tooltip-header">${this.formatTime(d.time)}</div>
      <div class="tooltip-value">Value: ${this.formatValue(d.value)}</div>
      ${d.confidence ? `<div class="tooltip-confidence">Confidence: ${(d.confidence * 100).toFixed(0)}%</div>` : ''}
    `);
    
    // Position tooltip
    this.tooltip
      .style('left', `${mousePos.x + 10}px`)
      .style('top', `${mousePos.y - 10}px`)
      .transition()
      .duration(200)
      .style('opacity', 0.9);
  }
  
  hide() {
    this.tooltip
      .transition()
      .duration(500)
      .style('opacity', 0);
  }
}
```

#### Brush Selection
```typescript
class TimeSeriesBrush {
  private brush: d3.BrushX<unknown>;
  private onSelection: (range: TimeRange) => void;
  
  constructor(
    svg: d3.Selection<SVGGElement>,
    xScale: d3.ScaleTime,
    height: number,
    onSelection: (range: TimeRange) => void
  ) {
    this.onSelection = onSelection;
    
    this.brush = d3.brushX()
      .extent([[0, 0], [xScale.range()[1], height]])
      .on('end', (event) => this.handleBrushEnd(event, xScale));
    
    svg.append('g')
      .attr('class', 'brush')
      .call(this.brush);
  }
  
  private handleBrushEnd(event: d3.D3BrushEvent<unknown>, xScale: d3.ScaleTime) {
    if (!event.selection) return;
    
    const [x0, x1] = event.selection as [number, number];
    const timeRange = {
      start: xScale.invert(x0),
      end: xScale.invert(x1)
    };
    
    this.onSelection(timeRange);
  }
}
```

### 8. Export Functionality

```typescript
class ChartExporter {
  static async exportAsPNG(chart: HTMLElement): Promise<Blob> {
    const svg = chart.querySelector('svg');
    if (!svg) throw new Error('No SVG found');
    
    // Convert SVG to canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const { width, height } = svg.getBoundingClientRect();
    
    canvas.width = width * 2; // 2x for retina
    canvas.height = height * 2;
    ctx.scale(2, 2);
    
    // Draw SVG to canvas
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    return new Promise((resolve, reject) => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob'));
        }, 'image/png');
      };
      
      img.onerror = reject;
      img.src = url;
    });
  }
  
  static async exportAsCSV(data: TimeSeriesData): Promise<string> {
    const headers = ['timestamp', 'value', 'confidence'];
    const rows = data.map(point => [
      point.time.toISOString(),
      point.value.toString(),
      point.confidence?.toString() || ''
    ]);
    
    return [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
  }
}
```

## Implementation Guidelines

### 1. Component Structure
```
components/
├── TimeSeriesChart/
│   ├── index.tsx              # Main component
│   ├── hooks/
│   │   ├── useTimeSeriesData.ts
│   │   ├── useChartDimensions.ts
│   │   └── useZoom.ts
│   ├── renderers/
│   │   ├── D3Renderer.ts
│   │   ├── WebGLRenderer.ts
│   │   └── CanvasRenderer.ts
│   ├── utils/
│   │   ├── dataProcessing.ts
│   │   ├── scales.ts
│   │   └── formatters.ts
│   └── styles.module.css
```

### 2. Performance Checklist
- [ ] Implement virtual rendering for >10k points
- [ ] Use WebGL for >100k points
- [ ] Enable progressive loading
- [ ] Implement data indexing
- [ ] Add request debouncing
- [ ] Use Web Workers for data processing
- [ ] Implement memory management
- [ ] Add performance monitoring

### 3. Accessibility Features
- Keyboard navigation for zoom/pan
- Screen reader descriptions
- High contrast mode support
- Focus indicators
- ARIA labels for all controls

## Conclusion

This architecture provides a comprehensive foundation for building high-performance time-series visualizations on Iceberg data. The key principles are:

1. **Progressive Enhancement**: Start with basic functionality, enhance based on capabilities
2. **Adaptive Loading**: Adjust data resolution based on viewport and performance
3. **Virtual Rendering**: Only render visible data points
4. **Caching**: Multi-level caching for optimal performance
5. **Real-time Integration**: Seamless blending of batch and streaming data

The modular design allows teams to implement features incrementally while maintaining performance standards.
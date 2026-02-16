import React, { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { fetchSource, fetchSubgraph, searchFunctions } from './api.js';

function SourceView({ content, highlightLine }) {
  if (!content) {
    return <div className="empty">Select a function to view source.</div>;
  }

  const lines = content.split('\n');

  return (
    <pre className="code">
      {lines.map((line, idx) => {
        const lineNumber = idx + 1;
        const isHighlight = highlightLine === lineNumber;
        return (
          <div key={lineNumber} className={`code-line ${isHighlight ? 'is-highlight' : ''}`}>
            <span className="code-no">{lineNumber}</span>
            <span className="code-text">{line || ' '}</span>
          </div>
        );
      })}
    </pre>
  );
}

export default function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [graph, setGraph] = useState({ nodes: [], links: [] });
  const [source, setSource] = useState(null);
  const [loading, setLoading] = useState(false);
  const [depth, setDepth] = useState(2);
  const [limit, setLimit] = useState(60);
  const [error, setError] = useState('');
  const graphRef = useRef(null);
  const containerRef = useRef(null);
  const [graphSize, setGraphSize] = useState({ width: 800, height: 600 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setGraphSize({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    const handle = setTimeout(() => {
      searchFunctions(query)
        .then((data) => {
          if (!active) return;
          setResults(data.results || []);
        })
        .catch((err) => {
          if (!active) return;
          setError(err.message);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [query]);

  const loadGraph = async (functionId) => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchSubgraph(functionId, depth, limit);
      const links = data.edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
      }));
      setGraph({ nodes: data.nodes, links });
      setSelected(data.root);
      if (data.root?.file) {
        const sourceData = await fetchSource(data.root.file);
        setSource(sourceData);
      } else {
        setSource(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onSelectResult = (item) => {
    loadGraph(item.id);
  };

  const onNodeClick = (node) => {
    if (!node?.id) return;
    loadGraph(node.id);
  };

  const graphNodes = useMemo(() => {
    return graph.nodes.map((node) => ({
      ...node,
      isSelected: selected?.id === node.id,
    }));
  }, [graph.nodes, selected]);

  const nodePaint = (node, ctx, globalScale) => {
    const label = node.name || node.id;
    const fontSize = Math.max(10, 12 / globalScale);
    ctx.font = `${fontSize}px "Space Grotesk"`;
    const textWidth = ctx.measureText(label).width;
    const padding = 6;
    const radius = node.isSelected ? 10 : 6;

    const isCaller = graph.links.some((link) => link.target === node.id && link.source === selected?.id);
    const isCallee = graph.links.some((link) => link.source === selected?.id && link.target === node.id);

    let color = '#6cc2ff';
    if (node.isSelected) color = '#ffd66b';
    else if (isCaller) color = '#ff8f6b';
    else if (isCallee) color = '#6bf7b0';

    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
    ctx.fill();

    if (globalScale < 1.3) {
      ctx.fillStyle = 'rgba(10, 12, 16, 0.7)';
      ctx.fillRect(node.x + 10, node.y - fontSize, textWidth + padding, fontSize + 8);
      ctx.fillStyle = '#f5f7ff';
      ctx.fillText(label, node.x + 14, node.y + 4);
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-title">Call Graph Explorer</span>
          <span className="brand-sub">CPG for Prometheus ecosystem</span>
        </div>
        <div className="controls">
          <label>
            Depth
            <input
              type="number"
              min="1"
              max="5"
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
            />
          </label>
          <label>
            Max Nodes
            <input
              type="number"
              min="10"
              max="200"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            />
          </label>
        </div>
      </header>

      <div className="layout">
        <aside className="panel panel-left">
          <div className="panel-header">Function Search</div>
          <input
            className="search"
            placeholder="Type a function, package, or file"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="results">
            {results.length === 0 && <div className="empty">No matches yet.</div>}
            {results.map((item) => (
              <button
                key={item.id}
                className={`result ${selected?.id === item.id ? 'active' : ''}`}
                onClick={() => onSelectResult(item)}
              >
                <div className="result-title">{item.name}</div>
                <div className="result-sub">{item.package || item.file}</div>
              </button>
            ))}
          </div>
        </aside>

        <main className="panel panel-center">
          <div className="panel-header">
            Graph
            {loading && <span className="status">Loading...</span>}
            {error && <span className="status error">{error}</span>}
          </div>
          <div className="graph-wrap" ref={containerRef}>
            <ForceGraph2D
              ref={graphRef}
              graphData={{ nodes: graphNodes, links: graph.links }}
              nodeId="id"
              nodeLabel={(node) => `${node.name}\n${node.package || ''}`}
              linkDirectionalArrowLength={4}
              linkDirectionalArrowRelPos={0.9}
              linkColor={() => 'rgba(226, 233, 255, 0.35)'}
              nodeCanvasObject={nodePaint}
              onNodeClick={onNodeClick}
              cooldownTicks={80}
              width={graphSize.width}
              height={graphSize.height}
              backgroundColor="rgba(0,0,0,0)"
            />
          </div>
        </main>

        <aside className="panel panel-right">
          <div className="panel-header">Details</div>
          {selected ? (
            <div className="detail">
              <div className="detail-title">{selected.name}</div>
              <div className="detail-meta">{selected.package || 'Unknown package'}</div>
              <div className="detail-meta">{selected.file || 'Unknown file'}</div>
              <div className="detail-meta">Line {selected.line || '-'} </div>
            </div>
          ) : (
            <div className="empty">Pick a function to inspect.</div>
          )}
          <div className="panel-header">Source</div>
          <SourceView content={source?.content} highlightLine={selected?.line} />
        </aside>
      </div>
    </div>
  );
}

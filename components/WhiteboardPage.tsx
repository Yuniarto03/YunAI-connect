import React, { useContext, useState, useRef, useEffect } from 'react';
import { AppContext } from '../contexts/AppContext';
import { AppContextType } from '../types';
import Button from './shared/Button';
import { Palette, Eraser, Download, Trash2, Undo, Redo, Square, Circle, Minus, Type, Move, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { RAW_COLOR_VALUES } from '../constants';

interface DrawingPoint {
  x: number;
  y: number;
}

interface DrawingPath {
  points: DrawingPoint[];
  color: string;
  width: number;
  tool: 'pen' | 'eraser';
}

type Tool = 'pen' | 'eraser' | 'rectangle' | 'circle' | 'line' | 'text' | 'move';

const WhiteboardPage: React.FC = () => {
  const { theme, reduceMotion } = useContext(AppContext) as AppContextType;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState<Tool>('pen');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentWidth, setCurrentWidth] = useState(3);
  const [paths, setPaths] = useState<DrawingPath[]>([]);
  const [currentPath, setCurrentPath] = useState<DrawingPoint[]>([]);
  const [history, setHistory] = useState<DrawingPath[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const colors = [
    '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
    RAW_COLOR_VALUES[theme.accent1] || '#00D4FF',
    RAW_COLOR_VALUES[theme.accent2] || '#8B5CF6',
    RAW_COLOR_VALUES[theme.accent3] || '#00FF88',
    RAW_COLOR_VALUES[theme.accent4] || '#FF6B35',
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      redrawCanvas();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set background
    ctx.fillStyle = RAW_COLOR_VALUES[theme.contentBg.replace('bg-', '')] || '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw all paths
    paths.forEach(path => {
      if (path.points.length < 2) return;

      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = path.tool === 'eraser' ? 'destination-out' : 'source-over';

      ctx.beginPath();
      ctx.moveTo(path.points[0].x, path.points[0].y);
      
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }
      
      ctx.stroke();
    });

    // Reset composite operation
    ctx.globalCompositeOperation = 'source-over';
  };

  useEffect(() => {
    redrawCanvas();
  }, [paths, theme]);

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (currentTool === 'move') return;

    setIsDrawing(true);
    const pos = getMousePos(e);
    setCurrentPath([pos]);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || currentTool === 'move') return;

    const pos = getMousePos(e);
    setCurrentPath(prev => [...prev, pos]);

    // Draw current stroke in real-time
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = currentTool === 'eraser' ? 'destination-out' : 'source-over';

    if (currentPath.length >= 2) {
      const prevPos = currentPath[currentPath.length - 2];
      ctx.beginPath();
      ctx.moveTo(prevPos.x, prevPos.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }

    ctx.globalCompositeOperation = 'source-over';
  };

  const stopDrawing = () => {
    if (!isDrawing) return;

    setIsDrawing(false);

    if (currentPath.length > 1) {
      const newPath: DrawingPath = {
        points: currentPath,
        color: currentColor,
        width: currentWidth,
        tool: currentTool as 'pen' | 'eraser'
      };

      const newPaths = [...paths, newPath];
      setPaths(newPaths);

      // Update history
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newPaths);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }

    setCurrentPath([]);
  };

  const clearCanvas = () => {
    setPaths([]);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setPaths(history[historyIndex - 1]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setPaths(history[historyIndex + 1]);
    }
  };

  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `whiteboard_${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  const tools = [
    { id: 'pen', icon: Palette, label: 'Pen' },
    { id: 'eraser', icon: Eraser, label: 'Eraser' },
    { id: 'rectangle', icon: Square, label: 'Rectangle' },
    { id: 'circle', icon: Circle, label: 'Circle' },
    { id: 'line', icon: Minus, label: 'Line' },
    { id: 'text', icon: Type, label: 'Text' },
    { id: 'move', icon: Move, label: 'Move' },
  ];

  return (
    <div className={`h-full flex flex-col ${theme.textColor}`}>
      {/* Header */}
      <div className={`${theme.cardBg} border-b ${theme.borderColor} p-4`}>
        <h1 className={`text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-${theme.accent1} to-${theme.accent2} mb-4`}>
          Digital Whiteboard
        </h1>
        
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Tools */}
          <div className="flex gap-2">
            {tools.map(tool => (
              <Button
                key={tool.id}
                variant={currentTool === tool.id ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setCurrentTool(tool.id as Tool)}
                leftIcon={<tool.icon size={16} />}
                title={tool.label}
              >
                <span className="hidden sm:inline">{tool.label}</span>
              </Button>
            ))}
          </div>

          {/* Colors */}
          <div className="flex gap-1">
            {colors.map(color => (
              <button
                key={color}
                className={`w-8 h-8 rounded border-2 ${currentColor === color ? 'border-white shadow-lg' : 'border-gray-400'} ${!reduceMotion ? 'hover:scale-110 transition-transform' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => setCurrentColor(color)}
                title={`Color: ${color}`}
              />
            ))}
          </div>

          {/* Brush Size */}
          <div className="flex items-center gap-2">
            <label className="text-sm">Size:</label>
            <input
              type="range"
              min="1"
              max="20"
              value={currentWidth}
              onChange={(e) => setCurrentWidth(Number(e.target.value))}
              className="w-20"
            />
            <span className="text-sm w-6">{currentWidth}</span>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={undo}
              disabled={historyIndex <= 0}
              leftIcon={<Undo size={16} />}
              title="Undo"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              leftIcon={<Redo size={16} />}
              title="Redo"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={clearCanvas}
              leftIcon={<Trash2 size={16} />}
              title="Clear Canvas"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={downloadCanvas}
              leftIcon={<Download size={16} />}
              title="Download"
            />
          </div>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full cursor-crosshair"
          style={{
            cursor: currentTool === 'move' ? 'move' : 
                   currentTool === 'eraser' ? 'crosshair' : 
                   'crosshair'
          }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
        />
      </div>

      {/* Status Bar */}
      <div className={`${theme.cardBg} border-t ${theme.borderColor} p-2 text-xs opacity-70`}>
        <div className="flex justify-between items-center">
          <span>Tool: {tools.find(t => t.id === currentTool)?.label}</span>
          <span>Paths: {paths.length}</span>
          <span>Color: {currentColor}</span>
          <span>Size: {currentWidth}px</span>
        </div>
      </div>
    </div>
  );
};

export default WhiteboardPage;
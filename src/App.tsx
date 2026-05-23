import { useState, useRef, useCallback, useEffect } from 'react';
import { removeBackground } from '@imgly/background-removal';
import { PHOTO_SIZES, BG_COLORS, mmToPx, type PhotoSize, type BgColor } from './constants';
import './App.css';

type Step = 'config' | 'upload' | 'processing' | 'edit' | 'result';

function App() {
  const [step, setStep] = useState<Step>('config');
  const [size, setSize] = useState<PhotoSize>(PHOTO_SIZES[0]);
  const [bgColor, setBgColor] = useState<BgColor>(BG_COLORS[1]);
  const [originalSrc, setOriginalSrc] = useState<string | null>(null);
  const [processedSrc, setProcessedSrc] = useState<string | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [showLayout, setShowLayout] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editCanvasRef = useRef<HTMLCanvasElement>(null);
  const resultCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, posX: 0, posY: 0 });

  const canvasW = mmToPx(size.widthMm, size.dpi);
  const canvasH = mmToPx(size.heightMm, size.dpi);

  // draw edit canvas whenever deps change
  useEffect(() => {
    const canvas = editCanvasRef.current;
    if (!canvas || !processedSrc) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = canvasW;
      canvas.height = canvasH;

      ctx.fillStyle = bgColor.hex;
      ctx.fillRect(0, 0, canvasW, canvasH);

      const scale = Math.min(canvasW / img.width, canvasH / img.height) * zoom;
      const dw = img.width * scale;
      const dh = img.height * scale;
      const dx = (canvasW - dw) / 2 + position.x;
      const dy = (canvasH - dh) / 2 + position.y;

      ctx.drawImage(img, dx, dy, dw, dh);
    };
    img.src = processedSrc;
  }, [processedSrc, bgColor, position, zoom, canvasW, canvasH]);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件');
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      setOriginalSrc(e.target?.result as string);
      setStep('processing');
    };
    reader.readAsDataURL(file);
  }, []);

  // AI background removal
  useEffect(() => {
    if (step !== 'processing' || !originalSrc) return;

    let cancelled = false;

    (async () => {
      try {
        const blob = await removeBackground(originalSrc, {
          model: 'isnet_quint8',
          output: { format: 'image/png', quality: 1 },
        });
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setProcessedSrc(url);
        setPosition({ x: 0, y: 0 });
        setZoom(1);
        setStep('edit');
      } catch {
        if (!cancelled) setError('抠图失败，请重试或换一张照片');
      }
    })();

    return () => { cancelled = true; };
  }, [step, originalSrc]);

  // drag handlers
  const getEventPos = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  };

  const onPointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const pos = getEventPos(e);
    dragRef.current = {
      dragging: true,
      startX: pos.x,
      startY: pos.y,
      posX: position.x,
      posY: position.y,
    };
  };

  const onPointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dragRef.current.dragging) return;
    const pos = getEventPos(e);
    setPosition({
      x: dragRef.current.posX + (pos.x - dragRef.current.startX),
      y: dragRef.current.posY + (pos.y - dragRef.current.startY),
    });
  };

  const onPointerUp = () => {
    dragRef.current.dragging = false;
  };

  const downloadSingle = useCallback(() => {
    const canvas = editCanvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `证件照_${size.name.replace(/\s.*/, '')}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/jpeg', 0.95);
  }, [size]);

  const drawLayout = useCallback(() => {
    const canvas = resultCanvasRef.current;
    if (!canvas || !processedSrc) return;
    const srcCanvas = editCanvasRef.current;
    if (!srcCanvas) return;

    const paperW = mmToPx(152, 300);
    const paperH = mmToPx(102, 300);
    canvas.width = paperW;
    canvas.height = paperH;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, paperW, paperH);

    const cols = Math.floor(paperW / canvasW);
    const rows = Math.floor(paperH / canvasH);
    const gapX = (paperW - cols * canvasW) / (cols + 1);
    const gapY = (paperH - rows * canvasH) / (rows + 1);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = gapX + c * (canvasW + gapX);
        const y = gapY + r * (canvasH + gapY);
        ctx.drawImage(srcCanvas, x, y, canvasW, canvasH);
      }
    }

    ctx.fillStyle = '#666';
    ctx.font = `${mmToPx(3, 300)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(
      `${size.name} | ${cols}×${rows}=${cols * rows}张 | ${bgColor.name}底`,
      paperW / 2,
      paperH - mmToPx(2, 300),
    );
  }, [processedSrc, canvasW, canvasH, size, bgColor]);

  useEffect(() => {
    if (showLayout) drawLayout();
  }, [showLayout, drawLayout]);

  const downloadLayout = useCallback(() => {
    const canvas = resultCanvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `证件照_${size.name.replace(/\s.*/, '')}_排版.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/jpeg', 0.95);
  }, [size]);

  const openCamera = () => {
    fileInputRef.current?.setAttribute('capture', 'environment');
    fileInputRef.current?.click();
  };

  const reset = () => {
    if (processedSrc) URL.revokeObjectURL(processedSrc);
    setOriginalSrc(null);
    setProcessedSrc(null);
    setPosition({ x: 0, y: 0 });
    setZoom(1);
    setError(null);
    setShowLayout(false);
    setStep('config');
  };

  return (
    <div className="app">
      <header className="header">
        <h1>证件照制作</h1>
        {step !== 'config' && (
          <button className="btn-back" onClick={reset}>
            ← 重新开始
          </button>
        )}
      </header>

      {error && <div className="error-bar">{error}</div>}

      {step === 'config' && (
        <div className="step">
          <div className="card">
            <h2>选择尺寸</h2>
            <div className="size-grid">
              {PHOTO_SIZES.map((s) => (
                <button
                  key={s.name}
                  className={`size-btn ${size.name === s.name ? 'active' : ''}`}
                  onClick={() => setSize(s)}
                >
                  <span className="size-name">{s.name.split('(')[0].trim()}</span>
                  <span className="size-mm">
                    {s.widthMm}×{s.heightMm}mm
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <h2>选择底色</h2>
            <div className="color-row">
              {BG_COLORS.map((c) => (
                <button
                  key={c.name}
                  className={`color-btn ${bgColor.name === c.name ? 'active' : ''}`}
                  onClick={() => setBgColor(c)}
                >
                  <span className="color-swatch" style={{ background: c.hex }} />
                  <span className="color-label">{c.name}</span>
                </button>
              ))}
            </div>
            {bgColor.hex !== '#FFFFFF' && (
              <p className="note">建议穿深色有领衣服，与底色形成对比</p>
            )}
          </div>

          <button className="btn-primary btn-large" onClick={() => setStep('upload')}>
            下一步：上传照片
          </button>
        </div>
      )}

      {step === 'upload' && (
        <div className="step">
          <div className="selected-info">
            尺寸：<strong>{size.name}</strong> · 底色：
            <strong style={{ color: bgColor.hex }}>{bgColor.name}</strong>
          </div>

          <button className="btn-upload btn-primary" onClick={() => fileInputRef.current?.click()}>
            从相册选择
          </button>
          <button className="btn-upload btn-secondary" onClick={openCamera}>
            拍照
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="file-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = '';
            }}
          />

          <div className="tips">
            <h3>拍照小贴士</h3>
            <ul>
              <li>正面面对光源，避免阴影</li>
              <li>肩膀以上、头部居中</li>
              <li>穿深色有领衣服效果最佳</li>
              <li>表情自然，双眼平视</li>
              <li>背景尽量简洁（纯色墙面最理想）</li>
            </ul>
          </div>
        </div>
      )}

      {step === 'processing' && (
        <div className="step processing-step">
          <div className="spinner" />
          <p>AI 正在智能抠图中...</p>
          <p className="sub">首次加载可能需要几秒</p>
        </div>
      )}

      {step === 'edit' && processedSrc && (
        <div className="step">
          <div className="selected-info">
            尺寸：<strong>{size.name}</strong> · 底色：
            <strong style={{ color: bgColor.hex }}>{bgColor.name}</strong>
          </div>

          <p className="drag-hint">拖动人像调整位置</p>

          <div className="canvas-wrapper">
            <canvas
              ref={editCanvasRef}
              onMouseDown={onPointerDown}
              onMouseMove={onPointerMove}
              onMouseUp={onPointerUp}
              onMouseLeave={onPointerUp}
              onTouchStart={onPointerDown}
              onTouchMove={onPointerMove}
              onTouchEnd={onPointerUp}
            />
          </div>

          <div className="zoom-row">
            <span>缩放</span>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
            <span>{Math.round(zoom * 100)}%</span>
          </div>

          <div className="color-switch">
            {BG_COLORS.map((c) => (
              <button
                key={c.name}
                className={`color-dot ${bgColor.name === c.name ? 'active' : ''}`}
                style={{ background: c.hex }}
                onClick={() => setBgColor(c)}
                title={c.name}
              />
            ))}
          </div>

          <button
            className="btn-primary btn-large"
            onClick={() => {
              setShowLayout(false);
              setStep('result');
            }}
          >
            确认，下载照片
          </button>
        </div>
      )}

      {step === 'result' && (
        <div className="step">
          <h2>预览</h2>
          <p className="selected-info" style={{ marginBottom: 16 }}>
            尺寸：<strong>{size.name}</strong> · 底色：
            <strong style={{ color: bgColor.hex }}>{bgColor.name}</strong>
          </p>

          <div className="preview-img">
            <canvas
              ref={(r) => {
                if (r && editCanvasRef.current) {
                  r.width = editCanvasRef.current.width;
                  r.height = editCanvasRef.current.height;
                  r.getContext('2d')?.drawImage(editCanvasRef.current, 0, 0);
                }
              }}
            />
          </div>

          <div className="download-btns">
            <button className="btn-primary" onClick={downloadSingle}>
              下载单张照片
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                setShowLayout(true);
                setTimeout(() => {
                  resultCanvasRef.current?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
            >
              预览排版照
            </button>
          </div>

          {showLayout && (
            <div className="layout-section">
              <h3>排版照（6寸相纸）</h3>
              <canvas ref={resultCanvasRef} className="layout-canvas" />
              <button className="btn-primary" onClick={downloadLayout} style={{ marginTop: 12 }}>
                下载排版照
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;

import React, { useState, useRef } from 'react';
import { Upload, Download, Paintbrush, Layers, Cpu } from 'lucide-react';

const SketchDigitalizer = () => {
  // 状態変数
  const [originalImage, setOriginalImage] = useState(null);
  const [processedImage, setProcessedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [outputType, setOutputType] = useState('vector');
  const [processingLevel, setProcessingLevel] = useState(2);
  const [colorMode, setColorMode] = useState('original');
  const [textureMode, setTextureMode] = useState('smooth');
  const [outputFormat, setOutputFormat] = useState('png');
  
  // Refオブジェクト
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // ファイル拡張子取得関数
  const getFileExtension = () => {
    switch(outputFormat) {
      case 'svg': return 'svg';
      case 'webp': return 'webp';
      default: return 'png';
    }
  };

  // ファイルアップロード処理
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setOriginalImage(img);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // 画像処理メイン関数
  const processImage = () => {
    if (!originalImage) return;
    
    setIsProcessing(true);
    
    // Canvas設定
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = originalImage.width;
    canvas.height = originalImage.height;
    
    // 元画像を描画
    ctx.drawImage(originalImage, 0, 0);
    
    // 画像データ取得
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // 出力タイプに基づいて処理
    if (outputType === 'vector') {
      // ベクター用にエッジ検出
      const edges = detectEdges(data, canvas.width, canvas.height, processingLevel);
      applyEdges(ctx, edges, canvas.width, canvas.height);
      
      // ベクターライクなスムージング
      smoothLines(ctx, canvas.width, canvas.height);
    } else {
      // ラスター用に処理
      enhanceContrast(data);
      ctx.putImageData(imageData, 0, 0);
      
      // レベルに応じてぼかし処理
      if (processingLevel > 1) {
        applyBlur(ctx, canvas.width, canvas.height, processingLevel);
      }
    }
    
    // カラーモード適用
    applyColorMode(ctx, canvas.width, canvas.height, colorMode);
    
    // 鉛筆テクスチャ適用
    if (textureMode !== 'smooth') {
      applyPencilTexture(ctx, canvas.width, canvas.height, textureMode);
    }
    
    // 結果保存
    const format = outputFormat === 'webp' ? 'image/webp' : 'image/png';
    const quality = outputFormat === 'webp' ? 0.8 : 1.0;
    
    if (outputFormat === 'svg' && outputType === 'vector') {
      // SVG生成
      generateSVG(canvas, ctx);
    } else {
      // PNG/WebP生成
      setProcessedImage(canvas.toDataURL(format, quality));
    }
    
    setIsProcessing(false);
  };

  // エッジ検出関数
  const detectEdges = (data, width, height, intensity) => {
    const edges = new Uint8ClampedArray(width * height);
    const threshold = 30 - intensity * 5; // 強度に基づく閾値調整
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        const idx1 = ((y-1) * width + x) * 4;
        const idx2 = ((y+1) * width + x) * 4;
        const idx3 = (y * width + (x-1)) * 4;
        const idx4 = (y * width + (x+1)) * 4;
        
        // 簡易Sobelオペレータ
        const gx = 
          -1 * data[idx1] + 
           1 * data[idx2] + 
          -2 * data[idx3] + 
           2 * data[idx4];
        
        const gy = 
          -1 * data[idx3] + 
           1 * data[idx4] + 
          -2 * data[idx1] + 
           2 * data[idx2];
        
        const g = Math.sqrt(gx*gx + gy*gy);
        
        edges[y * width + x] = g > threshold ? 255 : 0;
      }
    }
    
    return edges;
  };

  // エッジをキャンバスに適用
  const applyEdges = (ctx, edges, width, height) => {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    
    for (let i = 0; i < width * height; i++) {
      const edge = edges[i];
      const idx = i * 4;
      
      if (edge === 255) {
        // エッジピクセルは黒に
        data[idx] = 0;
        data[idx+1] = 0;
        data[idx+2] = 0;
        data[idx+3] = 255;
      } else {
        // 非エッジピクセルは透明または白に
        data[idx] = 255;
        data[idx+1] = 255;
        data[idx+2] = 255;
        data[idx+3] = 0; // ベクター風のために透明に
      }
    }
    
    ctx.putImageData(imgData, 0, 0);
  };

  // ベクター風の線のスムージング
  const smoothLines = (ctx, width, height) => {
    ctx.globalAlpha = 0.5;
    ctx.filter = `blur(${processingLevel * 0.5}px)`;
    const temp = ctx.getImageData(0, 0, width, height);
    ctx.clearRect(0, 0, width, height);
    ctx.putImageData(temp, 0, 0);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
  };

  // コントラスト強調関数
  const enhanceContrast = (data) => {
    const factor = 1.2 + (processingLevel * 0.2);
    
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, (data[i] - 128) * factor + 128));
      data[i+1] = Math.min(255, Math.max(0, (data[i+1] - 128) * factor + 128));
      data[i+2] = Math.min(255, Math.max(0, (data[i+2] - 128) * factor + 128));
    }
  };

  // ぼかし適用関数
  const applyBlur = (ctx, width, height, level) => {
    ctx.filter = `blur(${level * 0.5}px)`;
    const temp = ctx.getImageData(0, 0, width, height);
    ctx.clearRect(0, 0, width, height);
    ctx.putImageData(temp, 0, 0);
    ctx.filter = 'none';
  };

  // カラーモード適用関数
  const applyColorMode = (ctx, width, height, mode) => {
    if (mode === 'original') return;
    
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      if (mode === 'grayscale') {
        const avg = (data[i] + data[i+1] + data[i+2]) / 3;
        data[i] = avg;
        data[i+1] = avg;
        data[i+2] = avg;
      } else if (mode === 'highContrast') {
        // 白黒2値化
        const avg = (data[i] + data[i+1] + data[i+2]) / 3;
        const val = avg > 128 ? 255 : 0;
        data[i] = val;
        data[i+1] = val;
        data[i+2] = val;
      }
    }
    
    ctx.putImageData(imgData, 0, 0);
  };

  // 鉛筆テクスチャ適用関数
  const applyPencilTexture = (ctx, width, height, mode) => {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    
    if (mode === 'sketch') {
      // スケッチ風テクスチャ
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          
          // 黒いピクセル(線画部分)のみに適用
          if (data[idx] < 100 && data[idx+1] < 100 && data[idx+2] < 100 && data[idx+3] > 0) {
            // ランダムなノイズを加える
            const noise = Math.random() * 30;
            data[idx] = Math.min(255, data[idx] + noise);
            data[idx+1] = Math.min(255, data[idx+1] + noise);
            data[idx+2] = Math.min(255, data[idx+2] + noise);
            
            // 線の強度にランダム性を加える
            if (Math.random() > 0.85) {
              data[idx+3] = Math.max(0, data[idx+3] - Math.random() * 100);
            }
          }
        }
      }
    } else if (mode === 'pencil') {
      // より鉛筆らしいテクスチャ
      const grainCanvas = document.createElement('canvas');
      grainCanvas.width = width;
      grainCanvas.height = height;
      const grainCtx = grainCanvas.getContext('2d');
      
      // 紙のテクスチャを生成
      grainCtx.fillStyle = '#ffffff';
      grainCtx.fillRect(0, 0, width, height);
      
      for (let i = 0; i < width * height * 0.1; i++) {
        const x = Math.floor(Math.random() * width);
        const y = Math.floor(Math.random() * height);
        const size = Math.random() * 2 + 0.5;
        const gray = Math.floor(Math.random() * 25 + 230);
        
        grainCtx.fillStyle = `rgb(${gray},${gray},${gray})`;
        grainCtx.beginPath();
        grainCtx.arc(x, y, size, 0, Math.PI * 2);
        grainCtx.fill();
      }
      
      // オリジナル画像を適用
      ctx.putImageData(imgData, 0, 0);
      
      // グレインをブレンド
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(grainCanvas, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      
      // 鉛筆の線の質感を強調
      const blendData = ctx.getImageData(0, 0, width, height);
      const blendPixels = blendData.data;
      
      for (let i = 0; i < blendPixels.length; i += 4) {
        if (blendPixels[i] < 100 && blendPixels[i+1] < 100 && blendPixels[i+2] < 100) {
          // 線の部分に粒状感を加える
          const variance = Math.random() * 20 - 10;
          blendPixels[i] = Math.max(0, Math.min(255, blendPixels[i] + variance));
          blendPixels[i+1] = Math.max(0, Math.min(255, blendPixels[i+1] + variance));
          blendPixels[i+2] = Math.max(0, Math.min(255, blendPixels[i+2] + variance));
        }
      }
      
      ctx.putImageData(blendData, 0, 0);
      return; // pencilモードでは既にctxに反映済み
    }
    
    ctx.putImageData(imgData, 0, 0);
  };

  // SVG生成関数
  const generateSVG = (canvas, ctx) => {
    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    
    // ピクセルデータから輪郭を抽出
    const paths = [];
    const visited = new Array(width * height).fill(false);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        // 黒いピクセル（線画）を検出
        if (data[idx] < 50 && data[idx+1] < 50 && data[idx+2] < 50 && data[idx+3] > 200 && !visited[y * width + x]) {
          // 輪郭追跡
          const path = tracePath(data, width, height, x, y, visited);
          if (path.length > 5) { // 短すぎるパスは無視
            paths.push(path);
          }
        }
      }
    }
    
    // SVGデータの構築
    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
    
    // テクスチャモードに応じてSVGの設定を調整
    let strokeAttributes = 'stroke="black" stroke-width="1"';
    if (textureMode === 'sketch') {
      strokeAttributes = 'stroke="black" stroke-width="1" stroke-dasharray="1,0.5" stroke-opacity="0.9"';
    } else if (textureMode === 'pencil') {
      // 複数の細い線で鉛筆風の質感を表現
      svgContent += `<filter id="pencilTexture">
        <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" result="noise"/>
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G"/>
      </filter>`;
      strokeAttributes = 'stroke="black" stroke-width="0.8" filter="url(#pencilTexture)" stroke-opacity="0.85"';
    }
    
    // 各パスをSVG要素に変換
    paths.forEach(path => {
      const pathData = generateSVGPath(path);
      svgContent += `<path d="${pathData}" fill="none" ${strokeAttributes}/>`;
      
      // 鉛筆風テクスチャの場合、影の線を追加
      if (textureMode === 'pencil') {
        svgContent += `<path d="${pathData}" fill="none" stroke="black" stroke-width="0.3" stroke-opacity="0.4" stroke-dasharray="0.5,1.5"/>`;
      }
    });
    
    svgContent += `</svg>`;
    
    // SVGデータをBase64エンコード
    const svgBlob = new Blob([svgContent], {type: 'image/svg+xml'});
    const reader = new FileReader();
    reader.onloadend = () => {
      setProcessedImage(reader.result);
    };
    reader.readAsDataURL(svgBlob);
  };
  
  // 輪郭追跡アルゴリズム
  const tracePath = (data, width, height, startX, startY, visited) => {
    const path = [];
    let x = startX;
    let y = startY;
    
    // 方向探索用の8近傍
    const directions = [
      [-1, -1], [0, -1], [1, -1],
      [-1, 0],           [1, 0],
      [-1, 1],  [0, 1],  [1, 1]
    ];
    
    let maxSteps = width * height; // 無限ループ防止
    let steps = 0;
    
    do {
      path.push([x, y]);
      visited[y * width + x] = true;
      
      let found = false;
      for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const idx = (ny * width + nx) * 4;
          if (data[idx] < 50 && data[idx+1] < 50 && data[idx+2] < 50 && data[idx+3] > 200 && !visited[ny * width + nx]) {
            x = nx;
            y = ny;
            found = true;
            break;
          }
        }
      }
      
      if (!found || ++steps > maxSteps) break;
    } while (true);
    
    return path;
  };
  
  // SVGパスデータの生成
  const generateSVGPath = (points) => {
    if (points.length === 0) return '';
    
    let d = `M ${points[0][0]} ${points[0][1]}`;
    
    // ポイントの簡略化（間引き）
    const simplifiedPoints = simplifyPoints(points, textureMode === 'smooth' ? 1.5 : 0.8);
    
    for (let i = 1; i < simplifiedPoints.length; i++) {
      d += ` L ${simplifiedPoints[i][0]} ${simplifiedPoints[i][1]}`;
    }
    
    return d;
  };
  
  // ポイントの間引き（Douglas-Peuckerアルゴリズム簡易版）
  const simplifyPoints = (points, tolerance) => {
    if (points.length <= 2) return points;
    
    const simplified = [points[0]];
    let lastPoint = 0;
    
    for (let i = 1; i < points.length - 1; i++) {
      const [x1, y1] = points[lastPoint];
      const [x2, y2] = points[i];
      const [x3, y3] = points[i + 1];
      
      // 3点間の角度変化を計算
      const angle1 = Math.atan2(y2 - y1, x2 - x1);
      const angle2 = Math.atan2(y3 - y2, x3 - x2);
      const angleDiff = Math.abs(angle2 - angle1);
      
      // 角度変化が大きい場合はポイントを保持
      if (angleDiff > tolerance) {
        simplified.push(points[i]);
        lastPoint = i;
      }
    }
    
    simplified.push(points[points.length - 1]);
    return simplified;
  };

  // ダウンロード処理
  const downloadImage = () => {
    if (!processedImage) return;
    
    try {
      // データURLからファイルタイプを判断
      const isDataURL = processedImage.startsWith('data:');
      const mimeType = isDataURL ? processedImage.split(',')[0].split(':')[1].split(';')[0] : 'image/png';
      const extension = outputFormat === 'svg' ? 'svg' : (outputFormat === 'webp' ? 'webp' : 'png');
      
      // データ処理
      let blob;
      if (isDataURL) {
        const byteString = atob(processedImage.split(',')[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        
        blob = new Blob([ab], { type: mimeType });
      } else {
        // 直接SVGテキストの場合
        blob = new Blob([processedImage], { type: 'image/svg+xml' });
      }
      
      const blobUrl = URL.createObjectURL(blob);
      
      // ダウンロードリンク作成
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `digitized_${outputType}_sketch.${extension}`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      
      // クリーンアップ
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }, 100);
    } catch (error) {
      console.error("ダウンロード中にエラーが発生しました:", error);
      alert("ダウンロードに失敗しました。ブラウザの設定を確認してください。");
    }
  };

  return (
    <div className="flex flex-col items-center w-full bg-gray-50 p-6 rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold mb-6">手描きイラストデジタル変換ツール</h1>
      
      <div className="w-full max-w-4xl">
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="flex items-center justify-center mb-4">
            <button 
              onClick={() => fileInputRef.current.click()} 
              className="flex items-center bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-2"
            >
              <Upload className="mr-2 h-5 w-5" />
              イラストをアップロード
            </button>
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileUpload} 
              accept="image/*" 
              className="hidden"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
            <div className="flex flex-col">
              <label className="mb-2 font-medium">出力タイプ</label>
              <div className="flex space-x-2">
                <button 
                  onClick={() => setOutputType('vector')} 
                  className={`flex-1 px-3 py-2 rounded-lg border ${outputType === 'vector' ? 'bg-blue-100 border-blue-500' : 'border-gray-300'}`}
                >
                  <Layers className="h-5 w-5 mx-auto mb-1" />
                  ベクター
                </button>
                <button 
                  onClick={() => setOutputType('raster')} 
                  className={`flex-1 px-3 py-2 rounded-lg border ${outputType === 'raster' ? 'bg-blue-100 border-blue-500' : 'border-gray-300'}`}
                >
                  <span className="block h-5 w-5 mx-auto mb-1">🖼️</span>
                  ラスター
                </button>
              </div>
            </div>
            
            <div className="flex flex-col">
              <label className="mb-2 font-medium">処理レベル</label>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => setProcessingLevel(1)} 
                  className={`flex-1 px-3 py-2 rounded-lg border ${processingLevel === 1 ? 'bg-blue-100 border-blue-500' : 'border-gray-300'}`}
                >
                  低
                </button>
                <button 
                  onClick={() => setProcessingLevel(2)} 
                  className={`flex-1 px-3 py-2 rounded-lg border ${processingLevel === 2 ? 'bg-blue-100 border-blue-500' : 'border-gray-300'}`}
                >
                  中
                </button>
                <button 
                  onClick={() => setProcessingLevel(3)} 
                  className={`flex-1 px-3 py-2 rounded-lg border ${processingLevel === 3 ? 'bg-blue-100 border-blue-500' : 'border-gray-300'}`}
                >
                  高
                </button>
              </div>
            </div>
            
            <div className="flex flex-col">
              <label className="mb-2 font-medium">カラーモード</label>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => setColorMode('original')} 
                  className={`flex-1 px-3 py-2 rounded-lg border ${colorMode === 'original' ? 'bg-blue-100 border-blue-500' : 'border-gray-300'}`}
                >
                  <Paintbrush className="h-5 w-5 mx-auto mb-1" />
                  オリジナル
                </button>
                <button 
                  onClick={() => setColorMode('grayscale')} 
                  className={`flex-1 px-3 py-2 rounded-lg border ${colorMode === 'grayscale' ? 'bg-blue-100 border-blue-500' : 'border-gray-300'}`}
                >
                  白黒
                </button>
              </div>
            </div>
            
            <div className="flex flex-col">
              <label className="mb-2 font-medium">鉛筆テクスチャ</label>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => setTextureMode('smooth')} 
                  className={`flex-1 px-3 py-2 rounded-lg border ${textureMode === 'smooth' ? 'bg-blue-100 border-blue-500' : 'border-gray-300'}`}
                >
                  スムース
                </button>
                <button 
                  onClick={() => setTextureMode('sketch')} 
                  className={`flex-1 px-3 py-2 rounded-lg border ${textureMode === 'sketch' ? 'bg-blue-100 border-blue-500' : 'border-gray-300'}`}
                >
                  軽い鉛筆感
                </button>
                <button 
                  onClick={() => setTextureMode('pencil')} 
                  className={`flex-1 px-3 py-2 rounded-lg border ${textureMode === 'pencil' ? 'bg-blue-100 border-blue-500' : 'border-gray-300'}`}
                >
                  強い鉛筆感
                </button>
              </div>
            </div>
            
            <div className="flex flex-col">
              <label className="mb-2 font-medium">出力フォーマット</label>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => setOutputFormat('png')} 
                  className={`flex-1 px-3 py-2 rounded-lg border ${outputFormat === 'png' ? 'bg-blue-100 border-blue-500' : 'border-gray-300'}`}
                >
                  PNG
                </button>
                <button 
                  onClick={() => setOutputFormat('webp')} 
                  className={`flex-1 px-3 py-2 rounded-lg border ${outputFormat === 'webp' ? 'bg-blue-100 border-blue-500' : 'border-gray-300'}`}
                >
                  WebP
                </button>
                <button 
                  onClick={() => setOutputFormat('svg')} 
                  className={`flex-1 px-3 py-2 rounded-lg border ${outputFormat === 'svg' ? 'bg-blue-100 border-blue-500' : 'border-gray-300'}`}
                  disabled={outputType !== 'vector'}
                >
                  SVG
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex justify-center mt-4">
            <button 
              onClick={processImage} 
              disabled={!originalImage || isProcessing}
              className={`flex items-center px-6 py-3 rounded-lg text-white ${!originalImage || isProcessing ? 'bg-gray-400' : 'bg-green-500 hover:bg-green-600'}`}
            >
              <Cpu className="mr-2 h-5 w-5" />
              {isProcessing ? '処理中...' : '変換する'}
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-3">元の画像</h2>
            <div className="flex items-center justify-center h-64 bg-gray-100 rounded border border-gray-200">
              {originalImage ? (
                <img 
                  src={originalImage.src} 
                  alt="Original sketch" 
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <p className="text-gray-500">画像がアップロードされていません</p>
              )}
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-3">処理済み画像</h2>
            <div className="flex items-center justify-center h-64 bg-gray-100 rounded border border-gray-200">
              {processedImage ? (
                <img 
                  src={processedImage} 
                  alt="Digitized sketch" 
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <p className="text-gray-500">画像が処理されていません</p>
              )}
            </div>
            
            {processedImage && (
              <div className="flex justify-center mt-4">
                <button 
                  onClick={downloadImage} 
                  className="flex items-center bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-2"
                >
                  <Download className="mr-2 h-5 w-5" />
                  ダウンロード
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <canvas ref={canvasRef} className="hidden" />
      
      <div className="mt-6 p-4 bg-white rounded-lg shadow w-full max-w-4xl">
        <h2 className="text-lg font-semibold mb-3">使い方ガイド</h2>
        <ol className="list-decimal pl-5 space-y-2">
          <li>「イラストをアップロード」ボタンをクリックして手描きイラストを選択</li>
          <li>出力タイプを選択:
            <ul className="list-disc pl-5 mt-1">
              <li><strong>ベクター</strong>: 線画を強調し、SVGのようなクリアな線を生成</li>
              <li><strong>ラスター</strong>: より自然な質感を保持しつつデジタル化</li>
            </ul>
          </li>
          <li>処理レベル（低・中・高）で詳細さとスムースさを調整</li>
          <li>カラーモードでオリジナルカラーを保持するか白黒にするか選択</li>
          <li>鉛筆テクスチャを選択:
            <ul className="list-disc pl-5 mt-1">
              <li><strong>スムース</strong>: クリーンなデジタルイラスト風</li>
              <li><strong>軽い鉛筆感</strong>: わずかな粒状感と不均一さを保持</li>
              <li><strong>強い鉛筆感</strong>: 紙のテクスチャと鉛筆の粒状感を再現</li>
            </ul>
          </li>
          <li>出力フォーマットを選択:
            <ul className="list-disc pl-5 mt-1">
              <li><strong>PNG</strong>: 高品質画像、透明度対応</li>
              <li><strong>WebP</strong>: 軽量ファイルサイズ、ウェブ用に最適化</li>
              <li><strong>SVG</strong>: 編集可能なベクター形式（ベクタータイプのみ）</li>
            </ul>
          </li>
          <li>「変換する」をクリックして処理開始</li>
          <li>処理後、結果を「ダウンロード」ボタンで保存</li>
        </ol>
      </div>
    </div>
  );
};

export default SketchDigitalizer;
          
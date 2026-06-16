import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Asset, Position } from '../types';
import { X, ShieldAlert, TrendingUp, TrendingDown, Target, Zap, Settings2 } from 'lucide-react';

interface DetailModalProps {
  asset: Asset;
  balance: number;
  activePositions: Position[];
  onClose: () => void;
  onOpenPosition: (positionData: {
    type: 'LONG' | 'SHORT';
    quantity: number;
    leverage: number;
    sl?: number;
    tp?: number;
    entryPrice: number; // custom or current
    isLimit: boolean;
  }) => void;
  onClosePosition: (id: string) => void;
}

export default function DetailModal({
  asset,
  balance,
  activePositions,
  onClose,
  onOpenPosition,
  onClosePosition
}: DetailModalProps) {
  const [tradeType, setTradeType] = useState<'LONG' | 'SHORT'>('LONG');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [limitPrice, setLimitPrice] = useState<string>(asset.price.toString());
  const [quantity, setQuantity] = useState<number>(1); // default lots or size
  const [leverage, setLeverage] = useState<number>(10);
  
  // SL / TP
  const [useSL, setUseSL] = useState(false);
  const [useTP, setUseTP] = useState(false);
  const [slPrice, setSlPrice] = useState<string>('');
  const [tpPrice, setTpPrice] = useState<string>('');

  // SVG Scaler Range State - represents +/- percent bounds from current/selected price
  const [scalePercent, setScalePercent] = useState<number>(2); // defaults to +/- 2% bounds

  // Reference price is limitPrice if LIMIT, or asset.price if MARKET
  const referencePrice = useMemo(() => {
    if (orderType === 'LIMIT') {
      const parsed = parseFloat(limitPrice);
      return isNaN(parsed) || parsed <= 0 ? asset.price : parsed;
    }
    return asset.price;
  }, [orderType, limitPrice, asset.price]);

  // Sync SL/TP default helpers when tradeType or referencePrice changes
  useEffect(() => {
    if (!slPrice) {
      const defaultSl = tradeType === 'LONG' 
        ? referencePrice * 0.98 
        : referencePrice * 1.02;
      setSlPrice(defaultSl.toFixed(asset.category === 'FOREX' ? 5 : 2));
    }
    if (!tpPrice) {
      const defaultTp = tradeType === 'LONG' 
        ? referencePrice * 1.04 
        : referencePrice * 0.96;
      setTpPrice(defaultTp.toFixed(asset.category === 'FOREX' ? 5 : 2));
    }
  }, [tradeType, referencePrice, asset.category]);

  // Adjust sl/tp presets on trade type toggle
  const handleTradeTypeToggle = (type: 'LONG' | 'SHORT') => {
    setTradeType(type);
    const slVal = type === 'LONG' ? referencePrice * 0.98 : referencePrice * 1.02;
    const tpVal = type === 'LONG' ? referencePrice * 1.04 : referencePrice * 0.96;
    setSlPrice(slVal.toFixed(asset.category === 'FOREX' ? 5 : 2));
    setTpPrice(tpVal.toFixed(asset.category === 'FOREX' ? 5 : 2));
  };

  // Sync limit input price with active asset price initially
  useEffect(() => {
    if (orderType === 'MARKET') {
      setLimitPrice(asset.price.toString());
    }
  }, [asset.price, orderType]);

  // Calculate required margin
  const marginRequired = useMemo(() => {
    const lotMultiplier = asset.category === 'FOREX' ? 10000 : asset.category === 'CRYPTO' ? 1 : 100;
    const contractValue = referencePrice * quantity * lotMultiplier;
    return contractValue / leverage;
  }, [referencePrice, quantity, leverage, asset.category]);

  const hasEnoughFunds = balance >= marginRequired;

  // Compile active positions for this asset
  const localPositions = useMemo(() => {
    return activePositions.filter(p => p.pair === asset.symbol && p.status === 'ACTIVE');
  }, [activePositions, asset.symbol]);

  // SVG dimensions for pricing horizontal overlay
  const bounds = useMemo(() => {
    const minPrice = asset.price * (1 - scalePercent / 100);
    const maxPrice = asset.price * (1 + scalePercent / 100);
    return { minPrice, maxPrice };
  }, [asset.price, scalePercent]);

  // Helper function to map a price value to SVG vertical percentage (Y coordinates)
  const getPriceYPercent = (priceVal: number) => {
    const { minPrice, maxPrice } = bounds;
    if (maxPrice === minPrice) return 50;
    
    // Y flows from 0 (top / high price) to 100 (bottom / low price)
    const pct = ((maxPrice - priceVal) / (maxPrice - minPrice)) * 100;
    return Math.max(0, Math.min(100, pct));
  };

  // Live profit projections
  const projections = useMemo(() => {
    const slVal = parseFloat(slPrice);
    const tpVal = parseFloat(tpPrice);
    const isValidSl = !isNaN(slVal) && slVal > 0;
    const isValidTp = !isNaN(tpVal) && tpVal > 0;
    const lotMultiplier = asset.category === 'FOREX' ? 10000 : asset.category === 'CRYPTO' ? 1 : 100;

    let slPnl = 0;
    let tpPnl = 0;

    if (tradeType === 'LONG') {
      slPnl = isValidSl ? (slVal - referencePrice) * quantity * lotMultiplier : 0;
      tpPnl = isValidTp ? (tpVal - referencePrice) * quantity * lotMultiplier : 0;
    } else {
      slPnl = isValidSl ? (referencePrice - slVal) * quantity * lotMultiplier : 0;
      tpPnl = isValidTp ? (referencePrice - tpVal) * quantity * lotMultiplier : 0;
    }

    return { slPnl, tpPnl };
  }, [slPrice, tpPrice, referencePrice, quantity, tradeType, asset.category]);

  const handleExecute = () => {
    const slVal = useSL ? parseFloat(slPrice) : undefined;
    const tpVal = useTP ? parseFloat(tpPrice) : undefined;
    
    // Simple validation
    if (useSL && slVal) {
      if (tradeType === 'LONG' && slVal >= referencePrice) {
        alert("Stop Loss untuk LONG harus di bawah harga entry!");
        return;
      }
      if (tradeType === 'SHORT' && slVal <= referencePrice) {
        alert("Stop Loss untuk SHORT harus di atas harga entry!");
        return;
      }
    }

    if (useTP && tpVal) {
      if (tradeType === 'LONG' && tpVal <= referencePrice) {
        alert("Take Profit untuk LONG harus di atas harga entry!");
        return;
      }
      if (tradeType === 'SHORT' && tpVal >= referencePrice) {
        alert("Take Profit untuk SHORT harus di bawah harga entry!");
        return;
      }
    }

    onOpenPosition({
      type: tradeType,
      quantity,
      leverage,
      sl: useSL ? slVal : undefined,
      tp: useTP ? tpVal : undefined,
      entryPrice: referencePrice,
      isLimit: orderType === 'LIMIT'
    });
  };

  // Convert trading view token format
  const encodedWidgetSymbol = encodeURIComponent(asset.tradingViewSymbol);
  const tradingViewUrl = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_chart&symbol=${encodedWidgetSymbol}&interval=5&hidesidetoolbar=1&symboledit=0&saveimage=0&toolbarbg=f1f3f6&theme=dark&style=1&timezone=Etc%2FUTC&locale=id`;

  return (
    <div id="detail_modal_backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div 
        id="detail_modal_container" 
        className="relative w-full max-w-6xl animate-in fade-in zoom-in-95 duration-200 bg-[#FCFBF4] border-4 border-black text-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none flex flex-col md:flex-row overflow-hidden"
      >
        {/* Close button - absolute top right */}
        <button 
          id="close_modal_btn"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 p-2 bg-yellow-400 border-2 border-black hover:bg-yellow-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-transform active:translate-y-0.5"
        >
          <X className="w-5 h-5 text-black" />
        </button>

        {/* Left pane: Title + Visual TradingView Chart + Overlay Canvas */}
        <div className="flex-1 p-6 border-b-4 md:border-b-0 md:border-r-4 border-black flex flex-col min-w-[320px]">
          <div className="flex items-center gap-3 mb-4">
            <span className={`px-3 py-1 text-xs font-bold uppercase border-2 border-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] ${
              asset.theme === 'yellow' ? 'bg-yellow-300' :
              asset.theme === 'pink' ? 'bg-pink-300' :
              asset.theme === 'purple' ? 'bg-purple-300' :
              asset.theme === 'blue' ? 'bg-blue-300' : 'bg-emerald-300'
            }`}>
              {asset.category}
            </span>
            <span className="text-sm font-mono text-gray-700 bg-gray-100 px-2 py-0.5 border border-black">
              {asset.creator}
            </span>
          </div>

          <div className="mb-4">
            <h2 className="text-3xl font-extrabold tracking-tight font-sans">
              {asset.symbol}
            </h2>
            <p className="text-sm text-gray-600 font-mono mt-0.5">{asset.name}</p>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-2 mb-4 bg-yellow-50 p-2 border-2 border-dashed border-black">
            <div>
              <div className="text-[10px] font-mono uppercase text-gray-500">Harga Live</div>
              <div className="text-md font-bold font-mono">
                {asset.price.toLocaleString(undefined, { minimumFractionDigits: asset.category === 'FOREX' ? 5 : 2 })}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase text-gray-500">24H Perubahan</div>
              <div className={`text-sm font-extrabold font-mono ${asset.change24h >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {asset.change24h >= 0 ? '+' : ''}{asset.change24h}%
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase text-gray-500">Rating Komunitas</div>
              <div className="text-xs font-semibold text-yellow-600">{asset.rating}</div>
            </div>
          </div>

          {/* Live Chart Canvas Area */}
          <div className="relative border-4 border-black bg-neutral-900 overflow-hidden h-[420px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <iframe 
              src={tradingViewUrl}
              className="w-full h-full border-0 absolute inset-0"
              title={`TradingView Chart ${asset.symbol}`}
              id="tradingview_iframe"
            />

            {/* SVG OVERLAY CANVAS (Plots Entry, SL, TP of positions on top of chart) */}
            <svg 
              className="absolute inset-0 w-full h-full pointer-events-none z-10"
              id="chart_overlay_svg"
            >
              {/* Grid bounds indicator lines (subtle top & bottom range guides) */}
              <line 
                x1="0" 
                y1="5%" 
                x2="100%" 
                y2="5%" 
                stroke="white" 
                strokeOpacity="0.1" 
                strokeDasharray="4,4" 
              />
              <text 
                x="10px" 
                y="15px" 
                fill="white" 
                fillOpacity="0.4" 
                fontSize="9" 
                fontFamily="monospace"
              >
                Max Bound: {bounds.maxPrice.toLocaleString(undefined, { minimumFractionDigits: asset.category === 'FOREX' ? 4 : 2 })}
              </text>

              <line 
                x1="0" 
                y1="95%" 
                x2="100%" 
                y2="95%" 
                stroke="white" 
                strokeOpacity="0.1" 
                strokeDasharray="4,4" 
              />
              <text 
                x="10px" 
                y="98%" 
                fill="white" 
                fillOpacity="0.4" 
                fontSize="9" 
                fontFamily="monospace"
              >
                Min Bound: {bounds.minPrice.toLocaleString(undefined, { minimumFractionDigits: asset.category === 'FOREX' ? 4 : 2 })}
              </text>

              {/* CURRENT LIVE PRICE LINE */}
              {(() => {
                const yPct = getPriceYPercent(asset.price);
                return (
                  <g key="current-price-indicator">
                    <line 
                      x1="0" 
                      y1={`${yPct}%`} 
                      x2="100%" 
                      y2={`${yPct}%`} 
                      stroke="#EAB308" 
                      strokeWidth="2" 
                      strokeDasharray="3,2" 
                    />
                    <foreignObject 
                      x="70%" 
                      y={`calc(${yPct}% - 12px)`} 
                      width="120" 
                      height="24"
                    >
                      <div className="px-2 py-0.5 bg-yellow-400 border border-black text-black font-mono text-[9px] font-bold text-center rounded-none shadow-[1px_1px_0px_rgba(0,0,0,1)] uppercase">
                        LIVE: {asset.price.toLocaleString(undefined, { minimumFractionDigits: asset.category === 'FOREX' ? 5 : 2 })}
                      </div>
                    </foreignObject>
                  </g>
                );
              })()}

              {/* ACTIVE POSITIONS HORIZONTAL PLOTS */}
              {localPositions.map((pos) => {
                const entryYPct = getPriceYPercent(pos.entryPrice);
                const hasSL = pos.sl !== undefined;
                const entryLabel = `${pos.type} ENTRY (${pos.quantity} Lot) @ ${pos.entryPrice.toLocaleString(undefined, { minimumFractionDigits: asset.category === 'FOREX' ? 4 : 2 })}`;

                return (
                  <g key={`pos-plot-${pos.id}`}>
                    {/* Entry Line */}
                    <line 
                      x1="5%" 
                      y1={`${entryYPct}%`} 
                      x2="95%" 
                      y2={`${entryYPct}%`} 
                      stroke={pos.type === 'LONG' ? '#22C55E' : '#EF4444'} 
                      strokeWidth="2.5" 
                    />
                    <circle cx="5%" cy={`${entryYPct}%`} r="4.5" fill={pos.type === 'LONG' ? '#22C55E' : '#EF4444'} stroke="black" strokeWidth="1" />
                    <circle cx="95%" cy={`${entryYPct}%`} r="4.5" fill={pos.type === 'LONG' ? '#22C55E' : '#EF4444'} stroke="black" strokeWidth="1" />
                    
                    {/* Entry Label in overlay */}
                    <foreignObject 
                      x="10%" 
                      y={`calc(${entryYPct}% - 14px)`} 
                      width="230" 
                      height="24"
                    >
                      <div className={`px-2 py-0.5 text-white font-mono text-[9px] border border-black rounded-none shadow-[2px_2px_0px_rgba(0,0,0,1)] uppercase truncate font-bold ${
                        pos.type === 'LONG' ? 'bg-emerald-600' : 'bg-rose-600'
                      }`}>
                        {entryLabel}
                      </div>
                    </foreignObject>

                    {/* STOP LOSS PLOT */}
                    {hasSL && pos.sl && (() => {
                      const slYPct = getPriceYPercent(pos.sl);
                      return (
                        <g key={`sl-${pos.id}`}>
                          <line 
                            x1="15%" 
                            y1={`${slYPct}%`} 
                            x2="85%" 
                            y2={`${slYPct}%`} 
                            stroke="#EF4444" 
                            strokeWidth="1.5" 
                            strokeDasharray="4,3" 
                          />
                          <polygon points={`0,0 -4,8 4,8`} transform={`translate(${15 * 0.01 * 400}, ${slYPct * 0.01 * 420})`} fill="#EF4444" stroke="black" strokeWidth="0.5" />
                          <foreignObject 
                            x="45%" 
                            y={`calc(${slYPct}% - 12px)`} 
                            width="110" 
                            height="24"
                          >
                            <div className="px-2 py-0.5 bg-rose-200 border border-black text-rose-900 font-mono text-[8px] font-bold text-center rounded-none shadow-[1px_1px_0px_rgba(0,0,0,1)] uppercase">
                              SL: {pos.sl.toLocaleString(undefined, { minimumFractionDigits: asset.category === 'FOREX' ? 3 : 2 })}
                            </div>
                          </foreignObject>
                        </g>
                      );
                    })()}

                    {/* TAKE PROFIT PLOT */}
                    {pos.tp && (() => {
                      const tpYPct = getPriceYPercent(pos.tp);
                      return (
                        <g key={`tp-${pos.id}`}>
                          <line 
                            x1="15%" 
                            y1={`${tpYPct}%`} 
                            x2="85%" 
                            y2={`${tpYPct}%`} 
                            stroke="#10B981" 
                            strokeWidth="1.5" 
                            strokeDasharray="4,3" 
                          />
                          <foreignObject 
                            x="25%" 
                            y={`calc(${tpYPct}% - 12px)`} 
                            width="110" 
                            height="24"
                          >
                            <div className="px-2 py-0.5 bg-emerald-200 border border-black text-emerald-900 font-mono text-[8px] font-bold text-center rounded-none shadow-[1px_1px_0px_rgba(0,0,0,1)] uppercase">
                              TP: {pos.tp.toLocaleString(undefined, { minimumFractionDigits: asset.category === 'FOREX' ? 3 : 2 })}
                            </div>
                          </foreignObject>
                        </g>
                      );
                    })()}
                  </g>
                );
              })}
            </svg>

            {/* Scale controller badge inside the bottom header of chart */}
            <div className="absolute bottom-3 left-3 z-20 flex items-center bg-black/85 border border-white/20 p-2 rounded-none space-x-1 font-mono text-white text-[10px]">
              <Settings2 className="w-3.5 h-3.5 text-yellow-400 mr-1" />
              <span>Overlay Zoom:</span>
              <button 
                onClick={() => setScalePercent(prev => Math.max(0.5, prev - 0.5))}
                className="px-1.5 py-0.5 bg-neutral-800 hover:bg-neutral-700 rounded border border-neutral-600 font-bold"
                title="Sempitkan area overlay"
              >
                -
              </button>
              <span className="font-bold text-yellow-400 px-1">{scalePercent}%</span>
              <button 
                onClick={() => setScalePercent(prev => Math.min(15, prev + 0.5))}
                className="px-1.5 py-0.5 bg-neutral-800 hover:bg-neutral-700 rounded border border-neutral-600 font-bold"
                title="Lebarkan area overlay"
              >
                +
              </button>
            </div>
            
            {/* Legend guide */}
            <div className="absolute top-3 left-3 z-20 flex flex-col space-y-1 bg-black/80 border border-white/10 p-2 font-mono text-white text-[9px] rounded-none pointer-events-none">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-0.5 bg-emerald-500"></span>
                <span>LONG Entry</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-0.5 bg-rose-500"></span>
                <span>SHORT Entry</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-0.5 bg-yellow-500 border-dashed"></span>
                <span>Mata Uang Spot</span>
              </div>
            </div>
          </div>

          <p className="text-gray-600 text-xs font-mono mt-4 leading-relaxed bg-white border border-gray-200 p-2">
            <strong>Deskripsi:</strong> {asset.description}
          </p>
        </div>

        {/* Right pane: Action Panel (Neobrutalis design) */}
        <div id="execution_action_panel" className="w-full md:w-96 p-6 bg-[#FCFBF4] flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-black uppercase tracking-tight font-sans text-gray-900 border-b-2 border-black pb-1">
                EKSEKUSI TRADING
              </h3>
              <span className="text-xs font-mono font-bold bg-purple-100 px-2 py-0.5 border border-black text-purple-800">
                LIVE TERMINAL
              </span>
            </div>

            {/* LONG / SHORT Toggle Buttons */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <button
                id="long_toggle_btn"
                onClick={() => handleTradeTypeToggle('LONG')}
                className={`py-3 px-4 font-black text-sm uppercase flex items-center justify-center gap-2 border-3 border-black rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-transform duration-100 ${
                  tradeType === 'LONG'
                    ? 'bg-emerald-400 text-black translate-x-[1px] translate-y-[1px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    : 'bg-white hover:bg-neutral-50 hover:-translate-y-0.5'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                LONG / BELI
              </button>
              <button
                id="short_toggle_btn"
                onClick={() => handleTradeTypeToggle('SHORT')}
                className={`py-3 px-4 font-black text-sm uppercase flex items-center justify-center gap-2 border-3 border-black rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-transform duration-100 ${
                  tradeType === 'SHORT'
                    ? 'bg-rose-400 text-black translate-x-[1px] translate-y-[1px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    : 'bg-white hover:bg-neutral-50 hover:-translate-y-0.5'
                }`}
              >
                <TrendingDown className="w-4 h-4" />
                SHORT / JUAL
              </button>
            </div>

            {/* Order Type Toggle */}
            <div className="flex items-center bg-gray-100 border-2 border-black rounded-none mb-5 p-1 text-xs font-mono">
              <button
                onClick={() => setOrderType('MARKET')}
                className={`flex-1 py-1.5 text-center font-bold uppercase transition-colors ${
                  orderType === 'MARKET' ? 'bg-black text-white' : 'hover:bg-gray-200 text-black'
                }`}
              >
                Market Order
              </button>
              <button
                onClick={() => setOrderType('LIMIT')}
                className={`flex-1 py-1.5 text-center font-bold uppercase transition-colors ${
                  orderType === 'LIMIT' ? 'bg-black text-white' : 'hover:bg-gray-200 text-black'
                }`}
              >
                Limit Order
              </button>
            </div>

            {/* Inputs Form */}
            <div className="space-y-4">
              {orderType === 'LIMIT' && (
                <div>
                  <label className="block text-xs font-bold font-mono uppercase text-gray-800 mb-1">
                    Harga Batas (Limit Price USD)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value)}
                    className="w-full bg-white border-2 border-black p-2 font-mono text-sm focus:outline-none focus:bg-yellow-50 shadow-[2px_2px_0px_rgba(0,0,0,1)]"
                  />
                  <p className="text-[10px] font-mono text-gray-500 mt-1">
                    Posisi akan tereksekusi pada harga ini saat terpacu.
                  </p>
                </div>
              )}

              {/* Quantity Lot Size Selector */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold font-mono uppercase text-gray-800">
                    Volume Ukuran (Lots)
                  </label>
                  <span className="text-[10px] font-mono bg-neutral-200 px-1.5 border border-black">
                    1 Lot = {asset.category === 'FOREX' ? '10K' : asset.category === 'CRYPTO' ? '1' : '100'} Unit
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setQuantity(q => Math.max(0.01, parseFloat((q - 0.1).toFixed(2))))}
                    className="w-9 h-9 border-2 border-black font-bold bg-white text-md shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(0.01, parseFloat(parseFloat(e.target.value).toFixed(2)) || 0.01))}
                    className="flex-1 bg-white border-2 border-black p-1.5 text-center font-mono font-bold text-sm focus:outline-none focus:bg-yellow-50 shadow-[1.5px_1.5px_0px_rgba(0,0,0,1)]"
                  />
                  <button 
                    onClick={() => setQuantity(q => parseFloat((q + 0.1).toFixed(2)))}
                    className="w-9 h-9 border-2 border-black font-bold bg-white text-md shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Leverage Selector */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold font-mono uppercase text-gray-800">
                    Leverage (Kelipatan Daya)
                  </label>
                  <span className="text-xs font-mono font-black text-rose-700 bg-rose-50 border border-black px-1.5">
                    {leverage}x
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  value={leverage}
                  onChange={(e) => setLeverage(parseInt(e.target.value))}
                  className="w-full accent-black cursor-pointer"
                />
                <div className="flex justify-between text-[9px] font-mono text-gray-500 -mt-1">
                  <span>1x (Tanpa Risk)</span>
                  <span>50x</span>
                  <span>100x (Maks)</span>
                </div>
              </div>

              {/* Advanced Controls: STOP LOSS (SL) & TAKE PROFIT (TP) */}
              <div className="border-t border-dashed border-neutral-300 pt-3">
                {/* Use SL checkbox */}
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center text-xs font-mono font-bold text-gray-800 space-x-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={useSL} 
                      onChange={(e) => setUseSL(e.target.checked)} 
                      className="accent-black border-2 border-black"
                    />
                    <span>PASANG STOP LOSS (SL)</span>
                  </label>
                  <span className="text-[9px] text-rose-600 font-bold bg-rose-50 px-1 border border-rose-200">Batas Rugi</span>
                </div>
                {useSL && (
                  <div className="mb-3">
                    <input
                      type="number"
                      step="any"
                      placeholder="Contoh: 2300"
                      value={slPrice}
                      onChange={(e) => setSlPrice(e.target.value)}
                      className="w-full bg-white border-2 border-black p-1.5 font-mono text-xs focus:outline-none focus:bg-yellow-50 shadow-[1.5px_1.5px_0px_rgba(0,0,0,1)]"
                    />
                    <div className="text-[10px] font-mono text-rose-600 mt-1 flex justify-between">
                      <span>Proyeksi Rugi Maks:</span>
                      <span className="font-bold">
                        {projections.slPnl < 0 
                          ? `-$${Math.abs(projections.slPnl).toLocaleString(undefined, { maximumFractionDigits: 2 })}` 
                          : `$${projections.slPnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                        }
                      </span>
                    </div>
                  </div>
                )}

                {/* Use TP checkbox */}
                <div className="flex items-center justify-between mb-2 mt-3">
                  <label className="flex items-center text-xs font-mono font-bold text-gray-800 space-x-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={useTP} 
                      onChange={(e) => setUseTP(e.target.checked)} 
                      className="accent-black border-2 border-black"
                    />
                    <span>PASANG TAKE PROFIT (TP)</span>
                  </label>
                  <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1 border border-emerald-200">Target Cuan</span>
                </div>
                {useTP && (
                  <div>
                    <input
                      type="number"
                      step="any"
                      placeholder="Contoh: 2360"
                      value={tpPrice}
                      onChange={(e) => setTpPrice(e.target.value)}
                      className="w-full bg-white border-2 border-black p-1.5 font-mono text-xs focus:outline-none focus:bg-yellow-50 shadow-[1.5px_1.5px_0px_rgba(0,0,0,1)]"
                    />
                    <div className="text-[10px] font-mono text-emerald-600 mt-1 flex justify-between">
                      <span>Proyeksi Untung Maks:</span>
                      <span className="font-bold">
                        {projections.tpPnl >= 0 
                          ? `+$${projections.tpPnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}` 
                          : `$${projections.tpPnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                        }
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Execution Stats Card */}
          <div className="mt-6 border-t-2 border-black pt-4">
            <div className="bg-neutral-100 p-3 border-2 border-black mb-4 font-mono text-[11px] space-y-1.5 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
              <div className="flex justify-between">
                <span className="text-gray-600">Jaminan Margin:</span>
                <span className="font-bold">
                  ${marginRequired.toLocaleString(undefined, { maximumFractionDigits: 2 })} USD
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Daya Beli Sisa:</span>
                <span className="font-bold text-black">
                  ${balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} USD
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-300 pt-1 mt-1 text-xs">
                <span className="font-bold">Kelayakan Saldo:</span>
                <span className={`font-black uppercase ${hasEnoughFunds ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {hasEnoughFunds ? 'MENCUKUPI ✓' : 'SALDO KURANG ✗'}
                </span>
              </div>
            </div>

            {/* Execute trigger button */}
            <button
              id="execute_order_confirm_btn"
              onClick={handleExecute}
              disabled={!hasEnoughFunds}
              className={`w-full py-4 px-6 font-black text-sm uppercase flex items-center justify-center gap-2 border-3 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-transform duration-100 ${
                hasEnoughFunds
                  ? 'bg-rose-500 text-white hover:bg-rose-600 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                  : 'bg-neutral-300 text-neutral-600 cursor-not-allowed shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
              }`}
            >
              <Zap className="w-5 h-5 text-yellow-300" />
              KONFIRMASI EKSEKUSI POSISI
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

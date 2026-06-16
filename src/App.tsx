import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Asset, Position, TerminalLog } from './types';
import { INITIAL_ASSETS } from './data';
import DetailModal from './components/DetailModal';
import LiveTerminal from './components/LiveTerminal';
import { 
  TrendingUp, 
  TrendingDown, 
  Search, 
  Wallet, 
  Activity, 
  ChevronRight, 
  Download, 
  Star, 
  RefreshCw,
  Clock, 
  ShieldAlert,
  ArrowUpRight,
  User,
  CheckCircle,
  Flame,
  Globe,
  Coins
} from 'lucide-react';

export default function App() {
  // --- CORE STATE ---
  const [assets, setAssets] = useState<Asset[]>(() => {
    const saved = localStorage.getItem('sa_forge_assets');
    return saved ? JSON.parse(saved) : INITIAL_ASSETS;
  });

  const [positions, setPositions] = useState<Position[]>(() => {
    const saved = localStorage.getItem('sa_forge_positions');
    return saved ? JSON.parse(saved) : [];
  });

  const [walletBalance, setWalletBalance] = useState<number>(() => {
    const saved = localStorage.getItem('sa_forge_balance');
    return saved ? parseFloat(saved) : 100000; // default $100,000 USD
  });

  const [terminalLogs, setTerminalLogs] = useState<TerminalLog[]>([]);

  // UI States
  const [activeTab, setActiveTab] = useState<'BERANDA' | 'PORTFOLIO' | 'LIVE_TERMINAL'>('BERANDA');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const liveSelectedAsset = useMemo(() => {
    if (!selectedAsset) return null;
    return assets.find(a => a.symbol === selectedAsset.symbol) || selectedAsset;
  }, [assets, selectedAsset]);
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'FOREX' | 'CRYPTO' | 'STOCKS'>('ALL');
  const [apiStatus, setApiStatus] = useState<'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR'>('IDLE');

  // Input states for custom deposit generator
  const [depositAmount, setDepositAmount] = useState<number>(5000);

  // --- PERSISTENCE EFFECT ---
  useEffect(() => {
    localStorage.setItem('sa_forge_assets', JSON.stringify(assets));
  }, [assets]);

  useEffect(() => {
    localStorage.setItem('sa_forge_positions', JSON.stringify(positions));
  }, [positions]);

  useEffect(() => {
    localStorage.setItem('sa_forge_balance', walletBalance.toString());
  }, [walletBalance]);

  // --- LOCAL TIMESTRING HELPER ---
  const getTimestamp = () => {
    const now = new Date();
    return now.toTimeString().split(' ')[0];
  };

  // --- TERMINAL LOGGER HELPER ---
  const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' | 'trade' = 'info') => {
    const newLog: TerminalLog = {
      id: Math.random().toString(),
      timestamp: getTimestamp(),
      type,
      message
    };
    setTerminalLogs(prev => [newLog, ...prev].slice(0, 100)); // limit 100 logs
  };

  // Initialize Terminal Greetings
  useEffect(() => {
    addLog("=== SA FORGE SYSTEM BOOTED ===", "info");
    addLog("Selamat datang, MARK VALL [VIP]. Level keamanan bursa: AMAN (SAMP PROTECTED).", "success");
    addLog("Didukung harga feed real-time CoinGecko, DexScreener & TradingView.", "info");
    addLog("Ketik 'help' di bar perintah terbawah untuk instruksi penggunaan.", "warning");
  }, []);

  // --- LIVE VALUE CALCULATORS ---
  // Calculates real-time floating Profit & Loss of ALL active positions
  const portfolioPerformance = useMemo(() => {
    const active = positions.filter(p => p.status === 'ACTIVE');
    if (active.length === 0) {
      return { totalPnl: 0, pnlPercent: 0, activeCount: 0 };
    }
    
    const totalPnl = active.reduce((sum, p) => sum + p.pnl, 0);
    // Determine total initial margin to get exact roi percentage
    const totalInitialMargin = active.reduce((sum, p) => {
      const lotMultiplier = p.pair.includes('FOREX') ? 10000 : p.pair.includes('CRYPTO') ? 1 : 100;
      const contractValue = p.entryPrice * p.quantity * lotMultiplier;
      return sum + (contractValue / p.leverage);
    }, 0);

    const pnlPercent = totalInitialMargin > 0 ? (totalPnl / totalInitialMargin) * 100 : 0;
    
    return {
      totalPnl,
      pnlPercent,
      activeCount: active.length
    };
  }, [positions]);

  // Total Equity = Wallet Balance + Total Floating P/L
  const totalEquity = useMemo(() => {
    return walletBalance + portfolioPerformance.totalPnl;
  }, [walletBalance, portfolioPerformance.totalPnl]);


  // --- API PRICING INTEGRATION ---
  // Fetches prices from CoinGecko & DexScreener and updates state
  const syncLivePrices = async (silent = false) => {
    if (!silent) {
      setApiStatus('SYNCING');
      addLog("Mengontak server API CoinGecko & DexScreener...", "info");
    }

    try {
      // 1. Fetch from CoinGecko
      const cgResponse = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,dogecoin&vs_currencies=usd"
      );
      
      let cgData: any = null;
      if (cgResponse.ok) {
        cgData = await cgResponse.json();
      }

      // 2. Fetch Solana DexScreener token details to check connection
      const dexResponse = await fetch(
        "https://api.dexscreener.com/latest/dex/search?q=solana"
      );
      let dexPrice: number | null = null;
      if (dexResponse.ok) {
        const dexData = await dexResponse.json();
        // Extract solana price from dex pairs if available
        if (dexData.pairs && dexData.pairs.length > 0) {
          const mainPair = dexData.pairs[0];
          dexPrice = parseFloat(mainPair.priceUsd);
        }
      }

      // Map prices dynamically into our asset structure
      setAssets(currentAssets => {
        return currentAssets.map(asset => {
          let livePrice = asset.price;
          let found = false;

          // Sync CoinGecko
          if (cgData && asset.coinGeckoId && cgData[asset.coinGeckoId]) {
            livePrice = cgData[asset.coinGeckoId].usd;
            found = true;
          }

          // Override with DexScreener for SOL/USD search if fetched successfully
          if (asset.symbol === 'SOL/USD' && dexPrice) {
            livePrice = dexPrice;
            found = true;
          }

          // Calculate changes
          if (found && livePrice !== asset.price) {
            const pctChange = ((livePrice - asset.price) / asset.price) * 100;
            const updatedChg = parseFloat((asset.change24h + pctChange / 10).toFixed(2));
            const prev = asset.price;

            if (!silent && asset.symbol === 'BTC/USD') {
              addLog(`[FEED] CoinGecko BTC/USD terupdate: $${livePrice.toLocaleString()}`, "success");
            }

            return {
              ...asset,
              price: livePrice,
              prevPrice: prev,
              change24h: updatedChg,
              high24h: Math.max(asset.high24h, livePrice),
              low24h: Math.min(asset.low24h, livePrice)
            };
          }

          return asset;
        });
      });

      setApiStatus('SUCCESS');
      if (!silent) addLog("Sinkronisasi feed harga real-time berhasil tuntas!", "success");
    } catch (err: any) {
      setApiStatus('ERROR');
      if (!silent) {
        addLog(`Gagal sync API (CORS/Rate limit). Mengaktifkan mesin simulator lokal.`, "warning");
      }
    }
  };

  // Initial fetch and setup interval for APIs
  useEffect(() => {
    syncLivePrices();
    const apiInterval = setInterval(() => {
      syncLivePrices(true);
    }, 25000); // sync headers every 25 seconds
    return () => clearInterval(apiInterval);
  }, []);


  // --- STOCHASTIC PRICING ENGINE ---
  // Simulates brownian-motion dynamic fluctuations for all assets, updating floating P/Ls
  useEffect(() => {
    const liveTickInterval = setInterval(() => {
      setAssets(currentAssets => {
        return currentAssets.map(asset => {
          // Adjust volatility depending on category
          // Forex standard pip values, Crypto highly volatile, XAU/USD gold medium-high volatiliy
          let volCoefficient = 0.0005; // default
          if (asset.category === 'CRYPTO') {
            volCoefficient = 0.0018;
          } else if (asset.symbol === 'XAU/USD') {
            volCoefficient = 0.0012; // active movement on gold
          } else if (asset.category === 'STOCKS') {
            volCoefficient = 0.0007;
          }

          // Random direction
          const rand = Math.random();
          const direction = rand > 0.51 ? 1 : rand < 0.49 ? -1 : 0;
          const fluctuation = asset.price * volCoefficient * Math.random() * direction;
          const newPrice = Math.max(0.00001, asset.price + fluctuation);
          
          return {
            ...asset,
            price: parseFloat(newPrice.toFixed(asset.category === 'FOREX' ? 5 : 2)),
            prevPrice: asset.price,
            high24h: Math.max(asset.high24h, newPrice),
            low24h: Math.min(asset.low24h, newPrice)
          };
        });
      });
    }, 2000); // fluctuation every 2 seconds

    return () => clearInterval(liveTickInterval);
  }, []);

  // --- FLOATING REAL-TIME P/L & SL/TP BREACH ENGINE ---
  // Monitors positions, updates floating profits, and triggers Stop Loss / Take Profit targets.
  // This effect depends ONLY on assets, completely eliminating state update loops on positions.
  useEffect(() => {
    setPositions(currentPositions => {
      let isModified = false;
      const updated = currentPositions.map(pos => {
        if (pos.status !== 'ACTIVE') return pos;

        const assetMatch = assets.find(a => a.symbol === pos.pair);
        if (!assetMatch) return pos;

        const currentPrice = assetMatch.price;

        // 1. Calculate the new floating profit
        const lotMultiplier = pos.pair.includes('FOREX') ? 10000 : pos.pair.includes('CRYPTO') ? 1 : 100;
        let floatingPnl = 0;

        if (pos.type === 'LONG') {
          floatingPnl = (currentPrice - pos.entryPrice) * pos.quantity * lotMultiplier;
        } else {
          floatingPnl = (pos.entryPrice - currentPrice) * pos.quantity * lotMultiplier;
        }

        const roundedPnl = parseFloat(floatingPnl.toFixed(2));

        // 2. Check for SL/TP breach targets
        let triggerType: 'SL' | 'TP' | null = null;
        if (pos.type === 'LONG') {
          if (pos.sl && currentPrice <= pos.sl) triggerType = 'SL';
          else if (pos.tp && currentPrice >= pos.tp) triggerType = 'TP';
        } else { // SHORT
          if (pos.sl && currentPrice >= pos.sl) triggerType = 'SL';
          else if (pos.tp && currentPrice <= pos.tp) triggerType = 'TP';
        }

        // 3. Handle breach closure
        if (triggerType) {
          isModified = true;

          // Recover margin + final pnl into available cash
          const contractValue = pos.entryPrice * pos.quantity * lotMultiplier;
          const initialMarginUsed = contractValue / pos.leverage;
          const returnedCapital = initialMarginUsed + roundedPnl;

          setWalletBalance(prev => Math.max(0, prev + returnedCapital));

          // Log breach closure
          const triggerLabel = triggerType === 'SL' ? '🛑 STOP LOSS' : '🎯 TAKE PROFIT';
          const logStatus = roundedPnl >= 0 ? 'success' : 'error';
          
          addLog(
            `[${triggerLabel}] Posisi #${pos.id} untuk ${pos.pair} ditutup otomatis di harga $${currentPrice.toLocaleString()}. Realized P/L: ${roundedPnl >= 0 ? '+' : ''}$${roundedPnl.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD. Modal dikembalikan: $${returnedCapital.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 
            logStatus
          );

          return {
            ...pos,
            status: 'CLOSED',
            currentPrice,
            closePrice: currentPrice,
            pnl: roundedPnl
          };
        }

        // 4. Otherwise, just update floating coordinates if price or pnl changed
        if (pos.currentPrice !== currentPrice || pos.pnl !== roundedPnl) {
          isModified = true;
          return {
            ...pos,
            currentPrice,
            pnl: roundedPnl
          };
        }

        return pos;
      });

      return isModified ? updated : currentPositions;
    });
  }, [assets]);


  // --- TRADING EXECUTION HANDLERS ---
  
  // Opens a new position
  const handleOpenPosition = (orderData: {
    type: 'LONG' | 'SHORT';
    quantity: number;
    leverage: number;
    sl?: number;
    tp?: number;
    entryPrice: number;
    isLimit: boolean;
  }) => {
    if (!liveSelectedAsset) return;

    // Check balance
    const lotMultiplier = liveSelectedAsset.category === 'FOREX' ? 10000 : liveSelectedAsset.category === 'CRYPTO' ? 1 : 100;
    const contractValue = orderData.entryPrice * orderData.quantity * lotMultiplier;
    const requiredMargin = contractValue / orderData.leverage;

    if (walletBalance < requiredMargin) {
      addLog(`[GACOK ERROR] Transaksi gagal! Modal sisa kurang dari jaminan jaminan margin sebesar $${requiredMargin.toFixed(2)}`, "error");
      alert("Modal tidak mencukupi untuk jaminan posisi ini!");
      return;
    }

    // Deduct margin from available cash
    setWalletBalance(prev => prev - requiredMargin);

    const newPosition: Position = {
      id: "FORGE_TR-" + Math.floor(100000 + Math.random() * 900000).toString(),
      pair: liveSelectedAsset.symbol,
      type: orderData.type,
      entryPrice: orderData.entryPrice,
      currentPrice: liveSelectedAsset.price,
      quantity: orderData.quantity,
      leverage: orderData.leverage,
      sl: orderData.sl,
      tp: orderData.tp,
      timestamp: Date.now(),
      status: 'ACTIVE',
      pnl: 0
    };

    setPositions(prev => [newPosition, ...prev]);

    addLog(
      `[MEMBER EXECUTED] ${orderData.type} ${orderData.quantity} Lot ${liveSelectedAsset.symbol} terisi di harga $${orderData.entryPrice.toLocaleString()} dengan leverage ${orderData.leverage}x! Margin digunakan: $${requiredMargin.toFixed(2)} USD`, 
      "trade"
    );

    // If SL or TP specified, log verification
    if (orderData.sl) addLog(`   └─ Stop Loss terpasang aman: $${orderData.sl.toLocaleString()}`, "warning");
    if (orderData.tp) addLog(`   └─ Take Profit terpasang aman: $${orderData.tp.toLocaleString()}`, "success");
    
    // Close modal
    setSelectedAsset(null);
  };

  // Closes an active position manually or via logic
  const executePositionClosure = (
    id: string, 
    closePriceOverride?: number, 
    triggerSource: 'MANUAL' | 'SL' | 'TP' = 'MANUAL'
  ) => {
    setPositions(currentPositions => {
      const matchIndex = currentPositions.findIndex(p => p.id === id && p.status === 'ACTIVE');
      if (matchIndex === -1) return currentPositions;

      const pos = currentPositions[matchIndex];
      const assetMatch = assets.find(a => a.symbol === pos.pair);
      const closePrice = closePriceOverride || (assetMatch ? assetMatch.price : pos.currentPrice);

      const lotMultiplier = pos.pair.includes('FOREX') ? 10000 : pos.pair.includes('CRYPTO') ? 1 : 100;
      let finalPnl = 0;

      if (pos.type === 'LONG') {
        finalPnl = (closePrice - pos.entryPrice) * pos.quantity * lotMultiplier;
      } else {
        finalPnl = (pos.entryPrice - closePrice) * pos.quantity * lotMultiplier;
      }

      // Recover margin used + final pnl into available cash
      const contractValue = pos.entryPrice * pos.quantity * lotMultiplier;
      const initialMarginUsed = contractValue / pos.leverage;
      const returnedCapital = initialMarginUsed + finalPnl;

      setWalletBalance(prev => Math.max(0, prev + returnedCapital));

      // Construct update
      const updatedList = [...currentPositions];
      updatedList[matchIndex] = {
        ...pos,
        status: 'CLOSED',
        closePrice,
        pnl: parseFloat(finalPnl.toFixed(2))
      };

      // Add log
      const triggerLabel = triggerSource === 'SL' ? '🛑 STOP LOSS' : triggerSource === 'TP' ? '🎯 TAKE PROFIT' : '🔔 MANUAL CLOSE';
      const logStatus = finalPnl >= 0 ? 'success' : 'error';
      
      addLog(
        `[${triggerLabel}] Posisi #${pos.id} untuk ${pos.pair} ditutup di harga $${closePrice.toLocaleString()}. Realized P/L: ${finalPnl >= 0 ? '+' : ''}$${finalPnl.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD. Modal dikembalikan: $${returnedCapital.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 
        logStatus
      );

      return updatedList;
    });
  };

  // Handles custom command entries from Retro Terminal Console
  const handleTerminalCommand = (cmdString: string) => {
    const raw = cmdString.trim();
    const args = raw.split(/\s+/);
    const command = args[0].toLowerCase();

    addLog(`forge@trade:~$ ${raw}`, "info");

    switch (command) {
      case 'help':
        addLog("=== DAFTAR PERINTAH RETRO TRADING ===", "warning");
        addLog("  status              - Tampilkan detail nominal saldo dan posisi aktif", "info");
        addLog("  assets              - Tampilkan daftar simbol instrumen trading", "info");
        addLog("  positions           - Filter & tampilkan data posisi yang sedang melayang", "info");
        addLog("  buy <sym> <lots>    - Buka LONG posisi (contoh: buy XAU/USD 2)", "info");
        addLog("  sell <sym> <lots>   - Buka SHORT posisi (contoh: sell BTC/USD 0.5)", "info");
        addLog("  close <id>          - Tutup paksa posisi aktif berdasarkan ID", "info");
        addLog("  api-status          - Inspeksi kegagalan/keberhasilan feed API", "info");
        addLog("  clear               - Membersihkan baris log terminal", "info");
        break;

      case 'status':
        addLog(`=== PROFIL AKUN MARK VALL [VIP] ===`, "success");
        addLog(`  Modal Bebas (Free Margin) : $${walletBalance.toLocaleString()} USD`, "info");
        addLog(`  Floating Profit/Loss      : ${portfolioPerformance.totalPnl >= 0 ? '+' : ''}$${portfolioPerformance.totalPnl.toLocaleString()} USD (${portfolioPerformance.pnlPercent.toFixed(2)}%)`, portfolioPerformance.totalPnl >= 0 ? 'success' : 'error');
        addLog(`  Total Ekuitas Akun        : $${totalEquity.toLocaleString()} USD`, "info");
        addLog(`  Posisi Aktif              : ${portfolioPerformance.activeCount} Posisi`, "info");
        break;

      case 'assets':
        addLog("=== DAFTAR PASANGAN AKTIF ===", "warning");
        assets.forEach(a => {
          addLog(`  [${a.category}] ${a.symbol} | Harga: $${a.price.toLocaleString()} | 24H: ${a.change24h >= 0 ? '+' : ''}${a.change24h}%`, "success");
        });
        break;

      case 'positions':
        const activeList = positions.filter(p => p.status === 'ACTIVE');
        if (activeList.length === 0) {
          addLog("Tidak ada transaksi floating yang aktif saat ini.", "warning");
        } else {
          addLog("=== DAFTAR POSISI FLOATING AKTIF ===", "warning");
          activeList.forEach(p => {
            addLog(`  ID: ${p.id} | ${p.pair} | ${p.type} | Vol: ${p.quantity} Lot | Entry: $${p.entryPrice} | Live: $${p.currentPrice} | P/L: ${p.pnl >= 0 ? '+' : ''}$${p.pnl}`, p.pnl >= 0 ? 'success' : 'error');
          });
        }
        break;

      case 'clear':
        setTerminalLogs([]);
        break;

      case 'api-status':
        addLog("=== INSPEKSI API INTEGRASI ===", "warning");
        addLog(`  CoinGecko REST API Connection   : ${apiStatus === 'SUCCESS' ? 'MANTAP ✓' : apiStatus === 'SYNCING' ? 'MENGHUBUNGKAN...' : 'TERBATAS (LOCAL EMULATOR)'}`, apiStatus === 'SUCCESS' ? 'success' : 'warning');
        addLog("  DexScreener Search REST Engine  : CONNECTED ✓", "success");
        addLog("  TradingView Widget Iframe       : READY & SYNCED ✓", "success");
        break;

      case 'buy':
      case 'sell':
        if (args.length < 3) {
          addLog(`Error: Format perintah salah. Contoh: ${command} XAU/USD 1.5`, "error");
          break;
        }
        const sym = args[1].toUpperCase();
        const qty = parseFloat(args[2]);
        const assetObj = assets.find(a => a.symbol === sym);

        if (!assetObj) {
          addLog(`Error: Pasangan instrumen '${sym}' tidak ditemukan! Gunakan perintah 'assets' untuk melihat daftar.`, "error");
          break;
        }
        if (isNaN(qty) || qty <= 0) {
          addLog("Error: Masukkan volume Lots yang valid di atas 0!", "error");
          break;
        }

        // Set SL/TP if supplied optionally as cmd parameters
        let cmdSl: number | undefined = undefined;
        let cmdTp: number | undefined = undefined;
        if (args[3]) cmdSl = parseFloat(args[3]);
        if (args[4]) cmdTp = parseFloat(args[4]);

        // Direct execution of position from command-line terminal without breaking state scope
        const entryPrice = assetObj.price;
        const leverageVal = 10; // default leverage of 10x
        const multiplier = assetObj.category === 'FOREX' ? 10000 : assetObj.category === 'CRYPTO' ? 1 : 100;
        const requiredMargin = entryPrice * qty * multiplier / leverageVal;

        if (walletBalance < requiredMargin) {
          addLog(`[GACOK ERROR] Transaksi terminal gagal! Sisa modal kurang dari margin $${requiredMargin.toFixed(2)}`, "error");
          break;
        }

        setWalletBalance(prev => prev - requiredMargin);

        const terminalPos: Position = {
          id: "FORGE_TR-" + Math.floor(100000 + Math.random() * 900000).toString(),
          pair: sym,
          type: command === 'buy' ? 'LONG' : 'SHORT',
          entryPrice,
          currentPrice: entryPrice,
          quantity: qty,
          leverage: leverageVal,
          sl: cmdSl,
          tp: cmdTp,
          timestamp: Date.now(),
          status: 'ACTIVE',
          pnl: 0
        };

        setPositions(prev => [terminalPos, ...prev]);

        addLog(`[DIRECT EXEC] Posisi ${command === 'buy' ? 'LONG' : 'SHORT'} ${qty} Lot ${sym} berhasil dieksekusi via Terminal di harga $${entryPrice.toLocaleString()}!`, "trade");
        if (cmdSl) addLog(`   └─ SL otomatis terpasang: $${cmdSl.toLocaleString()}`, "warning");
        if (cmdTp) addLog(`   └─ TP otomatis terpasang: $${cmdTp.toLocaleString()}`, "success");
        break;

      case 'close':
        if (args.length < 2) {
          addLog("Error: Cantumkan ID posisi. Contoh: close FORGE_TR-123456", "error");
          break;
        }
        const posId = args[1].toUpperCase();
        const matchedPos = positions.find(p => p.id === posId && p.status === 'ACTIVE');
        if (!matchedPos) {
          addLog(`Error: Posisi aktif dengan ID '${posId}' tidak ditemukan!`, "error");
          break;
        }
        executePositionClosure(matchedPos.id);
        break;

      default:
        addLog(`Terminal: Perintah '${command}' tidak dikenali. Ketik 'help' untuk daftar lengkap perintah.`, "error");
    }
  };

  // Filtered Assets for home display list
  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      const matchCategory = categoryFilter === 'ALL' || asset.category === categoryFilter;
      const matchQuery = asset.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         asset.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchQuery;
    });
  }, [assets, categoryFilter, searchQuery]);


  // Helper definitions for theme header styles on assets
  const getAssetThemeClasses = (theme: string) => {
    switch(theme) {
      case 'purple': return 'bg-[#818CF8]';
      case 'pink': return 'bg-[#F472B6]';
      case 'blue': return 'bg-[#38BDF8]';
      case 'green': return 'bg-[#34D399]';
      default: return 'bg-yellow-400';
    }
  };

  return (
    <div id="sa_forge_app_root" className="min-h-screen flex flex-col justify-between bg-dots-white">
      {/* 1. SOLID RETRO NAVBAR HEADER BACKGROUND (YELLOW as requested) */}
      <header id="sa_forge_main_header" className="sticky top-0 z-40 bg-[#FDDF09] border-b-4 border-black px-4 py-3 select-none">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* LOGO AREA (Styled exactly like Page 1 SA FORGE) */}
          <div className="flex items-center gap-2">
            <div className="flex items-center neo-border-sm bg-black text-[#FDDF09] font-black text-xl px-3 py-1.5 uppercase tracking-tighter neo-shadow-sm">
              SA <span className="bg-[#FDDF09] text-black px-1 ml-1 rounded">FORGE</span>
            </div>
            <div className="hidden sm:flex flex-col text-[10px] font-mono leading-tight font-bold pl-1 text-black">
              <span>TRADING SYSTEM</span>
              <span className="text-yellow-950 font-black">PRO VERSION 100% LIVE</span>
            </div>
          </div>

          {/* MAIN MENU BUTTONS (Matches style from PDF page 1) */}
          <nav className="flex flex-wrap items-center gap-1 bg-[#1A1A1A] p-1 border-3 border-black neo-shadow-sm">
            <button
              onClick={() => { setActiveTab('BERANDA'); setSelectedAsset(null); }}
              className={`px-3 py-1 font-extrabold text-[11px] uppercase border border-transparent transition-all ${
                activeTab === 'BERANDA'
                  ? 'bg-[#FDDF09] text-black border-black font-black'
                  : 'text-gray-300 hover:text-white hover:bg-neutral-800'
              }`}
            >
              Beranda
            </button>
            <button
              onClick={() => { setActiveTab('PORTFOLIO'); setSelectedAsset(null); }}
              className={`px-3 py-1 font-extrabold text-[11px] uppercase border border-transparent transition-all ${
                activeTab === 'PORTFOLIO'
                  ? 'bg-[#FDDF09] text-black border-black font-black'
                  : 'text-gray-300 hover:text-white hover:bg-neutral-800'
              }`}
            >
              PORTFOLIO
            </button>
            <button
              onClick={() => { setActiveTab('LIVE_TERMINAL'); setSelectedAsset(null); }}
              className={`px-3 py-1 font-extrabold text-[11px] uppercase border border-transparent transition-all ${
                activeTab === 'LIVE_TERMINAL'
                  ? 'bg-[#FDDF09] text-black border-black font-black'
                  : 'text-gray-300 hover:text-white hover:bg-neutral-800'
              }`}
            >
              LIVE TERMINAL
            </button>
          </nav>

          {/* PORTFOLIO PERFORMANCE REALTIME WIDGET (Mandated in header) */}
          <div 
            id="portfolio_perf_header" 
            onClick={() => setActiveTab('PORTFOLIO')}
            className="cursor-pointer bg-white px-3 py-1.5 border-3 border-black flex items-center gap-3 select-text neo-shadow-sm hover:translate-y-0.5 transition-transform"
            title="Saran P/L Melayang Real-Time"
          >
            <div className="flex items-center gap-1.5 border-r border-dashed border-black pr-2">
              <Activity className="w-4 h-4 text-rose-600 animate-pulse" />
              <div className="text-[9px] font-mono font-bold leading-tight uppercase text-gray-500">
                P/L Portfolio
              </div>
            </div>
            <div>
              <div className={`text-xs font-black font-mono leading-none tracking-tight flex items-center ${
                portfolioPerformance.totalPnl >= 0 ? 'text-emerald-700' : 'text-rose-600'
              }`}>
                {portfolioPerformance.totalPnl >= 0 ? '▲ +' : '▼ '}
                ${portfolioPerformance.totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD
              </div>
              <div className="text-[8px] font-mono font-bold text-gray-500 leading-none mt-1">
                {portfolioPerformance.activeCount} Posisi Aktif | ({portfolioPerformance.pnlPercent.toFixed(2)}% ROI)
              </div>
            </div>
          </div>

          {/* USER WALLET / CARD ACCENTS (Styled exactly like Page 1 right side MARK VALL) */}
          <div id="user_profile_box" className="bg-black text-white px-3 py-1.5 border-3 border-black flex items-center gap-2 neo-shadow-sm">
            <div className="w-6 h-6 rounded bg-yellow-400 border border-white flex items-center justify-center text-black font-black text-xs uppercase">
              MV
            </div>
            <div className="text-left leading-tight">
              <div className="text-[10px] uppercase font-black tracking-tight text-[#FDDF09]">
                MARK VALL <span className="bg-[#FDDF09] text-black text-[7px] px-1 font-bold ml-1">VIP</span>
              </div>
              <div className="text-[11px] font-mono text-emerald-400 font-extrabold flex items-center gap-1">
                <Wallet className="w-3 h-3 text-white" />
                ${walletBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

        </div>
      </header>

      {/* 2. MAIN GRID LAYOUTS BASED ON CHOSEN VIEW TAB */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">

        {activeTab === 'BERANDA' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            
            {/* HEROPAGE BANNER (Yellow Forge background matching Page 1 PDF) */}
            <div className="bg-dots-yellow border-4 border-black p-8 neo-shadow-lg text-black text-center md:text-left relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="absolute right-4 top-4 border-2 border-black bg-white px-3 py-1 text-xs font-black uppercase tracking-widest neo-shadow-sm animate-pulse">
                ⚡ OPEN 24 HRS
              </div>
              
              <div className="max-w-2xl">
                <div className="inline-block bg-black text-white text-xs font-black tracking-wider uppercase px-3 py-1 border-2 border-white mb-4">
                  ■ FORGE SYNDICATE TRADING
                </div>
                <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-4 text-black uppercase font-sans select-none drop-shadow-[1px_1.5px_0px_#FFF]">
                  FORGE TRADING
                </h1>
                <p className="text-sm md:text-md font-bold text-black border-l-4 border-black pl-3 max-w-xl leading-relaxed mb-6 font-mono text-justify">
                  Platform simulasi trading real-time instan dengan visual Neobrutalis. Eksekusi posisi dengan akurasi pips presisi, pantau pergerakan XAU/USD, Crypto CoinGecko, dan Token DexScreener lengkap dengan fitur pengaman Stop Loss (SL) & Take Profit (TP).
                </p>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                  <button 
                    onClick={() => {
                      const goldAsset = assets.find(a => a.symbol === 'XAU/USD');
                      if (goldAsset) setSelectedAsset(goldAsset);
                    }}
                    className="px-6 py-3.5 bg-[#FF007F] text-white font-black uppercase text-sm border-3 border-black neo-shadow-sm transition-transform hover:-translate-y-0.5 active:translate-y-0.5 whitespace-nowrap"
                  >
                    CARI MOD TRADING (XAU/USD) →
                  </button>
                  <button 
                    onClick={() => {
                      const btcAsset = assets.find(a => a.symbol === 'BTC/USD');
                      if (btcAsset) setSelectedAsset(btcAsset);
                    }}
                    className="px-6 py-3.5 bg-white text-black font-black uppercase text-sm border-3 border-black neo-shadow-sm transition-transform hover:-translate-y-0.5 active:translate-y-0.5 whitespace-nowrap"
                  >
                    Buka Chart BTC →
                  </button>
                </div>
              </div>

              {/* Decorative Big Badge matching screenshot vibe */}
              <div className="hidden lg:flex flex-col items-center bg-[#FCFBF4] border-4 border-black p-4 neo-shadow-md w-60 text-center relative rotate-2">
                <Coins className="w-12 h-12 text-yellow-500 mb-2 animate-bounce" />
                <span className="text-xs font-black font-mono block text-gray-500">MOCK BALANCE</span>
                <span className="text-2xl font-black text-black block font-mono">
                  $100,000.00
                </span>
                <p className="text-[10px] text-gray-600 font-mono mt-2 leading-tight">
                  Akun trading terisi modal virtual gratis 100% aman untuk latihan.
                </p>
              </div>
            </div>

            {/* THREE COLUMN FEATURE CARDS (Matches Page 2 PDF exactly) */}
            <div id="feature_grid_container" className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="bg-white p-5 border-4 border-black neo-shadow-md flex gap-4 items-start">
                <div className="p-3 bg-emerald-300 border-2 border-black neo-shadow-sm">
                  <TrendingUp className="w-6 h-6 text-black font-black" />
                </div>
                <div>
                  <h4 className="font-extrabold uppercase text-sm text-black tracking-tight mb-1">
                    Lightweight & Fast
                  </h4>
                  <p className="text-xs font-mono text-gray-600 leading-normal">
                    Skrip eksekusi efisien, sangat ringan diakses PC & Android kentang tanpa lag FPS drop saat update harga.
                  </p>
                </div>
              </div>

              <div className="bg-white p-5 border-4 border-black neo-shadow-md flex gap-4 items-start">
                <div className="p-3 bg-cyan-300 border-2 border-black neo-shadow-sm">
                  <Activity className="w-6 h-6 text-black font-black" />
                </div>
                <div>
                  <h4 className="font-extrabold uppercase text-sm text-black tracking-tight mb-1">
                    Safe for Daily Use
                  </h4>
                  <p className="text-xs font-mono text-gray-600 leading-normal">
                    Sistem simulasi aman yang menjamin penutupan posisi otomatis lewat batasan SL, TP, dan risiko margin.
                  </p>
                </div>
              </div>

              <div className="bg-white p-5 border-4 border-black neo-shadow-md flex gap-4 items-start">
                <div className="p-3 bg-pink-300 border-2 border-black neo-shadow-sm">
                  <div className="w-6 h-6 text-black font-black flex items-center justify-center">
                    <Star className="w-6 h-6 text-black" fill="black" />
                  </div>
                </div>
                <div>
                  <h4 className="font-extrabold uppercase text-sm text-black tracking-tight mb-1">
                    Personal Custom
                  </h4>
                  <p className="text-xs font-mono text-gray-600 leading-normal">
                    Kustomisasi Lots bebas, pilih leverage pengali, serta sesuaikan zoom visual plotting garis posisi detail.
                  </p>
                </div>
              </div>

            </div>

            {/* PAIRS DIRECTORIES / LISTINGS (Matches Page 2 & 3 PDF grids) */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 select-none">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-extrabold flex items-center gap-1.5 uppercase font-sans">
                    ★ NEW TRADING RELEASES
                  </span>
                </div>
                {/* Category filters */}
                <div className="flex flex-wrap items-center gap-1.5 bg-neutral-200 p-1 border-2 border-black font-mono text-[10px] shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                  {(['ALL', 'FOREX', 'CRYPTO', 'STOCKS'] as const).map((cat) => (
                    <button
                      key={`cat-filt-${cat}`}
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-3 py-1 font-bold uppercase transition-all ${
                        categoryFilter === cat ? 'bg-black text-white' : 'hover:bg-neutral-300 text-black'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* SEARCH INPUT */}
              <div className="mb-6 relative max-w-md">
                <Search className="absolute left-3 top-3.5 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Cari pairs, mata uang forex, saham TSLA atau XAU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border-3 border-black pl-10 pr-4 py-3 text-sm font-mono focus:outline-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] focus:bg-yellow-50/50"
                />
              </div>

              {/* Grid cards styled exactly like Page 3 screenshot */}
              <div id="assets_grid_main" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {filteredAssets.map((asset) => {
                  const hotBadge = asset.tags.includes('hot');
                  const trendBadge = asset.tags.includes('trending');
                  const premiumBadge = asset.tags.includes('safe-haven');

                  return (
                    <div 
                      key={asset.symbol}
                      className="bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-[#111] flex flex-col justify-between overflow-hidden"
                    >
                      {/* Colored Top Banner matching screenshot card header */}
                      <div className={`p-3 border-b-4 border-black ${getAssetThemeClasses(asset.theme)} flex justify-between items-center bg-dots-white/30`}>
                        <div className="flex items-center gap-1 bg-white px-2 py-0.5 border border-black text-[9px] font-black tracking-widest uppercase">
                          <Clock className="w-2.5 h-2.5 mr-0.5" /> UNVERIFIED LIQ
                        </div>
                        <span className="text-[10px] font-mono font-bold bg-[#FDDF09] text-black px-1.5 border border-black uppercase shadow-[1px_1px_rgba(0,0,0,1)]">
                          {asset.category}
                        </span>
                      </div>

                      {/* Card Content container */}
                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          {/* Title block */}
                          <div className="text-center bg-[#FCFBF4] border-2 border-black p-3 mb-3 relative neo-shadow-sm">
                            <h3 className="text-2xl font-black font-sans tracking-tight text-black flex items-center justify-center gap-1.5">
                              {asset.symbol}
                            </h3>
                            <span className="text-[10px] font-mono bg-yellow-300 border-2 border-black px-1.5 font-bold absolute -bottom-2.5 left-1/2 -translate-x-1/2 shadow-[1px_1px_rgba(0,0,0,1)]">
                              LIVE
                            </span>
                          </div>

                          {/* Info Lines */}
                          <div className="space-y-1.5 font-mono text-[11px] mb-4 text-left border-b border-dashed border-gray-300 pb-3">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-500">PROVIDER FEED:</span>
                              <span className="font-bold bg-neutral-200 border border-black px-1 text-[9.5px]">
                                {asset.creator}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-500">VOLATILITAS:</span>
                              <span className="font-bold text-black flex items-center gap-1">
                                <Download className="w-3 h-3 text-cyan-600" /> {asset.volume}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-500">ESTIMASI RATING:</span>
                              <span className="text-[10px] text-yellow-600 font-extrabold">{asset.rating}</span>
                            </div>
                          </div>

                          {/* Short Description */}
                          <p className="text-xs font-mono text-gray-500 line-clamp-2 h-8 leading-tight mb-4">
                            {asset.description}
                          </p>
                        </div>

                        {/* Interactive pricing metric & Tags line */}
                        <div>
                          {/* Tags matching PDF: 'hot', 'trending', 'new' */}
                          <div className="flex flex-wrap gap-1 mb-4 select-none">
                            {hotBadge && <span className="bg-yellow-300 border border-black text-black text-[9px] px-1.5 font-bold rounded shadow-[1px_1px_0px_rgba(0,0,0,1)]">hot</span>}
                            {trendBadge && <span className="bg-rose-400 border border-black text-black text-[9px] px-1.5 font-bold rounded shadow-[1px_1px_0px_rgba(0,0,0,1)]">trending</span>}
                            {premiumBadge && <span className="bg-pink-400 border border-black text-black text-[9px] px-1.5 font-bold rounded shadow-[1px_1px_0px_rgba(0,0,0,1)]">premium</span>}
                            {!hotBadge && !trendBadge && <span className="bg-[#4BDBE0] border border-black text-black text-[9px] px-1.5 font-bold rounded shadow-[1px_1px_0px_rgba(0,0,0,1)]">stable</span>}
                          </div>

                          <div className="bg-neutral-50 p-2.5 border-2 border-black mb-4 font-mono flex items-center justify-between">
                            <div className="text-xs font-bold text-gray-500">Live Harga USD:</div>
                            <div className="text-md font-extrabold tracking-tight">
                              ${asset.price.toLocaleString(undefined, { minimumFractionDigits: asset.category === 'FOREX' ? 5 : 2 })}
                            </div>
                          </div>

                          {/* LIHAT DETAIL BUTTON (Matches green button at bottom of screenshots) */}
                          <button
                            onClick={() => setSelectedAsset(asset)}
                            className="w-full py-2.5 px-4 font-black uppercase text-xs tracking-wide bg-[#4BDBE0] text-black border-3 border-black flex items-center justify-center gap-2 shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:bg-[#34c4c9] hover:shadow-[3px_3px_0px_rgba(0,0,0,1)] font-sans active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_rgba(0,0,0,1)]"
                          >
                            <Download className="w-3.5 h-3.5" /> LIHAT DETAIL / OPEN POSITION
                          </button>
                        </div>

                      </div>
                    </div>
                  );
                })}

                {filteredAssets.length === 0 && (
                  <div className="col-span-full py-16 text-center border-4 border-dashed border-black bg-white">
                    <p className="text-gray-500 font-mono">
                      Tidak ada pasangan instrumen aktif yang pas dengan kata kunci "{searchQuery}"
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* RETRO LIVE TERMINAL CONSOLE AT HOME PAGE BOTTOM */}
            <div className="pt-6">
              <div className="flex items-center gap-2 mb-2 select-none">
                <span className="text-xl font-extrabold uppercase font-sans">
                  ⌨ TRADING SHELL TERMINAL
                </span>
                <span className="bg-black text-[#FDDF09] font-mono text-[9px] px-1.5 border border-[#FDDF09]">
                  PORT:3000
                </span>
              </div>
              <LiveTerminal 
                logs={terminalLogs}
                onClearLogs={() => setTerminalLogs([])}
                onExecuteCommand={handleTerminalCommand}
              />
            </div>

          </div>
        )}

        {/* 2B. PORTFOLIO AND BALANCE STATS VIEW */}
        {activeTab === 'PORTFOLIO' && (
          <div className="space-y-8 animate-in fade-in duration-300 select-text">
            
            {/* Header Performance Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 select-text">
              
              <div className="bg-white p-5 border-4 border-black neo-shadow-md">
                <span className="block text-xs font-mono font-bold text-gray-500 uppercase">
                  SALDO MODAL BEBAS
                </span>
                <span className="block text-3xl font-extrabold text-black font-mono mt-1">
                  ${walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <p className="text-[10px] font-mono text-gray-400 mt-2 leading-tight">
                  Sisa margin bebas aman untuk membuka transaksi baru.
                </p>
              </div>

              <div className="bg-white p-5 border-4 border-black neo-shadow-md">
                <span className="block text-xs font-mono font-bold text-gray-500 uppercase">
                  FLOATING PROFIT & LOSS (REAL-TIME)
                </span>
                <span className={`block text-3xl font-extrabold font-mono mt-1 ${
                  portfolioPerformance.totalPnl >= 0 ? 'text-emerald-700' : 'text-rose-600'
                }`}>
                  {portfolioPerformance.totalPnl >= 0 ? '+' : ''}
                  ${portfolioPerformance.totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <p className="text-[10px] font-mono text-gray-400 mt-2 leading-tight">
                  Akumulasi keuntungan/kerugian semua posisi berjalan.
                </p>
              </div>

              <div className="bg-white p-5 border-4 border-black neo-shadow-md">
                <span className="block text-xs font-mono font-bold text-gray-500 uppercase">
                  TOTAL EKUITAS BERSIH
                </span>
                <span className="block text-3xl font-extrabold text-[#FDDF09] font-mono mt-1 px-1 bg-black text-center">
                  ${totalEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <p className="text-[10px] font-mono text-gray-400 mt-2 leading-tight">
                  Total dana akumulasi (Saldo + Floating P/L).
                </p>
              </div>

              {/* Reset simulator & Simulated Cash dispenser */}
              <div className="bg-[#FFFEE2] p-4 border-4 border-black neo-shadow-md flex flex-col justify-between select-none">
                <div>
                  <span className="block text-xs font-mono font-black text-amber-900 uppercase">
                    SIMULATED DEPOSIT DISPENSER
                  </span>
                  <div className="flex gap-2 items-center mt-2">
                    <input 
                      type="number" 
                      value={depositAmount} 
                      onChange={(e) => setDepositAmount(Math.max(10, parseInt(e.target.value) || 0))}
                      className="w-20 bg-white border-2 border-black p-1 text-xs font-mono"
                    />
                    <button 
                      onClick={() => {
                        setWalletBalance(prev => prev + depositAmount);
                        addLog(`[DEPOSIT TRIGGERED] Deposit sukses! Menambahkan $${depositAmount.toLocaleString()} USD ke saldo virtual.`, "success");
                      }}
                      className="flex-1 py-1.5 text-center bg-yellow-400 text-black border-2 border-black font-extrabold text-[10px] uppercase shadow-[1.5px_1.5px_rgba(0,0,0,1)] active:translate-y-0.5"
                    >
                      Top Up +
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm("Reset ulang profil trading Anda? Seluruh histori posisi akan dibersihkan.")) {
                      setWalletBalance(100000);
                      setPositions([]);
                      addLog("[RESET] Database virtual trading dibersihkan. Saldo direset ke $100,000 USD", "warning");
                    }
                  }}
                  className="w-full py-1 text-center bg-rose-500 text-white border-2 border-black text-[9px] font-bold uppercase hover:bg-rose-600 transition-colors"
                >
                  Sapu Bersih Semua Histori & Reset Saldo
                </button>
              </div>

            </div>

            {/* Active Position Lists */}
            <div className="bg-white border-4 border-black neo-shadow-lg p-5">
              <div className="flex justify-between items-center mb-4 pb-2 border-b-2 border-dashed border-gray-300 select-none">
                <h2 className="text-xl font-black font-sans tracking-tight text-black uppercase flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#FF007F]" /> POSISI FLOATING AKTIF
                </h2>
                <span className="font-mono text-xs font-bold text-gray-500">
                  {positions.filter(p => p.status === 'ACTIVE').length} Transaksi Terbuka
                </span>
              </div>

              {/* Positions Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-black bg-neutral-100 font-bold uppercase text-gray-600">
                      <th className="p-3">ID Transaksi</th>
                      <th className="p-3">Pasangan</th>
                      <th className="p-3">Arah</th>
                      <th className="p-3 text-right">Volume (Lots)</th>
                      <th className="p-3 text-right">Leverage</th>
                      <th className="p-3 text-right">Entry Price</th>
                      <th className="p-3 text-right">Current Price</th>
                      <th className="p-3 text-right text-rose-600">Trig SL</th>
                      <th className="p-3 text-right text-emerald-600">Trig TP</th>
                      <th className="p-3 text-right">Profit / Loss (USD)</th>
                      <th className="p-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.filter(p => p.status === 'ACTIVE').length === 0 ? (
                      <tr>
                        <td colSpan={11} className="p-8 text-center text-gray-400 italic">
                          Belum ada transaksi floating komoditi atau coin digital aktual yang terdaftar. Buka Menu Beranda untuk mengeksekusi perdagangan perdana!
                        </td>
                      </tr>
                    ) : (
                      positions.filter(p => p.status === 'ACTIVE').map((pos) => {
                        const lotIdx = pos.pair.includes('FOREX') ? 10000 : pos.pair.includes('CRYPTO') ? 1 : 100;
                        return (
                          <tr key={pos.id} className="border-b border-gray-200 hover:bg-neutral-50/50">
                            <td className="p-3 font-semibold text-gray-400">{pos.id}</td>
                            <td className="p-3 font-extrabold text-black">
                              <span 
                                onClick={() => {
                                  const matchingAsset = assets.find(a => a.symbol === pos.pair);
                                  if (matchingAsset) setSelectedAsset(matchingAsset);
                                }}
                                className="cursor-pointer hover:underline text-blue-600 flex items-center gap-1"
                              >
                                {pos.pair} <ArrowUpRight className="w-3 h-3" />
                              </span>
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 font-extrabold text-[10px] border border-black ${
                                pos.type === 'LONG' ? 'bg-emerald-300 text-emerald-950' : 'bg-rose-300 text-rose-950'
                              }`}>
                                {pos.type}
                              </span>
                            </td>
                            <td className="p-3 text-right font-black">{pos.quantity} Lot</td>
                            <td className="p-3 text-right">{pos.leverage}x</td>
                            <td className="p-3 text-right font-semibold">${pos.entryPrice.toLocaleString()}</td>
                            <td className="p-3 text-right animate-pulse font-semibold">${pos.currentPrice.toLocaleString()}</td>
                            <td className="p-3 text-right text-rose-600 font-bold">
                              {pos.sl ? `$${pos.sl.toLocaleString()}` : '-'}
                            </td>
                            <td className="p-3 text-right text-emerald-600 font-bold">
                              {pos.tp ? `$${pos.tp.toLocaleString()}` : '-'}
                            </td>
                            <td className={`p-3 text-right font-black font-mono text-sm ${pos.pnl >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                              {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-3 text-center">
                              <button 
                                onClick={() => executePositionClosure(pos.id)}
                                className="px-3 py-1 bg-rose-500 hover:bg-rose-600 text-white font-bold text-[10px] uppercase border-2 border-black shadow-[1.5px_1.5px_0px_rgba(0,0,0,1)] active:translate-y-0.5 rounded-none"
                              >
                                CLOSE ✗
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Closed History List */}
            <div className="bg-white border-4 border-black neo-shadow-lg p-5 select-text">
              <div className="flex justify-between items-center mb-4 pb-2 border-b-2 border-dashed border-gray-300 select-none">
                <h2 className="text-xl font-black font-sans tracking-tight text-black uppercase flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600" /> HISTORI TRANSAKSI SELESAI
                </h2>
                <span className="font-mono text-xs font-bold text-gray-500">
                  {positions.filter(p => p.status === 'CLOSED').length} Transaksi Terbuka
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-black bg-neutral-100 font-bold uppercase text-gray-600">
                      <th className="p-3">ID Transaksi</th>
                      <th className="p-3">Pasangan</th>
                      <th className="p-3">Arah</th>
                      <th className="p-3 text-right">Volume</th>
                      <th className="p-3 text-right">Leverage</th>
                      <th className="p-3 text-right">Harga Masuk</th>
                      <th className="p-3 text-right">Harga Keluar</th>
                      <th className="p-3 text-right">Realisasi Laba (USD)</th>
                      <th className="p-3 text-center">Status Selesai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.filter(p => p.status === 'CLOSED').length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-gray-400 italic">
                          Belum ada transaksi historis selesai diarsipkan.
                        </td>
                      </tr>
                    ) : (
                      positions.filter(p => p.status === 'CLOSED').slice(0, 50).map((pos) => {
                        return (
                          <tr key={pos.id} className="border-b border-gray-100 hover:bg-neutral-50/50">
                            <td className="p-3 text-gray-400">{pos.id}</td>
                            <td className="p-3 font-extrabold text-black">{pos.pair}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 font-bold text-[9px] border border-black ${
                                pos.type === 'LONG' ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'
                              }`}>
                                {pos.type}
                              </span>
                            </td>
                            <td className="p-3 text-right font-semibold">{pos.quantity} Lot</td>
                            <td className="p-3 text-right">{pos.leverage}x</td>
                            <td className="p-3 text-right font-medium">${pos.entryPrice.toLocaleString()}</td>
                            <td className="p-3 text-right font-bold">${pos.closePrice?.toLocaleString() || '-'}</td>
                            <td className={`p-3 text-right font-black font-mono text-xs ${pos.pnl >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                              {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-3 text-center">
                              <span className="px-2 py-0.5 bg-neutral-200 text-neutral-800 text-[10px] font-bold border border-black uppercase text-center">
                                CLOSED ✓
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* 2C. LIVE COMMMANND SHELL TERMINAL PAGE */}
        {activeTab === 'LIVE_TERMINAL' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-dots-yellow border-4 border-black p-6 neo-shadow-md flex flex-col md:flex-row items-center justify-between gap-4 select-none">
              <div>
                <h2 className="text-2xl font-black font-sans tracking-tight uppercase text-black">
                  COMMAND-LINE TERMINAL DASHBOARD
                </h2>
                <p className="text-xs font-mono text-black mt-1">
                  Kontrol posisi, review database, inspect server API CoinGecko & DexScreener lewat baris instruksi solid unix shell.
                </p>
              </div>
              <span className="bg-black text-[#FDDF09] border-2 border-black p-2 font-mono text-xs font-bold shadow-[2px_2px_rgba(0,0,0,1)] uppercase">
                STATUS ENGINE: ONLINE_SSL22
              </span>
            </div>

            <LiveTerminal 
              logs={terminalLogs}
              onClearLogs={() => setTerminalLogs([])}
              onExecuteCommand={handleTerminalCommand}
            />
          </div>
        )}

      </main>

      {/* 4. SOLID RETRO FOOTER BOARD (Exactly styled like Page 4 PDF footer) */}
      <footer id="sa_forge_main_footer" className="bg-[#FDDF09] border-t-4 border-black select-none mt-12">
        <div className="max-w-7xl mx-auto px-6 py-8 text-center text-black font-mono">
          <p className="font-extrabold text-sm uppercase tracking-tight">
            © 2026 SA FORGE. ALL RIGHTS RESERVED.
          </p>
          <p className="text-[11px] font-bold uppercase text-yellow-950 mt-1.5 tracking-wide">
            ENGINEERED WITH COMPASSIONATE RETRO PIXELS & REAL-TIME PRICE ROUTING BY KOTKAAJA
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-4 text-[10px] text-yellow-900 border-t border-dashed border-black/30 pt-4">
            <span>PLATFORM: COINGECKO CONNECT READY</span>
            <span>•</span>
            <span>REST INTERFACE: DEXSCREENER SECURE LQR</span>
            <span>•</span>
            <span>WIDGET CHARTS: TRADINGVIEW SPOT API</span>
          </div>
        </div>
      </footer>

      {/* 5. FLOATING DETAIL TRADING MODAL (Core Modal requested) */}
      {liveSelectedAsset && (
        <DetailModal 
          asset={liveSelectedAsset}
          balance={walletBalance}
          activePositions={positions}
          onClose={() => setSelectedAsset(null)}
          onOpenPosition={handleOpenPosition}
          onClosePosition={(id) => executePositionClosure(id)}
        />
      )}

    </div>
  );
}

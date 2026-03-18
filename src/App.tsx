import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { 
  Home as HomeIcon, 
  Wallet as WalletIcon, 
  Menu as MenuIcon,
  Play,
  Square,
  ChevronRight,
  Plus,
  Trash2,
  Edit2,
  X,
  Check,
  Download,
  Calendar,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  MapPin,
  MessageSquare,
  Bike,
  ClipboardList
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, differenceInSeconds, startOfDay, endOfDay, isWithinInterval, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useStorage, type StorageHook } from './hooks/useStorage';
import { type Ride, type Goal, type GoalPeriod, type PaymentMethod, cn } from './types';

// --- Constants ---

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: 'Pix',
  cash: 'Dinheiro',
  card: 'Cartão'
};

// --- UI Components ---

const Card = ({ children, className, onClick }: { children: ReactNode, className?: string, onClick?: () => void, key?: string | number }) => (
  <motion.div 
    whileHover={onClick ? { scale: 1.01, y: -2 } : {}}
    whileTap={onClick ? { scale: 0.99 } : {}}
    onClick={onClick}
    className={cn(
      "glass rounded-xl p-4 transition-all duration-300 border border-white/[0.05]", 
      onClick ? "cursor-pointer hover:border-accent/20 hover:bg-white/[0.05]" : "",
      className
    )}
  >
    {children}
  </motion.div>
);

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className,
  disabled = false
}: { 
  children: ReactNode, 
  onClick?: () => void, 
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost',
  className?: string,
  disabled?: boolean
}) => {
  const variants = {
    primary: 'bg-accent text-black shadow-lg shadow-accent/10 hover:shadow-accent/20 btn-shine',
    secondary: 'bg-white/[0.05] text-white border border-white/[0.08] hover:bg-white/[0.08]',
    danger: 'bg-red-500/10 text-red-500 border border-red-500/10 hover:bg-red-500/20',
    ghost: 'bg-transparent text-white/40 hover:text-white'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "px-5 py-3 rounded-xl font-sans font-bold tracking-tight transition-all active:scale-95 disabled:opacity-30 disabled:active:scale-100 text-[14px]",
        variants[variant],
        className
      )}
    >
      {children}
    </button>
  );
};

const RideSkeleton = () => (
  <div className="flex items-center justify-between p-4 border border-white/[0.05] rounded-2xl bg-white/[0.02] animate-pulse">
    <div className="flex items-center gap-4">
      <div className="space-y-2">
        <div className="h-4 w-20 bg-white/[0.05] rounded" />
        <div className="h-3 w-32 bg-white/[0.05] rounded" />
      </div>
    </div>
    <div className="space-y-2 flex flex-col items-end">
      <div className="h-2 w-12 bg-white/[0.05] rounded" />
      <div className="w-7 h-7 rounded-full bg-white/[0.05]" />
    </div>
  </div>
);

const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: ReactNode }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />
        <motion.div 
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md glass-dark rounded-t-2xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto no-scrollbar border border-white/[0.08]"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold tracking-tight">{title}</h3>
            <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-all active:scale-75">
              <X size={20} />
            </button>
          </div>
          {children}
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

// --- Screens ---

const HomeScreen = ({ storage, onNavigate }: { storage: StorageHook, onNavigate: (tab: string) => void }) => {
  const { state, startWork, startRide, addCheckIn } = storage;
  const [showBalance, setShowBalance] = useState(true);
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [checkInNote, setCheckInNote] = useState('');
  
  const todayRides = (state.rides || []).filter((r: Ride) => {
    try {
      return isWithinInterval(r.startTime, { start: startOfDay(new Date()), end: endOfDay(new Date()) });
    } catch {
      return false;
    }
  });
  const todayEarnings = todayRides.reduce((acc: number, r: Ride) => acc + r.value, 0);

  const getGoalProgress = () => {
    if (!state.goal) return { rides: [], earnings: 0, label: '' };
    
    let start, end;
    const now = new Date();
    
    switch (state.goal.period) {
      case 'weekly':
        start = startOfWeek(now, { weekStartsOn: 1 });
        end = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'monthly':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'daily':
      default:
        start = startOfDay(now);
        end = endOfDay(now);
        break;
    }

    if (!start || !end) return { rides: [], earnings: 0, label: '' };

    const periodRides = (state.rides || []).filter((r: Ride) => {
      try {
        return isWithinInterval(r.startTime, { start, end });
      } catch {
        return false;
      }
    });
    const periodEarnings = periodRides.reduce((acc: number, r: Ride) => acc + r.value, 0);
    const label = state.goal.period === 'daily' ? 'Diária' : state.goal.period === 'weekly' ? 'Semanal' : 'Mensal';

    return { rides: periodRides, earnings: periodEarnings, label };
  };

  const goalProgress = getGoalProgress();
  
  const getWorkedTime = () => {
    if (!state.workStartTime) return '00:00';
    const seconds = differenceInSeconds(new Date(), state.workStartTime);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const handleCheckIn = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`;
          addCheckIn(checkInNote, loc);
          setIsCheckInModalOpen(false);
          setCheckInNote('');
        },
        () => {
          addCheckIn(checkInNote, 'Localização não disponível');
          setIsCheckInModalOpen(false);
          setCheckInNote('');
        }
      );
    } else {
      addCheckIn(checkInNote, 'Geolocalização não suportada');
      setIsCheckInModalOpen(false);
      setCheckInNote('');
    }
  };

  return (
    <div className="space-y-5 pb-28">
      <header className="flex justify-between items-center px-1">
        <div>
          <p className="label-caps mb-0.5 opacity-60">{format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
          <h1 className="text-lg font-bold tracking-tight">Olá, {state.settings.userName}</h1>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsCheckInModalOpen(true)}
            className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent hover:bg-accent/20 transition-all active:scale-90"
          >
            <ShieldCheck size={20} />
          </button>
          <button 
            onClick={() => onNavigate('menu')}
            className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-white/40 hover:text-white transition-all active:scale-90"
          >
            <MenuIcon size={20} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4">
        <Card className="border-l-4 border-l-accent bg-gradient-to-br from-accent/[0.03] to-transparent p-5">
          <div className="flex justify-between items-center mb-3">
            <p className="label-caps text-accent">Ganhos de Hoje</p>
            <button 
              onClick={() => setShowBalance(!showBalance)}
              className="p-1 bg-white/5 rounded-lg text-white/40 hover:text-white transition-all"
            >
              {showBalance ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-white/20 font-bold text-lg">R$</span>
            {showBalance ? (
              <h2 className="text-2xl font-bold tracking-tight leading-none">{todayEarnings.toFixed(2)}</h2>
            ) : (
              <div className="h-8 w-28 bg-white/10 rounded-lg animate-pulse" />
            )}
          </div>
          
          <div className="mt-5 grid grid-cols-2 gap-4 pt-4 border-t border-white/[0.05]">
            <div className="flex flex-col gap-0.5">
              <p className="label-caps opacity-40">Corridas</p>
              <p className="text-lg font-mono font-bold tracking-tight">{todayRides.length.toString().padStart(2, '0')}</p>
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="label-caps opacity-40">Tempo Online</p>
              <p className="text-lg font-mono font-bold tracking-tight">{getWorkedTime()}</p>
            </div>
          </div>
        </Card>

        {state.goal && (
          <Card className="p-5">
            <div className="flex justify-between items-end mb-4">
              <div>
                <p className="label-caps mb-0.5 text-accent">Meta {goalProgress.label}</p>
                <p className="text-lg font-bold tracking-tight">
                  {state.goal.type === 'value' ? `R$ ${state.goal.target}` : `${state.goal.target} Corridas`}
                </p>
              </div>
              <p className="text-accent font-mono font-bold text-base">
                {state.goal.type === 'value' 
                  ? `${Math.round((goalProgress.earnings / state.goal.target) * 100)}%`
                  : `${Math.round((goalProgress.rides.length / state.goal.target) * 100)}%`
                }
              </p>
            </div>
            <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ 
                  width: `${Math.min(100, (state.goal.type === 'value' ? goalProgress.earnings : goalProgress.rides.length) / state.goal.target * 100)}%` 
                }}
                className="h-full bg-accent shadow-[0_0_10px_rgba(0,255,133,0.3)]"
              />
            </div>
            <div className="mt-3 flex justify-between items-center">
              <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.15em]">
                {state.goal.type === 'value'
                  ? `Faltam R$ ${Math.max(0, state.goal.target - goalProgress.earnings).toFixed(2)}`
                  : `Faltam ${Math.max(0, state.goal.target - goalProgress.rides.length)} corridas`
                }
              </p>
              <div className="w-1 h-1 rounded-full bg-accent/40 animate-pulse" />
            </div>
          </Card>
        )}

        {(state.checkins || []).length > 0 && (
          <Card className="p-4 bg-white/[0.02] border-dashed">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck size={14} className="text-accent" />
              <p className="label-caps text-accent">Último Check-in</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs opacity-60">
                <Calendar size={12} />
                <span>{format(state.checkins[0].timestamp, 'HH:mm')} • {format(state.checkins[0].timestamp, 'dd/MM')}</span>
              </div>
              {state.checkins[0].location && (
                <div className="flex items-center gap-2 text-xs opacity-60">
                  <MapPin size={12} />
                  <span>{state.checkins[0].location}</span>
                </div>
              )}
              {state.checkins[0].note && (
                <div className="flex items-start gap-2 text-xs opacity-80 bg-white/[0.03] p-2 rounded-lg">
                  <MessageSquare size={12} className="mt-0.5 shrink-0" />
                  <span>{state.checkins[0].note}</span>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      <Modal 
        isOpen={isCheckInModalOpen} 
        onClose={() => setIsCheckInModalOpen(false)} 
        title="Check-in de Segurança"
      >
        <div className="space-y-6">
          <div className="p-4 bg-accent/5 border border-accent/10 rounded-2xl flex items-start gap-3">
            <ShieldCheck className="text-accent shrink-0" size={20} />
            <p className="text-sm text-white/60 leading-relaxed">
              O check-in registra sua localização atual e um status opcional para seu histórico de segurança.
            </p>
          </div>
          
          <div className="space-y-3">
            <label className="label-caps opacity-60 ml-1">Observação (Opcional)</label>
            <textarea 
              value={checkInNote}
              onChange={(e) => setCheckInNote(e.target.value)}
              placeholder="Ex: Parado para descanso, abastecendo..."
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 text-sm focus:border-accent outline-none transition-all min-h-[100px] resize-none"
            />
          </div>

          <Button onClick={handleCheckIn} className="w-full py-4 rounded-xl flex items-center justify-center gap-2">
            <MapPin size={18} />
            Confirmar Check-in
          </Button>
        </div>
      </Modal>

      <div className="fixed bottom-20 left-4 right-4 z-40">
        {state.appState === 'idle' ? (
          <Button onClick={startWork} className="w-full py-3.5 flex items-center justify-center gap-2 text-base rounded-xl">
            <div className="w-7 h-7 rounded-lg bg-black/10 flex items-center justify-center">
              <Play size={16} fill="currentColor" />
            </div>
            Iniciar Expediente
          </Button>
        ) : state.appState === 'working' ? (
          <Button onClick={startRide} className="w-full py-3.5 flex items-center justify-center gap-2 text-base rounded-xl">
            <div className="w-7 h-7 rounded-lg bg-black/10 flex items-center justify-center">
              <Plus size={18} strokeWidth={3} />
            </div>
            Nova Corrida
          </Button>
        ) : (
          <Button onClick={() => onNavigate('ride')} className="w-full py-3.5 flex items-center justify-center gap-2 bg-white text-black text-base rounded-xl shadow-xl shadow-white/5">
            <div className="w-7 h-7 rounded-lg bg-black/5 flex items-center justify-center">
              <AlertCircle size={16} strokeWidth={2.5} />
            </div>
            Corrida Ativa
          </Button>
        )}
      </div>
    </div>
  );
};

const RideScreen = ({ storage }: { storage: StorageHook }) => {
  const { state, endRide, cancelRide } = storage;
  const [elapsed, setElapsed] = useState(0);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [rideValue, setRideValue] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');

  useEffect(() => {
    if (!state.rideStartTime) return;
    
    const timer = setInterval(() => {
      setElapsed(differenceInSeconds(new Date(), state.rideStartTime));
    }, 1000);

    return () => clearInterval(timer);
  }, [state.rideStartTime]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleFinish = () => {
    const value = parseFloat(rideValue);
    if (isNaN(value) || !paymentMethod) return;
    endRide(value, paymentMethod);
    setShowFinishModal(false);
    setRideValue('');
    setPaymentMethod('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col p-6 font-sans">
      <div className="flex-1 flex flex-col items-center justify-center space-y-8">
        <div className="flex items-center gap-3 px-4 py-2 bg-accent/10 border border-accent/20 rounded-full">
          <div className="w-2 h-2 bg-accent rounded-full animate-pulse shadow-[0_0_10px_rgba(0,255,133,0.6)]" />
          <p className="label-caps text-accent mb-0 tracking-[0.2em]">Corrida em Curso</p>
        </div>
        
        <div className="text-center">
          <h2 className="text-5xl font-mono font-extrabold tracking-tighter tabular-nums text-white leading-none">{formatTime(elapsed)}</h2>
          <p className="label-caps mt-4 opacity-40 text-[11px]">Tempo de Viagem</p>
        </div>
        
        <div className="flex flex-col items-center gap-2 glass px-6 py-3 rounded-2xl">
          <p className="label-caps text-white/60 text-[11px]">Início às {format(state.rideStartTime || Date.now(), 'HH:mm')}</p>
        </div>
        
        {elapsed > 3600 * 2 && (
          <div className="flex items-center gap-3 text-yellow-500 bg-yellow-500/10 px-6 py-3 rounded-2xl border border-yellow-500/20">
            <AlertCircle size={20} />
            <span className="text-sm font-extrabold uppercase tracking-widest">Alerta: Corrida Longa</span>
          </div>
        )}
      </div>

      <div className="pb-12">
        <motion.div 
          className="relative h-20 bg-white/[0.03] border border-white/[0.08] rounded-3xl p-2 flex items-center"
          initial={false}
        >
          <motion.div 
            drag="x"
            dragConstraints={{ left: 0, right: 220 }}
            dragElastic={0.05}
            onDragEnd={(_, info) => {
              if (info.offset.x > 160) {
                setShowFinishModal(true);
              }
            }}
            className="absolute left-2 z-10 w-16 h-16 bg-accent rounded-2xl flex items-center justify-center cursor-grab active:cursor-grabbing shadow-[0_0_20px_rgba(0,255,133,0.4)]"
          >
            <ChevronRight size={32} className="text-black" strokeWidth={3} />
          </motion.div>
          <p className="w-full text-center label-caps text-white/20 text-[10px] tracking-[0.2em] pl-8">
            Deslize para encerrar
          </p>
        </motion.div>
      </div>

      <Modal 
        isOpen={showFinishModal} 
        onClose={() => setShowCancelConfirm(true)} 
        title="Finalizar Corrida"
      >
        <div className="space-y-8">
          <div>
            <label className="label-caps block mb-3 opacity-60">Valor da Corrida</label>
            <div className="relative">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 font-extrabold text-xl text-white/10">R$</span>
              <input 
                type="number" 
                inputMode="decimal"
                value={rideValue}
                onChange={(e) => setRideValue(e.target.value)}
                placeholder="0.00"
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 pl-16 text-3xl font-extrabold tracking-tighter focus:border-accent outline-none transition-all placeholder:text-white/5"
              />
            </div>
          </div>

          <div>
            <label className="label-caps block mb-3 opacity-60">Forma de Pagamento</label>
            <div className="grid grid-cols-3 gap-3">
              {(['pix', 'cash', 'card'] as PaymentMethod[]).map((method) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={cn(
                    "py-5 rounded-2xl font-extrabold border transition-all uppercase tracking-[0.1em] text-[10px]",
                    paymentMethod === method 
                      ? "bg-accent border-accent text-black shadow-lg shadow-accent/20 scale-[1.02]" 
                      : "bg-white/[0.03] border-white/[0.08] text-white/30 hover:bg-white/[0.06] hover:text-white/60"
                  )}
                >
                  {PAYMENT_METHOD_LABELS[method]}
                </button>
              ))}
            </div>
          </div>

          <Button 
            onClick={handleFinish} 
            className="w-full py-4 text-lg rounded-2xl"
            disabled={!rideValue || !paymentMethod}
          >
            Confirmar e Salvar
          </Button>
        </div>
      </Modal>

      <Modal 
        isOpen={showCancelConfirm} 
        onClose={() => setShowCancelConfirm(false)} 
        title="Cancelar Finalização?"
      >
        <div className="space-y-6">
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3">
            <AlertCircle className="text-red-500 shrink-0" size={20} />
            <p className="text-sm text-red-200/60 leading-relaxed">
              Deseja cancelar esta corrida ou continuar o preenchimento? Se cancelar, a corrida não será registrada no histórico.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Button 
              variant="danger" 
              onClick={() => {
                cancelRide();
                setShowCancelConfirm(false);
                setShowFinishModal(false);
              }} 
              className="w-full py-4 rounded-xl"
            >
              Cancelar Corrida
            </Button>
            <Button 
              variant="secondary" 
              onClick={() => setShowCancelConfirm(false)} 
              className="w-full py-4 rounded-xl"
            >
              Continuar Preenchimento
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

const WalletScreen = ({ storage }: { storage: StorageHook }) => {
  const [filter, setFilter] = useState<'today' | '7days' | '30days' | 'custom'>('7days');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isPeriodSelected, setIsPeriodSelected] = useState(false);
  const [customRange, setCustomRange] = useState({ start: format(new Date(), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') });
  const { state } = storage;

  const filterLabels: Record<string, string> = {
    today: 'Hoje',
    '7days': 'Últimos 7 dias',
    '30days': 'Últimos 30 dias',
    custom: 'Personalizado'
  };

  const getFilteredRides = () => {
    const now = new Date();
    let start, end;
    
    if (filter === 'today') {
      start = startOfDay(now);
      end = endOfDay(now);
    } else if (filter === '7days') {
      start = subDays(now, 7);
      end = now;
    } else if (filter === '30days') {
      start = subDays(now, 30);
      end = now;
    } else {
      // Fix: Use local time parsing to avoid timezone shifts
      const [yStart, mStart, dStart] = customRange.start.split('-').map(Number);
      const [yEnd, mEnd, dEnd] = customRange.end.split('-').map(Number);
      start = startOfDay(new Date(yStart, mStart - 1, dStart));
      end = endOfDay(new Date(yEnd, mEnd - 1, dEnd));
    }

    return (state.rides || []).filter((r: Ride) => r.startTime >= start.getTime() && r.startTime <= end.getTime());
  };

  const filteredRides = getFilteredRides();
  const totalEarnings = filteredRides.reduce((acc: number, r: Ride) => acc + r.value, 0);
  const avgPerRide = filteredRides.length ? totalEarnings / filteredRides.length : 0;

  const paymentData = [
    { name: 'Pix', value: filteredRides.filter((r: Ride) => r.paymentMethod === 'pix').reduce((acc: number, r: Ride) => acc + r.value, 0), color: '#00FF85' },
    { name: 'Dinheiro', value: filteredRides.filter((r: Ride) => r.paymentMethod === 'cash').reduce((acc: number, r: Ride) => acc + r.value, 0), color: '#f59e0b' },
    { name: 'Cartão', value: filteredRides.filter((r: Ride) => r.paymentMethod === 'card').reduce((acc: number, r: Ride) => acc + r.value, 0), color: '#3b82f6' },
  ].filter(d => d.value > 0);

  const generatePDF = () => {
    const doc = new jsPDF();
    const title = `Relatório de Ganhos - ${filter === 'custom' ? `${customRange.start} até ${customRange.end}` : filterLabels[filter]}`;
    
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    
    const tableData = filteredRides.map((r: Ride) => [
      format(r.startTime, 'dd/MM/yyyy HH:mm'),
      PAYMENT_METHOD_LABELS[r.paymentMethod].toUpperCase(),
      `R$ ${r.value.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 30,
      head: [['Data/Hora', 'Pagamento', 'Valor']],
      body: tableData,
      foot: [['Total', '', `R$ ${totalEarnings.toFixed(2)}`]]
    });

    doc.save(`relatorio_${filter}_${format(new Date(), 'yyyyMMdd')}.pdf`);
    setIsReportModalOpen(false);
  };

  return (
    <div className="space-y-8 pb-40">
      <header className="px-2 flex justify-between items-center">
        <h1 className="text-2xl font-extrabold tracking-tighter">Carteira</h1>
        <button 
          onClick={() => {
            setIsPeriodSelected(false);
            setIsReportModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-white/[0.05] border border-white/[0.08] rounded-xl text-[11px] font-bold uppercase tracking-wider text-white/60 hover:text-white transition-all active:scale-95"
        >
          <Calendar size={14} className="text-white/40" />
          Selecionar período
        </button>
      </header>

      <Card className="bg-gradient-to-br from-accent/[0.05] to-transparent border-l-4 border-l-accent p-6">
        <p className="label-caps text-accent mb-2">Ganhos no Período</p>
        <div className="flex items-baseline gap-1.5">
          <span className="text-white/20 font-bold text-xl">R$</span>
          <h2 className="text-2xl font-extrabold tracking-tighter leading-none">{totalEarnings.toFixed(2)}</h2>
        </div>
        <p className="text-[10px] font-bold text-white/30 mt-3 uppercase tracking-widest">
          {filter === 'today' ? 'Hoje' : filter === '7days' ? 'Últimos 7 dias' : filter === '30days' ? 'Últimos 30 dias' : `${format(new Date(customRange.start), 'dd/MM')} até ${format(new Date(customRange.end), 'dd/MM')}`}
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-6">
          <p className="label-caps opacity-40 mb-2">Corridas</p>
          <p className="text-xl font-mono font-bold tracking-tighter">{filteredRides.length.toString().padStart(2, '0')}</p>
        </Card>
        <Card className="p-6">
          <p className="label-caps opacity-40 mb-2">Média</p>
          <div className="flex items-baseline gap-1">
            <span className="text-white/20 text-xs font-mono">R$</span>
            <p className="text-xl font-mono font-bold tracking-tighter">{avgPerRide.toFixed(0)}</p>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <p className="label-caps opacity-40 mb-8">Distribuição de Pagamentos</p>
        {paymentData.length > 0 ? (
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <div className="w-full sm:w-1/2 h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentData}
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={6}
                    dataKey="value"
                    stroke="none"
                  >
                    {paymentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full sm:w-1/2 space-y-4">
              {paymentData.map((d) => (
                <div key={d.name} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full shadow-lg" style={{ backgroundColor: d.color, boxShadow: `0 0 8px ${d.color}30` }} />
                    <span className="text-[10px] uppercase font-extrabold tracking-[0.15em] text-white/40 group-hover:text-white/60 transition-colors">{d.name}</span>
                  </div>
                  <span className="text-base font-mono font-bold tracking-tighter">R$ {d.value.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-44 flex items-center justify-center label-caps opacity-10">
            Sem dados para exibir
          </div>
        )}
      </Card>

      <Modal 
        isOpen={isReportModalOpen} 
        onClose={() => setIsReportModalOpen(false)} 
        title="Selecionar período"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-3">
            {[
              { id: 'today', label: 'Hoje' },
              { id: '7days', label: 'Últimos 7 dias' },
              { id: '30days', label: 'Últimos 30 dias' },
              { id: 'custom', label: 'Personalizado' }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setFilter(p.id as any);
                  setIsPeriodSelected(true);
                }}
                className={cn(
                  "w-full flex items-center justify-between p-4 rounded-2xl border transition-all",
                  filter === p.id 
                    ? "bg-accent/10 border-accent/30 text-accent" 
                    : "bg-white/[0.02] border-white/[0.05] text-white/40"
                )}
              >
                <span className="text-sm font-bold">{p.label}</span>
                {filter === p.id && <Check size={18} />}
              </button>
            ))}
          </div>

          {filter === 'custom' && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 p-4 bg-white/[0.02] rounded-2xl border border-white/[0.05]"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="label-caps opacity-40">Início</label>
                  <input 
                    type="date" 
                    value={customRange.start}
                    onChange={(e) => {
                      setCustomRange(prev => ({ ...prev, start: e.target.value }));
                      setIsPeriodSelected(true);
                    }}
                    className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accent/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="label-caps opacity-40">Fim</label>
                  <input 
                    type="date" 
                    value={customRange.end}
                    onChange={(e) => {
                      setCustomRange(prev => ({ ...prev, end: e.target.value }));
                      setIsPeriodSelected(true);
                    }}
                    className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accent/50"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {isPeriodSelected && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Button 
                onClick={generatePDF}
                className="w-full py-4 rounded-2xl"
              >
                Gerar relatório
              </Button>
            </motion.div>
          )}
        </div>
      </Modal>
    </div>
  );
};

const HistoryScreen = ({ storage }: { storage: StorageHook }) => {
  const { state, deleteRide, updateRide } = storage;
  const [editingRide, setEditingRide] = useState<Ride | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="space-y-8 pb-40">
      <header className="px-2">
        <h1 className="text-2xl font-extrabold tracking-tighter">Histórico</h1>
        <p className="label-caps mt-2 opacity-40">{(state.rides || []).length} Atividades registradas</p>
      </header>

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <RideSkeleton key={i} />)
        ) : (
          <>
            {(state.rides || []).map((ride: Ride) => (
              <Card 
                key={ride.id} 
                className="flex items-center justify-between p-4 border-white/[0.05] hover:border-accent/30 hover:bg-white/[0.06] group"
                onClick={() => setEditingRide(ride)}
              >
                <div className="flex items-center gap-4">
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-white/20 font-bold text-xs">R$</span>
                      <p className="font-mono font-bold text-lg tracking-tighter">{ride.value.toFixed(2)}</p>
                    </div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-white/30 mt-0.5">
                      {format(ride.startTime, 'HH:mm')} • {formatDuration(ride.duration)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-white/10 group-hover:text-white/30 transition-colors mb-2">{PAYMENT_METHOD_LABELS[ride.paymentMethod]}</p>
                  <div className="w-7 h-7 rounded-full bg-white/[0.03] flex items-center justify-center ml-auto group-hover:bg-accent/20 group-hover:text-accent transition-all">
                    <ChevronRight size={16} strokeWidth={2.5} />
                  </div>
                </div>
              </Card>
            ))}

            {(state.rides || []).length === 0 && (
              <div className="py-32 text-center">
                <p className="label-caps opacity-10">Nenhum registro encontrado</p>
              </div>
            )}
          </>
        )}
      </div>

      <Modal 
        isOpen={!!editingRide} 
        onClose={() => setEditingRide(null)} 
        title="Detalhes da Corrida"
      >
        {editingRide && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-6 p-5 bg-white/[0.02] rounded-2xl border border-white/[0.05]">
              <div className="space-y-2">
                <p className="label-caps opacity-40">Início</p>
                <p className="font-mono font-bold text-base tracking-tighter">{format(editingRide.startTime, 'HH:mm:ss')}</p>
              </div>
              <div className="space-y-2 text-right">
                <p className="label-caps opacity-40">Fim</p>
                <p className="font-mono font-bold text-base tracking-tighter">{format(editingRide.endTime, 'HH:mm:ss')}</p>
              </div>
              <div className="space-y-2">
                <p className="label-caps opacity-40">Data</p>
                <p className="font-mono font-bold text-base tracking-tighter">{format(editingRide.startTime, 'dd/MM/yy')}</p>
              </div>
              <div className="space-y-2 text-right">
                <p className="label-caps opacity-40">Duração</p>
                <p className="font-mono font-bold text-base tracking-tighter">{formatDuration(editingRide.duration)}</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="label-caps block mb-3 opacity-60">Valor</label>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 font-extrabold text-white/10 text-lg">R$</span>
                  <input 
                    type="number"
                    value={isNaN(editingRide.value) ? '' : editingRide.value}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                      setEditingRide({ ...editingRide, value: val });
                    }}
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl p-3 pl-10 text-xl font-extrabold tracking-tighter focus:border-accent outline-none transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="label-caps block mb-3 opacity-60">Pagamento</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['pix', 'cash', 'card'] as PaymentMethod[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setEditingRide({ ...editingRide, paymentMethod: m })}
                      className={cn(
                        "py-4 rounded-xl font-extrabold border text-[10px] uppercase tracking-[0.15em] transition-all",
                        editingRide.paymentMethod === m 
                          ? "bg-accent border-accent text-black shadow-lg shadow-accent/10" 
                          : "bg-white/[0.03] border-white/[0.08] text-white/30 hover:bg-white/[0.06]"
                      )}
                    >
                      {PAYMENT_METHOD_LABELS[m]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                variant="danger" 
                className="flex-1 py-4 rounded-xl"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Excluir
              </Button>
              <Button 
                className="flex-[2] py-4 rounded-xl"
                onClick={() => {
                  if (editingRide) {
                    updateRide(editingRide.id, editingRide);
                    setEditingRide(null);
                  }
                }}
              >
                Salvar Alterações
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Excluir Corrida">
        <div className="space-y-6">
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3">
            <AlertCircle className="text-red-500 shrink-0" size={20} />
            <p className="text-sm text-red-200/60 leading-relaxed">
              Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)} className="flex-1">
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => { 
              if (editingRide) {
                deleteRide(editingRide.id);
                setEditingRide(null);
                setShowDeleteConfirm(false);
              }
            }} className="flex-1">
              Confirmar Exclusão
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

const MenuScreen = ({ storage }: { storage: StorageHook }) => {
  const { state, updateSettings, setGoal, clearAllData, stopWork, deleteCheckIn } = storage;
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(state.settings.userName);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showCheckInHistory, setShowCheckInHistory] = useState(false);
  const [goalType, setGoalType] = useState<'value' | 'rides'>(state.goal?.type || 'value');
  const [goalPeriod, setGoalPeriod] = useState<GoalPeriod>(state.goal?.period || 'daily');
  const [goalTarget, setGoalTarget] = useState(state.goal?.target.toString() || '');

  return (
    <div className="space-y-8 pb-40">
      <header className="px-2">
        <h1 className="text-2xl font-extrabold tracking-tighter">Ajustes</h1>
      </header>

      <div className="space-y-4">
        <Card onClick={() => setIsEditingName(true)} className="flex items-center justify-between border-white/[0.05] p-6">
          <div>
            <p className="label-caps mb-1.5 opacity-40">Motorista</p>
            <p className="text-lg font-extrabold tracking-tight">{state.settings.userName}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/[0.03] flex items-center justify-center text-white/20 group-hover:text-accent transition-all">
            <Edit2 size={18} />
          </div>
        </Card>

        <Card onClick={() => setShowGoalModal(true)} className="flex items-center justify-between border-white/[0.05] p-6">
          <div>
            <p className="label-caps mb-1.5 opacity-40">Meta Ativa</p>
            <p className="text-lg font-extrabold tracking-tight">
              {state.goal 
                ? `${state.goal.type === 'value' ? 'R$ ' : ''}${state.goal.target}${state.goal.type === 'rides' ? ' corridas' : ''} (${state.goal.period === 'daily' ? 'Diária' : state.goal.period === 'weekly' ? 'Semanal' : 'Mensal'})` 
                : 'Nenhuma meta definida'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/[0.03] flex items-center justify-center text-white/20 group-hover:text-accent transition-all">
            <ChevronRight size={20} />
          </div>
        </Card>

        <Card onClick={() => setShowCheckInHistory(true)} className="flex items-center justify-between border-white/[0.05] p-6">
          <div>
            <p className="label-caps mb-1.5 opacity-40">Segurança</p>
            <p className="text-lg font-extrabold tracking-tight">Histórico de Check-ins</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/[0.03] flex items-center justify-center text-white/20 group-hover:text-accent transition-all">
            <ShieldCheck size={20} />
          </div>
        </Card>

        <div className="pt-8 space-y-4">
          {state.appState !== 'idle' && (
            <Button variant="secondary" onClick={stopWork} className="w-full py-4 rounded-xl">
              Encerrar Expediente
            </Button>
          )}
          <Button 
            variant="danger" 
            onClick={() => setShowResetConfirm(true)} 
            className="w-full py-4 rounded-xl"
          >
            Resetar Aplicativo
          </Button>
        </div>
      </div>

      <Modal isOpen={showCheckInHistory} onClose={() => setShowCheckInHistory(false)} title="Histórico de Segurança">
        <div className="space-y-4">
          {(state.checkins || []).length > 0 ? (
            (state.checkins || []).map((c) => (
              <div key={c.id} className="p-4 bg-white/[0.03] rounded-2xl border border-white/[0.05] flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-accent">{format(c.timestamp, 'dd/MM/yyyy HH:mm')}</p>
                  {c.location && <p className="text-[10px] opacity-40 flex items-center gap-1"><MapPin size={10} /> {c.location}</p>}
                  {c.note && <p className="text-xs opacity-80 mt-2 italic">"{c.note}"</p>}
                </div>
                <button 
                  onClick={() => deleteCheckIn(c.id)}
                  className="p-2 text-red-500/40 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          ) : (
            <div className="py-12 text-center opacity-20 label-caps">Nenhum check-in realizado</div>
          )}
        </div>
      </Modal>

      <Modal isOpen={showResetConfirm} onClose={() => setShowResetConfirm(false)} title="Resetar Dados">
        <div className="space-y-6">
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3">
            <AlertCircle className="text-red-500 shrink-0" size={20} />
            <p className="text-sm text-red-200/60 leading-relaxed">
              Esta ação irá apagar permanentemente todo o seu histórico de corridas, metas e configurações. Esta ação não pode ser desfeita.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setShowResetConfirm(false)} className="flex-1">
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => { clearAllData(); setShowResetConfirm(false); }} className="flex-1">
              Confirmar Reset
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isEditingName} onClose={() => setIsEditingName(false)} title="Nome do Motorista">
        <div className="space-y-8">
          <div className="space-y-3">
            <label className="label-caps opacity-60 ml-2">Seu Nome</label>
            <input 
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 text-lg font-extrabold tracking-tight focus:border-accent outline-none transition-all"
              placeholder="Seu nome"
            />
          </div>
          <Button 
            onClick={() => {
              updateSettings({ userName: newName });
              setIsEditingName(false);
            }} 
            className="w-full py-4 rounded-xl"
          >
            Salvar Nome
          </Button>
        </div>
      </Modal>

      <Modal isOpen={showGoalModal} onClose={() => setShowGoalModal(false)} title="Definir Meta">
        <div className="space-y-8">
          <div className="space-y-4">
            <label className="label-caps opacity-60 ml-2">Tipo de Meta</label>
            <div className="flex p-1.5 bg-white/[0.03] rounded-2xl border border-white/[0.05]">
              <button 
                onClick={() => setGoalType('value')}
                className={cn("flex-1 py-3 rounded-xl text-[10px] uppercase font-extrabold tracking-[0.2em] transition-all", goalType === 'value' ? "bg-accent text-black shadow-lg shadow-accent/10" : "text-white/30")}
              >
                Financeira
              </button>
              <button 
                onClick={() => setGoalType('rides')}
                className={cn("flex-1 py-3.5 rounded-xl text-[10px] uppercase font-extrabold tracking-[0.2em] transition-all", goalType === 'rides' ? "bg-accent text-black shadow-lg shadow-accent/10" : "text-white/30")}
              >
                Corridas
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <label className="label-caps opacity-60 ml-2">Período</label>
            <div className="flex p-1.5 bg-white/[0.03] rounded-2xl border border-white/[0.05]">
              {(['daily', 'weekly', 'monthly'] as GoalPeriod[]).map((p) => (
                <button 
                  key={p}
                  onClick={() => setGoalPeriod(p)}
                  className={cn(
                    "flex-1 py-3.5 rounded-xl text-[9px] uppercase font-extrabold tracking-[0.1em] transition-all", 
                    goalPeriod === p ? "bg-accent text-black shadow-lg shadow-accent/10" : "text-white/30"
                  )}
                >
                  {p === 'daily' ? 'Diária' : p === 'weekly' ? 'Semanal' : 'Mensal'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="label-caps block opacity-60 ml-2">
              {goalType === 'value' ? 'Valor Alvo (R$)' : 'Meta de Corridas'}
            </label>
            <input 
              type="number"
              value={goalTarget}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '' || parseFloat(val) >= 0) {
                  setGoalTarget(val);
                }
              }}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 text-3xl font-extrabold tracking-tighter focus:border-accent outline-none transition-all placeholder:text-white/5"
              placeholder="0"
            />
          </div>

          <div className="flex gap-4">
            <Button variant="secondary" onClick={() => { setGoal(null); setShowGoalModal(false); }} className="flex-1 py-4 rounded-xl">
              Limpar
            </Button>
            <Button 
              onClick={() => {
                if (!goalTarget) return;
                setGoal({
                  type: goalType,
                  period: goalPeriod,
                  target: parseFloat(goalTarget),
                  startDate: Date.now()
                });
                setShowGoalModal(false);
              }} 
              className="flex-[2] py-4 rounded-xl"
            >
              Definir Meta
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const storage = useStorage();
  const [activeTab, setActiveTab] = useState('home');

  useEffect(() => {
    if (storage.state.appState === 'in_ride') {
      setActiveTab('ride');
    } else if (activeTab === 'ride') {
      setActiveTab('home');
    }
  }, [storage.state.appState]);

  const renderContent = () => {
    switch (activeTab) {
      case 'home': return <HomeScreen storage={storage} onNavigate={setActiveTab} />;
      case 'wallet': return <WalletScreen storage={storage} />;
      case 'history': return <HistoryScreen storage={storage} />;
      case 'menu': return <MenuScreen storage={storage} />;
      case 'ride': return <RideScreen storage={storage} />;
      default: return <HomeScreen storage={storage} onNavigate={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-background text-white selection:bg-accent/30">
      <main className="max-w-lg mx-auto px-6 pt-8">
        {renderContent()}
      </main>

    <nav className={cn(
      "fixed bottom-0 left-0 right-0 z-50 glass-dark px-8 py-4 rounded-t-3xl border-t border-white/[0.05] transition-transform duration-500",
      storage.state.appState === 'in_ride' ? "translate-y-full" : "translate-y-0"
    )}>
      <div className="max-w-lg mx-auto flex justify-between items-center">
        {[
          { id: 'home', icon: HomeIcon, label: 'Início' },
          { id: 'wallet', icon: WalletIcon, label: 'Ganhos' },
          { id: 'history', icon: ClipboardList, label: 'Histórico' },
          { id: 'menu', icon: MenuIcon, label: 'Ajustes' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative flex flex-col items-center gap-1.5 transition-all active:scale-75",
              activeTab === tab.id ? "text-accent" : "text-white/20"
            )}
          >
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500",
              activeTab === tab.id ? "bg-accent/5" : "bg-transparent"
            )}>
              <tab.icon size={20} strokeWidth={activeTab === tab.id ? 2.5 : 1.5} />
            </div>
            <span className={cn(
              "text-[8px] font-extrabold tracking-[0.15em] uppercase transition-all duration-300 absolute -bottom-3",
              activeTab === tab.id ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
            )}>
              {tab.label}
            </span>
          </button>
        ))}
      </div>
    </nav>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { GlobalState, Ride, Goal, AppState } from '../types';

const STORAGE_KEY = 'mototrack_pro_data';

const INITIAL_STATE: GlobalState = {
  appState: 'idle',
  workStartTime: null,
  rideStartTime: null,
  rides: [],
  checkins: [],
  settings: {
    userName: 'Motorista',
  },
  goal: null,
};

export interface StorageHook {
  state: GlobalState;
  startWork: () => void;
  stopWork: () => void;
  startRide: () => void;
  endRide: (value: number, paymentMethod: Ride['paymentMethod']) => void;
  deleteRide: (id: string) => void;
  updateRide: (id: string, updates: Partial<Ride>) => void;
  addCheckIn: (note?: string, location?: string) => void;
  deleteCheckIn: (id: string) => void;
  updateSettings: (settings: GlobalState['settings']) => void;
  setGoal: (goal: Goal | null) => void;
  clearAllData: () => void;
  cancelRide: () => void;
}

export function useStorage(): StorageHook {
  const [state, setState] = useState<GlobalState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...INITIAL_STATE, ...parsed };
      } catch (e) {
        console.error('Failed to parse storage', e);
      }
    }
    return INITIAL_STATE;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const updateState = (updates: Partial<GlobalState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const startWork = () => {
    updateState({
      appState: 'working',
      workStartTime: Date.now(),
    });
  };

  const stopWork = () => {
    updateState({
      appState: 'idle',
      workStartTime: null,
      rideStartTime: null,
    });
  };

  const startRide = () => {
    updateState({
      appState: 'in_ride',
      rideStartTime: Date.now(),
    });
  };

  const endRide = (value: number, paymentMethod: Ride['paymentMethod']) => {
    if (!state.rideStartTime) return;

    const endTime = Date.now();
    const duration = Math.floor((endTime - state.rideStartTime) / 1000);

    const newRide: Ride = {
      id: crypto.randomUUID(),
      value,
      paymentMethod,
      startTime: state.rideStartTime,
      endTime,
      duration,
    };

    updateState({
      appState: 'working',
      rideStartTime: null,
      rides: [newRide, ...state.rides],
    });
  };

  const deleteRide = (id: string) => {
    updateState({
      rides: state.rides.filter((r) => r.id !== id),
    });
  };

  const updateRide = (id: string, updates: Partial<Ride>) => {
    updateState({
      rides: state.rides.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    });
  };

  const updateSettings = (settings: GlobalState['settings']) => {
    updateState({ settings });
  };

  const setGoal = (goal: Goal | null) => {
    updateState({ goal });
  };

  const clearAllData = () => {
    setState(INITIAL_STATE);
  };

  const cancelRide = () => {
    updateState({
      appState: 'working',
      rideStartTime: null,
    });
  };

  const addCheckIn = (note?: string, location?: string) => {
    const newCheckIn = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      note,
      location,
    };
    updateState({
      checkins: [newCheckIn, ...state.checkins],
    });
  };

  const deleteCheckIn = (id: string) => {
    updateState({
      checkins: state.checkins.filter((c) => c.id !== id),
    });
  };

  return {
    state,
    startWork,
    stopWork,
    startRide,
    endRide,
    deleteRide,
    updateRide,
    addCheckIn,
    deleteCheckIn,
    updateSettings,
    setGoal,
    clearAllData,
    cancelRide,
  };
}

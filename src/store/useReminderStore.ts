import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TimeReminder {
  enabled: boolean;
  hour: number;
  minute: number;
}

export interface ReminderSettings {
  checkIn: TimeReminder;
  checkOut: TimeReminder;
  /** Ngày trong tuần được nhắc: 1 = Chủ nhật, 2 = Thứ Hai ... 7 = Thứ Bảy */
  weekdays: number[];
  payroll: { enabled: boolean; day: number };
}

interface ReminderState {
  settings: ReminderSettings;
  update: (patch: Partial<ReminderSettings>) => void;
}

export const defaultReminderSettings: ReminderSettings = {
  checkIn: { enabled: false, hour: 7, minute: 30 },
  checkOut: { enabled: false, hour: 17, minute: 30 },
  weekdays: [2, 3, 4, 5, 6],
  payroll: { enabled: false, day: 1 },
};

export const useReminderStore = create<ReminderState>()(
  persist(
    (set) => ({
      settings: defaultReminderSettings,
      update: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
    }),
    {
      name: 'reminder-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

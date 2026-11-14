import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AttendanceRecord,
  SalaryConfig,
  ShiftConfig,
  ShiftType,
  TaxSettings,
  getTaxSettings,
  SHIFT_COLOR_PALETTE,
  getShift,
  normalizeConfig,
  splitScheduledHours,
  buildShiftTimestamps,
} from '../utils/salaryCalculator';

export interface SalaryState {
  config: SalaryConfig;
  attendance: AttendanceRecord[];
  
  // Actions
  updateConfig: (
    config: Partial<SalaryConfig>
  ) => void;
  /** Cập nhật cài đặt thuế TNCN và bảo hiểm */
  updateTax: (tax: Partial<TaxSettings>) => void;
  /** Thêm ca mới, trả về id của ca vừa tạo */
  addShift: (
    shift?: Partial<ShiftConfig>
  ) => string;
  /** Cập nhật cấu hình 1 ca */
  updateShift: (
    id: ShiftType,
    shift: Partial<ShiftConfig>
  ) => void;
  /** Xoá 1 ca (các bản ghi cũ vẫn giữ, hiển thị là "Ca đã xoá") */
  deleteShift: (id: ShiftType) => void;
  addRecord: (
    record: AttendanceRecord
  ) => void;
  updateRecord: (
    id: string,
    record: Partial<AttendanceRecord>
  ) => void;
  deleteRecord: (id: string) => void;

  /**
   * Tạo bản ghi check-in mới
   * @param date YYYY-MM-DD
   * @param shiftType loại ca làm
   */
  checkIn: (
    date: string,
    shiftType: ShiftType,
    options?: {
      autoComplete?: boolean;
    }
  ) => void;

  /**
   * Ghi check-out cho bản ghi,
   * tự tính actualHours
   */
  checkOut: (id: string) => void;
}

// Cấu hình mặc định trung tính cho người dùng mới.
// Các con số chỉ là ví dụ, người dùng sửa lại trong "Cài đặt hệ số lương".
export const defaultConfig: SalaryConfig = {
  shifts: {
    regular: {
      name: 'Ca thường',
      color: SHIFT_COLOR_PALETTE[0],
      icon: 'sunny',
      isOff: false,
      startTime: '08:00',
      endTime: '16:00',
      calcMode: 'manual',
      baseHours: 8,
      overtimeHours: 0,
      baseRate: 30000,
      overtimeRate: 45000,
      extraHours: 0,
      extraRate: 0,
      baseSalary: 0,
      workDayMode: 'month',
      customWorkDays: 26,
      overtimeMultiplier: 1.5,
      extraMultiplier: 1,
      allowance: 0,
    },
    holiday: {
      name: 'Ngày nghỉ / lễ',
      color: SHIFT_COLOR_PALETTE[2],
      icon: 'sunny-outline',
      isOff: true,
      startTime: '08:00',
      endTime: '16:00',
      calcMode: 'manual',
      baseHours: 8,
      overtimeHours: 0,
      baseRate: 60000,
      overtimeRate: 90000,
      extraHours: 0,
      extraRate: 0,
      baseSalary: 0,
      workDayMode: 'month',
      customWorkDays: 26,
      overtimeMultiplier: 1.5,
      extraMultiplier: 1,
      allowance: 0,
    },
  },
  shiftOrder: ['regular', 'holiday'],
  taxRate: 0,
};

export const useSalaryStore = create<SalaryState>()(
  persist(
    (set, get) => ({
      config: defaultConfig,
      attendance: [],

      updateConfig: (newConfig) =>
        set((state) => ({
          config: {
            ...state.config,
            ...newConfig,
          },
        })),
        
      updateTax: (tax) =>
        set((state) => ({
          config: {
            ...state.config,
            tax: { ...getTaxSettings(state.config), ...tax },
          },
        })),

      addShift: (shift) => {
        const id = `shift-${Date.now()}`;
        const count = get().config.shiftOrder.length;
        const newShift: ShiftConfig = {
          name: `Ca mới ${count + 1}`,
          color:
            SHIFT_COLOR_PALETTE[
              count % SHIFT_COLOR_PALETTE.length
            ],
          icon: 'time',
          isOff: false,
          calcMode: 'manual',
          baseHours: 8,
          overtimeHours: 0,
          baseRate: 0,
          overtimeRate: 0,
          extraHours: 0,
          extraRate: 0,
          baseSalary: 0,
          workDayMode: 'month',
          customWorkDays: 26,
          overtimeMultiplier: 1.5,
          extraMultiplier: 1,
          allowance: 0,
          ...shift,
        };
        set((state) => ({
          config: {
            ...state.config,
            shifts: {
              ...state.config.shifts,
              [id]: newShift,
            },
            shiftOrder: [
              ...state.config.shiftOrder,
              id,
            ],
          },
        }));
        return id;
      },

      updateShift: (id, shift) =>
        set((state) => {
          const current = state.config.shifts[id];
          if (!current) return state;
          return {
            config: {
              ...state.config,
              shifts: {
                ...state.config.shifts,
                [id]: { ...current, ...shift },
              },
            },
          };
        }),

      deleteShift: (id) =>
        set((state) => {
          const { [id]: _removed, ...rest } =
            state.config.shifts;
          return {
            config: {
              ...state.config,
              shifts: rest,
              shiftOrder:
                state.config.shiftOrder.filter(
                  (s) => s !== id
                ),
            },
          };
        }),

      addRecord: (record) =>
        set((state) => ({
          attendance: [
            ...state.attendance,
            record,
          ],
        })),
        
      updateRecord: (id, recordUpdate) =>
        set((state) => ({
          attendance: state.attendance.map(
            (r) =>
              r.id === id
                ? { ...r, ...recordUpdate }
                : r
          ),
        })),
        
      deleteRecord: (id) =>
        set((state) => ({
          attendance:
            state.attendance.filter(
              (r) => r.id !== id
            ),
        })),

      // Check-in: Tạo record mới
      checkIn: (date, shiftType, options) => {
        const now = new Date().toISOString();
        const id = `${date}-${Date.now()}`;
        const { config } = get();
        const shiftCfg = getShift(config, shiftType);
        const autoComplete =
          options?.autoComplete ?? false;

        // Chấm công nhanh: nếu ca đã cài giờ vào/ra thì dùng đúng giờ đó
        const scheduled = autoComplete ? splitScheduledHours(shiftCfg) : null;
        const stamps = autoComplete ? buildShiftTimestamps(date, shiftCfg) : null;

        const newRecord: AttendanceRecord = {
          id,
          date,
          shiftType,
          actualHours: autoComplete
            ? scheduled?.actualHours ?? shiftCfg.baseHours
            : 0,
          overtimeHours: autoComplete
            ? scheduled?.overtimeHours ?? shiftCfg.overtimeHours
            : 0,
          checkInTime: autoComplete
            ? stamps?.checkIn.toISOString()
            : now,
          checkOutTime: autoComplete
            ? stamps?.checkOut.toISOString() ?? now
            : undefined,
        };

        set((state) => ({
          attendance: [
            ...state.attendance,
            newRecord,
          ],
        }));
      },

      // Check-out: Tính giờ làm thực tế
      checkOut: (id) => {
        const now = new Date();
        const nowISO = now.toISOString();

        set((state) => ({
          attendance: state.attendance.map(
            (r) => {
              if (r.id !== id) return r;
              if (!r.checkInTime) return r;

              // Tính số giờ thực tế
              const checkIn = new Date(
                r.checkInTime
              );
              const diffMs =
                now.getTime() -
                checkIn.getTime();
              const diffHours =
                diffMs / (1000 * 60 * 60);
              const rounded =
                Math.round(
                  diffHours * 100
                ) / 100;

              // Lấy config ca để tính OT
              const { config } = get();
              const shiftCfg = getShift(
                config,
                r.shiftType
              );
              const baseH =
                shiftCfg.baseHours;
              const actual = Math.min(
                rounded,
                baseH
              );
              const ot = Math.max(
                0,
                rounded - baseH
              );

              return {
                ...r,
                checkOutTime: nowISO,
                actualHours: actual,
                overtimeHours:
                  Math.round(ot * 100) /
                  100,
              };
            }
          ),
        }));
      },
    }),
    {
      name: 'salary-storage',
      version: 1,
      // v0 -> v1: chuyển 4 ca cố định sang danh sách ca tuỳ chỉnh
      migrate: (persisted: any) => {
        if (!persisted) return persisted;
        return {
          ...persisted,
          config: normalizeConfig(persisted.config),
        };
      },
      storage: createJSONStorage(
        () => AsyncStorage
      ),
    }
  )
);

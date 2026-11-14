import AsyncStorage from '@react-native-async-storage/async-storage';
import { defaultConfig, useSalaryStore } from '../store/useSalaryStore';
import { useProfileStore } from '../store/useProfileStore';
import { useThemeStore } from '../store/useThemeStore';

/**
 * Sao lưu / khôi phục hoàn toàn trên thiết bị.
 * Không có mạng, không có máy chủ: dữ liệu chỉ nằm trong file/văn bản
 * mà chính người dùng chọn cách lưu (Tệp, AirDrop, Ghi chú...).
 */

const BACKUP_KEYS = ['salary-storage', 'profile-storage', 'theme-storage'] as const;
const BACKUP_APP = 'rosala';
const BACKUP_FORMAT = 1;

export async function createBackupJson(): Promise<string> {
  const entries = await AsyncStorage.multiGet([...BACKUP_KEYS]);
  const data: Record<string, string> = {};
  entries.forEach(([key, value]) => {
    if (typeof value === 'string') data[key] = value;
  });

  return JSON.stringify(
    {
      app: BACKUP_APP,
      format: BACKUP_FORMAT,
      exportedAt: new Date().toISOString(),
      data,
    },
    null,
    2
  );
}

export async function restoreFromBackupJson(text: string): Promise<{ records: number }> {
  let parsed: any;
  try {
    parsed = JSON.parse(text.trim());
  } catch {
    throw new Error('Nội dung không phải dữ liệu sao lưu hợp lệ.');
  }

  if (parsed?.app !== BACKUP_APP || typeof parsed?.data !== 'object' || !parsed.data) {
    throw new Error('Đây không phải bản sao lưu của Rosala.');
  }

  const salaryRaw = parsed.data['salary-storage'];
  if (typeof salaryRaw !== 'string') {
    throw new Error('Bản sao lưu không chứa dữ liệu chấm công.');
  }

  let salaryState: any;
  try {
    salaryState = JSON.parse(salaryRaw)?.state;
  } catch {
    throw new Error('Dữ liệu chấm công trong bản sao lưu bị lỗi.');
  }
  if (!salaryState || !Array.isArray(salaryState.attendance) || !salaryState.config) {
    throw new Error('Dữ liệu chấm công trong bản sao lưu không đúng định dạng.');
  }

  // Chỉ ghi khi mọi thứ đã hợp lệ
  for (const key of BACKUP_KEYS) {
    const value = parsed.data[key];
    if (typeof value === 'string') {
      await AsyncStorage.setItem(key, value);
    }
  }

  // Nạp lại vào bộ nhớ (migrate dữ liệu phiên bản cũ nếu cần)
  await useSalaryStore.persist.rehydrate();
  await useProfileStore.persist.rehydrate();
  await useThemeStore.persist.rehydrate();
  useProfileStore.getState().completeOnboarding();

  return { records: salaryState.attendance.length };
}

/** Xoá toàn bộ dữ liệu trên máy và quay về màn hình khởi tạo. */
export async function resetAllData() {
  await AsyncStorage.multiRemove([...BACKUP_KEYS]);
  useSalaryStore.setState({ config: defaultConfig, attendance: [] });
  useProfileStore.getState().resetProfile();
}

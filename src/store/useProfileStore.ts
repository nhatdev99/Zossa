import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserProfile {
  fullName: string;
  employeeCode: string; // Chức danh / ghi chú (tuỳ chọn)
  avatarUri: string | null;
}

interface ProfileState {
  profile: UserProfile;
  /** Đã hoàn tất màn hình khởi tạo ban đầu hay chưa */
  onboarded: boolean;
  updateProfile: (payload: Partial<UserProfile>) => void;
  completeOnboarding: () => void;
  resetProfile: () => void;
}

const defaultProfile: UserProfile = {
  fullName: '',
  employeeCode: '',
  avatarUri: null,
};

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      profile: defaultProfile,
      onboarded: false,
      updateProfile: (payload) =>
        set((state) => ({
          profile: {
            ...state.profile,
            ...payload,
          },
        })),
      completeOnboarding: () => set({ onboarded: true }),
      resetProfile: () =>
        set({
          profile: defaultProfile,
          onboarded: false,
        }),
    }),
    {
      name: 'profile-storage',
      version: 1,
      // v0 -> v1: người dùng cũ đã có dữ liệu thì bỏ qua màn hình khởi tạo
      migrate: (persisted: any) => ({
        ...(persisted ?? {}),
        onboarded: true,
      }),
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAppTheme } from '../hooks/useAppTheme';
import { useProfileStore } from '../store/useProfileStore';

export default function PersonalInfoScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const profile = useProfileStore((s) => s.profile);
  const updateProfileStore = useProfileStore((s) => s.updateProfile);

  const [fullName, setFullName] = useState(profile.fullName);
  const [employeeCode, setEmployeeCode] = useState(profile.employeeCode);
  const [avatarUri, setAvatarUri] = useState<string | null>(profile.avatarUri);

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Thong bao', 'Can cap quyen truy cap thu vien anh.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: true,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const selected = result.assets[0];
    const localUri = selected.base64 ? `data:image/jpeg;base64,${selected.base64}` : selected.uri;
    setAvatarUri(localUri);
  };

  const handleSave = () => {
    if (!fullName.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập họ tên.');
      return;
    }

    updateProfileStore({
      fullName: fullName.trim(),
      employeeCode: employeeCode.trim(),
      avatarUri,
    });

    Alert.alert('Thành công', 'Đã lưu thông tin trên thiết bị.');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Thong tin ca nhan</Text>

      <View style={styles.avatarWrap}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarPlaceholderText}>Avatar</Text>
          </View>
        )}
        <TouchableOpacity style={styles.secondaryBtn} onPress={pickAvatar}>
          <Text style={styles.secondaryBtnText}>Chon anh dai dien</Text>
        </TouchableOpacity>
      </View>

      <Field label="Ho va ten" value={fullName} onChangeText={setFullName} />
      <Field label="Chức danh / ghi chú (không bắt buộc)" value={employeeCode} onChangeText={setEmployeeCode} />

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
        <Text style={styles.saveText}>Lưu thay đổi</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Field({ label, ...props }: { label: string; [key: string]: any }) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={theme.colors.outline}
        {...props}
      />
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.surface,
    },
    content: {
      padding: 16,
      gap: 12,
      paddingBottom: 24,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.colors.onSurface,
      marginBottom: 4,
    },
    avatarWrap: {
      alignItems: 'center',
      gap: 10,
      marginBottom: 6,
    },
    avatar: {
      width: 110,
      height: 110,
      borderRadius: 55,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
    },
    avatarPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceContainerLow,
    },
    avatarPlaceholderText: {
      color: theme.colors.onSurfaceVariant,
      fontWeight: '600',
    },
    fieldWrap: {
      gap: 6,
    },
    label: {
      fontSize: 14,
      color: theme.colors.onSurface,
      fontWeight: '600',
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.colors.onSurface,
      backgroundColor: theme.colors.surfaceContainerLow,
    },
    secondaryBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      backgroundColor: theme.colors.surfaceContainerLowest,
    },
    secondaryBtnText: {
      color: theme.colors.onSurface,
      fontWeight: '600',
    },
    saveBtn: {
      marginTop: 8,
      backgroundColor: theme.colors.primary,
      borderRadius: 10,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveText: {
      color: theme.colors.onPrimary,
      fontWeight: '700',
      fontSize: 15,
    },
  });

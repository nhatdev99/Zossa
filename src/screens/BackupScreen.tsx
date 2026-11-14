import React, { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../hooks/useAppTheme';
import { useSalaryStore } from '../store/useSalaryStore';
import { createBackupJson, resetAllData, restoreFromBackupJson } from '../services/dataBackup';

const LAST_BACKUP_KEY = 'last-manual-backup-at';

export default function BackupScreen() {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const recordCount = useSalaryStore((s) => s.attendance.length);
  const [busy, setBusy] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);

  React.useEffect(() => {
    AsyncStorage.getItem(LAST_BACKUP_KEY).then(setLastBackupAt);
  }, []);

  const handleExport = async () => {
    setBusy(true);
    try {
      const json = await createBackupJson();
      const result = await Share.share({
        title: 'Rosala - sao lưu dữ liệu',
        message: json,
      });
      if (result.action === Share.sharedAction) {
        const nowISO = new Date().toISOString();
        await AsyncStorage.setItem(LAST_BACKUP_KEY, nowISO);
        setLastBackupAt(nowISO);
      }
    } catch (error: any) {
      Alert.alert('Không thể xuất dữ liệu', error?.message || 'Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };

  const handleImport = () => {
    if (!importText.trim()) {
      Alert.alert('Thông báo', 'Hãy dán nội dung bản sao lưu vào ô bên dưới.');
      return;
    }
    Alert.alert(
      'Khôi phục dữ liệu',
      'Dữ liệu hiện tại trên máy sẽ bị thay thế bằng bản sao lưu. Tiếp tục?',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Khôi phục',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              const { records } = await restoreFromBackupJson(importText);
              setImportText('');
              setShowImport(false);
              Alert.alert('Thành công', `Đã khôi phục ${records} bản ghi chấm công.`);
            } catch (error: any) {
              Alert.alert('Khôi phục thất bại', error?.message || 'Dữ liệu không hợp lệ.');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const handleReset = () => {
    Alert.alert(
      'Xoá toàn bộ dữ liệu',
      'Toàn bộ chấm công, cài đặt lương và thông tin cá nhân trên máy sẽ bị xoá vĩnh viễn và không thể khôi phục (trừ khi bạn đã sao lưu). Tiếp tục?',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Xoá hết',
          style: 'destructive',
          onPress: async () => {
            await resetAllData();
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="shield-checkmark-outline" size={32} color={theme.colors.primary} />
        </View>
        <Text style={styles.title}>Dữ liệu của bạn nằm trên máy</Text>
        <Text style={styles.subtitle}>
          Rosala hoạt động hoàn toàn offline, không có tài khoản hay máy chủ. Hãy xuất bản sao lưu
          định kỳ để không mất dữ liệu khi đổi máy hoặc xoá ứng dụng.
        </Text>

        <TouchableOpacity
          style={[styles.backupBtn, busy && styles.backupBtnDisabled]}
          onPress={handleExport}
          disabled={busy}
        >
          <Ionicons name="share-outline" size={18} color={theme.colors.onPrimary} />
          <Text style={styles.backupBtnText}>Xuất bản sao lưu</Text>
        </TouchableOpacity>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Số bản ghi chấm công</Text>
          <Text style={styles.metaValue}>{recordCount}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Lần xuất gần nhất</Text>
          <Text style={styles.metaValue}>
            {lastBackupAt ? new Date(lastBackupAt).toLocaleString('vi-VN') : 'Chưa có'}
          </Text>
        </View>
      </View>

      <View style={[styles.card, { marginTop: 16 }]}>
        <Text style={styles.title}>Khôi phục từ bản sao lưu</Text>
        <Text style={styles.subtitle}>
          Mở bản sao lưu đã lưu (Ghi chú, Tệp, tin nhắn...), sao chép toàn bộ nội dung rồi dán vào đây.
        </Text>

        {!showImport ? (
          <TouchableOpacity style={styles.backupBtn} onPress={() => setShowImport(true)}>
            <Ionicons name="download-outline" size={18} color={theme.colors.onPrimary} />
            <Text style={styles.backupBtnText}>Nhập bản sao lưu</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TextInput
              style={{
                minHeight: 120,
                maxHeight: 220,
                borderWidth: 1,
                borderColor: theme.colors.outlineVariant,
                borderRadius: 12,
                padding: 12,
                color: theme.colors.onSurface,
                textAlignVertical: 'top',
              }}
              multiline
              value={importText}
              onChangeText={setImportText}
              placeholder="Dán nội dung bản sao lưu vào đây"
              placeholderTextColor={theme.colors.outline}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.backupBtn, busy && styles.backupBtnDisabled]}
              onPress={handleImport}
              disabled={busy}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color={theme.colors.onPrimary} />
              <Text style={styles.backupBtnText}>Khôi phục</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <TouchableOpacity style={{ alignItems: 'center', padding: 20 }} onPress={handleReset}>
        <Text style={{ color: theme.colors.error, fontWeight: '600' }}>Xoá toàn bộ dữ liệu trên máy</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.surface,
    },
    contentContainer: {
      padding: 20,
    },
    card: {
      backgroundColor: theme.colors.surfaceContainerLow,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.outlineVariant,
      padding: 20,
      gap: 14,
    },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.primaryContainer,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.colors.onSurface,
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.onSurfaceVariant,
    },
    backupBtn: {
      marginTop: 8,
      height: 46,
      borderRadius: 14,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    backupBtnDisabled: {
      opacity: 0.65,
    },
    backupBtnText: {
      color: theme.colors.onPrimary,
      fontSize: 15,
      fontWeight: '700',
    },
    metaRow: {
      marginTop: 6,
      borderTopWidth: 1,
      borderColor: theme.colors.outlineVariant,
      paddingTop: 12,
      gap: 4,
    },
    metaLabel: {
      fontSize: 12,
      color: theme.colors.outline,
      textTransform: 'uppercase',
    },
    metaValue: {
      fontSize: 14,
      color: theme.colors.onSurface,
      fontWeight: '600',
    },
  });

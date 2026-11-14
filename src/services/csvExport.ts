import { Share } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Ghi CSV (UTF-8 có BOM để Excel đọc đúng tiếng Việt) và mở khay chia sẻ của hệ điều hành. */
export async function shareCsv(filename: string, content: string): Promise<void> {
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write('\uFEFF' + content);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/csv',
      UTI: 'public.comma-separated-values-text',
      dialogTitle: 'Xuất dữ liệu Rosala',
    });
  } else {
    await Share.share({ title: filename, message: content });
  }
}

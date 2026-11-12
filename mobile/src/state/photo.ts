import { useCallback, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';

import { useProfile, useUploadAvatar } from '../api/queries';
import { useAuth } from './auth';

/** The server refuses anything larger; catching it here saves the upload. */
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/**
 * The signed-in teen's photo, or null until they add one.
 *
 * There are two photo fields on the server: the profile's `avatar`, which is
 * what an upload from the app writes, and the account's `profile_picture`,
 * which only older tools set. Reading both, avatar first, is what makes a new
 * photo show up on every screen at once.
 */
export function useMyPhoto(): string | null {
  const { user, isGuest } = useAuth();
  const profile = useProfile(!isGuest);
  return profile.data?.avatar ?? user?.profile_picture ?? null;
}

/**
 * Choose a new photo and upload it.
 *
 * Cropped square while choosing, because it is only ever shown in a circle and
 * a full-size original is a waste of a teen's data. No permission is asked
 * for: the system photo picker does not need one, and asking first meant a
 * refusal stopped the picker from ever opening.
 */
export function useChangePhoto(): {
  change: () => Promise<void>;
  pending: boolean;
  /** A sentence to show under the photo when the picker or upload failed. */
  error: string | null;
} {
  const upload = useUploadAvatar();
  const [pickerError, setPickerError] = useState<string | null>(null);

  const change = useCallback(async () => {
    setPickerError(null);

    let result: ImagePicker.ImagePickerResult;
    try {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
    } catch {
      // A browser can refuse the file input — an iOS Home Screen app opened
      // from a link, for one. That is not an upload failure, and saying so
      // sends the teen to check a connection that is fine.
      setPickerError('We could not open your photos. Try again, or open Faith Tribe in Safari.');
      return;
    }

    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;

    if (asset.fileSize && asset.fileSize > MAX_PHOTO_BYTES) {
      setPickerError('That photo is larger than 5 MB. Choose a smaller one.');
      return;
    }

    try {
      await upload.mutateAsync({
        uri: asset.uri,
        mimeType: asset.mimeType,
        fileName: asset.fileName ?? undefined,
        file: asset.file,
      });
    } catch {
      // Reported through `error`.
    }
  }, [upload]);

  return {
    change,
    pending: upload.isPending,
    error:
      pickerError ??
      (upload.isError
        ? upload.error instanceof Error
          ? upload.error.message
          : 'Your photo did not upload. Check your connection and try again.'
        : null),
  };
}
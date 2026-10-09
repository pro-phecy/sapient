import { File as ExpoFile } from 'expo-file-system';
import type { DocumentPickerAsset } from 'expo-document-picker';
import { supabase } from './supabase';

export const STUDENT_FILES_BUCKET = 'student-files';

export type StudentFileKind = 'resource' | 'timetable';

export async function uploadStudentFile(
  userId: string,
  asset: DocumentPickerAsset,
  options: { kind: StudentFileKind; courseId?: string | null; courseName?: string | null },
) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const sizeBytes = asset.size ?? asset.file?.size ?? 0;
  if (sizeBytes > 50 * 1024 * 1024) throw new Error('This file is larger than the 50 MB upload limit.');

  let fileBody: ArrayBuffer | Uint8Array | Blob;
  if (asset.file) {
    fileBody = asset.file;
  } else {
    fileBody = await new ExpoFile(asset.uri).bytes();
  }

  const fileName = asset.name || asset.file?.name || 'upload';
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${userId}/${options.kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
  const mimeType = asset.mimeType ?? asset.file?.type ?? 'application/octet-stream';

  const { error: uploadError } = await supabase.storage
    .from(STUDENT_FILES_BUCKET)
    .upload(storagePath, fileBody, { contentType: mimeType, upsert: false });
  if (uploadError) throw uploadError;

  const { data, error: metadataError } = await supabase
    .from('resources')
    .insert({
      user_id: userId,
      course_id: options.courseId ?? null,
      course_name: options.courseName ?? null,
      file_name: fileName,
      storage_path: storagePath,
      size_bytes: sizeBytes || null,
      mime_type: mimeType,
      file_kind: options.kind,
    })
    .select()
    .single();

  if (metadataError) {
    await supabase.storage.from(STUDENT_FILES_BUCKET).remove([storagePath]);
    throw metadataError;
  }

  return {
    id: data.id as string,
    course: (data.course_name as string | null) ?? '',
    courseId: (data.course_id as string | null) ?? null,
    name: data.file_name as string,
    size: data.size_bytes ? `${Math.max(1, Math.round(Number(data.size_bytes) / 1024))} KB` : 'Added',
    sizeBytes: (data.size_bytes as number | null) ?? undefined,
    mimeType: data.mime_type as string,
    storagePath: data.storage_path as string,
    kind: data.file_kind as StudentFileKind,
  };
}

export async function createStudentFileUrl(storagePath: string, expiresIn = 60) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.storage
    .from(STUDENT_FILES_BUCKET)
    .createSignedUrl(storagePath, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function removeStudentFiles(storagePaths: string[]) {
  if (!supabase || storagePaths.length === 0) return;
  const { error } = await supabase.storage.from(STUDENT_FILES_BUCKET).remove(storagePaths);
  if (error) throw error;
}

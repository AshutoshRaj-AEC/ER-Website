// Per-artist upload limits. The database enforces them (see the
// add_upload_limits migration); the site checks first so artists get a clear
// message instead of a failed upload.

import { supabase } from "./supabase";

export const getUploadUsage = async () => {
  const { data, error } = await supabase.rpc("my_upload_usage");
  return error ? null : data;
};

export const formatMegabytes = (bytes) => `${Math.round(Number(bytes) / 1024 / 1024)} MB`;

// Storage reports a refused upload (e.g. over the limit) as a security policy error.
export const isStorageRefusal = (error) =>
  /row-level security|violates|unauthorized|403/i.test(error?.message ?? "");

// Bytes still available in a bucket, or null if usage couldn't be loaded.
export const bytesLeft = (usage, bucket) =>
  usage ? Number(usage.limits.bytes[bucket]) - Number(usage.bytes[bucket]) : null;

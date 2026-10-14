import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

export const SUBMISSIONS_BUCKET = "submissions";

export const STATUS_LABELS = {
  pending: "Pending review",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Rejected",
  sent_to_distributor: "Sent to distributor",
};

export const getUserProfile = (user) => {
  if (!user) {
    return null;
  }

  const metadata = user.user_metadata ?? {};

  return {
    name: metadata.full_name ?? metadata.name ?? user.email,
    email: user.email,
    avatar: metadata.avatar_url ?? metadata.picture ?? "",
  };
};

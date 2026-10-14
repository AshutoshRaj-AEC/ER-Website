-- The label can ask an artist to fix something and resubmit, instead of
-- rejecting outright. (Added on its own: a new enum value can't be used in
-- the same transaction that creates it.)
alter type public.submission_status add value if not exists 'changes_requested' after 'pending';

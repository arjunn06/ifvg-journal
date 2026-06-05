-- Add attachments column to notes table for PDF support
ALTER TABLE public.notes 
ADD COLUMN attachments TEXT[] DEFAULT '{}';
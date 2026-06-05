-- Add images column to notes table to store array of image URLs
ALTER TABLE public.notes ADD COLUMN images TEXT[] DEFAULT NULL;
-- Run this in your Supabase SQL Editor to check roles
SELECT email, role FROM profiles;

-- If houssinmhamdi123@gmail.com shows 'student', run:
UPDATE profiles SET role = 'admin' WHERE email = 'houssinmhamdi123@gmail.com';

-- Verify after update:
SELECT email, role FROM profiles;

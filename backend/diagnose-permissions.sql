-- DIAGNOSTIC SCRIPT: Check User Mappings
-- Run this in Supabase SQL Editor to see who can see what.

-- 1. List all Users (Auth + Mapping)
SELECT 
    au.id as user_id, 
    au.email, 
    ucm.company_id, 
    c.name as company_name, 
    ucm.role, 
    ucm.is_active
FROM auth.users au
LEFT JOIN user_company_mapping ucm ON au.id = ucm.user_id
LEFT JOIN companies c ON ucm.company_id = c.id;

-- 2. Check if there are multiple companies
SELECT id, name, code FROM companies;

-- 3. Check products created by Owner vs Admin
SELECT 
    p.code, 
    p.name, 
    p.company_id, 
    p.created_by, 
    au.email as creator_email
FROM products p
LEFT JOIN auth.users au ON p.created_by = au.id
LIMIT 10;

/**
 * Authentication Service - Backend
 * Handles user authentication and session management
 */
import { supabaseServer } from '../config/supabase';

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface SignupData {
    email: string;
    password: string;
    full_name?: string;
}

/**
 * Verify user session token
 */
export async function verifySession(accessToken: string) {
    const { data: { user }, error } = await supabaseServer.auth.getUser(accessToken);

    if (error) throw error;
    return user;
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string) {
    const { data, error } = await supabaseServer
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Create user session
 */
export async function createSession(email: string, password: string) {
    const { data, error } = await supabaseServer.auth.signInWithPassword({
        email,
        password,
    });

    if (error) throw error;
    return data;
}

/**
 * Refresh user session
 */
export async function refreshSession(refreshToken: string) {
    const { data, error } = await supabaseServer.auth.refreshSession({
        refresh_token: refreshToken,
    });

    if (error) throw error;
    return data;
}

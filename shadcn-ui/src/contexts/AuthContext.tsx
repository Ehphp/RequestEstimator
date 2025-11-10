import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
    currentUser: string | null;
    user: User | null;
    setCurrentUser: (user: string) => void;
    isAuthenticated: boolean;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

/**
 * Provider per il contesto di autenticazione con Supabase Auth.
 * 
 * Gestisce:
 * - Autenticazione utente con Supabase
 * - Sessioni persistenti
 * - Stati di loading
 * - Sign out
 * - Fallback a localStorage per development
 * 
 * @example
 * ```tsx
 * <AuthProvider>
 *   <App />
 * </AuthProvider>
 * ```
 */
export function AuthProvider({ children }: AuthProviderProps) {
    const [currentUser, setCurrentUserState] = useState<string | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(true);
    const allowFallbackAuth =
        import.meta.env.DEV || import.meta.env.VITE_ALLOW_FALLBACK_AUTH === 'true';

    useEffect(() => {
        // Inizializza auth e ascolta cambiamenti
        initAuth();

        // Setup listener per cambiamenti auth
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                if (session?.user) {
                    setUser(session.user);
                    setCurrentUserState(session.user.email || null);
                    setIsAuthenticated(true);
                    logger.log('Auth state changed: User authenticated', session.user.email);
                } else {
                    setUser(null);
                    setCurrentUserState(null);
                    setIsAuthenticated(false);
                    logger.log('Auth state changed: User signed out');
                }
                setLoading(false);
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const initAuth = async () => {
        try {
            // Tenta di ottenere sessione Supabase
            const { data: { session }, error } = await supabase.auth.getSession();

            if (error) {
                logger.error('Error getting session:', error);
                // Fallback a localStorage per dev
                setupFallbackAuth();
                return;
            }

            if (session?.user) {
                setUser(session.user);
                setCurrentUserState(session.user.email || null);
                setIsAuthenticated(true);
                logger.log('Session restored:', session.user.email);
            } else {
                // Nessuna sessione valida - usa fallback per dev
                setupFallbackAuth();
            }
        } catch (error) {
            logger.error('Error initializing auth:', error);
            setupFallbackAuth();
        } finally {
            setLoading(false);
        }
    };

    const setupFallbackAuth = () => {
        if (!allowFallbackAuth) {
            logger.warn(
                'Supabase non configurato e fallback auth disabilitato. Imposta VITE_ALLOW_FALLBACK_AUTH=true per consentire il login locale.'
            );
            setIsAuthenticated(false);
            setCurrentUserState(null);
            return;
        }
        // Fallback a localStorage per ambiente dev
        const savedUser = localStorage.getItem('current_user');
        if (savedUser) {
            setCurrentUserState(savedUser);
            setIsAuthenticated(true);
            logger.log('Using fallback auth with localStorage:', savedUser);
        } else {
            // Default dev user
            const devUser = 'current.user@example.com';
            setCurrentUserState(devUser);
            setIsAuthenticated(true);
            localStorage.setItem('current_user', devUser);
            logger.log('Using default dev user:', devUser);
        }
    };

    const setCurrentUser = (userEmail: string) => {
        setCurrentUserState(userEmail);
        localStorage.setItem('current_user', userEmail);
        logger.log('Current user updated:', userEmail);
    };

    const signOut = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;

            setUser(null);
            setCurrentUserState(null);
            setIsAuthenticated(false);
            localStorage.removeItem('current_user');
            logger.log('User signed out successfully');
        } catch (error) {
            logger.error('Error signing out:', error);
            throw error;
        }
    };

    const value: AuthContextType = {
        currentUser,
        user,
        setCurrentUser,
        isAuthenticated,
        loading,
        signOut,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook per accedere al contesto di autenticazione.
 * 
 * Fornisce accesso a:
 * - currentUser: email dell'utente corrente
 * - user: oggetto User completo da Supabase
 * - isAuthenticated: stato autenticazione
 * - loading: stato caricamento iniziale
 * - signOut: funzione per logout
 * 
 * @throws Se usato fuori da AuthProvider
 * @returns Contesto di autenticazione
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { currentUser, loading, signOut } = useAuth();
 *   
 *   if (loading) return <Loader />;
 *   
 *   return (
 *     <div>
 *       Welcome {currentUser}
 *       <button onClick={signOut}>Logout</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);

    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }

    return context;
}

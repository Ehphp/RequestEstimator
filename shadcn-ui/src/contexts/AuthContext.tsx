import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { logger } from '@/lib/logger';

interface AuthContextType {
    currentUser: string;
    setCurrentUser: (user: string) => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

/**
 * Provider per il contesto di autenticazione.
 * 
 * NOTA: Questa è un'implementazione base che usa localStorage.
 * In produzione, integrare con Supabase Auth o altro provider OAuth.
 * 
 * @example
 * ```tsx
 * <AuthProvider>
 *   <App />
 * </AuthProvider>
 * ```
 */
export function AuthProvider({ children }: AuthProviderProps) {
    // Default user - in produzione recuperare da Supabase Auth
    const [currentUser, setCurrentUserState] = useState<string>('current.user@example.com');
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);

    useEffect(() => {
        // Check localStorage per user salvato
        const savedUser = localStorage.getItem('current_user');
        if (savedUser) {
            setCurrentUserState(savedUser);
            logger.log('User loaded from localStorage:', savedUser);
        }

        // TODO: Integrare con Supabase Auth
        // const { data: { user } } = await supabase.auth.getUser();
        // if (user) {
        //   setCurrentUserState(user.email || 'unknown');
        //   setIsAuthenticated(true);
        // }
    }, []);

    const setCurrentUser = (user: string) => {
        setCurrentUserState(user);
        localStorage.setItem('current_user', user);
        logger.log('Current user updated:', user);
    };

    const value: AuthContextType = {
        currentUser,
        setCurrentUser,
        isAuthenticated,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook per accedere al contesto di autenticazione.
 * 
 * @throws Se usato fuori da AuthProvider
 * @returns Contesto di autenticazione
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { currentUser } = useAuth();
 *   return <div>Welcome {currentUser}</div>;
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

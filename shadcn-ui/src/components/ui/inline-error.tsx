import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InlineErrorProps {
    message?: string;
    visible?: boolean;
    fieldId?: string;
    className?: string;
}

/**
 * Componente per messaggi di errore inline nei form
 * 
 * @param message - Testo dell'errore da visualizzare
 * @param visible - Se true, mostra l'errore
 * @param fieldId - ID del campo associato (per aria-describedby)
 * @param className - Classi CSS aggiuntive
 * 
 * @example
 * <InlineError 
 *   fieldId="email"
 *   message="Email non valida"
 *   visible={!!errors.email}
 * />
 */
export function InlineError({
    message,
    visible,
    fieldId,
    className
}: InlineErrorProps) {
    if (!visible || !message) return null;

    return (
        <p
            id={fieldId ? `${fieldId}-error` : undefined}
            className={cn(
                'mt-1.5 text-sm text-destructive flex items-center gap-1.5',
                className
            )}
            role="alert"
            aria-live="polite"
        >
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{message}</span>
        </p>
    );
}

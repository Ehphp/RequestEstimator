import { FileQuestion, Filter, Search, AlertCircle } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    illustration?: 'search' | 'empty-box' | 'filter' | 'error';
    className?: string;
}

/**
 * Componente per stati vuoti con illustrazione e CTA
 * 
 * @param icon - Icona personalizzata (override illustration)
 * @param title - Titolo dello stato vuoto
 * @param description - Descrizione/suggerimento
 * @param action - Azione principale { label, onClick }
 * @param illustration - Tipo illustrazione predefinita
 * @param className - Classi CSS aggiuntive
 * 
 * @example
 * <EmptyState
 *   illustration="filter"
 *   title="Nessun risultato"
 *   description="Prova a modificare i filtri"
 *   action={{ label: "Reimposta", onClick: reset }}
 * />
 */
export function EmptyState({
    icon,
    title,
    description,
    action,
    illustration = 'empty-box',
    className
}: EmptyStateProps) {
    const illustrations = {
        'search': <Search className="h-16 w-16 text-muted-foreground/50" strokeWidth={1.5} />,
        'empty-box': <FileQuestion className="h-16 w-16 text-muted-foreground/50" strokeWidth={1.5} />,
        'filter': <Filter className="h-16 w-16 text-muted-foreground/50" strokeWidth={1.5} />,
        'error': <AlertCircle className="h-16 w-16 text-destructive/50" strokeWidth={1.5} />
    };

    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center py-12 px-4 text-center',
                className
            )}
            role="status"
            aria-live="polite"
        >
            <div className="mb-4 opacity-80">
                {icon || illustrations[illustration]}
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
                {title}
            </h3>
            {description && (
                <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
                    {description}
                </p>
            )}
            {action && (
                <Button onClick={action.onClick} variant="default">
                    {action.label}
                </Button>
            )}
        </div>
    );
}

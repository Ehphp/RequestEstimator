import { cn } from '@/lib/utils';

interface SkeletonProps {
    variant?: 'card' | 'list' | 'text' | 'avatar' | 'chart';
    count?: number;
    className?: string;
}

/**
 * Skeleton loader component per feedback visuale durante caricamento dati
 * 
 * @param variant - Tipo di skeleton: card, list, text, avatar, chart
 * @param count - Numero di skeleton da renderizzare
 * @param className - Classi CSS aggiuntive
 * 
 * @example
 * <Skeleton variant="card" count={3} className="mb-4" />
 */
export function Skeleton({
    variant = 'text',
    count = 1,
    className
}: SkeletonProps) {
    const skeletons = Array.from({ length: count });

    const variantClasses = {
        card: 'h-[200px] rounded-lg',
        list: 'h-[80px] rounded-md',
        text: 'h-4 rounded w-full',
        avatar: 'h-12 w-12 rounded-full',
        chart: 'h-[300px] rounded-lg'
    };

    return (
        <>
            {skeletons.map((_, i) => (
                <div
                    key={i}
                    className={cn(
                        'animate-pulse bg-muted',
                        variantClasses[variant],
                        className
                    )}
                    aria-label="Caricamento in corso"
                    aria-busy="true"
                    role="status"
                />
            ))}
        </>
    );
}

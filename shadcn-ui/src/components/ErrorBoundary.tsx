import { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { logger } from '@/lib/logger';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        logger.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null });
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-red-50 to-orange-50">
                    <Card className="max-w-lg w-full">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <AlertCircle className="h-8 w-8 text-red-500" />
                                <CardTitle className="text-xl">Qualcosa è andato storto</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-gray-600">
                                Si è verificato un errore imprevisto nell'applicazione.
                                Il problema è stato registrato e verrà analizzato.
                            </p>

                            {this.state.error && (
                                <details className="mt-4">
                                    <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                                        Dettagli tecnici
                                    </summary>
                                    <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto max-h-40">
                                        {this.state.error.message}
                                        {'\n\n'}
                                        {this.state.error.stack}
                                    </pre>
                                </details>
                            )}

                            <div className="flex gap-2 pt-4">
                                <Button onClick={this.handleReset} className="flex-1">
                                    Ricarica Applicazione
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => window.history.back()}
                                    className="flex-1"
                                >
                                    Torna Indietro
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}

/**
 * Mock data for testing treemap visualization
 */
import { List } from '../types';

export function createMockLists(): List[] {
    const baseDate = new Date('2025-11-01').toISOString();

    return [
        {
            list_id: 'MOCK-1',
            name: 'HR System Modernization',
            description: 'Modernizzazione del sistema HR',
            owner: 'hr',
            period: 'Q4 2025',
            notes: 'Progetto prioritario',
            status: 'Active' as const,
            preset_key: 'hr_standard',
            created_on: baseDate,
            created_by: 'current.user@example.com'
        },
        {
            list_id: 'MOCK-2',
            name: 'Progetto CRM Enhancement',
            description: 'Miglioramenti al sistema CRM aziendale',
            owner: 'admin',
            period: 'Q1 2026',
            notes: 'Implementazione nuove funzionalità',
            status: 'Active' as const,
            preset_key: 'crm_standard',
            created_on: baseDate,
            created_by: 'current.user@example.com'
        },
        {
            list_id: 'MOCK-3',
            name: 'Digital Transformation Initiative',
            description: 'Iniziativa di trasformazione digitale',
            owner: 'manager',
            period: 'Q4 2025',
            notes: 'Progetto enterprise',
            status: 'Active' as const,
            preset_key: 'enterprise',
            created_on: baseDate,
            created_by: 'current.user@example.com'
        },
        {
            list_id: 'MOCK-4',
            name: 'Sistema CRM',
            description: 'Miglioramenti al sistema CRM aziendale',
            owner: 'admin',
            period: 'Q4 2025',
            notes: 'Quick wins',
            status: 'Draft' as const,
            preset_key: 'crm',
            created_on: baseDate,
            created_by: 'current.user@example.com'
        },
        {
            list_id: 'MOCK-5',
            name: 'Portale Fornitori',
            description: 'Nuovo portale per gestione fornitori',
            owner: 'procurement',
            period: 'Q1 2026',
            notes: 'Progetto medio',
            status: 'Active' as const,
            created_on: baseDate,
            created_by: 'current.user@example.com'
        },
        {
            list_id: 'MOCK-6',
            name: 'Dashboard Reporting',
            description: 'Dashboard per reporting avanzato',
            owner: 'bi.team',
            period: 'Q4 2025',
            notes: 'Progetto piccolo',
            status: 'Active' as const,
            created_on: baseDate,
            created_by: 'current.user@example.com'
        },
        {
            list_id: 'MOCK-7',
            name: 'Mobile App',
            description: 'App mobile per dipendenti',
            owner: 'mobile.team',
            period: 'Q2 2026',
            notes: 'Progetto grande',
            status: 'Draft' as const,
            created_on: baseDate,
            created_by: 'current.user@example.com'
        }
    ];
}

export function createMockStats() {
    return {
        'MOCK-1': { totalRequirements: 15, totalDays: 75.5 },
        'MOCK-2': { totalRequirements: 8, totalDays: 42.3 },
        'MOCK-3': { totalRequirements: 25, totalDays: 150.2 },
        'MOCK-4': { totalRequirements: 3, totalDays: 12.5 },
        'MOCK-5': { totalRequirements: 10, totalDays: 55.0 },
        'MOCK-6': { totalRequirements: 5, totalDays: 18.7 },
        'MOCK-7': { totalRequirements: 20, totalDays: 120.0 }
    };
}

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://pdestnwyumcntpgqstii.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkZXN0bnd5dW1jbnRwZ3FzdGlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3Nzk5MDMsImV4cCI6MjA3NzM1NTkwM30.O5M0qEeBACC6giqeyT5LtUIGgG5qItiZlCCTENNXCn8'

export const supabase = createClient(supabaseUrl, supabaseKey)

// App-specific table names
export const TABLES = {
  LISTS: 'app_5939507989_lists',
  REQUIREMENTS: 'app_5939507989_requirements', 
  ESTIMATES: 'app_5939507989_estimates',
  ACTIVITIES: 'app_5939507989_activities',
  DRIVERS: 'app_5939507989_drivers',
  RISKS: 'app_5939507989_risks',
  CONTINGENCY_BANDS: 'app_5939507989_contingency_bands'
} as const
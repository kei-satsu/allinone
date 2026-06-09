import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://iwtpolqosbwqjcmreyce.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3dHBvbHFvc2J3cWpjbXJleWNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwMzg3NDAsImV4cCI6MjA5MzYxNDc0MH0.WegzvFT91oIM9sqH9URvluTs51v_8Z4MXEwTZRlfo68'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
  
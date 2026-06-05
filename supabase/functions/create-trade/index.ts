import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

function mapTradeTypeToDB(type: 'buy' | 'sell' | 'long' | 'short'): 'long' | 'short' {
  if (type === 'buy' || type === 'long') return 'long'
  if (type === 'sell' || type === 'short') return 'short'
  // Default to long to avoid constraint errors; should be validated earlier
  return 'long'
}

interface TradeRequest {
  trading_account_id: string
  symbol: string
  trade_type: 'buy' | 'sell' | 'long' | 'short'
  entry_price: number
  quantity: number
  strategy_id?: string
  stop_loss?: number
  take_profit?: number
  entry_date?: string
  notes?: string
  emotions?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get user from JWT token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const tradeData: TradeRequest = await req.json()

    // Validate required fields
    if (!tradeData.trading_account_id || !tradeData.symbol || !tradeData.trade_type || 
        !tradeData.entry_price || !tradeData.quantity) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: trading_account_id, symbol, trade_type, entry_price, quantity' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify trading account belongs to user
    const { data: account, error: accountError } = await supabase
      .from('trading_accounts')
      .select('id')
      .eq('id', tradeData.trading_account_id)
      .eq('user_id', user.id)
      .single()

    if (accountError || !account) {
      return new Response(
        JSON.stringify({ error: 'Trading account not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify strategy belongs to user (if provided)
    if (tradeData.strategy_id) {
      const { data: strategy, error: strategyError } = await supabase
        .from('strategies')
        .select('id')
        .eq('id', tradeData.strategy_id)
        .eq('user_id', user.id)
        .single()

      if (strategyError || !strategy) {
        return new Response(
          JSON.stringify({ error: 'Strategy not found or access denied' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Create trade
    const { data: trade, error: tradeError } = await supabase
      .from('trades')
      .insert({
        user_id: user.id,
        trading_account_id: tradeData.trading_account_id,
        symbol: tradeData.symbol,
        trade_type: mapTradeTypeToDB(tradeData.trade_type),
        entry_price: tradeData.entry_price,
        quantity: tradeData.quantity,
        strategy_id: tradeData.strategy_id || null,
        stop_loss: tradeData.stop_loss || null,
        take_profit: tradeData.take_profit || null,
        entry_date: tradeData.entry_date ? new Date(tradeData.entry_date).toISOString() : new Date().toISOString(),
        notes: tradeData.notes || null,
        emotions: tradeData.emotions || null,
        status: 'open'
      })
      .select()
      .single()

    if (tradeError) {
      console.error('Trade creation error:', tradeError)
      return new Response(
        JSON.stringify({ error: 'Failed to create trade', details: tradeError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        trade: trade,
        message: 'Trade created successfully' 
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})